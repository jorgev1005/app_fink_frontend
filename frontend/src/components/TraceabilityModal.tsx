'use client';

import { useState, useEffect, useMemo } from 'react';
import { traceabilityAPI } from '@/lib/api';
import Link from 'next/link';
import { 
    X, FileText, Truck, Receipt, DollarSign, ArrowDown, ChevronRight, 
    ChevronDown, CheckCircle2, Clock, AlertCircle, ExternalLink, 
    Download, RefreshCw, Layers, GitFork, ArrowRight, Eye, Calendar,
    Building2, User, PackageCheck, ShoppingBag, Undo2, RotateCcw
} from 'lucide-react';

interface TraceNode {
    id: string;
    type: 'COTIZACION' | 'ORDEN_COMPRA' | 'FACTURA_COMPRA' | 'NOTA_ENTREGA' | 'FACTURA_VENTA' | 'PAGO_COBRO' | 'DEVOLUCION_VENTA' | 'DEVOLUCION_COMPRA' | 'NOTA_CREDITO';
    stream: 'COMMERCIAL' | 'LOGISTICS' | 'FINANCIAL' | 'REVERSE';
    code: string;
    title: string;
    subtitle: string;
    status: string;
    statusLabel: string;
    statusBadge: string;
    date: string;
    amount: number;
    currency: string;
    contactName: string;
    contactTaxId?: string;
    items?: Array<{
        name: string;
        quantity: number;
        unitPrice?: number;
        subtotal?: number;
        unit?: string;
    }>;
    details?: Record<string, any>;
    parentId?: string | null;
    childrenIds?: string[];
    docId?: string;
    pdfUrl?: string;
}

interface TraceabilityData {
    anchorCode: string;
    rootNodeId: string;
    summary: {
        clientName: string;
        clientTaxId: string;
        projectName: string;
        totalQuoted: number;
        totalDeliveryNotes: number;
        totalInvoiced: number;
        totalCollected: number;
        currency: string;
        logisticsStatus: string;
        commercialStatus: string;
        totalNodesCount: number;
    };
    nodes: TraceNode[];
}

interface TraceabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDocCode: string;
}

export default function TraceabilityModal({ isOpen, onClose, initialDocCode }: TraceabilityModalProps) {
    const [currentCode, setCurrentCode] = useState(initialDocCode);
    const [searchInput, setSearchInput] = useState(initialDocCode);
    const [data, setData] = useState<TraceabilityData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});
    const [activeView, setActiveView] = useState<'TREE' | 'TIMELINE' | 'ITEMS'>('TREE');

    useEffect(() => {
        if (initialDocCode) {
            setCurrentCode(initialDocCode);
            setSearchInput(initialDocCode);
        }
    }, [initialDocCode]);

    useEffect(() => {
        if (isOpen && currentCode) {
            loadTraceability(currentCode);
        }
    }, [isOpen, currentCode]);

    const loadTraceability = async (code: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await traceabilityAPI.getTrace(code);
            if (res.data?.success) {
                setData(res.data.data);
                // Expandir por defecto el primer nodo o todos
                const exp: Record<string, boolean> = {};
                (res.data.data.nodes || []).forEach((n: TraceNode) => {
                    exp[n.id] = true;
                });
                setExpandedNodeIds(exp);
            } else {
                setError(res.data?.error?.message || 'No se pudo cargar la trazabilidad');
            }
        } catch (err: any) {
            console.error('Error cargando trazabilidad:', err);
            setError(err.response?.data?.error?.message || 'Documento no encontrado o sin trazabilidad registrada');
        } finally {
            setLoading(false);
        }
    };

    const toggleNodeExpand = (id: string) => {
        setExpandedNodeIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const expandAll = () => {
        const exp: Record<string, boolean> = {};
        (data?.nodes || []).forEach(n => { exp[n.id] = true; });
        setExpandedNodeIds(exp);
    };

    const collapseAll = () => {
        setExpandedNodeIds({});
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchInput.trim()) {
            setCurrentCode(searchInput.trim());
        }
    };

    if (!isOpen) return null;

    const getNodeStreamBadge = (stream: string) => {
        switch (stream) {
            case 'REVERSE':
                return <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-300">🔴 LOGÍSTICA INVERSA</span>;
            case 'LOGISTICS':
                return <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">🟢 VÍA LOGÍSTICA</span>;
            case 'FINANCIAL':
                return <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">🟣 VÍA TESORERÍA</span>;
            case 'COMMERCIAL':
            default:
                return <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">🔵 VÍA COMERCIAL</span>;
        }
    };

    const getNodeIcon = (type: string) => {
        switch (type) {
            case 'COTIZACION':
                return <FileText className="w-5 h-5 text-sky-600" />;
            case 'ORDEN_COMPRA':
                return <ShoppingBag className="w-5 h-5 text-indigo-600" />;
            case 'FACTURA_COMPRA':
                return <Building2 className="w-5 h-5 text-orange-600" />;
            case 'NOTA_ENTREGA':
                return <Truck className="w-5 h-5 text-purple-600" />;
            case 'FACTURA_VENTA':
                return <Receipt className="w-5 h-5 text-blue-600" />;
            case 'PAGO_COBRO':
                return <DollarSign className="w-5 h-5 text-emerald-600" />;
            case 'DEVOLUCION_VENTA':
                return <RotateCcw className="w-5 h-5 text-rose-600" />;
            case 'DEVOLUCION_COMPRA':
                return <Undo2 className="w-5 h-5 text-amber-600" />;
            case 'NOTA_CREDITO':
                return <DollarSign className="w-5 h-5 text-teal-600" />;
            default:
                return <Layers className="w-5 h-5 text-gray-600" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
                
                {/* CABECERA DEL MODAL */}
                <div className="p-4 sm:p-6 bg-slate-900 text-white flex flex-col gap-4 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <GitFork className="w-6 h-6 text-blue-400" />
                                <h2 className="text-xl sm:text-2xl font-bold">Mapa de Trazabilidad Comercial & Logística</h2>
                                <span className="text-xs bg-blue-500/30 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-400/30 font-semibold">
                                    {currentCode}
                                </span>
                            </div>
                            <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                Inspección del flujo completo desde cotización, reposición de compras, despacho en almacén hasta facturación fiscal y tesorería
                            </p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* BARRA DE BÚSQUEDA RÁPIDA / CONMUTADOR DE DOCUMENTO */}
                    <form onSubmit={handleSearchSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type="text"
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value)}
                                placeholder="Consultar otro documento (ej. COT-2026-001, NE-0001, 0204, OC-0001)..."
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Consultar
                        </button>
                    </form>

                    {/* RESUMEN EJECUTIVO KPI */}
                    {data && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-800 text-xs">
                            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Cliente</span>
                                <span className="text-white font-semibold truncate block" title={data.summary.clientName}>
                                    {data.summary.clientName}
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Cotizado</span>
                                <span className="text-sky-300 font-mono font-bold block">
                                    ${Number(data.summary.totalQuoted).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Despachado (NE)</span>
                                <span className="text-purple-300 font-mono font-bold block">
                                    ${Number(data.summary.totalDeliveryNotes).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Facturado Fiscal</span>
                                <span className="text-blue-300 font-mono font-bold block">
                                    ${Number(data.summary.totalInvoiced).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Cobrado / Pagos</span>
                                <span className="text-emerald-300 font-mono font-bold block">
                                    ${Number(data.summary.totalCollected).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                                <span className="text-slate-400 text-[10px] uppercase font-bold block">Estado Global</span>
                                <span className="text-amber-300 font-semibold truncate block">
                                    {data.summary.commercialStatus}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* BARRA DE HERRAMIENTAS Y VISTAS */}
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setActiveView('TREE')}
                            className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                                activeView === 'TREE' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <GitFork className="w-3.5 h-3.5" />
                            <span>Mapa Desplegable de Nodos</span>
                        </button>
                        <button
                            onClick={() => setActiveView('TIMELINE')}
                            className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                                activeView === 'TIMELINE' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Línea Cronológica</span>
                        </button>
                        <button
                            onClick={() => setActiveView('ITEMS')}
                            className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                                activeView === 'ITEMS' ? 'bg-white text-blue-700 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Comparativa de Productos</span>
                        </button>
                    </div>

                    {activeView === 'TREE' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={expandAll}
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                            >
                                Expandir todos
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                                onClick={collapseAll}
                                className="text-slate-600 hover:text-slate-800 font-medium hover:underline cursor-pointer"
                            >
                                Contraer todos
                            </button>
                        </div>
                    )}
                </div>

                {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-16">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-slate-500 text-sm mt-3 font-medium">Reconstruyendo la cadena comercial y logística...</span>
                        </div>
                    ) : error ? (
                        <div className="p-8 text-center bg-white rounded-xl border border-rose-200 max-w-lg mx-auto">
                            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-slate-800">Error de Trazabilidad</h3>
                            <p className="text-slate-500 text-sm mt-1">{error}</p>
                            <button
                                onClick={() => loadTraceability(currentCode)}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                            >
                                Reintentar
                            </button>
                        </div>
                    ) : !data || data.nodes.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                            <p className="text-slate-500 text-sm">No se encontraron nodos de trazabilidad vinculados a este documento.</p>
                        </div>
                    ) : activeView === 'TREE' ? (
                        /* VISTA 1: ÁRBOL / MAPA DESPLEGABLE DE NODOS */
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {data.nodes.map((node, index) => {
                                const isExpanded = Boolean(expandedNodeIds[node.id]);
                                const hasChildren = Boolean(node.childrenIds && node.childrenIds.length > 0);

                                return (
                                    <div key={node.id} className="relative">
                                        {/* Línea conectora visual */}
                                        {index > 0 && (
                                            <div className="absolute -top-4 left-6 w-0.5 h-4 bg-slate-300" />
                                        )}

                                        <div className={`bg-white rounded-xl border transition-all duration-200 shadow-xs overflow-hidden ${
                                            node.code.toLowerCase() === currentCode.toLowerCase()
                                                ? 'ring-2 ring-blue-500 border-blue-300 shadow-md'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}>
                                            {/* ENCABEZADO DEL NODO (Clickeable para desplegar) */}
                                            <div 
                                                onClick={() => toggleNodeExpand(node.id)}
                                                className="p-4 flex items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 select-none transition"
                                            >
                                                <div className="flex items-start sm:items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0 mt-0.5 sm:mt-0">
                                                        {getNodeIcon(node.type)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {getNodeStreamBadge(node.stream)}
                                                            <span className="font-mono font-bold text-gray-900 text-sm sm:text-base">
                                                                {node.code}
                                                            </span>
                                                            <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold border ${node.statusBadge}`}>
                                                                {node.statusLabel}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs font-semibold text-slate-700 mt-0.5">
                                                            {node.title}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">
                                                            {node.subtitle}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-slate-900 text-sm sm:text-base">
                                                            {Number(node.amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {node.currency}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {node.date ? new Date(node.date).toLocaleDateString('es-VE') : '-'}
                                                        </div>
                                                    </div>

                                                    <button 
                                                        type="button"
                                                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* CUERPO DESPLEGABLE DEL NODO */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3 text-xs animate-fadeIn">
                                                    {/* Contacto y Detalles */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                                                        <div>
                                                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Contacto / Titular</span>
                                                            <span className="font-semibold text-slate-800">{node.contactName}</span>
                                                            {node.contactTaxId && (
                                                                <span className="text-slate-500 font-mono text-[10.5px] block">{node.contactTaxId}</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 text-[10px] uppercase font-bold block">Detalles Clave</span>
                                                            {node.details && Object.entries(node.details).map(([k, v]) => {
                                                                if (!v || typeof v === 'object') return null;
                                                                return (
                                                                    <div key={k} className="text-slate-600">
                                                                        <span className="capitalize text-slate-400">{k}:</span> <strong className="text-slate-700">{String(v)}</strong>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Tabla de Productos / Ítems si existen */}
                                                    {node.items && node.items.length > 0 && (
                                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                            <div className="px-3 py-1.5 bg-slate-100/80 font-semibold text-slate-700 text-[11px] flex justify-between">
                                                                <span>Productos / Servicios del Documento ({node.items.length})</span>
                                                                <span>Cant. x P.Unit = Subtotal</span>
                                                            </div>
                                                            <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                                                                {node.items.map((it, iIdx) => (
                                                                    <div key={iIdx} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50">
                                                                        <div className="font-medium text-slate-800 pr-2">
                                                                            {it.name}
                                                                        </div>
                                                                        <div className="font-mono text-right text-slate-600 shrink-0">
                                                                            <span className="font-bold text-slate-800">{it.quantity} {it.unit || 'ud'}</span>
                                                                            {it.unitPrice ? (
                                                                                <span className="text-[10px] text-slate-400 ml-1.5">
                                                                                    x ${Number(it.unitPrice).toFixed(2)} = <strong>${Number(it.subtotal || it.quantity * it.unitPrice).toFixed(2)}</strong>
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Botones de acción directa del nodo */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                                        <div className="text-[11px] text-slate-500 font-medium">
                                                            {node.type === 'NOTA_ENTREGA' && !node.details?.invoicedAsCode && (
                                                                <span className="text-amber-600 font-semibold">⚠️ Nota pendiente de emisión de Factura Fiscal</span>
                                                            )}
                                                            {node.type === 'NOTA_ENTREGA' && node.details?.invoicedAsCode && (
                                                                <span className="text-indigo-600 font-semibold">✓ Facturada fiscalmente bajo #{node.details.invoicedAsCode}</span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            {node.docId && (
                                                                <Link
                                                                    href={`/invoices/${node.docId}`}
                                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700 flex items-center gap-1 transition"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    <span>Ver Registro</span>
                                                                </Link>
                                                            )}

                                                            {node.type === 'COTIZACION' && (
                                                                <Link
                                                                    href={`/quotations?search=${encodeURIComponent(node.code)}`}
                                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700 flex items-center gap-1 transition"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    <span>Ver Cotización</span>
                                                                </Link>
                                                            )}

                                                            {node.pdfUrl && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => window.open(node.pdfUrl, '_blank')}
                                                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold flex items-center gap-1 transition cursor-pointer"
                                                                >
                                                                    <Download className="w-3 h-3" />
                                                                    <span>PDF Oficial</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : activeView === 'TIMELINE' ? (
                        /* VISTA 2: LÍNEA DE TIEMPO CRONOLÓGICA */
                        <div className="max-w-2xl mx-auto space-y-4">
                            <div className="relative pl-6 border-l-2 border-blue-500/40 space-y-6">
                                {data.nodes
                                    .slice()
                                    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
                                    .map((n, idx) => (
                                        <div key={n.id} className="relative group">
                                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-xs group-hover:scale-125 transition" />
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                                                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                                    <span>{n.date ? new Date(n.date).toLocaleString('es-VE') : '-'}</span>
                                                    {getNodeStreamBadge(n.stream)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-slate-900">{n.code}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${n.statusBadge}`}>
                                                        {n.statusLabel}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-semibold text-slate-700 mt-1">{n.title}</div>
                                                <div className="text-xs text-slate-500 font-mono font-bold mt-1">
                                                    ${Number(n.amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {n.currency}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        /* VISTA 3: COMPARATIVA DE ÍTEMS Y CANTIDADES */
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-4xl mx-auto">
                            <div className="p-4 border-b border-slate-200 bg-slate-50">
                                <h4 className="font-bold text-slate-900 text-sm">Conciliación de Productos entre Etapas</h4>
                                <p className="text-slate-500 text-xs mt-0.5">Compara las cantidades cotizadas, despachadas en Notas de Entrega y facturadas fiscalmente.</p>
                            </div>
                            <div className="divide-y divide-slate-200">
                                {(() => {
                                    // Agrupar items por nombre de producto
                                    const itemMap = new Map<string, { name: string; quoted: number; dispatched: number; invoiced: number; unitPrice: number }>();
                                    
                                    data.nodes.forEach(node => {
                                        if (node.items) {
                                            node.items.forEach(it => {
                                                const key = it.name.trim().toUpperCase();
                                                const current = itemMap.get(key) || { name: it.name, quoted: 0, dispatched: 0, invoiced: 0, unitPrice: it.unitPrice || 0 };
                                                if (node.type === 'COTIZACION') current.quoted += it.quantity;
                                                if (node.type === 'NOTA_ENTREGA') current.dispatched += it.quantity;
                                                if (node.type === 'FACTURA_VENTA') current.invoiced += it.quantity;
                                                if (it.unitPrice) current.unitPrice = it.unitPrice;
                                                itemMap.set(key, current);
                                            });
                                        }
                                    });

                                    const rows = Array.from(itemMap.values());
                                    if (rows.length === 0) {
                                        return <div className="p-8 text-center text-slate-500 text-xs">No hay ítems detallados para contrastar.</div>;
                                    }

                                    return (
                                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                                                <tr>
                                                    <th className="px-4 py-2.5 text-left">Producto / Descripción</th>
                                                    <th className="px-3 py-2.5 text-right">Cotizado</th>
                                                    <th className="px-3 py-2.5 text-right">Despachado (NE)</th>
                                                    <th className="px-3 py-2.5 text-right">Facturado (Fac)</th>
                                                    <th className="px-4 py-2.5 text-center">Estado Conciliación</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium">
                                                {rows.map((row, rIdx) => {
                                                    const isBalanced = (row.dispatched >= row.quoted && row.quoted > 0) || (row.invoiced >= row.dispatched && row.dispatched > 0);
                                                    return (
                                                        <tr key={rIdx} className="hover:bg-slate-50">
                                                            <td className="px-4 py-3 text-slate-800 font-medium">{row.name}</td>
                                                            <td className="px-3 py-3 text-right font-mono text-sky-700 font-bold">{row.quoted} uds</td>
                                                            <td className="px-3 py-3 text-right font-mono text-purple-700 font-bold">{row.dispatched} uds</td>
                                                            <td className="px-3 py-3 text-right font-mono text-blue-700 font-bold">{row.invoiced} uds</td>
                                                            <td className="px-4 py-3 text-center">
                                                                {row.dispatched >= row.quoted && row.quoted > 0 ? (
                                                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">✓ 100% Despachado</span>
                                                                ) : row.dispatched > 0 ? (
                                                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Despacho Parcial</span>
                                                                ) : (
                                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Pendiente</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center text-xs">
                    <div className="text-slate-500">
                        {data?.nodes?.length ? (
                            <span>Cadena con <strong>{data.nodes.length}</strong> documentos/hitos interconectados</span>
                        ) : null}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition cursor-pointer"
                    >
                        Cerrar Mapa
                    </button>
                </div>

            </div>
        </div>
    );
}
