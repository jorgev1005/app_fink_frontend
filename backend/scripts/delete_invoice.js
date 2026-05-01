const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node delete_invoice.js <invoiceId>');
    process.exit(2);
  }

  try {
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      console.log('Invoice not found:', id);
      return;
    }
    await prisma.invoice.delete({ where: { id } });
    console.log('Deleted invoice:', id);
  } catch (err) {
    console.error('Error deleting invoice:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
