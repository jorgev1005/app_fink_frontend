import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: {
      currency: 'BS',
      balanceBs: { gt: 0 },
      isActive: true
    },
    select: {
      id: true,
      name: true,
      type: true,
      balanceBs: true,
      project: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      balanceBs: 'desc'
    }
  });

  let total = 0;
  console.log('Accounts with balanceBs > 0:');
  accounts.forEach(acc => {
    console.log(`- ${acc.name} (${acc.type}) [${acc.project?.name || 'No Project'}]: ${acc.balanceBs}`);
    total += acc.balanceBs;
  });
  console.log(`\nTotal: ${total}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
