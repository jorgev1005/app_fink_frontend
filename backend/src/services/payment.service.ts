import prisma from '../config/database';
import { updateAccountBalance } from './account.service';
import { getLatestExchangeRate } from './exchangeRate.service';
import { logActivity } from './activityLog.service';
import { calculateInvoiceProfitability } from './profitability.service';

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
             const acc = await tx.account.findUnique({ where: { id: entry.debitAccountId } });
             if (acc) {
                 const accCurrency = acc.currency || 'USD';
                 let convertedAmount = amount;
                 if (currency !== accCurrency) {
                     if (currency === 'USD' && accCurrency === 'BS') {
                         convertedAmount = amount * effectiveRate;
                     } else if (currency === 'BS' && accCurrency === 'USD') {
                         convertedAmount = effectiveRate > 0 ? amount / effectiveRate : 0;
                     }
                 }
                 const updateData: any = {};
                 if (accCurrency === 'BS') updateData.balanceBs = { increment: convertedAmount };
                 else if (accCurrency === 'USD') updateData.balanceUsd = { increment: convertedAmount };
                 else if (accCurrency === 'EUR') updateData.balanceEur = { increment: convertedAmount };
                 
                 await tx.account.update({ where: { id: entry.debitAccountId }, data: updateData });
             }
         }
         
         if (entry.creditAccountId) {
             const acc = await tx.account.findUnique({ where: { id: entry.creditAccountId } });
             if (acc) {
                 const accCurrency = acc.currency || 'USD';
                 let convertedAmount = amount;
                 if (currency !== accCurrency) {
                     if (currency === 'USD' && accCurrency === 'BS') {
                         convertedAmount = amount * effectiveRate;
                     } else if (currency === 'BS' && accCurrency === 'USD') {
                         convertedAmount = effectiveRate > 0 ? amount / effectiveRate : 0;
                     }
                 }
                 const updateData: any = {};
                 if (accCurrency === 'BS') updateData.balanceBs = { increment: -convertedAmount };
                 else if (accCurrency === 'USD') updateData.balanceUsd = { increment: -convertedAmount };
                 else if (accCurrency === 'EUR') updateData.balanceEur = { increment: -convertedAmount };
                 
                 await tx.account.update({ where: { id: entry.creditAccountId }, data: updateData });
             }
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

            // Keep the corresponding posting transaction in sync
            const postingTxn = await tx.transaction.findFirst({
              where: {
                projectId: inv.projectId,
                reference: inv.code,
                type: inv.type === 'BILL' ? 'EXPENSE' : 'INCOME',
                status: 'COMPLETED'
              }
            });

            if (postingTxn) {
              let addedPaid = a.amount;
              if (postingTxn.currency !== currency && effectiveRate) {
                  if (postingTxn.currency === 'USD' && currency === 'BS') addedPaid = a.amount / effectiveRate;
                  else if (postingTxn.currency === 'BS' && currency === 'USD') addedPaid = a.amount * effectiveRate;
              }
              
              const txnAmount = Number(postingTxn.amount || 0);
              const currentPaid = Number(postingTxn.amountPaid || 0) + addedPaid;
              const normalizedPaid = Math.min(txnAmount, currentPaid);
              const epsilon = 0.01;

              let nextPaymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';

              if (normalizedPaid >= txnAmount - epsilon) {
                nextPaymentStatus = 'PAID';
              } else if (normalizedPaid > epsilon) {
                nextPaymentStatus = 'PARTIAL';
              }

              await tx.transaction.update({
                where: { id: postingTxn.id },
                data: {
                  amountPaid: normalizedPaid,
                  paymentStatus: nextPaymentStatus
                }
              });
            }

            if (newStatus === 'PAID') {
                await calculateInvoiceProfitability(inv.id, tx);
            }
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
  },

  /**
   * Revert / Delete a payment completely
   * Restores invoice/transaction outstanding amounts, reverses account balances,
   * deletes accounting transactions and removes payment allocations.
   */
  async deletePayment(paymentId: string, userId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        allocations: {
          include: {
            invoice: true,
            transaction: true
          }
        },
        transaction: {
          include: {
            entries: true
          }
        },
        account: true
      }
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Revert bank account balances if accounting transaction exists
      if (payment.transaction && payment.transaction.entries) {
        for (const entry of payment.transaction.entries) {
          // Revert debit (money in was added -> subtract it with CREDIT)
          if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
            const acc = await tx.account.findUnique({ where: { id: entry.debitAccountId } });
            if (acc) {
              const accCurrency = (acc.currency || payment.currency) as any;
              await updateAccountBalance(entry.debitAccountId, accCurrency, Number(entry.debitAmount), 'CREDIT');
            }
          }
          // Revert credit (money out was subtracted -> add it back with DEBIT)
          if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
            const acc = await tx.account.findUnique({ where: { id: entry.creditAccountId } });
            if (acc) {
              const accCurrency = (acc.currency || payment.currency) as any;
              await updateAccountBalance(entry.creditAccountId, accCurrency, Number(entry.creditAmount), 'DEBIT');
            }
          }
        }

        // Delete payment transaction entries and transaction
        await tx.transactionEntry.deleteMany({
          where: { transactionId: payment.transaction.id }
        });
        await tx.transaction.delete({
          where: { id: payment.transaction.id }
        });
      } else if (payment.accountId && payment.amount > 0) {
        // Fallback balance restoration if simple payment had accountId
        const acc = await tx.account.findUnique({ where: { id: payment.accountId } });
        if (acc) {
          const accCurrency = (acc.currency || payment.currency) as any;
          // By default, for sales payments entering account, revert with CREDIT
          await updateAccountBalance(payment.accountId, accCurrency, Number(payment.amount), 'CREDIT');
        }
      }

      // Also check if any standalone transaction was created referencing this payment code
      const standaloneTxns = await tx.transaction.findMany({
        where: {
          projectId: payment.projectId,
          reference: payment.code
        },
        include: { entries: true }
      });

      for (const stxn of standaloneTxns) {
        for (const entry of stxn.entries) {
          if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
            const acc = await tx.account.findUnique({ where: { id: entry.debitAccountId } });
            if (acc) {
              await updateAccountBalance(entry.debitAccountId, (acc.currency || stxn.currency) as any, Number(entry.debitAmount), 'CREDIT');
            }
          }
          if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
            const acc = await tx.account.findUnique({ where: { id: entry.creditAccountId } });
            if (acc) {
              await updateAccountBalance(entry.creditAccountId, (acc.currency || stxn.currency) as any, Number(entry.creditAmount), 'DEBIT');
            }
          }
        }
        await tx.transactionEntry.deleteMany({ where: { transactionId: stxn.id } });
        await tx.transaction.delete({ where: { id: stxn.id } });
      }

      // 2. Restore Target Invoices
      for (const alloc of payment.allocations) {
        if (alloc.invoiceId && alloc.invoice) {
          const inv = alloc.invoice;
          const effectiveRate = payment.exchangeRate || 1;
          let restoreAmount = alloc.allocatedAmount;

          // If allocation was recorded in payment currency, convert to invoice currency
          if (inv.currency !== payment.currency && effectiveRate > 0) {
            if (inv.currency === 'USD' && payment.currency === 'BS') {
              restoreAmount = alloc.allocatedAmount / effectiveRate;
            } else if (inv.currency === 'BS' && payment.currency === 'USD') {
              restoreAmount = alloc.allocatedAmount * effectiveRate;
            }
          }

          const newOutstanding = Math.min(Number(inv.total), Number(inv.outstanding || 0) + restoreAmount);
          const newStatus = newOutstanding >= Number(inv.total) - 0.01 
            ? 'POSTED' 
            : (newOutstanding <= 0.01 ? 'PAID' : 'PARTIALLY_PAID');

          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              outstanding: newOutstanding,
              status: newStatus
            }
          });

          // Sync posting transaction if present
          const postingTxn = await tx.transaction.findFirst({
            where: {
              projectId: inv.projectId,
              reference: inv.code,
              type: inv.type === 'BILL' ? 'EXPENSE' : 'INCOME',
              status: 'COMPLETED'
            }
          });

          if (postingTxn) {
            let txnRestore = alloc.allocatedAmount;
            if (postingTxn.currency !== payment.currency && effectiveRate > 0) {
              if (postingTxn.currency === 'USD' && payment.currency === 'BS') txnRestore = alloc.allocatedAmount / effectiveRate;
              else if (postingTxn.currency === 'BS' && payment.currency === 'USD') txnRestore = alloc.allocatedAmount * effectiveRate;
            }

            const currentPaid = Math.max(0, Number(postingTxn.amountPaid || 0) - txnRestore);
            const txnAmount = Number(postingTxn.amount || 0);
            const epsilon = 0.01;

            let nextPaymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
            if (currentPaid >= txnAmount - epsilon) {
              nextPaymentStatus = 'PAID';
            } else if (currentPaid > epsilon) {
              nextPaymentStatus = 'PARTIAL';
            }

            await tx.transaction.update({
              where: { id: postingTxn.id },
              data: {
                amountPaid: currentPaid,
                paymentStatus: nextPaymentStatus
              }
            });
          }
        } else if (alloc.transactionId && alloc.transaction) {
          const txn = alloc.transaction;
          const effectiveRate = payment.exchangeRate || 1;
          let txnRestore = alloc.allocatedAmount;
          if (txn.currency !== payment.currency && effectiveRate > 0) {
            if (txn.currency === 'USD' && payment.currency === 'BS') txnRestore = alloc.allocatedAmount / effectiveRate;
            else if (txn.currency === 'BS' && payment.currency === 'USD') txnRestore = alloc.allocatedAmount * effectiveRate;
          }

          const currentPaid = Math.max(0, Number(txn.amountPaid || 0) - txnRestore);
          const txnAmount = Number(txn.amount || 0);
          const epsilon = 0.01;

          let nextPaymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PENDING';
          if (currentPaid >= txnAmount - epsilon) {
            nextPaymentStatus = 'PAID';
          } else if (currentPaid > epsilon) {
            nextPaymentStatus = 'PARTIAL';
          }

          await tx.transaction.update({
            where: { id: txn.id },
            data: {
              amountPaid: currentPaid,
              paymentStatus: nextPaymentStatus,
              status: currentPaid <= epsilon ? 'PENDING' : txn.status
            }
          });
        }
      }

      // 3. Delete payment allocations and payment header
      await tx.paymentAllocation.deleteMany({
        where: { paymentId: payment.id }
      });

      await tx.payment.delete({
        where: { id: payment.id }
      });

      return {
        success: true,
        revertedPaymentCode: payment.code,
        allocationsCount: payment.allocations.length
      };
    });
  }
};
