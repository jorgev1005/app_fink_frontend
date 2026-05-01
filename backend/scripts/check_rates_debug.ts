import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkRates() {
  const sources = ['BCV', 'BINANCE', 'CUSTOM', 'PARALELO'];
  for (const source of sources) {
    console.log(`\n--- ${source} ---`);
    const rates = await prisma.exchangeRate.findMany({
      where: { source: source },
      orderBy: { date: 'desc' },
      take: 2
    });
    
    rates.forEach(r => {
      console.log(`${r.date.toISOString()} | USD: ${r.usdToBs} | EUR: ${r.eurToBs}`);
    });

    if (rates.length === 2) {
       const today = rates[0];
       const yesterday = rates[1];
       const devaluationPct = ((today.usdToBs - yesterday.usdToBs) / yesterday.usdToBs) * 100;
       console.log(`Deval Pct calc: ((${today.usdToBs} - ${yesterday.usdToBs}) / ${yesterday.usdToBs}) * 100 = ${devaluationPct.toFixed(2)}%`);
    }
  }
}

checkRates()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
