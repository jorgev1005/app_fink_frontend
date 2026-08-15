process.env.DATABASE_URL = "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'apilable', mode: 'insensitive' }
    }
  });

  console.log('=== DETALLES DE PRODUCTOS APILABLES EN DB ===');
  for (const p of products) {
    console.log(`\nID: ${p.id}`);
    console.log(`Name: ${p.name}`);
    console.log(`SKU: ${p.sku}`);
    console.log(`url_catalogo: ${p.url_catalogo}`);
    console.log(`colores_disponibles: ${p.colores_disponibles}`);
    console.log(`description: ${p.description}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
