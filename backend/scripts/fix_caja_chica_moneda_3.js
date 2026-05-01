const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  const project = projects.find(p => p.name.toLowerCase().includes('jorge'));
  
  if (!project) return;
  
  const accounts = await prisma.account.findMany({
    where: { projectId: project.id, isActive: true }
  });
  
  const account = accounts.find(a => elName(a.name) === 'caja chica usd');
  
  function elName(name) { return name.toLowerCase().trim(); }
  
  if (!account) return;
  
  console.log('ACTIVE Account found:', account.name, 'ID:', account.id, 'Currency:', account.currency);
  
  if (account.currency === 'BS') {
    const usdAmount = Number(account.balanceBs) > 0 ? 100 : Number(account.balanceUsd);
    await prisma.account.update({
      where: { id: account.id },
      data: { currency: 'USD', balanceUsd: usdAmount, balanceBs: 0 }
    });
    console.log('Converted to USD. Setting balance Usd to:', usdAmount);
  }

  const badEntries = await prisma.transactionEntry.findMany({
    where: { debitAccountId: account.id },
    include: { transaction: true }
  });

  for (const e of badEntries) {
    if (Number(e.debitAmount) > 60000) {
      console.log('Fixing transaction debit entry:', e.id);
      await prisma.transactionEntry.update({
        where: { id: e.id },
        data: { debitAmount: 100 }
      });
      // also check credit entry of the same tx if it belongs to different account, let's leave it as is if origin was $100
    }
  }

  // Recalcular saldo total de la cuenta reconstruyéndolo desde todas sus transaction entries
  console.log('Recalculating exact balances...');
  const allEntries = await prisma.transactionEntry.findMany({
    where: {
      OR: [ { debitAccountId: account.id }, { creditAccountId: account.id } ]
    }
  });
  
  let realBalance = 0;
  for (const en of allEntries) {
     if (en.debitAccountId === account.id) realBalance += Number(en.debitAmount);
     if (en.creditAccountId === account.id) realBalance -= Number(en.creditAmount);
  }
  
  await prisma.account.update({
    where: { id: account.id },
    data: { balanceUsd: realBalance, balanceBs: 0 }
  });
  
  console.log('Final Account USD Balance fixed to:', realBalance);
}
main().catch(console.error).finally(() => prisma.$disconnect());
