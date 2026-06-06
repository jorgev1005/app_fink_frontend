import prisma from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { updateAccountBalance } from './account.service';
import { convertCurrency, getLatestExchangeRate } from './exchangeRate.service';

export const calculateNextChargeDate = (currentDate: Date, frequency: string): Date => {
  const nextDate = new Date(currentDate);
  switch (frequency) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'WEEKLY':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'BIWEEKLY':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }
  return nextDate;
};

export const createLoan = async (data: any, userId: string) => {
  const {
    projectId,
    name,
    contactId,
    currency,
    principalAmount,
    interestRate,
    interestFrequency,
    startDate,
    paymentDay,
    exchangeRate,
    destinationAccountId // The asset account that received the money (e.g. Bank)
  } = data;

  if (!projectId || !name || !principalAmount) {
    throw new Error('Missing required fields for loan');
  }

  // 1. Create a logical Liability Account for this loan
  const liabilityAccount = await prisma.account.create({
    data: {
      projectId,
      code: `PAS-LOAN-${uuidv4().substring(0, 6)}`,
      name: `CXP Préstamo: ${name}`,
      type: 'LIABILITY',
      subType: 'OTHER_LIABILITIES',
      currency: currency || 'USD',
      description: 'Auto-generated liability account for loan',
      isActive: true
    }
  });

  const parsedStartDate = startDate ? new Date(startDate) : new Date();

  // 2. Create the Loan record
  const loan = await prisma.loan.create({
    data: {
      projectId,
      contactId,
      name,
      currency: currency || 'USD',
      principalAmount: Number(principalAmount),
      remainingCapital: Number(principalAmount),
      interestRate: Number(interestRate || 0),
      interestFrequency: interestFrequency || 'WEEKLY',
      startDate: parsedStartDate,
      paymentDay: paymentDay || null,
      exchangeRate: currency === 'BS' && exchangeRate ? Number(exchangeRate) : null,
      nextChargeDate: calculateNextChargeDate(parsedStartDate, interestFrequency || 'WEEKLY'),
      linkedAccountId: liabilityAccount.id
    }
  });

  // 3. Optional: Create the initial Transaction to reflect the cash inflow 
  // ONLY if a destination asset account is provided.
  if (destinationAccountId) {
    const tx = await prisma.transaction.create({
      data: {
        code: `TR-LOAN-${uuidv4().substring(0, 6)}`,
        projectId,
        userId,
        type: 'INCOME',
        date: parsedStartDate,
        description: `Desembolso de Préstamo a favor: ${name}`,
        amount: Number(principalAmount),
        currency: currency || 'USD',
        amountBs: currency === 'BS' ? Number(principalAmount) : (exchangeRate ? Number(principalAmount) * Number(exchangeRate) : Number(principalAmount) * 40),
        amountUsd: currency === 'USD' ? Number(principalAmount) : (currency === 'BS' && exchangeRate ? Number(principalAmount) / Number(exchangeRate) : 0), 
        amountEur: currency === 'EUR' ? Number(principalAmount) : 0,
        status: 'COMPLETED',
        attachments: '[]',
        tags: '["loan_disbursement"]',
        entries: {
          create: [
            {
              debitAccountId: destinationAccountId,
              debitAmount: Number(principalAmount),
            },
            {
              creditAccountId: liabilityAccount.id,
              creditAmount: Number(principalAmount),
            }
          ]
        }
      }
    });

    // Actualizar balances
    try {
      const destAccount = await prisma.account.findUnique({ where: { id: destinationAccountId } });
      const destCurrency = destAccount?.currency || currency || 'USD';
      const convertedDebit = await convertCurrency(Number(principalAmount), (currency || 'USD') as any, destCurrency as any);
      await updateAccountBalance(destinationAccountId, destCurrency as any, convertedDebit, 'DEBIT');

      const liabCurrency = liabilityAccount.currency || currency || 'USD';
      const convertedCredit = await convertCurrency(Number(principalAmount), (currency || 'USD') as any, liabCurrency as any);
      await updateAccountBalance(liabilityAccount.id, liabCurrency as any, convertedCredit, 'CREDIT');
    } catch (balanceErr) {
      console.error('[createLoan] Error updating balances:', balanceErr);
    }
  }

  return loan;
};

export const deleteLoan = async (loanId: string) => {
  const loan = await prisma.loan.findUnique({ 
    where: { id: loanId },
    include: { payments: true }
  });
  if (!loan) throw new Error("Préstamo no encontrado");

  // Buscamos si existe la transacción de desembolso creada
  const disbursementTx = await prisma.transaction.findFirst({
    where: {
      projectId: loan.projectId,
      type: 'INCOME',
      description: `Desembolso de Préstamo a favor: ${loan.name}`
    },
    include: { entries: true }
  });

  // Cargar cargos para recolectar facturas de intereses asociadas
  const charges = await prisma.loanCharge.findMany({
    where: { loanId }
  });
  const interestInvoiceIds = charges.map(c => c.invoiceId).filter(Boolean) as string[];

  // Obtener tasas de cambio actuales para conversiones síncronas en la transacción
  const exchangeRate = await getLatestExchangeRate('BCV');
  
  const conv = (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    const usdToBs = exchangeRate ? Number(exchangeRate.usdToBs || 0) : 0;
    const eurToBs = exchangeRate ? Number(exchangeRate.eurToBs || 0) : 0;
    const eurToUsd = exchangeRate ? Number(exchangeRate.eurToUsd || 0) : 0;

    if (from === 'BS' && to === 'USD' && usdToBs) return amount / usdToBs;
    if (from === 'BS' && to === 'EUR' && eurToBs) return amount / eurToBs;
    if (from === 'USD' && to === 'BS' && usdToBs) return amount * usdToBs;
    if (from === 'EUR' && to === 'BS' && eurToBs) return amount * eurToBs;
    if (from === 'USD' && to === 'EUR' && eurToUsd) return amount / eurToUsd;
    if (from === 'EUR' && to === 'USD' && eurToUsd) return amount * eurToUsd;

    return amount;
  };

  await prisma.$transaction(async (tx) => {
    // Helper local transaccional
    const updateBalanceInTx = async (accountId: string, currency: string, amount: number, operation: 'DEBIT' | 'CREDIT') => {
      const increment = operation === 'DEBIT' ? amount : -amount;
      const updateData: any = {};
      if (currency === 'BS') updateData.balanceBs = { increment };
      else if (currency === 'USD') updateData.balanceUsd = { increment };
      else if (currency === 'EUR') updateData.balanceEur = { increment };

      await tx.account.update({ where: { id: accountId }, data: updateData });
    };

    // 1. Revertir y borrar pagos del préstamo
    for (const payment of loan.payments) {
      if (payment.transactionId) {
        const transaction = await tx.transaction.findUnique({
          where: { id: payment.transactionId },
          include: { entries: { include: { debitAccount: true, creditAccount: true } } }
        });

        if (transaction) {
          for (const entry of transaction.entries) {
            if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
              const acctCurrency = entry.debitAccount?.currency || transaction.currency;
              const converted = conv(Number(entry.debitAmount), transaction.currency, acctCurrency);
              await updateBalanceInTx(entry.debitAccountId, acctCurrency, converted, 'CREDIT');
            }
            if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
              const acctCurrency = entry.creditAccount?.currency || transaction.currency;
              const converted = conv(Number(entry.creditAmount), transaction.currency, acctCurrency);
              await updateBalanceInTx(entry.creditAccountId, acctCurrency, converted, 'DEBIT');
            }
          }
          await tx.transaction.delete({ where: { id: payment.transactionId } });
        }
      }
    }

    // 2. Revertir y borrar la transacción de desembolso
    if (disbursementTx) {
      for (const entry of disbursementTx.entries) {
        if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
          const debitAcct = await tx.account.findUnique({ where: { id: entry.debitAccountId } });
          const acctCurrency = debitAcct?.currency || disbursementTx.currency;
          const converted = conv(Number(entry.debitAmount), disbursementTx.currency, acctCurrency);
          await updateBalanceInTx(entry.debitAccountId, acctCurrency, converted, 'CREDIT');
        }
        if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
          const creditAcct = await tx.account.findUnique({ where: { id: entry.creditAccountId } });
          const acctCurrency = creditAcct?.currency || disbursementTx.currency;
          const converted = conv(Number(entry.creditAmount), disbursementTx.currency, acctCurrency);
          await updateBalanceInTx(entry.creditAccountId, acctCurrency, converted, 'DEBIT');
        }
      }
      await tx.transaction.delete({ where: { id: disbursementTx.id } });
    }

    // 3. Eliminar facturas de intereses asociadas
    if (interestInvoiceIds.length > 0) {
      await tx.invoice.deleteMany({
        where: { id: { in: interestInvoiceIds } }
      });
    }

    // 4. Borrar el préstamo (cascada LoanPayment y LoanCharge)
    await tx.loan.delete({ where: { id: loanId } });

    // 5. Borrar la cuenta pasivo "CXP Préstamo"
    if (loan.linkedAccountId) {
      await tx.account.delete({ where: { id: loan.linkedAccountId } });
    }
  });

  return { success: true };
};

export const getLoansByProject = async (projectId: string) => {
  return await prisma.loan.findMany({
    where: { projectId },
    include: {
      contact: true,
      linkedAccount: true
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const getLoanById = async (id: string) => {
  return await prisma.loan.findUnique({
    where: { id },
    include: {
      contact: true,
      charges: { orderBy: { date: 'desc' } },
      payments: { orderBy: { date: 'desc' }, include: { transaction: true } },
      linkedAccount: true
    }
  });
};

export const addLoanPayment = async (data: any) => {
  const { loanId, totalAmount, principalAmount, interestAmount, bankAccountId, date, userId } = data;

  const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { project: true } });
  if (!loan) throw new Error('Loan not found');

  if (!loan.linkedAccountId) {
    throw new Error('El préstamo no cuenta con una cuenta de pasivo vinculada.');
  }

  // Validate that principal + interest matches total
  if (Math.abs((Number(principalAmount) + Number(interestAmount)) - Number(totalAmount)) > 0.01) {
    throw new Error('Principal and Interest do not sum up to Total Amount');
  }

  // 1. Log Payment
  const payment = await prisma.loanPayment.create({
    data: {
      loanId,
      date: date || new Date(),
      totalAmount: Number(totalAmount),
      principalAmount: Number(principalAmount),
      interestAmount: Number(interestAmount)
    }
  });

  // 2. Reduce outstanding principal
  const newCapital = loan.remainingCapital - Number(principalAmount);
  await prisma.loan.update({
    where: { id: loanId },
    data: { 
      remainingCapital: newCapital,
      status: newCapital <= 0 ? 'PAID' : 'ACTIVE'
    }
  });

  // 3. Mark old UNPAID charges as PAID based on interestAmount paid
  let interestLeftToApply = Number(interestAmount);
  if (interestLeftToApply > 0) {
    const unpaidCharges = await prisma.loanCharge.findMany({
      where: { loanId, status: { in: ['UNPAID', 'PARTIAL'] } },
      orderBy: { date: 'asc' }
    });

    for (const charge of unpaidCharges) {
      if (interestLeftToApply <= 0) break;
      const chargeBalance = charge.amount - charge.paidAmount;
      let appliedPaid = 0;
      
      if (interestLeftToApply >= chargeBalance) {
        await prisma.loanCharge.update({
          where: { id: charge.id },
          data: { paidAmount: charge.amount, status: 'PAID' }
        });
        appliedPaid = chargeBalance;
        interestLeftToApply -= chargeBalance;
      } else {
        await prisma.loanCharge.update({
          where: { id: charge.id },
          data: { paidAmount: charge.paidAmount + interestLeftToApply, status: 'PARTIAL' }
        });
        appliedPaid = interestLeftToApply;
        interestLeftToApply = 0;
      }

      // Sincronizar estado de factura vinculada
      if (charge.invoiceId && appliedPaid > 0) {
        try {
          const inv = await prisma.invoice.findUnique({ where: { id: charge.invoiceId } });
          if (inv) {
            const newOutstanding = Math.max(0, Number(inv.outstanding ?? inv.total) - appliedPaid);
            const newStatus = newOutstanding < 0.01 ? 'PAID' : 'PARTIALLY_PAID';
            await prisma.invoice.update({
              where: { id: inv.id },
              data: {
                outstanding: newOutstanding,
                status: newStatus
              }
            });
          }
        } catch (invErr) {
          console.error('[addLoanPayment] Error updating invoice status:', invErr);
        }
      }
    }
  }

  // 4. Create proper transaction linking Bank logic
  if (bankAccountId) {
    let entries = [];
    
    // Debit 1: Principal
    if (Number(principalAmount) > 0 && loan.linkedAccountId) {
      entries.push({
        debitAccountId: loan.linkedAccountId,
        debitAmount: Number(principalAmount),
      });
    }

    // Debit 2: Interest
    if (Number(interestAmount) > 0 && loan.linkedAccountId) {
       entries.push({
        debitAccountId: loan.linkedAccountId,
        debitAmount: Number(interestAmount),
      });
    }

    // Credit: Bank Account
    entries.push({
      creditAccountId: bankAccountId,
      creditAmount: Number(totalAmount),
    });

    // Realizar conversión dinámica de moneda en base a tasa actual
    let amountBs = 0;
    let amountUsd = 0;
    let amountEur = 0;

    const rate = await getLatestExchangeRate('BCV');
    const usdToBs = rate ? Number(rate.usdToBs) : 40;
    const eurToBs = rate ? Number(rate.eurToBs) : 45;

    if (loan.currency === 'USD') {
      amountUsd = Number(totalAmount);
      amountBs = Number(totalAmount) * usdToBs;
    } else if (loan.currency === 'BS') {
      amountBs = Number(totalAmount);
      amountUsd = usdToBs > 0 ? Number(totalAmount) / usdToBs : 0;
    } else if (loan.currency === 'EUR') {
      amountEur = Number(totalAmount);
      amountBs = Number(totalAmount) * eurToBs;
      amountUsd = eurToBs > 0 && usdToBs > 0 ? (Number(totalAmount) * eurToBs) / usdToBs : 0;
    }

    const tx = await prisma.transaction.create({
       data: {
         code: `TR-PAY-${uuidv4().substring(0, 6)}`,
         projectId: loan.projectId,
         userId,
         type: 'EXPENSE',
         date: date || new Date(),
         description: `Abono a Préstamo: ${loan.name}`,
         amount: Number(totalAmount),
         currency: loan.currency,
         amountBs,
         amountUsd,
         amountEur,
         status: 'COMPLETED',
         attachments: '[]',
         tags: '["loan_payment"]',
         entries: { create: entries }
       }
     });

     // Attach tx to payment
     await prisma.loanPayment.update({
       where: { id: payment.id },
       data: { transactionId: tx.id }
     });

     // Actualizar balances de cuentas
     try {
       // 1. Debit entries (Liability account)
       if (loan.linkedAccountId) {
         const liabAccount = await prisma.account.findUnique({ where: { id: loan.linkedAccountId } });
         const liabCurrency = liabAccount?.currency || loan.currency || 'USD';
         
         if (Number(principalAmount) > 0) {
           const convertedPrincipal = await convertCurrency(Number(principalAmount), loan.currency as any, liabCurrency as any);
           await updateAccountBalance(loan.linkedAccountId, liabCurrency as any, convertedPrincipal, 'DEBIT');
         }
         if (Number(interestAmount) > 0) {
           const convertedInterest = await convertCurrency(Number(interestAmount), loan.currency as any, liabCurrency as any);
           await updateAccountBalance(loan.linkedAccountId, liabCurrency as any, convertedInterest, 'DEBIT');
         }
       }

       // 2. Credit entry (Bank account)
       const bankAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
       const bankCurrency = bankAccount?.currency || loan.currency || 'USD';
       const convertedTotal = await convertCurrency(Number(totalAmount), loan.currency as any, bankCurrency as any);
       await updateAccountBalance(bankAccountId, bankCurrency as any, convertedTotal, 'CREDIT');
     } catch (balanceErr) {
       console.error('[addLoanPayment] Error updating balances:', balanceErr);
     }
  }

  return payment;
};

export const addLoanCharge = async (data: { loanId: string, amount: number, description?: string, date?: Date }) => {
  return await prisma.loanCharge.create({
    data: {
      loanId: data.loanId,
      amount: Number(data.amount),
      description: data.description,
      date: data.date || new Date()
    }
  });
};

export const processLoanInterests = async () => {
  console.log('🔄 Init processing loan interests...');
  const now = new Date();
  
  const dueLoans = await prisma.loan.findMany({
    where: {
      status: 'ACTIVE',
      nextChargeDate: {
        lte: now
      }
    }
  });

  for (const loan of dueLoans) {
    try {
      const interestAmount = Number(loan.remainingCapital) * (Number(loan.interestRate) / 100);

      if (interestAmount > 0) {
        await prisma.loanCharge.create({
          data: {
            loanId: loan.id,
            amount: interestAmount,
            description: `Interés automático (${loan.interestFrequency}) - Saldo: ${loan.remainingCapital}`,
            date: new Date()
          }
        });
      }

      const nextDate = calculateNextChargeDate(loan.nextChargeDate || new Date(), loan.interestFrequency);
      
      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          nextChargeDate: nextDate
        }
      });
      console.log(`✅ Generated interest for loan ${loan.id}. Next charge: ${nextDate}`);
      
    } catch (e) {
      console.error(`❌ Error generating interest for ${loan.id}:`, e);
    }
  }
};
