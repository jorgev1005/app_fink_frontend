const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function run() { 
  const txResult = await prisma.$transaction(async (prisma) => {
      // 1. Rollback Lucem Accounts
      await prisma.account.update({
          where: { id: 'c197d0ea-41f6-4732-aa8c-d16ac714c0ac' }, // Lucem Banesco
          data: { balanceBs: { decrement: 6209 } }
      });
      await prisma.account.update({
          where: { id: 'cf085540-0081-43a0-92a7-0f3848efdc66' }, // Lucem Binance
          data: { balanceUsd: { increment: 10 } }
      });

      // 2. Apply to Personal Accounts
      await prisma.account.update({
          where: { id: 'ce7146b6-7fd9-472e-a643-73da4646c8d9' }, // Personal Banesco
          data: { balanceBs: { increment: 6209 } }
      });
      await prisma.account.update({
          where: { id: 'b60532d2-77c8-4e3d-8d63-dd22b72c05cf' }, // Personal Binance
          data: { balanceUsd: { decrement: 10 } }
      });

      // 3. Update TransactionEntries
      await prisma.transactionEntry.update({
          where: { id: '474c3da4-48e0-46f0-add4-4cd96be325f5' },
          data: { debitAccountId: 'ce7146b6-7fd9-472e-a643-73da4646c8d9' }
      });
      
      await prisma.transactionEntry.update({
          where: { id: '24c09062-aac4-4880-ad99-38b89164b840' },
          data: { creditAccountId: 'b60532d2-77c8-4e3d-8d63-dd22b72c05cf' }
      });

      return "Balances reajustados exitosamente";
  });

  console.log(txResult);

  // Retrieve states correctly after
  const updatedAccounts = await prisma.account.findMany({
      where: {
          id: { in: ['c197d0ea-41f6-4732-aa8c-d16ac714c0ac', 'cf085540-0081-43a0-92a7-0f3848efdc66', 'ce7146b6-7fd9-472e-a643-73da4646c8d9', 'b60532d2-77c8-4e3d-8d63-dd22b72c05cf'] }
      },
      select: { id: true, name: true, projectId: true, balanceBs: true, balanceUsd: true }
  });
  console.log(updatedAccounts);

} 
run().catch(console.error).finally(() => prisma.$disconnect());