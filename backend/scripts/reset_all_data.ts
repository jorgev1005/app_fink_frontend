// Script para borrar todas las transacciones y poner en cero todas las cuentas
import prisma from '../src/config/database';

async function main() {
  // Borrar todas las transacciones
  await prisma.transactionEntry.deleteMany({});
  await prisma.transaction.deleteMany({});

  // Poner en cero todos los saldos de cuentas
  await prisma.account.updateMany({
    data: {
      balanceBs: 0,
      balanceUsd: 0,
      balanceEur: 0,
    },
  });

  console.log('Todas las transacciones eliminadas y saldos de cuentas puestos en cero.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
