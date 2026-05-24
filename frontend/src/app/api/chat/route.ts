import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    console.log(`\n=== Asking The Cosmic Mind: ${query} ===`);

    // --- OFFLINE DIAGNOSTIC BYPASS ---
    if (query.trim().toLowerCase() === "run diagnostic test") {
      console.log("-> Offline Diagnostic Mode Triggered. Bypassing API.");
      
      const diagPayload = `This is a simulated offline diagnostic response from the Cosmic Mind archives. It bypasses the live API to allow UI testing of the 3D physics engine, deep manuscript audio telemetry, and the new Commentary Satellite system.\n\nNotice the neon green satellite orbiting Genesis 1. This represents our new wrapper capability to simulate multi-millennial scholarship dynamically.

===COSMIC_DATA===
{
  "citations": [
    {
      "book": "Daniel",
      "chapter": 2,
      "verses": "4",
      "languages": {
        "english_nrsvue": "Then the Chaldeans said to the king (in Aramaic), 'O king, live forever! Tell your servants the dream, and we will reveal the interpretation.'",
        "hebrew_masoretic": "וַיְדַבְּרוּ הַכַּשְׂדִּים לַמֶּלֶךְ אֲרָמִית: מַלְכָּא לְעָלְמִין חֱיִי! אֱמַר חֶלְמָא לְעַבְדָיךְ וּפִשְׁרָא נְחַוֵּא.",
        "aramaic": "מַלְכָּא לְעָלְמִין חֱיִי! אֱמַר חֶלְמָא לְעַבְדָיךְ, וּפִשְׁרָא נְחַוֵּא׃",
        "greek_manuscript": "καὶ ἐλάλησαν οἱ Χαλδαῖοι τῷ βασιλεῖ Συριστί· βασιλεῦ, εἰς τοὺς αἰῶνας ζῆθι· εἰπὸν τὸ ἐνύπνιον τοῖς παισί σου, καὶ τὴν σύγκρισιν ἀναγγελοῦμεν."
      }
    },
    {
      "book": "Genesis",
      "chapter": 1,
      "verses": "1-2",
      "languages": {
        "english_nrsvue": "In the beginning when God created the heavens and the earth, the earth was a formless void.",
        "hebrew_masoretic": "בְּרֵאשִׁית בָּרָא אֱלֹהִים, אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ׃",
        "aramaic": "null",
        "greek_manuscript": "Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν καὶ τὴν γῆν. ἡ δὲ γῆ ἦν ἀόρατος καὶ ἀκατασκεύαστος."
      }
    }
  ],
  "connections": [
    { "source": "Genesis 1", "target": "Daniel 2" }
  ],
  "commentaries": [
    {
      "id": "comm-philo-gen-1",
      "author": "Philo of Alexandria",
      "era": "Ancient (1st Century CE)",
      "targetNodeId": "Genesis 1",
      "excerpt": "The invisible and intelligible light has been made an image of the divine Word, which has explained its genesis. It is a super-celestial constellation, the source of the visible stars..."
    }
  ]
}`;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(diagPayload));
          controller.close();
        }
      });
      return new NextResponse(stream, { headers: { "Content-Type": "text/plain" } });
    }

    // --- STANDARD API LOGIC CONTINUES BELOW ---
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { 
            temperature: 0.3,
            maxOutputTokens: 8192,
        }
    });

    const prompt = `
      You are the "Cosmic Mind," an interactive spatial AI that guides users through a 3D star map of the biblical text and historical scholarship.

      Your goal is to answer the user's question with the rigorous depth of a world-class biblical scholar, historian, and exegete. 
      
      TONE INSTRUCTION (CRITICAL):
      Maintain a strictly academic, objective, and grounded tone. DO NOT use theatrical greetings, roleplay phrasing (e.g., "Greetings, Seeker"), or personally address the user. Present the information as a direct, high-level scholarly brief.

      CORE SCHOLARLY INSTRUCTIONS:
      1. Go beyond surface-level readings. Analyze authorial intent, Ancient Near Eastern (ANE) cultural context, Second Temple Judaism, and linguistic nuances.
      2. Synthesize modern scholarly consensus and historical-critical methods. Explain *why* a text was written that way for its original audience.
      3. INTEGRATE HISTORICAL COMMENTARY: Whenever relevant, mention how classical/ancient/medieval scholars interpreted these texts.
      4. AVOID RECITATION BLOCKS (CRITICAL): You must PARAPHRASE and SYNTHESIZE all historical commentary. DO NOT quote large blocks of text verbatim from existing historical sources, as this will trigger recitation filters. Explain the scholars' views in your own words.
      
      UI INTEGRATION INSTRUCTIONS (BREAK THE FOURTH WALL):
      1. You are aware that the user is looking at a 3D star map.
      2. In the final paragraph of your text answer, you MUST explicitly guide the user's eyes to the map. 
      3. Reference the specific "clusters" or "constellations" and "commentary satellites" you are generating.
      
      CRITICAL OUTPUT FORMATTING REQUIREMENTS:
      You MUST return your response in two distinct phases. First, write your multi-paragraph scholarly answer in plain natural text. 
      Then, you MUST append the exact string "===COSMIC_DATA===" on a new line, followed by a pure JSON block containing the map coordinates.
      
      Example structure you MUST strictly follow:

      [Your brilliant scholarly text goes here. Multi-paragraph. Natural language.]

      ===COSMIC_DATA===
      \`\`\`json
      {
         "citations": [
            {
               "book": "BookName",
               "chapter": 1,
               "verses": "1-5",
               "languages": {
                  "english_nrsvue": "English text...",
                  "hebrew_masoretic": "Hebrew text or null",
                  "aramaic": "Aramaic text or null",
                  "greek_manuscript": "Greek text or null"
               }
            }
         ],
         "connections": [
            { "source": "BookName 1", "target": "BookName 2" }
         ],
         "commentaries": [
            {
               "id": "comm-authorname-book-chapter",
               "author": "Historical Author",
               "era": "Time Period",
               "targetNodeId": "BookName Chapter",
               "excerpt": "A short 1-2 sentence relevant paraphrase."
            }
         ]
      }
      \`\`\`

      DATA INTEGRITY RULES (CRITICAL):
      1. "targetNodeId" in your commentaries array MUST perfectly match a "BookName Chapter" explicitly listed in your citations array.
      2. "source" and "target" in your connections array MUST perfectly match "BookName Chapter" values explicitly listed in your citations array. Do not draw lines to un-cited chapters.

      User Question: ${query}
    `;

    let attempt = 0;
    const maxRetries = 3;
    let result;

    while (attempt < maxRetries) {
      try {
        result = await model.generateContentStream(prompt);
        break; 
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) {
            throw new Error("Google API is currently overwhelmed. Please try again.");
        }
        await delay(2000 * attempt); 
      }
    }

    if (!result) throw new Error("Stream initialization failed.");

    // Create a native Web Stream to send chunks directly to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            try {
                const chunkText = chunk.text();
                controller.enqueue(new TextEncoder().encode(chunkText));
            } catch (chunkErr: any) {
                // If a recitation block occurs inside the stream loop, chunk.text() will throw.
                console.error("Chunk decoding failed (Possible RECITATION block):", chunkErr.message);
                throw chunkErr; // Pass to the outer catch block for graceful fallback
            }
          }
          controller.close();
        } catch (e: any) {
          console.error("Streaming error caught mid-transmission:", e.message);
          
          // Graceful degradation: If the stream severs, append an explanation to the chat 
          // and send an empty data object so the UI doesn't crash waiting for JSON.
          const fallbackData = `\n\n[System Alert: The transmission was restricted by safety filters due to verbatim historical text recitation. The map data could not be fully plotted. Please ask for a synthesized summary.]\n\n===COSMIC_DATA===\n{\n  "citations": [],\n  "connections": [],\n  "commentaries": []\n}`;
          controller.enqueue(new TextEncoder().encode(fallbackData));
          controller.close();
        }
      }
    });

    return new NextResponse(stream, { headers: { "Content-Type": "text/plain" } });

  } catch (error: any) {
    const errPayload = `Error: The Cosmic Mind encountered a disturbance. ${error.message}`;
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(errPayload));
            controller.close();
        }
    });
    return new NextResponse(stream, { headers: { "Content-Type": "text/plain" }, status: 500 });
  }
}