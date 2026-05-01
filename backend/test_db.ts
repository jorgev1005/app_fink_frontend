import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const trans = await prisma.transaction.findFirst({
    where: { paymentStatus: 'PENDING', type: 'EXPENSE' },
    include: { contact: true, project: true }
  });
  console.log(JSON.stringify(trans, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());