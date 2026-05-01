const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: { contains: 'jorge', mode: 'insensitive' } }
  });
  if (!project) {
    console.log('Project "Jorge Verenzuela" not found.');
    return;
  }
  console.log('Project ID:', project.id);
  
  const account = await prisma.account.findFirst({
    where: {
      projectId: project.id,
      name: { contains: 'Caja Chica USD', mode: 'insensitive' }
    }
  });
  
  if (!account) {
    console.log(`Account "Caja Chica USD" not found in project ${project.name}`);
    return;
  }
  console.log('Account found:', account);
  
  if (account.currency === 'BS') {
    console.log(`Updating account ${account.id} from BS to USD...`);
    const updated = await prisma.account.update({
      where: { id: account.id },
      data: {
        currency: 'USD',
        balanceUsd: account.balanceBs > 0 ? account.balanceBs / 658.3092 : 0, // Roughly $100 if it was 65830.92
        balanceBs: 0
      }
    });
    console.log('Updated account:', updated);
  } else {
    console.log('Account is already in USD.');
  }

  // Find the mis-converted transaction entry to fix it or just inform the user.
  const badEntries = await prisma.transactionEntry.findMany({
    where: {
      debitAccountId: account.id
    },
    include: { transaction: true }
  });

  if (badEntries.length > 0) {
    for (const e of badEntries) {
      if (Number(e.debitAmount) > 20000) {
        console.log(`Found huge BS amount ${e.debitAmount} in transaction ${e.transaction.id} entry ${e.id}, fixing to 100 USD...`);
        await prisma.transactionEntry.update({
          where: { id: e.id },
          data: { debitAmount: 100 }
        });
      }
    }
  }

  console.log('Done.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
