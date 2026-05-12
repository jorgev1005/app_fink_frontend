const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const banescoAccountId = 'ce7146b6-7fd9-472e-a643-73da4646c8d9';
  const amount = 6200;

  const current = await prisma.account.findUnique({
    where: { id: banescoAccountId }
  });
  console.log('Saldo antes del ajuste:', current.balanceBs);

  const updated = await prisma.account.update({
    where: { id: banescoAccountId },
    data: {
      balanceBs: {
        decrement: amount
      }
    }
  });

  console.log('Saldo despues del ajuste (se restaron 6200):', updated.balanceBs);
}
main().catch(console.error).finally(()=>prisma.$disconnect());