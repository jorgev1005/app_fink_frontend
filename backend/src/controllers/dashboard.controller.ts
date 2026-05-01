import { Request, Response } from 'express';
import prisma from '../config/database';
import { convertCurrency, getLatestExchangeRate } from '../services/exchangeRate.service';
import { getProjectAccessFilter } from '../utils/projectAccess';

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const projectFilter = user.role === 'ADMIN' ? {} : { users: { some: { userId: user.id } } };

    // Obtener todos los proyectos del usuario
    const projects = await prisma.project.findMany({
      where: {
        ...projectFilter,
        status: 'ACTIVE'
      },
      include: {
        transactions: {
          where: {
            status: 'COMPLETED'
          }
        },
        documents: true,
        // Incluir cuentas para sumar sus saldos al dashboard
        accounts: {
          where: {
            isActive: true
          }
        },
        // Incluir facturas NO posteadas (Borradores/Abiertas) para conteo de pendientes
        invoices: {
          where: {
            status: { in: ['OPEN', 'DRAFT', 'PARTIALLY_PAID'] },
            outstanding: { gt: 0 }
          }
        }
      }
    });

    // Calcular totales consolidados por moneda
  let totalIncomeUsd = 0;
  let totalExpensesUsd = 0;
  let totalIncomeBs = 0;
  let totalExpensesBs = 0;
  let pendingDocuments = 0;
  let overdueDocuments = 0;
    // Totales de saldos provenientes de cuentas (balances de cuentas)
    let totalAccountsBalanceUsd = 0;
    let totalAccountsBalanceBs = 0;

  // Parse query params: ?currency=BS|USD & ?rateSource=BCV|BINANCE|CUSTOM or ?exchangeRateId=<id>
  const requestedCurrency = (req.query.currency as string | undefined)?.toUpperCase();
  const rateSourceParam = (req.query.rateSource as string | undefined)?.toUpperCase() as 'BCV' | 'BINANCE' | 'CUSTOM' | undefined;
  const exchangeRateIdParam = (req.query.exchangeRateId as string | undefined) || undefined;

    projects.forEach(project => {
      project.transactions.forEach((t: any) => {
        if (t.type === 'INCOME') {
          totalIncomeUsd += Number(t.amountUsd || 0);
          totalIncomeBs += Number(t.amountBs || 0);
        } else if (t.type === 'EXPENSE') {
          totalExpensesUsd += Number(t.amountUsd || 0);
          totalExpensesBs += Number(t.amountBs || 0);
        }

        // Sumar también las transacciones pendientes de pago a los contadores
        if (t.paymentStatus === 'PENDING' || t.paymentStatus === 'PARTIAL') {
          const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
          if (isOverdue) {
            overdueDocuments++;
          } else {
            pendingDocuments++;
          }
        }
      });

      // Dejar la suma de saldos de cuentas para después (necesitamos la tasa seleccionada
      // para convertir saldos que sólo están en Bs a su equivalente en USD).

      pendingDocuments += project.documents.filter((d: any) => d.status === 'PENDING').length;
      overdueDocuments += project.documents.filter((d: any) => d.status === 'OVERDUE').length;

      // Sumar facturas NO posteadas (Borradores)
      if (project.invoices) {
        project.invoices.forEach((inv: any) => {
           // Skip posted invoices here (handled by transaction loop) - though query filters them out usually, double check safety
           if (inv.status === 'POSTED' || inv.status === 'PAID') return;

           const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date();
           if (isOverdue) overdueDocuments++;
           else pendingDocuments++;
        });
      }
    });

  // Note: we will compute final balances (including account conversions) after we build
  // `projectsData` because we need the selected exchange rate to convert account balances
  // that are recorded only in Bs into USD equivalents.
  let totalBalanceRequested: number | undefined = undefined;
  let rateUsed: any = null;

    // Obtener transacciones recientes
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: req.user!.id
      },
      include: {
        project: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    // Obtener insights de IA
    const aiInsights = await prisma.aIInsight.findMany({
      where: {
        isRead: false,
        validUntil: {
          gte: new Date()
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

  // Determine which source/id to use for conversions (may be undefined)
  const sourceToUse = exchangeRateIdParam || rateSourceParam;
  // Fetch the rate to use for conversions (will fallback to latest available)
  const rateForConversion = await getLatestExchangeRate(sourceToUse);

  // Map projects including per-project totals (income/expenses/balance)
  const projectsData = await Promise.all(projects.map(async p => {
      // Compute totals in both USD and BS (amountUsd and amountBs fields)
      const incomeUsd = p.transactions
        .filter((t: any) => t.type === 'INCOME')
        .reduce((sum: number, t: any) => sum + Number(t.amountUsd || 0), 0);

      const expensesUsd = p.transactions
        .filter((t: any) => t.type === 'EXPENSE')
        .reduce((sum: number, t: any) => sum + Number(t.amountUsd || 0), 0);

      const incomeBs = p.transactions
        .filter((t: any) => t.type === 'INCOME')
        .reduce((sum: number, t: any) => sum + Number(t.amountBs || 0), 0);

      const expensesBs = p.transactions
        .filter((t: any) => t.type === 'EXPENSE')
        .reduce((sum: number, t: any) => sum + Number(t.amountBs || 0), 0);

      // Calcular saldos de cuentas usando la moneda configurada y la tasa actual
      // Solo consideramos cuentas de disponibilidad (BANK, WALLET, EXCHANGE) para el balance del dashboard,
      // coincidiendo con lo que se muestra en la lista de cuentas.
      let accountsBalanceBs = 0;
      let accountsBalanceUsd = 0;
      const usdToBs = rateForConversion ? Number(rateForConversion.usdToBs || 0) : 0;
      const allowedSubTypes = ['BANK', 'WALLET', 'EXCHANGE', 'FINANCIAL', 'CASH'];

      // Filtrar solo cuentas activas
      (p.accounts || []).filter((a: any) => a.isActive !== false).forEach((a: any) => {
        const sub = (a.subType || a.subtype || '').toString().toUpperCase();
        if (!allowedSubTypes.includes(sub)) return;

        const currency = a.currency || 'BS';
        const balBs = Number(a.balanceBs || 0);
        const balUsd = Number(a.balanceUsd || 0);

        if (currency === 'USD') {
          // Cuenta en USD
          accountsBalanceUsd += balUsd;
          // Convertir a Bs para el total en Bs
          if (usdToBs > 0) {
            accountsBalanceBs += balUsd * usdToBs;
          } else {
            accountsBalanceBs += balBs; 
          }
        } else {
          // Cuenta en Bs (o default)
          accountsBalanceBs += balBs;
          // Convertir a USD para el total en USD
          if (usdToBs > 0) {
            accountsBalanceUsd += balBs / usdToBs;
          }
        }
      });

      // Variable legacy para compatibilidad (ya no se usa la heurística)
      const accountsBalanceBsConfigured = 0;

      const projectResult: any = {
        id: p.id,
        name: p.name,
        code: p.code,
        color: p.color,
        transactionCount: p.transactions.length,
        incomeUsd,
        expensesUsd,
        balanceUsd: accountsBalanceUsd, // Balance should be the current accounts balance (Cash Position)
        incomeBs,
        expensesBs,
        balanceBs: accountsBalanceBs, // Balance should be the current accounts balance (Cash Position)
        accountsBalanceUsd,
        accountsBalanceBs,
        // suma de balances en Bs considerados como 'configurados en Bs' (solo saldos positivos por cuenta configurada en Bs)
        accountsBalanceBsConfigured
      };

      // If a requestedCurrency was provided, compute per-project converted balance too
      const sourceToUseProject = exchangeRateIdParam || rateSourceParam;
      if (requestedCurrency === 'BS') {
        try {
          const converted = await convertCurrency(accountsBalanceUsd, 'USD', 'BS', sourceToUseProject);
          projectResult.requestedCurrencyBalance = accountsBalanceBs + converted;
        } catch (e) {
          projectResult.requestedCurrencyBalance = null;
        }
      } else if (requestedCurrency === 'USD') {
        try {
          const converted = await convertCurrency(accountsBalanceBs, 'BS', 'USD', sourceToUseProject);
          projectResult.requestedCurrencyBalance = accountsBalanceUsd + converted;
        } catch (e) {
          projectResult.requestedCurrencyBalance = null;
        }
      }

      return projectResult;
  }));

  // Recompute account totals from project-level data (these include conversions where needed)
  totalAccountsBalanceUsd = projectsData.reduce((s: number, p: any) => s + Number(p.accountsBalanceUsd || 0), 0);
  totalAccountsBalanceBs = projectsData.reduce((s: number, p: any) => s + Number(p.accountsBalanceBs || 0), 0);

  // Recompute overall balances including accounts
  const totalBalanceUsd = totalAccountsBalanceUsd;
  const totalBalanceBs = totalAccountsBalanceBs;

  // Compute converted aggregate based on requested currency & selected source (if any)
  try {
    if (requestedCurrency === 'BS') {
      const converted = await convertCurrency(totalBalanceUsd, 'USD', 'BS', sourceToUse);
      totalBalanceRequested = totalBalanceBs + converted;
      rateUsed = rateForConversion;
    } else if (requestedCurrency === 'USD') {
      const converted = await convertCurrency(totalBalanceBs, 'BS', 'USD', sourceToUse);
      totalBalanceRequested = totalBalanceUsd + converted;
      rateUsed = rateForConversion;
    }
  } catch (e) {
    // ignore conversion errors; leave requested undefined
  }

    // Normalize rateUsed.source so frontend can compare against UI keys (e.g. 'BINANCE')
    try {
      if (rateUsed && (rateUsed as any).source === 'API') {
        (rateUsed as any).source = 'BINANCE';
      }
    } catch {}

    res.json({
      success: true,
      data: {
        summary: {
          totalIncomeUsd,
          totalExpensesUsd,
          totalBalanceUsd,
          totalIncomeBs,
          totalExpensesBs,
          totalBalanceBs,
          // When client requests a specific currency, `requestedCurrencyTotal` contains the aggregated
          // total converted to that currency using the selected rate source. `rateUsed` contains the
          // exchange rate row used (if any).
          requestedCurrency: requestedCurrency || null,
          requestedCurrencyTotal: totalBalanceRequested,
          rateUsed,
          projectCount: projects.length,
          pendingDocuments,
          overdueDocuments
        },
        projects: projectsData,
        recentTransactions,
        aiInsights
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, stack: error.stack, full: error }
    });
  }
};

export const getProjectDashboard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        id,
        users: {
          some: {
            userId: req.user!.id
          }
        }
      },
      include: {
        transactions: {
          where: { status: 'COMPLETED' },
          orderBy: { date: 'desc' }
        },
        documents: {
          orderBy: { dueDate: 'asc' }
        },
        accounts: true
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Proyecto no encontrado' }
      });
    }

    // Calcular métricas
    const income = project.transactions
      .filter((t: any) => t.type === 'INCOME')
      .reduce((sum: number, t: any) => sum + Number(t.amountUsd), 0);

    const expenses = project.transactions
      .filter((t: any) => t.type === 'EXPENSE')
      .reduce((sum: number, t: any) => sum + Number(t.amountUsd), 0);

    // Saldos de cuentas activas y de tipo permitido del proyecto
    const allowedSubTypes = ['BANK', 'WALLET', 'EXCHANGE', 'FINANCIAL', 'CASH'];
    const activeAccounts = (project.accounts || []).filter((a: any) => a.isActive !== false && allowedSubTypes.includes((a.subType || a.subtype || '').toString().toUpperCase()));
    const accountsBalanceUsd = activeAccounts.reduce((s: number, a: any) => s + Number(a.balanceUsd || 0), 0);
    const accountsBalanceBs = activeAccounts.reduce((s: number, a: any) => s + Number(a.balanceBs || 0), 0);

    // Gastos por categoría
    const expensesByCategory: any = {};
    project.transactions
      .filter((t: any) => t.type === 'EXPENSE')
      .forEach((t: any) => {
        const category = t.category || 'Sin categoría';
        expensesByCategory[category] = (expensesByCategory[category] || 0) + Number(t.amountUsd);
      });

    // Flujo de caja mensual (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyCashFlow = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthIncome = project.transactions
        .filter((t: any) => t.type === 'INCOME' && t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum: number, t: any) => sum + Number(t.amountUsd), 0);

      const monthExpenses = project.transactions
        .filter((t: any) => t.type === 'EXPENSE' && t.date >= monthStart && t.date <= monthEnd)
        .reduce((sum: number, t: any) => sum + Number(t.amountUsd), 0);

      monthlyCashFlow.unshift({
        month: date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        income: monthIncome,
        expenses: monthExpenses,
        balance: monthIncome - monthExpenses
      });
    }

    res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          code: project.code,
          color: project.color
        },
        summary: {
          income,
          expenses,
          // Incluir el saldo de cuentas en el balance final del proyecto
          balance: income - expenses + accountsBalanceUsd,
          transactionCount: project.transactions.length,
          documentCount: project.documents.length,
          accountCount: project.accounts.length,
          accountsBalanceUsd,
          accountsBalanceBs
        },
        expensesByCategory,
        monthlyCashFlow,
        recentTransactions: project.transactions.slice(0, 10),
        upcomingDocuments: project.documents
          .filter((d: any) => d.status === 'PENDING' && d.dueDate)
          .slice(0, 5)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
};
