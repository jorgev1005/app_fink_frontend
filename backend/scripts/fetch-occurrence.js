// Simple script to fetch a ScheduledOccurrence (and its invoice) via Prisma
// Usage: node backend/scripts/fetch-occurrence.js <occurrenceId>
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node fetch-occurrence.js <occurrenceId>');
    process.exit(2);
  }

  const occ = await prisma.scheduledOccurrence.findUnique({
    where: { id },
    include: { invoice: true }
  });

  if (!occ) {
    console.log('No se encontró la ocurrencia con id:', id);
    process.exit(0);
  }

  console.log(JSON.stringify(occ, null, 2));
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
