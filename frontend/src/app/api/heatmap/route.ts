import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// 1. Declare the global cache variable outside the request handler
let cachedDatabase: Record<string, number[]> | null = null;

function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: Request) {
    try {
        const { theme } = await req.json();
        if (!theme) return NextResponse.json({ error: "No theme provided." }, { status: 400 });

        console.log(`\n=== Generating Semantic Heatmap for: "${theme}" ===`);

        const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        const result = await model.embedContent(theme);
        const queryVector = result.embedding.values;

        // 2. Read from disk ONLY if the cache is empty
        if (!cachedDatabase) {
            console.log("Loading 15MB database into memory for the first time...");
            const filePath = path.join(process.cwd(), 'public', 'semantic_embeddings.json');
            const fileData = fs.readFileSync(filePath, 'utf8');
            cachedDatabase = JSON.parse(fileData);
        } else {
            console.log("Serving database from high-speed RAM cache.");
        }

        // 3. Use the cached database
        const database = cachedDatabase!;

        const scores: Record<string, number> = {};
        let maxScore = -2;
        let sumScore = 0;
        let chapterCount = 0;

        // Iterate through chapter-level data (e.g., "Genesis 1")
        for (const [chapterId, vector] of Object.entries(database)) {
            const score = cosineSimilarity(queryVector, vector as number[]);
            scores[chapterId] = score;
            sumScore += score;
            chapterCount++;
            if (score > maxScore) maxScore = score;
        }

        // Calculate the Average and measure the Spike Magnitude
        const avgScore = sumScore / chapterCount;
        const spikeMagnitude = maxScore - avgScore;

        console.log(`Avg: ${avgScore.toFixed(3)}, Max: ${maxScore.toFixed(3)}, Spike: ${spikeMagnitude.toFixed(3)}`);

        const normalizedScores: Record<string, number> = {};

        // 1. The Gibberish Filter
        if (spikeMagnitude < 0.08) {
            console.log("-> No significant spike detected. Classifying as gibberish/noise.");
            for (const chapterId of Object.keys(scores)) {
                normalizedScores[chapterId] = 0;
            }
        } else {
            // 2. The Isolation Filter
            const threshold = avgScore + (spikeMagnitude * 0.35);
            console.log(`-> Valid spike detected. Illuminating scores above ${threshold.toFixed(3)}`);

            for (const [chapterId, score] of Object.entries(scores)) {
                if (score >= threshold) {
                    const normalized = (score - threshold) / (maxScore - threshold);
                    normalizedScores[chapterId] = Math.pow(normalized, 2);
                } else {
                    normalizedScores[chapterId] = 0;
                }
            }
        }

        return NextResponse.json({ scores: normalizedScores });

    } catch (error: any) {
        console.error("Heatmap Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}