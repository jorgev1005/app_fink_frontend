import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(){
  const banks = await prisma.account.findMany({
    where: {
      subType: 'BANK',
      balanceBs: 0,
      balanceUsd: 0,
      balanceEur: 0,
    },
    include: {
      project: true,
      _count: {
        select: { transactionDebits: true, transactionCredits: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const suspicious = banks.filter(b => b._count.transactionDebits === 0 && b._count.transactionCredits === 0);
  console.log(JSON.stringify(suspicious, null, 2));
}

main()
  .catch((e)=>{ console.error(e); process.exit(1); })
  .finally(()=>prisma.$disconnect());
