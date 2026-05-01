
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = '350cc719-d635-400c-b75d-e7b728bbd8bd'; // Inversiones Lucem C.A.
  
  const accounts = await prisma.account.findMany({
    where: { projectId },
    orderBy: { code: 'asc' }
  });

  console.log('Existing Accounts:');
  accounts.forEach(a => console.log(`${a.code} - ${a.name} (${a.type})`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
