const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestTxs = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    take: 100,
    include: {
      project: true,
      entries: {
        include: {
          debitAccount: { include: { project: true } },
          creditAccount: { include: { project: true } }
        }
      }
    }
  });
  
  const botTx = latestTxs.filter(tx => 
      (tx.reference && tx.reference.toLowerCase().includes('bot')) || 
      (tx.description && tx.description.toLowerCase().includes('cambio')) ||
      (tx.notes && tx.notes.toLowerCase().includes('bot'))
  );
  
  console.log(JSON.stringify(botTx, null, 2));
}

main().finally(() => prisma.$disconnect());