import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTransaction } from './transaction.controller';
import { createInvoice } from './invoice.controller';
import { createPayment, payInvoice } from './payment.controller';

const prisma = new PrismaClient();

/**
 * Unified entry endpoint.
 * Body: { mode: 'TRANSACTION'|'INVOICE'|'PAYMENT'|'SMART', ...other fields }
 * This controller simply routes to the existing controllers depending on the requested mode.
 */
export const createEntry = async (req: Request, res: Response) => {
  try {
    const mode = (req.body.mode || 'SMART').toString().toUpperCase();

    // SMART: try to infer basic intent
    if (mode === 'SMART') {
      // Simple heuristics: if invoiceId provided => payment
      if (req.body.invoiceId) {
        req.params.id = req.body.invoiceId;
        return await payInvoice(req, res);
      }
      // if lines provided => transaction
      if (Array.isArray(req.body.lines) && req.body.lines.length > 0) {
        const lines = req.body.lines;
        // If frontend already provided explicit debit/credit per line, use them.
        const explicitEntries = lines
          .map((l: any) => {
            const debit = l.debitAccountId || null;
            const credit = l.creditAccountId || null;
            const amt = Number(l.debitAmount || l.creditAmount || l.amount || 0);
            if (debit || credit) {
              return {
                debitAccountId: debit,
                creditAccountId: credit,
                debitAmount: debit ? amt : 0,
                creditAmount: credit ? amt : 0,
                description: l.description || undefined,
              };
            }
            return null;
          })
          .filter(Boolean);

        if (explicitEntries.length > 0) {
          req.body.entries = explicitEntries;
          return await createTransaction(req, res);
        }

        // Otherwise, build aggregated entries according to transaction type rules
        // Default behavior: aggregate all line amounts into a single pair of entries
        const total = lines.reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
        const txnType = (req.body.type || '').toString().toUpperCase();

        // Helper to find an account by subtype or type within the project
        const findAccount = async (projectId: string | undefined, opts: { subTypes?: string[]; types?: string[] }) => {
          const where: any = { isActive: true };
          if (projectId) where.projectId = projectId;
          if (opts.subTypes && opts.subTypes.length > 0) where.subType = { in: opts.subTypes };
          if (opts.types && opts.types.length > 0) where.type = { in: opts.types };
          const acc = await prisma.account.findFirst({ where, orderBy: { code: 'asc' } });
          return acc;
        };

        let generatedEntries: any[] = [];
        const projectId = req.body.projectId;

        if (txnType === 'INCOME') {
          // INCOME -> Debit: first BANK/CASH; Credit: first REVENUE
          const debitAcct = await findAccount(projectId, { subTypes: ['BANK', 'CASH'], types: [] });
          const creditAcct = await findAccount(projectId, { types: ['REVENUE'] });
          if (debitAcct && creditAcct) {
            generatedEntries = [
              { debitAccountId: debitAcct.id, debitAmount: total, creditAmount: 0, description: req.body.description || 'Ingreso' },
              { creditAccountId: creditAcct.id, creditAmount: total, debitAmount: 0, description: req.body.description || 'Ingreso' },
            ];
          }
        } else if (txnType === 'EXPENSE') {
          // EXPENSE -> Debit: first EXPENSE; Credit: first BANK/CASH
          const debitAcct = await findAccount(projectId, { types: ['EXPENSE'] });
          const creditAcct = await findAccount(projectId, { subTypes: ['BANK', 'CASH'], types: [] });
          if (debitAcct && creditAcct) {
            generatedEntries = [
              { debitAccountId: debitAcct.id, debitAmount: total, creditAmount: 0, description: req.body.description || 'Gasto' },
              { creditAccountId: creditAcct.id, creditAmount: total, debitAmount: 0, description: req.body.description || 'Gasto' },
            ];
          }
        }

        if (generatedEntries.length > 0) {
          req.body.entries = generatedEntries;
          return await createTransaction(req, res);
        }

        // Fallback: if we couldn't auto-generate accounts, still map lines amounts to generic entries
        req.body.entries = lines.map((l: any) => ({
          debitAmount: l.amount || 0,
          creditAmount: l.amount || 0,
          description: l.description || undefined,
        }));

        return await createTransaction(req, res);
      }
      // otherwise default to invoice
      return await createInvoice(req, res);
    }

    if (mode === 'TRANSACTION') {
      // Expect `entries` in body compatible with createTransaction
      return await createTransaction(req, res);
    }

    if (mode === 'INVOICE') {
      // Create an invoice (does not post). If client wants to post immediately, they can set autoPost and call /post afterwards or use unified flow with autoPost flag.
      return await createInvoice(req, res);
    }

    if (mode === 'PAYMENT') {
      // If invoiceId present and user wants to pay a specific invoice via unified flow, call payInvoice
      if (req.body.invoiceId) {
        req.params.id = req.body.invoiceId;
        // Move amount/currency/method/autoPost into req.body as expected by payInvoice
        return await payInvoice(req as any, res as any);
      }
      // fallback to generic payment creation
      return await createPayment(req, res);
    }

    return res.status(400).json({ success: false, error: { message: 'Invalid mode' } });
  } catch (err: any) {
    console.error('[createEntry] error', err);
    res.status(500).json({ success: false, error: { message: err?.message || String(err) } });
  }
};

export default { createEntry };
