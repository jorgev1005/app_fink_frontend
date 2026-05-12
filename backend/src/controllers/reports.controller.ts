import { Request, Response } from 'express';
import prisma from '../config/database';
import { getLatestExchangeRate } from '../services/exchangeRate.service';
import { getProjectAccessFilter } from '../utils/projectAccess';

export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, currency = 'BS' } = req.query;
    
    const where: any = {
      status: 'COMPLETED',
      ...getProjectAccessFilter(req.user!)
    };

    if (projectId) where.projectId = String(projectId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        type: true,
        amountBs: true,
        amountUsd: true,
        projectId: true,
        project: { select: { name: true } }
      }
    });

    // Aggregate
    const global = { income: 0, expense: 0 };
    const byProject: Record<string, { name: string, income: number, expense: number }> = {};

    transactions.forEach(t => {
      const amount = currency === 'USD' ? (t.amountUsd || 0) : (t.amountBs || 0);
      
      // Initialize project entry
      if (!byProject[t.projectId]) {
        byProject[t.projectId] = { name: t.project.name, income: 0, expense: 0 };
      }

      if (t.type === 'INCOME' || t.type === 'COLLECTION') {
        global.income += Number(amount);
        byProject[t.projectId].income += Number(amount);
      } else if (t.type === 'EXPENSE' || t.type === 'PAYMENT') {
        global.expense += Number(amount);
        byProject[t.projectId].expense += Number(amount);
      }
    });

    res.json({
      success: true,
      data: {
        global,
        byProject: Object.values(byProject)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getAnalyticsTrend = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, currency = 'BS', interval = 'day' } = req.query;
    
    const where: any = {
      status: 'COMPLETED',
      ...getProjectAccessFilter(req.user!)
    };

    if (projectId) where.projectId = String(projectId);
    
    // Default to last 30 days if not specified
    const end = endDate ? new Date(String(endDate)) : new Date();
    const start = startDate ? new Date(String(startDate)) : new Date(new Date().setDate(end.getDate() - 30));
    
    where.date = { gte: start, lte: end };

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        date: true,
        type: true,
        amountBs: true,
        amountUsd: true,
      },
      orderBy: { date: 'asc' }
    });

    // Group by interval
    const grouped: Record<string, { date: string, income: number, expense: number }> = {};

    transactions.forEach(t => {
      const d = new Date(t.date);
      let key = '';
      if (interval === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = d.toISOString().split('T')[0];
      }

      if (!grouped[key]) grouped[key] = { date: key, income: 0, expense: 0 };

      const amount = currency === 'USD' ? (t.amountUsd || 0) : (t.amountBs || 0);

      if (t.type === 'INCOME' || t.type === 'COLLECTION') {
        grouped[key].income += Number(amount);
      } else if (t.type === 'EXPENSE' || t.type === 'PAYMENT') {
        grouped[key].expense += Number(amount);
      }
    });

    // Fill gaps? Optional. For now just return sorted keys.
    const result = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getAnalyticsCategories = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, currency = 'BS', type = 'EXPENSE' } = req.query;
    
    const where: any = {
      status: 'COMPLETED',
      ...getProjectAccessFilter(req.user!),
      // Filter by type (EXPENSE or INCOME) to prevent double counting with PAYMENT/COLLECTION
      type: type === 'EXPENSE' ? 'EXPENSE' : 'INCOME'
    };

    if (projectId) where.projectId = String(projectId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    const transactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        date: true,
        description: true,
        category: true,
        categoryRef: { select: { name: true } },
        amountBs: true,
        amountUsd: true,
      }
    });

    const grouped: Record<string, { value: number, transactions: any[] }> = {};

    transactions.forEach(t => {
      const catName = t.categoryRef?.name || t.category || 'Sin Categoría';
      const amount = currency === 'USD' ? (t.amountUsd || 0) : (t.amountBs || 0);
      if (!grouped[catName]) grouped[catName] = { value: 0, transactions: [] };
      grouped[catName].value += Number(amount);
      grouped[catName].transactions.push(t);
    });

    const result = Object.entries(grouped)
      .map(([name, data]) => ({ name, value: data.value, transactions: data.transactions }))
      .sort((a, b) => b.value - a.value);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getAnalyticsPaymentMethods = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, currency = 'BS' } = req.query;
    
    const where: any = {
      status: 'COMPLETED',
      ...getProjectAccessFilter(req.user!)
    };

    if (projectId) where.projectId = String(projectId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        method: true,
        amount: true,
        currency: true,
      }
    });

    // We need exchange rate to convert payment amounts if they are mixed currencies
    // This is tricky because payments don't store historical USD/BS value always, 
    // but we can try to approximate or use current rate if not stored.
    // Actually Payment table has `amount` and `currency`.
    // To convert to requested currency, we need a rate.
    // Let's fetch latest rate for simplicity or use a service.
    const rate = await getLatestExchangeRate();
    const usdToBs = rate?.usdToBs || 1;

    const grouped: Record<string, number> = {};

    payments.forEach(p => {
      let amount = Number(p.amount);
      // Convert to requested currency
      if (currency === 'BS') {
        if (p.currency === 'USD') amount = amount * usdToBs;
        else if (p.currency === 'EUR') amount = amount * (rate?.eurToBs || 1);
      } else { // USD
        if (p.currency === 'BS') amount = amount / usdToBs;
        else if (p.currency === 'EUR') amount = amount * (rate?.eurToUsd || 1);
      }

      const method = p.method || 'OTHER';
      grouped[method] = (grouped[method] || 0) + amount;
    });

    const result = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

// Helper to compute next occurrence
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

export const getCashFlowForecast = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, currency = 'BS' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: { message: 'Start and End date are required' } });
    }

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));
    
    // 1. Get Exchange Rate
    const rate = await getLatestExchangeRate();
    const usdToBs = rate?.usdToBs || 1;

    // Helper to convert to requested currency
    const convert = (amount: number, fromCurrency: string) => {
      if (currency === 'BS') {
        if (fromCurrency === 'USD') return amount * usdToBs;
        if (fromCurrency === 'EUR') return amount * (rate?.eurToBs || 1);
        return amount;
      } else { // USD
        if (fromCurrency === 'BS') return amount / usdToBs;
        if (fromCurrency === 'EUR') return amount * (rate?.eurToUsd || 1);
        return amount;
      }
    };

    // --- FETCH PAYABLES (EXPENSES) ---

    // 2. Pending Invoices (Payables - BILL)
    const payableWhere: any = {
      type: 'BILL', 
      status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      dueDate: { lte: end },
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) payableWhere.projectId = String(projectId);

    const payableInvoices = await prisma.invoice.findMany({
      where: payableWhere,
      select: { id: true, code: true, issueDate: true, dueDate: true, outstanding: true, currency: true, project: { select: { name: true } } }
    });

    // 3. Pending Transactions (Expenses)
    const expenseTxWhere: any = {
      status: 'PENDING',
      paymentStatus: { not: 'PAID' },
      type: 'EXPENSE',
      dueDate: { lte: end },
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) expenseTxWhere.projectId = String(projectId);

    const expenseTransactions = await prisma.transaction.findMany({
      where: expenseTxWhere,
      select: { id: true, description: true, date: true, dueDate: true, amount: true, amountPaid: true, currency: true, project: { select: { name: true } } }
    });

    // 4. Recurring Expenses (BILL)
    const recurringBillWhere: any = { isActive: true, type: 'BILL', ...getProjectAccessFilter(req.user!) };
    if (projectId) recurringBillWhere.projectId = String(projectId);
    const recurringBills = await prisma.recurringRule.findMany({
      where: recurringBillWhere,
      include: { project: { select: { name: true } } }
    });

    // --- FETCH RECEIVABLES (INCOME) ---

    // 5. Pending Invoices (Receivables - INVOICE)
    const receivableWhere: any = {
      type: 'INVOICE', 
      status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      dueDate: { lte: end },
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) receivableWhere.projectId = String(projectId);

    const receivableInvoices = await prisma.invoice.findMany({
      where: receivableWhere,
      select: { id: true, code: true, issueDate: true, dueDate: true, outstanding: true, currency: true, project: { select: { name: true } } }
    });

    // 6. Pending Transactions (Income)
    const incomeTxWhere: any = {
      status: 'PENDING',
      paymentStatus: { not: 'PAID' },
      type: 'INCOME',
      dueDate: { lte: end },
      ...getProjectAccessFilter(req.user!)
    };
    if (projectId) incomeTxWhere.projectId = String(projectId);

    const incomeTransactions = await prisma.transaction.findMany({
      where: incomeTxWhere,
      select: { id: true, description: true, date: true, dueDate: true, amount: true, amountPaid: true, currency: true, project: { select: { name: true } } }
    });

    // 7. Recurring Income (INVOICE)
    const recurringInvoiceWhere: any = { isActive: true, type: 'INVOICE', ...getProjectAccessFilter(req.user!) };
    if (projectId) recurringInvoiceWhere.projectId = String(projectId);
    const recurringInvoices = await prisma.recurringRule.findMany({
      where: recurringInvoiceWhere,
      include: { project: { select: { name: true } } }
    });

    // --- PROCESS ITEMS ---

    const processItems = (items: any[], type: 'EXPENSE' | 'INCOME', source: 'INVOICE' | 'TRANSACTION' | 'RECURRING') => {
        return items.map(i => {
            let amount = 0;
            let date = new Date();
            let description = '';
            let originalAmount = 0;
            let originalCurrency = 'USD';
            let issueDate = null;

            if (source === 'INVOICE') {
                amount = convert(i.outstanding, i.currency);
                date = new Date(i.dueDate);
                issueDate = i.issueDate;
                description = `Factura ${i.code} (${i.project.name})`;
                originalAmount = i.outstanding;
                originalCurrency = i.currency;
            } else if (source === 'TRANSACTION') {
                const outstanding = i.amount - (i.amountPaid || 0);
                amount = convert(outstanding, i.currency);
                date = new Date(i.dueDate);
                issueDate = i.date;
                description = `${i.description} (${i.project.name})`;
                originalAmount = outstanding;
                originalCurrency = i.currency;
            }

            return {
                id: i.id,
                description,
                date,
                issueDate,
                amount,
                originalAmount,
                originalCurrency,
                type: source,
                flow: type
            };
        });
    };

    let allItems: any[] = [
        ...processItems(payableInvoices, 'EXPENSE', 'INVOICE'),
        ...processItems(expenseTransactions, 'EXPENSE', 'TRANSACTION'),
        ...processItems(receivableInvoices, 'INCOME', 'INVOICE'),
        ...processItems(incomeTransactions, 'INCOME', 'TRANSACTION')
    ];

    // Process Recurring
    const projectRecurring = (rules: any[], flow: 'EXPENSE' | 'INCOME') => {
        rules.forEach(rule => {
            let nextRun = new Date(rule.nextRunAt);
            const dueDays = rule.dueDays || 0;
            let iterations = 0;
            while (nextRun <= end && iterations < 100) {
                const paymentDate = new Date(nextRun);
                paymentDate.setDate(paymentDate.getDate() + dueDays);

                if (paymentDate >= start && paymentDate <= end) {
                    const amount = convert(rule.amount, rule.currency);
                    allItems.push({
                        id: `recurring-${rule.id}-${iterations}`,
                        description: `Recurrente: ${rule.name} (${rule.project.name})`,
                        date: paymentDate,
                        executionDate: new Date(nextRun),
                        amount,
                        originalAmount: rule.amount,
                        originalCurrency: rule.currency,
                        type: 'RECURRING',
                        flow
                    });
                }
                nextRun = computeNext(nextRun, rule.frequency, rule.interval);
                iterations++;
            }
        });
    };

    projectRecurring(recurringBills, 'EXPENSE');
    projectRecurring(recurringInvoices, 'INCOME');

    // Sort all items
    allItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // --- GROUPING ---

    const overdueItems = allItems.filter(i => new Date(i.date) < start);
    const futureItems = allItems.filter(i => new Date(i.date) >= start);

    // Overdue Summary
    const overdueIncome = overdueItems.filter(i => i.flow === 'INCOME').reduce((s, i) => s + i.amount, 0);
    const overdueExpense = overdueItems.filter(i => i.flow === 'EXPENSE').reduce((s, i) => s + i.amount, 0);
    const overdueNet = overdueIncome - overdueExpense;

    // Weekly Breakdown
    const weeks: any[] = [];
    let weekStart = new Date(start);
    let weekIndex = 1;
    let runningBalance = overdueNet; 

    while (weekStart <= end) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const actualWeekEnd = weekEnd > end ? new Date(end) : weekEnd;

        const itemsInWeek = futureItems.filter(item => {
            const d = new Date(item.date);
            return d >= weekStart && d <= new Date(actualWeekEnd.setHours(23, 59, 59, 999));
        });

        const weekIncome = itemsInWeek.filter(i => i.flow === 'INCOME').reduce((s, i) => s + i.amount, 0);
        const weekExpense = itemsInWeek.filter(i => i.flow === 'EXPENSE').reduce((s, i) => s + i.amount, 0);
        
        const weekNet = weekIncome - weekExpense;
        const endBalance = runningBalance + weekNet;

        weeks.push({
            weekNumber: weekIndex,
            startDate: new Date(weekStart),
            endDate: new Date(actualWeekEnd),
            income: weekIncome,
            expense: weekExpense,
            net: weekNet,
            initialBalance: runningBalance,
            finalBalance: endBalance,
            items: itemsInWeek
        });

        runningBalance = endBalance;
        weekStart.setDate(weekStart.getDate() + 7);
        weekIndex++;
    }

    res.json({
      success: true,
      data: {
        currency,
        summary: {
            totalIncome: allItems.filter(i => i.flow === 'INCOME').reduce((s, i) => s + i.amount, 0),
            totalExpense: allItems.filter(i => i.flow === 'EXPENSE').reduce((s, i) => s + i.amount, 0),
            netFlow: allItems.filter(i => i.flow === 'INCOME').reduce((s, i) => s + i.amount, 0) - allItems.filter(i => i.flow === 'EXPENSE').reduce((s, i) => s + i.amount, 0)
        },
        breakdown: {
          overdue: { 
              income: overdueIncome, 
              expense: overdueExpense, 
              net: overdueNet, 
              items: overdueItems 
          },
          weekly: weeks
        }
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};

export const getProductStats = async (req: Request, res: Response) => {
  try {
    const { projectId, startDate, endDate, currency = 'BS' } = req.query;
    
    const where: any = {
      status: 'COMPLETED',
      ...getProjectAccessFilter(req.user!)
    };

    if (projectId) where.projectId = String(projectId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    // 1. Fetch all products to match names
    const products = await prisma.product.findMany({
      where: {
        ...(projectId ? { projectId: String(projectId) } : {}),
        ...getProjectAccessFilter(req.user!)
      },
      select: { id: true, name: true, stock: true, unitPrice: true, currency: true }
    });

    const productMap = new Map(products.map(p => [p.name.toLowerCase().trim(), p]));
    const stats: Record<string, { 
      id: string, 
      name: string, 
      stock: number, 
      boughtAmount: number, 
      soldAmount: number,
      boughtCount: number,
      soldCount: number
    }> = {};

    // Initialize stats
    products.forEach(p => {
      stats[p.id] = {
        id: p.id,
        name: p.name,
        stock: p.stock,
        boughtAmount: 0,
        soldAmount: 0,
        boughtCount: 0,
        soldCount: 0
      };
    });

    // 2. Fetch Transactions with Entries
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        entries: true
      }
    });

    // Helper to convert currency
    // Note: This is an approximation using the transaction's stored amounts
    // Ideally we should use the transaction's exchange rate or a historical one.
    // For simplicity, we use the transaction's amountBs/amountUsd fields if available, 
    // or derive from amount + currency.
    
    transactions.forEach(tx => {
      const isExpense = tx.type === 'EXPENSE' || tx.type === 'PAYMENT';
      const isIncome = tx.type === 'INCOME' || tx.type === 'COLLECTION';
      
      if (!isExpense && !isIncome) return;

      tx.entries.forEach(entry => {
        if (!entry.description) return;
        const normName = entry.description.toLowerCase().trim();
        const product = productMap.get(normName);
        
        if (product) {
          // Determine amount in requested currency
          // Entry has debitAmount/creditAmount in Account currency? 
          // Actually TransactionEntry amounts are usually in the Transaction currency or Account currency?
          // The schema says `debitAmount` Float. 
          // In `QuickTransaction`, we push `amt` which is calculated from `lineTotal`.
          // `lineTotal` is in the transaction currency.
          
          // We need to convert this entry amount to the requested report currency.
          // We can use the parent transaction's implicit rate: tx.amountBs / tx.amountUsd
          
          let amount = Math.max(entry.debitAmount, entry.creditAmount);
          
          // Convert to requested currency
          if (currency === 'BS') {
             if (tx.currency === 'USD') amount = amount * (tx.amountBs / (tx.amountUsd || 1));
             else if (tx.currency === 'EUR') amount = amount * (tx.amountBs / (tx.amountEur || 1));
             // if BS, amount is already BS
          } else { // USD
             if (tx.currency === 'BS') amount = amount / (tx.amountBs / (tx.amountUsd || 1));
             else if (tx.currency === 'EUR') amount = amount * (tx.amountUsd / (tx.amountEur || 1));
             // if USD, amount is already USD
          }

          // Fallback if conversion failed (e.g. zero amounts)
          if (isNaN(amount)) amount = 0;

          if (isExpense) {
            stats[product.id].boughtAmount += amount;
            stats[product.id].boughtCount += 1;
          } else {
            stats[product.id].soldAmount += amount;
            stats[product.id].soldCount += 1;
          }
        }
      });
    });

    // 3. Fetch Invoices (if they have lines JSON)
    // This is more complex because lines is a JSON string.
    // We will skip this for now to keep it simple and fast, 
    // assuming QuickTransaction is the primary source as per context.
    // If needed, we can parse Invoice.lines.

    const result = Object.values(stats).sort((a, b) => b.soldAmount - a.soldAmount);

    res.json({ success: true, data: result });

  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
};
