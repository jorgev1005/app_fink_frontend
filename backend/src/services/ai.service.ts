import OpenAI from 'openai';
import prisma from '../config/database';

/**
 * Servicio de Inteligencia Artificial
 * Usa OpenAI para análisis predictivo y generación de insights
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

/**
 * Analizar un documento con OCR (extracción de datos)
 */
export const analyzeDocumentWithAI = async (
  documentText: string,
  documentType: string
): Promise<any> => {
  try {
    const prompt = `
      Analiza el siguiente documento de tipo "${documentType}" y extrae la información estructurada:
      
      ${documentText}
      
      Extrae y devuelve un JSON con los siguientes campos (si están disponibles):
      - número de documento
      - fecha de emisión
      - fecha de vencimiento
      - monto total
      - moneda
      - nombre del emisor/receptor
      - conceptos o items
      - cualquier otra información relevante
      
      Responde SOLO con el JSON, sin texto adicional.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Eres un asistente experto en análisis de documentos financieros.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error analyzing document with AI:', error);
    return null;
  }
};

/**
 * Categorizar automáticamente una transacción
 */
export const categorizeTransaction = async (
  description: string,
  amount: number
): Promise<{ category: string; subcategory: string; confidence: number }> => {
  try {
    const prompt = `
      Analiza esta transacción y categorízala:
      Descripción: ${description}
      Monto: ${amount}
      
      Devuelve un JSON con:
      {
        "category": "categoría principal",
        "subcategory": "subcategoría",
        "confidence": 0.0-1.0
      }
      
      Categorías posibles: Ventas, Servicios, Gastos Operativos, Gastos Administrativos, Nómina, Impuestos, Compras, Inversiones, Otros
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Eres un experto contador que categoriza transacciones.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error categorizing transaction:', error);
    return { category: 'Otros', subcategory: 'Sin categorizar', confidence: 0 };
  }
};

/**
 * Generar insights y predicciones
 */
export const generateAIInsights = async (): Promise<void> => {
  try {
    // Obtener proyectos activos
    const projects = await prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: {
        transactions: {
          where: {
            date: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Últimos 90 días
            }
          }
        },
        documents: {
          where: { status: 'PENDING' }
        }
      }
    });

    for (const project of projects) {
      // Analizar patrones de gasto
      const expenses = project.transactions.filter(t => t.type === 'EXPENSE');
      const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amountUsd), 0);

      if (expenses.length > 0) {
        const avgExpense = totalExpenses / expenses.length;
        const lastMonthExpenses = expenses.filter(
          t => t.date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );
        const lastMonthTotal = lastMonthExpenses.reduce((sum, t) => sum + Number(t.amountUsd), 0);

        // Predicción de gastos del próximo mes
        const prompt = `
          Analiza estos datos financieros del proyecto "${project.name}":
          - Gasto promedio por transacción: $${avgExpense.toFixed(2)}
          - Total de gastos últimos 30 días: $${lastMonthTotal.toFixed(2)}
          - Número de transacciones: ${lastMonthExpenses.length}
          
          Genera un insight breve (máximo 150 caracteres) sobre el patrón de gastos y una recomendación.
        `;

        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'Eres un asesor financiero experto.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 100
        });

        const insight = response.choices[0]?.message?.content || '';

        // Guardar insight
        await prisma.aIInsight.create({
          data: {
            type: 'spending_pattern',
            title: 'Análisis de Gastos',
            description: insight,
            data: JSON.stringify({
              avgExpense,
              lastMonthTotal,
              transactionCount: lastMonthExpenses.length
            }),
            confidence: 0.8,
            projectId: project.id,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });
      }

      // Alertas de documentos por vencer
      const dueSoonDocs = project.documents.filter(doc => {
        if (!doc.dueDate) return false;
        const daysUntilDue = Math.floor(
          (doc.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return daysUntilDue > 0 && daysUntilDue <= 7;
      });

      if (dueSoonDocs.length > 0) {
        await prisma.aIInsight.create({
          data: {
            type: 'document_due',
            title: 'Documentos por Vencer',
            description: `Tienes ${dueSoonDocs.length} documento(s) que vencen en los próximos 7 días`,
            data: JSON.stringify({
              documents: dueSoonDocs.map(d => ({
                id: d.id,
                title: d.title,
                dueDate: d.dueDate,
                amount: d.amount
              }))
            }),
            confidence: 1.0,
            projectId: project.id,
            validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        });
      }
    }

    console.log('✅ AI insights generated successfully');
  } catch (error) {
    console.error('❌ Error generating AI insights:', error);
  }
};

/**
 * Generar informe ejecutivo con IA
 */
export const generateExecutiveReport = async (
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<string> => {
  try {
    // Obtener datos del proyecto
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        transactions: {
          where: {
            date: { gte: startDate, lte: endDate }
          }
        },
        documents: {
          where: {
            issueDate: { gte: startDate, lte: endDate }
          }
        }
      }
    });

    if (!project) return 'Proyecto no encontrado';

    const income = project.transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amountUsd), 0);

    const expenses = project.transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amountUsd), 0);

    const prompt = `
      Genera un informe ejecutivo profesional para el proyecto "${project.name}":
      
      Período: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}
      Ingresos totales: $${income.toFixed(2)} USD
      Gastos totales: $${expenses.toFixed(2)} USD
      Balance: $${(income - expenses).toFixed(2)} USD
      Transacciones: ${project.transactions.length}
      Documentos: ${project.documents.length}
      
      El informe debe incluir:
      1. Resumen ejecutivo
      2. Análisis de ingresos y gastos
      3. Indicadores clave
      4. Recomendaciones
      
      Formato profesional en español, máximo 800 palabras.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Eres un analista financiero senior que genera informes ejecutivos.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    return response.choices[0]?.message?.content || 'No se pudo generar el informe';
  } catch (error) {
    console.error('❌ Error generating executive report:', error);
    return 'Error al generar el informe';
  }
};

export const parseFinancialTextToJSON = async (
  text: string, 
  context?: { 
    currentDate?: string; 
    projects?: { id: string; name: string }[];
    contacts?: { id: string; name: string }[];
    accounts?: { id: string; name: string; projectId: string | null }[];
  }
) => {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!OPENROUTER_API_KEY) {
    throw new Error('Falta OPENROUTER_API_KEY u OPENAI_API_KEY');
  }

  const currentDateInfo = context?.currentDate ? `Hoy es y ahora son las: ${context.currentDate} (YYYY-MM-DDTHH:mm:ss). Usa esto de base para inferir la clave "fecha".` : '';
  const projectsInfo = context?.projects?.length ? `Proyectos disponibles:\n${context.projects.map(p => `- ID: ${p.id} | Nombre: ${p.name}`).join('\n')}\nSi el usuario menciona un proyecto, usa su ID. Si no, usa null/vacío.` : '';
  const contactsInfo = context?.contacts?.length ? `Contactos disponibles (clientes/proveedores):\n${context.contacts.map(c => `- ID: ${c.id} | Nombre: ${c.name}`).join('\n')}\nSi el usuario menciona o infieres alguno de estos clientes/proveedores en el texto, usa su ID. Si no lo encuentras o no lo menciona claramente, devuelve null.` : '';
  const accountsInfo = context?.accounts?.length ? `Cuentas disponibles:\n${context.accounts.map(a => `- ID: ${a.id} | Nombre: ${a.name} | Proyecto_ID: ${a.projectId}`).join('\n')}\nSi el usuario menciona una cuenta origen o destino, intenta asociarla con uno de estos IDs.` : '';

  const prompt = `Eres un asistente experto en contabilidad.
Extrae la información financiera del texto y devuelve SOLO UN OBJETO JSON con ESTRUCTURA ESTRICTA. No uses formato markdown.

Contexto actual:
${currentDateInfo}
${projectsInfo}
${contactsInfo}
${accountsInfo}

Las claves requeridas son:
- "monto" (número exacto del valor mencionado, sin comas para separador de miles. usa punto para decimal).
- "moneda_dictada" (string: "BS", "USD" o "EUR". La denominación original referida).
- "moneda_final" (string: "BS", "USD" o "EUR". La moneda real de pago/cobro exigida por el usuario).
  - "fecha" (formato YYYY-MM-DDTHH:mm:ss). CRÍTICO: Si el usuario menciona EXPLÍCITAMENTE una fecha o día (ej. "8 de mayo", "ayer", "el viernes pasado"), usa ESA fecha calculándola respecto al Contexto actual temporal. Si el usuario indica una fecha total (día, mes, año), respétala exactamente. SOLO SI NO MENCIONA NADA DE FECHAS, usarás exactamente la fecha del Contexto actual.
- "proyecto_id" (string con el ID del proyecto si lo menciona, de lo contrario null).
- "contacto_id" (string con el ID del contacto cliente/proveedor si se menciona en el texto buscando entre los disponibles en el contexto, de lo contrario null).
- "concepto" (string, descripción breve).
- "categoria" (string, infiere la categoría de gasto/ingreso/transferencia).
- "cuenta_origen" (string, por defecto "Efectivo" si no se menciona un banco o cuenta).
- "cuenta_origen_id" (string, el ID de la cuenta en el contexto de donde SALE el dinero, si aplica).
- "cuenta_destino" (string, cuenta o destino).
- "cuenta_destino_id" (string, el ID de la cuenta en el contexto donde ENTRA el dinero, si aplica).
- "proyecto_destino_id" (string, ID del proyecto destino si es diferente al origen).
- "tipo" (string, únicamente "gasto", "ingreso" o "transferencia").

Texto: ${text}`;

  let response;
  let attempts = 0;
  while (attempts < 3) {
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: 'Debes responder SOLO con un OBJETO JSON válido sin formato ni backticks.' },
            { role: 'user', content: prompt }
          ]
        }),
        signal: AbortSignal.timeout(15000)
      });
      break;
    } catch (e) {
      attempts++;
      console.log('AI Timeout, retrying', attempts);
      if (attempts >= 3) {
          throw new Error("terminated"); // This mimics what telegram throws, or we can throw custom
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (!response || !response.ok) {
    const err = response ? await response.text() : 'Network Timeout';
    throw new Error('Error en OpenRouter: ' + err);
  }

  const data: any = await response.json();
  let rawText = data.choices[0].message.content.trim();

  // Limpiar backticks de markdown si el LLM los escupe de todos modos
  if (rawText.startsWith('```json')) {
    rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
  }
  
  try {
    return JSON.parse(rawText);
  } catch (e) {
    throw new Error('El NLP no devolvió JSON válido: ' + rawText);
  }
};
