const fs = require('fs');
const path = require('path');

// Pointing to the raw file you just generated
const inputPath = path.join(__dirname, '../public/nrsvue_manuscript.txt');
// The clean file that generateEmbeddings.js is waiting for
const outputPath = path.join(__dirname, '../public/manuscript.txt');

console.log("🧹 Igniting Advanced Text Purification Protocol...");

const rawText = fs.readFileSync(inputPath, 'utf8');
const lines = rawText.split('\n');

const cleanLines = [];
let hasReachedGenesis = false;
let hasReachedTheEnd = false;

for (let i = 0; i < lines.length; i++) {
    // If we've hit the end of Revelation, ignore everything else (the Index/Glossary)
    if (hasReachedTheEnd) break;

    let line = lines[i].trim();

    // 1. Skip the massive Intro and Table of Contents pages
    if (!hasReachedGenesis) {
        if (line.includes("SIX DAYS OF CREATION")) {
            hasReachedGenesis = true;
            cleanLines.push("Genesis 1");
        }
        continue;
    }

    // 2. The Hard Stop (End of the biblical text)
    // This catches the end of Revelation 22 to block the Glossary from corrupting the DB
    if (line.includes("The grace of the Lord Jesus be with all the saints. Amen")) {
        cleanLines.push("21 The grace of the Lord Jesus be with all the saints. Amen.");
        hasReachedTheEnd = true;
        break;
    }

    // 3. Eradicate Table of Contents formatting
    if (line.includes("|") && /\d+\s*\|\s*\d+/.test(line)) continue;

    // 4. Eradicate Footnote and Cross-reference blocks
    if (/^[\*a-zA-Z]\s+\d+\.\d+/.test(line)) continue;
    if (/^\d+\.\d+;/.test(line)) continue;

    // 5. Eradicate overarching book headers
    if (line === "The Old Testament" || line === "The New Testament" || line === "The Apocryphal/Deuterocanonical Books") continue;

    // 6. Clean the actual text of PDF artifacts
    line = line.replace(/\x0C/g, ''); // Erase invisible PDF Page Breaks
    line = line.replace(/\*/g, '');   // Erase inline footnote asterisks
    
    // NEW: Eradicate parasitic footnote letters attached to punctuation (e.g., "Amen.r" -> "Amen.")
    line = line.replace(/([.,;:?!])[a-zA-Z]\b/g, '$1'); 

    // Only push if the line isn't empty
    if (line.length > 0) {
        cleanLines.push(line);
    }
}

fs.writeFileSync(outputPath, cleanLines.join('\n'));
console.log(`✅ Purification complete! Pristine text saved to: ${outputPath}`);