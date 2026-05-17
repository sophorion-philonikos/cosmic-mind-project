import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    console.log(`\n=== Asking The Cosmic Mind: ${query} ===`);

    // --- NEW: OFFLINE DIAGNOSTIC BYPASS ---
    // If the user types this exact phrase, skip the API and return rich test data instantly.
    if (query.trim().toLowerCase() === "run diagnostic test") {
      console.log("-> Offline Diagnostic Mode Triggered. Bypassing API.");
      return NextResponse.json({
        answer: "This is a simulated offline diagnostic response from the Cosmic Mind archives. It bypasses the live API to allow UI testing of the 3D physics engine and the deep manuscript audio telemetry.\n\nAs you look at the illuminated clusters on your star map, notice how this test highlights the specific capabilities of the newly upgraded manuscript viewer, connecting the ancient languages of Genesis and Daniel into a single constellation.",
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
        ]
      });
    }

    // --- STANDARD API LOGIC CONTINUES BELOW ---
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { 
            temperature: 0.3,
            maxOutputTokens: 8192, // PREVENTS INFINITE LOOPS: Hard caps the generation so it never runs for 4 minutes
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
                        description: "Extract citations if you mention texts.",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                book: { type: SchemaType.STRING },
                                chapter: { type: SchemaType.NUMBER },
                                verses: { type: SchemaType.STRING },
                                languages: {
                                    type: SchemaType.OBJECT,
                                    description: "Provide the excerpt in the available ancient manuscript languages alongside the English.",
                                    properties: {
                                        english_nrsvue: { type: SchemaType.STRING, description: "The NRSVue translation" },
                                        hebrew_masoretic: { type: SchemaType.STRING, description: "The original Hebrew (MT), if applicable to the book." },
                                        aramaic: { type: SchemaType.STRING, description: "The original Aramaic, if applicable to the book/chapter (e.g., portions of Daniel, Ezra)." },
                                        greek_manuscript: { type: SchemaType.STRING, description: "The Greek Septuagint (LXX) for the OT, or the Koine Greek text for the NT." }
                                    },
                                    required: ["english_nrsvue"]
                                }
                            },
                            required: ["book", "chapter", "verses", "languages"]
                        }
                    },
                    connections: {
                        type: SchemaType.ARRAY,
                        description: "Structural links between the specific cited chapters.",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                source: { type: SchemaType.STRING, description: "MUST be formatted as 'Book Chapter' (e.g., 'Genesis 1' or 'John 3')" },
                                target: { type: SchemaType.STRING, description: "MUST be formatted as 'Book Chapter' (e.g., 'Genesis 1' or 'John 3')" }
                            },
                            required: ["source", "target"]
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
      3. MACRO-QUESTIONS: If the user asks a sweeping question, select 3 to 9 representative "anchor" chapters that perfectly contrast or complement each other to prove your academic point, and extract verses from those specific anchors.
      
      UI INTEGRATION INSTRUCTIONS (BREAK THE FOURTH WALL):
      1. You are aware that the user is looking at a 3D star map where EVERY SINGLE CHAPTER of the Bible is represented as a distinct star.
      2. In the final paragraph of your answer, you MUST explicitly guide the user's eyes to the map. 
      3. Reference the specific "clusters" or "constellations" of chapters you are drawing from. Explain *why* these specific stars are connected to form a constellation of meaning for this answer.
      
      DATA OUTPUT REQUIREMENTS:
      - "answer": Your beautifully written, multi-paragraph scholarly response. Base all textual analysis and doctrinal reasoning strictly on the nuances of the ancient texts.
      - "citations": Use exactly the standard 66 canonical book names. If you mention a text anywhere in your answer, it MUST be included here. Extract the specific verse in all relevant ancient languages (Hebrew, Aramaic, Greek) and the English NRSVue translation.
      - "connections": CRITICAL RULE - Every single chapter listed in your "citations" array MUST appear at least once in your "connections" array. Do not leave any cited chapter orphaned! Your "source" and "target" MUST strictly match the format "Book Chapter" (e.g., "Isaiah 53", "Mark 1", "Genesis 14").
      
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
      // Clean any accidental markdown code blocks the AI might inject
      let cleanText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      if (!cleanText) throw new Error("Received empty response from the model.");

      parsedData = JSON.parse(cleanText);
      
      // STRUCTURAL ARMOR: Make sure it actually built the object we need
      if (typeof parsedData !== 'object' || !parsedData.answer) {
         throw new Error("Model returned invalid JSON structure.");
      }

    } catch (error) {
      console.error("JSON Parsing Failure. Response was corrupted or truncated by limits.");
      
      // STOPS THE BLEED: We return a clean, safe UI message instead of crashing the frontend
      parsedData = { 
        answer: "The archives produced an exceptionally large textual analysis that was corrupted during transmission. Please try narrowing the scope of your query.", 
        citations: [], 
        connections: [] 
      };
    }
    
    return NextResponse.json({ 
      answer: parsedData.answer,
      nodes: parsedData.citations || [],
      connections: parsedData.connections || []
    });

  } catch (error: any) {
    return NextResponse.json({ answer: `Error: ${error.message}`, nodes: [], connections: [] }, { status: 500 });
  }
}