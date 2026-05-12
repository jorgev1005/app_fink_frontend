const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const referenceIdSearch = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    take: 50,
    include: { account: { include: { project: true } } }
  });
  
  const filtered = referenceIdSearch.filter(tx => 
      (tx.reference && tx.reference.includes('1778174661578')) || 
      (tx.description && tx.description.includes('Cambio de USDT por bol'))
  );
  console.log(JSON.stringify(filtered, null, 2));
}

main().finally(() => prisma.$disconnect());