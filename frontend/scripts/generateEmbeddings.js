const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ ERROR: GEMINI_API_KEY environment variable is missing.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
const dbPath = path.join(__dirname, '../public/semantic_embeddings.json');
const manuscriptPath = path.join(__dirname, '../public/manuscript.txt');

// Helper to delay execution (Rate Limit Protection)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const canonicalBooks = [
  // Old Testament
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  // Apocryphal / Deuterocanonical Books
  "Tobit", "Judith", "Additions to Esther", "Wisdom of Solomon", "Sirach", "Baruch", "Letter of Jeremiah", "Prayer of Azariah", "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees", "1 Esdras", "2 Esdras", "Prayer of Manasseh", "Psalm 151", "3 Maccabees", "2 Baruch", "4 Maccabees",
  // New Testament
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

async function generateEmbeddings() {
    console.log("Igniting Local Chapter-Level Semantic Pipeline...");
    
    if (!fs.existsSync(manuscriptPath)) {
        console.error(`❌ ERROR: Could not find ${manuscriptPath}.`);
        console.error(`Please save your text file (e.g. NRSVUE or ASV) to: ${manuscriptPath}`);
        process.exit(1);
    }

    // Load existing database to allow for resume-on-crash
    let embeddings = {};
    if (fs.existsSync(dbPath)) {
        embeddings = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        console.log(`♻️  Found existing database with ${Object.keys(embeddings).length} chapters. Resuming...`);
    }

    console.log("📖 Reading local manuscript text...");
    const rawText = fs.readFileSync(manuscriptPath, 'utf8');
    
    const lines = rawText.split('\n');
    const chapters = [];
    let currentChapterId = null;
    let currentChapterText = [];

    // Parse the local text file
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        let isHeading = false;
        for (const book of canonicalBooks) {
            if (line.startsWith(book)) {
                const remainder = line.substring(book.length).trim();
                // Check if the rest of the line is just the chapter number (e.g., "Genesis 1")
                if (/^\d+$/.test(remainder)) { 
                    isHeading = true;
                    break;
                }
            }
        }

        if (isHeading) {
            // Save the previous chapter before starting a new one
            if (currentChapterId && currentChapterText.length > 0) {
                chapters.push({ id: currentChapterId, text: currentChapterText.join(' ') });
            }
            currentChapterId = line;
            currentChapterText = [];
        } else {
            // Add text lines to the current chapter block
            if (currentChapterId) {
                currentChapterText.push(line);
            }
        }
    }
    
    // Push the very last chapter in the file
    if (currentChapterId && currentChapterText.length > 0) {
        chapters.push({ id: currentChapterId, text: currentChapterText.join(' ') });
    }

    console.log(`✅ Successfully parsed ${chapters.length} chapters from the local file.`);
    let totalEmbedded = 0;

    for (const chapter of chapters) {
        const chapterId = chapter.id;
        
        // Skip if we already embedded this chapter
        if (embeddings[chapterId]) continue;

        try {
            // Strict 4.2 second delay to respect Google API limits
            await sleep(4200);
            
            const result = await model.embedContent(chapter.text);
            embeddings[chapterId] = result.embedding.values;
            
            totalEmbedded++;
            console.log(`[+] Embedded: ${chapterId}`);
            
            // Auto-save every 10 chapters to prevent data loss
            if (totalEmbedded % 10 === 0) {
                fs.writeFileSync(dbPath, JSON.stringify(embeddings));
            }
            
        } catch (error) {
            console.error(`\n❌ API Error on ${chapterId}:`, error.message);
            console.log("💾 Saving progress before exit...");
            fs.writeFileSync(dbPath, JSON.stringify(embeddings));
            process.exit(1);
        }
    }

    // Final save
    fs.writeFileSync(dbPath, JSON.stringify(embeddings));
    console.log(`\n✅ PIPELINE COMPLETE. Total new chapters processed: ${totalEmbedded}`);
    console.log(`✅ Database locked at: ${dbPath}`);
}

generateEmbeddings();