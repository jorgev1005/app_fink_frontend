import prisma from '../config/database';
import { updateAccountBalance } from './account.service';
import { getLatestExchangeRate } from './exchangeRate.service';
import { logActivity } from './activityLog.service';

interface PaymentInput {
  projectId: string;
  userId: string;
  date: Date;
  
  // Amount paid (Source)
  amount: number;
  currency: string; // BS, USD, EUR
  accountId: string; // Source Account (Bank/Cash)
  method: string;
  reference?: string;

  // Target (What are we paying?)
  allocations: {
    invoiceId?: string;
    transactionId?: string;
    amount: number; // Amount to apply to this invoice
  }[];

  // Cross-Currency optional fields
  targetCurrency?: string; // If different from source currency
  exchangeRate?: number; // Conversion rate used
}

export const PaymentService = {
  /**
   * Create a payment with full accounting automation (Smart ERP)
   * Handles Invoice AND Transaction payments.
   */
  async createPayment(input: PaymentInput) {
    const {
      projectId, userId, date, amount, currency, accountId,
      method, reference, allocations, exchangeRate
    } = input;

    // 1. Validate Source Account
    const sourceAccount = await prisma.account.findUnique({ where: { id: accountId } });
    if (!sourceAccount) throw new Error('Source account not found');
    
    // 2. Determine Target (Invoice or Transaction)
    if (allocations.length === 0) throw new Error('Allocations required');
    const firstAlloc = allocations[0];
    
    let targetType: 'INVOICE' | 'TRANSACTION' = 'INVOICE';
    let direction: 'INCOME' | 'EXPENSE' = 'EXPENSE';
    let targetObj: any = null;

    if (firstAlloc.invoiceId) {
        targetObj = await prisma.invoice.findUnique({ where: { id: firstAlloc.invoiceId } });
        if (!targetObj) throw new Error('Target invoice not found');
        direction = targetObj.type === 'BILL' ? 'EXPENSE' : 'INCOME';
        targetType = 'INVOICE';
    } else if (firstAlloc.transactionId) {
        targetObj = await prisma.transaction.findUnique({ where: { id: firstAlloc.transactionId } });
        if (!targetObj) throw new Error('Target transaction not found');
        direction = targetObj.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
        targetType = 'TRANSACTION';
    } else {
        throw new Error('Allocation must have invoiceId or transactionId');
    }

    return await prisma.$transaction(async (tx) => {
      // A. Create Payment Header
      const uniqueSuffix = Date.now().toString().slice(-6);
      const paymentCode = `PAY-${projectId.slice(0, 4)}-${uniqueSuffix}`;

      const payment = await tx.payment.create({
        data: {
            project: { connect: { id: projectId } },
            code: paymentCode,
            date,
            currency,
            amount,
            exchangeRate: exchangeRate || 1,
            method,
            reference,
            status: 'COMPLETED',
            user: { connect: { id: userId } },
            account: { connect: { id: accountId } },
            allocations: {
              create: allocations.map(a => ({
                 invoice: a.invoiceId ? { connect: { id: a.invoiceId } } : undefined,
                 transaction: a.transactionId ? { connect: { id: a.transactionId } } : undefined,
                 allocatedAmount: a.amount 
              }))
            }
        }
      });

      // B. Create Accounting Transaction (The Payment Movement itself)
      // This records the bank movement.
      
      const transactionCode = `TRX-PAY-${uniqueSuffix}`;
      
      const effectiveRate = exchangeRate || 1;
      let amountBs = 0;
      let amountUsd = 0;
      
      if (currency === 'BS') {
          amountBs = amount;
          amountUsd = effectiveRate > 0 ? amount / effectiveRate : 0;
      } else if (currency === 'USD') {
          amountUsd = amount;
          amountBs = amount * effectiveRate;
      }

      // ENTRIES CONSTRUCTION
      const description = `Payment for ${targetObj.code} - ${reference || ''}`;
      // Determine Bank movement direction
      const isExpense = direction === 'EXPENSE';

      const entries: any[] = [];
      // Entry 1: Bank/Cash Movement (Source)
      // If paying expense: Credit Bank (Money Out)
      // If collecting income: Debit Bank (Money In)
      entries.push({
        debitAccountId: isExpense ? undefined : accountId,
        creditAccountId: isExpense ? accountId : undefined,
        debitAmount: isExpense ? 0 : amount, // In transaction currency (Payment Currency)
        creditAmount: isExpense ? amount : 0,
        description: `Bank Movement (${currency})`
      });

      const transaction = await tx.transaction.create({
        data: {
            code: transactionCode,
            projectId,
            userId,
            date,
            type: isExpense ? 'PAYMENT' : 'COLLECTION',
            description,
            reference,
            currency, 
            amount,
            amountBs,
            amountUsd,
            amountEur: 0,
            status: 'COMPLETED',
            paymentStatus: 'PAID',
            amountPaid: amount,
            // Link is established from Payment side via `paymentRecord` usually, 
            // but we can also set it here if relation allows.
            paymentRecord: { connect: { id: payment.id } },
            entries: { create: entries },
            tags: JSON.stringify(["PAYMENT", "AUTO"]),
            attachments: '[]'
        }
      });

      // C. Update Account Balances
      for (const entry of entries) {
         if (entry.debitAccountId) {
             const updateData: any = {};
             if (currency === 'BS') updateData.balanceBs = { increment: amount };
             else if (currency === 'USD') updateData.balanceUsd = { increment: amount };
             else if (currency === 'EUR') updateData.balanceEur = { increment: amount };
             
             await tx.account.update({ where: { id: entry.debitAccountId }, data: updateData });
         }
         
         if (entry.creditAccountId) {
             const updateData: any = {};
             if (currency === 'BS') updateData.balanceBs = { increment: -amount };
             else if (currency === 'USD') updateData.balanceUsd = { increment: -amount };
             else if (currency === 'EUR') updateData.balanceEur = { increment: -amount };
             
             await tx.account.update({ where: { id: entry.creditAccountId }, data: updateData });
         }
      }

      // D. Update Target Status (Invoice or Transaction) FOR EVERY ALLOCATION
      for (const a of allocations) {
        if (a.invoiceId) {
            const inv = await tx.invoice.findUnique({ where: { id: a.invoiceId } });
            if (!inv) continue;
            
            let deduction = a.amount;
            if (inv.currency !== currency && effectiveRate) {
                if (inv.currency === 'USD' && currency === 'BS') deduction = a.amount / effectiveRate;
                else if (inv.currency === 'BS' && currency === 'USD') deduction = a.amount * effectiveRate;
            }
            
            const newOutstanding = Math.max(0, Number(inv.outstanding || inv.total) - deduction);
            const newStatus = newOutstanding < 0.01 ? 'PAID' : 'PARTIALLY_PAID';
            
            await tx.invoice.update({
                where: { id: inv.id },
                data: {
                    status: newStatus,
                    outstanding: newOutstanding
                }
            });
        } else if (a.transactionId) {
            const txn = await tx.transaction.findUnique({ where: { id: a.transactionId } });
            if (!txn) continue;

            let addedPaid = a.amount;
            if (txn.currency !== currency && effectiveRate) {
                if (txn.currency === 'USD' && currency === 'BS') addedPaid = a.amount / effectiveRate;
                else if (txn.currency === 'BS' && currency === 'USD') addedPaid = a.amount * effectiveRate;
            }
            
            const txnAmount = Number((txn as any).amount || 0);
            const currentPaid = Number((txn as any).amountPaid || 0) + addedPaid;
            const normalizedPaid = Math.min(txnAmount, currentPaid);
            const epsilon = 0.01;

            let nextPaymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
            let nextStatus: 'PENDING' | 'COMPLETED' = 'PENDING';

            if (normalizedPaid >= txnAmount - epsilon) {
              nextPaymentStatus = 'PAID';
              nextStatus = 'COMPLETED';
            } else if (normalizedPaid > epsilon) {
              nextPaymentStatus = 'PARTIAL';
            }

            await tx.transaction.update({
                where: { id: txn.id },
              data: {
                amountPaid: normalizedPaid,
                paymentStatus: nextPaymentStatus,
                status: nextStatus
              }
            });
        }
      }

      return payment;
    });
  }
};
