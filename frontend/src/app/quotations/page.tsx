"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, CheckCircle2, Clock, XCircle, ShoppingBag, Truck, Search, 
  Filter, Eye, ArrowLeft, RefreshCw, MessageSquare, Phone, MapPin, 
  Building2, UserCheck, AlertCircle, Plus, Send, ExternalLink, 
  ChevronRight, ArrowRight, Download, Check, X, Package, DollarSign, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import api, { apiClient } from '@/lib/api';

interface QuotationItem {
  sku?: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPriceUSD: number;
  unitPriceBs?: number;
  subtotalUSD: number;
  subtotalBs?: number;
  costPrice?: number;
  stockAvailable?: number;
  empaqueCantidad?: number;
  medidas?: string;
  division?: string;
  notes?: string;
  quotedQuantity?: number;
  dispatchedQuantity?: number;
  pendingQuantity?: number;
}

interface Quotation {
  id: string;
  correlative: string;
  createdAt: string;
  channel: 'CATALOGO_WEB' | 'FINK_POS' | string;
  status: 'PENDING' | 'APPROVED' | 'PO_GENERATED' | 'INVOICED' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED' | 'REJECTED' | string;
  customer: {
    name: string;
    taxId?: string;
    phone?: string;
    email?: string;
    city?: string;
    seller?: string;
    gpsCoordinates?: string;
    gpsMapsUrl?: string;
    emissionPlace?: string;
  };
  paymentMethod?: string;
  rates?: {
    bcv: number;
    paralelo?: number;
    eur?: number;
  };
  items: QuotationItem[];
  totalUSD: number;
  totalBs?: number;
  notes?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;
  purchaseOrderNumber?: string;
  supplierName?: string;
  rejectionReason?: string;
  relatedInvoices?: any[];
  dispatchMetrics?: {
    totalQuotedUnits: number;
    totalDispatchedUnits: number;
    totalPendingUnits: number;
    relatedInvoicesCount: number;
  };
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    poGenerated: 0,
    invoiced: 0,
    rejected: 0,
  });

  // Modal Detalle
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Modal Aprobación
  const [quoteToApprove, setQuoteToApprove] = useState<Quotation | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approving, setApproving] = useState(false);

  // Modal Rechazo
  const [quoteToReject, setQuoteToReject] = useState<Quotation | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Modal Generador de Orden de Compra (OC)
  const [showPOModal, setShowPOModal] = useState(false);
  const [poQuote, setPoQuote] = useState<Quotation | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poSupplierName, setPoSupplierName] = useState('SOLO MAYOR');
  const [poSupplierTaxId, setPoSupplierTaxId] = useState('');
  const [poSupplierPhone, setPoSupplierPhone] = useState('');
  const [poSupplierAddress, setPoSupplierAddress] = useState('');
  const [poDeliveryAddress, setPoDeliveryAddress] = useState('Almacén Principal La Victoria, Aragua');
  const [poExpectedDate, setPoExpectedDate] = useState('Inmediata / 24-48 horas');
  const [poPaymentTerms, setPoPaymentTerms] = useState('Contado / Según acuerdo comercial');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<Array<QuotationItem & { selected: boolean; orderCost: number }>>([]);
  const [generatingPO, setGeneratingPO] = useState(false);

  useEffect(() => {
    loadQuotations();
    loadSuppliers();
  }, [statusFilter, channelFilter]);

  const loadSuppliers = async () => {
    try {
      const res = await api.contacts.getAll();
      setSuppliers(res.data.data || []);
    } catch (e) {
      console.warn('Error loading suppliers', e);
    }
  };

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (channelFilter !== 'ALL') params.channel = channelFilter;
      if (search.trim()) params.search = search.trim();

      const res = await (api as any).quotations.getAll(params);
      if (res.data?.success) {
        setQuotations(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      } else if (Array.isArray(res.data)) {
        setQuotations(res.data);
      }
    } catch (err: any) {
      console.error('Error al cargar cotizaciones:', err);
      const msg = err.response?.data?.error?.message || err.message || 'Error al cargar cotizaciones';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQuotations();
  };

  // Abrir detalle completo
  const openDetail = async (quote: Quotation) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const res = await (api as any).quotations.getById(quote.id || quote.correlative);
      if (res.data?.success) {
        setSelectedQuote(res.data.data);
      } else {
        setSelectedQuote(quote);
      }
    } catch (e) {
      setSelectedQuote(quote);
    } finally {
      setDetailLoading(false);
    }
  };

  // Confirmar Aprobación
  const executeApproval = async () => {
    if (!quoteToApprove) return;
    setApproving(true);
    try {
      const res = await (api as any).quotations.updateStatus(quoteToApprove.id || quoteToApprove.correlative, {
        status: 'APPROVED',
        notes: approvalNotes.trim() || 'Aprobada por el cliente'
      });
      if (res.data?.success) {
        toast.success(`Cotización ${quoteToApprove.correlative} APROBADA con éxito`);
        setQuoteToApprove(null);
        setApprovalNotes('');
        loadQuotations();
        if (selectedQuote && selectedQuote.correlative === quoteToApprove.correlative) {
          setSelectedQuote(res.data.data);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al aprobar cotización');
    } finally {
      setApproving(false);
    }
  };

  // Confirmar Rechazo
  const executeRejection = async () => {
    if (!quoteToReject) return;
    setRejecting(true);
    try {
      const res = await (api as any).quotations.updateStatus(quoteToReject.id || quoteToReject.correlative, {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim() || 'Rechazada por el cliente'
      });
      if (res.data?.success) {
        toast.success(`Cotización ${quoteToReject.correlative} marcada como Rechazada`);
        setQuoteToReject(null);
        setRejectionReason('');
        loadQuotations();
        if (selectedQuote && selectedQuote.correlative === quoteToReject.correlative) {
          setSelectedQuote(res.data.data);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al rechazar cotización');
    } finally {
      setRejecting(false);
    }
  };

  // Abrir Modal de Orden de Compra desde Cotización
  const openPOModal = async (quote: Quotation) => {
    setPoQuote(quote);
    setPoNotes(`Abastecimiento para Cotización ${quote.correlative} - Cliente: ${quote.customer?.name || 'Particular'}`);
    
    // Obtener ítems enriquecidos con su costo
    try {
      const res = await (api as any).quotations.getById(quote.id || quote.correlative);
      const enrichedQuote = res.data?.success ? res.data.data : quote;
      
      const itemsPrepared = (enrichedQuote.items || []).map((it: QuotationItem) => ({
        ...it,
        selected: true,
        orderCost: it.costPrice && it.costPrice > 0 ? it.costPrice : Number((it.unitPriceUSD * 0.85).toFixed(2))
      }));
      setPoItems(itemsPrepared);
    } catch (e) {
      const itemsPrepared = (quote.items || []).map((it: QuotationItem) => ({
        ...it,
        selected: true,
        orderCost: it.costPrice && it.costPrice > 0 ? it.costPrice : Number((it.unitPriceUSD * 0.85).toFixed(2))
      }));
      setPoItems(itemsPrepared);
    }

    setShowPOModal(true);
  };

  const handleSelectSupplierInPO = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    if (!supplierId) return;
    const supp = suppliers.find(s => s.id === supplierId);
    if (supp) {
      setPoSupplierName(supp.name);
      setPoSupplierTaxId(supp.taxId || '');
      setPoSupplierPhone(supp.phone || '');
      setPoSupplierAddress(supp.address || '');
    }
  };

  // Ejecutar generación de Orden de Compra PDF
  const handleExecuteGeneratePO = async (action: 'view' | 'download' | 'whatsapp') => {
    if (!poQuote) return;
    const selectedList = poItems.filter(i => i.selected);
    if (selectedList.length === 0) {
      toast.error('Debe seleccionar al menos un producto para incluir en la Orden de Compra');
      return;
    }

    setGeneratingPO(true);
    try {
      const payload = {
        supplierName: poSupplierName.trim() || 'SOLO MAYOR / PROVEEDOR',
        supplierTaxId: poSupplierTaxId.trim() || undefined,
        supplierPhone: poSupplierPhone.trim() || undefined,
        supplierAddress: poSupplierAddress.trim() || undefined,
        deliveryAddress: poDeliveryAddress.trim() || undefined,
        expectedDate: poExpectedDate.trim() || undefined,
        paymentTerms: poPaymentTerms.trim() || undefined,
        notes: poNotes.trim() || undefined,
        selectedItems: selectedList.map(i => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit || 'UNIDAD',
          costPrice: i.orderCost,
          empaqueCantidad: i.empaqueCantidad,
          medidas: i.medidas,
          notes: i.notes
        }))
      };

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/backend-api/api/quotations/${poQuote.id || poQuote.correlative}/generate-po`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Error al generar la Orden de Compra');
      }

      const orderNumber = res.headers.get('X-Order-Number') || 'OC-OFICIAL';
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      if (action === 'download') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${orderNumber}_${poSupplierName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`📥 Orden de Compra ${orderNumber} descargada`);
      } else if (action === 'whatsapp') {
        const phoneClean = (poSupplierPhone || '').replace(/[^0-9]/g, '');
        const totalPOCost = selectedList.reduce((acc, item) => acc + (item.orderCost * item.quantity), 0);
        const textMsg = `Estimados *${poSupplierName}*, adjuntamos nuestra *Orden de Compra Formal (${orderNumber})* con ${selectedList.length} renglones por un total de *$USD ${totalPOCost.toFixed(2)}*. Favor confirmar disponibilidad para despacho.`;
        const waUrl = phoneClean 
          ? `https://wa.me/${phoneClean.startsWith('58') ? phoneClean : '58' + phoneClean.replace(/^0+/, '')}?text=${encodeURIComponent(textMsg)}`
          : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
        
        window.open(waUrl, '_blank');
        window.open(blobUrl, '_blank');
        toast.success(`📲 Abriendo WhatsApp y Orden ${orderNumber}`);
      } else {
        window.open(blobUrl, '_blank');
        toast.success(`👁️ Abriendo Orden de Compra ${orderNumber}`);
      }

      setShowPOModal(false);
      loadQuotations();
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir orden de compra');
    } finally {
      setGeneratingPO(false);
    }
  };

  // Pasar a Facturación / Caja POS
  const handleTransferToPOS = (quote: Quotation) => {
    try {
      const posPayload = {
        clientName: quote.customer?.name || '',
        clientTaxId: quote.customer?.taxId || '',
        clientPhone: quote.customer?.phone || '',
        clientEmail: quote.customer?.email || '',
        items: (quote.items || []).map(i => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPriceUSD,
          unit: i.unit || 'UNIDAD',
        })),
        originQuoteCorrelative: quote.correlative
      };
      localStorage.setItem('aludra_pos_prefill', JSON.stringify(posPayload));
      toast.success(`Cotización ${quote.correlative} transferida a Caja POS`);
      router.push('/pos');
    } catch (e) {
      toast.error('Error al transferir a POS');
    }
  };

  const getStatusBadge = (status: string, quote?: Quotation) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            APROBADA
          </span>
        );
      case 'PO_GENERATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Truck size={13} className="text-blue-600" />
            EN COMPRAS (OC)
          </span>
        );
      case 'PARTIALLY_INVOICED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock size={13} className="text-amber-700" />
            DESPACHO PARCIAL
          </span>
        );
      case 'FULLY_INVOICED':
      case 'INVOICED': {
        const related = quote?.relatedInvoices || [];
        const isOnlyDelivery = related.length > 0 && related.every((inv: any) => (inv.code || '').startsWith('NE-'));
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            {isOnlyDelivery ? <Truck size={13} className="text-purple-600" /> : <FileText size={13} className="text-purple-600" />}
            {isOnlyDelivery ? 'DESPACHADA TOTAL' : 'FACTURADA TOTAL'}
          </span>
        );
      }
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle size={13} className="text-rose-600" />
            RECHAZADA
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={13} className="text-amber-600" />
            EMITIDA / PENDIENTE
          </span>
        );
    }
  };

  // Cálculos dinámicos en el modal de Orden de Compra
  const selectedPOItems = poItems.filter(i => i.selected);
  const totalSaleSelected = selectedPOItems.reduce((acc, i) => acc + (i.unitPriceUSD * i.quantity), 0);
  const totalCostSelected = selectedPOItems.reduce((acc, i) => acc + (i.orderCost * i.quantity), 0);
  const projectedProfit = totalSaleSelected - totalCostSelected;
  const projectedMarginPct = totalSaleSelected > 0 ? (projectedProfit / totalSaleSelected) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 text-slate-800 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-xs"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileText className="text-blue-600" size={28} />
              Gestión de Cotizaciones y Compras
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              Flujo unificado: Catálogo Web ➔ Aprobación de Cliente ➔ Órdenes de Compra a Proveedores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => router.push('/pos')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs font-semibold text-xs transition-all cursor-pointer"
          >
            <ShoppingBag size={16} />
            Caja POS
          </button>
          <button 
            onClick={() => router.push('/inventory')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-xs font-semibold text-xs transition-all cursor-pointer"
          >
            <Package size={16} />
            Inventario
          </button>
          <button 
            onClick={loadQuotations}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all shadow-xs text-slate-600 cursor-pointer"
            title="Recargar cotizaciones"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${statusFilter === 'ALL' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/80'}`}
        >
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Emitidas</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Todas las cotizaciones</div>
        </div>

        <div 
          onClick={() => setStatusFilter('PENDING')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${statusFilter === 'PENDING' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200/80'}`}
        >
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Clock size={12} /> Pendientes
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{stats.pending}</div>
          <div className="text-[10px] text-amber-600/80 mt-0.5">Esperando visto bueno</div>
        </div>

        <div 
          onClick={() => setStatusFilter('APPROVED')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${statusFilter === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80'}`}
        >
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={12} /> Aprobadas
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.approved}</div>
          <div className="text-[10px] text-emerald-600/80 mt-0.5">Listas para OC o Factura</div>
        </div>

        <div 
          onClick={() => setStatusFilter('PO_GENERATED')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${statusFilter === 'PO_GENERATED' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200/80'}`}
        >
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
            <Truck size={12} /> En Compras (OC)
          </div>
          <div className="text-2xl font-extrabold text-blue-700 mt-1">{stats.poGenerated}</div>
          <div className="text-[10px] text-blue-600/80 mt-0.5">Orden enviada a fábrica</div>
        </div>

        <div 
          onClick={() => setStatusFilter('INVOICED')}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${statusFilter === 'INVOICED' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200/80'}`}
        >
          <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
            <FileText size={12} /> Facturadas / Despachadas
          </div>
          <div className="text-2xl font-extrabold text-purple-700 mt-1">{stats.invoiced}</div>
          <div className="text-[10px] text-purple-600/80 mt-0.5">Notas o facturas emitidas</div>
        </div>
      </div>

      {/* 3. Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Pestañas de Estado */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'Todas' },
            { id: 'PENDING', label: 'Pendientes' },
            { id: 'APPROVED', label: 'Aprobadas' },
            { id: 'PO_GENERATED', label: 'En Compras (OC)' },
            { id: 'INVOICED', label: 'Facturadas / Despachadas' },
            { id: 'REJECTED', label: 'Rechazadas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${statusFilter === tab.id ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar por correlativo, cliente, teléfono, RIF o vendedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
            />
          </div>
          <button 
            type="submit"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* 4. Tabla de Cotizaciones */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                <th className="p-3.5 pl-4">Correlativo / Canal</th>
                <th className="p-3.5">Cliente / Contacto</th>
                <th className="p-3.5">Vendedor / Destino</th>
                <th className="p-3.5 text-center">Ítems</th>
                <th className="p-3.5 text-right">Total ($ USD / Bs)</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 pr-4 text-right">Acciones Comerciales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline mr-2" size={18} /> Cargando cotizaciones...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <FileText className="mx-auto text-slate-300 mb-2" size={36} />
                    No se encontraron cotizaciones con los filtros actuales
                  </td>
                </tr>
              ) : (
                quotations.map((q) => {
                  const itemsCount = q.items ? q.items.length : 0;
                  const totalQty = q.items ? q.items.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0) : 0;
                  const isApproved = q.status === 'APPROVED';
                  const isPO = q.status === 'PO_GENERATED';
                  const isPending = !q.status || q.status === 'PENDING';

                  return (
                    <tr key={q.id || q.correlative} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Correlativo y Canal */}
                      <td className="p-3.5 pl-4 font-mono">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          {q.correlative || q.id}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${q.channel === 'CATALOGO_WEB' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                            {q.channel === 'CATALOGO_WEB' ? '🌐 Catálogo Web' : '🏪 FINK POS'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            {new Date(q.createdAt).toLocaleDateString('es-VE')}
                          </span>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {q.customer?.name || 'Cliente Particular'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                          {q.customer?.taxId && <span className="font-mono">{q.customer.taxId}</span>}
                          {q.customer?.phone && (
                            <a 
                              href={`https://wa.me/${q.customer.phone.replace(/[^0-9]/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 font-medium"
                            >
                              <Phone size={11} /> {q.customer.phone}
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Vendedor y Destino */}
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <UserCheck size={12} className="text-blue-500" />
                          {q.customer?.seller || 'Oficina'}
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{q.customer?.city || 'La Victoria'}</span>
                          {q.customer?.gpsMapsUrl && (
                            <a 
                              href={q.customer.gpsMapsUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              title="Ver ubicación GPS exacta de entrega"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Ítems */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold text-slate-800">{itemsCount}</span>
                        <span className="text-[10px] text-slate-400 block font-normal">({totalQty} u)</span>
                      </td>

                      {/* Total */}
                      <td className="p-3.5 text-right">
                        <div className="font-extrabold text-slate-900 text-sm">
                          ${Number(q.totalUSD || 0).toFixed(2)}
                        </div>
                        {q.totalBs && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Bs {Number(q.totalBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(q.status, q)}
                          {Boolean(q.dispatchMetrics && q.dispatchMetrics.relatedInvoicesCount > 0) && (
                            <span className="text-[9.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {q.dispatchMetrics!.totalDispatchedUnits}/{q.dispatchMetrics!.totalQuotedUnits} despachadas
                            </span>
                          )}
                          {Array.isArray(q.relatedInvoices) && q.relatedInvoices.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 max-w-[150px]">
                              {q.relatedInvoices.map((inv: any) => (
                                <Link
                                  key={inv.id || inv.code}
                                  href={`/invoices?search=${encodeURIComponent(inv.code)}`}
                                  className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1 py-0.5 rounded transition"
                                  title={`Ver documento emitido ${inv.code}`}
                                >
                                  {inv.code}
                                </Link>
                              ))}
                            </div>
                          )}
                          {q.purchaseOrderNumber && (
                            <div className="text-[9px] font-mono text-blue-700 font-bold">
                              OC: {q.purchaseOrderNumber}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botón Ver Detalle */}
                          <button
                            onClick={() => openDetail(q)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Ver Detalle y Desglose"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Botón Emitir Nota de Entrega */}
                          <button
                            onClick={() => router.push(`/invoices/new?fromQuotation=${encodeURIComponent(q.correlative || q.id)}&isDeliveryNote=true`)}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                            title="Emitir Nota de Entrega a partir de esta cotización"
                          >
                            <FileText size={12} />
                            Nota
                          </button>

                          {/* Botón Facturar Venta */}
                          <button
                            onClick={() => router.push(`/invoices/new?fromQuotation=${encodeURIComponent(q.correlative || q.id)}&isDeliveryNote=false`)}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                            title="Emitir Factura formal a partir de esta cotización"
                          >
                            <DollarSign size={12} />
                            Factura
                          </button>

                          {/* Botón Aprobar (Si está pendiente) */}
                          {isPending && (
                            <button
                              onClick={() => { setQuoteToApprove(q); setApprovalNotes(''); }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                              title="Marcar como Aprobada por el Cliente"
                            >
                              <Check size={13} />
                              Aprobar
                            </button>
                          )}

                          {/* Botón Generar OC (Si está aprobada o en compras) */}
                          {(isApproved || isPO) && (
                            <button
                              onClick={() => openPOModal(q)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                              title="Emitir Orden de Compra formal al Proveedor"
                            >
                              <Truck size={13} />
                              {isPO ? 'Re-emitir OC' : 'Generar OC'}
                            </button>
                          )}

                          {/* Botón Pasar a Caja POS */}
                          {isApproved && (
                            <button
                              onClick={() => handleTransferToPOS(q)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] shadow-2xs transition-all cursor-pointer"
                              title="Cobrar / Facturar en Caja POS"
                            >
                              <ShoppingBag size={13} />
                              POS
                            </button>
                          )}

                          {/* Botón Rechazar (Si está pendiente) */}
                          {isPending && (
                            <button
                              onClick={() => { setQuoteToReject(q); setRejectionReason(''); }}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Rechazar / Cancelar"
                            >
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          MODAL 1: DETALLE DE COTIZACIÓN
      ──────────────────────────────────────────────────────────── */}
      {showDetailModal && selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/40 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Cabecera Modal */}
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-black font-mono tracking-tight text-white">
                    {selectedQuote.correlative || selectedQuote.id}
                  </h3>
                  {getStatusBadge(selectedQuote.status, selectedQuote)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Emitida el {new Date(selectedQuote.createdAt).toLocaleString('es-VE')} ({selectedQuote.channel === 'CATALOGO_WEB' ? 'Catálogo Web' : 'FINK POS'})
                </p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Bloque de Información del Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Cliente / Empresa</div>
                  <div className="font-extrabold text-slate-900 text-sm mt-0.5">{selectedQuote.customer?.name}</div>
                  <div className="text-slate-500 font-mono mt-0.5">{selectedQuote.customer?.taxId || 'Sin RIF'}</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Contacto & Ubicación</div>
                  <div className="text-slate-800 font-medium mt-0.5 flex items-center gap-1">
                    <Phone size={12} className="text-emerald-600" /> {selectedQuote.customer?.phone || 'N/A'}
                  </div>
                  <div className="text-slate-600 mt-0.5 flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400" /> {selectedQuote.customer?.city || 'Retiro en Sede'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Condiciones Comerciales</div>
                  <div className="text-slate-800 font-medium mt-0.5">
                    Asesor: <span className="font-bold text-blue-600">{selectedQuote.customer?.seller || 'Oficina'}</span>
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    Tasa BCV: <span className="font-mono font-bold">Bs. {Number(selectedQuote.rates?.bcv || 785).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Documentos Emitidos (Notas de Entrega y Facturas) */}
              {Array.isArray(selectedQuote.relatedInvoices) && selectedQuote.relatedInvoices.length > 0 && (
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600" />
                      Documentos Emitidos para esta Cotización ({selectedQuote.relatedInvoices.length})
                    </h4>
                    {selectedQuote.dispatchMetrics && (
                      <span className="text-xs font-bold text-indigo-800 bg-indigo-100/90 border border-indigo-200 px-3 py-1 rounded-full w-fit">
                        📦 {selectedQuote.dispatchMetrics.totalDispatchedUnits} de {selectedQuote.dispatchMetrics.totalQuotedUnits} unds despachadas ({selectedQuote.dispatchMetrics.totalPendingUnits} pendientes)
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-indigo-100 bg-white rounded-xl border border-indigo-200/80 overflow-hidden shadow-2xs">
                    {selectedQuote.relatedInvoices.map((inv: any) => (
                      <div key={inv.id || inv.code} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-indigo-50/30 transition">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono font-bold text-xs text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {inv.code}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {inv.code?.startsWith('NE') ? 'Nota de Entrega' : 'Factura de Venta'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(inv.issueDate || inv.createdAt).toLocaleDateString('es-VE')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            ${Number(inv.total || 0).toFixed(2)} {inv.currency || 'USD'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            inv.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {inv.status === 'PAID' ? 'PAGADA' : inv.status === 'CANCELLED' ? 'ANULADA' : 'POR COBRAR'}
                          </span>
                          <Link
                            href={`/invoices?search=${encodeURIComponent(inv.code)}`}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                          >
                            Ver en Facturación
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla de Productos Cotizados */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm">
                  <Package size={16} className="text-blue-600" />
                  Renglones Cotizados ({selectedQuote.items?.length || 0} ítems)
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3 text-center">Cant. Cotizada</th>
                        <th className="p-3 text-center">Despachado Previo</th>
                        <th className="p-3 text-center">Saldo Pendiente</th>
                        <th className="p-3 text-right">P. Venta ($)</th>
                        <th className="p-3 text-right">Subtotal ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedQuote.items?.map((it, idx) => {
                        const quoted = it.quotedQuantity !== undefined ? it.quotedQuantity : it.quantity;
                        const dispatched = it.dispatchedQuantity || 0;
                        const pending = it.pendingQuantity !== undefined ? it.pendingQuantity : Math.max(0, quoted - dispatched);

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-mono text-slate-500">{it.sku || 'N/A'}</td>
                            <td className="p-3 font-medium text-slate-900">{it.name}</td>
                            <td className="p-3 text-center font-bold text-slate-800">{quoted} {it.unit || 'u'}</td>
                            <td className="p-3 text-center">
                              <span className={`font-mono font-bold ${dispatched > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {dispatched}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                pending === 0 && quoted > 0 ? 'bg-emerald-100 text-emerald-800' :
                                pending < quoted && pending > 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {pending === 0 && quoted > 0 ? '✅ 0 (Listo)' : `${pending} pend.`}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono">${Number(it.unitPriceUSD || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              ${Number((it.unitPriceUSD || 0) * (it.quantity || 1)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales y Márgenes */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Liquidación Bolívares (BCV)</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    Bs {Number(selectedQuote.totalBs || (selectedQuote.totalUSD * (selectedQuote.rates?.bcv || 785))).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Cotización Venta</div>
                  <div className="text-2xl font-black font-mono text-white">
                    ${Number(selectedQuote.totalUSD || 0).toFixed(2)} USD
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => window.open(`/backend-api/api/quotations/${selectedQuote.correlative || selectedQuote.id}/pdf`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                <Eye size={16} className="text-emerald-400" />
                Ver PDF de Cotización
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/invoices/new?fromQuotation=${encodeURIComponent(selectedQuote.correlative || selectedQuote.id)}&isDeliveryNote=true`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
                  title="Emitir Nota de Entrega enlazada"
                >
                  <FileText size={15} />
                  Nota de Entrega
                </button>

                <button
                  onClick={() => router.push(`/invoices/new?fromQuotation=${encodeURIComponent(selectedQuote.correlative || selectedQuote.id)}&isDeliveryNote=false`)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
                  title="Emitir Factura de Venta enlazada"
                >
                  <DollarSign size={15} />
                  Factura de Venta
                </button>

                {selectedQuote.status === 'PENDING' && (
                  <button
                    onClick={() => { setShowDetailModal(false); setQuoteToApprove(selectedQuote); }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Check size={16} />
                    Aprobar Cotización
                  </button>
                )}

                <button
                  onClick={() => { setShowDetailModal(false); openPOModal(selectedQuote); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                >
                  <Truck size={16} />
                  Generar Orden de Compra (OC)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          MODAL 2: APROBACIÓN DE COTIZACIÓN
      ──────────────────────────────────────────────────────────── */}
      {quoteToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/40 p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Aprobar Cotización</h3>
            <p className="text-xs text-slate-500 mt-1">
              Confirma la aprobación del cliente para la cotización <strong className="font-mono text-slate-800">{quoteToApprove.correlative}</strong> por un total de <strong>${Number(quoteToApprove.totalUSD).toFixed(2)} USD</strong>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Notas de Aprobación (Opcional):</label>
              <textarea
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                placeholder="Ej: Aprobado vía WhatsApp por el cliente Carlos. Requiere entrega el viernes."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-20"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setQuoteToApprove(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={executeApproval}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {approving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={16} />}
                Confirmar Aprobación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          MODAL 3: RECHAZO DE COTIZACIÓN
      ──────────────────────────────────────────────────────────── */}
      {quoteToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/40 p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <XCircle size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Rechazar Cotización</h3>
            <p className="text-xs text-slate-500 mt-1">
              ¿Deseas marcar la cotización <strong className="font-mono text-slate-800">{quoteToReject.correlative}</strong> como rechazada?
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Motivo del Rechazo:</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Ej: Precio fuera de presupuesto / Compró a otro proveedor..."
                className="w-full border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 outline-none resize-none h-20"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setQuoteToReject(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={executeRejection}
                disabled={rejecting}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {rejecting ? <RefreshCw className="animate-spin" size={14} /> : <X size={16} />}
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────
          MODAL 4: ASISTENTE DE ORDEN DE COMPRA (OC) A PROVEEDOR
      ──────────────────────────────────────────────────────────── */}
      {showPOModal && poQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/40 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-800 text-blue-200 rounded-xl">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Generar Orden de Compra Formal a Proveedor
                  </h3>
                  <p className="text-xs text-blue-200">
                    Abastecimiento derivado de Cotización <span className="font-mono font-bold text-white">{poQuote.correlative}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPOModal(false)}
                className="p-2 hover:bg-blue-800 rounded-full text-blue-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Selección de Proveedor */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  Datos del Proveedor Destinatario
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Seleccionar Contacto Proveedor</label>
                    <select
                      value={selectedSupplierId}
                      onChange={e => handleSelectSupplierInPO(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Proveedor Directo (Manual)...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.taxId ? `(${s.taxId})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Razón Social Proveedor *</label>
                    <input
                      type="text"
                      value={poSupplierName}
                      onChange={e => setPoSupplierName(e.target.value)}
                      placeholder="Ej: SOLO MAYOR / IMPORTADORA..."
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Teléfono / WhatsApp Proveedor</label>
                    <input
                      type="text"
                      value={poSupplierPhone}
                      onChange={e => setPoSupplierPhone(e.target.value)}
                      placeholder="Ej: 04122711859"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Dirección de Entrega / Despacho Almacén</label>
                    <input
                      type="text"
                      value={poDeliveryAddress}
                      onChange={e => setPoDeliveryAddress(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Plazo de Entrega y Pago</label>
                    <input
                      type="text"
                      value={poExpectedDate}
                      onChange={e => setPoExpectedDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Selección y Ajuste de Productos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Package size={16} className="text-blue-600" />
                    Productos a Solicitar al Proveedor
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Marca los productos que corresponden a este proveedor
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                        <th className="p-3 w-10 text-center">Pedir</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3 text-center w-24">Cant.</th>
                        <th className="p-3 text-right w-28">Costo Compra ($)</th>
                        <th className="p-3 text-right w-28">Subtotal Compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {poItems.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${item.selected ? '' : 'opacity-40 bg-slate-50/50'}`}>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={e => {
                                const copy = [...poItems];
                                copy[idx].selected = e.target.checked;
                                setPoItems(copy);
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono text-slate-500">{item.sku || 'N/A'}</td>
                          <td className="p-3 font-medium text-slate-900">{item.name}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => {
                                const copy = [...poItems];
                                copy[idx].quantity = parseFloat(e.target.value) || 1;
                                setPoItems(copy);
                              }}
                              className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.orderCost}
                              onChange={e => {
                                const copy = [...poItems];
                                copy[idx].orderCost = parseFloat(e.target.value) || 0;
                                setPoItems(copy);
                              }}
                              className="w-20 border border-slate-200 rounded-lg p-1 text-right font-mono font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            ${Number((item.orderCost || 0) * (item.quantity || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen Financiero y de Margen Proyectado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900 text-white p-4 rounded-2xl">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Venta al Cliente</div>
                  <div className="text-xl font-bold font-mono text-white mt-0.5">
                    ${totalSaleSelected.toFixed(2)} USD
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total Costo de Compra (OC)</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                    ${totalCostSelected.toFixed(2)} USD
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Utilidad Proyectada</div>
                  <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                    +${projectedProfit.toFixed(2)} USD ({projectedMarginPct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>

            {/* Footer con Acciones */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setShowPOModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleExecuteGeneratePO('view')}
                  disabled={generatingPO || selectedPOItems.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Eye size={15} />
                  Ver PDF
                </button>

                <button
                  onClick={() => handleExecuteGeneratePO('download')}
                  disabled={generatingPO || selectedPOItems.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Download size={15} />
                  Descargar PDF
                </button>

                <button
                  onClick={() => handleExecuteGeneratePO('whatsapp')}
                  disabled={generatingPO || selectedPOItems.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Send size={15} />
                  Enviar WhatsApp al Proveedor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
