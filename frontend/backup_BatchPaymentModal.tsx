"use client";
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { normalizeDateInputForApi, getLocalDateInputValue } from '@/lib/dateUtils';

export default function BatchPaymentModal({ selected, projectId, onDone }: { selected: Array<any>, projectId: string, onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [allocs, setAllocs] = useState<{ transactionId: string, code: string, currency: string, outstanding: number, amount: number }[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [currency, setCurrency] = useState<string>('BS');
  const [method, setMethod] = useState<'CASH'|'BANK_TRANSFER'|'CARD'|'CHEQUE'|'OTHER'>('BANK_TRANSFER');
  const [reference, setReference] = useState<string>('');
  const [date] = useState<string>(getLocalDateInputValue());
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
    // initialize allocations from selected
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

  return (
    <div>
      <button disabled={!selected || selected.length === 0} className={`btn ${selected && selected.length > 0 ? 'btn-fink' : 'btn-ghost'}`} onClick={() => setOpen(true)}>{actionLabel} ({selected?.length || 0})</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{actionLabel}</h3>
            <div className="mb-2 text-sm text-gray-600">Revisa los montos, elige la misma cuenta para todo el lote y ajusta si necesitas aplicar pagos o cobros parciales.</div>
            {hasMixedTypes && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Seleccionaste gastos e ingresos mezclados. Procesa cada tipo por separado.
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              {allocs.map(a => (
                <div key={a.transactionId} className="p-2 border rounded flex items-center gap-2">
                  <div className="w-48">
                    <div className="text-xs text-gray-500">{a.code}</div>
                    <div className="text-sm font-bold text-slate-800">{a.currency} {new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(Number(a.outstanding))}</div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs">Monto a pagar</label>
                    <input className="input" type="number" value={String(a.amount)} onChange={(e) => updateAllocAmount(a.transactionId, Number(e.target.value) || 0)} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs">Cuenta / Banco</label>
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {accounts.map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.code ? `${account.code} - ` : ''}{account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs">Moneda del pago</label>
                <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="BS">Bs</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-xs">Método</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                  <option value="BANK_TRANSFER">Transferencia bancaria</option>
                  <option value="MOBILE_PAYMENT">Pago Móvil</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

              {mixedCurrencies && (
                <div className="mt-3 p-3 border rounded bg-yellow-50">
                  <div className="text-sm font-semibold">Atención: monedas diferentes</div>
                  <div className="text-xs text-gray-700 mt-1">Las transacciones seleccionadas están en monedas diferentes: {currencies.join(', ')}. El pago se registrará en la moneda seleccionada arriba y se aplicará conversión por transacción (si la transacción tiene una tasa específica se usará esa, si no se usará la tasa global más reciente).</div>
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input type="checkbox" checked={allowConversion} onChange={(e) => setAllowConversion(e.target.checked)} /> Permitir conversión automática por transacción
                  </label>
                  {!allowConversion && <div className="text-xs text-red-600 mt-2">Deshabilitado: Habilita la conversión para proceder con monedas mixtas.</div>}
                </div>
              )}

            <div className="mt-2">
              <label className="text-xs">Referencia (opcional)</label>
              <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-fink" onClick={submit} disabled={loading || supportedSelected.length === 0 || hasMixedTypes}>{loading ? 'Procesando...' : actionType === 'COLLECTION' ? 'Crear cobro' : 'Crear pago'}</button>
            </div>
            {error && <div className="text-red-600 mt-2">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

