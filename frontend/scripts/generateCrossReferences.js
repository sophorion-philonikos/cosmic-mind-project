const fs = require('fs');
const path = require('path');

const bookMapping = {
  "Gen": "Genesis", "Exod": "Exodus", "Lev": "Leviticus", "Num": "Numbers", "Deut": "Deuteronomy", "Josh": "Joshua", "Judg": "Judges", "Ruth": "Ruth", "1Sam": "1 Samuel", "2Sam": "2 Samuel", "1Kgs": "1 Kings", "2Kgs": "2 Kings", "1Chr": "1 Chronicles", "2Chr": "2 Chronicles", "Ezra": "Ezra", "Neh": "Nehemiah", "Esth": "Esther", "Job": "Job", "Ps": "Psalms", "Prov": "Proverbs", "Eccl": "Ecclesiastes", "Song": "Song of Solomon", "Isa": "Isaiah", "Jer": "Jeremiah", "Lam": "Lamentations", "Ezek": "Ezekiel", "Dan": "Daniel", "Hos": "Hosea", "Joel": "Joel", "Amos": "Amos", "Obad": "Obadiah", "Jonah": "Jonah", "Mic": "Micah", "Nah": "Nahum", "Hab": "Habakkuk", "Zeph": "Zephaniah", "Hag": "Haggai", "Zech": "Zechariah", "Mal": "Malachi",
  "Matt": "Matthew", "Mark": "Mark", "Luke": "Luke", "John": "John", "Acts": "Acts", "Rom": "Romans", "1Cor": "1 Corinthians", "2Cor": "2 Corinthians", "Gal": "Galatians", "Eph": "Ephesians", "Phil": "Philippians", "Col": "Colossians", "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians", "1Tim": "1 Timothy", "2Tim": "2 Timothy", "Titus": "Titus", "Phlm": "Philemon", "Heb": "Hebrews", "Jas": "James", "1Pet": "1 Peter", "2Pet": "2 Peter", "1John": "1 John", "2John": "2 John", "3John": "3 John", "Jude": "Jude", "Rev": "Revelation"
};

const bookOrder = Object.values(bookMapping);

const inputPath = path.join(__dirname, 'cross_references.txt');
const outputPath = path.join(__dirname, '../public/cross_references.json');

console.log("Initiating OpenBible Data Pipeline...");

if (!fs.existsSync(inputPath)) {
    console.error("❌ ERROR: Could not find 'cross_references.txt' in the scripts folder.");
    console.error("Please ensure you downloaded the raw text file and placed it at: " + inputPath);
    process.exit(1);
}

console.log("Reading raw dataset into memory...");
const data = fs.readFileSync(inputPath, 'utf8');
const lines = data.split('\n');
const crossRefs = {};

console.log(`Scanning ${lines.length} total lines of cross-references...`);

let totalKept = 0;

lines.forEach(line => {
  if (!line || line.startsWith('From Verse')) return;

  const parts = line.split('\t');
  if (parts.length < 3) return;

  const sourceRaw = parts[0]; 
  const targetRaw = parts[1]; 
  const votes = parseInt(parts[2], 10);

  // THE SCHOLARLY FILTER: Condensing 340k down to the "Gold Standard"
  // Filtering for votes >= 15 yields approximately 18,000 to 20,000 pristine links.
  if (votes < 15) return;

  const sourceParts = sourceRaw.split('.');
  const targetParts = targetRaw.split('.');

  const sourceBook = bookMapping[sourceParts[0]];
  const targetBook = bookMapping[targetParts[0]];

  if (!sourceBook || !targetBook) return;

  const sourceChapter = `${sourceBook} ${sourceParts[1]}`;
  const targetChapter = `${targetBook} ${targetParts[1]}`;

  if (sourceChapter === targetChapter) return;

  const sourceIdx = bookOrder.indexOf(sourceBook);
  const targetIdx = bookOrder.indexOf(targetBook);

  let newerChapter = sourceChapter;
  let olderChapter = targetChapter;

  // Ensure lines always flow backward in time
  if (sourceIdx < targetIdx) {
      newerChapter = targetChapter;
      olderChapter = sourceChapter;
  } else if (sourceIdx === targetIdx) {
      if (parseInt(sourceParts[1]) < parseInt(targetParts[1])) {
          newerChapter = targetChapter;
          olderChapter = sourceChapter;
      } else {
          newerChapter = sourceChapter;
          olderChapter = targetChapter;
      }
  }

  if (!crossRefs[newerChapter]) crossRefs[newerChapter] = new Set();
  crossRefs[newerChapter].add(olderChapter);
  totalKept++;
});

const finalJson = {};
let uniqueChaptersMapped = 0;

for (const [key, set] of Object.entries(crossRefs)) {
    finalJson[key] = Array.from(set);
    uniqueChaptersMapped++;
}

fs.writeFileSync(outputPath, JSON.stringify(finalJson, null, 2));

console.log(`✅ Success! Pipeline complete.`);
console.log(`✅ Filtered 340,000+ raw links down to ${totalKept} highly corroborated connections.`);
console.log(`✅ Mapped across ${uniqueChaptersMapped} unique chapters.`);
console.log(`✅ Database safely locked in at: ${outputPath}`);