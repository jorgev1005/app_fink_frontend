import { Request, Response } from 'express';
import prisma from '../config/database';

// Recalculate balances for all accounts based on transaction entries per currency
export const recalculateBalancesEndpoint = async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({ select: { id: true, code: true, name: true } });
    const updated: any[] = [];

    for (const a of accounts) {
      // BS
      const debitsBs = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'BS' } }, _sum: { debitAmount: true } });
      const creditsBs = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'BS' } }, _sum: { creditAmount: true } });
      const balanceBs = Number(debitsBs._sum.debitAmount || 0) - Number(creditsBs._sum.creditAmount || 0);

      // USD
      const debitsUsd = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'USD' } }, _sum: { debitAmount: true } });
      const creditsUsd = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'USD' } }, _sum: { creditAmount: true } });
      const balanceUsd = Number(debitsUsd._sum.debitAmount || 0) - Number(creditsUsd._sum.creditAmount || 0);

      // EUR
      const debitsEur = await prisma.transactionEntry.aggregate({ where: { debitAccountId: a.id, transaction: { currency: 'EUR' } }, _sum: { debitAmount: true } });
      const creditsEur = await prisma.transactionEntry.aggregate({ where: { creditAccountId: a.id, transaction: { currency: 'EUR' } }, _sum: { creditAmount: true } });
      const balanceEur = Number(debitsEur._sum.debitAmount || 0) - Number(creditsEur._sum.creditAmount || 0);

      await prisma.account.update({ where: { id: a.id }, data: { balanceBs: balanceBs as any, balanceUsd: balanceUsd as any, balanceEur: balanceEur as any } });

      updated.push({ accountId: a.id, code: a.code, name: a.name, balanceBs, balanceUsd, balanceEur });
    }

    res.json({ success: true, updatedCount: updated.length, updated });
  } catch (error: any) {
    console.error('recalculateBalances error:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const restartApp = async (req: Request, res: Response) => {
  try {
    // Respond first so the client knows the command was received
    res.json({ success: true, message: 'Restarting application...' });
    
    // Give time to send the response before exiting
    setTimeout(() => {
      console.log('Restarting application via process.exit...');
      process.exit(0); 
    }, 1000);
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Recalculate balances for all accounts based on transaction entries
export const recalculateBalances = async (req: Request, res: Response) => {
  try {
    // Set all balances to zero first
    await prisma.account.updateMany({ data: { balanceBs: 0, balanceUsd: 0, balanceEur: 0 } });

    // Aggregate sums from transaction entries grouped by account and currency
    // We'll sum debitAmount - creditAmount for each account to get net change
    const entries = await prisma.transactionEntry.findMany({
      include: { transaction: true }
    });

    const accountSums: Record<string, { bs: number; usd: number; eur: number }> = {};

    for (const e of entries) {
      const currency = e.transaction.currency;
      // debit account
      if (e.debitAccountId) {
        accountSums[e.debitAccountId] = accountSums[e.debitAccountId] || { bs: 0, usd: 0, eur: 0 };
        const v = Number(e.debitAmount || 0);
        if (currency === 'BS') accountSums[e.debitAccountId].bs += v;
        else if (currency === 'USD') accountSums[e.debitAccountId].usd += v;
        else if (currency === 'EUR') accountSums[e.debitAccountId].eur += v;
      }
      // credit account (subtract)
      if (e.creditAccountId) {
        accountSums[e.creditAccountId] = accountSums[e.creditAccountId] || { bs: 0, usd: 0, eur: 0 };
        const v = Number(e.creditAmount || 0);
        if (currency === 'BS') accountSums[e.creditAccountId].bs -= v;
        else if (currency === 'USD') accountSums[e.creditAccountId].usd -= v;
        else if (currency === 'EUR') accountSums[e.creditAccountId].eur -= v;
      }
    }

    // Apply updates in batches
    const updates = Object.entries(accountSums).map(([accountId, sums]) =>
      prisma.account.update({ where: { id: accountId }, data: { balanceBs: sums.bs, balanceUsd: sums.usd, balanceEur: sums.eur } })
    );

    await Promise.all(updates);

    res.json({ success: true, message: 'Balances recalculated', updatedAccounts: updates.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
