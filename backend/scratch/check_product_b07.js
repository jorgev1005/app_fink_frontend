const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findUnique({
    where: { id: 'b0788d85-78fa-4885-8a3d-98ec5f65256c' }
  });

  console.log('PRODUCT DETAILS:', JSON.stringify(product, null, 2));

  // Find all invoices (sales and purchases) referencing this productId
  const allInvoices = await prisma.invoice.findMany({
    where: {
      lines: {
        contains: 'b0788d85-78fa-4885-8a3d-98ec5f65256c'
      }
    }
  });

  console.log('\nALL INVOICES FOR THIS PRODUCT ID:', allInvoices.length);
  for (const inv of allInvoices) {
    console.log(`Invoice Code: ${inv.code} | Type: ${inv.type} | Status: ${inv.status}`);
    try {
      const lines = JSON.parse(inv.lines || '{}');
      const items = lines.items || [];
      const item = items.find(i => i.productId === 'b0788d85-78fa-4885-8a3d-98ec5f65256c');
      console.log('  Matching Item:', item);
    } catch (e) {}
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
