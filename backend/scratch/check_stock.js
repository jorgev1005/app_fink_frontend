const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { sku: { contains: 'LUC-FER-JUL-EST-001', mode: 'insensitive' } },
        { name: { contains: 'apilable', mode: 'insensitive' } }
      ]
    },
    include: {
      invoiceItems: {
        include: {
          invoice: true
        }
      },
      purchaseInvoiceItems: {
        include: {
          purchaseInvoice: true
        }
      }
    }
  });

  console.log('PRODUCTS FOUND:', products.length);
  for (const p of products) {
    console.log('--------------------------------------------------');
    console.log(`ID: ${p.id} | SKU: ${p.sku} | Name: ${p.name}`);
    console.log(`InitialStock (db field): ${p.initialStock}`);
    console.log(`Current Stock field (if any): ${p.stock}`);
    console.log('Purchase Invoice Items:', p.purchaseInvoiceItems.map(pi => ({
      invoiceId: pi.purchaseInvoiceId,
      code: pi.purchaseInvoice?.code,
      supplier: pi.purchaseInvoice?.supplierName,
      qty: pi.quantity,
      status: pi.purchaseInvoice?.status
    })));
    console.log('Sales Invoice Items:', p.invoiceItems.map(ii => ({
      invoiceId: ii.invoiceId,
      code: ii.invoice?.code,
      project: ii.invoice?.projectName,
      qty: ii.quantity,
      status: ii.invoice?.status
    })));
  }

  // Also check purchase invoice #00730
  const purchaseInvoices = await prisma.purchaseInvoice.findMany({
    where: {
      OR: [
        { code: { contains: '730' } },
        { supplierName: { contains: 'JAC', mode: 'insensitive' } }
      ]
    },
    include: {
      items: true
    }
  });
  console.log('PURCHASE INVOICES:', JSON.stringify(purchaseInvoices, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
