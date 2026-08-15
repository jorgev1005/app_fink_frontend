const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { contains: 'LUC-FER-JUL-EST-001', mode: 'insensitive' } },
        { name: { contains: 'apilable', mode: 'insensitive' } }
      ]
    }
  });

  console.log('PRODUCTS FOUND:', products.length);
  for (const p of products) {
    console.log('--------------------------------------------------');
    console.log(`ID: ${p.id}`);
    console.log(`SKU: ${p.sku}`);
    console.log(`Name: ${p.name}`);
    console.log(`InitialStock: ${p.initialStock}`);
    console.log(`Price: ${p.price} USD | CostPrice: ${p.costPrice}`);
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      lines: {
        contains: 'LUC-FER-JUL-EST-001'
      }
    }
  });

  console.log('\nINVOICES WITH THIS PRODUCT SKU (total):', invoices.length);
  for (const inv of invoices) {
    console.log(`Invoice Code: ${inv.code} | Type: ${inv.type} | Status: ${inv.status} | IssueDate: ${inv.issueDate}`);
    try {
      const lines = JSON.parse(inv.lines || '[]');
      console.log('  Lines:', lines);
    } catch (e) {
      console.log('  Raw Lines:', inv.lines);
    }
  }

  // Also check invoices containing "730" or "JAC" or "apilable"
  const allInvoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { code: { contains: '730' } },
        { lines: { contains: 'apilable' } }
      ]
    }
  });
  console.log('\nALL INVOICES MATCHING 730 or apilable:', allInvoices.length);
  for (const inv of allInvoices) {
    console.log(`Invoice Code: ${inv.code} | Type: ${inv.type} | Status: ${inv.status} | IssueDate: ${inv.issueDate}`);
    try {
      const lines = JSON.parse(inv.lines || '[]');
      console.log('  Lines:', lines);
    } catch (e) {
      console.log('  Raw Lines:', inv.lines);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
