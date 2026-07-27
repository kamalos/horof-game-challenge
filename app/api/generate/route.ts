import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 });
    }

    const { letter, category, language } = await req.json();

    if (!letter || !category) {
      return NextResponse.json({ error: 'Missing letter or category' }, { status: 400 });
    }

    const prompt = `Generate an engaging trivia question for the category/domain '${category}'.
IMPORTANT REQUIREMENTS:
1. The language of BOTH the question and the exact correct answer MUST ALWAYS BE IN ARABIC (اللغة العربية), regardless of any other language settings.
2. The exact correct answer MUST start with the letter '${letter}'.
   (If '${letter}' is an Arabic letter like 'ا' or 'ب', the answer must begin with that exact Arabic letter. If '${letter}' is a Latin letter like 'A' or 'B', the answer must still be written in Arabic and begin with the corresponding Arabic letter equivalent or transliteration starting with that letter sound).
3. Provide the response in JSON format matching the schema.`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The trivia question written in clear Arabic."
            },
            answer: {
              type: "string",
              description: `The exact correct answer written in Arabic. It MUST start with the letter '${letter}'.`
            }
          },
          required: ["question", "answer"]
        }
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return NextResponse.json({ error: 'Failed to generate content from AI' }, { status: 500 });
    }

    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) {
       return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const result = JSON.parse(jsonText);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error generating question:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
