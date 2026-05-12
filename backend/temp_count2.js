const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  const t = await prisma.transaction.findFirst({
        where: { code: 'BOT-1777855540584' }
  });
  console.log("Transaction:", t);
  const allT = await prisma.transaction.findMany();
  console.log("All counts:", allT.length);
  if(allT.length > 0) {
      console.log("First Tx ID:", allT[0].id);
      console.log("Projects assigned:", new Set(allT.map(x => x.projectId)));
  }
} 
run().catch(console.error).finally(() => prisma.$disconnect());