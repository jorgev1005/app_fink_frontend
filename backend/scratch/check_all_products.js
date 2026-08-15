process.env.DATABASE_URL = "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      description: true,
      url_catalogo: true,
      project: { select: { name: true } }
    }
  });

  console.log(`TOTAL PRODUCTOS EN BASE DE DATOS: ${products.length}`);
  for (const p of products) {
    console.log(`- [${p.project?.name || 'GLOBAL'}] ${p.name} (SKU: ${p.sku}) | URL: ${p.url_catalogo}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
