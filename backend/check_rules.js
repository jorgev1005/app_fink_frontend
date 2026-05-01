
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRules() {
  const rules = await prisma.recurringRule.findMany({
    where: {
      OR: [
        { name: { contains: 'prueba de cumplimiento' } },
        { name: { contains: 'prueba de cumplim' } }
      ]
    }
  });

  console.log('Found rules:', rules.length);
  for (const r of rules) {
    console.log('------------------------------------------------');
    console.log(`ID: ${r.id}`);
    console.log(`Name: ${r.name}`);
    console.log(`Next Run At: ${r.nextRunAt}`);

    // Check for occurrences linked to this rule
    const occurrences = await prisma.scheduledOccurrence.findMany({
      where: { recurringRuleId: r.id },
      include: { invoice: true }
    });
    console.log(`Occurrences: ${occurrences.length}`);
    occurrences.forEach(occ => {
      console.log(` - Occ: ${occ.scheduledFor}, Status: ${occ.status}, InvoiceId: ${occ.invoiceId}`);
      if (occ.invoice) {
        console.log(`   -> Invoice Code: ${occ.invoice.code}, Status: ${occ.invoice.status}`);
      } else {
        console.log(`   -> Invoice NOT FOUND linked to occurrence`);
      }
    });
  }
}

checkRules()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
