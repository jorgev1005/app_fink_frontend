const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'jorge.verenzuela@gmail.com' },
    include: { projects: { select: { projectId: true } } }
  });

  if (!user) {
    console.log('USER NOT FOUND');
    return;
  }

  const projectIds = user.projects.map(pu => pu.projectId);

  const accounts = await prisma.account.findMany({
    where: {
      projectId: { in: projectIds }
    },
    include: {
      project: { select: { name: true } }
    }
  });

  const usdAccounts = accounts.filter(a => a.currency === 'USD' || a.name.includes('USD') || a.name.includes('Binance') || a.balanceUsd !== 0 || a.balanceBs < 0);

  const formatted = usdAccounts.map(a => ({
    id: a.id,
    name: a.name,
    isActive: a.isActive,
    currency: a.currency,
    balanceBs: a.balanceBs,
    balanceUsd: a.balanceUsd,
    project: a.project?.name
  }));

  console.table(formatted);
}
main().catch(console.error).finally(() => prisma.$disconnect());
