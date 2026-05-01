
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Iniciando reparación de saldos iniciales pendientes...');

  // Buscar transacciones de ajuste (saldo inicial) que no estén marcadas como pagadas
  const transactionsToFix = await prisma.transaction.findMany({
    where: {
      type: 'ADJUSTMENT',
      description: {
        startsWith: 'Saldo inicial para'
      },
      paymentStatus: {
        not: 'PAID'
      }
    }
  });

  console.log(`📋 Encontradas ${transactionsToFix.length} transacciones para corregir.`);

  if (transactionsToFix.length === 0) {
    console.log('✅ No hay transacciones pendientes de corrección.');
    return;
  }

  let updatedCount = 0;

  for (const trx of transactionsToFix) {
    try {
      await prisma.transaction.update({
        where: { id: trx.id },
        data: {
          paymentStatus: 'PAID',
          amountPaid: trx.amount // Asumimos que el saldo inicial está totalmente cubierto
        }
      });
      updatedCount++;
      process.stdout.write('.'); // Progreso visual
    } catch (error) {
      console.error(`\n❌ Error actualizando transacción ${trx.code}:`, error);
    }
  }

  console.log(`\n\n✅ Proceso finalizado. Total corregidas: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
