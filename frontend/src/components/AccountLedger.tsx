import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { format } from 'date-fns';

interface AccountLedgerProps {
  accountId: string;
  accountType: string; // ASSET, LIABILITY, etc.
  currency: string;
}

export default function AccountLedger({ accountId, accountType, currency }: AccountLedgerProps) {
  const [data, setData] = useState<any[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Default to current month
  // Note: Using string manipulation instead of date objects to avoid timezone issues with inputs
  const getDefaultDates = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      // Last day of month
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      
      return {
          start: `${year}-${month}-01`,
          end: `${year}-${month}-${lastDay}`
      };
  };

  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  const loadData = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const resp = await api.accounts.getLedger(accountId, { startDate, endDate, limit: 2000 });
      if (resp.data.success) {
        setData(resp.data.data);
        setOpeningBalance(resp.data.openingBalance || 0);
      }
    } catch (e) {
      console.error(e);
      alert('Error cargando movimientos');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, [accountId]); // Initial load only, then manual via Search button to avoid double fetch on date change typing

  const handleSearch = (e: any) => {
      e.preventDefault();
      loadData();
  };

  // Determine Nature
  // ASSET/EXPENSE: Debit (+), Credit (-)
  // LIABILITY/EQUITY/REVENUE: Credit (+), Debit (-)
  const isAssetNature = ['ASSET', 'EXPENSE'].includes(accountType);

  // Calculation Logic
  // We start with openingBalance and iterate foward adding changes.
  // The API returns ordered by Date ASC.
  
  let currentBalance = openingBalance;

  // Process rows for display
  const rows = data.map((entry) => {
    // entry has debitAmount and creditAmount.
    // If this account is the debitAccount, the debitAmount applies.
    // If this account is the creditAccount, the creditAmount applies.
    // (A single entry usually has both filled if it's a simple 2-leg, or one if split? 
    //  Actually prisma schema has both fields on the entry. Detailed check:
    //  Usually a TransactionEntry links 1 DebitAccount and 1 CreditAccount and has Amount.
    //  Wait, Schema: 
    //    debitAccountId String?
    //    debitAmount Float
    //    creditAccountId String?
    //    creditAmount Float
    //  If it is a simple transfer: Acc A -> Acc B Amount 100.
    //  Entry: debitAccount=B, creditAccount=A, debitAmount=100, creditAmount=100.
    //  If checks satisfy both sides.
    
    // Determining the impact:
    let debitVal = 0;
    let creditVal = 0;

    if (entry.debitAccountId === accountId) {
        debitVal = entry.debitAmount;
    }
    // Note: It's possible for a self-transfer to match both (unlikely in valid accounting but possible in bugs)
    // using 'else if' or just 'if'
    if (entry.creditAccountId === accountId) {
        creditVal = entry.creditAmount;
    }

    // Net Change
    // Asset: +Debit -Credit
    // Liability: +Credit -Debit
    const change = isAssetNature ? (debitVal - creditVal) : (creditVal - debitVal);
    currentBalance += change;

    return {
      ...entry,
      displayDebit: debitVal,
      displayCredit: creditVal,
      balance: currentBalance
    };
  });

  // Totals for the period
  const totalDebits = rows.reduce((sum, r) => sum + r.displayDebit, 0);
  const totalCredits = rows.reduce((sum, r) => sum + r.displayCredit, 0);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    } else if (key === 'date') {
      direction = 'desc'; // Por defecto fecha es descendente primero
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = useMemo(() => {
    const sortableItems = [...rows];
    
    sortableItems.sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortConfig.key) {
        case 'date':
          aValue = new Date(a.transaction?.date || 0).getTime();
          bValue = new Date(b.transaction?.date || 0).getTime();
          break;
        case 'ref':
          aValue = a.transaction?.reference || a.transaction?.code || '';
          bValue = b.transaction?.reference || b.transaction?.code || '';
          break;
        case 'desc':
          aValue = a.transaction?.description || '';
          bValue = b.transaction?.description || '';
          break;
        case 'debit':
          aValue = a.displayDebit;
          bValue = b.displayDebit;
          break;
        case 'credit':
          aValue = a.displayCredit;
          bValue = b.displayCredit;
          break;
        case 'balance':
          aValue = a.balance;
          bValue = b.balance;
          break;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sortableItems;
  }, [rows, sortConfig]);

  const renderSortableHeader = (label: string, key: string, align: 'left' | 'right' | 'center' = 'left') => {
    return (
      <th 
        className={`px-4 py-3 text-${align} font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none group transition-colors whitespace-nowrap`}
        onClick={() => handleSort(key)}
      >
        <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} gap-1`}>
          {label}
          <span className={`text-xs ${sortConfig.key === key ? 'text-blue-500 font-bold' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}>
            {sortConfig.key === key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </div>
      </th>
    );
  };
  
  // Resolve counterparty function
  const getCounterpartyName = (row: any) => {
    const otherEntries = row.transaction?.entries?.filter((e: any) => e.id !== row.id) || [];
    let name = '?';
    
    // Fallback original mechanism if the backend returns it directly on the same entry!
    if (row.debitAccountId === accountId && row.creditAccount?.name) {
      return `De: ${row.creditAccount.name}`;
    }
    if (row.creditAccountId === accountId && row.debitAccount?.name) {
      return `A: ${row.debitAccount.name}`;
    }

    // New mechanism matching split entries
    if (row.debitAccountId === accountId) {
      const credits = otherEntries.filter((e: any) => e.creditAccountId);
      if (credits.length === 1) name = credits[0].creditAccount?.name || '?';
      else if (credits.length > 1) name = 'Múltiples cuentas';
      return `De: ${name}`;
    } else {
      const debits = otherEntries.filter((e: any) => e.debitAccountId);
      if (debits.length === 1) name = debits[0].debitAccount?.name || '?';
      else if (debits.length > 1) name = 'Múltiples cuentas';
      return `A: ${name}`;
    }
  };

  return (
    <div className="space-y-4">
        {/* Filters */}
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Desde</label>
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hasta</label>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                />
            </div>
            <button 
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
                {loading ? 'Cargando...' : 'Actualizar'}
            </button>
        </form>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-lg border shadow-sm">
                 <p className="text-xs text-gray-500 uppercase">Saldo Inicial</p>
                 <p className="text-lg font-bold text-gray-800">{openingBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {currency}</p>
                 <p className="text-xs text-gray-400">Al inicio del periodo</p>
             </div>
             <div className="bg-white p-4 rounded-lg border shadow-sm">
                 <p className="text-xs text-gray-500 uppercase">Total Ingresos (+)</p>
                 <p className="text-lg font-bold text-green-600">
                     {isAssetNature ? totalDebits.toLocaleString('es-VE') : totalCredits.toLocaleString('es-VE')} {currency}
                 </p>
             </div>
             <div className="bg-white p-4 rounded-lg border shadow-sm">
                 <p className="text-xs text-gray-500 uppercase">Total Egresos (-)</p>
                 <p className="text-lg font-bold text-red-600">
                     {isAssetNature ? totalCredits.toLocaleString('es-VE') : totalDebits.toLocaleString('es-VE')} {currency}
                 </p>
             </div>
             <div className="bg-white p-4 rounded-lg border shadow-sm ring-1 ring-blue-100">
                 <p className="text-xs text-gray-500 uppercase">Saldo Final</p>
                 <p className="text-lg font-bold text-blue-800">{currentBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {currency}</p>
                 <p className="text-xs text-gray-400">Al cierre del periodo</p>
             </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 bg-white text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        {renderSortableHeader('Fecha', 'date', 'left')}
                        {renderSortableHeader('Ref', 'ref', 'left')}
                        {renderSortableHeader('Descripción', 'desc', 'left')}
                        {renderSortableHeader(isAssetNature ? 'Débito (+)' : 'Débito (-)', 'debit', 'right')}
                        {renderSortableHeader(isAssetNature ? 'Crédito (-)' : 'Crédito (+)', 'credit', 'right')}
                        {renderSortableHeader('Saldo', 'balance', 'right')}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {/* Opening Balance Row */}
                    <tr className="bg-gray-50 italic text-gray-500">
                        <td className="px-4 py-2">{format(new Date(startDate), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-2">-</td>
                        <td className="px-4 py-2">Saldo Inicial</td>
                        <td className="px-4 py-2 text-right">-</td>
                        <td className="px-4 py-2 text-right">-</td>
                        <td className="px-4 py-2 text-right font-mono">{openingBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                    </tr>

                    {sortedRows.length === 0 && !loading && (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                No se encontraron movimientos en este periodo.
                            </td>
                        </tr>
                    )}

                    {sortedRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900 whitespace-nowrap">
                                {row.transaction?.date ? format(new Date(row.transaction.date), 'dd/MM/yyyy') : '-'}
                            </td>
                            <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                                {row.transaction?.reference || row.transaction?.code || '-'}
                            </td>
                            <td className="px-4 py-2 text-gray-800">
                                <div className="max-w-xs truncate" title={row.transaction?.description}>
                                    {row.transaction?.description || 'Sin descripción'}
                                </div>
                                <div className="text-xs text-gray-400">
                                    {/* Show counterparty account name */}
                                    {getCounterpartyName(row)}
                                </div>
                            </td>
                            <td className={`px-4 py-2 text-right font-mono whitespace-nowrap ${row.displayDebit > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                {row.displayDebit > 0 ? row.displayDebit.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className={`px-4 py-2 text-right font-mono whitespace-nowrap ${row.displayCredit > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                {row.displayCredit > 0 ? row.displayCredit.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-medium text-blue-900 whitespace-nowrap">
                                {row.balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
}
