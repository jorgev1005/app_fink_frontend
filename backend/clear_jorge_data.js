const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'jorge.verenzuela@gmail.com' },
    include: { projects: { select: { projectId: true } } }
  });

  if (!user) return;

  const projectIds = user.projects.map(pu => pu.projectId);
  
  for (const pid of projectIds) {
    await prisma.payment.deleteMany({where: {projectId: pid}});
    await prisma.invoice.deleteMany({where: {projectId: pid}});
    await prisma.document.deleteMany({where: {projectId: pid}});
    await prisma.transaction.deleteMany({where: {projectId: pid}});
    await prisma.transactionTemplate.deleteMany({where: {projectId: pid}});
    await prisma.recurringRule.deleteMany({where: {projectId: pid}});
    await prisma.account.updateMany({where: {projectId: pid}, data: {balanceBs: 0, balanceUsd: 0, balanceEur: 0}});
    await prisma.transactionCodeSequence.updateMany({where: {projectId: pid}, data: {counter: 0}});
  }
  console.log('Todos los saldos de los proyectos de jorge.verenzuela regresaron a 0 y sus transacciones fueron eliminadas.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
