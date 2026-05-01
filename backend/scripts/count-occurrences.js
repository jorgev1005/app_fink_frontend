const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const total = await prisma.scheduledOccurrence.count();
    console.log('Total scheduled occurrences:', total);

    const byStatus = await prisma.scheduledOccurrence.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    console.log('By status:');
    for(const b of byStatus) console.log(`  ${b.status}: ${b._count.id}`);

    await prisma.$disconnect();
  }catch(e){
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
