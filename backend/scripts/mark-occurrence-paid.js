// Script to mark a ScheduledOccurrence as paid by creating a Payment and allocation
// Usage: node backend/scripts/mark-occurrence-paid.js <occurrenceId>
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node mark-occurrence-paid.js <occurrenceId>');
    process.exit(2);
  }

  const occ = await prisma.scheduledOccurrence.findUnique({ where: { id }, include: { invoice: true } });
  if (!occ) {
    console.error('Ocurrencia no encontrada:', id);
    process.exit(1);
  }
  if (!occ.invoice) {
    console.error('La ocurrencia no tiene factura asociada. invoiceId:', occ.invoiceId);
    process.exit(1);
  }

  const invoice = occ.invoice;
  const outstanding = Number(invoice.outstanding || 0);
  if (!(outstanding > 0)) {
    console.log('La factura no tiene saldo pendiente (outstanding =', invoice.outstanding, '). No se creará pago.');
    process.exit(0);
  }

  // choose a user to own the payment: prefer invoice.createdBy, otherwise first user
  let userId = invoice.createdBy;
  if (!userId) {
    const u = await prisma.user.findFirst();
    if (!u) {
      console.error('No hay usuarios en la base de datos para asignar al payment. Crear un usuario primero.');
      process.exit(1);
    }
    userId = u.id;
  }

  const result = await prisma.$transaction(async (tx) => {
    const code = `PAY-${invoice.projectId}-${Date.now()}`;
    const payment = await tx.payment.create({
      data: {
        project: { connect: { id: invoice.projectId } },
        code,
        date: new Date(),
        currency: invoice.currency,
        amount: outstanding,
        method: 'BANK_TRANSFER',
        reference: `AUTO_PAY_OCC_${id}`,
        status: 'COMPLETED',
        user: { connect: { id: userId } },
      }
    });

    await tx.paymentAllocation.create({ data: { payment: { connect: { id: payment.id } }, invoice: { connect: { id: invoice.id } }, allocatedAmount: outstanding } });

    await tx.invoice.update({ where: { id: invoice.id }, data: { outstanding: 0, status: 'PAID' } });

    // mark occurrence as POSTED (if not already)
    await tx.scheduledOccurrence.update({ where: { id }, data: { status: 'POSTED', invoiceId: invoice.id } });

    const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true, occurrences: true } });

    return { payment, updatedInvoice };
  });

  console.log('Pago creado:', result.payment.id);
  console.log('Factura actualizada:', JSON.stringify(result.updatedInvoice, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
