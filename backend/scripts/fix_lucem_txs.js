const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  const project = projects.find(p => p.name.toLowerCase().includes('lucem'));
  
  if (project) {
    const targetDescriptions = ['servicio agua', 'alquiler galpon', 'internet inter'];
    
    // Obtener las transacciones del proyecto
    const txs = await prisma.transaction.findMany({
        where: {
            projectId: project.id
        },
        orderBy: { createdAt: 'desc' }, // Buscar las recien creadas
        take: 30
    });

    // Filtrar aquellas que correspondan a las buscadas
    const targetTxs = txs.filter(t => 
        targetDescriptions.some(desc => t.description.toLowerCase().includes(desc))
    );

    if (targetTxs.length > 0) {
        for (let tx of targetTxs) {
            console.log(`Corrigiendo TX ${tx.code} | ID: ${tx.id} - ${tx.description} a PENDING`);
            await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                    status: 'PENDING',
                    paymentStatus: 'PENDING',
                    amountPaid: 0 // Importante: como no están pagadas, monto pagado a 0
                }
            });
        }
    } else {
        console.log("No se encontraron transacciones para actualizar en Inversiones Lucem");
    }
  } else {
      console.log("No se encontro proyecto Lucem.");
  }
}
main().catch(console.error).finally(()=> prisma.$disconnect());
