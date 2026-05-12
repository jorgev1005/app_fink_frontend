const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestTxs = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    take: 50,
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
      (tx.reference && tx.reference.includes('1778174661578')) || 
      (tx.description && tx.description.includes('Cambio de USDT')) ||
      (tx.description && tx.description.includes('BOT-1778174661578'))
  );
  
  console.log(JSON.stringify(botTx, null, 2));
}

main().finally(() => prisma.$disconnect());