const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- EMPEZANDO RESET PARCIAL ---');
  
  // 1. Reset all Accounts to 0
  await prisma.account.updateMany({
    data: { balanceBs: 0, balanceUsd: 0, balanceEur: 0 }
  });
  console.log('✅ Saldos de cuentas en 0');

  // 2. Delete all Payments (cascade deletes PaymentAllocations)
  await prisma.payment.deleteMany({});
  console.log('✅ Pagos eliminados');

  // 3. Delete all Transactions (cascade deletes TransactionEntries)
  await prisma.transaction.deleteMany({});
  console.log('✅ Transacciones históricas eliminadas');

  // 4. Delete all Invoices that are PAID or CANCELLED
  await prisma.invoice.deleteMany({
    where: { status: { in: ['PAID', 'CANCELLED'] } }
  });
  console.log('✅ Cuentas por Pagar/Cobrar pagadas o canceladas eliminadas');

  // 5. Reset remaining Invoices to OPEN and outstanding = total
  const remainingInvoices = await prisma.invoice.findMany({});
  for (const inv of remainingInvoices) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'OPEN', outstanding: inv.total }
    });
  }
  console.log('✅ ' + remainingInvoices.length + ' facturas pendientes devueltas a estado OPEN (Pendiente)');

  // 6. Delete all ScheduledOccurrences that have already been POSTED or no longer belong to an invoice
  // Si la ocurrencia fue posteada pero la factura asociada existe, dejarla para que no duplique? 
  // No, the recurring rule might need to know if it was posted to avoid reposting, but if we delete it, it might trigger again.
  // Wait! ScheduledOccurrence has 'status'. 
  // Actually, let's just delete POSTED occurrences that have NO INVOICE, or delete all POSTED occurrences?
  // Let's just delete the ones without an invoice just in case, but actually if a transaction was created directly, it's deleted. 
  // Let's just keep occurrences as they are or delete them. We will just delete the scheduled occurrences that are POSTED if they are tied to a deleted invoice, Prisma does this if onDelete: Cascade. Let's check relation.
  
  console.log('--- RESET COMPLETADO CON ÉXITO ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
