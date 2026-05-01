const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const occs = await prisma.scheduledOccurrence.findMany({ select: { status: true } });
  console.log(occs.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {}));
}
main().finally(() => prisma.$disconnect());