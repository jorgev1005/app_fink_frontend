'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Printer, ArrowLeft, Download, Edit, CreditCard, CheckCircle, FileText, Copy, Play } from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  name?: string; // Fallback for legacy name field
  quantity: number;
  unitPrice: number;
  price?: number; // Fallback for legacy price field
  total: number;
  productId?: string;
}

interface Invoice {
  id: string;
  code: string;
  type: 'INVOICE' | 'BILL';
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: number;
  taxAmount: number;
  description: string;
  projectId: string;
  project?: {
    name: string;
    description?: string;
    logoUrl?: string;
    id?: string;
  };
  contact?: {
    id: string;
    name: string;
    taxId?: string;
    email?: string;
    address?: string;
    phone?: string;
  };
  clientName?: string; // Fallback
  vendorName?: string; // Fallback
  items: InvoiceItem[];
  outstanding: number;
  totalCost?: number;
  netProfit?: number;
}

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);

  // Currency Conversion States
  const [rates, setRates] = useState<any>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>('');
  const [rateSource, setRateSource] = useState<'BCV' | 'BCV_EUR' | 'BINANCE' | 'CUSTOM' | 'MANUAL'>('BCV');
  const [manualRate, setManualRate] = useState<string>('');

  // New state variables for Delivery Note, Duplication & Payment
  const [viewMode, setViewMode] = useState<'INVOICE' | 'DELIVERY_NOTE'>('INVOICE');
  const [showPricesInDeliveryNote, setShowPricesInDeliveryNote] = useState(true);
  const [calculateIVA, setCalculateIVA] = useState<boolean>(false);
  
  // Payment Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const getActiveRate = () => {
    if (rateSource === 'MANUAL') return parseFloat(manualRate) || 1;
    if (rateSource === 'BCV') return rates?.BCV?.usdToBs || 1;
    if (rateSource === 'BCV_EUR') return rates?.BCV?.eurToBs || 1;
    if (rateSource === 'BINANCE') return rates?.BINANCE?.usdToBs || 1;
    if (rateSource === 'CUSTOM') return rates?.CUSTOM?.usdToBs || 1;
    return 1;
  };

  const getConversionFactor = () => {
    if (!invoice) return 1;
    const invCurr = invoice.currency === 'VES' ? 'BS' : invoice.currency;
    const dispCurr = displayCurrency === 'VES' ? 'BS' : displayCurrency;
    
    if (invCurr === dispCurr) return 1;
    
    const rate = getActiveRate();
    if (invCurr === 'USD' && dispCurr === 'BS') {
      return rate;
    }
    if (invCurr === 'BS' && dispCurr === 'USD') {
      return 1 / rate;
    }
    return 1;
  };

  const conversionFactor = getConversionFactor();

  const getInvoiceTotals = () => {
    if (!invoice) return { subtotal: 0, taxAmount: 0, total: 0, outstanding: 0 };
    
    // Default values if calculateIVA is false
    if (!calculateIVA) {
      const subtotal = invoice.total - (invoice.taxAmount || 0);
      return {
        subtotal,
        taxAmount: 0,
        total: subtotal,
        outstanding: invoice.outstanding - (invoice.taxAmount || 0)
      };
    }
    
    // If calculateIVA is true
    if (invoice.taxAmount > 0) {
      // Use existing DB tax values
      return {
        subtotal: invoice.total - invoice.taxAmount,
        taxAmount: invoice.taxAmount,
        total: invoice.total,
        outstanding: invoice.outstanding
      };
    } else {
      // Calculate 16% IVA dynamically
      // TODO: Read default IVA rate from general settings module once created
      const defaultIvaRate = 0.16; 
      const subtotal = invoice.total;
      const calculatedTax = subtotal * defaultIvaRate;
      const total = subtotal + calculatedTax;
      
      const outstanding = invoice.total > 0 ? (invoice.outstanding / invoice.total) * total : 0;
      
      return {
        subtotal,
        taxAmount: calculatedTax,
        total,
        outstanding
      };
    }
  };

  const totals = getInvoiceTotals();

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const resp = await api.exchangeRates.getLatestBySource();
        if (resp.data.success) {
          setRates(resp.data.data);
          if (resp.data.data?.BCV?.usdToBs) {
            setManualRate(String(resp.data.data.BCV.usdToBs));
          }
        }
      } catch (e) {
        console.error("Error loading rates in invoice details", e);
      }
    };
    fetchRates();
  }, []);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.invoices.getById(id);
      const invData = res.data.data;
      
      // Load products for the project to match packaging units (bultos)
      if (invData.projectId) {
        try {
          const prodRes = await api.products.getAll({ projectId: invData.projectId, limit: 100 });
          setProducts(prodRes.data.data || []);
        } catch (pe) {
          console.error("Error loading products for packaging calculation", pe);
        }
      }
      
      // Parse items from lines if they are stored as JSON string in lines field
      let parsedItems = [];
      let taxAmount = 0;
      if (invData.lines) {
         try {
            const parsedLines = typeof invData.lines === 'string' ? JSON.parse(invData.lines) : invData.lines;
            if (Array.isArray(parsedLines)) {
               parsedItems = parsedLines;
            } else if (parsedLines && Array.isArray(parsedLines.items)) {
               parsedItems = parsedLines.items;
               taxAmount = Number(parsedLines.taxAmount) || 0;
            }
         } catch(e) {
            console.error('Error parsing lines in detail view', e);
         }
      }
      
      setInvoice({
         ...invData,
         items: parsedItems,
         taxAmount
      });
      setCalculateIVA(taxAmount > 0);
      setDisplayCurrency(invData.currency || 'USD');
      setPaymentAmount(String(invData.outstanding || 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = async () => {
     if (!invoice) return;
     setIsPaymentModalOpen(true);
     setPaymentError(null);
     try {
        const res = await api.accounts.getAll({ projectId: invoice.projectId });
        // Only keep active asset cash/bank accounts
        const list = (res.data.data || []).filter((a: any) => a.isActive && a.type === 'ASSET' && (a.subType === 'BANK' || a.subType === 'CASH'));
        setAccounts(list);
        if (list.length > 0) {
           setPaymentAccountId(list[0].id);
        }
     } catch (e) {
        console.error('Error loading accounts', e);
     }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!invoice || !paymentAccountId || !paymentAmount) return;
     try {
        setSubmittingPayment(true);
        setPaymentError(null);
        
        await (api.invoices as any).pay(invoice.id, {
           amount: Number(paymentAmount),
           currency: invoice.currency,
           accountId: paymentAccountId,
           method: paymentMethod,
           reference: paymentReference,
           autoPost: true
        });
        
        setIsPaymentModalOpen(false);
        setPaymentReference('');
        await loadInvoice(); // reload invoice
     } catch (err: any) {
        console.error(err);
        setPaymentError(err.response?.data?.error?.message || err.message || 'Error registrando el pago');
     } finally {
        setSubmittingPayment(false);
     }
  };

  const handleDuplicate = () => {
     if (!invoice) return;
     router.push(`/invoices/new?duplicateFrom=${invoice.id}`);
  };

  const handlePost = async () => {
     if (!invoice) return;
     if (!confirm('¿Estás seguro de que deseas publicar este documento? Esto registrará los asientos contables en el libro diario.')) return;
     try {
        setLoading(true);
        await api.invoices.post(invoice.id);
        await loadInvoice(); // reload invoice to get updated status POSTED
     } catch (err: any) {
        console.error(err);
        alert(err.response?.data?.error?.message || err.message || 'Error al publicar la factura');
     } finally {
        setLoading(false);
     }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: currency === 'BS' ? 'VES' : currency,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeLabel = (type: string) => {
    return type === 'INVOICE' ? 'Factura de Venta' : 'Factura de Compra';
  };

  const getStatusBadge = (status: string, type: string) => {
    let label = status;
    let color = 'bg-gray-100 text-gray-800';

    if (status === 'POSTED') {
       if (type === 'INVOICE') { label = 'POR COBRAR'; color = 'bg-blue-100 text-blue-800'; }
       else { label = 'POR PAGAR'; color = 'bg-orange-100 text-orange-800'; }
    } else if (status === 'PAID') {
       label = 'PAGADA';
       color = 'bg-green-100 text-green-800';
    } else if (status === 'DRAFT' || status === 'OPEN') {
       label = 'BORRADOR';
       color = 'bg-gray-100 text-gray-800';
    } else if (status === 'CANCELLED') {
       label = 'ANULADA';
       color = 'bg-red-100 text-red-800';
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${color}`}>
        {label}
      </span>
    );
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (!invoice) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
      <FileText className="w-16 h-16 mb-4 text-gray-300" />
      <h2 className="text-xl font-medium mb-2">Factura no encontrada</h2>
      <button onClick={() => router.back()} className="text-blue-600 hover:underline">Volver al listado</button>
    </div>
  );

  const contact = invoice.contact;
  const contactName = contact?.name || invoice.clientName || invoice.vendorName || 'Sin Contacto';

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0">
      
      {/* Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:bg-white px-3 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="hidden md:inline">Volver</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm">
             {/* Toggle Document View Modes */}
             {invoice.type === 'INVOICE' && (
                <div className="flex border-r border-gray-200 pr-2 mr-2 gap-1">
                   <button 
                      onClick={() => setViewMode('INVOICE')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${viewMode === 'INVOICE' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                   >
                      Factura
                   </button>
                   <button 
                      onClick={() => setViewMode('DELIVERY_NOTE')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${viewMode === 'DELIVERY_NOTE' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                   >
                      Nota de Entrega
                   </button>
                </div>
             )}

             {/* Delivery Note Pricing Options */}
             {viewMode === 'DELIVERY_NOTE' && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 border-r border-gray-200 pr-3 mr-2 cursor-pointer select-none">
                   <input 
                      type="checkbox" 
                      checked={showPricesInDeliveryNote}
                      onChange={(e) => setShowPricesInDeliveryNote(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                   />
                   <span>Mostrar montos</span>
                </label>
             )}

             {/* Invoice IVA Option */}
             {viewMode === 'INVOICE' && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 border-r border-gray-200 pr-3 mr-2 cursor-pointer select-none">
                   <input 
                      type="checkbox" 
                      checked={calculateIVA}
                      onChange={(e) => setCalculateIVA(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                   />
                   <span>Calcular IVA (16%)</span>
                </label>
             )}

             {/* Currency Toggle & Rate Selector */}
             <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-2">
                <div className="flex gap-1">
                   <button 
                      onClick={() => setDisplayCurrency(invoice.currency)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${displayCurrency === invoice.currency ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                   >
                      {invoice.currency === 'VES' ? 'BS' : invoice.currency}
                   </button>
                   <button 
                      onClick={() => setDisplayCurrency(invoice.currency === 'USD' ? 'BS' : 'USD')}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition ${displayCurrency !== invoice.currency ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                   >
                      {invoice.currency === 'USD' ? 'BS' : 'USD'}
                   </button>
                </div>
                
                {displayCurrency !== invoice.currency && (
                   <div className="flex items-center gap-1.5 pl-2 ml-2 border-l border-gray-150">
                      <select
                         value={rateSource}
                         onChange={(e: any) => setRateSource(e.target.value)}
                         className="text-xs border border-gray-200 rounded px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
                      >
                         <option value="BCV">BCV USD ({rates?.BCV?.usdToBs || '...' })</option>
                         <option value="BCV_EUR">BCV EUR ({rates?.BCV?.eurToBs || '...' })</option>
                         <option value="BINANCE">Paralelo ({rates?.BINANCE?.usdToBs || '...' })</option>
                         <option value="CUSTOM">Personalizada ({rates?.CUSTOM?.usdToBs || '...' })</option>
                         <option value="MANUAL">Manual</option>
                      </select>
                      {rateSource === 'MANUAL' && (
                         <input
                            type="number"
                            step="0.01"
                            value={manualRate}
                            onChange={(e) => setManualRate(e.target.value)}
                            placeholder="Tasa"
                            className="w-16 text-xs border border-gray-350 rounded px-1.5 py-1 text-center font-mono outline-none focus:ring-1 focus:ring-blue-500"
                         />
                      )}
                   </div>
                )}
             </div>

             {/* Duplicate Button */}
             <button 
                onClick={handleDuplicate}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 rounded text-gray-700 text-xs font-medium transition border border-gray-100"
             >
                <Copy size={13} /> Duplicar
             </button>

             {/* Edit Button if open or draft */}
             {(invoice.status === 'OPEN' || invoice.status === 'DRAFT') && (
                <button 
                   onClick={() => router.push(`/invoices/${invoice.id}/edit`)}
                   className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 rounded text-gray-700 text-xs font-medium transition border border-gray-100"
                >
                   <Edit size={13} /> Editar
                </button>
             )}


              {/* Publish Button if open or draft */}
              {(invoice.status === 'OPEN' || invoice.status === 'DRAFT') && (
                 <button 
                    onClick={handlePost}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition shadow-sm"
                 >
                    <Play size={13} /> Publicar (Postear)
                 </button>
              )}

             {/* Pay/Collect Button if pending */}
             {invoice.status === 'POSTED' && (
                <button 
                   onClick={() => router.push(`/invoices/${invoice.id}/pay`)}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition shadow-sm"
                >
                   <CreditCard size={13} /> 
                   {invoice.type === 'INVOICE' ? 'Registrar Cobro' : 'Registrar Pago'}
                </button>
             )}

             {/* Print Button */}
             <button 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 rounded text-gray-700 text-xs font-medium transition border border-gray-100"
             >
                <Printer size={13} /> Imprimir
             </button>
        </div>
      </div>

      {/* Invoice Paper */}
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-full print:my-0">
          
          {/* Header */}
          <div className="p-8 md:p-12 border-b border-gray-100 print:p-4">
              <div className="flex justify-between items-start mb-10">
                  <div>
                      {invoice.project?.logoUrl ? (
                          <div className="mb-4">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                  src={`/backend-api${invoice.project.logoUrl}`} 
                                  alt={invoice.project.name} 
                                  className="max-h-16 max-w-[200px] object-contain"
                                  onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                  }}
                              />
                          </div>
                      ) : null}
                      {invoice.project?.description ? (
                          <div className="text-sm text-gray-600 mb-2 whitespace-pre-wrap leading-relaxed max-w-md">
                              {invoice.project.description}
                          </div>
                      ) : (
                          invoice.project?.name && (
                              <h1 className="text-xl font-bold text-gray-800 mb-1">{invoice.project.name}</h1>
                          )
                      )}
                      <div className="text-sm text-gray-500 space-y-1">
                          <p>Fecha de Emisión: {formatDate(invoice.issueDate)}</p>
                          <p>Fecha de Vencimiento: {formatDate(invoice.dueDate)}</p>
                          {displayCurrency !== invoice.currency && (
                              <p className="text-xs text-blue-600 font-semibold mt-1">
                                  Tasa Ref: {getActiveRate().toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {rateSource === 'BCV_EUR' ? 'BS/EUR' : 'BS/USD'}
                              </p>
                          )}
                      </div>
                  </div>
                  <div className="text-right">
                      <h2 className="text-3xl font-light text-gray-800 mb-2">
                         {viewMode === 'DELIVERY_NOTE' ? 'Nota de Entrega' : getTypeLabel(invoice.type)}
                      </h2>
                      <p className="font-mono text-lg font-medium text-gray-600 mb-2">#{invoice.code}</p>
                      {getStatusBadge(invoice.status, invoice.type)}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                  <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                         {invoice.type === 'INVOICE' ? 'Cliente' : 'Proveedor'}
                      </h3>
                      <div className="text-gray-800">
                          <p className="font-bold text-lg mb-1">{contactName}</p>
                          {contact?.taxId && <p className="text-sm text-gray-600">RIF/NIT: {contact.taxId}</p>}
                          {contact?.phone && <p className="text-sm text-gray-600">Teléfono: {contact.phone}</p>}
                          {contact?.email && <p className="text-sm text-gray-600">Email: {contact.email}</p>}
                          {contact?.address && <p className="text-sm text-gray-600 mt-1 max-w-xs">Dirección: {contact.address}</p>}
                      </div>
                  </div>
                  {/* Details */}
                  <div className="md:text-right">
                      {invoice.description && (
                          <div className="bg-gray-50 p-4 rounded-lg inline-block text-left md:min-w-[200px]">
                              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Concepto</h3>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap">{invoice.description}</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Items Table */}
          <div className="p-8 md:p-12 print:px-4 print:py-2">
              <table className="w-full text-left">
                  <thead>
                      <tr className="border-b border-gray-200">
                          <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-1/2">Descripción</th>
                          <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Cant.</th>
                          {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                             <>
                                <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Precio</th>
                                <th className="py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Total</th>
                             </>
                          )}
                      </tr>
                  </thead>
                  <tbody>
                      {invoice.items && invoice.items.length > 0 ? (
                          invoice.items.map((item) => (
                              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                  <td className="py-4 text-sm text-gray-800">
                                      <p className="font-medium">{item.description || item.name || 'Ítem sin nombre'}</p>
                                  </td>
                                  <td className="py-4 text-sm text-gray-600 text-right">
                                      <div>{item.quantity}</div>
                                      {(() => {
                                         const prod = products.find(p => p.id === item.productId);
                                         if (prod && prod.empaqueCantidad && prod.empaqueCantidad > 1) {
                                            const bultos = item.quantity / prod.empaqueCantidad;
                                            const bultosStr = Number(bultos.toFixed(2)).toLocaleString('es-VE');
                                            const unit = (prod.unidad_empaque || 'bulto').trim();
                                            const finalUnit = bultos === 1 ? unit : (unit.endsWith('s') ? unit : `${unit}s`);
                                            return (
                                               <div className="text-[10px] text-gray-400 mt-0.5 font-normal">
                                                  ({bultosStr} {finalUnit})
                                               </div>
                                            );
                                         }
                                         return null;
                                      })()}
                                  </td>
                                  {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                                     <>
                                        <td className="py-4 text-sm text-gray-600 text-right font-mono">
                                            {formatCurrency((typeof item.unitPrice === 'number' && !isNaN(item.unitPrice) ? item.unitPrice : (typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0)) * conversionFactor, displayCurrency)}
                                        </td>
                                        <td className="py-4 text-sm text-gray-800 text-right font-medium font-mono">
                                            {formatCurrency(item.total * conversionFactor, displayCurrency)}
                                        </td>
                                     </>
                                  )}
                              </tr>
                          ))
                      ) : (
                          <tr>
                             <td className="py-4 text-sm text-gray-800" colSpan={viewMode === 'DELIVERY_NOTE' && !showPricesInDeliveryNote ? 2 : 3}>
                                 <p className="font-medium">{invoice.description || 'Servicios Profesionales'}</p>
                             </td>
                             {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                                <td className="py-4 text-sm text-gray-800 text-right font-medium font-mono">
                                    {formatCurrency(totals.subtotal * conversionFactor, displayCurrency)}
                                </td>
                             )}
                          </tr>
                      )}
                  </tbody>
              </table>

              {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                 <div className="mt-8 flex justify-end">
                     <div className="w-full md:w-1/3 space-y-3">
                         <div className="flex justify-between text-sm text-gray-600">
                             <span>Subtotal</span>
                             <span className="font-mono">{formatCurrency(totals.subtotal * conversionFactor, displayCurrency)}</span>
                         </div>
                         {totals.taxAmount > 0 && (
                             <div className="flex justify-between text-sm text-gray-600">
                                 <span>IVA ({invoice.taxAmount > 0 && invoice.total > 0 ? `${Math.round((invoice.taxAmount / (invoice.total - invoice.taxAmount)) * 100)}%` : '16%'})</span>
                                 <span className="font-mono">{formatCurrency(totals.taxAmount * conversionFactor, displayCurrency)}</span>
                             </div>
                         )}
                         <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold text-gray-900">
                             <span>Total</span>
                             <span className="font-mono">{formatCurrency(totals.total * conversionFactor, displayCurrency)}</span>
                         </div>
                         {totals.outstanding < totals.total && totals.outstanding > 0 && (
                             <div className="flex justify-between text-sm font-semibold text-orange-600">
                                 <span>Pendiente</span>
                                 <span className="font-mono">{formatCurrency(totals.outstanding * conversionFactor, displayCurrency)}</span>
                             </div>
                         )}
                     </div>
                 </div>
              )}

              {/* Internal Profitability Details (print:hidden) */}
              {invoice.type === 'INVOICE' && invoice.status === 'PAID' && (invoice.totalCost !== undefined) && (
                 <div className="mt-8 pt-6 border-t border-dashed border-gray-200 print:hidden">
                     <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Información de Rentabilidad (Interno)</h4>
                     <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div>
                             <span className="text-xs text-gray-500 block mb-1">Costo Total del Pedido</span>
                             <span className="font-mono text-gray-800 font-semibold">
                                 {formatCurrency((invoice.totalCost || 0) * conversionFactor, displayCurrency)}
                             </span>
                         </div>
                         <div>
                             <span className="text-xs text-gray-500 block mb-1">Utilidad Neta</span>
                             <span className={`font-mono font-semibold ${(invoice.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                 {formatCurrency((invoice.netProfit || 0) * conversionFactor, displayCurrency)}
                             </span>
                         </div>
                         <div>
                             <span className="text-xs text-gray-500 block mb-1">Margen de Ganancia</span>
                             <span className={`font-semibold ${(invoice.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                 {(() => {
                                     const tax = totals.taxAmount;
                                     const netSales = Math.max(0.01, totals.total - tax);
                                     const margin = ((invoice.netProfit || 0) / netSales) * 100;
                                     return `${margin.toFixed(1)}%`;
                                 })()}
                             </span>
                         </div>
                     </div>
                 </div>
              )}
          </div>
          
          <div className="bg-gray-50 px-8 py-6 border-t border-gray-200 text-center text-xs text-gray-400">
               Documento generado por Sistema FINK
          </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:hidden">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
               <div className="bg-gray-50 px-6 py-4 border-b border-gray-150 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 text-lg">
                     {invoice.type === 'INVOICE' ? 'Registrar Cobro de Venta' : 'Registrar Pago de Compra'}
                  </h3>
                  <button 
                     onClick={() => setIsPaymentModalOpen(false)}
                     className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                  >
                     &times;
                  </button>
               </div>
               
               <form onSubmit={handleRegisterPayment} className="p-6 space-y-4">
                  {paymentError && (
                     <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{paymentError}</span>
                     </div>
                  )}

                  <div>
                     <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Monto a Registrar ({invoice.currency})</label>
                     <input 
                        type="number" 
                        step="0.01" 
                        required
                        max={invoice.outstanding}
                        min="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-mono"
                     />
                     <p className="text-xs text-gray-400 mt-1">Pendiente total: {formatCurrency(invoice.outstanding, invoice.currency)}</p>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cuenta de Banco / Caja</label>
                     <select 
                        required
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-800"
                     >
                        {accounts.length === 0 ? (
                           <option value="">No hay cuentas activas</option>
                        ) : (
                           accounts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                 {acc.code} - {acc.name} ({acc.currency})
                              </option>
                           ))
                        )}
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Método de Pago</label>
                     <select 
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-800"
                     >
                        <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                        <option value="CASH">Efectivo</option>
                        <option value="CARD">Tarjeta de Débito/Crédito</option>
                        <option value="MOBILE_PAYMENT">Pago Móvil</option>
                        <option value="OTHER">Otro</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Referencia / Comprobante</label>
                     <input 
                        type="text" 
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="Ej. Nro. de transferencia o depósito"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
                     />
                  </div>

                  <div className="pt-4 border-t border-gray-150 flex justify-end gap-3">
                     <button 
                        type="button"
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit"
                        disabled={submittingPayment || accounts.length === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                     >
                        {submittingPayment ? (
                           <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Registrando...</span>
                           </>
                        ) : (
                           <>
                              <CheckCircle size={15} />
                              <span>Confirmar</span>
                           </>
                        )}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}
