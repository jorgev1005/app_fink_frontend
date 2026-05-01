const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contacts = await prisma.contactPerson.findMany();
  
  // FRUTY
  const cFruty = contacts.find(c => c.name && c.name.toLowerCase().includes('fruty'));
  const fVendor = cFruty ? await prisma.invoice.findMany({ 
    where: { vendorId: cFruty.id }, 
    include: { payments: true } 
  }) : [];
  console.log('--- FRUTY ---');
  console.log(JSON.stringify(fVendor, null, 2));

  // JHONNY
  const cJhonny = contacts.find(c => c.name && c.name.toLowerCase().includes('jhonny'));
  const j = cJhonny ? await prisma.invoice.findMany({ 
    where: { 
      OR: [{ customerId: cJhonny.id }, { vendorId: cJhonny.id }] 
    }, 
    include: { payments: true } 
  }) : [];
  console.log('--- JHONNY ---');
  console.log(JSON.stringify(j, null, 2));

  // ALQUILER
  const r = await prisma.recurringRule.findMany({ 
    where: { description: { contains: 'Alquiler' } } 
  });
  console.log('--- ALQUILER ---');
  console.log('REGLAS:', JSON.stringify(r, null, 2));

  const rInstances = await prisma.invoice.findMany({ 
    where: { recurringRuleId: { in: r.map(x => x.id) } }, 
    include: { payments: true } 
  });
  console.log('INSTANCIAS ALQUILER:', JSON.stringify(rInstances, null, 2));

  // ALL INVOICES SUMMARY (JUST TO BE SAFE)
  const stats = await prisma.invoice.groupBy({
    by: ['type', 'status'],
    _count: {
       id: true
    }
  });
  console.log('--- STATS ---');
  console.log(JSON.stringify(stats, null, 2));

  const countByRule = await prisma.invoice.groupBy({
    by: ['recurringRuleId'],
    _count: {
       id: true
    },
    where: { recurringRuleId: { not: null } }
  });
  console.log('--- RECURRING INVOICES ---');
  console.log(JSON.stringify(countByRule, null, 2));
}

main().finally(() => prisma.$disconnect());