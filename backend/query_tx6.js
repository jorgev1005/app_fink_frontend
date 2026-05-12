const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestTxs = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    take: 5,
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
  
  console.log(JSON.stringify(latestTxs, null, 2));
}

main().finally(() => prisma.$disconnect());