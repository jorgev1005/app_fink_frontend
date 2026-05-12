const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  const accounts = await prisma.account.findMany({
      where: { 
          projectId: 'd595ce90-85a8-42e6-9668-95d5805e9ab8',
          name: {
              in: ['Banco Banesco', 'Exchange Binance']
          }
      },
      select: { id: true, name: true, balanceBs: true, balanceUsd: true }
  });
  console.log(JSON.stringify(accounts, null, 2));
} 
run().catch(console.error).finally(() => prisma.$disconnect());