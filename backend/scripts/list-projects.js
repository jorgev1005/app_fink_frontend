const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const ps = await prisma.project.findMany({take:10});
  console.log(JSON.stringify(ps,null,2));
  await prisma.$disconnect();
}

main().catch(e=>{ console.error(e); prisma.$disconnect(); process.exit(1); });
