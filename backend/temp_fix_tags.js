const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.transaction.updateMany({
    where: { tags: 'telegram-bot' },
    data: { tags: '["telegram-bot"]' }
  });
  console.log('Fixed:', result.count);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });