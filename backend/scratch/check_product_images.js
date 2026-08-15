process.env.DATABASE_URL = "postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb";
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      name: { contains: 'apilable', mode: 'insensitive' }
    }
  });

  console.log('=== PRODUCTOS CON APILABLE EN BASE DE DATOS FINK ===');
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
