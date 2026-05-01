
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accountCode = "1.1.01.009";
  const amountConfig = {
    amount: 91.57, 
    currency: 'USD'
  };

  console.log(`Fixing account ${accountCode} with balance ${amountConfig.amount} ${amountConfig.currency}...`);

  const acc = await prisma.account.findFirst({
    where: { code: accountCode },
    include: { project: true }
  });

  if (!acc) {
    console.error("Account not found.");
    return;
  }

  if (Math.abs(acc.balanceUsd) > 0.01) {
    console.log(`Account already has a balance of ${acc.balanceUsd}. Skipping manual fix.`);
    return;
  }

  const equityAccount = await prisma.account.findFirst({
    where: {
      projectId: acc.projectId,
      type: 'EQUITY'
    }
  });

  const creditAccountId = equityAccount?.id;
  
  if (!creditAccountId) {
    console.error("No Equity account found to balance the transaction. Aborting.");
    return;
  }

  const user = await prisma.user.findFirst({ where: { email: 'admin@admin.com'} });
  const userId = user?.id;

  if (!userId) {
     console.error("Admin user not found. Aborting.");
     return;
  }

  const result = await prisma.$transaction(async (tx) => {
      
      const uniqueSuffix = Date.now().toString().slice(-6);
      const trxCode = `TRX-FIX-${acc.code}-${uniqueSuffix}`;

      const txn = await tx.transaction.create({
        data: {
          code: trxCode,
          type: 'ADJUSTMENT',
          description: `Corrección manual: Saldo inicial para ${acc.name}`,
          date: new Date(),
          currency: amountConfig.currency,
          amount: amountConfig.amount,
          amountBs: 0,
          amountUsd: amountConfig.amount,
          amountEur: 0,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          amountPaid: amountConfig.amount,
          tags: '["correccion"]',
          attachments: '[]',
          project: { connect: { id: acc.projectId as string } }, 
          user: { connect: { id: userId as string } },       // Forced cast
          entries: {
            create: [
              {
                debitAccount: { connect: { id: acc.id } },
                creditAccount: { connect: { id: creditAccountId as string } }, // Forced cast
                debitAmount: amountConfig.amount,
                creditAmount: 0,
                description: 'Saldo inicial (Corrección Manual)',
              }
            ]
          }
        }
      });

      await tx.account.update({
          where: { id: acc.id },
          data: { balanceUsd: { increment: amountConfig.amount } }
      });
      
      await tx.account.update({
          where: { id: creditAccountId },
          data: { balanceUsd: { increment: -amountConfig.amount } } 
      });

      return txn;
  });

  console.log("Fix applied successfully!");
  console.log("Transaction ID:", result.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
