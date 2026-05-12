const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txId = 'ffe0533e-405a-410d-a602-4e4e62a10194';
  const banescoAccountId = 'ce7146b6-7fd9-472e-a643-73da4646c8d9';
  const amount = 6200;

  // Creamos el lado de credito que faltaba
  const newEntry = await prisma.transactionEntry.create({
    data: {
      transactionId: txId,
      creditAccountId: banescoAccountId,
      creditAmount: amount,
      debitAmount: 0
    }
  });

  console.log('Movimiento de salida (Banesco) creado:', newEntry.id);

  // Verificamos que quedo bien
  const tx = await prisma.transaction.findUnique({
    where: { id: txId },
    include: { entries: true }
  });
  console.log('Transaccion reparada:');
  console.dir(tx, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());