const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  const p = await prisma.project.findMany({ select: { id: true, name: true }}); 
  console.log("Proyectos:");
  console.log(p); 

  const txs = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, code: true, description: true, amount: true, projectId: true },
    take: 5
  });
  console.log("Ultimas Txs:");
  console.log(txs);
} 
run().catch(console.error).finally(() => prisma.$disconnect());
