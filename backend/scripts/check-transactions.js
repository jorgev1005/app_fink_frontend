const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.transaction.findMany({ take: 10, include: { categoryRef: true } });
    console.log(JSON.stringify(rows.map(r => ({ id: r.id, code: r.code, category: r.category, categoryId: r.categoryId, categoryRef: r.categoryRef ? { id: r.categoryRef.id, name: r.categoryRef.name } : null })), null, 2));
  } catch (err) {
    console.error('Error checking transactions:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
