import { Request, Response } from 'express';
import prisma from '../config/database';
import { updateAccountBalance } from '../services/account.service';
import resolveProjectId from '../utils/resolveProjectId';
import { processInvoicePosting } from '../services/invoice.service';
import { checkProjectWriteAccess, getProjectAccessFilter } from '../utils/projectAccess';

// Helper simple to compute nextRunAt for DAILY/WEEKLY/MONTHLY increments
const computeNext = (current: Date, frequency: string, interval: number) => {
  const d = new Date(current);
  if (frequency === 'DAILY') {
    d.setDate(d.getDate() + interval);
    return d;
  }
  if (frequency === 'WEEKLY') {
    d.setDate(d.getDate() + interval * 7);
    return d;
  }
  if (frequency === 'MONTHLY') {
    const month = d.getMonth();
    d.setMonth(month + interval);
    return d;
  }
  if (frequency === 'YEARLY') {
    d.setFullYear(d.getFullYear() + interval);
    return d;
  }
  return d;
};

export const triggerRecurring = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // recurringRule id
    const rule = await prisma.recurringRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ success: false, error: { message: 'Recurring rule not found' } });

    // Verify access
    const hasAccess = await checkProjectWriteAccess(req.user!, rule.projectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: { message: 'No tienes permisos para ejecutar reglas en este proyecto' } });

    // Check if rule has ended
    const scheduledFor = rule.nextRunAt || new Date();
    if (rule.endDate && new Date(scheduledFor) > new Date(rule.endDate)) {
      // Mark as inactive just in case
      await prisma.recurringRule.update({ where: { id: rule.id }, data: { isActive: false } });
      return res.status(400).json({ success: false, error: { message: 'Esta regla ha finalizado su periodo de vigencia.' } });
    }

    const occurrence = await prisma.scheduledOccurrence.create({
      data: {
        recurringRule: { connect: { id: rule.id } },
        scheduledFor,
        status: 'PENDING'
      }
    });

    // Create Invoice from rule template
    const ruleType = (rule as any).type || 'BILL';
    const contactId = (rule as any).contactId;

    const inv = await prisma.invoice.create({
      data: {
        project: { connect: { id: rule.projectId } },
        code: `INV-${Date.now().toString().slice(-6)}`,
        type: ruleType as any,
        issueDate: scheduledFor, // Use the scheduled date as issue date, not current date
        dueDate: (() => {
          const dueDays = (rule as any).dueDays;
          // If dueDays is explicitly 0, use 0. If null/undefined, default to 15.
          const daysToAdd = (dueDays !== null && dueDays !== undefined) ? Number(dueDays) : 15;
          return new Date(new Date(scheduledFor).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        })(),
        currency: rule.currency,
        total: rule.amount,
        outstanding: rule.amount,
        lines: rule.entriesTemplate as any,
        createdBy: rule.createdBy,
        recurringRuleId: rule.id,
        // Map contactId to vendorId or customerId based on type
        ...(contactId ? (ruleType === 'BILL' ? { vendorId: contactId } : { customerId: contactId }) : {})
      }
    });

    // Link occurrence -> invoice, and advance nextRunAt
    const newNext = computeNext(new Date(rule.nextRunAt), rule.frequency, rule.interval);
    
    // Check if next run is past end date -> deactivate
    let isActive = rule.isActive;
    if (rule.endDate && newNext > new Date(rule.endDate)) {
      isActive = false;
    }

    await prisma.recurringRule.update({ where: { id: rule.id }, data: { nextRunAt: newNext, isActive } });
    await prisma.scheduledOccurrence.update({ where: { id: occurrence.id }, data: { invoice: { connect: { id: inv.id } }, status: 'POSTED' } });

    // Auto-post if enabled
    if ((rule as any).autoPost) {
      try {
        await processInvoicePosting(inv.id, rule.createdBy);
      } catch (err) {
        console.error('[triggerRecurring] autoPost failed', err);
        // We don't fail the whole request, just log it. The invoice is created anyway.
      }
    }

    res.json({ success: true, data: { occurrence, invoice: inv } });
  } catch (error: any) {
    console.error('[triggerRecurring] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getRecurringRules = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    const rules = await prisma.recurringRule.findMany({
      where: {
        ...getProjectAccessFilter(req.user!),
      },
      orderBy: { nextRunAt: 'asc' }
    });

    res.json({ success: true, data: rules });
  } catch (error: any) {
    console.error('[getRecurringRules] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const createRecurringRule = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    const { projectId, name, description, amount, currency, entriesTemplate, frequency, interval, startDate, endDate, timezone, dueDays, contactId, categoryId, type, autoPost } = req.body;
    if (!projectId || !name || !amount || !currency || !entriesTemplate) return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });

    // Resolve projectId: accept either project UUID or project.code
    const resolvedProjectId = await resolveProjectId(projectId as any);
    if (!resolvedProjectId) return res.status(400).json({ success: false, error: { message: 'projectId invalid or project not found' } });

    // Check write access
    const hasAccess = await checkProjectWriteAccess(req.user!, resolvedProjectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: { message: 'No tienes permisos para crear reglas en este proyecto' } });

    // Handle startDate to avoid timezone shifts (default to noon UTC if only date provided)
    let start = new Date();
    if (startDate) {
      if (typeof startDate === 'string' && startDate.length === 10) {
        start = new Date(`${startDate}T12:00:00Z`);
      } else {
        start = new Date(startDate);
      }
    }

    const rule = await prisma.recurringRule.create({
      data: {
        project: { connect: { id: resolvedProjectId } },
        name,
        description: description || null,
        amount: amount as any,
        currency,
        entriesTemplate: typeof entriesTemplate === 'string' ? entriesTemplate : JSON.stringify(entriesTemplate),
        frequency: frequency || 'MONTHLY',
        interval: interval || 1,
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        timezone: timezone || 'America/Caracas',
        nextRunAt: start,
        ...(dueDays !== undefined ? { dueDays: Number(dueDays) } : {}),
        contactId: contactId || null,
        categoryId: categoryId || null,
        type: type || 'BILL',
        autoPost: autoPost || false,
        isActive: true,
        createdBy: userId
      }
    });
    res.json({ success: true, data: rule });
  } catch (error: any) {
    console.error('[createRecurringRule] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const deleteRecurringRule = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await prisma.recurringRule.findUnique({ where: { id } });
    if (!rule) return res.status(404).json({ success: false, error: { message: 'Regla no encontrada' } });

    // Check write access
    const hasAccess = await checkProjectWriteAccess(req.user!, rule.projectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: { message: 'No tienes permisos para eliminar reglas en este proyecto' } });

    await prisma.recurringRule.delete({ where: { id } });
    res.json({ success: true, message: 'Regla eliminada' });
  } catch (error: any) {
    console.error('[deleteRecurringRule] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getPendingOccurrences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    // Filters and pagination
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const skip = (page - 1) * limit;
    const projectId = req.query.projectId as string | undefined;
    const scheduledFrom = req.query.scheduledFrom as string | undefined;
    const scheduledTo = req.query.scheduledTo as string | undefined;

    const where: any = { 
      status: 'PENDING',
      recurringRule: {
        ...getProjectAccessFilter(req.user!).project
      }
    };
    if (projectId) where.recurringRule.projectId = projectId;
    if (scheduledFrom || scheduledTo) where.scheduledFor = {};
    if (scheduledFrom) where.scheduledFor.gte = new Date(scheduledFrom as string);
    if (scheduledTo) where.scheduledFor.lte = new Date(scheduledTo as string);

    const [items, total] = await Promise.all([
      prisma.scheduledOccurrence.findMany({ where, include: { invoice: true, recurringRule: true }, orderBy: { scheduledFor: 'asc' }, skip, take: limit }),
      prisma.scheduledOccurrence.count({ where })
    ]);

    res.json({ success: true, data: items, pagination: { page, limit, total } });
  } catch (error: any) {
    console.error('[getPendingOccurrences] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getOccurrence = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    // Note: `invoice.lines` is stored as JSON (not a relation), include payments only
    const occ = await prisma.scheduledOccurrence.findUnique({ where: { id }, include: { invoice: { include: { payments: true } }, recurringRule: true } });
    if (!occ) return res.status(404).json({ success: false, error: { message: 'Occurrence not found' } });

    // Check project access
    if (user.role !== 'ADMIN') {
      if (!user.id) {
        console.error('[recurring.controller/getOccurrence] user.id missing:', user);
        return res.status(401).json({ success: false, error: { message: 'No autenticado (user.id missing)' } });
      }
      const membership = await prisma.projectUser.findUnique({
        where: {
          projectId_userId: {
            projectId: occ.recurringRule.projectId,
            userId: user.id
          }
        }
      });
      if (!membership) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permisos para ver esta ocurrencia' } });
      }
    }

    const activityLogs = await prisma.activityLog.findMany({ where: { entity: 'ScheduledOccurrence', entityId: id }, orderBy: { createdAt: 'desc' } });

    const parsedOcc = {
      ...occ,
      recurringRule: {
        ...occ.recurringRule,
        entriesTemplate: typeof occ.recurringRule.entriesTemplate === 'string' ? JSON.parse(occ.recurringRule.entriesTemplate) : occ.recurringRule.entriesTemplate
      },
      invoice: occ.invoice ? {
        ...occ.invoice,
        lines: typeof occ.invoice.lines === 'string' ? JSON.parse(occ.invoice.lines) : occ.invoice.lines
      } : null
    };

    const parsedLogs = activityLogs.map(log => ({
      ...log,
      metadata: typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata
    }));

    res.json({ success: true, data: { occurrence: parsedOcc, activityLogs: parsedLogs } });
  } catch (error: any) {
    console.error('[getOccurrence] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const updateOccurrence = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    const { scheduledFor, invoiceDueDate } = req.body || {};

    const occ = await prisma.scheduledOccurrence.findUnique({ where: { id }, include: { invoice: true, recurringRule: true } });
    if (!occ) return res.status(404).json({ success: false, error: { message: 'Occurrence not found' } });

    // Check write access
    const hasAccess = await checkProjectWriteAccess(user, occ.recurringRule.projectId);
    if (!hasAccess) return res.status(403).json({ success: false, error: { message: 'No tienes permisos para modificar esta ocurrencia' } });

    const updated = await prisma.$transaction(async (tx) => {
      const updates: any = {};
      if (scheduledFor) updates.scheduledFor = new Date(scheduledFor);

      const occUpdated = await tx.scheduledOccurrence.update({ where: { id }, data: updates });

      let invoiceUpdated = null;
      if (invoiceDueDate && occ.invoice) {
        invoiceUpdated = await tx.invoice.update({ where: { id: occ.invoice.id }, data: { dueDate: new Date(invoiceDueDate) } });
      }

      try {
        await tx.activityLog.create({ data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'ScheduledOccurrence',
          entityId: id,
          description: `Updated occurrence ${id}`,
          metadata: JSON.stringify({ scheduledFor: scheduledFor || null, invoiceDueDate: invoiceDueDate || null }),
          ipAddress: (req as any).ip || (req.headers['x-forwarded-for'] as string) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        }});
      } catch (e) {
        console.warn('Audit log failed', e);
      }

      return { occ: occUpdated, invoice: invoiceUpdated };
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[updateOccurrence] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const cancelOccurrence = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    const occ = await prisma.scheduledOccurrence.findUnique({ where: { id }, include: { invoice: true } });
    if (!occ) return res.status(404).json({ success: false, error: { message: 'Occurrence not found' } });

    const updated = await prisma.$transaction(async (tx) => {
      // Mark occurrence cancelled
      const occUpdated = await tx.scheduledOccurrence.update({ where: { id }, data: { status: 'CANCELLED' } });

      // Optionally update invoice status/back to DRAFT if needed: keep minimal and only log
      try {
        await tx.activityLog.create({ data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'ScheduledOccurrence',
          entityId: id,
          description: `Cancelled occurrence ${id}`,
          metadata: JSON.stringify({ invoiceId: occ.invoice ? occ.invoice.id : null }),
          ipAddress: (req as any).ip || (req.headers['x-forwarded-for'] as string) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        }});
      } catch (e) {
        console.warn('Audit log failed', e);
      }

      return occUpdated;
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[cancelOccurrence] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const batchMarkPaidOccurrences = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    const { occurrenceIds, autoPost, limit: requestedLimit } = req.body || {};

    // Create a batch record to persist request and later results
    const batch = await prisma.occurrenceBatch.create({ data: {
      user: { connect: { id: user.id } },
      requestParams: JSON.stringify({ occurrenceIds: occurrenceIds || null, autoPost: !!autoPost, limit: Number(requestedLimit || 0) })
    }});

    const MAX_BATCH = 100; // safety cap to avoid very large batches
    if (occurrenceIds && Array.isArray(occurrenceIds) && occurrenceIds.length > MAX_BATCH) {
      return res.status(400).json({ success: false, error: { message: `Batch too large. Max ${MAX_BATCH} occurrences per request` } });
    }

    const where: any = { status: 'PENDING' };
    if (occurrenceIds && Array.isArray(occurrenceIds) && occurrenceIds.length > 0) {
      where.id = { in: occurrenceIds };
      // keep the order returned by DB for given ids
    }

    let takeCount = MAX_BATCH;
    if (!occurrenceIds || occurrenceIds.length === 0) {
      // when no explicit ids, allow a requested limit but cap it
      const parsed = Number(requestedLimit || 50) || 50;
      takeCount = Math.min(parsed, MAX_BATCH);
    } else {
      takeCount = occurrenceIds.length;
    }

    const pending = await prisma.scheduledOccurrence.findMany({ where, include: { invoice: true }, orderBy: { scheduledFor: 'asc' }, take: takeCount });
    const results: any[] = [];

    for (const occ of pending) {
      const invoice = occ.invoice;
      if (!invoice) { results.push({ id: occ.id, error: 'no invoice' }); continue; }
      const outstanding = Number(invoice.outstanding || 0);
      if (!(outstanding > 0)) {
        await prisma.scheduledOccurrence.update({ where: { id: occ.id }, data: { status: 'POSTED', invoiceId: invoice.id } });
        results.push({ id: occ.id, skipped: true });
        continue;
      }

      const r = await prisma.$transaction(async (tx) => {
        const code = `PAY-${invoice.projectId}-${Date.now()}`;
        const payment = await tx.payment.create({ data: {
          project: { connect: { id: invoice.projectId } }, code, date: new Date(), currency: invoice.currency,
          amount: outstanding, method: 'BANK_TRANSFER', reference: `BATCH_AUTO_PAY_${occ.id}`, status: 'COMPLETED', user: { connect: { id: user.id } }
        }});

        await tx.paymentAllocation.create({ data: { payment: { connect: { id: payment.id } }, invoice: { connect: { id: invoice.id } }, allocatedAmount: outstanding } });

        await tx.invoice.update({ where: { id: invoice.id }, data: { outstanding: 0, status: 'PAID' } });

        let createdTxn: any = null;
        if (autoPost) {
          // create transaction similar to single occurrence logic
          const lines = (invoice.lines || []) as any[];
          let entriesCreate = (lines.length ? lines : [{ amount: outstanding }]).map((l: any) => {
            const debitAmount = 0; const creditAmount = Number(l.amount || outstanding || 0);
            const e: any = { debitAmount, creditAmount, description: `Payment for ${invoice.code}` };
            if (l.debitAccountId) e.debitAccount = { connect: { id: l.debitAccountId } };
            if (l.creditAccountId) e.creditAccount = { connect: { id: l.creditAccountId } };
            return e;
          });

          const bankAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'BANK', isActive: true } });
          const apAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'ACCOUNTS_PAYABLE', isActive: true } });
          const arAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'ACCOUNTS_RECEIVABLE', isActive: true } });

          entriesCreate = entriesCreate.map((e: any) => {
            if ((!e.debitAccount || !e.debitAccount.connect) && bankAccount) { e.debitAccount = { connect: { id: bankAccount.id } }; e.debitAmount = Number(e.debitAmount || outstanding || 0); }
            if ((!e.creditAccount || !e.creditAccount.connect)) {
              if (invoice.type === 'BILL' && apAccount) { e.creditAccount = { connect: { id: apAccount.id } }; e.creditAmount = Number(e.creditAmount || outstanding || 0); }
              else if (invoice.type === 'INVOICE' && arAccount) { e.creditAccount = { connect: { id: arAccount.id } }; e.creditAmount = Number(e.creditAmount || outstanding || 0); }
            }
            return e;
          });

          const project = await tx.project.findUnique({ where: { id: invoice.projectId }, select: { code: true } });
          const count = await tx.transaction.count({ where: { projectId: invoice.projectId } });
          const uniqueSuffix = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
          const codeTxn = `TRX-${project?.code || invoice.projectId}-${uniqueSuffix}`;

          const createData: any = { code: codeTxn, type: invoice.type === 'BILL' ? 'EXPENSE' : 'INCOME', description: `Payment for invoice ${invoice.code}`, reference: payment.code, date: new Date(), currency: invoice.currency, amount: outstanding, amountBs: 0, amountUsd: 0, amountEur: 0, tags: '[]', attachments: '[]', project: { connect: { id: invoice.projectId } }, user: { connect: { id: user.id } }, entries: { create: entriesCreate } };

          createdTxn = await tx.transaction.create({ data: createData, include: { entries: { include: { debitAccount: true, creditAccount: true } } } });

          for (const entry of createdTxn.entries) {
            if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
              const acctCurrency = entry.debitAccount?.currency || invoice.currency;
              await updateAccountBalance(entry.debitAccountId, acctCurrency as any, Number(entry.debitAmount), 'DEBIT');
            }
            if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
              const acctCurrency = entry.creditAccount?.currency || invoice.currency;
              await updateAccountBalance(entry.creditAccountId, acctCurrency as any, Number(entry.creditAmount), 'CREDIT');
            }
          }
        }

        await tx.scheduledOccurrence.update({ where: { id: occ.id }, data: { status: 'POSTED', invoiceId: invoice.id } });

        const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true, occurrences: true } });
          // Audit log entry (include requester IP and user-agent)
          try {
            await tx.activityLog.create({ data: {
              userId: user.id,
              action: 'UPDATE',
              entity: 'ScheduledOccurrence',
              entityId: occ.id,
              description: `Marked occurrence ${occ.id} paid and created payment ${payment.id}`,
              metadata: JSON.stringify({ invoiceId: invoice.id, paymentId: payment.id, transactionId: createdTxn ? createdTxn.id : null }),
              ipAddress: (req as any).ip || (req.headers['x-forwarded-for'] as string) || '',
              userAgent: (req.headers['user-agent'] as string) || ''
            }});
          } catch (e) {
            console.warn('Audit log failed', e);
          }

        return { payment, updatedInvoice, transaction: createdTxn };
      });

      results.push({ id: occ.id, result: r });
    }

    // persist results into batch
    try {
      await prisma.occurrenceBatch.update({ where: { id: batch.id }, data: { results: JSON.stringify(results) } });
    } catch (e) {
      console.warn('Failed to persist batch results', e);
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('[batchMarkPaidOccurrences] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const markOccurrencePaid = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // occurrence id
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });

    const occ = await prisma.scheduledOccurrence.findUnique({ where: { id }, include: { invoice: true } });
    if (!occ) return res.status(404).json({ success: false, error: { message: 'Occurrence not found' } });
    if (!occ.invoice) return res.status(400).json({ success: false, error: { message: 'Occurrence has no invoice' } });

    const invoice = occ.invoice;
    const outstanding = Number(invoice.outstanding || 0);
    if (!(outstanding > 0)) {
      // still mark occurrence as POSTED if needed
      await prisma.scheduledOccurrence.update({ where: { id }, data: { status: 'POSTED', invoiceId: invoice.id } });
      return res.json({ success: true, data: { message: 'Invoice already has no outstanding amount', occurrence: id, invoiceId: invoice.id } });
    }

    const { autoPost } = req.body || {};

    const result = await prisma.$transaction(async (tx) => {
      const code = `PAY-${invoice.projectId}-${Date.now()}`;
      const payment = await tx.payment.create({
        data: {
          project: { connect: { id: invoice.projectId } },
          code,
          date: new Date(),
          currency: invoice.currency,
          amount: outstanding,
          method: 'BANK_TRANSFER',
          reference: `AUTO_PAY_OCC_${id}`,
          status: 'COMPLETED',
          user: { connect: { id: user.id } },
        }
      });

      await tx.paymentAllocation.create({ data: { payment: { connect: { id: payment.id } }, invoice: { connect: { id: invoice.id } }, allocatedAmount: outstanding } });

      await tx.invoice.update({ where: { id: invoice.id }, data: { outstanding: 0, status: 'PAID' } });

      let createdTxn: any = null;
      if (autoPost) {
        // Create a transaction representing the payment similar to payInvoice autoPost logic
        const exchangeRate = (await tx.exchangeRate.findFirst({ orderBy: { date: 'desc' } })) || null;

        const lines = (invoice.lines || []) as any[];
        let entriesCreate = (lines.length ? lines : [{ amount: outstanding }]).map((l: any) => {
          const debitAmount = 0;
          const creditAmount = Number(l.amount || outstanding || 0);
          const e: any = { debitAmount, creditAmount, description: `Payment for ${invoice.code}` };
          if (l.debitAccountId) e.debitAccount = { connect: { id: l.debitAccountId } };
          if (l.creditAccountId) e.creditAccount = { connect: { id: l.creditAccountId } };
          return e;
        });

        const bankAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'BANK', isActive: true } });
        const apAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'ACCOUNTS_PAYABLE', isActive: true } });
        const arAccount = await tx.account.findFirst({ where: { projectId: invoice.projectId, subType: 'ACCOUNTS_RECEIVABLE', isActive: true } });

        entriesCreate = entriesCreate.map((e: any) => {
          if ((!e.debitAccount || !e.debitAccount.connect) && bankAccount) {
            e.debitAccount = { connect: { id: bankAccount.id } };
            e.debitAmount = Number(e.debitAmount || outstanding || 0);
          }
          if ((!e.creditAccount || !e.creditAccount.connect)) {
            if (invoice.type === 'BILL' && apAccount) {
              e.creditAccount = { connect: { id: apAccount.id } };
              e.creditAmount = Number(e.creditAmount || outstanding || 0);
            } else if (invoice.type === 'INVOICE' && arAccount) {
              e.creditAccount = { connect: { id: arAccount.id } };
              e.creditAmount = Number(e.creditAmount || outstanding || 0);
            }
          }
          return e;
        });

        const project = await tx.project.findUnique({ where: { id: invoice.projectId }, select: { code: true } });
        const count = await tx.transaction.count({ where: { projectId: invoice.projectId } });
        const uniqueSuffix = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const codeTxn = `TRX-${project?.code || invoice.projectId}-${uniqueSuffix}`;

        const createData: any = {
          code: codeTxn,
          type: invoice.type === 'BILL' ? 'EXPENSE' : 'INCOME',
          description: `Payment for invoice ${invoice.code}`,
          reference: payment.code,
          date: new Date(),
          currency: invoice.currency,
          amount: outstanding,
          amountBs: 0,
          amountUsd: 0,
          amountEur: 0,
          tags: '[]',
          attachments: '[]',
          project: { connect: { id: invoice.projectId } },
          user: { connect: { id: user.id } },
          entries: { create: entriesCreate }
        };

        const safe = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
        if ((invoice.currency) === 'BS') {
          createData.amountBs = safe(outstanding);
          createData.amountUsd = exchangeRate && safe(exchangeRate.usdToBs) ? safe(outstanding) / safe(exchangeRate.usdToBs) : 0;
        } else if ((invoice.currency) === 'USD') {
          createData.amountUsd = safe(outstanding);
          createData.amountBs = exchangeRate && safe(exchangeRate.usdToBs) ? safe(outstanding) * safe(exchangeRate.usdToBs) : 0;
        }

        createdTxn = await tx.transaction.create({ data: createData, include: { entries: { include: { debitAccount: true, creditAccount: true } } } });

        // Update balances using entries of createdTxn
        for (const entry of createdTxn.entries) {
          if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
            const acctCurrency = entry.debitAccount?.currency || invoice.currency;
            await updateAccountBalance(entry.debitAccountId, acctCurrency as any, Number(entry.debitAmount), 'DEBIT');
          }
          if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
            const acctCurrency = entry.creditAccount?.currency || invoice.currency;
            await updateAccountBalance(entry.creditAccountId, acctCurrency as any, Number(entry.creditAmount), 'CREDIT');
          }
        }
      }

      await tx.scheduledOccurrence.update({ where: { id }, data: { status: 'POSTED', invoiceId: invoice.id } });

      const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true, occurrences: true } });

      // Audit log for single occurrence mark-paid (include requester IP and user-agent)
      try {
        await tx.activityLog.create({ data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'ScheduledOccurrence',
          entityId: id,
          description: `Marked occurrence ${id} paid and created payment ${payment.id}`,
          metadata: JSON.stringify({ invoiceId: invoice.id, paymentId: payment.id, transactionId: createdTxn ? createdTxn.id : null }),
          ipAddress: (req as any).ip || (req.headers['x-forwarded-for'] as string) || '',
          userAgent: (req.headers['user-agent'] as string) || ''
        }});
      } catch (e) {
        console.warn('Audit log failed', e);
      }

      return { payment, updatedInvoice, transaction: createdTxn };
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[markOccurrencePaid] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getBatches = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 25), 200);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.occurrenceBatch.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: true } }),
      prisma.occurrenceBatch.count()
    ]);

    const parsedItems = items.map(item => ({
      ...item,
      requestParams: typeof item.requestParams === 'string' ? JSON.parse(item.requestParams) : item.requestParams,
      results: typeof item.results === 'string' ? JSON.parse(item.results) : item.results
    }));

    res.json({ success: true, data: parsedItems, pagination: { page, limit, total } });
  } catch (error:any) {
    console.error('[getBatches] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getBatchById = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Not authenticated' } });
    const { id } = req.params;
    const b = await prisma.occurrenceBatch.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ success: false, error: { message: 'Batch not found' } });

    const parsedBatch = {
      ...b,
      requestParams: typeof b.requestParams === 'string' ? JSON.parse(b.requestParams) : b.requestParams,
      results: typeof b.results === 'string' ? JSON.parse(b.results) : b.results
    };

    res.json({ success: true, data: parsedBatch });
  } catch (error:any) {
    console.error('[getBatchById] error', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
