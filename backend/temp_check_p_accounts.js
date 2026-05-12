const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  const pAccounts = await prisma.account.findMany({
      where: { projectId: 'd595ce90-85a8-42e6-9668-95d5805e9ab8' }
  });
  console.log(JSON.stringify(pAccounts, null, 2));
} 
run().catch(console.error).finally(() => prisma.$disconnect());