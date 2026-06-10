"use client";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Save, CreditCard, Wallet, Building2, Calculator, ArrowRightLeft, RefreshCw, AlertCircle, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function PayInvoicePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  
  // Form State
  const [amount, setAmount] = useState(''); // Amount in payment currency (e.g. BS)
  const [invoiceAmount, setInvoiceAmount] = useState(''); // Amount in invoice currency (e.g. USD)
  const [paymentCurrency, setPaymentCurrency] = useState('BS');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [accountId, setAccountId] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [reference, setReference] = useState(''); // Reference code/note from user
  
  // Rate Selection State
  const [rateOptions, setRateOptions] = useState<any>(null); // { BCV: ..., BINANCE: ..., CUSTOM: ... }
  const [selectedRateSource, setSelectedRateSource] = useState<'BCV'|'BINANCE'|'CUSTOM'>('BCV');
  const [loadingRates, setLoadingRates] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Derived
  const isMultiCurrency = invoice && paymentCurrency !== invoice.currency;
  const isBill = invoice?.type === 'BILL';

  // Helper to convert amounts
  const convertAmount = (val: number, fromCurr: string, toCurr: string, rateVal: number) => {
    if (fromCurr === toCurr) return val;
    if (fromCurr === 'USD' && toCurr === 'BS') {
      return val * rateVal;
    }
    if (fromCurr === 'BS' && toCurr === 'USD') {
      return rateVal > 0 ? val / rateVal : 0;
    }
    return val;
  };

  // Safe Two-way Synchronized Inputs
  const syncAmounts = (
    newPaymentCurrency: string,
    newRateStr: string,
    changedField: 'paymentAmount' | 'invoiceAmount' | 'rate',
    currentVal: string
  ) => {
    const rateNum = parseFloat(newRateStr);
    const hasRate = !isNaN(rateNum) && rateNum > 0;
    
    if (!invoice) return;

    if (newPaymentCurrency === invoice.currency) {
      if (changedField === 'paymentAmount') {
        setAmount(currentVal);
        setInvoiceAmount(currentVal);
      } else {
        setAmount(currentVal);
        setInvoiceAmount(currentVal);
      }
      return;
    }

    // Multi-currency conversion active
    if (changedField === 'paymentAmount') {
      setAmount(currentVal);
      const valNum = parseFloat(currentVal);
      if (isNaN(valNum) || !hasRate) {
        setInvoiceAmount('');
      } else {
        const converted = convertAmount(valNum, newPaymentCurrency, invoice.currency, rateNum);
        setInvoiceAmount(converted.toFixed(2));
      }
    } else if (changedField === 'invoiceAmount') {
      setInvoiceAmount(currentVal);
      const valNum = parseFloat(currentVal);
      if (isNaN(valNum) || !hasRate) {
        setAmount('');
      } else {
        const converted = convertAmount(valNum, invoice.currency, newPaymentCurrency, rateNum);
        setAmount(converted.toFixed(2));
      }
    } else if (changedField === 'rate') {
      setExchangeRate(currentVal);
      // If rate changed, we keep the invoice amount (outstanding USD) constant and recalculate payment amount (BS)
      const invAmtNum = parseFloat(invoiceAmount);
      if (isNaN(invAmtNum) || !hasRate) {
        setAmount('');
      } else {
        const converted = convertAmount(invAmtNum, invoice.currency, newPaymentCurrency, rateNum);
        setAmount(converted.toFixed(2));
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.invoices.getById(id);
        const inv = res.data.data || res.data;
        setInvoice(inv);
        
        // Default payment currency to invoice currency initially
        const initialCurrency = inv.currency || 'USD';
        setPaymentCurrency(initialCurrency);
        
        // Load default amount (outstanding)
        if (inv.outstanding) {
          setInvoiceAmount(inv.outstanding.toString());
          setAmount(inv.outstanding.toString());
        }

        // Fetch accounts
        if (inv.projectId) {
          try {
            const resAcc = await api.accounts.getAll({ projectId: inv.projectId });
            const allAccounts = resAcc.data.data || [];
            // Filter for Financial Accounts (Bank, Cash, Wallet)
            const financialAccounts = allAccounts.filter((a: any) => 
              ['BANK', 'CASH', 'WALLET'].includes(a.subType) && a.isActive
            );
            setAccounts(financialAccounts);
            
            // Try to set default account if one matches currency
            const matchCurrency = financialAccounts.find((a: any) => a.currency === initialCurrency);
            if (matchCurrency) {
                 setAccountId(matchCurrency.id);
            } else if (financialAccounts.length > 0) {
                 const fallback = financialAccounts[0];
                 setAccountId(fallback.id);
                 setPaymentCurrency(fallback.currency);
                 if (inv.outstanding) {
                   // Calculate payment amount in the fallback currency
                   // If rate is not loaded yet, just set amount to outstanding (handles no-rate initially)
                   setAmount(inv.outstanding.toString());
                 }
            }
          } catch (e) {
            console.error('Error loading accounts', e);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Error cargando la factura');
      }
    };
    load();
  }, [id]);

  // Effect to load rates when multi-currency is detected
  useEffect(() => {
    if (isMultiCurrency) {
        fetchRates();
    }
  }, [isMultiCurrency]);

  const fetchRates = async () => {
    setLoadingRates(true);
    try {
        const res = await api.exchangeRates.getLatestBySource();
        if (res.data.success) {
            setRateOptions(res.data.data);
        }
    } catch (e) {
        console.error("Error fetching rates", e);
    } finally {
        setLoadingRates(false);
    }
  };

  // Effect to set exchangeRate based on selection
  useEffect(() => {
    if (!rateOptions || !isMultiCurrency) return;

    if (selectedRateSource !== 'CUSTOM') {
        const option = rateOptions[selectedRateSource];
        if (option && option.usdToBs) {
             const rateVal = option.usdToBs.toString();
             setExchangeRate(rateVal);
             syncAmounts(paymentCurrency, rateVal, 'invoiceAmount', invoiceAmount);
        }
    }
  }, [selectedRateSource, rateOptions, isMultiCurrency]);

  const submit = async (e: any) => {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    
    if (isNaN(value) || value <= 0) {
      setError('Ingrese un monto válido mayor que 0');
      return;
    }
    
    if (!accountId) {
      setError(isBill ? 'Seleccione la cuenta de origen del dinero' : 'Seleccione la cuenta de destino del dinero');
      return;
    }

    if (isMultiCurrency) {
        const rate = Number(exchangeRate);
        if (isNaN(rate) || rate <= 0) {
            setError('Debe ingresar una Tasa de Cambio válida para la conversión');
            return;
        }
    }

    setLoading(true);
    try {
      if (!invoice?.projectId) throw new Error('Error: Proyecto no identificado');

      const payload = {
          projectId: invoice.projectId,
          date: new Date(),
          amount: value,
          currency: paymentCurrency,
          method,
          accountId,
          reference: reference || '',
          allocations: [{ invoiceId: invoice.id, amount: value }],
          // Cross-Currency Fields
          targetCurrency: invoice.currency,
          exchangeRate: isMultiCurrency ? Number(exchangeRate) : undefined
      };

      // Use centralized API client instead of direct fetch
      // This maps to POST /api/payments (Smart Payment Service)
      await api.payments.create(payload);
      
      setSuccess(isBill ? 'Pago registrado correctamente' : 'Cobro registrado correctamente');
      setTimeout(() => router.push('/invoices'), 1500);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error?.message || err.message || 'Error al procesar la operación';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/invoices" className="text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Volver a Facturas
        </Link>
        <h2 className="text-2xl font-bold">{isBill ? 'Registrar Pago' : 'Registrar Cobro'}</h2>
        <p className="text-muted-foreground">Smart ERP para {invoice?.code}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Invoice Summary Header */}
        {invoice && (
            <div className="bg-gray-50 border-b px-6 py-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Factura</span>
                <div className="font-bold text-xl text-gray-900">{invoice.currency} {Number(invoice.total).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{isBill ? 'Por Pagar' : 'Por Cobrar'}</span>
                <div className="font-bold text-xl text-blue-600">{invoice.currency} {Number(invoice.outstanding).toLocaleString()}</div>
              </div>
            </div>
        )}

        <form onSubmit={submit} className="p-6 space-y-6">
          
          {/* 1. Account Selection */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isBill ? '1. ¿Desde dónde sale el dinero?' : '1. ¿A qué cuenta entra el dinero?'}
            </label>
            <div className="grid gap-3">
                <select 
                  className="w-full p-3 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none text-base"
                  value={accountId} 
                  onChange={(e) => {
                      setAccountId(e.target.value);
                      const acc = accounts.find(a => a.id === e.target.value);
                      if (acc) {
                          const newCurr = acc.currency;
                          setPaymentCurrency(newCurr);
                          syncAmounts(newCurr, exchangeRate, 'invoiceAmount', invoiceAmount);
                      }
                  }}
                >
                  <option value="">{isBill ? '-- Seleccionar Banco / Caja de salida --' : '-- Seleccionar Banco / Caja de entrada --'}</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency}) - {acc.bankName || acc.subType}
                    </option>
                  ))}
                </select>
                {accountId && (
                    <div className="text-xs text-gray-500 ml-1">
                        Moneda de la cuenta seleccionada: <strong>{paymentCurrency}</strong>
                    </div>
                )}
            </div>
          </section>

          {/* 2. Amount & Conversion Logic */}
          <section className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">2. Monto de la operación</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Monto a {isBill ? 'pagar' : 'cobrar'} ({paymentCurrency})</label>
                    <div className="relative">
                        <input 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none font-mono text-lg" 
                            inputMode="decimal" 
                            value={amount} 
                            onChange={(e) => syncAmounts(paymentCurrency, exchangeRate, 'paymentAmount', e.target.value)} 
                            placeholder="0.00"
                        />
                    </div>
                </div>

                {isMultiCurrency && (
                   <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-yellow-800 flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3" /> TASA DE CAMBIO
                            </label>
                            <button type="button" onClick={fetchRates} className="text-blue-600 hover:text-blue-800" title="Refrescar tasas">
                                <RefreshCw className={`w-3 h-3 ${loadingRates ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Rate Source Selector */}
                        <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                            {(['BCV', 'BINANCE', 'CUSTOM'] as const).map(source => {
                                const rateVal = rateOptions ? rateOptions[source]?.usdToBs : null;
                                return (
                                    <button
                                        key={source}
                                        type="button"
                                        onClick={() => setSelectedRateSource(source)}
                                        className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all text-center ${
                                            selectedRateSource === source 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {source} {source !== 'CUSTOM' && rateVal ? <span className="opacity-80 block text-[10px]">{rateVal}</span> : ''}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Rate Value Input */}
                        <div>
                             <input 
                                className="w-full p-2 bg-white border border-yellow-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 rounded-xl transition-all outline-none text-center font-mono text-lg" 
                                inputMode="decimal" 
                                value={exchangeRate} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setExchangeRate(val);
                                    if(selectedRateSource !== 'CUSTOM') setSelectedRateSource('CUSTOM');
                                    syncAmounts(paymentCurrency, val, 'rate', val);
                                }} 
                                placeholder="0.00"
                             />
                             <div className="text-[10px] text-center text-gray-400 mt-1">Bs/USD</div>
                        </div>
                   </div>
                )}
            </div>

            {isMultiCurrency && invoice ? (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                         <span className="text-sm text-blue-800">Equivale a:</span>
                         <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Abonado a la factura ({invoice.currency})</span>
                    </div>
                    
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-blue-700 font-bold">$</span>
                        <input
                             className="w-full p-2 bg-white border border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none font-bold text-lg text-blue-700 pl-8"
                             value={invoiceAmount}
                             onChange={(e) => syncAmounts(paymentCurrency, exchangeRate, 'invoiceAmount', e.target.value)}
                             inputMode="decimal"
                             placeholder="0.00"
                        />
                    </div>
                    <div className="text-right text-xs text-blue-500">
                        Este es el monto real en {invoice.currency} que se descontará de la factura. Puedes editar cualquiera de los dos montos para ajustarlos.
                    </div>
                </div>
            ) : null}

          </section>

          {/* 3. Method */}
          <section>
             <label className="block text-sm font-medium text-gray-700 mb-2">3. Método de operación</label>
             <div className="grid grid-cols-4 gap-3">
              {[
                  { id: 'BANK_TRANSFER', label: 'Transferencia', icon: Building2 },
                  { id: 'MOBILE_PAYMENT', label: 'Pago Móvil', icon: Smartphone },
                  { id: 'CASH', label: 'Efectivo', icon: Wallet },
                  { id: 'CARD', label: 'Tarjeta', icon: CreditCard },
              ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${
                        method === m.id 
                        ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm' 
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{m.label}</span>
                  </button>
              ))}
            </div>
          </section>

          {/* 4. Reference or Note */}
          <section>
             <label className="block text-sm font-medium text-gray-700 mb-2">4. Referencia o Nota (Opcional)</label>
             <input
                type="text"
                placeholder="Ej. Transferencia #12345, Pago móvil BNC, Efectivo caja"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
             />
          </section>

          {/* Feedback & Actions */}
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>{error}</div>
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200 flex items-start gap-2">
               <span className="mt-0.5">✅</span>
               <div>{success}</div>
            </div>
          )}

          <button 
            className="w-full py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
            type="submit" 
            disabled={loading || !amount || !accountId}
          >
            {loading ? 'Procesando...' : (isBill ? 'Registrar Pago' : 'Registrar Cobro')}
          </button>
          
          <p className="text-center text-xs text-gray-400">
              Smart ERP generará automáticamente los asientos contables debidos.
          </p>

        </form>
      </div>
    </div>
  );
}
