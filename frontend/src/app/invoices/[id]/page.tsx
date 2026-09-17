'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Printer, ArrowLeft, Download, Edit, CreditCard, CheckCircle, FileText, Copy, Play, MessageCircle, Trash2, Undo2, AlertTriangle, Truck, Receipt, ExternalLink, Clock, RotateCcw } from 'lucide-react';

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
  notes?: string;
  dispatchStatus?: 'PENDING_DISPATCH' | 'DISPATCHED' | 'DELIVERED';
  dispatchedAt?: string;
  deliveredAt?: string;
  dispatchNotes?: string;
  invoicedAsId?: string;
  invoicedAsCode?: string;
  invoicedAt?: string;
  sourceDeliveryNoteId?: string;
  sourceDeliveryNoteCode?: string;
  convertedToBillId?: string;
  convertedToBillCode?: string;
  sourcePurchaseOrderId?: string;
  sourcePurchaseOrderCode?: string;
  returns?: any[];
  hasReturns?: boolean;
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

  // Issue Invoice from Delivery Note Modal States
  const [isIssueInvoiceModalOpen, setIsIssueInvoiceModalOpen] = useState(false);
  const [suggestedInvoiceCode, setSuggestedInvoiceCode] = useState('');
  const [issueInvoiceDueDate, setIssueInvoiceDueDate] = useState('');
  const [issueInvoiceNotes, setIssueInvoiceNotes] = useState('');
  const [submittingIssueInvoice, setSubmittingIssueInvoice] = useState(false);
  const [issueInvoiceError, setIssueInvoiceError] = useState<string | null>(null);

  // Convert Purchase Order to Bill Modal States
  const [isConvertPoModalOpen, setIsConvertPoModalOpen] = useState(false);
  const [supplierInvoiceCode, setSupplierInvoiceCode] = useState('');
  const [convertPoIssueDate, setConvertPoIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [convertPoDueDate, setConvertPoDueDate] = useState('');
  const [convertPoNotes, setConvertPoNotes] = useState('');
  const [submittingConvertPo, setSubmittingConvertPo] = useState(false);
  const [convertPoError, setConvertPoError] = useState<string | null>(null);

  // Dispatch Status State
  const [updatingDispatch, setUpdatingDispatch] = useState(false);

  // Return / Reverse Modal States
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('Mercancía defectuosa / Dañada');
  const [customReturnReason, setCustomReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnItemsState, setReturnItemsState] = useState<Array<{
    productId?: string;
    name: string;
    originalQty: number;
    alreadyReturned: number;
    remainingQty: number;
    returnQty: number;
    unitPrice: number;
    stockAction: 'RESTOCK' | 'QUARANTINE' | 'NONE';
  }>>([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

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
      
      // Parse items and metadata from lines if they are stored as JSON string in lines field
      let parsedItems = [];
      let taxAmount = 0;
      let extraLinesData: any = {};
      if (invData.lines) {
         try {
            const parsedLines = typeof invData.lines === 'string' ? JSON.parse(invData.lines) : invData.lines;
            if (Array.isArray(parsedLines)) {
               parsedItems = parsedLines;
            } else if (parsedLines && typeof parsedLines === 'object') {
               if (Array.isArray(parsedLines.items)) {
                  parsedItems = parsedLines.items;
               }
               taxAmount = Number(parsedLines.taxAmount) || 0;
               extraLinesData = parsedLines;
            }
         } catch(e) {
            console.error('Error parsing lines in detail view', e);
         }
      }
      
      setInvoice({
         ...invData,
         items: parsedItems,
         taxAmount,
         dispatchStatus: invData.dispatchStatus || extraLinesData.dispatchStatus || (invData.code?.toUpperCase().startsWith('NE') ? 'PENDING_DISPATCH' : undefined),
         dispatchedAt: invData.dispatchedAt || extraLinesData.dispatchedAt || null,
         deliveredAt: invData.deliveredAt || extraLinesData.deliveredAt || null,
         dispatchNotes: invData.dispatchNotes || extraLinesData.dispatchNotes || null,
         invoicedAsId: invData.invoicedAsId || extraLinesData.invoicedAsId || extraLinesData.convertedToBillId || null,
         invoicedAsCode: invData.invoicedAsCode || extraLinesData.invoicedAsCode || extraLinesData.convertedToBillCode || null,
         invoicedAt: invData.invoicedAt || extraLinesData.invoicedAt || null,
         sourceDeliveryNoteId: invData.sourceDeliveryNoteId || extraLinesData.sourceDeliveryNoteId || null,
         sourceDeliveryNoteCode: invData.sourceDeliveryNoteCode || extraLinesData.sourceDeliveryNoteCode || null,
         convertedToBillId: invData.convertedToBillId || extraLinesData.convertedToBillId || null,
         convertedToBillCode: invData.convertedToBillCode || extraLinesData.convertedToBillCode || null,
         sourcePurchaseOrderId: invData.sourcePurchaseOrderId || extraLinesData.sourcePurchaseOrderId || null,
         sourcePurchaseOrderCode: invData.sourcePurchaseOrderCode || extraLinesData.sourcePurchaseOrderCode || null,
         returns: invData.returns || extraLinesData.returns || [],
         hasReturns: Boolean((invData.returns && invData.returns.length > 0) || (extraLinesData.returns && extraLinesData.returns.length > 0))
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

  const openIssueInvoiceModal = async () => {
     if (!invoice) return;
     setIsIssueInvoiceModalOpen(true);
     setIssueInvoiceError(null);
     setIssueInvoiceNotes('');
     // Default due date: if delivery note has dueDate, use it; otherwise 15 days from today
     if (invoice.dueDate) {
       setIssueInvoiceDueDate(invoice.dueDate.split('T')[0]);
     } else {
       const d = new Date();
       d.setDate(d.getDate() + 15);
       setIssueInvoiceDueDate(d.toISOString().split('T')[0]);
     }
     try {
       const res = await api.invoices.getNextCode({ projectId: invoice.projectId, isDeliveryNote: false });
       if (res.data?.data?.nextCode) {
         setSuggestedInvoiceCode(res.data.data.nextCode);
       }
     } catch (e) {
       console.error('Error getting next invoice code:', e);
     }
  };

  const handleConfirmIssueInvoice = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!invoice || !suggestedInvoiceCode) return;
     try {
       setSubmittingIssueInvoice(true);
       setIssueInvoiceError(null);
       const res = await (api.invoices as any).issueInvoice(invoice.id, {
         customCode: suggestedInvoiceCode,
         dueDate: issueInvoiceDueDate || undefined,
         notes: issueInvoiceNotes || undefined
       });
       setIsIssueInvoiceModalOpen(false);
       const newInvoice = res.data?.data;
       if (newInvoice?.id) {
         router.push(`/invoices/${newInvoice.id}`);
       } else {
         await loadInvoice();
       }
     } catch (err: any) {
       console.error(err);
       setIssueInvoiceError(err.response?.data?.error?.message || err.message || 'Error emitiendo factura');
     } finally {
       setSubmittingIssueInvoice(false);
     }
  };

  const openConvertPoModal = () => {
     if (!invoice) return;
     setIsConvertPoModalOpen(true);
     setConvertPoError(null);
     setSupplierInvoiceCode('');
     setConvertPoIssueDate(new Date().toISOString().split('T')[0]);
     // Default due date: if OC has dueDate, use it; otherwise 15 days from today
     if (invoice.dueDate) {
       setConvertPoDueDate(invoice.dueDate.split('T')[0]);
     } else {
       const d = new Date();
       d.setDate(d.getDate() + 15);
       setConvertPoDueDate(d.toISOString().split('T')[0]);
     }
     setConvertPoNotes('');
  };

  const setConvertPoCreditDays = (days: number) => {
     const base = convertPoIssueDate ? new Date(convertPoIssueDate + 'T12:00:00') : new Date();
     base.setDate(base.getDate() + days);
     setConvertPoDueDate(base.toISOString().split('T')[0]);
  };

  const getConvertPoCreditDaysDiff = (): number | null => {
     if (!convertPoIssueDate || !convertPoDueDate) return null;
     const d1 = new Date(convertPoIssueDate + 'T12:00:00').getTime();
     const d2 = new Date(convertPoDueDate + 'T12:00:00').getTime();
     return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  };

  const handleConfirmConvertPo = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!invoice || !supplierInvoiceCode.trim()) {
       setConvertPoError('Por favor ingresa el número de factura o control entregado por el proveedor');
       return;
     }
     try {
       setSubmittingConvertPo(true);
       setConvertPoError(null);
       const res = await (api.invoices as any).convertPoToBill(invoice.id, {
         supplierInvoiceCode: supplierInvoiceCode.trim(),
         issueDate: convertPoIssueDate || undefined,
         dueDate: convertPoDueDate || undefined,
         notes: convertPoNotes || undefined
       });
       setIsConvertPoModalOpen(false);
       const newBill = res.data?.data;
       if (newBill?.id) {
         router.push(`/invoices/${newBill.id}`);
       } else {
         await loadInvoice();
       }
     } catch (err: any) {
       console.error(err);
       setConvertPoError(err.response?.data?.error?.message || err.message || 'Error al convertir la orden de compra');
     } finally {
       setSubmittingConvertPo(false);
     }
  };

   const openReturnModal = () => {
      if (!invoice) return;
      const prevReturns = invoice.returns || [];
      const returnedQtyByItem: Record<string, number> = {};
      prevReturns.forEach((ret: any) => {
        if (Array.isArray(ret.items)) {
          ret.items.forEach((it: any) => {
            const key = it.productId || it.name;
            returnedQtyByItem[key] = (returnedQtyByItem[key] || 0) + Number(it.quantity || 0);
          });
        }
      });

      const initialItems = (invoice.items || []).map(it => {
        const key = it.productId || it.description || it.name || 'Producto';
        const origQty = Number(it.quantity || 1);
        const alreadyReturned = returnedQtyByItem[key] || 0;
        const remaining = Math.max(0, origQty - alreadyReturned);

        return {
          productId: it.productId,
          name: it.description || it.name || 'Producto',
          originalQty: origQty,
          alreadyReturned,
          remainingQty: remaining,
          returnQty: 0,
          unitPrice: Number(it.unitPrice || it.price || 0),
          stockAction: (invoice.type === 'INVOICE' ? 'RESTOCK' : 'NONE') as 'RESTOCK' | 'QUARANTINE' | 'NONE'
        };
      });

      setReturnItemsState(initialItems);
      setReturnReason('Mercancía defectuosa / Dañada');
      setCustomReturnReason('');
      setReturnNotes('');
      setReturnError(null);
      setIsReturnModalOpen(true);
   };

   const handleReturnAll = () => {
      setReturnItemsState(prev => prev.map(it => ({
        ...it,
        returnQty: it.remainingQty
      })));
   };

   const handleClearReturn = () => {
      setReturnItemsState(prev => prev.map(it => ({
        ...it,
        returnQty: 0
      })));
   };

   const handleReturnQtyChange = (index: number, val: number) => {
      setReturnItemsState(prev => {
        const next = [...prev];
        const item = next[index];
        const sanitizedVal = Math.max(0, Math.min(item.remainingQty, val));
        next[index] = { ...item, returnQty: sanitizedVal };
        return next;
      });
   };

   const handleReturnActionChange = (index: number, action: 'RESTOCK' | 'QUARANTINE' | 'NONE') => {
      setReturnItemsState(prev => {
        const next = [...prev];
        next[index] = { ...next[index], stockAction: action };
        return next;
      });
   };

   const handleConfirmReturn = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!invoice) return;

      const itemsToReturn = returnItemsState.filter(it => it.returnQty > 0);
      if (itemsToReturn.length === 0) {
        setReturnError('Debes ingresar al menos una cantidad mayor a cero en los productos a devolver.');
        return;
      }

      const finalReason = returnReason === 'OTRO' ? customReturnReason : returnReason;
      if (!finalReason) {
        setReturnError('Por favor especifica el motivo de la devolución.');
        return;
      }

      try {
        setSubmittingReturn(true);
        setReturnError(null);

        await (api.invoices as any).createReturn(invoice.id, {
          items: itemsToReturn.map(it => ({
            productId: it.productId,
            name: it.name,
            quantity: it.returnQty,
            unitPrice: it.unitPrice,
            stockAction: it.stockAction,
            reason: finalReason
          })),
          reason: finalReason,
          notes: returnNotes || undefined,
          returnDate: new Date().toISOString()
        });

        alert('Devolución registrada exitosamente. El inventario y saldos han sido actualizados.');
        setIsReturnModalOpen(false);
        await loadInvoice();
      } catch (err: any) {
        console.error(err);
        setReturnError(err.response?.data?.error?.message || err.message || 'Error registrando la devolución');
      } finally {
        setSubmittingReturn(false);
      }
   };

  const handleUpdateDispatchStatus = async (newStatus: 'PENDING_DISPATCH' | 'DISPATCHED' | 'DELIVERED') => {
     if (!invoice || updatingDispatch) return;
     try {
       setUpdatingDispatch(true);
       await (api.invoices as any).updateDispatchStatus(invoice.id, { status: newStatus });
       await loadInvoice();
     } catch (err: any) {
       console.error('Error updating dispatch status:', err);
       alert(err.response?.data?.error?.message || 'Error actualizando estado de despacho');
     } finally {
       setUpdatingDispatch(false);
     }
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

      // Si es una Nota de Entrega (NE- o vista modo Nota de Entrega), descargar PDF vectorial corporativo (~5 KB)
      const isDelivery = viewMode === 'DELIVERY_NOTE' || invoice.code?.toUpperCase().startsWith('NE');
      if (isDelivery) {
        const curParam = displayCurrency === 'VES' ? 'BS' : (displayCurrency || 'USD');
        const rateParam = getActiveRate();
        const url = `/backend-api/api/invoices/${invoice.id}/pdf?viewMode=DELIVERY_NOTE&showPrices=${showPricesInDeliveryNote ? 'true' : 'false'}&currency=${curParam}&rate=${rateParam}`;
        window.open(url, '_blank');
        return;
      }

      // Para Facturas de Venta (INVOICE), se preserva intacto el formato de Forma Libre actual

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

      const docPrefix = invoice.type === 'INVOICE' ? 'Factura' : 'Factura_Compra';
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
                            placeholder="Tasa"
                            className="w-16 text-xs border border-gray-350 rounded px-1.5 py-1 text-center font-mono outline-none focus:ring-1 focus:ring-blue-500"
                         />
                      )}
                   </div>
                )}
             </div>

             {/* Facturar Nota de Entrega Button */}
             {(invoice.code?.toUpperCase().startsWith('NE') || viewMode === 'DELIVERY_NOTE') && (
               !invoice.invoicedAsId ? (
                 <button 
                    onClick={openIssueInvoiceModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded text-xs font-semibold transition shadow-sm cursor-pointer"
                    title="Emitir factura fiscal oficial e independiente a partir de esta nota de entrega"
                 >
                    <Receipt size={13} /> Facturar Nota
                 </button>
               ) : (
                 <button 
                    onClick={() => router.push(`/invoices/${invoice.invoicedAsId}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-semibold transition cursor-pointer"
                    title={`Ver factura fiscal oficial #${invoice.invoicedAsCode}`}
                 >
                    <Receipt size={13} /> Factura #{invoice.invoicedAsCode}
                 </button>
               )
             )}

             {/* Convertir Orden de Compra en Factura de Proveedor Button */}
             {invoice.code?.toUpperCase().startsWith('OC-') && (
               !(invoice.convertedToBillId || invoice.invoicedAsId) ? (
                 <button 
                    onClick={openConvertPoModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded text-xs font-semibold transition shadow-sm cursor-pointer"
                    title="Convertir esta orden de compra en la factura formal de compra del proveedor con 1 solo clic"
                 >
                    <Receipt size={13} /> Convertir a Factura
                 </button>
               ) : (
                 <button 
                    onClick={() => router.push(`/invoices/${invoice.convertedToBillId || invoice.invoicedAsId}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-xs font-semibold transition cursor-pointer"
                    title={`Ver Factura de Proveedor #${invoice.convertedToBillCode || invoice.invoicedAsCode}`}
                 >
                    <Receipt size={13} /> Factura Proveedor #{invoice.convertedToBillCode || invoice.invoicedAsCode}
                 </button>
               )
             )}

             {/* Duplicate Button */}
             <button 
                onClick={handleDuplicate}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 rounded text-gray-700 text-xs font-medium transition border border-gray-100"
             >
                <Copy size={13} /> Duplicar
             </button>

             {/* Botón Registrar Devolución / Reverso */}
             {invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED' && (
                <button 
                   onClick={openReturnModal}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition cursor-pointer shadow-2xs"
                   title="Registrar devolución parcial o total de productos (reversa de stock y ajuste de saldo)"
                >
                   <RotateCcw size={13} /> Registrar Devolución
                </button>
             )}

              {/* Edit Button if open, posted or draft (and unpaid) */}
              {(invoice.status === 'OPEN' || invoice.status === 'DRAFT' || (invoice.status === 'POSTED' && Number(invoice.outstanding) === Number(invoice.total))) && (
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

             {/* Print, WhatsApp & PDF Buttons */}
             <button 
                onClick={shareViaWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition shadow-sm"
                title="Compartir resumen y abonos por WhatsApp"
             >
                <MessageCircle size={13} /> WhatsApp
             </button>

             <button 
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition shadow-sm disabled:opacity-50"
                title="Convertir y descargar factura en PDF"
             >
                <Download size={13} /> {downloadingPdf ? 'Generando...' : 'PDF'}
             </button>

             <button 
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 rounded text-gray-700 text-xs font-medium transition border border-gray-200 shadow-sm"
                title="Imprimir documento"
             >
                <Printer size={13} /> Imprimir
             </button>

             {/* Delete Document Button */}
             {(!invoice.payments || invoice.payments.length === 0) && (
                <button 
                   onClick={handleDeleteInvoice}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-medium transition border border-red-200 shadow-sm ml-auto"
                   title="Eliminar documento definitivamente"
                >
                   <Trash2 size={13} /> Eliminar
                </button>
             )}
        </div>
      </div>

      {/* Banners de Trazabilidad y Estado Logístico */}
      <div className="max-w-4xl mx-auto mb-4 space-y-3 print:hidden">
        {/* Barra de Estado Logístico de Despacho (Solo para Notas de Entrega) */}
        {(invoice.code?.toUpperCase().startsWith('NE') || viewMode === 'DELIVERY_NOTE') && (
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">Estado de Despacho:</span>
              {invoice.dispatchStatus === 'DELIVERED' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle size={12} /> ENTREGADA AL CLIENTE
                </span>
              ) : invoice.dispatchStatus === 'DISPATCHED' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  <Truck size={12} /> DESPACHADA / EN TRÁNSITO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock size={12} /> PENDIENTE DE DESPACHO
                </span>
              )}
              {invoice.dispatchedAt && (
                <span className="text-[11px] text-slate-400">
                  ({new Date(invoice.dispatchedAt).toLocaleDateString('es-VE')})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {invoice.dispatchStatus !== 'DISPATCHED' && invoice.dispatchStatus !== 'DELIVERED' && (
                <button
                  type="button"
                  disabled={updatingDispatch}
                  onClick={() => handleUpdateDispatchStatus('DISPATCHED')}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Registrar que la mercancía salió de almacén"
                >
                  <Truck size={12} />
                  <span>Marcar como Despachada</span>
                </button>
              )}
              {invoice.dispatchStatus !== 'DELIVERED' && (
                <button
                  type="button"
                  disabled={updatingDispatch}
                  onClick={() => handleUpdateDispatchStatus('DELIVERED')}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Registrar entrega y recepción conforme del cliente"
                >
                  <CheckCircle size={12} />
                  <span>Marcar como Entregada</span>
                </button>
              )}
              {invoice.dispatchStatus !== 'PENDING_DISPATCH' && (
                <button
                  type="button"
                  disabled={updatingDispatch}
                  onClick={() => handleUpdateDispatchStatus('PENDING_DISPATCH')}
                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                  title="Restablecer estado logístico a Pendiente"
                >
                  Restablecer
                </button>
              )}
            </div>
          </div>
        )}

        {/* Banner de Nota de Entrega ya Facturada */}
        {invoice.invoicedAsCode && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 shrink-0">
                <Receipt size={16} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-indigo-950">Facturación Formal: </span>
                <span>Esta Nota de Entrega ha sido facturada bajo la Factura Fiscal Oficial </span>
                <span className="font-mono font-bold text-indigo-800 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                  #{invoice.invoicedAsCode}
                </span>.
                <span className="text-indigo-600 block sm:inline sm:ml-1">Cuentas por cobrar e inventario sincronizados.</span>
              </div>
            </div>
            {invoice.invoicedAsId && (
              <button
                type="button"
                onClick={() => router.push(`/invoices/${invoice.invoicedAsId}`)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span>Ver Factura</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        )}

        {/* Banner de Factura originada desde Nota de Entrega */}
        {invoice.sourceDeliveryNoteCode && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-700 shrink-0">
                <Truck size={16} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-blue-950">Despacho de Mercancía: </span>
                <span>Esta factura ampara la entrega realizada mediante Nota de Entrega </span>
                <span className="font-mono font-bold text-blue-800 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  #{invoice.sourceDeliveryNoteCode}
                </span>.
                <span className="text-blue-600 block sm:inline sm:ml-1">Cero duplicidad de inventario.</span>
              </div>
            </div>
            {invoice.sourceDeliveryNoteId && (
              <button
                type="button"
                onClick={() => router.push(`/invoices/${invoice.sourceDeliveryNoteId}`)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span>Ver Nota de Entrega</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        )}

        {/* Banner de Orden de Compra ya Facturada */}
        {invoice.convertedToBillCode && (
          <div className="bg-purple-50 border border-purple-200 text-purple-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700 shrink-0">
                <Receipt size={16} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-purple-950">Facturación de Proveedor: </span>
                <span>Esta Orden de Compra ha sido facturada bajo la Factura de Proveedor </span>
                <span className="font-mono font-bold text-purple-800 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                  #{invoice.convertedToBillCode}
                </span>.
                <span className="text-purple-600 block sm:inline sm:ml-1">Cuentas por pagar e inventario sincronizados.</span>
              </div>
            </div>
            {invoice.convertedToBillId && (
              <button
                type="button"
                onClick={() => router.push(`/invoices/${invoice.convertedToBillId}`)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span>Ver Factura</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        )}

        {/* Banner de Factura de Compra originada desde Orden de Compra */}
        {invoice.sourcePurchaseOrderCode && (
          <div className="bg-purple-50 border border-purple-200 text-purple-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700 shrink-0">
                <FileText size={16} />
              </div>
              <div className="text-xs">
                <span className="font-bold text-purple-950">Origen de Compra: </span>
                <span>Esta Factura ampara el pedido emitido mediante la Orden de Compra </span>
                <span className="font-mono font-bold text-purple-800 bg-white px-1.5 py-0.5 rounded border border-purple-200">
                  #{invoice.sourcePurchaseOrderCode}
                </span>.
                <span className="text-purple-600 block sm:inline sm:ml-1">Cero duplicidad de inventario.</span>
              </div>
            </div>
            {invoice.sourcePurchaseOrderId && (
              <button
                type="button"
                onClick={() => router.push(`/invoices/${invoice.sourcePurchaseOrderId}`)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <span>Ver Orden de Compra</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        )}

        {/* Banner de Devoluciones / Reversos Registrados */}
        {invoice.hasReturns && invoice.returns && invoice.returns.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 text-rose-950 px-4 py-3.5 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-wide text-rose-900">
                  {invoice.type === 'INVOICE' ? 'Devoluciones de Cliente Registradas' : 'Devoluciones a Proveedor Registradas'} ({invoice.returns.length})
                </span>
              </div>
              <span className="text-[11px] font-semibold bg-rose-200/70 text-rose-800 px-2 py-0.5 rounded-md">
                Logística Inversa Activa
              </span>
            </div>
            
            <div className="divide-y divide-rose-200/60 text-xs">
              {invoice.returns.map((ret: any, idx: number) => (
                <div key={idx} className="py-2 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-300">
                        {ret.returnCode}
                      </span>
                      <span className="font-semibold text-gray-800">
                        {ret.isTotalReturn ? 'Devolución Total' : 'Devolución Parcial'}
                      </span>
                      {ret.creditNoteCode && (
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium border border-emerald-300">
                          {ret.creditNoteCode}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">
                      <span className="font-medium text-gray-700">Motivo:</span> {ret.reason} {ret.notes ? `(${ret.notes})` : ''}
                    </p>
                    {ret.items && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Ítems: {ret.items.map((it: any) => `${it.quantity}x ${it.name} [${it.stockAction === 'RESTOCK' ? '+Stock' : (it.stockAction === 'QUARANTINE' ? 'Cuarentena' : 'Salida')}]`).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold font-mono text-rose-700 text-sm">
                      -{formatCurrency(ret.amount * conversionFactor, displayCurrency)}
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      {new Date(ret.returnDate || ret.createdAt).toLocaleDateString('es-VE')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Paper */}
      <div id="invoice-paper-printable" className={`max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none print:max-w-full print:my-0 print-no-shadow print-wrapper`}>
           
           {/* Header */}
           <div className={`${printLayout === 'FREE_FORM' ? 'p-4 print:p-0 print:pb-2' : 'p-8 md:p-12 print:p-4'} border-b border-gray-100`}>
               <div className={`flex flex-col md:flex-row justify-between items-start gap-8 ${printLayout === 'FREE_FORM' ? 'mb-2' : 'mb-10'}`}>
                   {/* Left Column: Logo + Project Name & Client Details */}
                   <div className="flex-1">
                       {/* Logo and Project Name Row */}
                       {printLayout !== 'FREE_FORM' && (
                           <div className="flex items-center gap-4 mb-6">
                               {invoice.project?.logoUrl ? (
                                   <div className="shrink-0">
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
                               <div>
                                   {invoice.project?.description ? (
                                       <div className="text-sm text-gray-700 font-bold leading-relaxed whitespace-pre-wrap">
                                           {invoice.project.description}
                                       </div>
                                   ) : (
                                       invoice.project?.name && (
                                           <h1 className="text-xl font-bold text-gray-800">{invoice.project.name}</h1>
                                       )
                                   )}
                               </div>
                           </div>
                       )}
 
                       {/* Client / Provider Details */}
                       <div className={printLayout === 'FREE_FORM' ? 'mt-1' : 'mt-4'}>
                           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 print:mb-0.5">
                              {invoice.type === 'INVOICE' ? 'Cliente' : 'Proveedor'}
                           </h3>
                           <div className={`text-gray-800 text-sm ${printLayout === 'FREE_FORM' ? 'space-y-0.5 text-xs' : 'space-y-1'}`}>
                               <p className={`font-bold ${printLayout === 'FREE_FORM' ? 'text-sm mb-0.5' : 'text-lg mb-1'}`}>{contactName}</p>
                               {contact?.taxId && <p>RIF/NIT: {contact.taxId}</p>}
                               {contact?.address && <p className="max-w-md">Dirección: {contact.address}</p>}
                               {contact?.phone && <p>Teléfono: {contact.phone}</p>}
                               {contact?.email && <p>Email: {contact.email}</p>}
                           </div>
                       </div>
                   </div>
 
                   {/* Right Column: Invoice Type, Code, Status & Dates/OC */}
                   <div className="text-right flex flex-col items-end">
                       <h2 className={`font-light text-gray-800 ${printLayout === 'FREE_FORM' ? 'text-lg mb-0.5' : 'text-3xl mb-2'}`}>
                          {viewMode === 'DELIVERY_NOTE' ? 'Nota de Entrega' : getTypeLabel(invoice.type)}
                       </h2>
                       <p className={`font-mono text-gray-600 ${printLayout === 'FREE_FORM' ? 'text-sm mb-0.5' : 'text-lg mb-2'}`}>#{invoice.code}</p>
                       <div className={printLayout === 'FREE_FORM' ? 'mb-1 print:hidden' : 'mb-4'}>
                           {getStatusBadge(invoice.status, invoice.type)}
                       </div>
                       
                       {/* Dates and Purchase Order Info */}
                       <div className={`${printLayout === 'FREE_FORM' ? 'text-xs space-y-0.5' : 'text-sm space-y-1'} text-gray-500 text-right`}>
                           <p>Fecha de Emisión: {formatDate(invoice.issueDate)}</p>
                           <p>Fecha de Vencimiento: {formatDate(invoice.dueDate)}</p>
                           {invoice.purchaseOrder && (
                               <p>
                                   <span className="text-gray-400">
                                       {invoice.purchaseOrder.startsWith('COT-') ? 'Cotización: ' : (invoice.type === 'BILL' ? 'Orden de Compra: ' : 'O.C. Cliente / Ref: ')}
                                   </span>
                                   <span className="font-mono font-bold text-gray-800">{invoice.purchaseOrder}</span>
                               </p>
                           )}
                           {invoice.purchaseOrderDate && (
                               <p>
                                   <span className="text-gray-400">Fecha Ref/O.C.: </span>
                                   <span className="font-medium text-gray-700">{invoice.purchaseOrderDate}</span>
                               </p>
                           )}
                           {displayCurrency !== invoice.currency && (
                               <p className="text-xs text-blue-600 font-semibold mt-1">
                                   Tasa Ref: {getActiveRate().toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {rateSource === 'BCV_EUR' ? 'BS/EUR' : 'BS/USD'}
                               </p>
                           )}
                       </div>
                   </div>
               </div>
 
               {/* Concept/Details (Only rendered if description is present) */}
               {invoice.description && (
                   <div className={`${printLayout === 'FREE_FORM' ? 'mt-2 pt-2' : 'mt-8 pt-6'} border-t border-gray-150`}>
                       <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Concepto</h3>
                       <p className="text-gray-700 text-sm whitespace-pre-wrap">{invoice.description}</p>
                   </div>
               )}
           </div>

           {/* Items Table */}
           <div className={printLayout === 'FREE_FORM' ? 'p-4 print:px-1 print:py-1' : 'p-8 md:p-12 print:px-4 print:py-2'}>
               <table className="w-full text-left">
                   <thead>
                       <tr className="border-b border-gray-200">
                           <th className={`${printLayout === 'FREE_FORM' ? 'py-1 text-xs' : 'py-3 text-xs'} font-bold text-gray-400 uppercase tracking-wider w-1/2`}>Descripción</th>
                           <th className={`${printLayout === 'FREE_FORM' ? 'py-1 text-xs' : 'py-3 text-xs'} font-bold text-gray-400 uppercase tracking-wider text-right`}>Cant.</th>
                           {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                              <>
                                 <th className={`${printLayout === 'FREE_FORM' ? 'py-1 text-xs' : 'py-3 text-xs'} font-bold text-gray-400 uppercase tracking-wider text-right`}>Precio</th>
                                 <th className={`${printLayout === 'FREE_FORM' ? 'py-1 text-xs' : 'py-3 text-xs'} font-bold text-gray-400 uppercase tracking-wider text-right`}>Total</th>
                              </>
                           )}
                       </tr>
                    </thead>
                    <tbody>
                       {(() => {
                           const itemsToRender = invoice.items || [];
                           const hasItems = itemsToRender.length > 0;
                           const rows = [];

                           if (hasItems) {
                               const filteredItems = printLayout === 'FREE_FORM'
                                   ? itemsToRender.filter((item) => {
                                       const price = typeof item.unitPrice === 'number' ? item.unitPrice : (typeof item.price === 'number' ? item.price : 0);
                                       const total = typeof item.total === 'number' ? item.total : 0;
                                       return total !== 0 || price !== 0;
                                     })
                                   : itemsToRender;

                               filteredItems.forEach((item) => {
                                   rows.push(
                                       <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                           <td className={`${printLayout === 'FREE_FORM' ? 'py-1.5' : 'py-4'} text-sm text-gray-800`}>
                                               <p className="font-medium">{item.description || item.name || 'Ítem sin nombre'}</p>
                                               {item.notes && (
                                                  <p className="text-[10px] text-gray-400 mt-0.5 font-normal whitespace-pre-wrap leading-tight">
                                                     {item.notes}
                                                  </p>
                                               )}
                                           </td>
                                           <td className={`${printLayout === 'FREE_FORM' ? 'py-1.5' : 'py-4'} text-sm text-gray-600 text-right`}>
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
                                                 <td className={`${printLayout === 'FREE_FORM' ? 'py-1.5' : 'py-4'} text-sm text-gray-600 text-right font-mono`}>
                                                     {formatCurrency((typeof item.unitPrice === 'number' && !isNaN(item.unitPrice) ? item.unitPrice : (typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0)) * conversionFactor, displayCurrency)}
                                                 </td>
                                                 <td className={`${printLayout === 'FREE_FORM' ? 'py-1.5' : 'py-4'} text-sm text-gray-800 text-right font-medium font-mono`}>
                                                     {formatCurrency(item.total * conversionFactor, displayCurrency)}
                                                 </td>
                                              </>
                                           )}
                                       </tr>
                                   );
                               });
                           } else {
                               rows.push(
                                   <tr key="fallback">
                                      <td className="py-4 text-sm text-gray-800" colSpan={viewMode === 'DELIVERY_NOTE' && !showPricesInDeliveryNote ? 2 : 3}>
                                          <p className="font-medium">{invoice.description || 'Servicios Profesionales'}</p>
                                      </td>
                                      {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                                         <td className="py-4 text-sm text-gray-800 text-right font-medium font-mono">
                                             {formatCurrency(totals.subtotal * conversionFactor, displayCurrency)}
                                         </td>
                                      )}
                                   </tr>
                               );
                           }

                           // Pad up to 10 rows if in FREE_FORM printLayout
                           if (printLayout === 'FREE_FORM' && rows.length < 10) {
                               const padCount = 10 - rows.length;
                               for (let i = 0; i < padCount; i++) {
                                   rows.push(
                                       <tr key={`pad-${i}`} className="border-b border-gray-50 last:border-0 print:border-0">
                                           <td className="py-1.5 text-sm">&nbsp;</td>
                                           <td className="py-1.5 text-sm">&nbsp;</td>
                                           {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                                              <>
                                                 <td className="py-1.5 text-sm">&nbsp;</td>
                                                 <td className="py-1.5 text-sm">&nbsp;</td>
                                              </>
                                           )}
                                       </tr>
                                   );
                               }
                           }

                           return rows;
                       })()}</tbody>
               </table>

               {viewMode === 'DELIVERY_NOTE' && (() => {
                 const itemsToSummarize = invoice.items || [];
                 if (itemsToSummarize.length === 0) return null;

                 // Build a map: productId → { description, totalQty, totalBultos, empaqueCantidad, unidadEmpaque }
                 const summaryMap = new Map<string, {
                   description: string;
                   totalQty: number;
                   empaqueCantidad: number;
                   unidadEmpaque: string;
                 }>();

                 itemsToSummarize.forEach((item) => {
                   const key = item.productId || `__no_product__${item.description || item.name || ''}`;
                   const prod = products.find((p: any) => p.id === item.productId);
                   const empaqQty = prod?.empaqueCantidad && prod.empaqueCantidad > 1 ? prod.empaqueCantidad : 0;
                   const unidad = prod?.unidad_empaque || 'bulto';

                   if (summaryMap.has(key)) {
                     const entry = summaryMap.get(key)!;
                     entry.totalQty += item.quantity;
                   } else {
                     summaryMap.set(key, {
                       description: item.description || item.name || 'Sin nombre',
                       totalQty: item.quantity,
                       empaqueCantidad: empaqQty,
                       unidadEmpaque: unidad,
                     });
                   }
                 });

                 const summaryRows = Array.from(summaryMap.values());
                 const grandTotalQty = summaryRows.reduce((acc, r) => acc + r.totalQty, 0);
                 const grandTotalBultos = summaryRows.reduce((acc, r) => {
                   if (r.empaqueCantidad > 0) return acc + (r.totalQty / r.empaqueCantidad);
                   return acc;
                 }, 0);

                 const hasBultos = summaryRows.some(r => r.empaqueCantidad > 0);

                 return (
                   <div className="mt-4 pt-3 border-t border-gray-200">
                     <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                       Resumen de Despacho
                     </h4>
                     <table className="w-full text-left">
                       <thead>
                         <tr className="border-b border-gray-300">
                           <th className="py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider w-1/2">Producto</th>
                           <th className="py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider text-right">Unidades</th>
                           {hasBultos && (
                             <th className="py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider text-right">Bultos</th>
                           )}
                         </tr>
                       </thead>
                       <tbody>
                         {summaryRows.map((row, idx) => {
                           const bultosNum = row.empaqueCantidad > 0 ? row.totalQty / row.empaqueCantidad : null;
                           const bultosStr = bultosNum !== null
                             ? `${Number(bultosNum.toFixed(2)).toLocaleString('es-VE')} ${bultosNum === 1 ? row.unidadEmpaque : (row.unidadEmpaque.endsWith('s') ? row.unidadEmpaque : `${row.unidadEmpaque}s`)}`
                             : '—';
                           return (
                             <tr key={idx} className="border-b border-gray-50 last:border-0">
                               <td className="py-1 text-[10px] text-gray-700 font-medium leading-tight">{row.description}</td>
                               <td className="py-1 text-[10px] text-gray-800 font-mono text-right font-semibold leading-tight">{row.totalQty.toLocaleString('es-VE')}</td>
                               {hasBultos && (
                                 <td className="py-1 text-[10px] text-gray-600 font-mono text-right leading-tight">{bultosStr}</td>
                               )}
                             </tr>
                           );
                         })}
                       </tbody>
                       <tfoot>
                         <tr className="border-t border-gray-400">
                           <td className="py-1 text-[9px] font-bold text-gray-500 uppercase">TOTAL DESPACHO</td>
                           <td className="py-1 text-[10px] font-mono text-right font-bold text-gray-900">{grandTotalQty.toLocaleString('es-VE')}</td>
                           {hasBultos && (
                             <td className="py-1 text-[10px] font-mono text-right font-bold text-gray-700">
                               {Number(grandTotalBultos.toFixed(2)).toLocaleString('es-VE')}
                             </td>
                           )}
                         </tr>
                       </tfoot>
                     </table>
                   </div>
                 );
               })()}

              {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && (
                 <div className="mt-8 flex justify-end">
                     <div className="w-full md:w-5/12 space-y-3">
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
                         {invoice.payments && invoice.payments.length > 0 && (
                             <div className="flex justify-between text-sm font-semibold text-emerald-600">
                                 <span>Total Abonado</span>
                                 <span className="font-mono">
                                   - {formatCurrency(invoice.payments.reduce((acc, curr) => acc + getPaymentAmountInInvoiceCurrency(curr), 0) * conversionFactor, displayCurrency)}
                                 </span>
                             </div>
                         )}
                         {totals.outstanding > 0 ? (
                             <div className="flex justify-between text-sm font-bold text-orange-600 bg-orange-50/80 px-3 py-1.5 rounded-lg border border-orange-200">
                                 <span>Saldo Pendiente</span>
                                 <span className="font-mono">{formatCurrency(totals.outstanding * conversionFactor, displayCurrency)}</span>
                             </div>
                         ) : (
                             <div className="flex justify-between text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                 <span>Estado de Pago</span>
                                 <span className="uppercase">PAGADA TOTALMENTE</span>
                             </div>
                         )}
                     </div>
                 </div>
              )}

              {/* Historial de Abonos / Pagos Realizados */}
              {(viewMode !== 'DELIVERY_NOTE' || showPricesInDeliveryNote) && invoice.payments && invoice.payments.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <span>Historial de Abonos / Pagos</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {invoice.payments.length} {invoice.payments.length === 1 ? 'abono registrado' : 'abonos registrados'}
                      </span>
                    </h3>
                  </div>
                  
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-2.5 px-3">Fecha</th>
                          <th className="py-2.5 px-3">Nro. Pago</th>
                          <th className="py-2.5 px-3">Método</th>
                          <th className="py-2.5 px-3">Referencia</th>
                          <th className="py-2.5 px-3">Cuenta (Caja/Banco)</th>
                          <th className="py-2.5 px-3 text-right">Monto Abonado</th>
                          <th className="py-2.5 px-3 text-center print:hidden" data-html2canvas-ignore="true">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {invoice.payments.map((alloc) => {
                          const p = alloc.payment;
                          const paymentIdToRevert = p?.id || alloc.paymentId;
                          const isReverting = revertingPaymentId === paymentIdToRevert;
                          return (
                            <tr key={alloc.id} className="hover:bg-gray-50/50">
                              <td className="py-2 px-3 text-gray-700 whitespace-nowrap">
                                {formatDate(p?.date || alloc.createdAt)}
                              </td>
                              <td className="py-2 px-3 font-mono text-gray-600 font-medium">
                                {p?.code || '-'}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                <span className="inline-flex items-center gap-1 font-medium">
                                  {formatPaymentMethod(p?.method)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-600 font-mono">
                                {p?.reference ? p.reference : <span className="text-gray-400 italic">Sin ref.</span>}
                              </td>
                              <td className="py-2 px-3 text-gray-700">
                                {p?.account ? `${p.account.name} (${p.account.code})` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                {formatCurrency(getPaymentAmountInInvoiceCurrency(alloc) * conversionFactor, displayCurrency)}
                                {p?.currency && p.currency !== invoice.currency && (
                                  <div className="text-[10px] text-gray-400 font-normal">
                                    Orig: {formatCurrency(p.amount, p.currency)} {p.exchangeRate ? `(Tasa: ${Number(p.exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })})` : ''}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center print:hidden" data-html2canvas-ignore="true">
                                <button
                                  onClick={() => handleRevertPayment(paymentIdToRevert, p?.code || 'este pago')}
                                  disabled={isReverting}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors disabled:opacity-50"
                                  title="Revertir este abono y devolver saldo a la cuenta"
                                >
                                  <Undo2 size={12} />
                                  <span>{isReverting ? 'Revirtiendo...' : 'Revertir'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50/80 border-t border-gray-200 font-semibold">
                        <tr>
                          <td colSpan={5} className="py-2 px-3 text-gray-600 text-right uppercase text-[10px]">
                            Total Abonado
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">
                            {formatCurrency(
                              invoice.payments.reduce((acc, curr) => acc + getPaymentAmountInInvoiceCurrency(curr), 0) * conversionFactor,
                              displayCurrency
                            )}
                          </td>
                          <td className="print:hidden" data-html2canvas-ignore="true"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
           </div>
           
           <div className="bg-gray-50 px-8 py-6 border-t border-gray-200 text-center text-xs text-gray-400 print:hidden" data-html2canvas-ignore="true">
                Documento generado por Sistema FINK
           </div>
       </div>

       {/* Panel Interno de Rentabilidad (Sólo para vista de Factura, NUNCA en Nota de Entrega, y fuera del documento imprimible/PDF) */}
       {viewMode === 'INVOICE' && invoice.type === 'INVOICE' && (invoice.totalCost !== undefined && invoice.totalCost > 0) && (
          <div className="max-w-4xl mx-auto mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 print:hidden shadow-sm" data-html2canvas-ignore="true">
              <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Panel Interno de Rentabilidad (Uso Administrativo)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Exclusivo interno - no visible para clientes ni en PDF</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-xs text-gray-500 block mb-1">Costo Total del Pedido</span>
                      <span className="font-mono text-gray-800 font-semibold text-base">
                          {formatCurrency((invoice.totalCost || 0) * conversionFactor, displayCurrency)}
                      </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-xs text-gray-500 block mb-1">Utilidad Neta</span>
                      <span className={`font-mono font-semibold text-base ${(invoice.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency((invoice.netProfit || 0) * conversionFactor, displayCurrency)}
                      </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-xs text-gray-500 block mb-1">Margen de Ganancia</span>
                      <span className={`font-semibold text-base ${(invoice.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                     <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        {invoice.type === 'INVOICE' ? 'Fecha del Cobro' : 'Fecha del Pago'} *
                     </label>
                     <input 
                        type="date" 
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800"
                     />
                  </div>

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

      {/* Modal Facturar Nota de Entrega */}
      {isIssueInvoiceModalOpen && invoice && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs print:hidden">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
               <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                     <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                        <Receipt size={18} />
                     </div>
                     <div>
                        <h3 className="text-base font-bold text-gray-900">Facturar Nota de Entrega</h3>
                        <p className="text-xs text-gray-500">Nota #{invoice.code} &bull; {contactName}</p>
                     </div>
                  </div>
                  <button 
                     onClick={() => setIsIssueInvoiceModalOpen(false)}
                     className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
                  >
                     ✕
                  </button>
               </div>

               <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 mb-4 text-xs text-blue-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                     <span>✓ Cero duplicidad de inventario</span>
                  </p>
                  <p className="text-blue-700">
                     El stock ya fue restado por la Nota de Entrega {invoice.code}. Esta factura formalizará la venta fiscal con correlativo independiente y unificará la cobranza del cliente.
                  </p>
               </div>

               <form onSubmit={handleConfirmIssueInvoice} className="space-y-4">
                  {issueInvoiceError && (
                     <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{issueInvoiceError}</span>
                     </div>
                  )}

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Número de Factura Oficial *
                     </label>
                     <input 
                        type="text" 
                        required
                        value={suggestedInvoiceCode}
                        onChange={(e) => setSuggestedInvoiceCode(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 font-mono font-bold text-sm"
                        placeholder="Ej. 0204"
                     />
                     <p className="text-[11px] text-gray-400 mt-1">Sugerido según el correlativo independiente de facturas de venta.</p>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Fecha de Vencimiento de Factura
                     </label>
                     <input 
                        type="date" 
                        value={issueInvoiceDueDate}
                        onChange={(e) => setIssueInvoiceDueDate(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 text-sm"
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Observaciones / Notas Adicionales (Opcional)
                     </label>
                     <textarea 
                        rows={2}
                        value={issueInvoiceNotes}
                        onChange={(e) => setIssueInvoiceNotes(e.target.value)}
                        placeholder="Ej. Factura solicitada para trámite de pago comercial"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 text-xs"
                     />
                  </div>

                   <div className="pt-3 border-t border-gray-150 flex justify-end gap-2.5">
                     <button 
                        type="button"
                        onClick={() => setIsIssueInvoiceModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 text-xs font-medium transition rounded-lg hover:bg-gray-100"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit"
                        disabled={submittingIssueInvoice || !suggestedInvoiceCode}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                     >
                        {submittingIssueInvoice ? (
                           <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Emitiendo Factura...</span>
                           </>
                        ) : (
                           <>
                              <CheckCircle size={14} />
                              <span>Emitir Factura Oficial</span>
                           </>
                        )}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Modal Convertir Orden de Compra (OC) en Factura de Proveedor (BILL) */}
      {isConvertPoModalOpen && invoice && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs print:hidden animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95">
               <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                     <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                        <Receipt size={18} />
                     </div>
                     <div>
                        <h3 className="text-base font-bold text-gray-900">Convertir a Factura de Compra</h3>
                        <p className="text-xs text-gray-500">O.C. #{invoice.code} &bull; {contactName}</p>
                     </div>
                  </div>
                  <button 
                     onClick={() => setIsConvertPoModalOpen(false)}
                     className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                  >
                     ✕
                  </button>
               </div>

               <div className="bg-purple-50/80 border border-purple-200/80 rounded-xl p-3 mb-4 text-xs text-purple-950 space-y-1">
                  <p className="font-semibold flex items-center gap-1 text-purple-800">
                     <span>✓ Cero duplicidad de inventario</span>
                  </p>
                  <p className="text-purple-700">
                     Se registrará la Factura de Compra emitida por <b>{contactName}</b> por un total de <b>${invoice.total?.toFixed(2)} USD</b>, vinculándola a la Orden de Compra #{invoice.code}.
                  </p>
               </div>

               <form onSubmit={handleConfirmConvertPo} className="space-y-4">
                  {convertPoError && (
                     <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{convertPoError}</span>
                     </div>
                  )}

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Nro. Factura Proveedor / Nro. de Control *
                     </label>
                     <input 
                        type="text" 
                        required
                        autoFocus
                        value={supplierInvoiceCode}
                        onChange={(e) => setSupplierInvoiceCode(e.target.value)}
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 font-mono font-bold text-sm"
                        placeholder="Ej. FAC-0012845 o 008472"
                     />
                     <p className="text-[11px] text-gray-400 mt-1">Escribe el número de factura fiscal o documento emitido por el proveedor.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                           Fecha de Emisión
                        </label>
                        <input 
                           type="date" 
                           value={convertPoIssueDate}
                           onChange={(e) => setConvertPoIssueDate(e.target.value)}
                           className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 text-xs"
                        />
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                           <span>Fecha de Vencimiento</span>
                           {convertPoDueDate && getConvertPoCreditDaysDiff() !== null && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                                 {getConvertPoCreditDaysDiff() === 0 ? 'Contado' : `${getConvertPoCreditDaysDiff()}d crédito`}
                              </span>
                           )}
                        </label>
                        <input 
                           type="date" 
                           value={convertPoDueDate}
                           onChange={(e) => setConvertPoDueDate(e.target.value)}
                           className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 text-xs"
                        />
                     </div>
                  </div>

                  {/* Atajos Rápidos de Días de Crédito */}
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                     <span className="text-[11px] font-bold text-gray-600 block mb-1.5">⚡ Atajos de Crédito:</span>
                     <div className="flex flex-wrap gap-1">
                        {[
                           { label: 'Contado (0d)', days: 0 },
                           { label: '7 días', days: 7 },
                           { label: '15 días', days: 15 },
                           { label: '20 días', days: 20 },
                           { label: '30 días', days: 30 },
                           { label: '45 días', days: 45 },
                           { label: '60 días', days: 60 }
                        ].map((t) => {
                           const isSelected = getConvertPoCreditDaysDiff() === t.days;
                           return (
                              <button
                                 key={t.days}
                                 type="button"
                                 onClick={() => setConvertPoCreditDays(t.days)}
                                 className={`px-2 py-0.5 rounded text-[11px] font-semibold transition border cursor-pointer ${
                                    isSelected 
                                       ? 'bg-purple-600 text-white border-purple-600 shadow-2xs' 
                                       : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                 }`}
                              >
                                 {t.label}
                              </button>
                           );
                        })}
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Observaciones / Notas Adicionales (Opcional)
                     </label>
                     <textarea 
                        rows={2}
                        value={convertPoNotes}
                        onChange={(e) => setConvertPoNotes(e.target.value)}
                        placeholder="Ej. Mercancía recibida conforme en almacén principal"
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 text-xs resize-none"
                     />
                  </div>

                  <div className="pt-3 border-t border-gray-150 flex justify-end gap-2.5">
                     <button 
                        type="button"
                        onClick={() => setIsConvertPoModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 text-xs font-medium transition rounded-lg hover:bg-gray-100 cursor-pointer"
                     >
                        Cancelar
                     </button>
                     <button 
                        type="submit"
                        disabled={submittingConvertPo || !supplierInvoiceCode.trim()}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                     >
                        {submittingConvertPo ? (
                           <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Convirtiendo a Factura...</span>
                           </>
                        ) : (
                           <>
                              <CheckCircle size={14} />
                              <span>Confirmar y Crear Factura</span>
                           </>
                        )}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Modal Registrar Devolución (Parcial o Total) */}
      {isReturnModalOpen && invoice && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs print:hidden animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col overflow-hidden">
               
               {/* Modal Header */}
               <div className="flex justify-between items-start pb-3 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2.5">
                     <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                        <RotateCcw size={18} />
                     </div>
                     <div>
                        <h3 className="text-base font-bold text-gray-900">
                           {invoice.type === 'INVOICE' ? 'Registrar Devolución de Cliente' : 'Registrar Devolución a Proveedor'}
                        </h3>
                        <p className="text-xs text-gray-500">Documento: #{invoice.code} &bull; {contactName}</p>
                     </div>
                  </div>
                  <button 
                     onClick={() => setIsReturnModalOpen(false)}
                     className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
                  >
                     ✕
                  </button>
               </div>

               {/* Modal Body (Scrollable) */}
               <form onSubmit={handleConfirmReturn} className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
                  {returnError && (
                     <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>{returnError}</span>
                     </div>
                  )}

                  {/* Motivo de la Devolución */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                           Motivo de la Devolución *
                        </label>
                        <select
                           value={returnReason}
                           onChange={(e) => setReturnReason(e.target.value)}
                           className="w-full border border-gray-300 px-3 py-2 rounded-lg text-xs bg-white focus:ring-2 focus:ring-rose-500 outline-none text-gray-800"
                        >
                           {invoice.type === 'INVOICE' ? (
                              <>
                                 <option value="Mercancía defectuosa / Dañada">Mercancía defectuosa / Dañada</option>
                                 <option value="Garantía de producto">Garantía de producto</option>
                                 <option value="Error en despacho (Ítem incorrecto)">Error en despacho (Ítem incorrecto)</option>
                                 <option value="Desistimiento / Cancelación de cliente">Desistimiento / Cancelación de cliente</option>
                                 <option value="Empaque roto durante transporte">Empaque roto durante transporte</option>
                                 <option value="OTRO">Otro motivo personalizado...</option>
                              </>
                           ) : (
                              <>
                                 <option value="Rechazo en recepción / Empaque averiado">Rechazo en recepción / Empaque averiado</option>
                                 <option value="No coincide con la Orden de Compra">No coincide con la Orden de Compra</option>
                                 <option value="Defecto de calidad o falla de fábrica">Defecto de calidad o falla de fábrica</option>
                                 <option value="Fecha de vencimiento próxima o caducada">Fecha de vencimiento próxima o caducada</option>
                                 <option value="Sobredespacho no solicitado">Sobredespacho no solicitado</option>
                                 <option value="OTRO">Otro motivo personalizado...</option>
                              </>
                           )}
                        </select>
                     </div>

                     {returnReason === 'OTRO' && (
                        <div>
                           <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Especifique el motivo *
                           </label>
                           <input
                              type="text"
                              required
                              value={customReturnReason}
                              onChange={(e) => setCustomReturnReason(e.target.value)}
                              placeholder="Ej. Cambio por modelo superior acordado"
                              className="w-full border border-gray-300 px-3 py-2 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 outline-none text-gray-800"
                           />
                        </div>
                     )}

                     <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                           Observaciones adicionales
                        </label>
                        <input
                           type="text"
                           value={returnNotes}
                           onChange={(e) => setReturnNotes(e.target.value)}
                           placeholder="Detalles de inspección, nro de guía, etc."
                           className="w-full border border-gray-300 px-3 py-2 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 outline-none text-gray-800"
                        />
                     </div>
                  </div>

                  {/* Tabla de Productos con selección Parcial o Total */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                     <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                           Selección de Productos a Devolver
                        </span>
                        <div className="flex items-center gap-2">
                           <button
                              type="button"
                              onClick={handleReturnAll}
                              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                           >
                              Devolver Todo (Total)
                           </button>
                           <span className="text-gray-300">|</span>
                           <button
                              type="button"
                              onClick={handleClearReturn}
                              className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                           >
                              Limpiar
                           </button>
                        </div>
                     </div>

                     <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                        {returnItemsState.map((item, idx) => (
                           <div key={idx} className={`p-3 transition ${item.returnQty > 0 ? 'bg-rose-50/40' : 'bg-white'}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                 <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                                    <p className="text-[11px] text-gray-500">
                                       Despachado: <span className="font-semibold text-gray-700">{item.originalQty}</span> | Ya devuelto: <span className="text-rose-600 font-semibold">{item.alreadyReturned}</span> | Remanente disponible: <span className="font-bold text-emerald-700">{item.remainingQty}</span>
                                    </p>
                                 </div>

                                 <div className="flex items-center gap-3 shrink-0">
                                    {/* Destino de Stock (Solo ventas) */}
                                    {invoice.type === 'INVOICE' && (
                                       <div className="text-right">
                                          <label className="block text-[10px] text-gray-400 uppercase font-semibold">Destino</label>
                                          <select
                                             value={item.stockAction}
                                             onChange={(e) => handleReturnActionChange(idx, e.target.value as any)}
                                             className="text-[11px] border border-gray-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-rose-500 outline-none font-medium text-gray-700"
                                          >
                                             <option value="RESTOCK">Reingreso a Stock Vendible</option>
                                             <option value="QUARANTINE">Cuarentena / Averías (No vendible)</option>
                                             <option value="NONE">Sin impacto en stock</option>
                                          </select>
                                       </div>
                                    )}

                                    {/* Input de Cantidad */}
                                    <div className="text-right">
                                       <label className="block text-[10px] text-gray-400 uppercase font-semibold">Cant. a Devolver</label>
                                       <div className="flex items-center gap-1">
                                          <input
                                             type="number"
                                             min="0"
                                             max={item.remainingQty}
                                             step="1"
                                             disabled={item.remainingQty <= 0}
                                             value={item.returnQty}
                                             onChange={(e) => handleReturnQtyChange(idx, Number(e.target.value))}
                                             className={`w-20 border px-2 py-1 rounded text-center font-mono font-bold text-xs outline-none focus:ring-2 focus:ring-rose-500 ${item.returnQty > 0 ? 'border-rose-400 bg-white text-rose-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                                          />
                                          <button
                                             type="button"
                                             disabled={item.remainingQty <= 0}
                                             onClick={() => handleReturnQtyChange(idx, item.remainingQty)}
                                             className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-1 rounded font-medium border border-gray-200 cursor-pointer disabled:opacity-40"
                                             title="Devolver todo de este ítem"
                                          >
                                             Max
                                          </button>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Resumen del Valor a Devolver */}
                  {(() => {
                     const totalReturnAmt = returnItemsState.reduce((sum, it) => sum + (it.returnQty * it.unitPrice), 0);
                     const totalReturnUnits = returnItemsState.reduce((sum, it) => sum + it.returnQty, 0);
                     return (
                        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 text-xs flex items-center justify-between text-rose-950">
                           <div>
                              <span className="font-bold">Total a Devolver: </span>
                              <span>{totalReturnUnits} unidades seleccionadas</span>
                           </div>
                           <div className="text-right">
                              <span className="text-sm font-bold font-mono text-rose-700">
                                 {formatCurrency(totalReturnAmt * conversionFactor, displayCurrency)}
                              </span>
                              <span className="block text-[10px] text-rose-600">
                                 {invoice.type === 'INVOICE' ? 'Generará Nota de Crédito' : 'Disminuirá Cuenta por Pagar'}
                              </span>
                           </div>
                        </div>
                     );
                  })()}

                  {/* Footer con Acciones */}
                  <div className="pt-3 border-t border-gray-150 flex justify-end gap-2.5 shrink-0">
                     <button
                        type="button"
                        onClick={() => setIsReturnModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 text-xs font-medium transition rounded-lg hover:bg-gray-100"
                     >
                        Cancelar
                     </button>
                     <button
                        type="submit"
                        disabled={submittingReturn || returnItemsState.every(it => it.returnQty === 0)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                     >
                        {submittingReturn ? (
                           <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Procesando Devolución...</span>
                           </>
                        ) : (
                           <>
                              <RotateCcw size={14} />
                              <span>Confirmar y Procesar Devolución</span>
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
