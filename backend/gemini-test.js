import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ Aucune clé API trouvée. Vérifie ton fichier .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testGemini() {
  try {
    // Utilise "gemini-pro" simple pour AI Studio
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


    const result = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64
        }
      }
    ]
  }]
});

    const response = await result.response;
    const text = response.text();

    console.log("✅ Réponse Gemini :\n", text);
  } catch (error) {
    console.error("❌ Erreur Gemini :", error);
  }
}

testGemini();
