import prisma from '../config/database';
import { getLatestExchangeRate } from './exchangeRate.service';
import { updateAccountBalance } from './account.service';

export const processInvoicePosting = async (invoiceId: string, userId: string) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'PAID') throw new Error('Invoice already paid');

  // Determine exchange rate (latest)
  const exchangeRate = await getLatestExchangeRate('BCV') || await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } });

  // Build transaction and entries from invoice.lines
  // Supports legacy object, array of items, or new { items, taxAmount } structure
  let taxAmount = 0;
  let items: any[] = [];
  
  try {
    let parsedLines: any = null;
    if (typeof invoice.lines === 'string') {
      parsedLines = JSON.parse(invoice.lines);
    } else {
      parsedLines = invoice.lines;
    }

    if (parsedLines) {
        if (Array.isArray(parsedLines)) {
            // Raw array (Intermediate version?)
            items = parsedLines;
        } else if (typeof parsedLines === 'object') {
            // Object structure
            if (parsedLines.items && Array.isArray(parsedLines.items)) {
                // New standard { items: [], taxAmount: 0 }
                items = parsedLines.items;
                taxAmount = Number(parsedLines.taxAmount || 0);
            } else if (parsedLines.taxAmount) {
                // Legacy { description, taxAmount }
                taxAmount = Number(parsedLines.taxAmount);
            }
        }
    }
  } catch (e) {
    console.warn('[processInvoicePosting] failed to parse invoice lines', e);
  }

  // Base Amount (Net)
  const totalAmount = Number(invoice.total);
  const netAmount = totalAmount - taxAmount;

  // Determine Accounts
  // We need to know which accounts to use.
  // Ideally, they should be in invoice details or default settings.
  // For now, we fallback to project default or create entries without account (user must fix).
  
  const entriesCreate: any[] = [];
  
  // 1. Net Entry
  if (items.length > 0) {
      // Split by items if they have account mapping (future feature), for now lump sum or detailed description
      // We create one entry per item effectively? 
      // Complexity: Item accounting mapping.
      // Simplification: Lump sum Net Amount to "Uncategorized Sales/Expenses"
      entriesCreate.push({
          amount: netAmount, 
          type: 'NET', 
          description: `Base Imponible - ${invoice.code}`
      });
  } else {
      entriesCreate.push({
          amount: netAmount,
          type: 'NET',
          description: `Base Imponible`
      });
  }

  // 2. Tax Entry
  if (taxAmount > 0) {
      entriesCreate.push({
          amount: taxAmount,
          type: 'TAX',
          description: `IVA (16%)`
      });
  }

  // Map to Prisma Entry Create Structure
  const finalEntries = entriesCreate.map(e => {
       const isBill = invoice.type === 'BILL';
       // BILL: Expense (Debit Net+Tax), AP (Credit Total) -> Wait, logic below handles single-sided split?
       // Transaction structure: 
       // We usually record the "Expense" side and "Payable" side? 
       // Actually user wants "Base" and "IVA" separated.
       // BILL (Expense): 
       //   Debit: Expense Account (Base)
       //   Debit: Tax Account (IVA)
       //   Credit: AP Account (Total) -> But current logic might assume single entry implies 'other side is implied'?
       //   Wait, 'entries' in Transaction usually lists the splits.
       //   The 'Transaction' header usually doesn't strictly enforce balance if we represent it as 'Income/Expense' type single entry system?
       //   BUT for proper accounting, we need balanced entries.
       
       // Current simplified system (based on prev code):
       // The previous code mapped `debitAccount` / `creditAccount` if present.
       // If we don't have account IDs, we just leave them undefined for manual classification later.
       
       // LOGIC:
       // If BILL: Debit Expense (Net), Debit Tax (Tax). Credit side is implicit (Payable/Bank)? 
       // Actually `Transaction` model wraps these entries.
       
       // Let's just create the split entries.
       return {
           debitAmount: isBill ? e.amount : 0, // Compra: Gasto + IVA son Debitos
           creditAmount: isBill ? 0 : e.amount, // Venta: Ingreso + IVA son Creditos
           description: e.description
           // Missing: specific account connection.
       };
  });
  
  // Note: We are not auto-creating the balancing entry (AP/AR) here because 
  // currently the system seems to treat 'entries' as the detailed lines, 
  // and the transaction itself represents the event.
  // A robust posting would create:
  // 1. Debit Expense (Net)
  // 2. Debit Tax (Tax)
  // 3. Credit AP (Total)
  // But we lacks AP Account ID here (unless we fetch from Contact defaults).
  
  // Keeping it consistent with previous logic ("entriesCreate" array), but now split.

  // Create transaction within DB transaction
  const createdTxn = await prisma.$transaction(async (tx) => {
    // create transaction code
    const project = await tx.project.findUnique({ where: { id: invoice.projectId }, select: { code: true } });
    const count = await tx.transaction.count({ where: { projectId: invoice.projectId } });
    const uniqueSuffix = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const code = `TRX-${project?.code || invoice.projectId}-${uniqueSuffix}`;

    // Fetch recurring rule name if available
    let description = `Posting invoice ${invoice.code}`;
    let categoryId: string | undefined;
    let contactPersonId: string | undefined;
    let tags: string[] = [];

    if (invoice.recurringRuleId) {
      const rule = await tx.recurringRule.findUnique({ where: { id: invoice.recurringRuleId } });
      if (rule) {
        description = rule.name;
        if (rule.categoryId) categoryId = rule.categoryId;
        tags.push('Recurrente');
      }
    }

    // Map vendor/customer to contactPersonId
    if (invoice.vendorId) contactPersonId = invoice.vendorId;
    else if (invoice.customerId) contactPersonId = invoice.customerId;

    const createData: any = {
      code,
      type: invoice.type === 'BILL' ? 'EXPENSE' : 'INCOME',
      description,
      reference: invoice.code, // Keep full reference here for traceability
      date: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency as any,
      amount: Number(invoice.total),
      amountBs: 0,
      amountUsd: 0,
      amountEur: 0,
      project: { connect: { id: invoice.projectId } },
      user: { connect: { id: userId } },
      tags: JSON.stringify(tags),
      attachments: '[]',
      entries: { create: finalEntries },
      ...(categoryId ? { categoryRef: { connect: { id: categoryId } } } : {}),
      ...(contactPersonId ? { contactPerson: { connect: { id: contactPersonId } } } : {})
    };

    // compute derived amounts using exchangeRate if available
    const safe = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    if (invoice.currency === 'BS') {
      createData.amountBs = safe(invoice.total);
      createData.amountUsd = exchangeRate && safe(exchangeRate.usdToBs) ? safe(invoice.total) / safe(exchangeRate.usdToBs) : 0;
    } else if (invoice.currency === 'USD') {
      createData.amountUsd = safe(invoice.total);
      createData.amountBs = exchangeRate && safe(exchangeRate.usdToBs) ? safe(invoice.total) * safe(exchangeRate.usdToBs) : 0;
    }

    const txn = await tx.transaction.create({ data: createData, include: { entries: { include: { debitAccount: true, creditAccount: true } } } });

    // If invoice was in DRAFT status, we must apply stock changes now!
    if (invoice.status === 'DRAFT' && items.length > 0) {
      for (const line of items) {
        if (line.productId && line.productId !== 'CUSTOM' && line.quantity) {
          const qty = Number(line.quantity);
          const operationMultiplier = (invoice.type === 'BILL') ? 1 : -1;
          await tx.product.update({
            where: { id: line.productId },
            data: {
              stock: { increment: qty * operationMultiplier }
            }
          });
        }
      }
    }

    // Update invoice status to POSTED, but keep outstanding amount (it is now an Account Payable/Receivable)
    // This allows the invoice to remain in "Pending Invoices" until it is fully paid via the Payment module.
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'POSTED' } });

    // Update account balances according to entries (convert amounts if needed)
    for (const entry of txn.entries) {
      if (entry.debitAccountId && Number(entry.debitAmount) > 0) {
        const acct = entry.debitAccount as any;
        const acctCurrency = acct?.currency || invoice.currency;
        let amt = Number(entry.debitAmount);
        if (invoice.currency !== acctCurrency && exchangeRate) {
          // simple conversions
          if (invoice.currency === 'USD' && acctCurrency === 'BS' && exchangeRate.usdToBs) amt = amt * Number(exchangeRate.usdToBs);
          if (invoice.currency === 'BS' && acctCurrency === 'USD' && exchangeRate.usdToBs) amt = amt / Number(exchangeRate.usdToBs);
        }
        await updateAccountBalance(entry.debitAccountId, acctCurrency, Number(amt), 'DEBIT');
      }
      if (entry.creditAccountId && Number(entry.creditAmount) > 0) {
        const acct = entry.creditAccount as any;
        const acctCurrency = acct?.currency || invoice.currency;
        let amt = Number(entry.creditAmount);
        if (invoice.currency !== acctCurrency && exchangeRate) {
          if (invoice.currency === 'USD' && acctCurrency === 'BS' && exchangeRate.usdToBs) amt = amt * Number(exchangeRate.usdToBs);
          if (invoice.currency === 'BS' && acctCurrency === 'USD' && exchangeRate.usdToBs) amt = amt / Number(exchangeRate.usdToBs);
        }
        await updateAccountBalance(entry.creditAccountId, acctCurrency, Number(amt), 'CREDIT');
      }
    }

    return txn;
  });

  return createdTxn;
};
