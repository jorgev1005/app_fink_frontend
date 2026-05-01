import { Request, Response } from 'express';
import prisma from '../config/database';
import { getProjectAccessFilter } from '../utils/projectAccess';

/**
 * Get contact reports - sales and purchases by customer/supplier
 */
export const getContactReports = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, contactType, category, categoryId } = req.query;

    // Build filters
    const filters: any = {
      ...getProjectAccessFilter(req.user!)
    };
    
    if (projectId) {
      filters.projectId = projectId as string;
    }
    
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) {
        filters.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        filters.date.lte = new Date(endDate as string);
      }
    }

    // legacy category string filter
    if (category) {
      filters.category = { equals: category as string, mode: 'insensitive' };
    }

    // normalized category id filter
    if (categoryId) {
      filters.categoryId = categoryId as string;
    }

    // Get all transactions with contact persons
    const transactions = await prisma.transaction.findMany({
      where: {
        ...filters,
        contactPersonId: {
          not: null,
        },
        status: {
          in: ['COMPLETED', 'RECONCILED'],
        },
      },
      include: {
        contactPerson: {
          select: {
            id: true,
            name: true,
            type: true,
            email: true,
            taxId: true,
          },
        },
        project: {
          select: {
            name: true,
            code: true,
          },
        },
        // include normalized category reference so frontend can show category names
        categoryRef: {
          select: { id: true, name: true },
        },
      },
    });

    // Group by contact person
    const contactReports = new Map();

    transactions.forEach((transaction) => {
      if (!transaction.contactPerson) return;

      const contactId = transaction.contactPerson.id;
      
      if (!contactReports.has(contactId)) {
        contactReports.set(contactId, {
          contact: transaction.contactPerson,
          project: transaction.project,
          totalIncome: 0,
          totalExpense: 0,
          transactionCount: 0,
          transactions: [],
        });
      }

      const report = contactReports.get(contactId);
      
      // Sum amounts by type
      const amount = Number(transaction.amount);
      if (transaction.type === 'INCOME') {
        report.totalIncome += amount;
      } else if (transaction.type === 'EXPENSE') {
        report.totalExpense += amount;
      }
      
      report.transactionCount++;
      report.transactions.push({
        id: transaction.id,
        code: transaction.code,
        date: transaction.date,
        type: transaction.type,
        description: transaction.description,
        amount: amount,
        currency: transaction.currency,
        // include legacy category string and normalized category relation if available
        category: transaction.category || null,
        categoryId: transaction.categoryId || null,
        categoryRef: transaction.categoryRef ? { id: transaction.categoryRef.id, name: transaction.categoryRef.name } : null,
      });
    });

    // Convert map to array and calculate balances
    const reports = Array.from(contactReports.values()).map((report) => {
      // Apply contact type filter if specified
      if (contactType && report.contact.type !== contactType) {
        return null;
      }

      return {
        ...report,
        balance: report.totalIncome - report.totalExpense,
        // Sort transactions by date (newest first)
        transactions: report.transactions.sort(
          (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      };
    }).filter(Boolean); // Remove null entries from contact type filter

    // Sort by total transaction amount (descending)
    reports.sort((a: any, b: any) => {
      const totalA = a.totalIncome + a.totalExpense;
      const totalB = b.totalIncome + b.totalExpense;
      return totalB - totalA;
    });

    res.json({
      success: true,
      data: reports,
      summary: {
        totalContacts: reports.length,
        totalIncome: reports.reduce((sum: number, r: any) => sum + r.totalIncome, 0),
        totalExpense: reports.reduce((sum: number, r: any) => sum + r.totalExpense, 0),
        totalTransactions: reports.reduce((sum: number, r: any) => sum + r.transactionCount, 0),
      },
    });
  } catch (error) {
    console.error('Error getting contact reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener reportes de contactos',
    });
  }
};

export const getContactAgingReport = async (req: Request, res: Response) => {
  try {
    const { projectId, currency = 'USD', type, startDate, endDate, includePaid } = req.query; // type: 'PAYABLE' (Expense), 'RECEIVABLE' (Income)

    const today = new Date();
    const showPaid = String(includePaid) === 'true';

    // 1. Fetch Transactions
    const paymentStatuses = ['PENDING', 'PARTIAL'];
    if (showPaid) paymentStatuses.push('PAID');

    const txWhere: any = {
      paymentStatus: { in: paymentStatuses },
      status: { in: ['COMPLETED', 'PENDING'] }, // Include PENDING status as well
      contactPersonId: { not: null },
      ...getProjectAccessFilter(req.user!)
    };
    
    if (projectId) txWhere.projectId = String(projectId);
    
    if (startDate || endDate) {
        txWhere.date = {};
        if (startDate) txWhere.date.gte = new Date(String(startDate));
        if (endDate) txWhere.date.lte = new Date(String(endDate));
    }
    
    if (type === 'PAYABLE') {
        txWhere.type = { in: ['EXPENSE'] };
    } else if (type === 'RECEIVABLE') {
        txWhere.type = { in: ['INCOME'] };
    } else if (type) {
        // If type is something else, maybe ignore or filter both?
        // If undefined, fetch both.
    }

    const transactions = await prisma.transaction.findMany({
      where: txWhere,
      include: {
        contactPerson: true,
        project: { select: { name: true } },
        allocations: {
            include: {
                payment: {
                    select: {
                        date: true,
                        reference: true,
                        method: true,
                        currency: true
                    }
                }
            }
        }
      }
    });

    // 2. Fetch Invoices
    const invoiceStatuses = ['OPEN', 'PARTIALLY_PAID'];
    if (showPaid) invoiceStatuses.push('PAID');

    const invWhere: any = {
      status: { in: invoiceStatuses },
      OR: [
        { vendorId: { not: null } },
        { customerId: { not: null } }
      ],
      ...getProjectAccessFilter(req.user!)
    };
    
    if (projectId) invWhere.projectId = String(projectId);

    if (startDate || endDate) {
        invWhere.issueDate = {};
        if (startDate) invWhere.issueDate.gte = new Date(String(startDate));
        if (endDate) invWhere.issueDate.lte = new Date(String(endDate));
    }
    
    if (type === 'PAYABLE') {
        invWhere.type = 'BILL';
        invWhere.vendorId = { not: null };
        delete invWhere.OR;
    } else if (type === 'RECEIVABLE') {
        invWhere.type = 'INVOICE';
        invWhere.customerId = { not: null };
        delete invWhere.OR;
    }

    const invoices = await prisma.invoice.findMany({
      where: invWhere,
      include: {
        project: { select: { name: true } },
        payments: {
            include: {
                payment: {
                    select: {
                        date: true,
                        reference: true,
                        method: true,
                        currency: true
                    }
                }
            }
        }
      }
    });

    // Fetch contacts for invoices manually since relation is missing/different
    const contactIds = new Set<string>();
    invoices.forEach(inv => {
        if (inv.vendorId) contactIds.add(inv.vendorId);
        if (inv.customerId) contactIds.add(inv.customerId);
    });

    const invoiceContacts = await prisma.contactPerson.findMany({
        where: { id: { in: Array.from(contactIds) } }
    });
    const contactMap = new Map(invoiceContacts.map(c => [c.id, c]));

    // 3. Process and Group
    const contacts = new Map<string, any>();

    // Helper to get/init contact entry
    const getContactEntry = (contact: any) => {
        if (!contact) return null;
        if (!contacts.has(contact.id)) {
            contacts.set(contact.id, {
                id: contact.id,
                name: contact.name,
                type: contact.type,
                totalPending: 0,
                overdue: 0,
                dueSoon: 0,
                items: []
            });
        }
        return contacts.get(contact.id);
    };

    // Helper to convert
    const latestRate = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } });
    const usdToBs = latestRate?.usdToBs || 1;
    const eurToBs = latestRate?.eurToBs || 1;
    const eurToUsd = latestRate?.eurToUsd || 1;

    const convert = (amount: number, fromCurr: string) => {
        if (currency === fromCurr) return amount;
        
        if (currency === 'BS') {
            if (fromCurr === 'USD') return amount * usdToBs;
            if (fromCurr === 'EUR') return amount * eurToBs;
        } else if (currency === 'USD') {
            if (fromCurr === 'BS') return amount / usdToBs;
            if (fromCurr === 'EUR') return amount * eurToUsd;
        }
        return amount;
    };

    // Process Transactions
    transactions.forEach(tx => {
        if (!tx.contactPerson) return;
        const entry = getContactEntry(tx.contactPerson);
        if (!entry) return;

        const outstanding = tx.amount - (tx.amountPaid || 0);
        const val = convert(outstanding, tx.currency);
        
        const dueDate = tx.dueDate ? new Date(tx.dueDate) : new Date(tx.date);
        const isOverdue = dueDate < today && outstanding > 0.01;
        
        entry.totalPending += val;
        if (isOverdue) entry.overdue += val;
        else entry.dueSoon += val;
        
        entry.items.push({
            id: tx.id,
            type: 'TRANSACTION',
            docType: 'Gasto Directo',
            taxAmount: 0,
            flow: tx.type, // INCOME/EXPENSE
            description: tx.description,
            date: tx.date,
            dueDate: tx.dueDate,
            originalAmount: outstanding,
            originalCurrency: tx.currency,
            amount: val,
            isOverdue,
            paidAmount: tx.amountPaid || 0,
            totalAmount: tx.amount,
            paymentCount: tx.allocations?.length || 0,
            payments: tx.allocations?.map(a => ({
                date: a.payment.date,
                reference: a.payment.reference,
                method: a.payment.method,
                currency: a.payment.currency,
                amount: a.allocatedAmount
            })) || []
        });
    });

    // Process Invoices
    invoices.forEach(inv => {
        const contactId = inv.vendorId || inv.customerId;
        if (!contactId) return;
        const contact = contactMap.get(contactId);
        const entry = getContactEntry(contact);
        if (!entry) return;

        // Extract Tax First
        let taxAmount = 0;
        try {
            if (inv.lines) {
                const lines = JSON.parse(inv.lines);
                if (lines.taxAmount) taxAmount = Number(lines.taxAmount);
            }
        } catch (e) {}

        // Adjust amounts: The user treats 'Monto Total' as Base for Taxable Invoices
        // So we add Tax to Outstanding and Total for report visualization
        const adjustedOutstanding = inv.outstanding + taxAmount;
        const adjustedTotal = inv.total + taxAmount;

        const val = convert(adjustedOutstanding, inv.currency);
        
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.issueDate);
        const isOverdue = dueDate < today && adjustedOutstanding > 0.01;
        
        entry.totalPending += val;
        if (isOverdue) entry.overdue += val;
        else entry.dueSoon += val;
        
        entry.items.push({
            id: inv.id,
            type: 'INVOICE', // BILL/INVOICE
            docType: 'Factura',
            taxAmount: taxAmount,
            flow: inv.type === 'BILL' ? 'EXPENSE' : 'INCOME',
            description: `${inv.type === 'BILL' ? 'Factura Prov.' : 'Factura'} ${inv.code}`,
            date: inv.issueDate,
            dueDate: inv.dueDate,
            originalAmount: adjustedOutstanding,
            originalCurrency: inv.currency,
            amount: val,
            isOverdue,
            paidAmount: inv.total - inv.outstanding, // Actual paid amount
            totalAmount: adjustedTotal,
            paymentCount: inv.payments?.length || 0,
            payments: inv.payments?.map(p => ({
                date: p.payment.date,
                reference: p.payment.reference,
                method: p.payment.method,
                currency: p.payment.currency,
                amount: p.allocatedAmount
            })) || []
        });
    });

    const result = Array.from(contacts.values()).sort((a, b) => b.totalPending - a.totalPending);

    res.json({ success: true, data: result });

  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
