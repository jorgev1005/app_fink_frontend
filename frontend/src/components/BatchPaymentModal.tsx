"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { normalizeDateInputForApi, getLocalDateInputValue } from '@/lib/dateUtils';
import { AlertCircle, CheckCircle2, Wallet, DollarSign, ListOrdered, FileText } from 'lucide-react';

export default function BatchPaymentModal({ selected, projectId, onDone }: { selected: Array<any>, projectId: string, onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [allocs, setAllocs] = useState<{ transactionId: string, code: string, currency: string, outstanding: number, amount: number }[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [currency, setCurrency] = useState<string>('BS');
  const [method, setMethod] = useState<'CASH'|'BANK_TRANSFER'|'CARD'|'CHEQUE'|'OTHER'|'MOBILE_PAYMENT'>('BANK_TRANSFER');
  const [reference, setReference] = useState<string>('');
  const [date, setDate] = useState<string>(getLocalDateInputValue());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowConversion, setAllowConversion] = useState<boolean>(true);

  const supportedSelected = selected.filter((s: any) =>
    ['INCOME', 'EXPENSE'].includes(String(s.type || '')) &&
    s.status !== 'CANCELLED' &&
    (s.paymentStatus || 'PENDING') !== 'PAID'
  );
  const selectedTypes = Array.from(new Set(supportedSelected.map((s: any) => s.type)));
  const hasMixedTypes = selectedTypes.length > 1;
  const actionType = selectedTypes[0] === 'INCOME' ? 'COLLECTION' : 'PAYMENT';
  const actionLabel = actionType === 'COLLECTION' ? 'Cobrar seleccionadas' : 'Pagar seleccionadas';

  useEffect(() => {
    if (!open) return;
    const arr = supportedSelected.map((s: any) => ({ transactionId: s.id, code: s.code, currency: s.currency, outstanding: (Number(s.amount) - Number(s.amountPaid || 0)) || 0, amount: (Number(s.amount) - Number(s.amountPaid || 0)) || 0 }));
    setAllocs(arr);
    if (arr.length > 0) setCurrency(arr[0].currency || 'BS');
    if (selectedTypes.length === 1) setError(null);
    else if (supportedSelected.length === 0) setError('Selecciona transacciones pendientes de gasto o ingreso.');
    else if (hasMixedTypes) setError('Selecciona solo gastos o solo ingresos en el mismo lote.');
  }, [open, supportedSelected, selectedTypes, hasMixedTypes]);

  useEffect(() => {
    if (!open || !projectId) return;
    const loadAccounts = async () => {
      try {
        const res = await api.accounts.getAll({ projectId });
        const list = (res.data?.data || []).filter((account: any) => account.isActive !== false);
        setAccounts(list);
        if (!accountId && list.length > 0) setAccountId(list[0].id);
      } catch (err) {
        console.error('Error loading accounts for batch payment', err);
      }
    };
    loadAccounts();
  }, [open, projectId, accountId]);

  const currencies = Array.from(new Set(allocs.map(a => a.currency)));
  const mixedCurrencies = currencies.length > 1;

  const updateAllocAmount = (transactionId: string, amount: number) => {
    setAllocs(prev => prev.map(a => a.transactionId === transactionId ? { ...a, amount } : a));
  };

  const submit = async () => {
    setError(null);
    const total = allocs.reduce((s, a) => s + Number(a.amount || 0), 0);
    if (!projectId) return setError('Proyecto requerido');
    if (!accountId) return setError('Selecciona la cuenta o banco para el pago/cobro masivo');
    if (supportedSelected.length === 0) return setError('No hay transacciones elegibles para procesar');
    if (hasMixedTypes) return setError('No mezcles gastos e ingresos en el mismo lote');
    if (total <= 0) return setError('Ingrese al menos un monto mayor a 0');
    if (mixedCurrencies && !allowConversion) return setError('Hay transacciones en distintas monedas. Habilita la conversión automática o unifica las monedas.');
    setLoading(true);
    try {
      const payload = {
        projectId,
        date: normalizeDateInputForApi(date),
        currency,
        amount: total,
        method,
        reference,
        accountId,
        allocations: allocs.filter(a => Number(a.amount) > 0).map(a => ({ transactionId: a.transactionId, amount: Number(a.amount) }))
      };
      const res = await api.payments.create(payload);
      if (res?.data?.success) {
        setOpen(false);
        if (onDone) onDone();
      } else {
        setError(res?.data?.error?.message || 'Error al crear pago');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const accountBalance = selectedAccount ? Number(selectedAccount['balance' + (currency === 'BS' ? 'Bs' : currency === 'USD' ? 'Usd' : 'Eur')] || 0) : 0;
  
  const totalsByCurrency = allocs.reduce((acc, curr) => {
    acc[curr.currency] = (acc[curr.currency] || 0) + Number(curr.amount || 0);
    return acc;
  }, {} as any);

  const isInsufficient = actionType === 'PAYMENT' && accountId && !mixedCurrencies && (totalsByCurrency[currency] || 0) > accountBalance;

  return (
    <div>
      <button disabled={!selected || selected.length === 0} className={selected && selected.length > 0 ? 'btn btn-fink' : 'btn btn-ghost'} onClick={() => setOpen(true)}>{actionLabel} ({selected?.length || 0})</button>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
            
            {/* Cabecera */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{actionLabel}</h3>
                <p className="mt-1 text-sm text-slate-500">Revisa los montos y elige la cuenta para este lote.</p>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                <span className="text-slate-400"><ListOrdered size={16} /></span>
                <span className="font-semibold text-slate-700">{supportedSelected.length}</span>
                <span className="text-xs text-slate-500 uppercase font-medium tracking-wider">Transacciones</span>
              </div>
            </div>

            {/* Contenido (Scrollable) */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
              {error && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg mb-6 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={20} />
                  <p className="text-rose-700 font-medium">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-6">
                {/* Columna Izquierda: Configuración del Pago */}
                <div className="col-span-1 space-y-5">
                   
                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Wallet size={14}/> {actionType === 'PAYMENT' ? 'Cuenta Origen' : 'Cuenta Destino'}</label>
                     <select className="glass-input w-full font-medium" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                       <option value="">Seleccionar...</option>
                       {accounts.map((account: any) => (
                         <option key={account.id} value={account.id}>
                           {account.code ? `${account.code} - ` : ''}{account.name}
                         </option>
                       ))}
                     </select>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moneda Principal</label>
                       <select className="glass-input w-full font-medium" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={mixedCurrencies}>
                         <option value="BS">BS</option>
                         <option value="USD">USD</option>
                         <option value="EUR">EUR</option>
                       </select>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Método</label>
                       <select className="glass-input w-full" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                         <option value="BANK_TRANSFER">Transferencia</option>
                         <option value="MOBILE_PAYMENT">Pago Móvil</option>
                         <option value="CASH">Efectivo</option>
                         <option value="CARD">Tarjeta</option>
                         <option value="OTHER">Otro</option>
                       </select>
                     </div>
                   </div>

                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={14}/> Referencia (Opcional)</label>
                     <input type="text" className="glass-input w-full" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nro de operación" />
                   </div>

                   <div>
                     <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Pago/Cobro</label>
                     <input type="date" className="glass-input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
                   </div>
                </div>

                {/* Columna Derecha: Lista de Transacciones & Totales */}
                <div className="col-span-2 flex flex-col h-full space-y-5">
                   {/* Tabla de asignación */}
                   <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1">
                     <table className="w-full text-sm text-left">
                       <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                         <tr>
                           <th className="px-4 py-3 font-semibold">Código</th>
                           <th className="px-4 py-3 font-semibold text-right">Pendiente</th>
                           <th className="px-4 py-3 font-semibold text-right w-36">Monto a Pagar</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                         {allocs.map((a, i) => (
                           <tr key={a.transactionId} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-4 py-3 font-medium text-slate-700">{a.code} <span className="text-xs text-slate-400 ml-1">{a.currency}</span></td>
                             <td className="px-4 py-3 font-medium text-slate-700 text-right">{new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(a.outstanding)}</td>
                             <td className="px-4 py-2">
                               <div className="relative">
                                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><DollarSign size={14} /></span>
                                 <input 
                                   type="number" step="0.01" 
                                   className="glass-input w-full pl-8 text-right font-semibold text-slate-800 placeholder:font-normal placeholder:opacity-50" 
                                   value={a.amount === 0 ? '' : a.amount} 
                                   onChange={(e) => updateAllocAmount(a.transactionId, parseFloat(e.target.value) || 0)}
                                   placeholder="0.00"
                                 />
                               </div>
                             </td>
                           </tr>
                         ))}
                         {allocs.length === 0 && (
                           <tr>
                             <td colSpan={3} className="px-4 py-8 text-center text-slate-500 italic">No hay transacciones válidas seleccionadas.</td>
                           </tr>
                         )}
                       </tbody>
                     </table>
                   </div>

              {/* Mensaje de Fondos */}
              {accountId && !mixedCurrencies && (
                <div className={`rounded-xl border p-4 flex items-start gap-3 shadow-sm transition-colors ${
                  isInsufficient 
                    ? 'bg-rose-50 border-rose-200/60' 
                    : 'bg-emerald-50 border-emerald-200/60'
                }`}>
                   {isInsufficient ? <AlertCircle className="text-rose-500 mt-0.5 shrink-0" size={22} /> : <CheckCircle2 className="text-emerald-500 mt-0.5 shrink-0" size={22} />}
                   <div className="flex-1">
                     <div className={`font-semibold ${isInsufficient ? 'text-rose-800' : 'text-emerald-800'}`}>
                       {isInsufficient ? 'Fondos Insuficientes' : 'Fondos Suficientes'}
                     </div>
                     <div className={`text-sm mt-1 flex justify-between ${isInsufficient ? 'text-rose-600/80' : 'text-emerald-600/80'}`}>
                        <span>Disponible en banco:</span>
                        <span className="font-bold">{currency} {new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(accountBalance)}</span>
                     </div>
                     
                     {isInsufficient && (
                       <div className="text-sm mt-1 text-rose-700 flex justify-between font-medium">
                         <span>Monto que te hace falta:</span>
                         <span>{currency} {new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format((totalsByCurrency[currency] || 0) - accountBalance)}</span>
                       </div>
                     )}
                   </div>
                </div>
              )}

                   {/* Resumen Total */}
                   <div className="bg-slate-800 text-slate-100 rounded-xl p-5 shadow-inner">
                     {mixedCurrencies ? (
                       Object.entries(totalsByCurrency).map(([curr, amt]) => (
                         <div key={curr} className="flex justify-between items-center mb-2 last:mb-0">
                           <span className="text-slate-400 font-medium">Total Lote <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs ml-2">{curr}</span></span>
                           <span className="text-xl font-bold tracking-tight">{new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(amt as number)}</span>
                         </div>
                       ))
                     ) : (
                       <div className="flex justify-between items-center">
                         <span className="text-slate-400 font-medium">Total Lote <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs ml-2">{currency}</span></span>
                         <span className="text-2xl font-bold tracking-tight">{new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(totalsByCurrency[currency] || 0)}</span>
                       </div>
                     )}
                     {mixedCurrencies && allowConversion && (
                       <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-amber-300 flex items-center gap-1.5">
                         <AlertCircle size={14} /> La API convertirá las monedas a la Principal.
                       </div>
                     )}
                   </div>
                </div>

              </div>
            </div>

            {/* Footer de Acciones */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                className="px-5 py-2.5 rounded-xl font-medium text-slate-700 bg-white border border-slate-300 shadow-sm hover:bg-slate-50 hover:text-slate-900 focus:ring-4 focus:ring-slate-100 active:bg-slate-100 transition-all duration-200" 
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg focus:ring-4 focus:ring-indigo-100 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center gap-2" 
                onClick={submit}
                disabled={loading || supportedSelected.length === 0 || hasMixedTypes || (Boolean(isInsufficient) && actionType === 'PAYMENT')}
              >
                {loading ? <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full"></span> : <div className="hidden"/>} 
                {loading ? 'Procesando...' : actionLabel}
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
