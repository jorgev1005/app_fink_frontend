import prisma from '../src/config/database';

async function main() {
  console.log('Iniciando script de poner a cero saldos de cuentas...');

  // Resumen previo
  const totalAccounts = await prisma.account.count();
  const sumsBefore = await prisma.account.aggregate({
    _sum: {
      balanceBs: true,
      balanceUsd: true,
      balanceEur: true,
    }
  });

  console.log(`Cuentas encontradas: ${totalAccounts}`);
  console.log('Saldos antes:', {
    balanceBs: sumsBefore._sum.balanceBs?.toString() ?? '0',
    balanceUsd: sumsBefore._sum.balanceUsd?.toString() ?? '0',
    balanceEur: sumsBefore._sum.balanceEur?.toString() ?? '0'
  });

  // Ejecutar la actualización en una transacción
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Actualizar todos los saldos a 0
      const update = await tx.account.updateMany({
        data: {
          balanceBs: 0,
          balanceUsd: 0,
          balanceEur: 0,
        }
      });
      return update;
    });

    console.log(`Actualizadas ${result.count} cuentas.`);

    const sumsAfter = await prisma.account.aggregate({
      _sum: {
        balanceBs: true,
        balanceUsd: true,
        balanceEur: true,
      }
    });

    console.log('Saldos después:', {
      balanceBs: sumsAfter._sum.balanceBs?.toString() ?? '0',
      balanceUsd: sumsAfter._sum.balanceUsd?.toString() ?? '0',
      balanceEur: sumsAfter._sum.balanceEur?.toString() ?? '0'
    });

  } catch (error) {
    console.error('Error ejecutando la transacción:', error);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
