import OpenAI from 'openai';
import prisma from '../config/database';

const getOpenAI = () => new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://fink.grupoaludra.com',
    'X-Title': 'Fink App'
  }
});

export const getFinancialContext = async (projectId?: string) => {
  const accounts = await prisma.account.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      type: 'ASSET',
      subType: { in: ['BANK', 'CASH', 'WALLET', 'CASH_AND_EQUIVALENTS'] }
    },
    select: { balanceBs: true, balanceUsd: true, balanceEur: true }
  });

  const totalBs = accounts.reduce((acc, a) => acc + (a.balanceBs || 0), 0);
  const totalUsd = accounts.reduce((acc, a) => acc + (a.balanceUsd || 0), 0);
  const totalEur = accounts.reduce((acc, a) => acc + (a.balanceEur || 0), 0);

  const liquidAssets = {
    BS: totalBs.toFixed(2),
    USD: totalUsd.toFixed(2),
    EUR: totalEur.toFixed(2)
  };

  const pendingInvoicesQuery = await prisma.invoice.findMany({
    where: { ...(projectId ? { projectId } : {}), status: 'OPEN' },
    select: { type: true, outstanding: true, currency: true }
  });

  const pendingPayables = pendingInvoicesQuery.filter(i => i.type === 'BILL');
  const pendingReceivables = pendingInvoicesQuery.filter(i => i.type === 'INVOICE');
  
  const totalPayablesUSD = pendingPayables.filter(i => i.currency === 'USD').reduce((acc, i) => acc + i.outstanding, 0).toFixed(2);
  const totalReceivablesUSD = pendingReceivables.filter(i => i.currency === 'USD').reduce((acc, i) => acc + i.outstanding, 0).toFixed(2);
  const totalPayablesBS = pendingPayables.filter(i => i.currency === 'BS').reduce((acc, i) => acc + i.outstanding, 0).toFixed(2);
  const totalReceivablesBS = pendingReceivables.filter(i => i.currency === 'BS').reduce((acc, i) => acc + i.outstanding, 0).toFixed(2);

  return {
    liquidAssets,
    pendingInvoices: {
      payablesUsd: totalPayablesUSD,
      payablesBs: totalPayablesBS,
      receivablesUsd: totalReceivablesUSD,
      receivablesBs: totalReceivablesBS,
      payablesCount: pendingPayables.length,
      receivablesCount: pendingReceivables.length
    }
  };
};

export const generateCFOSummary = async (projectId?: string) => {
  const context = await getFinancialContext(projectId);

  const prompt = `
  Eres el mejor amigo y contador de confianza del dueño de la empresa.
  Aquí están sus datos financieros reales de liquidez:

  Disponible en Banco/Caja:
  - USD: $${context.liquidAssets.USD}
  - Bolívares: Bs. ${context.liquidAssets.BS}
  - Euros: €${context.liquidAssets.EUR}

  Por pagar a Proveedores:
  - USD: $${context.pendingInvoices.payablesUsd}
  - Bolívares: Bs. ${context.pendingInvoices.payablesBs}

  Por cobrar a Clientes:
  - USD: $${context.pendingInvoices.receivablesUsd}
  - Bolívares: Bs. ${context.pendingInvoices.receivablesBs}

  Escribe UNA sola frase de máximo 25 palabras dándole un consejo amistoso y empático sobre su situación de liquidez.
  Háblale de "tú". Ejemplo: "Amigo, tenemos buen efectivo en dólares, pero ponte las pilas cobrando esas facturas para no quedarnos cortos."
  `;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'minimax/minimax-m2.5:free',
      messages: [{ role: 'user', content: prompt }],
    }, { timeout: 4000 });
    return response.choices[0].message.content || 'Sin recomendaciones por ahora.';
  } catch(e:any) {
    console.error('Error in getCFOAdvice:', e.message);
    try {
      const fallbackResponse = await getOpenAI().chat.completions.create({
        model: 'nvidia/nemotron-nano-12b-v2-vl:free',
        messages: [{ role: 'user', content: prompt }],
      }, { timeout: 4000 });
      return fallbackResponse.choices[0].message.content || 'Sin recomendaciones por ahora.';
    } catch (err2: any) {
      console.error('Error in getCFOAdvice fallback:', err2.message);
      return 'Mis servidores de asesoría están temporalmente fuera de línea. Por favor vuelve a intentarlo en unos minutos.';
    }
  }
};

export const generateDetailedCFOReport = async (projectId: string) => {
  const context = await getFinancialContext(projectId);

  const prompt = `
  Eres el contador de confianza, empático y asesor financiero de mi empresa.
  Trátame como a un amigo, usando "tú", con un tono muy amigable y alentador.

  Aquí están mis datos de liquidez:
  - Efectivo (Banco/Caja) USD: $${context.liquidAssets.USD}
  - Efectivo (Banco/Caja) Bolívares: Bs. ${context.liquidAssets.BS}
  - Efectivo (Banco/Caja) Euros: €${context.liquidAssets.EUR}

  - Deudas pendientes por pagar (Total USD): $${context.pendingInvoices.payablesUsd}
  - Deudas pendientes por pagar (Total BS): Bs. ${context.pendingInvoices.payablesBs}

  - Cobros pendientes de clientes (Total USD): $${context.pendingInvoices.receivablesUsd}
  - Cobros pendientes de clientes (Total BS): Bs. ${context.pendingInvoices.receivablesBs}

  Estructura esperada usando Markdown:
  1. **¿Cómo vamos?** Un diagnóstico rápido y alentador sobre si me alcanza la plata o no.
  2. **¡Cuidado con esto!** Que me adviertas si las deudas superan el efectivo o si tengo mucho por cobrar.
  3. **Tus tareas para esta semana:** 3 consejos prácticos, directos y amigables.
  `;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'minimax/minimax-m2.5:free',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content || 'No pude analizar los datos, intenta de nuevo.';
  } catch(e:any) {
    console.log("CFO AI Error (Main):", e.message);
    try {
      const fallback = await getOpenAI().chat.completions.create({
        model: 'nvidia/nemotron-nano-12b-v2-vl:free',
        messages: [{ role: 'user', content: prompt }],
      });
      return fallback.choices[0].message.content || 'No pude analizar los datos, intenta de nuevo.';
    } catch(err2:any) {
       return 'No pude analizar los datos por problemas de conexión a la IA, intenta de nuevo más tarde.';
    }
  }
};
