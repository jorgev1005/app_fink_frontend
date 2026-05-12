const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb?schema=public'
    }
  }
});

async function main() {
  const tx = await prisma.transaction.findFirst({
    where: {
      OR: [
        { reference: { contains: 'BOT' } },
        { description: { contains: 'BOT' } },
        { notes: { contains: 'BOT' } },
        { reference: { contains: '1778174661578' } },
        { notes: { contains: '1778174661578' } }
      ]
    },
    include: {
      project: true,
      entries: {
        include: {
          debitAccount: true,
          creditAccount: true
        }
      }
    },
    orderBy: { date: 'desc' }
  });
  console.log(JSON.stringify(tx, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());