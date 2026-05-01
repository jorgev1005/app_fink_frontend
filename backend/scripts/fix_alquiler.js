const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const account = await prisma.project.findFirst({
    where: { name: { contains: 'jorge', mode: 'insensitive' } }
  });
  
  if(account) {
    const txs = await prisma.transaction.findMany({
        where: {
            projectId: account.id,
            description: { contains: 'alquiler apto', mode: 'insensitive' }
        },
        orderBy: { date: 'desc' },
        take: 5
    });

    if(txs.length > 0) {
        for(let tx of txs) {
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
        console.log("No transactions found");
    }
  }
}
main().catch(console.error).finally(()=> prisma.$disconnect());