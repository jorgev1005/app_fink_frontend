const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando escaneo global de estados de transaccion vs montos pagados ---');
  
  const txs = await prisma.transaction.findMany();
  let fixedCount = 0;

  for (let tx of txs) {
    // Las transferencias y ajustes se consideran automticamente pagados y completados
    if (tx.type === 'ADJUSTMENT' || tx.type === 'TRANSFER') {
        if (tx.status !== 'COMPLETED' || tx.paymentStatus !== 'PAID') {
            await prisma.transaction.update({
                where: { id: tx.id },
                data: { status: 'COMPLETED', paymentStatus: 'PAID', amountPaid: Number(tx.amount) }
            });
            console.log(`Corregido ${tx.type} ${tx.code} -> COMPLETED/PAID`);
            fixedCount++;
        }
        continue;
    }

    const amount = Number(tx.amount) || 0;
    const amountPaid = Number(tx.amountPaid) || 0;
    const epsilon = 0.01; // Margen de error en decimales

    let newPayStatus = tx.paymentStatus;
    let newStatus = tx.status;

    // Lgica de resolucion
    if (amount > 0 && amountPaid >= amount - epsilon) {
        // Pagado por completo
        newPayStatus = 'PAID';
        newStatus = 'COMPLETED';
    } else if (amountPaid > epsilon && amountPaid < amount - epsilon) {
        // Pagado parcialmente
        newPayStatus = 'PARTIAL';
        if (newStatus === 'COMPLETED') newStatus = 'PENDING'; 
    } else if (amountPaid <= epsilon) {
        // No pagado
        newPayStatus = 'PENDING';
        if (newStatus === 'COMPLETED') newStatus = 'PENDING';
    }

    // Actualizar si hay inconsistencia
    if (tx.paymentStatus !== newPayStatus || tx.status !== newStatus) {
        console.log(`TX ${tx.code} "${tx.description}":`);
        console.log(`  Monto: $${amount} | Pagado: $${amountPaid}`);
        console.log(`  Anterior: [${tx.status} / ${tx.paymentStatus}]  -->  Nuevo: [${newStatus} / ${newPayStatus}]`);
        
        await prisma.transaction.update({
            where: { id: tx.id },
            data: { status: newStatus, paymentStatus: newPayStatus }
        });
        fixedCount++;
    }
  }
  
  console.log(`\n--- Terminado ---`);
  console.log(`Total revisadas: ${txs.length} | Corregidas: ${fixedCount}`);
}

main().catch(console.error).finally(()=> prisma.$disconnect());
