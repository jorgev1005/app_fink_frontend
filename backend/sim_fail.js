const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const user = await prisma.user.findFirst();
    const proj = await prisma.project.findFirst();

    const txData = {
      code: 'BOT-TEST-FAIL-' + Date.now(),
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
          { debitAccountId: 'non-existent-uuid', debitAmount: 5 },
          { creditAccountId: null, creditAmount: 5 }
        ]
      }
    };

    const newTx = await prisma.transaction.create({ data: txData, include: { entries: true } });
    console.log("SUCCESS:", newTx.id);

  } catch (err) {
    console.log("EXPECTED ERROR:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();
