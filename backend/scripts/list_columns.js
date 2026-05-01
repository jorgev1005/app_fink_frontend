const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='transactions' ORDER BY ordinal_position;`;
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
