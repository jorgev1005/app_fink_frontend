const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const logs = await prisma.activityLog.findMany({ where: { entity: 'ScheduledOccurrence' }, orderBy: { createdAt: 'desc' }, take: 50 });
    console.log('Found', logs.length, 'entries for entity ScheduledOccurrence');
    for(const l of logs){
      console.log('---');
      console.log('id:', l.id);
      console.log('userId:', l.userId);
      console.log('action:', l.action);
      console.log('entity:', l.entity);
      console.log('entityId:', l.entityId);
      console.log('description:', l.description);
      console.log('ipAddress:', l.ipAddress);
      console.log('userAgent:', l.userAgent);
      console.log('metadata:', JSON.stringify(l.metadata));
      console.log('createdAt:', l.createdAt);
    }
  }catch(e){ console.error(e); process.exit(1); }
  finally { await prisma.$disconnect(); }
})();
