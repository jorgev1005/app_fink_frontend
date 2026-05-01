const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    const proj = await prisma.project.findFirst();
    const acc1 = await prisma.account.findFirst();
    const acc2 = await prisma.account.findFirst({ skip: 1 });

    const txData = {
      code: 'BOT-TEST-' + Date.now(),
      date: new Date(),
      type: 'TRANSFER',
      description: 'Test transfer',
      projectId: proj.id,
      contactPersonId: null,
      currency: 'USD',
      amount: 5,
      amountBs: 250,
      amountUsd: 5,
      amountEur: 5,
      exchangeRateId: null,
      userId: user.id,
      category: 'General',
      tags: '["telegram-bot"]',
      attachments: '[]',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      amountPaid: 5,
      entries: {
        create: [
          { debitAccountId: acc1.id, debitAmount: 5 },
          { creditAccountId: acc2.id, creditAmount: 5 }
        ]
      }
    };

    console.log("SENDING:", JSON.stringify(txData, null, 2));
    const newTx = await prisma.transaction.create({ data: txData, include: { entries: true } });
    console.log("SUCCESS:", newTx.id);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
