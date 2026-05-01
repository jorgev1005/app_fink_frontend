import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(){
  const accounts = await prisma.account.findMany({
    where: { type: 'ASSET' },
    include: {
      project: true,
      transactionDebits: {
        include: { transaction: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      transactionCredits: {
        include: { transaction: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  console.log(JSON.stringify(accounts, null, 2));
}

main()
  .catch((e)=>{ console.error(e); process.exit(1); })
  .finally(()=>prisma.$disconnect());
