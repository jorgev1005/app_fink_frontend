import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://fink.grupoaludra.com',
    'X-Title': 'Fink App'
  }
});

async function run() {
  try {
    const response = await openai.chat.completions.create({
      model: 'minimax/minimax-m2.5:free',
      messages: [{ role: 'user', content: 'hola' }],
    });
    console.log('Success:', response.choices[0].message.content);
  } catch(e: any) {
    console.error('Error in request:', e.message);
    if (e.message.includes('404')) {
        console.log('Fallback triggered...');
        const r2 = await openai.chat.completions.create({
            model: 'nvidia/nemotron-nano-12b-v2-vl:free',
            messages: [{ role: 'user', content: 'hola' }],
          });
        console.log('Fallback response:', r2.choices[0].message.content);
    }
  }
}

run();
