const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const account = await prisma.account.findFirst({
    where: { name: { contains: 'Caja Chica USD' } }
  });
  console.log('Account Data:', account);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
