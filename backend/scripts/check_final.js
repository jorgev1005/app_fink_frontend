const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function m() {
  const accs = await p.account.findMany({ select: { name: true, balanceBs: true, balanceUsd: true }});
  console.log(accs.slice(0, 3));
  const tx = await p.transaction.count();
  console.log('TX count:', tx);
}
m().finally(() => p.$disconnect());