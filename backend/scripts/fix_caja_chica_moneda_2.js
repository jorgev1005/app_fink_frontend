const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  const project = projects.find(p => p.name.toLowerCase().includes('jorge'));
  
  if (!project) {
    console.log('Project "Jorge Verenzuela" not found.');
    return;
  }
  console.log('Project found:', project.name);
  
  const accounts = await prisma.account.findMany({
    where: { projectId: project.id }
  });
  
  const account = accounts.find(a => a.name.toLowerCase().includes('caja chica usd'));
  
  if (!account) {
    console.log(`Account "Caja Chica USD" not found in project ${project.name}`);
    return;
  }
  console.log('Account found:', account.name, 'Currency:', account.currency);
  
  if (account.currency === 'BS') {
    console.log(`Updating account ${account.id} from BS to USD...`);
    const balanceUsdValue = account.balanceBs > 0 ? 100 : account.balanceUsd;
    
    await prisma.account.update({
      where: { id: account.id },
      data: {
        currency: 'USD',
        balanceUsd: balanceUsdValue,
        balanceBs: 0
      }
    });
    console.log('Account currency successfully changed to USD and balance adjusted to:', balanceUsdValue);
  } else {
    console.log('Account is already in USD.');
  }

  // Find the bad transaction entry to fix its debitAmount to 100 
  const badEntries = await prisma.transactionEntry.findMany({
    where: { debitAccountId: account.id },
    include: { transaction: true }
  });

  for (const e of badEntries) {
    // If it recorded ~65830 it's higher than 100
    if (Number(e.debitAmount) > 60000) {
      console.log(`Fixing transaction entry ${e.id} belonging to transaction ${e.transaction.id}... changing ${e.debitAmount} bs to 100 usd`);
      await prisma.transactionEntry.update({
        where: { id: e.id },
        data: { debitAmount: 100 }
      });
    }
  }

  console.log('Fix completed successfully.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
