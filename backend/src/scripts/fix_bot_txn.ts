import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const code = 'BOT-1777742516295';
  const txn = await prisma.transaction.findFirst({ where: { code } });
  if (!txn) { console.log('Not found'); return; }
  await prisma.transaction.update({ where: { id: txn.id }, data: { amountPaid: txn.amount, paymentStatus: 'PAID', status: 'COMPLETED' } });
  console.log('Transaction explicitly marked as PAID!');
}
main().finally(() => prisma.$disconnect());