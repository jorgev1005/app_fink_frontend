
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      project: true,
      entries: {
        include: {
          debitAccount: true,
          creditAccount: true
        }
      }
    }
  });

  console.log(JSON.stringify(txs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
