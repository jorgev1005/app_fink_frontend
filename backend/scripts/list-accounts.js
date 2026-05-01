const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { code: 'PERS-001' }
  });

  if (!project) {
    console.log('Project PERS-001 not found');
    return;
  }

  const accounts = await prisma.account.findMany({
    where: { projectId: project.id },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
    take: 30
  });

  console.log('Accounts in project PERS-001:');
  console.log(JSON.stringify(accounts, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
