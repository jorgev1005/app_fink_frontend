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
  const [amount, setAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('BS');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [accountId, setAccountId] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  
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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.invoices.getById(id);
        const inv = res.data.data || res.data;
        setInvoice(inv);
        
        // Default payment currency to invoice currency initially
        if (inv.currency) setPaymentCurrency(inv.currency);
        
        // Load default amount (outstanding)
        if (inv.outstanding) setAmount(inv.outstanding.toString());

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
            const matchCurrency = financialAccounts.find((a: any) => a.currency === inv.currency);
            if (matchCurrency) {
                 setAccountId(matchCurrency.id);
                 // No need to setPaymentCurrency as it matches invoice currency already set above
            }
            else if (financialAccounts.length > 0) {
                 const fallback = financialAccounts[0];
                 setAccountId(fallback.id);
                 setPaymentCurrency(fallback.currency); // Correctly update currency
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
             // Logic: If paying USD invoice with BS, we need Bs/USD rate (e.g. 50).
             // If paying BS invoice with USD, we also need Bs/USD rate usually provided by API.
             // Our API provides "usdToBs". 
             setExchangeRate(option.usdToBs.toString());
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
      setError('Seleccione la cuenta de origen del dinero');
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
          reference: '', // Allow user to add reference? UI doesn't seem to have input for it currently, or I missed it.
          allocations: [{ invoiceId: invoice.id, amount: value }],
          // Cross-Currency Fields
          targetCurrency: invoice.currency,
          exchangeRate: isMultiCurrency ? Number(exchangeRate) : undefined
      };

      // Use centralized API client instead of direct fetch
      // This maps to POST /api/payments (Smart Payment Service)
      await api.payments.create(payload);
      
      setSuccess('Pago registrado correctamente');
      setTimeout(() => router.push('/invoices'), 1500);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error?.message || err.message || 'Error al procesar el pago';
      setError(msg);
      setLoading(false);
    }
  };

  const getConvertedAmount = () => {
      const amt = Number(amount);
      const rate = Number(exchangeRate);
      if (!amt || !rate) return '--';
      
      // Assuming rate is USD to BS (e.g. 50.00)
      
      // Case 1: Source BS, Target USD.  (Paying USD voice with BS)
      // Amount (BS) / Rate = USD
      if (paymentCurrency === 'BS' && invoice?.currency === 'USD') {
          return (amt / rate).toFixed(2);
      }
      
      // Case 2: Source USD, Target BS. (Paying BS invoice with USD)
      // Amount (USD) * Rate = Bs
      if (paymentCurrency === 'USD' && invoice?.currency === 'BS') {
          return (amt * rate).toFixed(2);
      }
      
      return '??';
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/invoices" className="text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Volver a Facturas
        </Link>
        <h2 className="text-2xl font-bold">Registrar Pago</h2>
        <p className="text-muted-foreground">Smart Payment para {invoice?.code}</p>
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
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Por Pagar</span>
                <div className="font-bold text-xl text-blue-600">{invoice.currency} {Number(invoice.outstanding).toLocaleString()}</div>
              </div>
            </div>
        )}

        <form onSubmit={submit} className="p-6 space-y-8">
          
          {/* 1. Account Selection */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">1. ¿Desde dónde sale el dinero?</label>
            <div className="grid gap-3">
                <select 
                  className="input w-full p-3 text-lg bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                  value={accountId} 
                  onChange={(e) => {
                      setAccountId(e.target.value);
                      const acc = accounts.find(a => a.id === e.target.value);
                      if (acc) setPaymentCurrency(acc.currency);
                  }}
                >
                  <option value="">-- Seleccionar Banco / Caja --</option>
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
            <label className="block text-sm font-medium text-gray-700">2. ¿Cuánto pagaste?</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-xs text-gray-500 mb-1 block">Monto ({paymentCurrency})</label>
                    <div className="relative">
                        <input 
                            className="input w-full pl-3 text-lg font-mono" 
                            inputMode="decimal" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)} 
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
                                        className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all text-center ${
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
                                className="input w-full text-lg font-mono text-center bg-white border-yellow-200 focus:border-yellow-400" 
                                inputMode="decimal" 
                                value={exchangeRate} 
                                onChange={(e) => {
                                    setExchangeRate(e.target.value);
                                    if(selectedRateSource !== 'CUSTOM') setSelectedRateSource('CUSTOM');
                                }} 
                                placeholder="0.00"
                             />
                             <div className="text-[10px] text-center text-gray-400 mt-1">Bs/USD</div>
                        </div>
                   </div>
                )}
            </div>

            {isMultiCurrency && amount && exchangeRate ? (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                         <span className="text-sm text-blue-800">Esto equivale a:</span>
                         <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Editable</span>
                    </div>
                    
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-blue-700 font-bold">$</span>
                        <input
                             className="w-full bg-blue-50/50 text-right text-2xl font-bold text-blue-700 border-none focus:ring-0 p-0 pr-1 cursor-text hover:bg-white/50 transition-colors rounded-md"
                             value={(Number(amount) / Number(exchangeRate)).toFixed(2)}
                             onChange={(e) => {
                                 // Reverse Calculation Logic
                                 // Logic: User wants specific USD amount -> Recalculate Rate
                                 // Rate = SourceAmount / TargetAmount
                                 
                                 // We don't change state immediately to text field because 'value' prop is derived
                                 // Instead we update 'exchangeRate' which implicitly updates the derived value.
                                 // But to avoid cursor jumping and weird math loops while typing, 
                                 // this kind of derived-input is tricky.
                                 // A safer approach for this UX is having a separate 'Calculate Reverse' button or
                                 // simply asking the user "Total" button.
                                 
                                 // Let's implement the 'Target Amount' as a controlled input State if being edited,
                                 // but for now, let's keep it simple. If we want to allow typing "100", 
                                 // we calculate rate 35000/100 = 350.
                                 
                                 const targetVal = parseFloat(e.target.value);
                                 if (!isNaN(targetVal) && targetVal > 0) {
                                     const srcVal = parseFloat(amount);
                                     const newRate = srcVal / targetVal;
                                     setExchangeRate(newRate.toFixed(4));
                                     if(selectedRateSource !== 'CUSTOM') setSelectedRateSource('CUSTOM');
                                 }
                             }}
                            inputMode="decimal"
                        />
                    </div>
                    <div className="text-right text-xs text-blue-500">
                        Se abonará a la factura ({invoice.currency})
                    </div>
                </div>
            ) : null}

          </section>

          {/* 3. Method */}
          <section>
             <label className="block text-sm font-medium text-gray-700 mb-2">3. Método de Pago</label>
             <div className="grid grid-cols-3 gap-3">
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
                    className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        method === m.id 
                        ? 'bg-blue-50 border-blue-600 text-blue-700' 
                        : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{m.label}</span>
                  </button>
              ))}
            </div>
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
            className="btn btn-primary w-full py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed" 
            type="submit" 
            disabled={loading || !amount || !accountId}
          >
            {loading ? 'Procesando...' : `Registrar Pago`}
          </button>
          
          <p className="text-center text-xs text-gray-400">
              Smart ERP generará automáticamente los asientos contables debidos.
          </p>

        </form>
      </div>
    </div>
  );
}
