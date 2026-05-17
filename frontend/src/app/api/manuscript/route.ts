import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const CANONICAL_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Tobit", "Judith", "Additions to Esther", "Wisdom of Solomon", "Sirach", "Baruch", "Letter of Jeremiah", "Prayer of Azariah", "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees", "1 Esdras", "2 Esdras", "Prayer of Manasseh", "Psalm 151", "3 Maccabees", "2 Baruch", "4 Maccabees",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

// Helper to determine if a line of text is a new chapter heading
function isChapterHeading(line: string) {
    // The "Psalm" Exception: Catch singular psalm headings to close the capture loop
    if (line.startsWith("Psalm ")) {
        const remainder = line.substring(6).trim();
        if (/^\d+$/.test(remainder)) return true;
    }

    for (const book of CANONICAL_BOOKS) {
        if (line.startsWith(book)) {
            const remainder = line.substring(book.length).trim();
            if (/^\d+$/.test(remainder)) return true;
        }
    }
    return false;
}

// 1. Declare the global cache variable for the manuscript lines
let cachedManuscriptLines: string[] | null = null;

export async function POST(req: Request) {
    try {
        const { chapterId } = await req.json();
        if (!chapterId) return NextResponse.json({ error: "No chapter ID provided." }, { status: 400 });

        console.log(`\n=== Extracting Manuscript Data for: "${chapterId}" ===`);

        // 2. Read from disk and split into lines ONLY if the cache is empty
        if (!cachedManuscriptLines) {
            console.log("Loading manuscript text into memory for the first time...");
            const filePath = path.join(process.cwd(), 'public', 'manuscript.txt');
            if (!fs.existsSync(filePath)) {
                 return NextResponse.json({ error: "manuscript.txt not found in public folder." }, { status: 404 });
            }
            const rawText = fs.readFileSync(filePath, 'utf8');
            cachedManuscriptLines = rawText.split('\n');
        } else {
            console.log("Serving manuscript text from high-speed RAM cache.");
        }

        // 3. Use the cached lines
        const lines = cachedManuscriptLines;

        let isCapturing = false;
        const chapterText: string[] = [];

        // The Pluralization Patch
        let searchId = chapterId;
        if (searchId.startsWith("Psalms ")) {
            searchId = searchId.replace("Psalms ", "Psalm ");
        }

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // When we hit our target chapter heading, turn the capture beam on
            if (line === searchId) {
                isCapturing = true;
                continue; 
            }

            // Once capturing, grab everything until we hit the next chapter heading
            if (isCapturing) {
                if (isChapterHeading(line)) {
                    break; 
                }
                chapterText.push(line);
            }
        }

        if (chapterText.length === 0) {
            return NextResponse.json({ text: "Archive missing: No manuscript text found for this node." });
        }

        return NextResponse.json({ text: chapterText.join(' ') });

    } catch (error: any) {
        console.error("Manuscript API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}