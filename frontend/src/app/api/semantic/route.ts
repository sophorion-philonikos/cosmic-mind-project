import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// --- PURE MATHEMATICS: COSINE SIMILARITY ---
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export async function POST(req: Request) {
  try {
    const { chapterId } = await req.json();
    
    if (!chapterId) {
      return NextResponse.json({ error: "No chapter ID provided." }, { status: 400 });
    }

    console.log(`\n=== Scanning Deep Vector Space for: ${chapterId} ===`);

    // 1. Load the pre-calculated coordinates from the public folder
    const vectorDbPath = path.resolve(process.cwd(), 'public/semantic_embeddings.json');
    
    if (!fs.existsSync(vectorDbPath)) {
        throw new Error("Semantic Vector Database not found. Have you run generateEmbeddings.js?");
    }

    const vectorDatabase = JSON.parse(fs.readFileSync(vectorDbPath, 'utf8'));
    
    const targetVector = vectorDatabase[chapterId];
    if (!targetVector) {
        throw new Error(`Coordinate for ${chapterId} not found in vector space.`);
    }

    // 2. Run the math against all other chapters
    const scores: { id: string; score: number }[] = [];
    
    for (const [id, vector] of Object.entries(vectorDatabase)) {
        if (id === chapterId) continue; // Skip comparing the chapter to itself
        
        const score = calculateCosineSimilarity(targetVector, vector as number[]);
        scores.push({ id, score });
    }

    // 3. Sort by highest mathematical similarity and take the top 5
    scores.sort((a, b) => b.score - a.score);
    const topSiblings = scores.slice(0, 5);

    console.log(`Found Thematic Siblings for ${chapterId}:`, topSiblings.map(s => `${s.id} (${(s.score * 100).toFixed(1)}%)`));

    // 4. Format the Nodes for the Frontend Armor
    const nodes = topSiblings.map(match => {
      const parts = match.id.split(" ");
      const chapter = parts.pop();
      const book = parts.join(" ");
      
      return {
        book: book,
        chapter: parseInt(chapter as string, 10),
        id: match.id,
        isSemantic: true
      };
    });

    // 5. Format the Ghost Links
    const connections = topSiblings.map(match => ({
      source: chapterId,
      target: match.id,
      isSemantic: true,
      isDynamic: false
    }));

    return NextResponse.json({ nodes, connections });

  } catch (error: any) {
    console.error("Semantic Vector Scan Failed:", error);
    return NextResponse.json({ nodes: [], connections: [] }, { status: 500 });
  }
}