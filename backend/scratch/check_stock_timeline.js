const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: 'b0788d85-78fa-4885-8a3d-98ec5f65256c' }
  });

  console.log(`PRODUCT: ${p.name} (${p.sku})`);
  console.log(`Current DB stock field: ${p.stock}`);
  console.log(`Created At: ${p.createdAt}`);
  console.log(`Updated At: ${p.updatedAt}`);

  // Let's check all activity logs for this product if any
  const logs = await prisma.activityLog.findMany({
    where: {
      entityId: 'b0788d85-78fa-4885-8a3d-98ec5f65256c'
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('ACTIVITY LOGS:', JSON.stringify(logs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
