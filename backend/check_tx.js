const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({
    where: {
      code: { in: ['BOT-1777851650969', 'BOT-1777858720499'] }
    },
    include: {
      entries: {
        include: {
          creditAccount: true,
          debitAccount: true
        }
      }
    }
  });

  console.dir(txs, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
