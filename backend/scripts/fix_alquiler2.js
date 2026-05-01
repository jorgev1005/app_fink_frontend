const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  const project = projects.find(p => p.name.toLowerCase().includes('jorge'));
  
  if(project) {
    const txs = await prisma.transaction.findMany({
        where: {
            projectId: project.id
        },
        orderBy: { date: 'desc' }
    });

    const targetTxs = txs.filter(t => t.description.toLowerCase().includes('alquiler apto'));

    if(targetTxs.length > 0) {
        for(let tx of targetTxs) {
            console.log(`Fixing TX ${tx.id} - ${tx.description} to PENDING`);
            await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                    status: 'PENDING',
                    paymentStatus: 'PENDING'
                }
            });
        }
    } else {
        console.log("No transactions found for Alquiler Apto");
    }
  }
}
main().catch(console.error).finally(()=> prisma.$disconnect());
