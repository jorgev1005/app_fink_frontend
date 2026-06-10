import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { format } from 'date-fns';

interface AccountLedgerProps {
  accountId: string;
  accountType: string; // ASSET, LIABILITY, etc.
  currency: string;
  accountName?: string;
  accountCode?: string;
}

export default function AccountLedger({ accountId, accountType, currency, accountName = '', accountCode = '' }: AccountLedgerProps) {
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

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy');
    } catch (e) {
      return dateStr;
    }
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

    // Capture originals
    const origDebitVal = entry.debitAccountId === accountId ? (entry.originalDebit || 0) : 0;
    const origCreditVal = entry.creditAccountId === accountId ? (entry.originalCredit || 0) : 0;

    // Net Change
    // Asset: +Debit -Credit
    // Liability: +Credit -Debit
    const change = isAssetNature ? (debitVal - creditVal) : (creditVal - debitVal);
    currentBalance += change;

    return {
      ...entry,
      displayDebit: debitVal,
      displayCredit: creditVal,
      displayOrigDebit: origDebitVal,
      displayOrigCredit: origCreditVal,
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
    const fallbackName = row.transaction?.category || row.transaction?.type || 'General';
    
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
      if (credits.length === 1) name = credits[0].creditAccount?.name || fallbackName;
      else if (credits.length > 1) name = 'Múltiples cuentas';
      else name = fallbackName;
      return `De: ${name}`;
    } else {
      const debits = otherEntries.filter((e: any) => e.debitAccountId);
      if (debits.length === 1) name = debits[0].debitAccount?.name || fallbackName;
      else if (debits.length > 1) name = 'Múltiples cuentas';
      else name = fallbackName;
      return `A: ${name}`;
    }
  };

  return (
    <div className="space-y-4">
        {/* Cabecera para Impresión */}
        <div className="hidden print:block mb-6 border-b-2 border-gray-800 pb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reporte de Movimientos</h1>
                    <p className="text-lg font-semibold text-gray-700 mt-1">{accountCode} — {accountName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Tipo de Cuenta: {accountType} | Moneda: {currency}</p>
                </div>
                <div className="text-right text-xs text-gray-600">
                    <p className="font-medium">Período: {formatDateSafe(startDate)} al {formatDateSafe(endDate)}</p>
                    <p className="mt-1 text-gray-400">Generado: {new Date().toLocaleDateString('es-VE')} {new Date().toLocaleTimeString('es-VE')}</p>
                </div>
            </div>
        </div>

        {/* Estilos para impresión */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            header, 
            button, 
            form, 
            nav, 
            .no-print,
            .print\\:hidden,
            [class*="print:hidden"],
            aside,
            [class*="QuickActionButton"],
            [class*="CalculatorWidget"],
            [class*="AuditLogPreviewButton"] {
              display: none !important;
            }
            
            body, .min-h-screen, .max-w-4xl, .bg-white, .bg-gray-50, .shadow-md, .rounded-lg, .border {
              background: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
            }
            
            .overflow-x-auto {
              overflow: visible !important;
              border: none !important;
              box-shadow: none !important;
            }
            
            table {
              width: 100% !important;
              table-layout: auto !important;
              border-collapse: collapse !important;
            }
            
            thead {
              display: table-header-group !important;
            }
            
            tr {
              page-break-inside: avoid !important;
            }
            
            th, td {
              border: 1px solid #cbd5e1 !important;
              padding: 8px 12px !important;
              word-break: break-word !important;
              white-space: normal !important;
              max-width: none !important;
              overflow: visible !important;
              text-overflow: clip !important;
            }
            
            .truncate, [class*="truncate"] {
              overflow: visible !important;
              text-overflow: clip !important;
              white-space: normal !important;
              max-width: none !important;
            }

            .grid {
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              gap: 16px !important;
            }
            
            .grid > div {
              border: 1px solid #cbd5e1 !important;
              padding: 8px 12px !important;
              background: #f8fafc !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />

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
            <button 
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium transition flex items-center gap-1.5 print:hidden"
            >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir Reporte (PDF)
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
                        <td className="px-4 py-2">{formatDateSafe(startDate)}</td>
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
                                {row.transaction?.date ? formatDateSafe(row.transaction.date.split('T')[0]) : '-'}
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
                                {row.displayDebit > 0 ? (
                                    <>
                                        <div>{row.displayDebit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                                        {row.originalCurrency && row.originalCurrency !== currency && (
                                            <div className="text-xs text-gray-400">{row.displayOrigDebit.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {row.originalCurrency}</div>
                                        )}
                                    </>
                                ) : '-'}
                            </td>
                            <td className={`px-4 py-2 text-right font-mono whitespace-nowrap ${row.displayCredit > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                                {row.displayCredit > 0 ? (
                                    <>
                                        <div>{row.displayCredit.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>
                                        {row.originalCurrency && row.originalCurrency !== currency && (
                                            <div className="text-xs text-gray-400">{row.displayOrigCredit.toLocaleString('es-VE', { minimumFractionDigits: 2 })} {row.originalCurrency}</div>
                                        )}
                                    </>
                                ) : '-'}
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
