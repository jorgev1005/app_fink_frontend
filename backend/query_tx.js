const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const referenceIdSearch = await prisma.transaction.findMany({
    where: {
      OR: [
        { reference: { contains: 'BOT-1778174661578' } },
        { description: { contains: 'USDT' } }
      ]
    },
    take: 10,
    include: { account: { include: { project: true } } }
  });
  console.log('Query results:');
  console.log(JSON.stringify(referenceIdSearch, null, 2));
}

main().finally(() => prisma.$disconnect());
