'use client';

import { useState, useEffect, useRef } from 'react';
import api, { projectsAPI } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, AlertCircle, Calendar, CheckCircle2, Search, X, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';

const calculateDueStatus = (dueDateStr?: string, status?: string) => {
    if (!dueDateStr) return null;
    if (status === 'PAID') {
        return { label: 'Pagada', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (status === 'CANCELLED') {
        return { label: 'Anulada', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
    const due = new Date(dueDateStr);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { 
            label: `Vencida hace ${Math.abs(diffDays)}d`, 
            diffDays, 
            isOverdue: true, 
            badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' 
        };
    } else if (diffDays === 0) {
        return { 
            label: 'Vence hoy', 
            diffDays, 
            isToday: true, 
            badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 font-bold' 
        };
    } else {
        return { 
            label: `Vence en ${diffDays}d`, 
            diffDays, 
            isPending: true, 
            badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium' 
        };
    }
};

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [originFilter, setOriginFilter] = useState('');
    const [dueFilter, setDueFilter] = useState('');
    const [search, setSearch] = useState('');
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const scrollHorizontal = (direction: 'left' | 'right' | 'end') => {
        if (!tableContainerRef.current) return;
        if (direction === 'left') {
            tableContainerRef.current.scrollBy({ left: -380, behavior: 'smooth' });
        } else if (direction === 'right') {
            tableContainerRef.current.scrollBy({ left: 380, behavior: 'smooth' });
        } else if (direction === 'end') {
            tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [invRes, projRes] = await Promise.all([
                api.invoices.getAll(),
                projectsAPI.getAll().catch(() => ({ data: { data: [] } }))
            ]);

            const list = invRes.data.data ? invRes.data.data : (Array.isArray(invRes.data) ? invRes.data : []);
            const projList = projRes.data.data ? projRes.data.data : (Array.isArray(projRes.data) ? projRes.data : []);
            
            setInvoices(list);
            setProjects(projList);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este documento permanentemente? Esta acción revertirá cualquier efecto contable o de inventario asociado.')) {
            return;
        }
        try {
            await api.invoices.delete(id);
            setInvoices(prev => prev.filter(inv => inv.id !== id));
            alert('Documento eliminado correctamente.');
        } catch (error) {
            console.error(error);
            alert('Error al eliminar. Revisa la consola para más detalles.');
        }
    };

    const filtered = invoices.filter(inv => {
        if (projectFilter && inv.projectId !== projectFilter) return false;
        if (statusFilter && inv.status !== statusFilter) return false;
        
        if (originFilter === 'PURCHASE' && inv.type !== 'BILL' && !inv.code?.startsWith('OC-')) return false;
        if (originFilter === 'POS' && !inv.code?.startsWith('POS-')) return false;
        if (originFilter === 'DELIVERY_NOTE' && !inv.code?.startsWith('NE')) return false;
        if (originFilter === 'STANDARD' && (inv.code?.startsWith('POS-') || inv.code?.startsWith('NE') || inv.type === 'BILL' || inv.code?.startsWith('OC-'))) return false;

        if (dueFilter) {
            const dueInfo = calculateDueStatus(inv.dueDate, inv.status);
            if (dueFilter === 'OVERDUE' && !dueInfo?.isOverdue) return false;
            if (dueFilter === 'TODAY' && !dueInfo?.isToday) return false;
            if (dueFilter === 'UPCOMING' && (!dueInfo?.isPending || (dueInfo?.diffDays !== undefined && dueInfo.diffDays > 7))) return false;
            if (dueFilter === 'PAID' && inv.status !== 'PAID') return false;
        }

        if (search) {
             const term = search.toLowerCase();
             const codeMatch = inv.code?.toLowerCase().includes(term);
             const poMatch = inv.purchaseOrder?.toLowerCase().includes(term);
             const notesMatch = inv.notes?.toLowerCase().includes(term);
             const name = inv.clientName || inv.contact?.name || inv.vendor?.name || inv.contactName || '';
             const nameMatch = name.toLowerCase().includes(term);
             const projectMatch = (inv.project?.name || '').toLowerCase().includes(term);
             return codeMatch || poMatch || notesMatch || nameMatch || projectMatch;
        }
        return true;
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Facturas, Ventas & Compras
                        {projectFilter && (
                            <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full">
                                {projects.find(p => p.id === projectFilter)?.name || 'Proyecto'}
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 text-sm">Gestiona tus ventas, notas de entrega, facturas y órdenes de compra a proveedores</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/inventory" className="bg-slate-800 text-white px-3.5 py-2 rounded-lg hover:bg-slate-700 transition font-medium text-sm flex items-center gap-1.5 shadow-sm">
                        📦 Inventario / O.C.
                    </Link>
                    <Link href="/pos" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium text-sm flex items-center gap-1.5 shadow-sm">
                        🛒 Ir al POS
                    </Link>
                    <Link href="/invoices/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center shadow-sm">
                        + Nueva Factura
                    </Link>
                </div>
            </div>
            
            {/* BARRA DE FILTROS AVANZADOS */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <input 
                        placeholder="Buscar por código, cotización (COT-), cliente, proveedor o proyecto..." 
                        className="w-full border border-gray-300 pl-4 pr-8 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filtro de Proyecto */}
                <select 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700 min-w-[180px]"
                    value={projectFilter}
                    onChange={e => setProjectFilter(e.target.value)}
                >
                    <option value="">📁 Todos los proyectos</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>📁 {p.name}</option>
                    ))}
                </select>

                {/* Filtro de Origen */}
                <select 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700"
                    value={originFilter}
                    onChange={e => setOriginFilter(e.target.value)}
                >
                    <option value="">Todos los tipos de documento</option>
                    <option value="PURCHASE">📥 Órdenes de Compra y Proveedores</option>
                    <option value="STANDARD">📄 Facturas de Venta</option>
                    <option value="DELIVERY_NOTE">📦 Notas de Entrega</option>
                    <option value="POS">🛒 Ventas POS (Caja)</option>
                </select>

                {/* Filtro de Vencimiento */}
                <select 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700"
                    value={dueFilter}
                    onChange={e => setDueFilter(e.target.value)}
                >
                    <option value="">Plazo de vencimiento</option>
                    <option value="OVERDUE">⚠️ Facturas Vencidas</option>
                    <option value="TODAY">⏰ Vencen Hoy</option>
                    <option value="UPCOMING">⏳ Por Vencer (próximos 7 días)</option>
                    <option value="PAID">✅ Pagadas al día</option>
                </select>

                {/* Filtro de Estado */}
                <select 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    <option value="DRAFT">Borrador</option>
                    <option value="POSTED">Por cobrar</option>
                    <option value="PAID">Pagada / Cobrada</option>
                    <option value="CANCELLED">Anulada</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                   <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                    <p className="text-gray-500 text-sm">No se encontraron facturas con los filtros seleccionados</p>
                    {(projectFilter || statusFilter || originFilter || search) && (
                        <button 
                            onClick={() => { setProjectFilter(''); setStatusFilter(''); setOriginFilter(''); setSearch(''); }}
                            className="mt-2 text-blue-600 font-medium text-xs hover:underline"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Barra superior de desplazamiento horizontal rápido */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                            <span>Desplazamiento horizontal:</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => scrollHorizontal('left')}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded border border-slate-200 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Mover vista a la izquierda"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Izquierda</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollHorizontal('right')}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded border border-slate-200 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Mover vista a la derecha"
                            >
                                <span>Derecha</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => scrollHorizontal('end')}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition flex items-center gap-1 shadow-2xs cursor-pointer ml-1"
                                title="Ir directamente a los botones de Acciones"
                            >
                                <span>Ir a Acciones</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden relative">
                        <div ref={tableContainerRef} className="overflow-x-auto scroll-smooth">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                            Código
                                        </th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proyecto</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente / Proveedor</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Emisión / Vencimiento</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalle / Margen</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 z-10 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {filtered.map(inv => {
                                    const isPurchase = inv.type === 'BILL' || inv.code?.startsWith('OC-');
                                    const isPurchaseOrder = inv.code?.toUpperCase().startsWith('OC-');
                                    const isNE = inv.code?.toUpperCase().startsWith('NE');
                                    const isPos = Boolean(inv.posSessionId) || inv.code?.toUpperCase().startsWith('POS-');
                                    const isSaleInvoice = inv.type === 'INVOICE' && !isNE && !isPos && !isPurchaseOrder;
                                    const projectName = inv.project?.name || projects.find(p => p.id === inv.projectId)?.name || 'General';

                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50/80 transition group">
                                            <td className="px-5 py-3.5 whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50/95 z-5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-gray-900 font-mono text-xs sm:text-sm">{inv.code}</span>
                                                        {isPurchaseOrder && (
                                                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                                                O.C.
                                                            </span>
                                                        )}
                                                        {isPurchase && !isPurchaseOrder && (
                                                            <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded border border-orange-200">
                                                                COMPRA
                                                            </span>
                                                        )}
                                                        {isPos && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                                                POS
                                                            </span>
                                                        )}
                                                        {isNE && (
                                                            <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                                                                NE
                                                            </span>
                                                        )}
                                                        {isSaleInvoice && (
                                                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200">
                                                                FACTURA
                                                            </span>
                                                        )}
                                                    </div>
                                                    {inv.purchaseOrder && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSearch(inv.purchaseOrder);
                                                            }}
                                                            className="text-[9.5px] bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded border border-slate-200 transition cursor-pointer w-fit flex items-center gap-1"
                                                            title={`Filtrar todos los documentos con esta referencia: ${inv.purchaseOrder}`}
                                                        >
                                                            <span>📋</span>
                                                            <span className="font-semibold text-slate-500">
                                                                {inv.purchaseOrder.startsWith('COT-') ? 'Cotización:' : (isPurchase ? 'Ref:' : 'O.C. Cliente:')}
                                                            </span>
                                                            <span className="font-bold text-slate-800">{inv.purchaseOrder}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">
                                                    📁 {projectName}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 text-xs sm:text-sm">
                                                <div className="font-medium text-gray-900 flex items-center gap-1">
                                                    {isPurchase && <span className="text-xs text-slate-400">🏢</span>}
                                                    {inv.clientName || inv.contact?.name || inv.vendor?.name || inv.contactName || '-'}
                                                </div>
                                                {inv.contact?.taxId && (
                                                    <div className="text-[10px] text-gray-400 font-mono">{inv.contact.taxId}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 text-xs">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1 font-medium text-gray-900">
                                                        <span className="text-[10px] text-gray-400">Emis:</span>
                                                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('es-VE') : '-'}
                                                    </div>
                                                    {inv.dueDate ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] text-gray-400">Venc:</span>
                                                            <span className="font-medium text-gray-700">{new Date(inv.dueDate).toLocaleDateString('es-VE')}</span>
                                                        </div>
                                                    ) : null}
                                                    {(() => {
                                                        const dueInfo = calculateDueStatus(inv.dueDate, inv.status);
                                                        if (!dueInfo) return null;
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border w-fit mt-0.5 ${dueInfo.badgeClass}`}>
                                                                {dueInfo.isOverdue && <AlertCircle className="w-2.5 h-2.5 shrink-0" />}
                                                                {dueInfo.isToday && <Clock className="w-2.5 h-2.5 shrink-0" />}
                                                                {dueInfo.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-bold text-gray-900">
                                                {Number(inv.total || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {inv.currency}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                                {isPurchase ? (
                                                    <div>
                                                        {inv.status === 'PAID' ? (
                                                            <span className="font-mono text-emerald-600 font-bold text-xs">PAGADA TOTAL</span>
                                                        ) : (
                                                            <div>
                                                                <span className="font-mono text-amber-600 font-semibold text-xs">
                                                                    Pend: {Number(inv.outstanding ?? inv.total ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {inv.currency}
                                                                </span>
                                                                {Number(inv.outstanding) < Number(inv.total) && (
                                                                    <div className="text-[10px] text-emerald-600 font-semibold">Tiene Abonos</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : inv.type === 'INVOICE' && inv.status === 'PAID' ? (() => {
                                                    let taxAmount = 0;
                                                    try {
                                                        if (inv.lines) {
                                                            const parsed = typeof inv.lines === 'string' ? JSON.parse(inv.lines) : inv.lines;
                                                            if (parsed && typeof parsed === 'object') {
                                                                taxAmount = Number(parsed.taxAmount) || 0;
                                                            }
                                                        }
                                                    } catch(e) {}
                                                    const netSales = Math.max(0.01, Number(inv.total || 0) - taxAmount);
                                                    const marginPercent = ((inv.netProfit || 0) / netSales) * 100;
                                                    return (
                                                        <div>
                                                            <span className="font-mono text-green-600 font-semibold text-xs">
                                                                +{Number(inv.netProfit || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {inv.currency}
                                                            </span>
                                                            <div className="text-[10px] text-gray-400">
                                                                Margen: {marginPercent.toFixed(1)}%
                                                            </div>
                                                        </div>
                                                    );
                                                })() : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className={`px-2.5 py-1 inline-flex text-[11px] leading-4 font-semibold rounded-full items-center
                                                    ${
                                                      inv.status === 'PAID' ? 'bg-green-100 text-green-800' : 
                                                      inv.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                      inv.status === 'POSTED' || inv.status === 'OPEN' ? (isPurchase ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800') : 
                                                      inv.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                      'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {
                                                     inv.status === 'POSTED' || inv.status === 'OPEN' ? (isPurchase ? 'POR PAGAR' : 'POR COBRAR') : 
                                                     inv.status === 'PAID' ? (isPurchase ? 'PAGADA' : 'COBRADA') : 
                                                     inv.status === 'PARTIALLY_PAID' ? 'ABONADA' :
                                                     inv.status === 'DRAFT' ? 'BORRADOR' : inv.status
                                                    }
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right font-medium sticky right-0 bg-white group-hover:bg-gray-50/95 z-5 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                                <div className="flex gap-1.5 justify-end">
                                                    <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-900 border border-blue-200 px-2.5 py-1 rounded text-xs hover:bg-blue-50 font-semibold transition">
                                                        {isPurchase ? 'Ver / Abonar' : 'Ver'}
                                                    </Link>
                                                    {(inv.status === 'OPEN' || inv.status === 'DRAFT' || (inv.status === 'POSTED' && Number(inv.outstanding ?? inv.total) === Number(inv.total))) && (
                                                        <Link href={`/invoices/${inv.id}/edit`} className="text-slate-700 hover:text-slate-900 border border-slate-200 px-2.5 py-1 rounded text-xs hover:bg-slate-50 font-semibold transition">
                                                            Editar
                                                        </Link>
                                                    )}
                                                    <button 
                                                        onClick={() => handleDelete(inv.id)}
                                                        className="text-red-600 hover:text-red-900 border border-red-200 px-2 py-1 rounded text-xs hover:bg-red-50 font-semibold transition cursor-pointer"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                    {/* Barra flotante inferior fija para desplazarse horizontalmente: semi-transparente por defecto, se ilumina al posar el cursor o pulsar */}
                    <div className="sticky bottom-3 z-20 flex justify-center pointer-events-none mt-2">
                        <div className="bg-slate-900/40 hover:bg-slate-900/95 active:bg-slate-900/95 backdrop-blur-xs hover:backdrop-blur-md text-white px-4 py-2 rounded-full shadow-md hover:shadow-2xl flex items-center gap-3 border border-slate-700/40 hover:border-slate-700/90 pointer-events-auto text-xs font-medium opacity-30 hover:opacity-100 focus-within:opacity-100 transition-all duration-300 ease-in-out cursor-pointer select-none">
                            <span className="text-slate-300 flex items-center gap-1.5">
                                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
                                Mover tabla:
                            </span>
                            <div className="flex items-center gap-1.5 border-l border-slate-700/60 pl-3">
                                <button
                                    type="button"
                                    onClick={() => scrollHorizontal('left')}
                                    className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-md transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                                    title="Desplazar a la izquierda"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    <span>Izquierda</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollHorizontal('right')}
                                    className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-md transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                                    title="Desplazar a la derecha"
                                >
                                    <span>Derecha</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollHorizontal('end')}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold rounded-md transition flex items-center gap-1 shadow-sm cursor-pointer ml-1"
                                    title="Ir a las columnas de Estado y Acciones"
                                >
                                    <span>Acciones</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


