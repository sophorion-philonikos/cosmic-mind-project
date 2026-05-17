const fs = require('fs');
const path = require('path');

const bibleData = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34, "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24, "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36, "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150, "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8, "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12, "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7, "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28, "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6, "Ephesians": 6, "Philippians": 4, "Colossians": 4, "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4, "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5, "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1, "Jude": 1, "Revelation": 22
};

const nodes = [];
const links = [];
let previousNodeId = null;

Object.entries(bibleData).forEach(([book, chapterCount]) => {
  for (let i = 1; i <= chapterCount; i++) {
    const id = `${book} ${i}`;
    nodes.push({ id, book, chapter: i });

    // Link sequentially to form one massive, continuous canonical spine
    if (previousNodeId) {
      links.push({
        source: previousNodeId,
        target: id,
        isDynamic: false
      });
    }
    
    // Set current node as the previous node for the next loop iteration
    previousNodeId = id;
  }
});

const outputPath = path.join(__dirname, '../public/galaxy.json');
fs.writeFileSync(outputPath, JSON.stringify({ nodes, links }, null, 2));

console.log(`Successfully ignited ${nodes.length} stars and ${links.length} gravitational links!`);
console.log(`Galaxy saved to ${outputPath}`);