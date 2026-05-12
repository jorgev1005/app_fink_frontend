"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { getLocalDateInputValue, normalizeDateInputForApi } from '@/lib/dateUtils';

export default function PayTransactionModal({ transactionId, projectId, currency, outstanding, type, onDone }: { transactionId: string, projectId: string, currency: string, outstanding: number, type?: string, onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(outstanding || 0);
  const [paymentCurrency, setPaymentCurrency] = useState<string>(currency);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [method, setMethod] = useState<'CASH'|'BANK_TRANSFER'|'CARD'|'CHEQUE'|'OTHER'>('BANK_TRANSFER');
  const [reference, setReference] = useState<string>('');
  const [date, setDate] = useState<string>(getLocalDateInputValue());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [availableRates, setAvailableRates] = useState<any[]>([]);

  const isIncome = type === 'INCOME';
  const actionLabel = isIncome ? 'Cobrar' : 'Pagar';
  const titleLabel = isIncome ? 'Registrar Cobro' : 'Registrar Pago';
  const amountLabel = isIncome ? 'Monto a Cobrar' : 'Monto a Pagar';
  const accountLabel = isIncome ? 'Cuenta de Destino (Depósito)' : 'Cuenta de Origen (Retiro)';

  useEffect(() => {
    if (open) {
      setPaymentCurrency(currency);
      setAmount(outstanding);
      fetchRate();
      fetchAccounts();
    }
  }, [open, currency, outstanding]);

  const fetchRate = async () => {
    try {
      const [resLatest, resSources] = await Promise.all([
        api.exchangeRates.getLatest(),
        api.exchangeRates.getLatestBySource()
      ]);
      
      if (resLatest.data?.usdToBs) {
        setExchangeRate(resLatest.data.usdToBs);
      }
      if (resSources.data?.data) {
        const ratesObj = resSources.data.data;
        const ratesArray = [];
        // Normalize and filter valid rates
        if (ratesObj.BCV?.usdToBs) ratesArray.push({ source: 'BCV', rate: ratesObj.BCV.usdToBs });
        if (ratesObj.BINANCE?.usdToBs) ratesArray.push({ source: 'BINANCE', rate: ratesObj.BINANCE.usdToBs });
        // Handle API as BINANCE if needed, or just check what keys come back
        if (ratesObj.API?.usdToBs) ratesArray.push({ source: 'BINANCE', rate: ratesObj.API.usdToBs });
        if (ratesObj.CUSTOM?.usdToBs) ratesArray.push({ source: 'CUSTOM', rate: ratesObj.CUSTOM.usdToBs });
        
        setAvailableRates(ratesArray);
      } else if (resSources.data) {
        // Fallback if data is directly in data (unlikely but possible depending on controller)
        // The controller returns { success: true, data: { BCV: ..., BINANCE: ... } }
        // So resSources.data.data is correct.
        // If we are here, maybe the structure is different?
        // Let's try to handle if it's just an array or something else
        console.log('Rates response structure:', resSources.data);
      }
    } catch (e) {
      console.error('Error fetching rate', e);
    }
  };

  const fetchAccounts = async () => {
    if (!projectId) return;
    try {
      const res = await api.accounts.getAll({ projectId });
      const all = res.data.data || [];
      // Filter for liquid accounts (BANK, CASH, WALLET, etc)
      // Make case insensitive and include more types
      const validTypes = ['BANK', 'CASH', 'WALLET', 'CREDIT_CARD', 'EXCHANGE'];
      const banks = all.filter((a: any) => 
        a.isActive && 
        a.subType && 
        validTypes.includes(a.subType.toUpperCase())
      );
      setAccounts(banks);
      if (banks.length > 0) setAccountId(banks[0].id);
    } catch (e) {
      console.error('Error fetching accounts', e);
    }
  };

  // Update amount when currency changes
  useEffect(() => {
    if (!open) return;
    if (paymentCurrency === currency) {
      setAmount(outstanding);
    } else {
      if (exchangeRate > 0) {
        if (paymentCurrency === 'BS' && currency === 'USD') {
          setAmount(Number((outstanding * exchangeRate).toFixed(2)));
        } else if (paymentCurrency === 'USD' && currency === 'BS') {
          setAmount(Number((outstanding / exchangeRate).toFixed(2)));
        }
      }
    }
  }, [paymentCurrency, exchangeRate]);

  const submit = async () => {
    setError(null);
    if (!projectId) return setError('Proyecto requerido');
    if (!amount || amount <= 0) return setError('Monto debe ser mayor a 0');
    if (autoPost && !accountId) return setError('Debe seleccionar una cuenta para afectar el saldo');

    setLoading(true);
    try {
      const payload = {
        projectId,
        date: normalizeDateInputForApi(date),
        currency: paymentCurrency,
        amount,
        method,
        reference,
        exchangeRate: exchangeRate > 0 ? exchangeRate : undefined,
        allocations: [ { transactionId, amount } ],
        accountId: autoPost ? accountId : undefined,
        type: isIncome ? 'INCOME' : 'EXPENSE'
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
    <div onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={() => setOpen(true)}
        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
      >
        {actionLabel}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-[520px] border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{titleLabel}</h3>
            
            <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Monto Pendiente</div>
              <div className="text-xl font-mono font-bold text-slate-700">
                {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(outstanding)} <span className="text-sm text-slate-500">{currency}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Moneda de {isIncome ? 'Cobro' : 'Pago'}</label>
                <select 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  value={paymentCurrency} 
                  onChange={(e) => setPaymentCurrency(e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="BS">BS</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              
              {paymentCurrency !== currency && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tasa de Cambio</label>
                  <input 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                    type="number" 
                    value={exchangeRate} 
                    onChange={(e) => setExchangeRate(Number(e.target.value))} 
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableRates.map((rate: any) => (
                      <button
                        key={rate.source}
                        onClick={() => setExchangeRate(rate.rate)}
                        className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg transition-colors border border-blue-100"
                        title={`Usar tasa ${rate.source}`}
                      >
                        {rate.source}: {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(rate.rate)}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setExchangeRate(0);
                        // Focus input if possible, or just clear to allow typing
                      }}
                      className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded-lg transition-colors border border-slate-200"
                      title="Ingresar tasa manual"
                    >
                      Custom
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{amountLabel} ({paymentCurrency})</label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-mono font-medium"
                  type="number" 
                  value={String(amount)} 
                  onChange={(e) => setAmount(Number(e.target.value) || 0)} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Método</label>
                <select 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  value={method} 
                  onChange={(e) => setMethod(e.target.value as any)}
                >
                  <option value="BANK_TRANSFER">Transferencia</option>
                  <option value="MOBILE_PAYMENT">Pago Móvil</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Referencia</label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  placeholder="Opcional"
                  value={reference} 
                  onChange={(e) => setReference(e.target.value)} 
                />
              </div>
            </div>

            <div className="mb-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <input 
                  id="autoPostModal" 
                  type="checkbox" 
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  checked={autoPost} 
                  onChange={(e) => setAutoPost(e.target.checked)} 
                />
                <label htmlFor="autoPostModal" className="text-sm font-medium text-slate-700">
                  Afectar saldo de cuenta (Auto-post)
                </label>
              </div>
              
              {autoPost && (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">{accountLabel}</label>
                  <select 
                    className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">-- Seleccionar Cuenta --</option>
                    {accounts.map(acc => {
                      const bal = paymentCurrency === 'USD' ? acc.balanceUsd : (paymentCurrency === 'EUR' ? acc.balanceEur : acc.balanceBs);
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} - {acc.bankName || acc.subType} - Saldo: {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(Number(bal || 0))} {paymentCurrency}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={submit} 
                disabled={loading}
              >
                {loading ? 'Procesando...' : `Confirmar ${isIncome ? 'Cobro' : 'Pago'}`}
              </button>
            </div>
            {error && <div className="text-red-500 text-sm mt-3 bg-red-50 p-2 rounded-lg border border-red-100">{error}</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
