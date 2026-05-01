const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sources = ['BCV', 'BINANCE', 'CUSTOM', 'PARALELO'];
  for (const source of sources) {
    console.log(`\n--- Source: ${source} ---`);
    const rates = await prisma.exchangeRate.findMany({
      where: { source: source },
      orderBy: { date: 'desc' },
      take: 2
    });
    console.log(JSON.stringify(rates, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
