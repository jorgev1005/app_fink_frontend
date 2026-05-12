const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  const tx = await prisma.transaction.findUnique({
      where: { code: 'BOT-1777855540584' },
      include: {
          entries: {
              include: { 
                  debitAccount: { select: { id: true, name: true, projectId: true, balanceBs: true, balanceUsd: true } },
                  creditAccount: { select: { id: true, name: true, projectId: true, balanceBs: true, balanceUsd: true } }
              }
          }
      }
  });
  console.log(JSON.stringify(tx, null, 2));
} 
run().catch(console.error).finally(() => prisma.$disconnect());