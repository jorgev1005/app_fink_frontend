import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Falta texto para procesar' }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === '') {
      return NextResponse.json({ 
        error: 'Falta la API Key de OpenRouter. Por favor, añádela como OPENROUTER_API_KEY en tu archivo frontend/.env' 
      }, { status: 500 });
    }

    const prompt = `
Eres un asistente financiero de la aplicación Fink. Tu tarea es extraer información financiera del texto dictado por el usuario y convertirla a un formato JSON exacto y válido.
El usuario puede haber dictado con errores, corrige e interpreta la intención.
No devuelvas NADA MÁS que el JSON crudo (sin formato markdown de código, sin las comillas \`\`\`json, sin explicaciones).

Reglas:
- monto: número entero. Si dicen "quince lucas" son 15000. Si dicen "800 bolívares" son 800.
- concepto: string breve.
- categoria: string, infiere la categoría adecuada.
- cuenta_origen: string, infiere (Efectivo, Tarjeta, Nequi, Banco, etc). Por defecto "Efectivo".
- tipo: estrictamente "gasto" o "ingreso".

Texto dictado: "${text}"

Estructura requerida:
{
  "monto": numero,
  "concepto": "string",
  "categoria": "string",
  "cuenta_origen": "string",
  "tipo": "string"
}
`;

    // Llamada directa a OpenRouter usando fetch nativo (sin necesidad de librerías extra)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini", // GPT-4o-mini es extremadamente rápido, capaz de extraer JSON perfecto y muy económico en OpenRouter
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error OpenRouter:", data);
      throw new Error(data.error?.message || "Error al contactar OpenRouter");
    }

    let rawText = data.choices[0].message.content;
    
    // Limpiar markdown residual si la IA lo agrega
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    const extractedData = JSON.parse(rawText);

    return NextResponse.json({
      status: "Éxito (OpenRouter)",
      originalText: text,
      extracted: extractedData
    });

  } catch (error: any) {
    console.error("============= ERROR EN OPENROUTER =============");
    console.error(error);
    console.error("===============================================");
    return NextResponse.json({ 
      error: error.message || "Error desconocido al contactar a la IA", 
      details: error.toString() 
    }, { status: 500 });
  }
}
