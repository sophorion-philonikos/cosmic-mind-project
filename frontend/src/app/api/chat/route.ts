import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    console.log(`\n=== Asking The Cosmic Mind: ${query} ===`);

    // --- NEW: OFFLINE DIAGNOSTIC BYPASS ---
    if (query.trim().toLowerCase() === "run diagnostic test") {
      console.log("-> Offline Diagnostic Mode Triggered. Bypassing API.");
      return NextResponse.json({
        answer: "This is a simulated offline diagnostic response from the Cosmic Mind archives. It bypasses the live API to allow UI testing of the 3D physics engine, deep manuscript audio telemetry, and the new Commentary Satellite system.\n\nNotice the neon green satellite orbiting Genesis 1. This represents our new wrapper capability to simulate multi-millennial scholarship dynamically.",
        nodes: [
          {
            book: "Daniel",
            chapter: 2,
            verses: "4",
            languages: {
              english_nrsvue: "Then the Chaldeans said to the king (in Aramaic), 'O king, live forever! Tell your servants the dream, and we will reveal the interpretation.'",
              hebrew_masoretic: "וַיְדַבְּרוּ הַכַּשְׂדִּים לַמֶּלֶךְ אֲרָמִית: מַלְכָּא לְעָלְמִין חֱיִי! אֱמַר חֶלְמָא לְעַבְדָיךְ וּפִשְׁרָא נְחַוֵּא.",
              aramaic: "מַלְכָּא לְעָלְמִין חֱיִי! אֱמַר חֶלְמָא לְעַבְדָיךְ, וּפִשְׁרָא נְחַוֵּא׃",
              greek_manuscript: "καὶ ἐλάλησαν οἱ Χαλδαῖοι τῷ βασιλεῖ Συριστί· βασιλεῦ, εἰς τοὺς αἰῶνας ζῆθι· εἰπὸν τὸ ἐνύπνιον τοῖς παισί σου, καὶ τὴν σύγκρισιν ἀναγγελοῦμεν."
            }
          },
          {
            book: "Genesis",
            chapter: 1,
            verses: "1-2",
            languages: {
              english_nrsvue: "In the beginning when God created the heavens and the earth, the earth was a formless void.",
              hebrew_masoretic: "בְּרֵאשִׁית בָּרָא אֱלֹהִים, אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ׃",
              aramaic: "null",
              greek_manuscript: "Ἐν ἀρχῇ ἐποίησεν ὁ θεὸς τὸν οὐρανὸν καὶ τὴν γῆν. ἡ δὲ γῆ ἦν ἀόρατος καὶ ἀκατασκεύαστος."
            }
          }
        ],
        connections: [
          { source: "Genesis 1", target: "Daniel 2" }
        ],
        commentaries: [
          {
            id: "comm-philo-gen-1",
            author: "Philo of Alexandria",
            era: "Ancient (1st Century CE)",
            targetNodeId: "Genesis 1",
            excerpt: "The invisible and intelligible light has been made an image of the divine Word, which has explained its genesis. It is a super-celestial constellation, the source of the visible stars..."
          }
        ]
      });
    }

    // --- STANDARD API LOGIC CONTINUES BELOW ---
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { 
            temperature: 0.3,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    answer: { 
                        type: SchemaType.STRING,
                        description: "The multi-paragraph scholarly response."
                    },
                    citations: {
                        type: SchemaType.ARRAY,
                        description: "Extract citations if you mention primary biblical texts.",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                book: { type: SchemaType.STRING },
                                chapter: { type: SchemaType.NUMBER },
                                verses: { type: SchemaType.STRING },
                                languages: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        english_nrsvue: { type: SchemaType.STRING, description: "The NRSVue translation" },
                                        hebrew_masoretic: { type: SchemaType.STRING },
                                        aramaic: { type: SchemaType.STRING },
                                        greek_manuscript: { type: SchemaType.STRING }
                                    },
                                    required: ["english_nrsvue"]
                                }
                            },
                            required: ["book", "chapter", "verses", "languages"]
                        }
                    },
                    connections: {
                        type: SchemaType.ARRAY,
                        description: "Structural links between the specific cited primary chapters.",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                source: { type: SchemaType.STRING, description: "MUST be 'Book Chapter'" },
                                target: { type: SchemaType.STRING, description: "MUST be 'Book Chapter'" }
                            },
                            required: ["source", "target"]
                        }
                    },
                    commentaries: {
                        type: SchemaType.ARRAY,
                        description: "If your answer draws upon specific historical scholars or ancient commentators (e.g., Philo, Rashi, Church Fathers), create satellite nodes for them.",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.STRING, description: "Create a unique ID, e.g., 'comm-philo-gen-1'" },
                                author: { type: SchemaType.STRING, description: "The historical author/text (e.g., 'Maimonides', 'Dead Sea Scrolls')" },
                                era: { type: SchemaType.STRING, description: "The historical period (e.g., 'Medieval', '2nd Century BCE')" },
                                targetNodeId: { type: SchemaType.STRING, description: "The primary 'Book Chapter' this orbits (e.g., 'Genesis 1')" },
                                excerpt: { type: SchemaType.STRING, description: "A highly relevant 1-2 sentence excerpt summarizing their view." }
                            },
                            required: ["id", "author", "era", "targetNodeId", "excerpt"]
                        }
                    }
                },
                required: ["answer", "citations", "connections"]
            }
        }
    });

    const prompt = `
      You are the "Cosmic Mind," an interactive spatial AI that guides users through a 3D star map of the biblical text and historical scholarship.

      Your goal is to answer the user's question with the rigorous depth of a world-class biblical scholar, historian, and exegete. 
      
      CORE SCHOLARLY INSTRUCTIONS:
      1. Go beyond surface-level readings. Analyze authorial intent, Ancient Near Eastern (ANE) cultural context, Second Temple Judaism, and linguistic nuances (Hebrew/Aramaic/Greek).
      2. Synthesize modern scholarly consensus and historical-critical methods. Do not just quote the text; explain *why* it was written that way for its original audience.
      3. INTEGRATE HISTORICAL COMMENTARY: Whenever relevant, mention how classical/ancient/medieval scholars interpreted these texts. When you do, populate the "commentaries" array to generate satellite stars for them.
      
      UI INTEGRATION INSTRUCTIONS (BREAK THE FOURTH WALL):
      1. You are aware that the user is looking at a 3D star map.
      2. In the final paragraph of your answer, you MUST explicitly guide the user's eyes to the map. 
      3. Reference the specific "clusters" or "constellations" and "commentary satellites" you are generating.
      
      DATA OUTPUT REQUIREMENTS:
      - "answer": Your beautifully written scholarly response.
      - "citations": Use exactly the standard 66 canonical book names.
      - "connections": CRITICAL RULE - Every single chapter listed in your "citations" array MUST appear at least once here.
      - "commentaries": Generate nodes for historical commentators to orbit the primary stars.
      
      User Question: ${query}
    `;

    let attempt = 0;
    const maxRetries = 3;
    let responseText = "";

    while (attempt < maxRetries) {
      try {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        break; 
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) throw new Error("Google API is currently overwhelmed.");
        await delay(2000 * attempt); 
      }
    }

    let parsedData;
    try {
      let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      if (!cleanText) throw new Error("Received empty response from the model.");
      parsedData = JSON.parse(cleanText);
      if (typeof parsedData !== 'object' || !parsedData.answer) {
         throw new Error("Model returned invalid JSON structure.");
      }
    } catch (error) {
      console.error("JSON Parsing Failure.");
      parsedData = { 
        answer: "The archives produced an exceptionally large textual analysis that was corrupted during transmission. Please try narrowing the scope of your query.", 
        citations: [], 
        connections: [],
        commentaries: []
      };
    }
    
    return NextResponse.json({ 
      answer: parsedData.answer,
      nodes: parsedData.citations || [],
      connections: parsedData.connections || [],
      commentaries: parsedData.commentaries || []
    });

  } catch (error: any) {
    return NextResponse.json({ answer: `Error: ${error.message}`, nodes: [], connections: [], commentaries: [] }, { status: 500 });
  }
}