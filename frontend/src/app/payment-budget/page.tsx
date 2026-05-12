'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '@/lib/api';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, RefreshCw, Building2, Wallet, CreditCard, Printer, CheckCircle2, Clock, ArrowLeft, Home, DollarSign, Grip, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FlowItem {
  id: string; // unique mapped id
  originalId: string;
  source: 'INVOICE' | 'SCHEDULED' | 'TRANSACTION';
  projectId: string;
  contactName: string;
  type: 'INCOME' | 'EXPENSE';
  status: 'PAID' | 'PENDING' | 'PARTIAL' | 'SCHEDULED';
  code: string;
  dueDate: string | null;
  currency: string;
  totalAmount: number;
  outstandingAmount: number;
  updatedAt?: string;
  isPaid: boolean;
}

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  subType: string;
  balanceBs: number;
  balanceUsd: number;
  balanceEur: number;
  projectId: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface RateEntry {
  usdToBs?: number;
  eurToBs?: number;
  eurToUsd?: number;
  date?: string;
}

type RateSource = 'BCV' | 'BCV_EUR' | 'BINANCE' | 'CUSTOM';
type RateSelection = RateSource | 'GENERAL';

const RATE_SOURCE_OPTIONS: RateSource[] = ['BCV', 'BCV_EUR', 'BINANCE', 'CUSTOM'];

export default function PaymentBudgetPage() {
  const router = useRouter();
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // Data states
  const [items, setItems] = useState<FlowItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [hideEmptyAccounts, setHideEmptyAccounts] = useState<boolean>(true);

  // Sorting
  const [sortAccountBy, setSortAccountBy] = useState<{key: 'name'|'balance', dir: 'asc'|'desc'}>({key: 'name', dir: 'asc'});
  const [sortExpenseBy, setSortExpenseBy] = useState<{key: 'contact'|'amount'|'date', dir: 'asc'|'desc'}>({key: 'date', dir: 'asc'});

  // Selections / Allocations (Store in Base USD)
  const [fundAllocations, setFundAllocations] = useState<Record<string, number>>({});
  const [expenseAllocations, setExpenseAllocations] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [currencyView, setCurrencyView] = useState<string>('USD');
  const [ratesBySource, setRatesBySource] = useState<{ BCV?: RateEntry; BINANCE?: RateEntry; CUSTOM?: RateEntry }>({});
  const [fundRateSource, setFundRateSource] = useState<RateSource>(() => {
    if (typeof window === 'undefined') return 'BCV';
    const stored = localStorage.getItem('payment_budget_fund_rate_source');
    return RATE_SOURCE_OPTIONS.includes(stored as RateSource) ? (stored as RateSource) : 'BCV';
  });
  const [expenseRateSource, setExpenseRateSource] = useState<RateSource>(() => {
    if (typeof window === 'undefined') return 'BCV';
    const stored = localStorage.getItem('payment_budget_expense_rate_source');
    return RATE_SOURCE_OPTIONS.includes(stored as RateSource) ? (stored as RateSource) : 'BCV';
  });
  const [accountRateOverrides, setAccountRateOverrides] = useState<Record<string, RateSelection>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('payment_budget_account_rate_overrides') || '{}');
    } catch {
      return {};
    }
  });
  const [expenseRateOverrides, setExpenseRateOverrides] = useState<Record<string, RateSelection>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('payment_budget_expense_rate_overrides') || '{}');
    } catch {
      return {};
    }
  });
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<Date>(() => new Date());

  const loadRateState = async () => {
    let selectedRate = 1;

    if (typeof window !== 'undefined') {
      const prRate = localStorage.getItem('selected_exchange_rate');
      if (prRate && !isNaN(Number(prRate))) {
        selectedRate = Number(prRate);
      }
      const v = localStorage.getItem('fink_currency');
      if (v) setCurrencyView(v);
    }

    try {
      const ratesRes = await api.exchangeRates.getLatestBySource();
      if (ratesRes.data?.success) {
        const nextRates = ratesRes.data.data || {};
        setRatesBySource(nextRates);
        if ((!selectedRate || selectedRate <= 0) && nextRates.BCV?.usdToBs) {
          selectedRate = Number(nextRates.BCV.usdToBs);
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates for payment budget', error);
    }

    setExchangeRate(selectedRate > 0 ? selectedRate : 1);
  };

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      await loadRateState();

      // Fetch projects
      const _t = Date.now();
      const projRes = await api.projects.getAll({ _t });
      if (projRes.data.success) {
        setProjects(projRes.data.data);
      }

      // Fetch accounts (Banks & Cash)
      const accRes = await api.accounts.getAll({ _t, isActive: true });
      if (accRes.data.success) {
        const fundAccounts = accRes.data.data.filter(
          (a: any) => a.type === 'ASSET' && (['CASH', 'BANK', 'WALLET', 'CASH_AND_EQUIVALENTS'].includes(a.subType))
        );
        setAccounts(fundAccounts);
      }

      // Fetch Transactions (include pending and partial expenses)
        const transRes = await api.transactions.getAll({ limit: 1500, type: 'EXPENSE', _t });

        const unifiedList: FlowItem[] = [];
        const defaultExpensesMap: Record<string, number> = {};

        const transData = transRes.data?.data || (Array.isArray(transRes.data) ? transRes.data : []);
        if (transData.length > 0) {
            const expenses = transData.filter((i: any) => 
                i.type === 'EXPENSE' && 
                i.paymentStatus !== 'PAID' && 
                !['CANCELLED', 'VOID', 'ELIMINADO', 'DRAFT', 'DELETED', 'ARCHIVED', 'ANULADO'].includes(i.status?.toUpperCase())
            );

            expenses.forEach((inv: any) => {
                const uid = `trans_${inv.id}`;
              const totalAmount = Number(inv.total) || Number(inv.amount) || 0;
              const amountPaid = Number(inv.amountPaid) || 0;
              const outstandingAmount = Math.max(0, Number(inv.outstanding ?? (totalAmount - amountPaid)) || 0);

              if (outstandingAmount <= 0.009) {
                return;
              }

                unifiedList.push({
                    id: uid,
                    originalId: inv.id,
                    source: 'TRANSACTION',
                    projectId: inv.projectId,
                    contactName: (inv.contactPerson?.name || inv.contact?.name || inv.partyName || inv.vendorName || inv.contactName || 'Proveedor / Sin especificar'),
                    type: 'EXPENSE',
                status: inv.paymentStatus === 'PARTIAL' ? 'PARTIAL' : 'PENDING',
                    code: inv.reference || inv.code || `TRX-${inv.id.slice(-4)}`,
                    dueDate: inv.dueDate || inv.date || inv.createdAt,
                    currency: inv.currency || 'USD',
                totalAmount,
                outstandingAmount,
                    updatedAt: inv.updatedAt,
                    isPaid: false
                });
            });
        }

        setItems(unifiedList);
      
      // Default: No auto-allocation to allow manual budget creation
      setFundAllocations({});
      setExpenseAllocations({});

    } catch (error) {
      console.error('Error fetching budget data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const onRateChange = () => {
      loadRateState();
    };

    window.addEventListener('preferredExchangeRateChanged', onRateChange as any);
    window.addEventListener('exchangeRatesLoaded', onRateChange as any);

    return () => {
      window.removeEventListener('preferredExchangeRateChanged', onRateChange as any);
      window.removeEventListener('exchangeRatesLoaded', onRateChange as any);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('payment_budget_fund_rate_source', fundRateSource);
  }, [fundRateSource]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('payment_budget_expense_rate_source', expenseRateSource);
  }, [expenseRateSource]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('payment_budget_account_rate_overrides', JSON.stringify(accountRateOverrides));
  }, [accountRateOverrides]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('payment_budget_expense_rate_overrides', JSON.stringify(expenseRateOverrides));
  }, [expenseRateOverrides]);

  useEffect(() => {
    setSummaryGeneratedAt(new Date());
  }, [selectedProjectId, dateRange.start, dateRange.end, fundAllocations, expenseAllocations, currencyView, fundRateSource, expenseRateSource, accountRateOverrides, expenseRateOverrides]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
     return accounts.filter(acc => {
       if (selectedProjectId !== 'ALL' && acc.projectId !== selectedProjectId && acc.projectId) return false;
       if (hideEmptyAccounts) {
         const totalVal = (acc.balanceUsd || 0) + (acc.balanceBs || 0) + (acc.balanceEur || 0);
         if (Math.abs(totalVal) < 0.01) return false;
       }
       return true;
     });
  }, [accounts, selectedProjectId, hideEmptyAccounts]);

  // Filtering Logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Project filter
      if (selectedProjectId !== 'ALL' && item.projectId !== selectedProjectId) return false;

      // 2. Date filter (based on dueDate)
      if (dateRange.start && dateRange.end && item.dueDate) {
          const invDate = parseISO(item.dueDate);
          const start = parseISO(dateRange.start);
          const end = parseISO(dateRange.end);
          end.setHours(23, 59, 59, 999);
          start.setHours(0, 0, 0, 0);
          if (invDate > end) return false;
      } else if (dateRange.start && item.dueDate) {
          const invDate = parseISO(item.dueDate);
          const start = parseISO(dateRange.start);
          start.setHours(0, 0, 0, 0);
          if (invDate < start) return false;
      } else if (dateRange.end && item.dueDate) {
          const invDate = parseISO(item.dueDate);
          const end = parseISO(dateRange.end);
          end.setHours(23, 59, 59, 999);
          if (invDate > end) return false;
      }
      return true;
    });
  }, [items, selectedProjectId, dateRange]);

  const getRateLabel = (source: RateSource) => {
    if (source === 'BCV_EUR') return 'EURO BCV';
    if (source === 'BINANCE') return 'Binance';
    if (source === 'CUSTOM') return 'Custom';
    return 'BCV USD';
  };

  const getRateValue = (source: RateSource) => {
    const configured = source === 'BCV_EUR'
      ? Number(ratesBySource.BCV?.eurToBs || 0)
      : Number(ratesBySource[source]?.usdToBs || 0);
    if (configured > 0) return configured;
    return exchangeRate > 0 ? exchangeRate : 1;
  };

  const getAccountRateSource = (accountId: string): RateSource => {
    const selected = accountRateOverrides[accountId];
    return selected && selected !== 'GENERAL' ? selected : fundRateSource;
  };

  const getExpenseRateSource = (itemId: string): RateSource => {
    const selected = expenseRateOverrides[itemId];
    return selected && selected !== 'GENERAL' ? selected : expenseRateSource;
  };

  const getUsdValue = (amount: number, currency: string, rate: number = exchangeRate) => {
    if (!amount) return 0;
    if (currency === 'BS' || currency === 'VES' || currency === 'FIAT') return amount / rate;
    if (currency === 'EUR') return amount; 
    return amount;
  };

  const getEquivalentViewValue = (usdAmount: number, rate: number = exchangeRate) => {
      if (currencyView === 'BS') return usdAmount * rate;
      return usdAmount;
  };

  const formatCustomMoney = (val: number, specCurr: string) => {
    if (specCurr === 'BS' || specCurr === 'VES' || specCurr === 'FIAT') {
      return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(val);
    }

    if (specCurr === 'EUR') {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
    }

    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatViewMoney = (usdValue: number, rate: number = exchangeRate) => {
    if (currencyView === 'BS') {
      return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(usdValue * rate);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdValue);
  };

  const formatRate = (rate: number) => {
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate);
  };

  const getAmountInCurrency = (usdAmount: number, currency: string, rate: number = exchangeRate) => {
    if (!usdAmount) return 0;
    if (currency === 'BS' || currency === 'VES' || currency === 'FIAT') return usdAmount * rate;
    if (currency === 'EUR') return usdAmount;
    return usdAmount;
  };

  const formatCrossHint = (viewValue: number, rate: number) => {
    if (currencyView === 'BS') {
      return `≈ $ ${(viewValue / rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `≈ Bs. ${(viewValue * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getAccountPrimaryCurrency = (account: Account) => {
    const activeCurrencies = [
      account.balanceUsd ? 'USD' : null,
      account.balanceBs ? 'BS' : null,
      account.balanceEur ? 'EUR' : null,
    ].filter(Boolean);

    if (activeCurrencies.length === 0 && ['USD', 'BS', 'EUR'].includes(account.currency)) {
      return account.currency as 'USD' | 'BS' | 'EUR';
    }

    if (activeCurrencies.length === 1) {
      return activeCurrencies[0] as 'USD' | 'BS' | 'EUR';
    }

    return 'MIXED';
  };

  const getRemainingAccountLabel = (account: Account, allocatedUsd: number, rate: number) => {
    const primaryCurrency = getAccountPrimaryCurrency(account);

    if (primaryCurrency === 'BS') {
      return formatCustomMoney((account.balanceBs || 0) - (allocatedUsd * rate), 'BS');
    }

    if (primaryCurrency === 'USD') {
      return formatCustomMoney((account.balanceUsd || 0) - allocatedUsd, 'USD');
    }

    if (primaryCurrency === 'EUR') {
      return formatCustomMoney((account.balanceEur || 0) - allocatedUsd, 'EUR');
    }

    return formatViewMoney(Math.max(0, ((account.balanceUsd || 0) + ((account.balanceBs || 0) / rate) + (account.balanceEur || 0)) - allocatedUsd), rate);
  };

  const rateSelectorLabel = (selected: RateSelection, generalSource: RateSource) => {
    if (selected === 'GENERAL') {
      return `General (${getRateLabel(generalSource)})`;
    }
    return `${getRateLabel(selected)} (${formatRate(getRateValue(selected))})`;
  };

  const sortedAccounts = useMemo(() => {
    const arr = [...filteredAccounts];
    arr.sort((a, b) => {
      let valA = 0; let valB = 0;
      if (sortAccountBy.key === 'name') {
         const cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
         return sortAccountBy.dir === 'asc' ? cmp : -cmp;
      } else {
         valA = (a.balanceUsd || 0) + ((a.balanceBs || 0) / getRateValue(getAccountRateSource(a.id))) + (a.balanceEur || 0);
         valB = (b.balanceUsd || 0) + ((b.balanceBs || 0) / getRateValue(getAccountRateSource(b.id))) + (b.balanceEur || 0);
         return sortAccountBy.dir === 'asc' ? valA - valB : valB - valA;
      }
    });
    return arr;
  }, [filteredAccounts, sortAccountBy, exchangeRate, accountRateOverrides, fundRateSource, ratesBySource]);

  const sortedExpenses = useMemo(() => {
    const arr = [...filteredItems];
    arr.sort((a, b) => {
      if (sortExpenseBy.key === 'contact') {
         const cmp = a.contactName.toLowerCase().localeCompare(b.contactName.toLowerCase());
         return sortExpenseBy.dir === 'asc' ? cmp : -cmp;
      } else if (sortExpenseBy.key === 'amount') {
        const valA = getUsdValue(a.outstandingAmount, a.currency, getRateValue(getExpenseRateSource(a.id)));
        const valB = getUsdValue(b.outstandingAmount, b.currency, getRateValue(getExpenseRateSource(b.id)));
         return sortExpenseBy.dir === 'asc' ? valA - valB : valB - valA;
      } else { // date
         const tA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
         const tB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
         return sortExpenseBy.dir === 'asc' ? tA - tB : tB - tA;
      }
    });
    return arr;
  }, [filteredItems, sortExpenseBy, exchangeRate, expenseRateOverrides, expenseRateSource, ratesBySource]);

  const expenses = sortedExpenses;

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, any[]> = {};
    expenses.forEach((item: any) => {
      const gName = item.contactName || 'Desconocido';
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(item);
    });

    return Object.entries(groups).map(([contactName, items]) => {
      const totalOutstandingUsd = (items).reduce((sum: number, i: any) => sum + getUsdValue(i.outstandingAmount, i.currency, getRateValue(getExpenseRateSource(i.id))), 0);
      const totalOutstandingView = (items).reduce((sum: number, i: any) => {
        const itemRate = getRateValue(getExpenseRateSource(i.id));
        return sum + getEquivalentViewValue(getUsdValue(i.outstandingAmount, i.currency, itemRate), itemRate);
      }, 0);
      return { contactName, items, totalOutstandingUsd, totalOutstandingView };
    });
  }, [expenses, exchangeRate, expenseRateOverrides, expenseRateSource, ratesBySource, currencyView]);

  const toggleGroup = (contactName: string) => {
    setExpandedGroups(prev => ({...prev, [contactName]: !prev[contactName]}));
  };

  const handlePayGroupAll = (groupItems: any[]) => {
    const newAllo = { ...expenseAllocations };
    groupItems.forEach((item: any) => {
      newAllo[item.id] = getUsdValue(item.outstandingAmount, item.currency, getRateValue(getExpenseRateSource(item.id)));
    });
    setExpenseAllocations(newAllo);
  };

  const handleSortAccount = (key: 'name'|'balance') => {
      setSortAccountBy(prev => ({
          key,
          dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
      }));
  };

  const handleSortExpense = (key: 'contact'|'amount'|'date') => {
      setSortExpenseBy(prev => ({
          key,
          dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
      }));
  };

  // Assign inputs handlers
    const handleFundChange = (accId: string, valStr: string, rate: number) => {
      let num = parseFloat(valStr) || 0;
      let usdVal = currencyView === 'BS' ? num / rate : num;
      setFundAllocations(prev => ({...prev, [accId]: usdVal}));
  };

    const handleExpenseChange = (expId: string, valStr: string, rate: number) => {
      let num = parseFloat(valStr) || 0;
      let usdVal = currencyView === 'BS' ? num / rate : num;
      setExpenseAllocations(prev => ({...prev, [expId]: usdVal}));
  };

  const openSummaryPrintWindow = (title: string) => {
    if (!summaryRef.current || typeof window === 'undefined') return null;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return null;

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(node => node.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          ${styles}
          <style>
            body {
              margin: 0;
              padding: 24px;
              background: #f8fafc;
              color: #0f172a;
              font-family: Arial, sans-serif;
            }
            .summary-print-shell {
              max-width: 1200px;
              margin: 0 auto;
            }
            @page {
              margin: 12mm;
            }
            @media print {
              body {
                padding: 0;
                background: #ffffff;
              }
            }
          </style>
        </head>
        <body>
          <div class="summary-print-shell">${summaryRef.current.outerHTML}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    return printWindow;
  };

  const printSummary = () => {
    const printWindow = openSummaryPrintWindow('Resumen del Presupuesto');
    if (!printWindow) return;

    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  // --- Calculations ---
  const totalFundsAssignedUsd = Object.values(fundAllocations).reduce((acc, val) => acc + (val || 0), 0);
  const totalExpensesAssignedUsd = Object.values(expenseAllocations).reduce((acc, val) => acc + (val || 0), 0);
  const remainingBudgetUsd = totalFundsAssignedUsd - totalExpensesAssignedUsd;
  const fundsGlobalRate = getRateValue(fundRateSource);
  const expensesGlobalRate = getRateValue(expenseRateSource);
  const selectedFundsCount = Object.values(fundAllocations).filter(val => (val || 0) > 0).length;
  const selectedExpensesCount = Object.values(expenseAllocations).filter(val => (val || 0) > 0).length;
  const selectedFundSummaries = sortedAccounts
    .filter(acc => (fundAllocations[acc.id] || 0) > 0)
    .map(acc => {
      const rateSource = getAccountRateSource(acc.id);
      const rate = getRateValue(rateSource);
      const allocatedUsd = fundAllocations[acc.id] || 0;
      const project = projects.find(p => p.id === acc.projectId);

      return {
        id: acc.id,
        name: acc.name,
        projectName: project?.name || 'Sin proyecto',
        allocatedUsd,
        allocatedBs: allocatedUsd * rate,
        rate,
        rateSource,
        remainingLabel: getRemainingAccountLabel(acc, allocatedUsd, rate),
        remainingView: formatViewMoney(Math.max(0, ((acc.balanceUsd || 0) + ((acc.balanceBs || 0) / rate) + (acc.balanceEur || 0)) - allocatedUsd), rate),
      };
    });
  const selectedExpenseSummaries = expenses
    .filter(item => (expenseAllocations[item.id] || 0) > 0)
    .map(item => {
      const rateSource = getExpenseRateSource(item.id);
      const rate = getRateValue(rateSource);
      const assignedUsd = expenseAllocations[item.id] || 0;
      const outstandingUsd = getUsdValue(item.outstandingAmount, item.currency, rate);
      const assignedInOriginalCurrency = getAmountInCurrency(assignedUsd, item.currency, rate);
      const remainingOriginal = Math.max(0, item.outstandingAmount - assignedInOriginalCurrency);
      const remainingUsd = Math.max(0, outstandingUsd - assignedUsd);
      const project = projects.find(p => p.id === item.projectId);
      const isTotalPayment = remainingUsd <= 0.01;

      return {
        id: item.id,
        code: item.code,
        contactName: item.contactName,
        projectName: project?.name || 'Sin proyecto',
        source: item.source,
        dueDate: item.dueDate,
        originalCurrency: item.currency,
        assignedUsd,
        assignedBs: assignedUsd * rate,
        assignedOriginal: assignedInOriginalCurrency,
        totalOriginalOutstanding: item.outstandingAmount,
        remainingOriginal,
        remainingUsd,
        rate,
        rateSource,
        isTotalPayment,
      };
    });
  const summaryTotals = {
    fundsBs: selectedFundSummaries.reduce((sum, item) => sum + item.allocatedBs, 0),
    expensesBs: selectedExpenseSummaries.reduce((sum, item) => sum + item.assignedBs, 0),
  };
  const summaryUsesBcvEur = selectedFundSummaries.some(item => item.rateSource === 'BCV_EUR')
    || selectedExpenseSummaries.some(item => item.rateSource === 'BCV_EUR');

  const selectedProjectName = selectedProjectId === 'ALL'
    ? 'Todos los proyectos'
    : (projects.find(project => project.id === selectedProjectId)?.name || 'Proyecto filtrado');

  const formatShortDate = (value: string | null) => {
    if (!value) return 'Sin fecha';
    return format(parseISO(value), 'dd/MM/yyyy', { locale: es });
  };

  const formatSummaryDateTime = (value: Date) => {
    return format(value, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  const summaryFileStamp = format(summaryGeneratedAt, 'yyyyMMdd_HHmmss');

  const exportSummaryToExcel = async () => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    const metadataRows = [
      {
        'Documento': 'Resumen del Presupuesto',
        'Generado': formatSummaryDateTime(summaryGeneratedAt),
        'Proyecto': selectedProjectName,
        'Vista': currencyView,
        'Total Aportado USD': Number(totalFundsAssignedUsd.toFixed(2)),
        'Total Programado USD': Number(totalExpensesAssignedUsd.toFixed(2)),
        'Diferencia USD': Number(remainingBudgetUsd.toFixed(2)),
      },
    ];

    const fundsRows = selectedFundSummaries.map(item => ({
      'Cuenta': item.name,
      'Proyecto': item.projectName,
      'Aporta USD': Number(item.allocatedUsd.toFixed(2)),
      'Equiv. Bs': Number(item.allocatedBs.toFixed(2)),
      'Tasa': Number(item.rate.toFixed(2)),
      'Fuente Tasa': getRateLabel(item.rateSource),
      'Saldo Restante': item.remainingLabel,
    }));

    const expenseRows = selectedExpenseSummaries.map(item => ({
      'Proveedor': item.contactName,
      'Referencia': item.code,
      'Origen': item.source === 'SCHEDULED' ? 'Programado' : item.source === 'INVOICE' ? 'Factura' : 'Transaccion',
      'Pago USD': Number(item.assignedUsd.toFixed(2)),
      'Pago Moneda Original': Number(item.assignedOriginal.toFixed(2)),
      'Moneda Original': item.originalCurrency,
      'Tipo': item.isTotalPayment ? 'Total' : 'Parcial',
      'Pendiente': Number(item.remainingOriginal.toFixed(2)),
      'Vence': formatShortDate(item.dueDate),
      'Proyecto': item.projectName,
      'Tasa': Number(item.rate.toFixed(2)),
      'Fuente Tasa': getRateLabel(item.rateSource),
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(metadataRows), 'Resumen');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(fundsRows.length > 0 ? fundsRows : [{ 'Cuenta': 'Sin aportes asignados' }]), 'Aportes');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expenseRows.length > 0 ? expenseRows : [{ 'Proveedor': 'Sin pagos programados' }]), 'Compromisos');

    XLSX.writeFile(workbook, `resumen_presupuesto_${summaryFileStamp}.xlsx`);
  };

  const exportSummaryToPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text('Resumen del Presupuesto', 40, 42);
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(`Generado: ${formatSummaryDateTime(summaryGeneratedAt)}`, 40, 60);
    doc.text(`Proyecto: ${selectedProjectName}`, 40, 74);
    doc.text(`Vista: ${currencyView}`, 40, 88);

    autoTable(doc, {
      startY: 106,
      theme: 'grid',
      head: [['Total aportado USD', 'Total programado USD', 'Diferencia USD', 'Total aportado Bs', 'Total programado Bs', 'Diferencia Bs']],
      body: [[
        formatCustomMoney(totalFundsAssignedUsd, 'USD'),
        formatCustomMoney(totalExpensesAssignedUsd, 'USD'),
        formatCustomMoney(remainingBudgetUsd, 'USD'),
        formatCustomMoney(summaryTotals.fundsBs, 'BS'),
        formatCustomMoney(summaryTotals.expensesBs, 'BS'),
        formatCustomMoney(summaryTotals.fundsBs - summaryTotals.expensesBs, 'BS'),
      ]],
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [15, 23, 42] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 24,
      theme: 'grid',
      head: [['Cuenta', 'Proyecto', 'Aporta USD', 'Equiv. Bs', 'Fuente Tasa', 'Tasa', 'Saldo Restante']],
      body: selectedFundSummaries.length > 0
        ? selectedFundSummaries.map(item => [
            item.name,
            item.projectName,
            formatCustomMoney(item.allocatedUsd, 'USD'),
            formatCustomMoney(item.allocatedBs, 'BS'),
            getRateLabel(item.rateSource),
            formatRate(item.rate),
            item.remainingLabel,
          ])
        : [['Sin aportes asignados', '', '', '', '', '', '']],
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 24,
      theme: 'grid',
      head: [['Proveedor', 'Ref.', 'Origen', 'Pago USD', 'Pago Moneda Orig.', 'Fuente Tasa', 'Tasa', 'Tipo', 'Pendiente', 'Vence']],
      body: selectedExpenseSummaries.length > 0
        ? selectedExpenseSummaries.map(item => [
            item.contactName,
            item.code,
            item.source === 'SCHEDULED' ? 'Programado' : item.source === 'INVOICE' ? 'Factura' : 'Transaccion',
            formatCustomMoney(item.assignedUsd, 'USD'),
            formatCustomMoney(item.assignedOriginal, item.originalCurrency),
            getRateLabel(item.rateSource),
            formatRate(item.rate),
            item.isTotalPayment ? 'Total' : 'Parcial',
            item.isTotalPayment ? '0,00' : formatCustomMoney(item.remainingOriginal, item.originalCurrency),
            formatShortDate(item.dueDate),
          ])
        : [['Sin pagos programados', '', '', '', '', '', '', '', '', '']],
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [225, 29, 72] },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Resumen generado el ${formatSummaryDateTime(summaryGeneratedAt)}`, pageWidth - 220, 24);
      },
    });

    doc.save(`resumen_presupuesto_${summaryFileStamp}.pdf`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto mb-10 pb-20 print:p-0 print:m-0 print:w-full font-sans bg-slate-50 min-h-screen">
      <div className="flex gap-2 mb-4 print:hidden">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-blue-600 flex items-center gap-1 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="w-px h-4 bg-slate-300 my-auto"></div>
        <Link href="/dashboard" className="text-slate-500 hover:text-blue-600 flex items-center gap-1 text-sm font-medium transition-colors">
          <Home size={16} /> Ir al Dashboard
        </Link>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:mb-2 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500 print:text-black leading-tight">
            Presupuesto de Pagos
          </h1>
          <p className="text-slate-500 print:text-xs">
            Asigna recursos de tus cuentas y bancos para planificar los pagos de tus deudas pendientes.
          </p>
        </div>
        <div className="flex gap-2 print:hidden items-center">
          <div className="flex bg-white p-1 rounded-lg mr-2 border border-slate-200">
            <button 
              onClick={() => { setCurrencyView('BS'); localStorage.setItem('fink_currency', 'BS'); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${currencyView === 'BS' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Bs
            </button>
            <button 
              onClick={() => { setCurrencyView('USD'); localStorage.setItem('fink_currency', 'USD'); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${currencyView === 'USD' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              USD
            </button>
          </div>
          <button onClick={fetchData} className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium">
            <RefreshCw size={16} /> Recargar
          </button>
          <button onClick={printSummary} className="bg-blue-600 border border-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-md text-sm font-medium">
            <Printer size={16} /> Imprimir Resumen
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row gap-4 items-center print:border-none print:shadow-none print:p-0">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Building2 size={18} className="text-slate-400" />
          <select
            className="w-full md:w-56 text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="ALL">Todos los Proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
         <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar size={18} className="text-slate-400" />
          <div className="flex items-center gap-2 flex-col sm:flex-row w-full print:flex-row">
             <input type="date" className="border-slate-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} /> 
             <span className="text-slate-400 text-sm">h/</span>
             <input type="date" className="border-slate-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />     
          </div>
          <button className="text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 px-2 py-1 rounded print:hidden" onClick={() => setDateRange({start: '', end: ''})}>
              Limpiar Vencimiento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 print:hidden">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tasa General de Fondos</div>
              <div className="text-sm text-slate-700">Aplica a bancos y cajas salvo override por cuenta.</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
              {getRateLabel(fundRateSource)} {formatRate(fundsGlobalRate)}
            </span>
          </div>
          <select
            className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={fundRateSource}
            onChange={(e) => setFundRateSource(e.target.value as RateSource)}
          >
            {RATE_SOURCE_OPTIONS.map(source => (
              <option key={source} value={source}>{getRateLabel(source)} ({formatRate(getRateValue(source))})</option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tasa General de Pagos</div>
              <div className="text-sm text-slate-700">Aplica a cuentas por pagar salvo override por deuda.</div>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 font-semibold">
              {getRateLabel(expenseRateSource)} {formatRate(expensesGlobalRate)}
            </span>
          </div>
          <select
            className="w-full text-sm border-slate-200 rounded-lg focus:ring-rose-500 focus:border-rose-500"
            value={expenseRateSource}
            onChange={(e) => setExpenseRateSource(e.target.value as RateSource)}
          >
            {RATE_SOURCE_OPTIONS.map(source => (
              <option key={source} value={source}>{getRateLabel(source)} ({formatRate(getRateValue(source))})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Budget Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-blue-500 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Fondos Asignados</h3>
          <div className="flex items-baseline gap-2">
             <span className="text-3xl font-bold text-slate-800">{formatViewMoney(totalFundsAssignedUsd, fundsGlobalRate)}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Recursos sumados de cuentas/bancos con tasa general de fondos.</p>
          <p className="text-[11px] text-slate-500 mt-1">Incluye {selectedFundsCount} {selectedFundsCount === 1 ? 'cuenta' : 'cuentas'} con monto asignado.</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-rose-500 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Pagos Programados</h3>
          <div className="flex items-baseline gap-2">
             <span className="text-3xl font-bold text-rose-600">{formatViewMoney(totalExpensesAssignedUsd, expensesGlobalRate)}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Destinados a cuentas por pagar con tasa general de pagos.</p>
          <p className="text-[11px] text-slate-500 mt-1">Incluye {selectedExpensesCount} {selectedExpensesCount === 1 ? 'deuda' : 'deudas'} con pago programado.</p>
        </div>
        <div className={`p-5 rounded-2xl border-l-4 shadow-sm ${remainingBudgetUsd >= 0 ? 'bg-emerald-50 border-l-emerald-500 border border-emerald-100' : 'bg-red-50 border-l-red-500 border border-red-100'}`}>
          <h3 className={`text-sm font-semibold uppercase tracking-wider mb-1 ${remainingBudgetUsd >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Restante Presupuesto</h3>
          <div className="flex items-baseline gap-2">
             <span className={`text-3xl font-bold ${remainingBudgetUsd >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatViewMoney(remainingBudgetUsd, fundsGlobalRate)}</span>
          </div>
          <p className={`text-xs mt-2 ${remainingBudgetUsd >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {remainingBudgetUsd >= 0 ? 'Balance positivo tras asignaciones' : 'ALERTA: Faltan fondos para esta asignación'}
          </p>
        </div>
      </div>

      <div ref={summaryRef} className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-8 overflow-hidden print:border print:shadow-none">
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 text-white print:bg-slate-100 print:text-black">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-bold leading-tight">Resumen del Presupuesto</h2>
              <p className="text-xs text-slate-200 print:text-slate-600 mt-1">
                Vista compacta de aportes y pagos programados.
              </p>
            </div>
            <div className="flex flex-col md:items-end gap-2">
              <div className="text-[11px] leading-5 text-slate-200 print:text-slate-700">
                <div><span className="font-semibold">Generado:</span> {formatSummaryDateTime(summaryGeneratedAt)}</div>
                <div><span className="font-semibold">Proyecto:</span> {selectedProjectName}</div>
              </div>
              {summaryUsesBcvEur && (
                <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 print:border-emerald-300">
                  Resumen con EURO BCV activo
                </div>
              )}
              <div className="flex flex-wrap gap-2 print:hidden">
                <button onClick={exportSummaryToExcel} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20">
                  <FileSpreadsheet size={14} /> Exportar Excel
                </button>
                <button onClick={exportSummaryToPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20">
                  <Download size={14} /> Guardar PDF
                </button>
                <button onClick={printSummary} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100">
                  <Printer size={14} /> Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-b border-slate-200">
          <div className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Aportes por Cuenta</div>
          {selectedFundSummaries.length === 0 ? (
            <p className="text-sm text-slate-400">Todavia no has asignado fondos desde ninguna cuenta.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-2 text-left border border-slate-200">Cuenta</th>
                    <th className="px-3 py-2 text-left border border-slate-200">Proyecto</th>
                    <th className="px-3 py-2 text-right border border-slate-200">Aporta USD</th>
                    <th className="px-3 py-2 text-right border border-slate-200">Equiv. Bs</th>
                    <th className="px-3 py-2 text-center border border-slate-200">Fuente Tasa</th>
                    <th className="px-3 py-2 text-center border border-slate-200">Tasa</th>
                    <th className="px-3 py-2 text-right border border-slate-200">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFundSummaries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">{item.name}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-600">{item.projectName}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right font-medium">{formatCustomMoney(item.allocatedUsd, 'USD')}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{formatCustomMoney(item.allocatedBs, 'BS')}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${item.rateSource === 'BCV_EUR' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                          {getRateLabel(item.rateSource)}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-[12px]">{formatRate(item.rate)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right text-slate-600">{item.remainingLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Compromisos Programados</div>
          {selectedExpenseSummaries.length === 0 ? (
            <p className="text-sm text-slate-400">Todavia no has programado pagos para compromisos pendientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-2 text-left border border-slate-200">Proveedor</th>
                    <th className="px-3 py-2 text-left border border-slate-200">Ref.</th>
                    <th className="px-3 py-2 text-left border border-slate-200">Origen</th>
                    <th className="px-3 py-2 text-right border border-slate-200">Pago USD</th>
                    <th className="px-3 py-2 text-right border border-slate-200">Pago Moneda Orig.</th>
                    <th className="px-3 py-2 text-center border border-slate-200">Fuente Tasa</th>
                    <th className="px-3 py-2 text-center border border-slate-200">Tasa</th>
                    <th className="px-3 py-2 text-center border border-slate-200">Tipo</th>
                    <th className="px-3 py-2 text-right border border-slate-200">Pendiente</th>
                    <th className="px-3 py-2 text-center border border-slate-200">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedExpenseSummaries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 border border-slate-200 font-medium text-slate-800">{item.contactName}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-600">{item.code}</td>
                      <td className="px-3 py-2 border border-slate-200 text-slate-600">{item.source === 'SCHEDULED' ? 'Programado' : item.source === 'INVOICE' ? 'Factura' : 'Transaccion'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right font-medium">{formatCustomMoney(item.assignedUsd, 'USD')}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{formatCustomMoney(item.assignedOriginal, item.originalCurrency)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${item.rateSource === 'BCV_EUR' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                          {getRateLabel(item.rateSource)}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-[12px]">{formatRate(item.rate)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center">{item.isTotalPayment ? 'Total' : 'Parcial'}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right text-slate-600">{item.isTotalPayment ? '0,00' : formatCustomMoney(item.remainingOriginal, item.originalCurrency)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-center text-slate-600">{formatShortDate(item.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 py-4 border-t border-slate-200 bg-slate-50 print:bg-white">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Aportado</div>
            <div className="text-sm font-bold text-slate-800 mt-1">{formatCustomMoney(totalFundsAssignedUsd, 'USD')}</div>
            <div className="text-xs text-slate-500">{formatCustomMoney(summaryTotals.fundsBs, 'BS')}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Programado</div>
            <div className="text-sm font-bold text-slate-800 mt-1">{formatCustomMoney(totalExpensesAssignedUsd, 'USD')}</div>
            <div className="text-xs text-slate-500">{formatCustomMoney(summaryTotals.expensesBs, 'BS')}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Diferencia</div>
            <div className={`text-sm font-bold mt-1 ${remainingBudgetUsd >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCustomMoney(remainingBudgetUsd, 'USD')}</div>
            <div className={`text-xs ${remainingBudgetUsd >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCustomMoney(summaryTotals.fundsBs - summaryTotals.expensesBs, 'BS')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start print:block">
        
         {/* FONDOS DISPONIBLES (Bancos) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:mb-8">
<div className="bg-slate-800 p-4 text-white flex justify-between items-start print:bg-slate-100 print:text-black print:border-b print:border-slate-300">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-700 p-2 rounded-lg print:hidden"><Wallet size={18} className="text-blue-300" /></div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">Fondos Disponibles</h3>
                      <p className="text-slate-300 text-xs font-medium print:text-slate-600">Saldos en Bancos y Cajas</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white print:hidden bg-slate-700/50 px-2 py-1.5 rounded-md border border-slate-600/50 transition-colors">
                    <input type="checkbox" checked={hideEmptyAccounts} onChange={(e) => setHideEmptyAccounts(e.target.checked)} className="rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5" />
                    Ocultar en 0
                  </label>
           </div>

           <div className="p-0">
             <table className="w-full text-left border-collapse text-sm">
               <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                 <tr>
                   <th className="p-4 pl-5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortAccount('name')}>
                     Cuenta / Institución
                     {sortAccountBy.key === 'name' ? (sortAccountBy.dir === 'asc' ? <ArrowUp size={12} className="inline ml-1 text-blue-600" /> : <ArrowDown size={12} className="inline ml-1 text-blue-600" />) : <ArrowUpDown size={12} className="inline ml-1 opacity-40" />}
                   </th>
                   <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortAccount('balance')}>
                     Saldo Original
                     {sortAccountBy.key === 'balance' ? (sortAccountBy.dir === 'asc' ? <ArrowUp size={12} className="inline ml-1 text-blue-600" /> : <ArrowDown size={12} className="inline ml-1 text-blue-600" />) : <ArrowUpDown size={12} className="inline ml-1 opacity-40" />}
                   </th>
                   <th className="p-4 pr-5 text-right w-32 border-l border-slate-200">Asignar ({currencyView})</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-400">No hay cuentas bancarias registradas.</td>
                    </tr>
                  )}
                  {sortedAccounts.map(acc => {
                   const accountRateSource = getAccountRateSource(acc.id);
                   const accountRate = getRateValue(accountRateSource);
                   const totalAccUsd = (acc.balanceUsd || 0) + ((acc.balanceBs || 0) / accountRate) + (acc.balanceEur || 0);
                   const allocatedUsd = fundAllocations[acc.id] || 0;
                   const remainingAccUsd = Math.max(0, totalAccUsd - allocatedUsd);
                   const isSelected = !!fundAllocations[acc.id] && fundAllocations[acc.id] > 0;
                   const mappedValue = getEquivalentViewValue(allocatedUsd, accountRate);
                   const p = projects.find(x => x.id === acc.projectId);
                   
                   const primaryCurrency = getAccountPrimaryCurrency(acc);
                   let curBadge = primaryCurrency === 'BS' ? 'Bs' : primaryCurrency;
                   if (primaryCurrency === 'MIXED') curBadge = 'USD/Bs';

                   return (
                     <tr key={acc.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                       <td className="p-4 pl-5 align-top">
                          <div className="font-semibold text-slate-800">{acc.name}</div>
                          <div className="flex flex-wrap gap-x-2 gap-y-1 items-center mt-1">
                             <span className="text-xs text-slate-500 uppercase tracking-wider">{acc.subType}</span>
                             {p && <span className="px-2 py-[2px] bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-semibold tracking-wider">{p.name}</span>}
                             <span className="px-1.5 py-[2px] bg-blue-50 text-blue-600 border border-blue-100 rounded text-[9px] uppercase font-bold tracking-wider">{curBadge}</span>
                          </div>
                       </td>
                       <td className="p-4 text-right align-top space-y-1">
                          {(acc.balanceUsd !== 0 || totalAccUsd === 0) && (
                              <div className="text-slate-700 font-medium">{formatCustomMoney(acc.balanceUsd || 0, 'USD')}</div>
                          )}
                          {acc.balanceBs !== 0 && (
                              <div className="text-slate-600 text-[13px]">{formatCustomMoney(acc.balanceBs || 0, 'BS')}</div>
                          )}
                       </td>
                       <td className="p-4 pr-5 align-top border-l border-slate-100 bg-slate-50/50">
                          <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              className={`w-full text-right font-bold rounded-lg border flex-1 ${isSelected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 text-slate-600'}`}
                              value={mappedValue === 0 ? '' : Number(mappedValue.toFixed(2))}
                              onChange={(e) => handleFundChange(acc.id, e.target.value, accountRate)}
                           />

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400 font-medium select-none">
        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider font-bold">{getRateLabel(accountRateSource)}</span>
        <span>{formatCrossHint(mappedValue, accountRate)}</span>
      </div>

      <div className="mt-1 text-[10px] text-right text-slate-500 font-medium">
        Saldo restante: {getRemainingAccountLabel(acc, allocatedUsd, accountRate)}
        <span className="text-slate-400"> ({formatViewMoney(remainingAccUsd, accountRate)})</span>
      </div>

      <select
        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 focus:border-blue-400 focus:ring-blue-400"
        value={accountRateOverrides[acc.id] || 'GENERAL'}
        onChange={(e) => setAccountRateOverrides(prev => ({ ...prev, [acc.id]: e.target.value as RateSelection }))}
      >
        <option value="GENERAL">{rateSelectorLabel('GENERAL', fundRateSource)}</option>
        {RATE_SOURCE_OPTIONS.map(source => (
          <option key={source} value={source}>{rateSelectorLabel(source, fundRateSource)}</option>
        ))}
      </select>

  <div className="flex justify-end mt-1">
    <button
        onClick={() => handleFundChange(acc.id, String(getEquivalentViewValue(((acc.balanceUsd || 0) + ((acc.balanceBs || 0) / accountRate) + (acc.balanceEur || 0)), accountRate)), accountRate)}
        className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline font-medium print:hidden"
    >
        Usar todo disponible
    </button>
  </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
        </div>

        {/* EGRESOS / DEUDAS (Cuentas por Pagar) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-rose-50 p-4 border-b border-rose-100 flex justify-between items-center print:bg-rose-50 print:border-b print:border-rose-200">
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-rose-100 p-2 rounded-lg shadow-sm print:hidden"><CreditCard size={18} className="text-rose-500" /></div>
                  <div>
                    <h3 className="font-bold text-lg text-rose-900 leading-tight">Deudas por Pagar</h3>
                    <p className="text-rose-600 text-xs font-medium">Facturas y Gastos Pendientes</p>
                  </div>
                </div>
           </div>

           <div className="p-0">
            {expenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No hay deudas pendientes en este rango.</div>
            ) : (
             <table className="w-full text-left border-collapse text-sm">
               <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold sticky top-0">
                 <tr>
                   <th className="p-4 pl-5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortExpense('contact')}>
                     Acreedor / Detalle
                     {sortExpenseBy.key === 'contact' ? (sortExpenseBy.dir === 'asc' ? <ArrowUp size={12} className="inline ml-1 text-blue-600" /> : <ArrowDown size={12} className="inline ml-1 text-blue-600" />) : <ArrowUpDown size={12} className="inline ml-1 opacity-40" />}
                   </th>
                   <th className="p-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSortExpense('amount')}>
                     Deuda Act.
                     {sortExpenseBy.key === 'amount' ? (sortExpenseBy.dir === 'asc' ? <ArrowUp size={12} className="inline ml-1 text-blue-600" /> : <ArrowDown size={12} className="inline ml-1 text-blue-600" />) : <ArrowUpDown size={12} className="inline ml-1 opacity-40" />}
                   </th>
                   <th className="p-4 pr-5 text-right w-32 border-l border-slate-200">Pagar ({currencyView})</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {groupedExpenses.map((group: any) => {
                    const isExpanded = expandedGroups[group.contactName];
                    const isGroupAssigned = group.items.some((it: any) => (expenseAllocations[it.id] || 0) > 0);

                    return (
                      <React.Fragment key={'group-'+group.contactName}>
                        <tr 
                          className={'bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border-y border-slate-200 ' + (isGroupAssigned ? 'bg-rose-50/20' : '')}
                          onClick={() => toggleGroup(group.contactName)}
                        >
                           <td className={'p-3 pl-4 align-middle select-none border-l-4 ' + (isGroupAssigned ? 'border-l-rose-400' : 'border-l-transparent group-hover:border-l-slate-300')}>
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-400" />}
                                <div className={'font-bold ' + (isGroupAssigned ? 'text-rose-900' : 'text-slate-800')}>{group.contactName}</div>
                                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 shadow-sm px-2 py-[2px] rounded-full font-medium">
                                    {group.items.length} {group.items.length === 1 ? 'trx' : 'trxs'}
                                  </span>
                              </div>
                           </td>
                           <td className="p-3 text-right align-middle font-semibold text-slate-700">
                            {currencyView === 'BS'
                              ? new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(group.totalOutstandingView)
                              : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(group.totalOutstandingUsd)}
                           </td>
                           <td className="p-3 pr-4 align-middle text-right bg-slate-50/50" onClick={(e) => e.stopPropagation()}>
                              <button
                                 onClick={(e) => { e.preventDefault(); handlePayGroupAll(group.items); }}
                                 className="text-[11px] bg-white border border-slate-300 shadow-sm hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 px-3 py-1.5 rounded transition-colors w-full font-medium"
                              >
                                Pagar Todas
                              </button>
                           </td>
                        </tr>

                        {isExpanded && group.items.map((item: any) => {
                          const expenseRateSourceForItem = getExpenseRateSource(item.id);
                          const expenseRate = getRateValue(expenseRateSourceForItem);
                          const isSelected = !!expenseAllocations[item.id] && expenseAllocations[item.id] > 0;
                          const p = projects.find(x => x.id === item.projectId);
                          const isScheduled = item.status === 'SCHEDULED';
                          const maxOutstandingUsd = getUsdValue(item.outstandingAmount, item.currency, expenseRate);
                          const mappedAssigned = getEquivalentViewValue(expenseAllocations[item.id] || 0, expenseRate);

                          return (
                            <tr key={item.id} className={'hover:bg-slate-50 transition-colors ' + (isSelected ? 'bg-rose-50/40 relative' : 'relative')}>
                              <td className="p-4 pl-12 align-top relative">
                                    <React.Fragment>
                                      <div className="absolute left-[26px] top-0 bottom-0 w-px bg-slate-200"></div>
                                      <div className="absolute left-[26px] top-6 w-4 h-px bg-slate-200"></div>
                                    </React.Fragment>

                                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-center mt-1">
                                     <span className="text-xs font-semibold text-slate-600">{item.code}</span>
                                     {p && <span className="px-2 py-[2px] bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-semibold tracking-wider">{p.name}</span>}
                                     {isScheduled && <span className="inline-flex items-center gap-1 font-medium text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase"><Clock size={10}/> Programado</span>}
                                     {item.status === 'PARTIAL' && <span className="inline-flex items-center gap-1 font-medium text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded uppercase border border-amber-100">Parcial</span>}
                                  </div>
                                  {item.dueDate && <div className="text-[11px] text-slate-400 mt-1">Vence: {item.dueDate ? format(parseISO(item.dueDate), 'dd/MM/yyyy') : ''}</div>}
                              </td>
                              <td className="p-4 text-right align-top font-semibold text-slate-600">
                                  {formatCustomMoney(item.outstandingAmount, item.currency)}
                                  {item.currency !== 'USD' && item.currency !== currencyView && (
                                   <div className="text-[10px] font-normal text-slate-400 mt-0.5">≈ {formatViewMoney(maxOutstandingUsd, expenseRate)}</div>
                                  )}
                              </td>
                              <td className="p-4 pr-5 align-top border-l border-slate-100 bg-slate-50/50">
                                  <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                      className={'w-full text-right font-bold rounded-lg px-2 py-1.5 border flex-1 ' + (isSelected ? 'border-rose-300 ring-2 ring-rose-100 text-rose-700 bg-white' : 'border-slate-300 text-slate-700 bg-white hover:border-slate-400')}
                                      value={mappedAssigned === 0 ? '' : Number(mappedAssigned.toFixed(2))}
                                      onChange={(e) => handleExpenseChange(item.id, e.target.value, expenseRate)}
                                  />

      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400 font-medium select-none">
        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider font-bold">{getRateLabel(expenseRateSourceForItem)}</span>
        <span>{formatCrossHint(mappedAssigned, expenseRate)}</span>
      </div>

      <select
        className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 focus:border-rose-400 focus:ring-rose-400"
        value={expenseRateOverrides[item.id] || 'GENERAL'}
        onChange={(e) => setExpenseRateOverrides(prev => ({ ...prev, [item.id]: e.target.value as RateSelection }))}
      >
        <option value="GENERAL">{rateSelectorLabel('GENERAL', expenseRateSource)}</option>
        {RATE_SOURCE_OPTIONS.map(source => (
          <option key={source} value={source}>{rateSelectorLabel(source, expenseRateSource)}</option>
        ))}
      </select>

                                  <div className="flex justify-end mt-1">
                                    <button
                                        onClick={() => handleExpenseChange(item.id, String(getEquivalentViewValue(maxOutstandingUsd, expenseRate)), expenseRate)}
                                        className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline font-medium print:hidden"
                                    >
                                      Pago total
                                    </button>
                                  </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
               </tbody>
             </table>
            )}
           </div>
        </div>

      </div>
    </div>
  );
}
