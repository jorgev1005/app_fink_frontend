const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async ()=>{
  try{
    const project = await prisma.project.findFirst();
    const user = await prisma.user.findFirst();
    if(!project) throw new Error('No project found in DB');
    if(!user) throw new Error('No user found in DB');

    // create a simple recurring rule to attach the occurrence
    const rule = await prisma.recurringRule.create({ data: {
      projectId: project.id,
      name: 'manual-ui-pending-rule',
      description: 'Rule to create a single pending occurrence for UI testing',
      amount: 10,
      currency: 'USD',
      entriesTemplate: [{ quantity:1, unitPrice:10, description: 'UI test' }],
      frequency: 'MONTHLY',
      interval: 1,
      startDate: new Date(),
      nextRunAt: new Date(),
      isActive: true,
      timezone: 'America/Caracas',
      createdBy: user.id
    }});

    const inv = await prisma.invoice.create({ data: {
      projectId: project.id,
      code: `INV-UI-${Date.now()}`,
      type: 'BILL',
      issueDate: new Date(),
      dueDate: new Date(),
      currency: 'USD',
      total: 10,
      outstanding: 10,
      lines: [{ quantity:1, unitPrice:10, description: 'UI test' }],
      createdBy: user.id,
      recurringRuleId: rule.id
    }});

    const occ = await prisma.scheduledOccurrence.create({ data: {
      recurringRuleId: rule.id,
      scheduledFor: new Date(),
      status: 'PENDING',
      invoiceId: inv.id
    }});

    console.log('Created pending occurrence:', occ.id);
    console.log('Invoice id:', inv.id);
    console.log('Rule id:', rule.id);

    process.exit(0);
  }catch(err){
    console.error(err);
    process.exit(1);
  } finally { await prisma.$disconnect(); }
})();
