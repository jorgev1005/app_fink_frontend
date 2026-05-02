const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://grupoal1_finkuser:H3,z,gsjh7VxdVd_@localhost:5432/grupoal1_finkdb?schema=public'
    }
  }
});

async function main() {
  const accounts = await prisma.account.findMany({
    select: { name: true, currency: true, balanceBs: true, balanceUsd: true, isActive: true }
  });
  console.log(JSON.stringify(accounts.filter(a => a.balanceBs !== 0 || a.balanceUsd !== 0), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
