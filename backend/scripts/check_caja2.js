const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const acc = await prisma.account.findMany({
    where: { name: { contains: 'Caja', mode: 'insensitive' } }
  });
  console.log(acc.map(a => ({ id: a.id, name: a.name, currency: a.currency, active: a.isActive, project: a.projectId })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
