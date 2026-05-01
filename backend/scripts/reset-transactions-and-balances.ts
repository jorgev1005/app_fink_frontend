
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting reset of transactions and balances...');

  try {
    // 1. Delete all payments
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`Deleted ${deletedPayments.count} payments.`);

    // 2. Unlink ScheduledOccurrences from Invoices (to avoid FK constraints)
    const updatedOccurrences = await prisma.scheduledOccurrence.updateMany({
      where: { invoiceId: { not: null } },
      data: { invoiceId: null, status: 'PENDING' },
    });
    console.log(`Updated ${updatedOccurrences.count} scheduled occurrences (unlinked from invoices).`);

    // 3. Delete all invoices
    const deletedInvoices = await prisma.invoice.deleteMany({});
    console.log(`Deleted ${deletedInvoices.count} invoices.`);

    // 4. Delete all transactions
    // This will cascade delete TransactionEntry and PaymentAllocation (linked to transaction)
    const deletedTransactions = await prisma.transaction.deleteMany({});
    console.log(`Deleted ${deletedTransactions.count} transactions.`);

    // 5. Reset all account balances to 0
    const updatedAccounts = await prisma.account.updateMany({
      data: {
        balanceBs: 0,
        balanceUsd: 0,
        balanceEur: 0,
      },
    });
    console.log(`Updated ${updatedAccounts.count} accounts (balances set to 0).`);

    // 3. Optional: Reset TransactionCodeSequence counters if you want to restart numbering
    // Uncomment if desired. The user didn't explicitly ask for this, but it's common in a reset.
    // await prisma.transactionCodeSequence.updateMany({ data: { counter: 0 } });
    // console.log('Reset transaction code sequences.');

    console.log('Reset completed successfully.');
  } catch (error) {
    console.error('Error resetting data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
