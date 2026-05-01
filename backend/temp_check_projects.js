const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', users);
  
  const projects = await prisma.project.findMany();
  console.log('Projects:', projects);
  
  const txs = await prisma.transaction.findMany();
  console.log('Transactions:', txs.length);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });