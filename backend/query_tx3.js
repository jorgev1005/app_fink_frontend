const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestTxs = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    take: 50,
    include: { account: { include: { project: true } } }
  });
  
  const botTx = latestTxs.filter(tx => 
      (tx.reference && tx.reference.includes('1778174661578')) || 
      (tx.description && tx.description.includes('Cambio de USDT'))
  );
  
  console.log("Found matching transactions:", botTx.map(t => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    currency: t.currency,
    description: t.description,
    reference: t.reference,
    account: t.account.name,
    project: t.account.project.name
  })));
  
}

main().finally(() => prisma.$disconnect());