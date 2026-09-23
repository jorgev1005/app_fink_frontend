const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ocs = await prisma.invoice.findMany({
    where: {
      type: 'BILL',
      notes: { contains: 'Cliente:' }
    }
  });

  console.log(`Found ${ocs.length} purchase orders with 'Cliente:' in notes.`);

  for (const oc of ocs) {
    const cleanedNotes = (oc.notes || '')
      .replace(/\s*-\s*Cliente:\s*[^;\n\r]+/gi, '')
      .replace(/\s*para cliente\s*[^;\n\r]+/gi, '')
      .replace(/Cliente:\s*[^;\n\r]+/gi, '')
      .trim();

    await prisma.invoice.update({
      where: { id: oc.id },
      data: { notes: cleanedNotes }
    });
    console.log(`Updated OC ${oc.code} (${oc.id}): "${cleanedNotes}"`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
