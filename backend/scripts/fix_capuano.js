const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const code = 'TRX-CAP-007-291140777';
  console.log(`Buscando transaccion con codigo: ${code}`);
  
  const tx = await prisma.transaction.findFirst({
      where: { code: code }
  });

  if (tx) {
      console.log('--- Datos Actuales ---');
      console.log(`ID: ${tx.id}`);
      console.log(`Monto: ${tx.amount}`);
      console.log(`Monto Pagado: ${tx.amountPaid}`);
      console.log(`Status: ${tx.status}`);
      console.log(`Payment Status: ${tx.paymentStatus}`);
      
      // Si el monto pagado es igual al monto y sigue pendiente, lo arreglamos de unavez
      if (Number(tx.amountPaid) >= Number(tx.amount) && tx.paymentStatus !== 'PAID') {
          console.log('Corrigiendo inconsistency: amountPaid == amount pero paymentStatus != PAID');
          await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                  status: 'COMPLETED',
                  paymentStatus: 'PAID'
              }
          });
          console.log('Transaccion actualizada a PAID y COMPLETED');
      }
  } else {
      console.log("No se encontro la transaccion.");
  }
}
main().catch(console.error).finally(()=> prisma.$disconnect());
