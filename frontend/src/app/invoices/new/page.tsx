"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Save, Building, Calendar, FileText, DollarSign, AlertCircle, User, CreditCard, Wallet, Percent, Plus, Trash2, Box, Package, Search, X, Check, Clock, ChevronRight, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ProductAutocomplete from '@/components/ProductAutocomplete';

function NewInvoiceContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const searchParams = useSearchParams();
  
  // Lists
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('BILL'); // BILL (Gasto/Compra) or INVOICE (Venta)
  const [code, setCode] = useState('');
  const [isDeliveryNote, setIsDeliveryNote] = useState(false);
  const [isPurchaseOrder, setIsPurchaseOrder] = useState(true); // Default to Purchase Order when in BILL mode
  
  // Items Mode
  const [useItemsMode, setUseItemsMode] = useState(false);
  const [lines, setLines] = useState<any[]>([
      { id: Date.now(), productId: '', name: '', quantity: 1, price: 0, total: 0, notes: '' }
  ]);
  
  // Contact
  const [contactId, setContactId] = useState(''); // Vendor or Customer ID
  
  // Money
  const [currency, setCurrency] = useState('USD');
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState('');
  
  // Tax
  const [hasTax, setHasTax] = useState(false);
  const [taxRate, setTaxRate] = useState(16);
  const [taxAmount, setTaxAmount] = useState('0');

  // Dates
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  
  // Purchase Order
  const [purchaseOrder, setPurchaseOrder] = useState('');
  const [purchaseOrderDate, setPurchaseOrderDate] = useState('');
  
  // Payment
  const [isPaid, setIsPaid] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  // Duplication Load Logic
  useEffect(() => {
    const duplicateId = searchParams.get('duplicateFrom');
    if (!duplicateId) return;

    const loadSourceInvoice = async () => {
      try {
        setLoading(true);
        const res = await api.invoices.getById(duplicateId);
        const src = res.data.data;
        if (src) {
          setProjectId(src.projectId || '');
          setType(src.type || 'BILL');
          setCurrency(src.currency || 'USD');
          setDescription(src.description || '');
          setHasTax(src.taxAmount > 0);
          setTaxAmount(String(src.taxAmount || 0));
          
          let parsedItems = [];
          if (src.lines) {
             try {
                const parsed = typeof src.lines === 'string' ? JSON.parse(src.lines) : src.lines;
                if (Array.isArray(parsed)) {
                   parsedItems = parsed;
                } else if (parsed && Array.isArray(parsed.items)) {
                   parsedItems = parsed.items;
                }
             } catch(e) {
                console.error(e);
             }
          }
          
          if (parsedItems.length > 0) {
             setLines(parsedItems.map((item: any, idx: number) => ({
                id: Date.now() + idx,
                productId: item.productId || '',
                name: item.description || item.name || '',
                quantity: Number(item.quantity || 1),
                price: Number(typeof item.unitPrice === 'number' && !isNaN(item.unitPrice) ? item.unitPrice : (typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0)),
                total: Number(item.total || 0),
                notes: item.notes || ''
             })));
             setUseItemsMode(true);
          } else {
             setTotal(String(src.total || ''));
          }

          if (src.isDeliveryNote) {
            setIsDeliveryNote(true);
          }
          if (src.purchaseOrder) {
            setPurchaseOrder(src.purchaseOrder);
          }
          if (src.purchaseOrderDate) {
            setPurchaseOrderDate(src.purchaseOrderDate);
          }

          setContactId(src.vendorId || src.customerId || '');
          if (src.dueDate) setDueDate(src.dueDate.slice(0, 10));
        }
      } catch (err: any) {
        console.error('Error duplicating invoice', err);
        setError('Error al duplicar factura origen');
      } finally {
        setLoading(false);
      }
    };

    loadSourceInvoice();
  }, [searchParams]);

  // Read initial document type from URL query params (e.g. ?type=po, ?type=ne, ?type=invoice, ?type=bill)
  useEffect(() => {
    const urlType = searchParams.get('type')?.toLowerCase();
    if (urlType === 'po' || urlType === 'oc') {
      setType('BILL');
      setIsPurchaseOrder(true);
    } else if (urlType === 'bill' || urlType === 'gasto' || urlType === 'compra') {
      setType('BILL');
      setIsPurchaseOrder(false);
    } else if (urlType === 'ne') {
      setType('INVOICE');
      setIsDeliveryNote(true);
    } else if (urlType === 'invoice' || urlType === 'factura') {
      setType('INVOICE');
      setIsDeliveryNote(false);
    }
  }, [searchParams]);

  // Quotation Import State
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteList, setQuoteList] = useState<any[]>([]);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteFilterStatus, setQuoteFilterStatus] = useState('ALL');
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Helper para asignar días de crédito rápidamente
  const setCreditDays = (days: number) => {
    const base = issueDate ? new Date(issueDate + 'T12:00:00') : new Date();
    base.setDate(base.getDate() + days);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}`);
  };

  const getCreditDaysDiff = () => {
    if (!issueDate || !dueDate) return null;
    const d1 = new Date(issueDate + 'T12:00:00');
    const d2 = new Date(dueDate + 'T12:00:00');
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const loadAvailableQuotes = async () => {
    setQuoteLoading(true);
    try {
      const res = await (api as any).quotations.getAll();
      if (res.data?.success && Array.isArray(res.data.data)) {
        setQuoteList(res.data.data);
      }
    } catch (err) {
      console.warn('Error loading quotations for invoice import:', err);
    } finally {
      setQuoteLoading(false);
    }
  };

  const applyQuotationToForm = (quote: any, forceDeliveryNote?: boolean) => {
    setType('INVOICE');
    const isDeliv = forceDeliveryNote !== undefined ? forceDeliveryNote : isDeliveryNote;
    setIsDeliveryNote(isDeliv);
    setPurchaseOrder(quote.correlative || quote.id);
    if (quote.createdAt) setPurchaseOrderDate(quote.createdAt.slice(0, 10));
    setCurrency('USD');

    const previousDocs = quote.relatedInvoices || [];
    const hasPriorDeliveries = previousDocs.length > 0;
    const deliveryNumber = previousDocs.length + 1;

    setDescription(
      hasPriorDeliveries
        ? `Despacho (Entrega #${deliveryNumber}) s/Cotización ${quote.correlative || quote.id} - ${quote.customer?.name || 'Cliente'}`
        : `Venta / Despacho s/Cotización ${quote.correlative || quote.id} - ${quote.customer?.name || 'Cliente'}`
    );

    // Mapear ítems considerando saldos pendientes si ya hubo despachos previos
    if (Array.isArray(quote.items) && quote.items.length > 0) {
      let runningTotal = 0;

      const mappedLines = quote.items
        .map((item: any, idx: number) => {
          const matchedProd = products.find(p => 
            (p.sku && item.sku && p.sku.toLowerCase() === item.sku.toLowerCase()) ||
            (p.name && item.name && p.name.toLowerCase() === item.name.toLowerCase()) ||
            p.id === item.matchedProductId
          );

          // Si la cotización tiene desglose de pendientes, usar pendingQuantity; sino, item.quantity
          let qtyToDispatch = Number(item.quantity || 1);
          if (hasPriorDeliveries && item.pendingQuantity !== undefined) {
            qtyToDispatch = Number(item.pendingQuantity);
          }

          const unitPrice = Number(item.unitPriceUSD || item.unitPrice || 0);
          const lineTotal = Number(qtyToDispatch) * unitPrice;
          runningTotal += lineTotal;

          let noteText = item.medidas || item.notes || '';
          if (hasPriorDeliveries && item.dispatchedQuantity !== undefined && item.dispatchedQuantity > 0) {
            noteText = `[Cotizado: ${item.quotedQuantity || item.quantity} | Previo: ${item.dispatchedQuantity} | Por despachar: ${qtyToDispatch}] ${noteText}`.trim();
          }

          return {
            id: Date.now() + idx,
            productId: matchedProd ? matchedProd.id : 'CUSTOM',
            name: item.name || (matchedProd ? matchedProd.name : 'Producto'),
            quantity: Number(qtyToDispatch),
            price: unitPrice,
            total: lineTotal,
            notes: noteText
          };
        })
        .filter((line: any, _: number, arr: any[]) => {
          const anyPending = arr.some(l => l.quantity > 0);
          if (anyPending) {
            return line.quantity > 0;
          }
          return true;
        });

      setLines(mappedLines);
      setUseItemsMode(true);
      setTotal(String(runningTotal > 0 ? runningTotal.toFixed(2) : (quote.totalUSD || 0)));
    }

    // Buscar si el cliente ya existe en el maestro de contactos
    if (quote.customer) {
      const custName = (quote.customer.name || '').toLowerCase().trim();
      const custTaxId = (quote.customer.taxId || '').toLowerCase().trim();
      
      const foundContact = contacts.find(c => {
        const cName = (c.name || '').toLowerCase().trim();
        const cTaxId = (c.taxId || c.rif || '').toLowerCase().trim();
        return (custTaxId && cTaxId === custTaxId) || (custName && cName.includes(custName)) || (custName && custName.includes(cName));
      });

      if (foundContact) {
        setContactId(foundContact.id);
      }
    }

    setShowQuoteModal(false);
    if (hasPriorDeliveries) {
      toast.success(`Cotización ${quote.correlative || quote.id}: Se cargó el saldo pendiente por despachar (Entrega #${deliveryNumber})`);
    } else {
      toast.success(`Cotización ${quote.correlative || quote.id} cargada exitosamente`);
    }
  };

  // Cargar automáticamente si viene el parámetro ?fromQuotation=
  useEffect(() => {
    const fromQuoteId = searchParams.get('fromQuotation');
    const isDeliveryParam = searchParams.get('isDeliveryNote');
    if (!fromQuoteId) return;

    const loadQuotation = async () => {
      try {
        setLoading(true);
        const res = await (api as any).quotations.getById(fromQuoteId);
        const quote = res.data?.data;
        if (quote) {
          applyQuotationToForm(quote, isDeliveryParam === 'true');
        }
      } catch (err: any) {
        console.warn('Error loading quotation for invoice:', err);
      } finally {
        setLoading(false);
      }
    };

    loadQuotation();
  }, [searchParams, products.length, contacts.length]);

  // Initial Load: Projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await api.projects.getAll();
        const projs = res.data.data || [];
        setProjects(projs);
        if (projs.length > 0) {
           setProjectId(projs[0].id);
        }
      } catch(e) {
        console.error('Error loading projects', e);
      }
    };
    loadProjects();
  }, []);

  // Update taxRate with project default tax rate when project changes
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const selectedProj = projects.find(p => p.id === projectId);
      if (selectedProj && selectedProj.defaultTaxRate !== undefined) {
        setTaxRate(selectedProj.defaultTaxRate);
      }
    }
  }, [projectId, projects]);

  // Load Dependencies (Contacts, Accounts, Products) when Project Changes
  useEffect(() => {
    if (!projectId) {
        setContacts([]);
        setAccounts([]);
        setProducts([]);
        return;
    }
    const loadDependencies = async () => {
        setDataLoading(true);
        try {
            const [resContacts, resAccounts, resProducts] = await Promise.all([
                api.contacts.getAll({ projectId }),
                api.accounts.getAll({ projectId }),
                api.products.getAll({ projectId, limit: 3000 })
            ]);
            setContacts(resContacts.data.data || []);
            setAccounts(resAccounts.data.data || []);
            setProducts(resProducts.data.data || []);
        } catch(e) {
            console.error('Error loading dependencies', e);
        } finally {
            setDataLoading(false);
        }
    };
    loadDependencies();
  }, [projectId]);

  // Items Mode Logic
  useEffect(() => {
     if (useItemsMode) {
         // Calculate total from lines
         const sum = lines.reduce((acc, line) => acc + (line.quantity * line.price), 0);
         setTotal(sum.toFixed(2));
     }
  }, [lines, useItemsMode]);

  const addLine = () => {
    setLines(prev => [...prev, { id: Date.now(), productId: '', name: '', quantity: 1, price: 0, total: 0, notes: '' }]);
  };

  const removeLine = (id: number) => {
      setLines(prev => {
          if (prev.length === 1) return prev;
          return prev.filter(l => l.id !== id);
      });
  };

  const updateLine = (id: number, field: string, value: any) => {
      setLines(prev => prev.map(line => {
          if (line.id === id) {
              const updated = { ...line, [field]: value };
              if (field === 'productId' && value !== 'CUSTOM') {
                  const prod = products.find(p => p.id === value);
                  if (prod) {
                      updated.name = prod.name;
                      updated.price = prod.unitPrice || 0;
                  }
              }
              updated.total = (Number(updated.quantity) || 0) * (Number(updated.price) || 0);
              return updated;
          }
          return line;
      }));
  };

  const updateLineMultiple = (id: number, values: Record<string, any>) => {
      setLines(prev => prev.map(line => {
          if (line.id === id) {
              const updated = { ...line, ...values };
              if (values.productId && values.productId !== 'CUSTOM') {
                  const prod = products.find(p => p.id === values.productId);
                  if (prod) {
                      if (values.name === undefined) updated.name = prod.name;
                      if (values.price === undefined) updated.price = prod.unitPrice || 0;
                  }
              }
              updated.total = (Number(updated.quantity) || 0) * (Number(updated.price) || 0);
              return updated;
          }
          return line;
      }));
  };

  // Tax Calculator logic
  useEffect(() => {
      if (hasTax && total && !isNaN(Number(total))) {
          // Logic: Input 'total' is treated as Base Amount
          // Tax = Base * (Rate / 100)
          // Final Total = Base + Tax
          const base = Number(total);
          const tax = base * (taxRate / 100);
          setTaxAmount(tax.toFixed(2));
      } else if (!hasTax) {
          setTaxAmount('0');
      }
  }, [hasTax, total, taxRate]);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!projectId) { setError('Selecciona un proyecto'); return; }
    if (!total || Number(total) <= 0) { setError('El monto debe ser mayor a 0'); return; }
    if (isPaid && !paymentAccountId) { setError('Selecciona una cuenta de origen para el pago'); return; }

    setLoading(true);
    setError(null);
    try {
      // Anchor dueDate to noon to avoid timezone issues if present
      let dueDateToSend = dueDate;
      if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        dueDateToSend = dueDate + 'T12:00:00';
      }

      // Calculate final total (Base + Tax) if tax enabled
      let finalTotal = Number(total);
      if (hasTax) {
          finalTotal += Number(taxAmount);
      }

      // Issue Date Logic: Send raw YYYY-MM-DD string to let backend anchor it to noon
      // This prevents the -1 day error due to UTC midnight conversion
      const issueDateToSend = issueDate;

      const body = { 
          projectId, 
          type,
          code: code || undefined, 
          currency, 
          total: finalTotal,
          issueDate: issueDateToSend,
          dueDate: dueDateToSend,
          // New fields
          vendorId: type === 'BILL' ? contactId : undefined,
          customerId: type === 'INVOICE' ? contactId : undefined,
          description,
          taxAmount: hasTax ? Number(taxAmount) : 0,
          isPaid,
          paymentAccountId: isPaid ? paymentAccountId : undefined,
          paymentMethod: isPaid ? paymentMethod : undefined,
          lines: useItemsMode ? lines.map(line => ({
              productId: line.productId || undefined,
              description: line.name || '',
              quantity: Number(line.quantity || 1),
              unitPrice: Number(line.price || 0),
              total: Number(line.total || 0),
              notes: line.notes || ''
          })) : undefined, // Send lines mapped to backend structure if in items mode
          isDeliveryNote: type === 'INVOICE' ? isDeliveryNote : false,
          isPurchaseOrder: type === 'BILL' ? isPurchaseOrder : false,
          purchaseOrder: type === 'INVOICE' ? (purchaseOrder || undefined) : undefined,
          purchaseOrderDate: type === 'INVOICE' ? (purchaseOrderDate || undefined) : undefined
      };
      
      const res = await api.invoices.create(body);
      
      if (res.data && res.data.success !== false) {
          router.push('/invoices');
      } else {
        const msg = res.data?.error?.message || 'Error desconocido';
        setError(msg);
      }
    } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error?.message || err.message || 'Error de conexión');
    } finally {
        setLoading(false);
    }
  };

  // Filter contacts based on type
  const filteredContacts = contacts.filter(c => {
      if (type === 'BILL') return c.type === 'SUPPLIER' || c.type === 'BOTH' || c.type === 'OTHER';
      if (type === 'INVOICE') return c.type === 'CUSTOMER' || c.type === 'BOTH' || c.type === 'OTHER';
      return true;
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
            href="/invoices" 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
        >
            <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Factura</h1>
            <p className="text-gray-500 text-sm">Registrar documento por pagar o cobrar</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Banner: Importar desde Cotización Previa */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              ¿El cliente tiene una Cotización previa?
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-extrabold uppercase">Catálogo / POS</span>
            </h4>
            <p className="text-xs text-slate-500">Carga automáticamente los productos, cantidades, precios y cliente en esta Nota de Entrega o Factura con un clic.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowQuoteModal(true); loadAvailableQuotes(); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          Revisar Cotizaciones Previas
        </button>
      </div>

      <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="p-6 md:p-8 space-y-8">
            {/* Section 1: Basic Info */}
            <section className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4" /> Configuración Inicial
                </h3>
                
                <div className={`grid grid-cols-1 gap-6 ${type === 'INVOICE' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                    {/* Project Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                        <select 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none"
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                        >
                            <option value="">-- Seleccionar --</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                            <button
                                type="button"
                                onClick={() => setType('BILL')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    type === 'BILL' 
                                    ? 'bg-white text-orange-600 shadow-sm border border-orange-100' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Por Pagar (Compra)
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('INVOICE')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    type === 'INVOICE' 
                                    ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Por Cobrar (Venta)
                            </button>
                        </div>
                    </div>

                    {/* Subtype Selector (Invoice vs Delivery Note for INVOICE, and Orden de Compra vs Factura de Proveedor for BILL) */}
                    {type === 'INVOICE' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subtipo de Venta</label>
                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setIsDeliveryNote(false)}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        !isDeliveryNote 
                                        ? 'bg-white text-blue-600 shadow-sm border border-blue-100' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Factura
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDeliveryNote(true)}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        isDeliveryNote 
                                        ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Nota de Entrega
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subtipo de Compra</label>
                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setIsPurchaseOrder(true)}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        isPurchaseOrder 
                                        ? 'bg-white text-purple-700 shadow-sm border border-purple-200' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Orden de Compra (O.C.)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPurchaseOrder(false)}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                        !isPurchaseOrder 
                                        ? 'bg-white text-orange-600 shadow-sm border border-orange-100' 
                                        : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Factura de Proveedor
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

             <hr className="border-gray-100" />

            {/* Section 2: Details */}
            <section className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Detalles del Documento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Contact Selector */}
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {type === 'BILL' ? 'Proveedor (Acreedor)' : 'Cliente (Deudor)'}
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <select 
                                className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none disabled:opacity-50"
                                value={contactId}
                                onChange={(e) => setContactId(e.target.value)}
                                disabled={!projectId || dataLoading}
                            >
                                <option value="">-- Seleccionar o Dejar Vacío --</option>
                                {filteredContacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.taxId ? `(${c.taxId})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                         <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Notas</label>
                         <textarea 
                            rows={3}
                            className="w-full p-3 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none resize-none"
                            placeholder="Ej. Servicios de consultoría mes de Enero..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                         />
                    </div>

                    {/* Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {type === 'BILL' 
                                ? (isPurchaseOrder ? 'Nro. de Orden de Compra' : 'Nro. Factura Proveedor / Control') 
                                : (isDeliveryNote ? 'Nro. de Nota de Entrega' : 'Nro. de Factura / Control')}
                        </label>
                        <input 
                            className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none"
                            placeholder={
                                type === 'BILL' 
                                    ? (isPurchaseOrder ? 'Ej. OC-20260905-1234 (Automático)' : 'Ej. FAC-0009876') 
                                    : (isDeliveryNote ? 'Ej. NE-0008 (Automático)' : 'Ej. 000123')
                            }
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                         <p className="text-xs text-gray-400 mt-1">
                            {code ? 'Código personalizado' : 'Opcional (se genera automáticamente con formato oficial si se deja vacío)'}
                         </p>
                    </div>

                    {/* Dates & Quick Credit Terms */}
                    <div className="md:col-span-2 space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    Fecha de Emisión
                                </label>
                                <input 
                                    type="date"
                                    className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none font-medium"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        Fecha de Vencimiento
                                    </span>
                                    {dueDate && (
                                        <span className="text-[11px] font-bold text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded-full">
                                            {getCreditDaysDiff() !== null ? (
                                                getCreditDaysDiff() === 0 ? 'Contado (0 días)' :
                                                (getCreditDaysDiff()! > 0 ? `${getCreditDaysDiff()} días de crédito` : `Vencida (${Math.abs(getCreditDaysDiff()!)}d antes)`)
                                            ) : ''}
                                        </span>
                                    )}
                                </label>
                                <input 
                                    type="date"
                                    className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none font-medium"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Atajos Rápidos de Días de Crédito */}
                        <div className="pt-1.5 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 shrink-0">
                                ⚡ Atajos de Crédito:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { label: 'Contado (0d)', days: 0 },
                                    { label: '7 días', days: 7 },
                                    { label: '15 días', days: 15 },
                                    { label: '20 días', days: 20 },
                                    { label: '30 días', days: 30 },
                                    { label: '45 días', days: 45 },
                                    { label: '60 días', days: 60 }
                                ].map((term) => {
                                    const isSelected = getCreditDaysDiff() === term.days;
                                    return (
                                        <button
                                            key={term.days}
                                            type="button"
                                            onClick={() => setCreditDays(term.days)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                                                isSelected 
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                            }`}
                                        >
                                            {term.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Purchase Order (Only for Sales Invoices) */}
                    {type === 'INVOICE' && (
                        <div className="grid grid-cols-2 gap-4 md:col-span-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    O.C. / Nro. de Pedido del Cliente <span className="text-gray-400 font-normal">(Opcional)</span>
                                </label>
                                <input 
                                    className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none text-sm"
                                    placeholder="Ej. O.C. del cliente, nro de pedido o referencia"
                                    value={purchaseOrder}
                                    onChange={(e) => setPurchaseOrder(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha de O.C. / Pedido <span className="text-gray-400 font-normal">(Opcional)</span>
                                </label>
                                <input 
                                    type="text"
                                    className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none text-sm"
                                    placeholder="Ej. 05/06/2026, 10/06/2026"
                                    value={purchaseOrderDate}
                                    onChange={(e) => setPurchaseOrderDate(e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </section>

             <hr className="border-gray-100" />

            {/* Section 3: Amounts */}
            <section className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Montos e Impuestos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner">
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                        <select 
                             className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                             value={currency}
                             onChange={(e) => setCurrency(e.target.value)}
                        >
                            <option value="USD">Dólares (USD)</option>
                            <option value="BS">Bolívares (Bs)</option>
                            <option value="EUR">Euros (EUR)</option>
                        </select>
                    </div>
                    
                    <div className="md:col-span-5">
                        <div className="flex justify-between items-center mb-1">
                             <label className="block text-sm font-medium text-slate-700">Monto {useItemsMode ? '(Calculado)' : '(Base Imponible)'}</label>
                             <button
                                type="button"
                                onClick={() => setUseItemsMode(!useItemsMode)}
                                className="text-[10px] font-bold uppercase tracking-wide text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                             >
                                {useItemsMode ? 'Modo Simple' : 'Detallar Items'}
                             </button>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                            <input 
                                type="number"
                                step="any"
                                className={`w-full pl-8 p-2.5 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 ${useItemsMode ? 'bg-slate-100 text-slate-500' : 'bg-white'}`}
                                placeholder="0.00"
                                value={total}
                                onChange={(e) => setTotal(e.target.value)}
                                readOnly={useItemsMode}
                            />
                        </div>
                    </div>

                    {/* ITEMS TABLE (Full Width) */}
                    {useItemsMode && (
                        <div className="md:col-span-12 bg-white rounded-xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-200">
                            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                <Package size={16} className="text-blue-500" /> Items del Documento
                            </h4>
                            <div className="space-y-3">
                                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                                    <div className="col-span-5">Producto / Servicio</div>
                                    <div className="col-span-2 text-center">Cant.</div>
                                    <div className="col-span-3 text-right">Precio Unit.</div>
                                    <div className="col-span-2 text-right">Total</div>
                                </div>
                                {lines.map((line) => (
                                    <div key={line.id} className="grid grid-cols-12 gap-2 items-start group">
                                        <div className="col-span-5 space-y-1">
                                            <ProductAutocomplete
                                                products={products}
                                                value={line.productId}
                                                customName={line.name}
                                                onSelect={(prod) => {
                                                    if (prod) {
                                                        updateLineMultiple(line.id, {
                                                            productId: prod.id,
                                                            name: prod.name,
                                                            price: prod.unitPrice || 0
                                                        });
                                                    } else {
                                                        updateLineMultiple(line.id, {
                                                            productId: 'CUSTOM'
                                                        });
                                                    }
                                                }}
                                                onCustomChange={(custom) => {
                                                    updateLineMultiple(line.id, {
                                                        productId: 'CUSTOM',
                                                        name: custom
                                                    });
                                                }}
                                                placeholder="Buscar por nombre, SKU, código..."
                                            />
                                            <input 
                                                className="w-full mt-1 p-1 text-[11px] border-b border-dashed border-slate-200 focus:border-blue-300 outline-none bg-transparent text-gray-500 placeholder:text-slate-300"
                                                placeholder="Anotación / Comentario opcional de línea..."
                                                value={line.notes || ''}
                                                onChange={(e) => updateLine(line.id, 'notes', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input 
                                                type="number" className="w-full p-2 text-sm text-center bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
                                                min="1" value={line.quantity} onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input 
                                                type="number" className="w-full p-2 text-sm text-right bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
                                                min="0" step="0.01" value={line.price} onChange={(e) => updateLine(line.id, 'price', Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-center justify-end gap-1">
                                            <span className="text-sm font-bold text-slate-700">{Number(line.total).toFixed(2)}</span>
                                            <button type="button" onClick={() => removeLine(line.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addLine} className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors">
                                <Plus size={14} /> AGREGAR ITEM
                            </button>
                        </div>
                    )}

                    <div className="md:col-span-4 flex flex-col justify-center">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input 
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                checked={hasTax}
                                onChange={(e) => setHasTax(e.target.checked)}
                            />
                            <span className="text-sm font-medium text-slate-700">Calcula IVA</span>
                        </label>
                        
                        {hasTax && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                     <span className="text-xs text-slate-500">Tasa (%):</span>
                                     <input 
                                        type="number"
                                        className="w-16 p-1 text-sm bg-white border border-slate-200 rounded text-center outline-none focus:border-blue-300"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(Number(e.target.value))}
                                     />
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                    <Percent className="w-4 h-4 text-slate-400" />
                                    <span>IVA:</span>
                                    <span className="font-semibold text-slate-700">{currency} {taxAmount}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-slate-800 pt-1 border-t border-slate-200">
                                    <span>Total:</span>
                                    <span>{currency} { Number(total || 0) + Number(taxAmount || 0) }</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

             <hr className="border-gray-100" />

            {/* Section 4: Instant Payment */}
             <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Estado del Pago
                    </h3>
                </div>

                <div className={`transition-all duration-300 rounded-2xl border overflow-hidden ${isPaid ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <div className="p-4 flex items-center gap-3">
                         <input 
                            type="checkbox"
                            id="isPaidCheck"
                            className="w-5 h-5 rounded text-green-600 focus:ring-green-500 cursor-pointer"
                            checked={isPaid}
                            onChange={(e) => setIsPaid(e.target.checked)}
                        />
                        <label htmlFor="isPaidCheck" className="flex-1 cursor-pointer select-none">
                            <span className={`block font-medium ${isPaid ? 'text-green-800' : 'text-gray-700'}`}>
                                {type === 'BILL' ? 'Marcar como pagada inmediatamente' : 'Marcar como cobrada inmediatamente'}
                            </span>
                            <span className="text-xs text-gray-500 block">
                                {type === 'BILL' 
                                  ? 'Se creará el registro de pago y se descontará de la cuenta seleccionada.'
                                  : 'Se creará el registro de cobro y se sumará a la cuenta seleccionada.'}
                            </span>
                        </label>
                    </div>

                    {isPaid && (
                        <div className="px-6 pb-6 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                             <div>
                                <label className="block text-sm font-medium text-green-800 mb-1">Cuenta de Origen / Destino</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-3 w-4 h-4 text-green-600/50" />
                                    <select 
                                        className="w-full pl-9 p-2.5 bg-white border border-green-200 focus:ring-2 focus:ring-green-200 rounded-xl outline-none"
                                        value={paymentAccountId}
                                        onChange={(e) => setPaymentAccountId(e.target.value)}
                                        disabled={!projectId}
                                    >
                                        <option value="">-- Seleccionar Cuenta --</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-green-800 mb-1">Método de Pago</label>
                                <select 
                                    className="w-full p-2.5 bg-white border border-green-200 focus:ring-2 focus:ring-green-200 rounded-xl outline-none"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    <option value="CASH">Efectivo</option>
                                    <option value="WIRE_TRANSFER">Transferencia</option>
                                    <option value="ZELLE">Zelle</option>
                                    <option value="MOBILE_PAYMENT">Pago Móvil</option>
                                    <option value="CARD">Tarjeta</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
            <Link 
                href="/invoices"
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                tabIndex={-1}
            >
                Cancelar
            </Link>
            <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-lg shadow-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {loading ? (
                    'Guardando...'
                ) : (
                    <>
                        <Save className="w-4 h-4" /> 
                        {type === 'BILL' 
                            ? (isPurchaseOrder ? 'Emitir Orden de Compra' : 'Guardar Compra / Factura') 
                            : (isDeliveryNote ? 'Emitir Nota de Entrega' : 'Guardar Factura de Venta')}
                    </>
                )}
            </button>
        </div>
      </form>

      {/* Modal: Selector de Cotización Previa */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Seleccionar Cotización Previa</h3>
                  <p className="text-xs text-slate-500">Elige la cotización para importar sus productos a la Nota de Entrega o Factura</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="p-1.5 hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search & Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, RIF, número COT- o producto..."
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuoteFilterStatus('ALL')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${quoteFilterStatus === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteFilterStatus('PENDING')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${quoteFilterStatus === 'PENDING' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Pendientes
                </button>
                <button
                  type="button"
                  onClick={() => setQuoteFilterStatus('APPROVED')}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${quoteFilterStatus === 'APPROVED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Aprobadas
                </button>
                <button
                  type="button"
                  onClick={loadAvailableQuotes}
                  className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
                  title="Recargar"
                >
                  <RefreshCw size={15} className={quoteLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Modal Body: List of Quotes */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5 divide-y divide-slate-100">
              {quoteLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Cargando cotizaciones del sistema...</div>
              ) : quoteList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No se encontraron cotizaciones registradas.</div>
              ) : (
                quoteList
                  .filter(q => {
                    if (quoteFilterStatus !== 'ALL' && q.status !== quoteFilterStatus) return false;
                    if (!quoteSearch.trim()) return true;
                    const s = quoteSearch.toLowerCase().trim();
                    const corr = (q.correlative || q.id || '').toLowerCase();
                    const cName = (q.customer?.name || '').toLowerCase();
                    const cTaxId = (q.customer?.taxId || '').toLowerCase();
                    const itemsStr = Array.isArray(q.items) ? q.items.map((i: any) => i.name || '').join(' ').toLowerCase() : '';
                    return corr.includes(s) || cName.includes(s) || cTaxId.includes(s) || itemsStr.includes(s);
                  })
                  .map(q => {
                    const itemsCount = Array.isArray(q.items) ? q.items.length : 0;
                    const totalUnits = Array.isArray(q.items) ? q.items.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 0), 0) : 0;
                    const metrics = q.dispatchMetrics;
                    const hasPrior = metrics?.relatedInvoicesCount > 0;
                    const isPartially = q.status === 'PARTIALLY_INVOICED' || (hasPrior && metrics?.totalPendingUnits > 0);
                    const isFully = q.status === 'FULLY_INVOICED' || (hasPrior && metrics?.totalPendingUnits === 0);
                    const isPending = !q.status || q.status === 'PENDING';
                    const isApproved = q.status === 'APPROVED';

                    return (
                      <div key={q.id || q.correlative} className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-200">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs">{q.correlative || q.id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase ${
                              isFully ? 'bg-purple-100 text-purple-800' :
                              isPartially ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                              isApproved ? 'bg-emerald-100 text-emerald-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {isFully ? 'Despachada Total' :
                               isPartially ? `Despacho Parcial (${metrics?.totalDispatchedUnits || 0}/${metrics?.totalQuotedUnits || totalUnits} unds)` :
                               isApproved ? 'Aprobada' : 'Pendiente'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(q.createdAt).toLocaleDateString('es-VE')}
                            </span>
                          </div>
                          <div className="font-bold text-sm text-slate-800">
                            {q.customer?.name || 'Cliente Particular'}
                            {q.customer?.taxId && <span className="text-xs text-slate-500 font-mono ml-2 font-normal">({q.customer.taxId})</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                            <span>📦 {itemsCount} productos ({totalUnits} unds cotizadas)</span>
                            <span>•</span>
                            <span className="font-bold text-slate-900">${Number(q.totalUSD || 0).toFixed(2)} USD</span>
                            {q.totalBs && <span className="font-mono text-slate-400">(Bs. {Number(q.totalBs).toLocaleString('es-VE', { minimumFractionDigits: 2 })})</span>}
                          </div>

                          {/* Documentos emitidos previamente */}
                          {hasPrior && Array.isArray(q.relatedInvoices) && q.relatedInvoices.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-indigo-700 font-semibold">Docs emitidos:</span>
                              {q.relatedInvoices.map((inv: any) => (
                                <span key={inv.id || inv.code} className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded">
                                  {inv.code} (${Number(inv.total || 0).toFixed(2)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Botones de acción directa */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => applyQuotationToForm(q, true)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                            title="Cargar saldo a Nota de Entrega"
                          >
                            <FileText size={12} />
                            {isPartially ? `Saldo (${metrics?.totalPendingUnits} unds) a Nota` : 'Como Nota de Entrega'}
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuotationToForm(q, false)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                            title="Cargar saldo a Factura"
                          >
                            <DollarSign size={12} />
                            {isPartially ? `Saldo (${metrics?.totalPendingUnits} unds) a Factura` : 'Como Factura'}
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <NewInvoiceContent />
    </Suspense>
  );
}
