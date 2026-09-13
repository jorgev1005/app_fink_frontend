'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Printer, ArrowLeft, Download, Edit, CreditCard, CheckCircle, FileText, Copy, Play, MessageCircle, Trash2, Undo2, AlertTriangle } from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  name?: string; // Fallback for legacy name field
  quantity: number;
  unitPrice: number;
  price?: number; // Fallback for legacy price field
  total: number;
  productId?: string;
  notes?: string;
}

interface PaymentAllocationData {
  id: string;
  paymentId: string;
  allocatedAmount: number;
  createdAt: string;
  payment?: {
    id: string;
    code: string;
    date: string;
    currency: string;
    amount: number;
    exchangeRate?: number;
    method: string;
    reference?: string;
    status: string;
    account?: {
      id: string;
      name: string;
      code: string;
      currency: string;
    };
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
    transaction?: {
      id: string;
      code: string;
      description?: string;
    };
  };
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
    defaultTaxRate?: number;
    lastInvoiceNumber?: string;
    lastDeliveryNoteNumber?: string;
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
  payments?: PaymentAllocationData[];
  totalCost?: number;
  netProfit?: number;
  purchaseOrder?: string;
  purchaseOrderDate?: string;
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
  const [printLayout, setPrintLayout] = useState<'STANDARD' | 'FREE_FORM'>('STANDARD');
  
  // Payment Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
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
      // Calculate IVA dynamically based on project settings or fallback to 16%
      const defaultIvaRate = (invoice.project?.defaultTaxRate !== undefined)
        ? (invoice.project.defaultTaxRate / 100)
        : 0.16; 
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

      // Auto-default to DELIVERY_NOTE mode if invoice code starts with 'NE'
      if (invData.code?.toUpperCase().startsWith('NE')) {
        setViewMode('DELIVERY_NOTE');
      }

      // Auto-open payment modal if requested in URL
      if (typeof window !== 'undefined' && window.location.search.includes('openPayment=true')) {
        setTimeout(() => {
          openPaymentModal(invData);
        }, 350);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = async (targetInv?: any) => {
     const inv = targetInv || invoice;
     if (!inv) return;
     setIsPaymentModalOpen(true);
     setPaymentError(null);
     setPaymentAmount(String(inv.outstanding || 0));
     try {
        const res = await api.accounts.getAll({ projectId: inv.projectId });
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
           date: paymentDate ? new Date(`${paymentDate}T12:00:00`) : new Date(),
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

  const [revertingPaymentId, setRevertingPaymentId] = useState<string | null>(null);

  const handleRevertPayment = async (paymentId: string, paymentCode: string) => {
     if (!confirm(`¿Estás seguro de que deseas revertir y eliminar el pago ${paymentCode}? Esta acción devolverá el dinero en el saldo bancario/caja y restaurará el saldo pendiente de este documento.`)) {
        return;
     }
     try {
        setRevertingPaymentId(paymentId);
        await (api.payments as any).delete(paymentId);
        alert(`El pago ${paymentCode} ha sido revertido y eliminado exitosamente.`);
        await loadInvoice();
     } catch (err: any) {
        console.error(err);
        alert(err.response?.data?.error?.message || err.message || 'Error al revertir el pago');
     } finally {
        setRevertingPaymentId(null);
     }
  };

  const handleDeleteInvoice = async () => {
     if (!invoice) return;
     const docType = getTypeLabel(invoice.type);
     if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente esta ${docType} (${invoice.code})? Esta acción revertirá cualquier efecto contable y devolverá la mercancía al inventario.`)) {
        return;
     }
     try {
        setLoading(true);
        await api.invoices.delete(invoice.id);
        alert(`${docType} eliminada correctamente.`);
        router.push('/invoices');
     } catch (err: any) {
        console.error(err);
        alert(err.response?.data?.error?.message || err.message || 'Error al eliminar el documento');
        setLoading(false);
     }
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const formatPaymentMethod = (method?: string | null) => {
    switch (method) {
      case 'BANK_TRANSFER': return 'Transferencia';
      case 'MOBILE_PAYMENT': return 'Pago Móvil';
      case 'CASH': return 'Efectivo';
      case 'CARD': return 'Tarjeta';
      case 'CHEQUE': return 'Cheque';
      case 'ZELLE': return 'Zelle';
      case 'OTHER': return 'Otro';
      default: return method || 'Otro';
    }
  };

  const getPaymentAmountInInvoiceCurrency = (alloc: PaymentAllocationData) => {
    const p = alloc.payment;
    if (!p) return alloc.allocatedAmount;
    const pCurr = p.currency === 'VES' ? 'BS' : p.currency;
    const invCurr = invoice?.currency === 'VES' ? 'BS' : (invoice?.currency || 'USD');
    
    if (pCurr === invCurr) {
      return p.amount || alloc.allocatedAmount;
    }
    
    const rate = p.exchangeRate || 1;
    if (pCurr === 'BS' && invCurr === 'USD') {
      return rate > 0 ? (p.amount || alloc.allocatedAmount) / rate : alloc.allocatedAmount;
    }
    if (pCurr === 'USD' && invCurr === 'BS') {
      return (p.amount || alloc.allocatedAmount) * rate;
    }
    return alloc.allocatedAmount;
  };

  const shareViaWhatsApp = () => {
    if (!invoice) return;
    const isDelivery = viewMode === 'DELIVERY_NOTE' || invoice.code?.toUpperCase().startsWith('NE');
    const isOrderComp = invoice.code?.toUpperCase().startsWith('OC-');
    const isSale = invoice.type === 'INVOICE' && !isOrderComp;
    const header = isDelivery ? 'NOTA DE ENTREGA' : (isOrderComp ? 'ORDEN DE COMPRA A PROVEEDOR' : (isSale ? 'FACTURA DE VENTA' : 'FACTURA DE COMPRA'));
    const partyLabel = isSale ? 'Cliente' : 'Proveedor';
    const partyName = contactName || 'Sin nombre';
    const totalStr = formatCurrency(totals.total * conversionFactor, displayCurrency);
    const outstandingStr = formatCurrency(totals.outstanding * conversionFactor, displayCurrency);
    
    // Calculate total paid
    const totalPaid = Math.max(0, totals.total - totals.outstanding);
    const totalPaidStr = formatCurrency(totalPaid * conversionFactor, displayCurrency);

    let msg = `*${invoice.project?.name || 'FINK'}*\n`;
    msg += `*${header}:* #${invoice.code}\n`;
    msg += `*${partyLabel}:* ${partyName}\n`;
    if (contact?.taxId) msg += `*RIF/NIT:* ${contact.taxId}\n`;
    msg += `*Fecha de Emisión:* ${formatDate(invoice.issueDate)}\n`;
    if (invoice.dueDate) msg += `*Vencimiento:* ${formatDate(invoice.dueDate)}\n`;
    msg += `\n*RESUMEN DE ITEMS:*\n`;

    (invoice.items || []).forEach((item) => {
      if (isDelivery && !showPricesInDeliveryNote) {
        msg += `• ${item.quantity}x ${item.description || item.name}\n`;
      } else {
        const itemTotal = formatCurrency(item.total * conversionFactor, displayCurrency);
        msg += `• ${item.quantity}x ${item.description || item.name} - ${itemTotal}\n`;
      }
    });

    if (!isDelivery || showPricesInDeliveryNote) {
      msg += `\n*Total:* ${totalStr}\n`;
      if (totalPaid > 0) {
        msg += `*Total Abonado:* ${totalPaidStr}\n`;
      }
      msg += `*Saldo Pendiente:* ${outstandingStr}\n`;

      // Include payment breakdown if any
      if (invoice.payments && invoice.payments.length > 0) {
        msg += `\n*HISTORIAL DE ABONOS:*\n`;
        invoice.payments.forEach((p, i) => {
          const pDate = formatDate(p.payment?.date || p.createdAt);
          const pAmount = formatCurrency(getPaymentAmountInInvoiceCurrency(p) * conversionFactor, displayCurrency);
          const pMethod = formatPaymentMethod(p.payment?.method);
          const pRef = p.payment?.reference ? ` (Ref: ${p.payment.reference})` : '';
          const pOrig = p.payment?.currency && p.payment.currency !== invoice.currency ? ` [Orig: ${formatCurrency(p.payment.amount, p.payment.currency)}]` : '';
          msg += `${i + 1}. ${pDate} - ${pAmount}${pOrig} via ${pMethod}${pRef}\n`;
        });
      }
    }

    const phone = contact?.phone ? contact.phone.replace(/[^0-9]/g, '') : '';
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      setDownloadingPdf(true);

      // Si es una Orden de Compra (OC), descargar directamente el PDF vectorial ultra ligero del backend (~4 KB)
      const isPurchaseOrder = invoice.code?.toUpperCase().startsWith('OC-') || invoice.type === 'BILL';
      if (isPurchaseOrder) {
        window.open(`/backend-api/api/invoices/${invoice.id}/pdf`, '_blank');
        return;
      }

      const element = document.getElementById('invoice-paper-printable');
      if (!element) {
        window.print();
        return;
      }

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 1.8,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (el) => {
          return el.hasAttribute('data-html2canvas-ignore') || el.classList.contains('print:hidden');
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const isDelivery = viewMode === 'DELIVERY_NOTE';
      const docPrefix = isDelivery ? 'Nota_Entrega' : (isPurchaseOrder ? 'Orden_Compra' : (invoice.type === 'INVOICE' ? 'Factura' : 'Factura_Compra'));
      const filename = `${docPrefix}_${invoice.code}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generando PDF:', error);
      window.print();
    } finally {
      setDownloadingPdf(false);
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
    if (invoice?.code?.toUpperCase().startsWith('OC-')) {
      return 'Orden de Compra a Proveedor';
    }
    if (invoice?.code?.toUpperCase().startsWith('NE-') || invoice?.code?.toUpperCase().startsWith('NE')) {
      return 'Nota de Entrega';
    }
    return type === 'INVOICE' ? 'Factura de Venta' : 'Factura de Compra / Gasto';
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
    } else if (status === 'PARTIALLY_PAID') {
       label = 'ABONADA / PARCIAL';
       color = 'bg-amber-100 text-amber-800 border border-amber-300';
    } else if (status === 'DRAFT') {
       label = 'BORRADOR';
       color = 'bg-gray-100 text-gray-800';
    } else if (status === 'OPEN') {
       label = type === 'INVOICE' ? 'POR COBRAR' : 'POR PAGAR';
       color = type === 'INVOICE' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800';
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
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            margin: 0 !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-wrapper {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            ${printLayout === 'FREE_FORM' 
              ? `
                padding-left: 0.5cm !important;
                padding-right: 0.5cm !important;
                padding-top: 4.5cm !important;
                padding-bottom: 4.0cm !important;
                `
              : `
                padding-left: 1.5cm !important;
                padding-right: 1.5cm !important;
                padding-top: 1.5cm !important;
                padding-bottom: 1.5cm !important;
                `
            }
          }
        }
      `}} />
      
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
                <>
                   <label className="flex items-center gap-1.5 text-xs text-gray-600 border-r border-gray-200 pr-3 mr-2 cursor-pointer select-none">
                      <input 
                         type="checkbox" 
                         checked={calculateIVA}
                         onChange={(e) => setCalculateIVA(e.target.checked)}
                         className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>Calcular IVA (16%)</span>
                   </label>
                   <label className="flex items-center gap-1.5 text-xs text-gray-600 border-r border-gray-200 pr-3 mr-2 cursor-pointer select-none">
                      <input 
                         type="checkbox" 
                         checked={printLayout === 'FREE_FORM'}
                         onChange={(e) => setPrintLayout(e.target.checked ? 'FREE_FORM' : 'STANDARD')}
                         className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span className="font-semibold text-blue-600">Forma Libre</span>
                   </label>
                </>
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
                            pla