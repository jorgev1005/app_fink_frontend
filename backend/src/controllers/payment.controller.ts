import { Request, Response } from 'express';
import prisma from '../config/database';
import resolveProjectId from '../utils/resolveProjectId';
import { PaymentService } from '../services/payment.service';
import { logActivity } from '../services/activityLog.service';
import { updateAccountBalance } from '../services/account.service';
import { getLatestExchangeRate } from '../services/exchangeRate.service';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';
import { calculateInvoiceProfitability } from '../services/profitability.service';

/**
 * Create a payment with full automation (Smart ERP)
 * Handles cross-currency payments and automatic accounting entries via PaymentService.
 */
export const createPayment = async (req: Request, res: Response) => {
  try {
    const { 
      projectId, 
      date, 
      currency, 
      amount, 
      method, 
      reference, 
      allocations = [], 
      accountId, 
      targetCurrency, 
      exchangeRate 
    } = req.body;
    
    const user = (req as any).user;

    if (!projectId) return res.status(400).json({ success: false, error: { message: 'projectId required' } });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, error: { message: 'amount must be > 0' } });
    if (!accountId) return res.status(400).json({ success: false, error: { message: 'Bank/Cash Account is required for Smart Payment' } });

    // Resolve projectId 
    const resolvedProjectId = await resolveProjectId(projectId);
    if (!resolvedProjectId) return res.status(400).json({ success: false, error: { message: 'projectId invalid or project not found' } });
    
    // Check write access
    const hasAccess = await checkProjectWriteAccess(user, resolvedProjectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear pagos en este proyecto' } });

    // Delegate business logic to PaymentService
    const payment = await PaymentService.createPayment({
      projectId: resolvedProjectId,
      userId: user.id,
      date: date ? new Date(date) : new Date(),
      amount: Number(amount),
      currency,
      accountId,
      method: method || 'BANK_TRANSFER',
      reference,
      allocations: allocations.map((a: any) => ({
        invoiceId: a.invoiceId,
        transactionId: a.transactionId,
        amount: Number(a.amount)
      })),
      targetCurrency,
      exchangeRate: exchangeRate ? Number(exchangeRate) : undefined
    });

    // Logging
    await logActivity(
      user.id,
      'CREATE',
      'Payment',
      payment.id,
      `Smart Payment ${payment.code}`,
      { amount: payment.amount, currency: payment.currency, projectId: resolvedProjectId },
      req.ip,
      req.headers['user-agent'] as string
    );

    return res.status(201).json({ success: true, data: payment });
  } catch (error: any) {
    console.error('Error in createPayment:', error);
    return res.status(500).json({ 
      success: false, 
      error: { message: error.message || 'Internal Server Error' } 
    });
  }
};

export const getPayments = async (req: Request, res: Response) => {
  try {
    const { projectId, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = {
      ...getProjectAccessFilter((req as any).user)
    };
    if (projectId) where.projectId = projectId as string;

    const [payments, total] = await Promise.all([
      (prisma as any).payment.findMany({ where, include: { allocations: true }, orderBy: { date: 'desc' }, skip, take: Number(limit) }),
      (prisma as any).payment.count({ where })
    ]);

    res.json({ success: true, data: payments, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Import bank statement items and try to auto-create payments/allocations.
 * Body: { projectId, items: [{ reference?, date, amount, currency, accountId?, externalId? }] }
 */
export const importBankItems = async (req: Request, res: Response) => {
  try {
    const { projectId, items = [] } = req.body;
    const user = (req as any).user;
    if (!projectId) return res.status(400).json({ success: false, error: { message: 'projectId required' } });

    // Resolve projectId: accept either project UUID or project.code
    let resolvedProjectId = projectId as any;
    const projectExists = await prisma.project.findUnique({ where: { id: resolvedProjectId } });
    if (!projectExists) {
      const byCode = await prisma.project.findUnique({ where: { code: resolvedProjectId } as any });
      if (byCode) resolvedProjectId = byCode.id;
    }
    if (!resolvedProjectId) return res.status(400).json({ success: false, error: { message: 'projectId invalid or project not found' } });

    const results: any[] = [];
    for (const it of items) {
      // try find invoice by reference
      let invoice = null as any;
      if (it.reference) invoice = await prisma.invoice.findFirst({ where: { projectId: resolvedProjectId, code: it.reference } });
      if (!invoice) {
        // try exact outstanding match
        invoice = await prisma.invoice.findFirst({ where: { projectId: resolvedProjectId, outstanding: Number(it.amount) } });
      }

      const createdPayment = await prisma.payment.create({
        data: {
          project: { connect: { id: resolvedProjectId } },
          code: `PAY-${resolvedProjectId}-${Date.now()}`,
          date: it.date ? new Date(it.date) : new Date(),
          currency: it.currency,
          amount: Number(it.amount),
          method: 'BANK_TRANSFER',
          reference: it.reference || it.externalId || undefined,
          status: 'COMPLETED',
          user: { connect: { id: user.id } }
        }
      });

      if (invoice) {
        const allocAmount = Math.min(Number(it.amount), Number(invoice.outstanding));
        await prisma.paymentAllocation.create({ data: { payment: { connect: { id: createdPayment.id } }, invoice: { connect: { id: invoice.id } }, allocatedAmount: allocAmount } });
        const nextOutstanding = Number(invoice.outstanding) - allocAmount;
        const nextStatus = nextOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
        await prisma.invoice.update({ where: { id: invoice.id }, data: { outstanding: nextOutstanding <= 0 ? 0 : nextOutstanding, status: nextStatus } });
        if (nextStatus === 'PAID') {
          await calculateInvoiceProfitability(invoice.id);
        }
      }

      results.push({ item: it, payment: createdPayment, matchedInvoice: invoice ? { id: invoice.id, code: invoice.code } : null });
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('[importBankItems] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

/**
 * Registrar un pago directo para una invoice y opcionalmente postear la transacción.
 * POST /api/invoices/:id/pay
 * Body: { amount, currency, method, reference, autoPost: boolean }
 */
export const payInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // invoice id
    const { amount, currency, method, reference, autoPost, accountId } = req.body;
    const user = (req as any).user;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });

    const payAmount = Number(amount || 0);
    if (!(payAmount > 0)) return res.status(400).json({ success: false, error: { message: 'amount must be > 0' } });

    // If autoPost is explicitly requested and we have accountId, we can use the Smart Service
    if (autoPost && accountId) {
        // Use Smart Service
        const payment = await PaymentService.createPayment({
            projectId: invoice.projectId,
            userId: user.id,
            date: new Date(),
            amount: payAmount,
            currency: currency || invoice.currency,
            accountId: accountId,
            method: method || 'BANK_TRANSFER',
            reference: reference,
            allocations: [{ invoiceId: invoice.id, amount: payAmount }]
        });
         // Logging
        await logActivity(
            user.id,
            'CREATE',
            'Payment',
            payment.id,
            `Smart Payment via PayInvoice ${payment.code}`,
            { amount: payment.amount, currency: payment.currency, projectId: invoice.projectId },
            req.ip,
            req.headers['user-agent'] as string
        );
        return res.status(201).json({ success: true, data: { payment } });
    }

    // Fallback to legacy logic for "No-Accounting" or "Simple" Payment
    const result = await prisma.$transaction(async (tx) => {
      const code = `PAY-${invoice.projectId}-${Date.now()}`;
      const payment = await (tx as any).payment.create({
        data: {
          project: { connect: { id: invoice.projectId } },
          code,
          date: new Date(),
          currency: currency || invoice.currency,
          amount: payAmount,
          method: method || 'BANK_TRANSFER',
          reference: reference || undefined,
          status: 'COMPLETED',
          user: { connect: { id: user.id } },
        }
      });

      const alloc = await (tx as any).paymentAllocation.create({ data: { payment: { connect: { id: payment.id } }, invoice: { connect: { id: invoice.id } }, allocatedAmount: payAmount } });

      const newOutstanding = Number(invoice.outstanding) - payAmount;
      const nextStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      await tx.invoice.update({ where: { id: invoice.id }, data: { outstanding: newOutstanding <= 0 ? 0 : newOutstanding, status: nextStatus } });
      if (nextStatus === 'PAID') {
        await calculateInvoiceProfitability(invoice.id, tx);
      }

      let createdTxn: any = null;
      if (autoPost) {
        // Legacy auto-post logic (simplified)
        // If accountId was missing (why we fell back here), try to find a default
        let bankAccount: any = null;
        if (accountId) {
          bankAccount = await tx.account.findUnique({ where: { id: accountId } });
        }
        if (!bankAccount) {
          bankAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'BANK', isActive: true } });
        }

        const apAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'ACCOUNTS_PAYABLE', isActive: true } });
        const arAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'ACCOUNTS_RECEIVABLE', isActive: true } });

        const exchangeRate = (await getLatestExchangeRate('BCV')) || await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
        
        const entriesCreate = [];
        
        if (invoice.type === 'BILL') {
          entriesCreate.push({
            debitAccount: apAccount ? { connect: { id: apAccount.id } } : undefined,
            debitAmount: payAmount,
            creditAccount: bankAccount ? { connect: { id: bankAccount.id } } : undefined,
            creditAmount: payAmount,
            description: `Payment for Bill ${invoice.code}`
          });
        } else {
          entriesCreate.push({
            debitAccount: bankAccount ? { connect: { id: bankAccount.id } } : undefined,
            debitAmount: payAmount,
            creditAccount: arAccount ? { connect: { id: arAccount.id } } : undefined,
            creditAmount: payAmount,
            description: `Payment for Invoice ${invoice.code}`
          });
        }

        const project = await tx.project.findUnique({ where: { id: invoice.projectId }, select: { code: true } });
        const count = await tx.transaction.count({ where: { projectId: invoice.projectId } });
        const codeTxn = `TRX-${project?.code || invoice.projectId}-${String(count + 1).padStart(4, '0')}`;

        createdTxn = await tx.transaction.create({ 
            data: {
                code: codeTxn,
                type: invoice.type === 'BILL' ? 'EXPENSE' : 'INCOME',
                description: `Payment for invoice ${invoice.code}`,
                reference: payment.code,
                date: new Date(),
                currency: currency || invoice.currency,
                amount: payAmount,
                amountBs: 0,
                amountUsd: 0,
                amountEur: 0,
                tags: '[]',
                attachments: '[]',
                project: { connect: { id: invoice.projectId } },
                user: { connect: { id: user.id } },
                entries: { create: entriesCreate }
            },
            include: { entries: { include: { debitAccount: true, creditAccount: true } } } 
        });
      }

      return { payment: (tx as any).payment.findUnique({ where: { id: payment.id }, include: { allocations: true } }), transaction: createdTxn };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error('[payInvoice] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
