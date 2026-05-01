// Usage: node backend/scripts/fetch-activity-log.js <id> [type]
// type: "pay" (paymentId) or "occ" (occurrenceId). Defaults to "pay".
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(){
  const id = process.argv[2];
  const type = process.argv[3] || 'pay';
  if(!id){
    console.error('Usage: node fetch-activity-log.js <id> [pay|occ]');
    process.exit(2);
  }

  const logs = await prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  const matches = logs.filter(l => {
    try{
      if(type === 'pay'){
        if(l.metadata && typeof l.metadata === 'object' && l.metadata.paymentId === id) return true;
        // sometimes metadata may be stored as string
        if(l.metadata && typeof l.metadata === 'string' && l.metadata.includes(id)) return true;
      }
      if(type === 'occ'){
        if(l.entityId === id) return true;
        if(l.metadata && typeof l.metadata === 'object' && (l.metadata.invoiceId === id || l.metadata.paymentId === id)) return true;
        if(l.metadata && typeof l.metadata === 'string' && l.metadata.includes(id)) return true;
      }

      return false;
    }catch(e){ return false; }
  });

  if(matches.length === 0){
    console.log('No activity_log entries found for', id);
  } else {
    console.log('Found', matches.length, 'entries:');
    for(const m of matches){
      console.log('---');
      console.log('id:', m.id);
      console.log('userId:', m.userId);
      console.log('action:', m.action);
      console.log('entity:', m.entity);
      console.log('entityId:', m.entityId);
      console.log('description:', m.description);
      console.log('ipAddress:', m.ipAddress);
      console.log('userAgent:', m.userAgent);
      console.log('metadata:', JSON.stringify(m.metadata));
      console.log('createdAt:', m.createdAt);
    }
  }

  await prisma.$disconnect();
}

main().catch(err=>{ console.error(err); prisma.$disconnect(); process.exit(1); });
