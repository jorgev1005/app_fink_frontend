'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Printer, Filter, ChevronDown, ChevronUp, AlertCircle, Clock, DollarSign } from 'lucide-react';

interface PaymentDetail {
  date: string;
  reference: string;
  amount: number;
  currency: string;
  method: string;
}

interface AgingItem {
  id: string;
  type: 'TRANSACTION' | 'INVOICE';
  docType?: string;
  taxAmount?: number;
  flow: 'INCOME' | 'EXPENSE';
  description: string;
  date: string;
  dueDate: string;
  originalAmount: number;
  originalCurrency: string;
  amount: number; // Converted amount
  isOverdue: boolean;
  paidAmount?: number;
  totalAmount?: number;
  paymentCount?: number;
  payments?: PaymentDetail[];
}

interface ContactAging {
  id: string;
  name: string;
  type: string;
  totalPending: number;
  overdue: number;
  dueSoon: number;
  items: AgingItem[];
}

export default function AgingReportPage() {
  const router = useRouter();
  const [data, setData] = useState<ContactAging[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  
  const [filters, setFilters] = useState({
    projectId: '',
    currency: 'USD',
    type: 'PAYABLE', // PAYABLE (Cuentas por Pagar), RECEIVABLE (Cuentas por Cobrar)
    startDate: '',
    endDate: '',
    includePaid: false
  });

  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadReport();
  }, [filters]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.reports.getAgingReport(filters);
      setData(res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: filters.currency === 'BS' ? 'VES' : 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  const totalPending = data.reduce((acc, c) => acc + c.totalPending, 0);
  const totalOverdue = data.reduce((acc, c) => acc + c.overdue, 0);
  const totalDueSoon = data.reduce((acc, c) => acc + c.dueSoon, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      {/* Header - Hidden on Print */}
      <div className="print:hidden mb-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Cuentas por {filters.type === 'PAYABLE' ? 'Pagar' : 'Cobrar'}</h1>
              <p className="text-slate-500">Reporte de antigüedad de saldos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setExpandedContact(expandedContact === 'ALL' ? null : 'ALL')}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              {expandedContact === 'ALL' ? 'Contraer Todo' : 'Expandir Todo'}
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Printer size={18} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Proyecto</label>
            <select 
              className="block w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.projectId}
              onChange={(e) => setFilters(f => ({ ...f, projectId: e.target.value }))}
            >
              <option value="">Todos los proyectos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Tipo de Reporte</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilters(f => ({ ...f, type: 'PAYABLE' }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.type === 'PAYABLE' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Por Pagar
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, type: 'RECEIVABLE' }))}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.type === 'RECEIVABLE' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Por Cobrar
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Moneda del Reporte</label>
            <select 
              className="block w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.currency}
              onChange={(e) => setFilters(f => ({ ...f, currency: e.target.value }))}
            >
              <option value="USD">USD ($)</option>
              <option value="BS">Bolívares (Bs)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Desde</label>
            <input 
              type="date"
              className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.startDate}
              onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Hasta</label>
            <input 
              type="date"
              className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.endDate}
              onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2 h-10 pb-1">
            <input 
                type="checkbox"
                id="includePaid"
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                checked={filters.includePaid}
                onChange={(e) => setFilters(f => ({ ...f, includePaid: e.target.checked }))}
            />
            <label htmlFor="includePaid" className="text-sm text-slate-600 font-medium cursor-pointer select-none">
                Mostrar Histórico / Pagados
            </label>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <DollarSign size={16} />
              <span className="text-sm font-medium">Total Pendiente</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatCurrency(totalPending)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">Vencido</span>
            </div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Clock size={16} />
              <span className="text-sm font-medium">Por Vencer</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalDueSoon)}</div>
          </div>
        </div>
      </div>

      {/* Printable Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-slate-100 print:block hidden">
          <h1 className="text-2xl font-bold text-slate-800">Reporte de Cuentas por {filters.type === 'PAYABLE' ? 'Pagar' : 'Cobrar'}</h1>
          <p className="text-slate-500 text-sm">Generado el {new Date().toLocaleDateString()}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Contacto</th>
                <th className="px-6 py-3 text-right">Vencido</th>
                <th className="px-6 py-3 text-right">Por Vencer</th>
                <th className="px-6 py-3 text-right">Total Pendiente</th>
                <th className="px-6 py-3 w-10 print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Cargando...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay cuentas pendientes</td></tr>
              ) : (
                data.map(contact => (
                  <>
                    <tr 
                      key={contact.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedContact(expandedContact === contact.id ? null : contact.id)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {contact.name}
                        <div className="text-xs text-slate-400 font-normal">{contact.type}</div>
                      </td>
                      <td className="px-6 py-4 text-right text-red-600 font-medium">
                        {contact.overdue > 0 ? formatCurrency(contact.overdue) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-blue-600 font-medium">
                        {contact.dueSoon > 0 ? formatCurrency(contact.dueSoon) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-800">
                        {formatCurrency(contact.totalPending)}
                      </td>
                      <td className="px-6 py-4 text-right print:hidden">
                        {expandedContact === contact.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {/* Expanded Details */}
                    {(expandedContact === 'ALL' || expandedContact === contact.id || filters.includePaid || (typeof window !== 'undefined' && window.matchMedia('print').matches)) && (
                      <tr className="bg-slate-50/50 print:bg-white animate-in slide-in-from-top-1">
                        <td colSpan={5} className="px-6 py-4">
                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden print:border-0">
                            <table className="w-full text-xs">
                              <thead className="bg-slate-100 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="px-4 py-2 text-left">Fecha</th>
                                  <th className="px-4 py-2 text-left">Vencimiento</th>
                                  <th className="px-4 py-2 text-left">Tipo</th>
                                  <th className="px-4 py-2 text-left">Descripción</th>
                                  <th className="px-4 py-2 text-right">Base Imp.</th>
                                  <th className="px-4 py-2 text-right">IVA</th>
                                  <th className="px-4 py-2 text-right">Monto Total</th>
                                  <th className="px-4 py-2 text-right">Pagado (Abonos)</th>
                                  <th className="px-4 py-2 text-right">Pendiente ({filters.currency})</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {contact.items.map(item => (
                                  <>
                                    <tr 
                                      key={item.id} 
                                      className={`hover:bg-slate-50 transition-colors ${item.payments && item.payments.length > 0 ? 'cursor-pointer' : ''}`}
                                      onClick={() => {
                                        if (item.payments && item.payments.length > 0) {
                                          setExpandedItem(expandedItem === item.id ? null : item.id);
                                        }
                                      }}
                                    >
                                      <td className="px-4 py-2 text-slate-600">
                                        <div className="flex items-center gap-2">
                                          {item.payments && item.payments.length > 0 && (
                                            <span className="text-slate-400">
                                              {expandedItem === item.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </span>
                                          )}
                                          {new Date(item.date).toLocaleDateString()}
                                        </div>
                                      </td>
                                      <td className={`px-4 py-2 font-medium ${item.isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                                        {new Date(item.dueDate).toLocaleDateString()}
                                        {item.isOverdue && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 rounded">Vencido</span>}
                                      </td>
                                      <td className="px-4 py-2 text-slate-600 font-medium">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${item.type === 'INVOICE' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-gray-50 text-gray-700 border border-gray-100'}`}>
                                            {item.docType || (item.type === 'INVOICE' ? 'Factura' : 'Gasto')}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-slate-800">{item.description}</td>
                                      <td className="px-4 py-2 text-right text-slate-600 font-medium text-xs">
                                        {new Intl.NumberFormat('es-VE', { style: 'currency', currency: item.originalCurrency === 'BS' ? 'VES' : item.originalCurrency }).format( (item.totalAmount || item.originalAmount) - (item.taxAmount || 0) )}
                                      </td>
                                      <td className="px-4 py-2 text-right text-slate-500 text-xs">
                                        {(item.taxAmount && item.taxAmount > 0) ? (
                                            <span className="text-slate-600">
                                                {new Intl.NumberFormat('es-VE', { style: 'currency', currency: item.originalCurrency === 'BS' ? 'VES' : item.originalCurrency }).format(item.taxAmount)}
                                            </span>
                                        ) : '-'}
                                      </td>
                                      <td className="px-4 py-2 text-right text-slate-500">
                                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: item.originalCurrency === 'BS' ? 'VES' : item.originalCurrency }).format(item.totalAmount || item.originalAmount)}
                                    </td>
                                    <td className="px-4 py-2 text-right text-green-600">
                                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: item.originalCurrency === 'BS' ? 'VES' : item.originalCurrency }).format(item.paidAmount || 0)}
                                        {(item.paymentCount || 0) > 0 && (
                                          <span className="ml-2 inline-flex items-center justify-center bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full" title={`${item.paymentCount} abonos`}>
                                            {item.paymentCount}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-right font-medium text-slate-800">
                                        {formatCurrency(item.amount)}
                                      </td>
                                    </tr>
                                    {/* Payment Details Sub-row */}
                                    {expandedItem === item.id && item.payments && (
                                      <tr className="bg-slate-50/80">
                                        <td colSpan={8} className="px-4 py-2 pl-12">
                                          <div className="bg-white border border-slate-200 rounded-md overflow-hidden text-xs shadow-sm">
                                            <table className="w-full">
                                              <thead className="bg-slate-50 text-slate-500">
                                                <tr>
                                                  <th className="px-3 py-1.5 text-left font-medium">Fecha</th>
                                                  <th className="px-3 py-1.5 text-left font-medium">Referencia</th>
                                                  <th className="px-3 py-1.5 text-left font-medium">Método</th>
                                                  <th className="px-3 py-1.5 text-right font-medium">Monto</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                {item.payments.map((payment, idx) => (
                                                  <tr key={idx}>
                                                    <td className="px-3 py-1.5 text-slate-600">
                                                      {new Date(payment.date).toLocaleDateString()} {new Date(payment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-slate-600">{payment.reference || '-'}</td>
                                                    <td className="px-3 py-1.5 text-slate-600">{payment.method}</td>
                                                    <td className="px-3 py-1.5 text-right font-medium text-green-600">
                                                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: payment.currency === 'BS' ? 'VES' : payment.currency }).format(payment.amount)}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                ))}
                              </tbody>
                              <tfoot className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                                {Object.entries(
                                  contact.items.reduce((acc, item) => {
                                    const curr = item.originalCurrency;
                                    if (!acc[curr]) acc[curr] = { base: 0, tax: 0, total: 0, paid: 0, pendingConverted: 0 };
                                    const totalAmt = item.totalAmount || item.originalAmount;
                                    const taxAmt = item.taxAmount || 0;
                                    acc[curr].base += totalAmt - taxAmt;
                                    acc[curr].tax += taxAmt;
                                    acc[curr].total += totalAmt;
                                    acc[curr].paid += item.paidAmount || 0;
                                    acc[curr].pendingConverted += item.amount;
                                    return acc;
                                  }, {} as Record<string, { base: number, tax: number, total: number, paid: number, pendingConverted: number }>)
                                ).map(([curr, totals]) => (
                                  <tr key={curr}>
                                    <td colSpan={4} className="px-4 py-2 text-right text-xs">Total en {curr === 'BS' ? 'Bs.S' : curr}:</td>
                                    <td className="px-4 py-2 text-right text-xs">
                                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: curr === 'BS' ? 'VES' : curr }).format(totals.base)}
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs">
                                      {totals.tax > 0 ? new Intl.NumberFormat('es-VE', { style: 'currency', currency: curr === 'BS' ? 'VES' : curr }).format(totals.tax) : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs">
                                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: curr === 'BS' ? 'VES' : curr }).format(totals.total)}
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs text-green-700">
                                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: curr === 'BS' ? 'VES' : curr }).format(totals.paid)}
                                    </td>
                                    <td className="px-4 py-2 text-right text-xs">
                                      {formatCurrency(totals.pendingConverted)}
                                    </td>
                                  </tr>
                                ))}
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
              <tr>
                <td className="px-6 py-4">TOTAL GENERAL</td>
                <td className="px-6 py-4 text-right text-red-600">{formatCurrency(totalOverdue)}</td>
                <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(totalDueSoon)}</td>
                <td className="px-6 py-4 text-right">{formatCurrency(totalPending)}</td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          @page { margin: 1cm; }
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:bg-white { background: white !important; }
        }
      `}</style>
    </div>
  );
}
