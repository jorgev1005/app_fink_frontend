import prisma from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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
    await prisma.transaction.create({
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
  }

  return loan;
};

export const deleteLoan = async (loanId: string) => {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error("Préstamo no encontrado");

  // Buscamos si existe la transacción de desembolso creada
  const disbursementTx = await prisma.transaction.findFirst({
    where: {
      projectId: loan.projectId,
      type: 'INCOME',
      description: `Desembolso de Préstamo a favor: ${loan.name}`
    }
  });

  await prisma.$transaction(async (tx) => {
    // 1. Borrar la transacción
    if (disbursementTx) {
      await tx.transaction.delete({ where: { id: disbursementTx.id } });
    }
    // 2. Borrar el préstamo
    await tx.loan.delete({ where: { id: loanId } });
    // 3. Borrar la cuenta pasivo "CXP Préstamo" (cascada inversa para mantener consistencia)
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
      
      if (interestLeftToApply >= chargeBalance) {
        await prisma.loanCharge.update({
          where: { id: charge.id },
          data: { paidAmount: charge.amount, status: 'PAID' }
        });
        interestLeftToApply -= chargeBalance;
      } else {
        await prisma.loanCharge.update({
          where: { id: charge.id },
          data: { paidAmount: charge.paidAmount + interestLeftToApply, status: 'PARTIAL' }
        });
        interestLeftToApply = 0;
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
         amountBs: Number(totalAmount) * 40,
         amountUsd: loan.currency === 'USD' ? Number(totalAmount) : 0, 
         amountEur: loan.currency === 'EUR' ? Number(totalAmount) : 0,
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
