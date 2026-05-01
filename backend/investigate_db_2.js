const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- FRUTY ---');
  const fVendor = await prisma.invoice.findMany({ 
    where: { vendor: { name: { contains: 'Fruty' } } }, 
    include: { vendor: true, customer: true, items: true, payments: true } 
  }); 
  console.log(JSON.stringify(fVendor, null, 2)); 

  console.log('--- JHONNY ---'); 
  const j = await prisma.invoice.findMany({ 
    where: { 
      OR: [
        { customer: { name: { contains: 'Jhonny' } } }, 
        { vendor: { name: { contains: 'Jhonny' } } }
      ] 
    }, 
    include: { vendor: true, customer: true, items: true, payments: true } 
  }); 
  console.log(JSON.stringify(j, null, 2)); 

  console.log('--- ALQUILER ---'); 
  const r = await prisma.recurringRule.findMany({ 
    where: { description: { contains: 'Alquiler' } },
    include: { vendor: true, customer: true }
  }); 
  console.log('REGLAS:', JSON.stringify(r, null, 2));

  const rulesIds = r.map(x => x.id);
  const rInstances = await prisma.invoice.findMany({ 
    where: { ruleId: { in: rulesIds } }, 
    include: { vendor: true, customer: true, payments: true } 
  }); 
  console.log('INSTANCIAS ALQUILER:', JSON.stringify(rInstances, null, 2)); 

  const singleInv = await prisma.invoice.findMany({
    where: { code: 'INV-547235' },
    include: { vendor: true, customer: true, payments: true }
  })
  console.log('FACTURA ESPECIFICA INV-547235:', JSON.stringify(singleInv, null, 2));

} 

main().finally(() => prisma.$disconnect());