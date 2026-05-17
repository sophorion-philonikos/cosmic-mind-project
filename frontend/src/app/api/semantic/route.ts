import { NextResponse } from 'next/server';

// --- MOCKED VECTOR DATABASE ---
// In a production RAG environment, this would be a call to Pinecone or a pgvector database.
// For this pristine architecture, we simulate the Cosine Similarity returns to test the UI physics safely.
const MOCK_VECTOR_DB: Record<string, string[]> = {
  "Ezekiel 1": ["Genesis 1", "Psalms 104", "Isaiah 6", "Revelation 4"],
  "Genesis 1": ["Ezekiel 1", "Psalms 8", "Psalms 104", "John 1"],
  "Psalms 104": ["Genesis 1", "Ezekiel 1", "Job 38", "Proverbs 8"],
  "Isaiah 6": ["Ezekiel 1", "Revelation 4", "Exodus 33", "1 Kings 22"],
  // Default fallback for any other chapter clicked
  "default": ["Psalms 119", "Proverbs 1", "Ecclesiastes 3"] 
};

// Simulated delay to mimic heavy Vector Math / Cosine Similarity processing
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const { chapterId } = await req.json();
    
    if (!chapterId) {
      return NextResponse.json({ error: "No chapter ID provided." }, { status: 400 });
    }

    console.log(`\n=== Scanning Vector Space for Thematic Siblings: ${chapterId} ===`);

    // 1. Simulate the time it takes to run Cosine Similarity across 1,189 chapters
    await delay(600); 

    // 2. Retrieve the thematic matches (In production, this is where the math happens)
    const matches = MOCK_VECTOR_DB[chapterId] || MOCK_VECTOR_DB["default"];

    // 3. Format the Nodes 
    // We send back the minimal data required for a node. 
    // The frontend deduplication armor will decide whether to actually render these or not.
    const nodes = matches.map(match => {
      const [book, ...chapterParts] = match.split(" ");
      return {
        book: book,
        chapter: parseInt(chapterParts.join(" "), 10),
        id: match,
        isSemantic: true // Flag to tell the frontend these are "Ghost Nodes"
      };
    });

    // 4. Format the Ghost Links
    // We explicitly flag these as semantic so the frontend sets their gravitational strength to 0.
    const connections = matches.map(match => ({
      source: chapterId,
      target: match,
      isSemantic: true, // Crucial: Tells the physics engine NOT to pull these stars together
      isDynamic: false
    }));

    return NextResponse.json({ 
      nodes, 
      connections 
    });

  } catch (error: any) {
    console.error("Semantic Vector Scan Failed:", error);
    return NextResponse.json({ nodes: [], connections: [] }, { status: 500 });
  }
}