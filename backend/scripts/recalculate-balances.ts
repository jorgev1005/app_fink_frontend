#!/usr/bin/env ts-node
import prisma from '../src/config/database';

const parseArgs = () => ({ confirm: process.argv.includes('--confirm') });

const recalc = async () => {
  const accounts = await prisma.account.findMany({ select: { id: true, code: true, name: true } });
  const updated: any[] = [];

  for (const a of accounts) {
    const debitsBs = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'BS' } }, _sum: { debitAmount: true } });
    const creditsBs = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'BS' } }, _sum: { creditAmount: true } });
    const balanceBs = Number(debitsBs._sum.debitAmount || 0) - Number(creditsBs._sum.creditAmount || 0);

    const debitsUsd = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'USD' } }, _sum: { debitAmount: true } });
    const creditsUsd = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'USD' } }, _sum: { creditAmount: true } });
    const balanceUsd = Number(debitsUsd._sum.debitAmount || 0) - Number(creditsUsd._sum.creditAmount || 0);

    const debitsEur = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'EUR' } }, _sum: { debitAmount: true } });
    const creditsEur = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'EUR' } }, _sum: { creditAmount: true } });
    const balanceEur = Number(debitsEur._sum.debitAmount || 0) - Number(creditsEur._sum.creditAmount || 0);

    await prisma.account.update({ where: { id: a.id }, data: { balanceBs: balanceBs as any, balanceUsd: balanceUsd as any, balanceEur: balanceEur as any } });
    updated.push({ accountId: a.id, code: a.code, name: a.name, balanceBs, balanceUsd, balanceEur });
  }

  return updated;
};

const main = async () => {
  const args = parseArgs();
  console.log('Recalculate balances script (dry run by default).');
  if (!args.confirm) {
    console.log('Run with --confirm to actually apply updates');
    const preview = await recalc();
    console.log(`Preview: ${preview.length} accounts would be updated. Example (first 5):`);
    console.log(preview.slice(0, 5));
    await prisma.$disconnect();
    process.exit(0);
  }

  try {
    const res = await recalc();
    console.log(`Updated ${res.length} accounts.`);
  } catch (e) {
    console.error('Error during recalculation:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
};

main();
