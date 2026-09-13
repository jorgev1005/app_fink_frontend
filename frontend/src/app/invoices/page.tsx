'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import api, { projectsAPI, quotationsAPI } from '@/lib/api';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    Clock, AlertCircle, Calendar, CheckCircle2, Search, X, 
    ChevronLeft, ChevronRight, ArrowLeftRight, FileText, 
    ShoppingCart, Truck, Plus, Eye, Download, Filter, 
    RefreshCw, ExternalLink, ArrowUpRight, DollarSign,
    Package, Check, ArrowRight, Receipt, FileSpreadsheet,
    HelpCircle, ShieldAlert
} from 'lucide-react';

// Tipos de pestañas disponibles
type DocTabType = 'ALL' | 'DELIVERY_NOTE' | 'INVOICE' | 'QUOTATION' | 'PURCHASE_ORDER' | 'BILL' | 'POS';

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

function InvoicesPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [invoices, setInvoices] = useState<any[]>([]);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros de pestaña y estado
    const [activeTab, setActiveTab] = useState<DocTabType>('ALL');
    const [projectFilter, setProjectFilter] = useState('');
    const [commercialStatusFilter, setCommercialStatusFilter] = useState('');
    const [dispatchFilter, setDispatchFilter] = useState('');
    const [dueFilter, setDueFilter] = useState('');
    const [search, setSearch] = useState('');
    const [kpiFilter, setKpiFilter] = useState<string | null>(null);

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
        const querySearch = searchParams?.get('search');
        if (querySearch) {
            setSearch(querySearch);
        }
        const queryTab = searchParams?.get('tab') as DocTabType;
        if (queryTab && ['ALL', 'DELIVERY_NOTE', 'INVOICE', 'QUOTATION', 'PURCHASE_ORDER', 'BILL', 'POS'].includes(queryTab)) {
            setActiveTab(queryTab);
        }
        loadData();
    }, [searchParams]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [invRes, quoteRes, projRes] = await Promise.all([
                api.invoices.getAll().catch(() => ({ data: { data: [] } })),
                quotationsAPI.getAll().catch(() => ({ data: { data: [] } })),
                projectsAPI.getAll().catch(() => ({ data: { data: [] } }))
            ]);

            const invList = invRes.data?.data ? invRes.data.data : (Array.isArray(invRes.data) ? invRes.data : []);
            const quoteList = quoteRes.data?.data ? quoteRes.data.data : (Array.isArray(quoteRes.data) ? quoteRes.data : []);
            const projList = projRes.data?.data ? projRes.data.data : (Array.isArray(projRes.data) ? projRes.data : []);

            setInvoices(invList);
            setQuotations(quoteList);
            setProjects(projList);
        } catch (error) {
            console.error('Error cargando documentos:', error);
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

    // Clasificar documentos en una lista universal normalizada
    const unifiedDocs = useMemo(() => {
        const list: any[] = [];

        // 1. Facturas, Notas de Entrega, O.C., Bills y POS
        invoices.forEach(inv => {
            const isPO = inv.code?.toUpperCase().startsWith('OC-');
            const isBill = inv.type === 'BILL' && !isPO;
            const isNE = inv.code?.toUpperCase().startsWith('NE');
            const isPos = Boolean(inv.posSessionId) || inv.code?.toUpperCase().startsWith('POS-');
            const isSaleInvoice = inv.type === 'INVOICE' && !isNE && !isPos && !isPO;

            let docCategory: DocTabType = 'INVOICE';
            if (isNE) docCategory = 'DELIVERY_NOTE';
            else if (isPO) docCategory = 'PURCHASE_ORDER';
            else if (isBill) docCategory = 'BILL';
            else if (isPos) docCategory = 'POS';
            else if (isSaleInvoice) docCategory = 'INVOICE';

            const contactName = inv.clientName || inv.contact?.name || inv.vendor?.name || inv.contactName || 'Cliente General';
            const taxId = inv.contact?.taxId || '';
            const projectName = inv.project?.name || projects.find(p => p.id === inv.projectId)?.name || 'General';

            list.push({
                rawId: inv.id,
                isQuotation: false,
                code: inv.code || 'SIN-CÓDIGO',
                docCategory,
                contactName,
                taxId,
                projectId: inv.projectId,
                projectName,
                issueDate: inv.issueDate || inv.createdAt,
                dueDate: inv.dueDate,
                total: Number(inv.total || 0),
                outstanding: Number(inv.outstanding ?? inv.total ?? 0),
                currency: inv.currency || 'USD',
                status: inv.status, // DRAFT, POSTED, OPEN, PAID, PARTIALLY_PAID, CANCELLED
                dispatchStatus: inv.dispatchStatus || (isNE ? 'PENDING_DISPATCH' : null),
                invoicedAsCode: inv.invoicedAsCode,
                invoicedAsId: inv.invoicedAsId,
                sourceDeliveryNoteCode: inv.sourceDeliveryNoteCode,
                sourceDeliveryNoteId: inv.sourceDeliveryNoteId,
                purchaseOrder: inv.purchaseOrder, // Puede ser COT-xxxx o referencia
                notes: inv.notes,
                netProfit: inv.netProfit,
                lines: inv.lines,
                rawDoc: inv,
                createdAt: inv.createdAt
            });
        });

        // 2. Cotizaciones (de quotationsAPI)
        quotations.forEach(q => {
            const code = q.correlative || q.id || 'COT-???';
            const contactName = q.customer?.name || q.clientName || 'Cliente Prospecto';
            const taxId = q.customer?.taxId || q.clientTaxId || '';
            const total = Number(q.totalUSD || q.total || 0);

            list.push({
                rawId: q.id || q.correlative,
                isQuotation: true,
                code,
                docCategory: 'QUOTATION' as DocTabType,
                contactName,
                taxId,
                projectId: '',
                projectName: 'Venta Comercial',
                issueDate: q.createdAt,
                dueDate: null,
                total,
                outstanding: total,
                currency: 'USD',
                status: q.status || 'PENDING', // PENDING, APPROVED, INVOICED, FULLY_INVOICED, PARTIALLY_INVOICED, REJECTED, PO_GENERATED
                dispatchStatus: q.status === 'FULLY_INVOICED' ? 'DELIVERED' : (q.status === 'PARTIALLY_INVOICED' || q.status === 'INVOICED') ? 'DISPATCHED' : null,
                invoicedAsCode: null,
                invoicedAsId: null,
                sourceDeliveryNoteCode: null,
                sourceDeliveryNoteId: null,
                purchaseOrder: null,
                relatedInvoices: q.relatedInvoices || [],
                dispatchMetrics: q.dispatchMetrics,
                notes: q.notes,
                rawDoc: q,
                createdAt: q.createdAt
            });
        });

        // Ordenar del más reciente al más antiguo
        return list.sort((a, b) => new Date(b.issueDate || b.createdAt || 0).getTime() - new Date(a.issueDate || a.createdAt || 0).getTime());
    }, [invoices, quotations, projects]);

    // Conteo por cada Pestaña
    const counts = useMemo(() => {
        return {
            ALL: unifiedDocs.length,
            DELIVERY_NOTE: unifiedDocs.filter(d => d.docCategory === 'DELIVERY_NOTE').length,
            INVOICE: unifiedDocs.filter(d => d.docCategory === 'INVOICE').length,
            QUOTATION: unifiedDocs.filter(d => d.docCategory === 'QUOTATION').length,
            PURCHASE_ORDER: unifiedDocs.filter(d => d.docCategory === 'PURCHASE_ORDER').length,
            BILL: unifiedDocs.filter(d => d.docCategory === 'BILL').length,
            POS: unifiedDocs.filter(d => d.docCategory === 'POS').length,
        };
    }, [unifiedDocs]);

    // Documentos que aplican a la pestaña activa (para calcular las tarjetas KPI de esa pestaña)
    const docsInActiveTab = useMemo(() => {
        if (activeTab === 'ALL') return unifiedDocs;
        return unifiedDocs.filter(d => d.docCategory === activeTab);
    }, [unifiedDocs, activeTab]);

    // Cálculo de métricas KPI según la pestaña activa
    const tabKpis = useMemo(() => {
        if (activeTab === 'DELIVERY_NOTE') {
            const pending = docsInActiveTab.filter(d => !d.dispatchStatus || d.dispatchStatus === 'PENDING_DISPATCH').length;
            const dispatched = docsInActiveTab.filter(d => d.dispatchStatus === 'DISPATCHED').length;
            const delivered = docsInActiveTab.filter(d => d.dispatchStatus === 'DELIVERED').length;
            const invoiced = docsInActiveTab.filter(d => Boolean(d.invoicedAsCode)).length;
            const uninvoiced = docsInActiveTab.filter(d => !d.invoicedAsCode).length;
            return [
                { id: 'ALL', label: 'Total Notas', count: docsInActiveTab.length, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                { id: 'PENDING_DISPATCH', label: '🕒 Pendiente Despacho', count: pending, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { id: 'DISPATCHED', label: '🚚 En Tránsito / Despachadas', count: dispatched, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { id: 'DELIVERED', label: '✅ Entregadas al Cliente', count: delivered, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { id: 'INVOICED', label: '📄 Facturadas', count: invoiced, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { id: 'UNINVOICED', label: '⚠️ Sin Facturar aún', count: uninvoiced, color: 'text-orange-700 bg-orange-50 border-orange-200' },
            ];
        }

        if (activeTab === 'INVOICE') {
            const open = docsInActiveTab.filter(d => d.status === 'POSTED' || d.status === 'OPEN').length;
            const partial = docsInActiveTab.filter(d => d.status === 'PARTIALLY_PAID').length;
            const paid = docsInActiveTab.filter(d => d.status === 'PAID').length;
            const overdue = docsInActiveTab.filter(d => {
                const dueInfo = calculateDueStatus(d.dueDate, d.status);
                return dueInfo?.isOverdue;
            }).length;
            return [
                { id: 'ALL', label: 'Total Facturas', count: docsInActiveTab.length, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { id: 'POSTED', label: '⏳ Por Cobrar', count: open, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { id: 'PARTIALLY_PAID', label: '💰 Con Abonos', count: partial, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { id: 'PAID', label: '✅ Cobradas / Pagadas', count: paid, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { id: 'OVERDUE', label: '⚠️ Vencidas', count: overdue, color: 'text-rose-700 bg-rose-50 border-rose-200' },
            ];
        }

        if (activeTab === 'QUOTATION') {
            const pending = docsInActiveTab.filter(d => !d.status || d.status === 'PENDING').length;
            const approved = docsInActiveTab.filter(d => d.status === 'APPROVED').length;
            const invoiced = docsInActiveTab.filter(d => ['INVOICED', 'FULLY_INVOICED', 'PARTIALLY_INVOICED', 'PO_GENERATED'].includes(d.status)).length;
            const rejected = docsInActiveTab.filter(d => d.status === 'REJECTED').length;
            return [
                { id: 'ALL', label: 'Total Cotizaciones', count: docsInActiveTab.length, color: 'text-sky-700 bg-sky-50 border-sky-200' },
                { id: 'PENDING', label: '🕒 En Evaluación', count: pending, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { id: 'APPROVED', label: '✅ Aprobadas', count: approved, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { id: 'INVOICED', label: '🚚 Facturadas / Con NE', count: invoiced, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { id: 'REJECTED', label: '❌ Rechazadas', count: rejected, color: 'text-rose-700 bg-rose-50 border-rose-200' },
            ];
        }

        if (activeTab === 'PURCHASE_ORDER' || activeTab === 'BILL') {
            const pending = docsInActiveTab.filter(d => d.status !== 'PAID').length;
            const paid = docsInActiveTab.filter(d => d.status === 'PAID').length;
            return [
                { id: 'ALL', label: activeTab === 'PURCHASE_ORDER' ? 'Total O.C.' : 'Total Facturas Compra', count: docsInActiveTab.length, color: 'text-purple-700 bg-purple-50 border-purple-200' },
                { id: 'PENDING', label: '⏳ Por Pagar / Pendiente', count: pending, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { id: 'PAID', label: '✅ Pagadas', count: paid, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            ];
        }

        // Pestaña General ALL
        const totalNE = unifiedDocs.filter(d => d.docCategory === 'DELIVERY_NOTE').length;
        const totalInv = unifiedDocs.filter(d => d.docCategory === 'INVOICE').length;
        const totalQuot = unifiedDocs.filter(d => d.docCategory === 'QUOTATION').length;
        const totalPO = unifiedDocs.filter(d => d.docCategory === 'PURCHASE_ORDER' || d.docCategory === 'BILL').length;
        const totalPending = unifiedDocs.filter(d => d.status === 'POSTED' || d.status === 'OPEN' || d.status === 'PENDING').length;

        return [
            { id: 'ALL', label: 'Total Documentos', count: unifiedDocs.length, color: 'text-slate-800 bg-slate-100 border-slate-300' },
            { id: 'DELIVERY_NOTE', label: '📦 Notas de Entrega', count: totalNE, color: 'text-purple-700 bg-purple-50 border-purple-200' },
            { id: 'INVOICE', label: '📄 Facturas de Venta', count: totalInv, color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { id: 'QUOTATION', label: '📋 Cotizaciones', count: totalQuot, color: 'text-sky-700 bg-sky-50 border-sky-200' },
            { id: 'PURCHASE_ORDER', label: '📥 Compras & O.C.', count: totalPO, color: 'text-orange-700 bg-orange-50 border-orange-200' },
            { id: 'PENDING', label: '⏳ Pendientes / Por Cobrar', count: totalPending, color: 'text-amber-700 bg-amber-50 border-amber-200' },
        ];
    }, [activeTab, docsInActiveTab, unifiedDocs]);

    // Filtrado exhaustivo según Pestaña, Filtros y KPI seleccionado
    const filteredDocs = useMemo(() => {
        return docsInActiveTab.filter(doc => {
            // Filtro de Proyecto
            if (projectFilter && doc.projectId && doc.projectId !== projectFilter) return false;

            // Filtro KPI interactivo
            if (kpiFilter && kpiFilter !== 'ALL') {
                if (activeTab === 'DELIVERY_NOTE') {
                    if (kpiFilter === 'PENDING_DISPATCH' && doc.dispatchStatus && doc.dispatchStatus !== 'PENDING_DISPATCH') return false;
                    if (kpiFilter === 'DISPATCHED' && doc.dispatchStatus !== 'DISPATCHED') return false;
                    if (kpiFilter === 'DELIVERED' && doc.dispatchStatus !== 'DELIVERED') return false;
                    if (kpiFilter === 'INVOICED' && !doc.invoicedAsCode) return false;
                    if (kpiFilter === 'UNINVOICED' && doc.invoicedAsCode) return false;
                } else if (activeTab === 'INVOICE') {
                    if (kpiFilter === 'POSTED' && doc.status !== 'POSTED' && doc.status !== 'OPEN') return false;
                    if (kpiFilter === 'PARTIALLY_PAID' && doc.status !== 'PARTIALLY_PAID') return false;
                    if (kpiFilter === 'PAID' && doc.status !== 'PAID') return false;
                    if (kpiFilter === 'OVERDUE') {
                        const dueInfo = calculateDueStatus(doc.dueDate, doc.status);
                        if (!dueInfo?.isOverdue) return false;
                    }
                } else if (activeTab === 'QUOTATION') {
                    if (kpiFilter === 'PENDING' && doc.status && doc.status !== 'PENDING') return false;
                    if (kpiFilter === 'APPROVED' && doc.status !== 'APPROVED') return false;
                    if (kpiFilter === 'INVOICED' && !['INVOICED', 'FULLY_INVOICED', 'PARTIALLY_INVOICED', 'PO_GENERATED'].includes(doc.status)) return false;
                    if (kpiFilter === 'REJECTED' && doc.status !== 'REJECTED') return false;
                } else if (activeTab === 'PURCHASE_ORDER' || activeTab === 'BILL') {
                    if (kpiFilter === 'PENDING' && doc.status === 'PAID') return false;
                    if (kpiFilter === 'PAID' && doc.status !== 'PAID') return false;
                } else if (activeTab === 'ALL') {
                    if (kpiFilter === 'DELIVERY_NOTE' && doc.docCategory !== 'DELIVERY_NOTE') return false;
                    if (kpiFilter === 'INVOICE' && doc.docCategory !== 'INVOICE') return false;
                    if (kpiFilter === 'QUOTATION' && doc.docCategory !== 'QUOTATION') return false;
                    if (kpiFilter === 'PURCHASE_ORDER' && doc.docCategory !== 'PURCHASE_ORDER' && doc.docCategory !== 'BILL') return false;
                    if (kpiFilter === 'PENDING' && doc.status !== 'POSTED' && doc.status !== 'OPEN' && doc.status !== 'PENDING') return false;
                }
            }

            // Filtro Comercial dropdown
            if (commercialStatusFilter) {
                if (commercialStatusFilter === 'PAID' && doc.status !== 'PAID') return false;
                if (commercialStatusFilter === 'PARTIALLY_PAID' && doc.status !== 'PARTIALLY_PAID') return false;
                if (commercialStatusFilter === 'POSTED' && doc.status !== 'POSTED' && doc.status !== 'OPEN') return false;
                if (commercialStatusFilter === 'DRAFT' && doc.status !== 'DRAFT') return false;
                if (commercialStatusFilter === 'CANCELLED' && doc.status !== 'CANCELLED') return false;
                if (commercialStatusFilter === 'APPROVED' && doc.status !== 'APPROVED') return false;
                if (commercialStatusFilter === 'PENDING' && doc.status !== 'PENDING') return false;
            }

            // Filtro de Despacho Logístico dropdown
            if (dispatchFilter) {
                if (dispatchFilter === 'PENDING_DISPATCH' && (doc.dispatchStatus && doc.dispatchStatus !== 'PENDING_DISPATCH')) return false;
                if (dispatchFilter === 'DISPATCHED' && doc.dispatchStatus !== 'DISPATCHED') return false;
                if (dispatchFilter === 'DELIVERED' && doc.dispatchStatus !== 'DELIVERED') return false;
                if (dispatchFilter === 'INVOICED' && !doc.invoicedAsCode) return false;
                if (dispatchFilter === 'UNINVOICED' && doc.invoicedAsCode) return false;
            }

            // Filtro de Vencimiento
            if (dueFilter) {
                const dueInfo = calculateDueStatus(doc.dueDate, doc.status);
                if (dueFilter === 'OVERDUE' && !dueInfo?.isOverdue) return false;
                if (dueFilter === 'TODAY' && !dueInfo?.isToday) return false;
                if (dueFilter === 'UPCOMING' && (!dueInfo?.isPending || (dueInfo?.diffDays !== undefined && dueInfo.diffDays > 7))) return false;
                if (dueFilter === 'PAID' && doc.status !== 'PAID') return false;
            }

            // Omnibox de Búsqueda inteligente
            if (search) {
                const term = search.toLowerCase().trim();
                const codeMatch = (doc.code || '').toLowerCase().includes(term);
                const poMatch = (doc.purchaseOrder || '').toLowerCase().includes(term);
                const neMatch = (doc.sourceDeliveryNoteCode || '').toLowerCase().includes(term);
                const facMatch = (doc.invoicedAsCode || '').toLowerCase().includes(term);
                const nameMatch = (doc.contactName || '').toLowerCase().includes(term);
                const taxIdMatch = (doc.taxId || '').toLowerCase().includes(term);
                const projMatch = (doc.projectName || '').toLowerCase().includes(term);
                const notesMatch = (doc.notes || '').toLowerCase().includes(term);

                let relatedQuotesMatch = false;
                if (doc.relatedInvoices && Array.isArray(doc.relatedInvoices)) {
                    relatedQuotesMatch = doc.relatedInvoices.some((r: any) => (r.code || '').toLowerCase().includes(term));
                }

                return codeMatch || poMatch || neMatch || facMatch || nameMatch || taxIdMatch || projMatch || notesMatch || relatedQuotesMatch;
            }

            return true;
        });
    }, [docsInActiveTab, projectFilter, kpiFilter, commercialStatusFilter, dispatchFilter, dueFilter, search, activeTab]);

    const resetFilters = () => {
        setProjectFilter('');
        setCommercialStatusFilter('');
        setDispatchFilter('');
        setDueFilter('');
        setSearch('');
        setKpiFilter(null);
    };

    const hasActiveFilters = Boolean(projectFilter || commercialStatusFilter || dispatchFilter || dueFilter || search || kpiFilter);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* CABECERA PRINCIPAL */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
                        <FileSpreadsheet className="w-7 h-7 text-blue-600" />
                        Centro de Consulta de Documentos
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Control integral de ventas, notas de entrega, facturas oficiales, cotizaciones y órdenes de compra con trazabilidad de despacho y cobro
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link href="/quotations" className="bg-sky-700 hover:bg-sky-800 text-white px-3 py-2 rounded-lg transition font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
                        📋 Cotizaciones
                    </Link>
                    <Link href="/invoices/new?type=po" className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-2 rounded-lg transition font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
                        📥 Nueva O.C.
                    </Link>
                    <Link href="/invoices/new?type=invoice" className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
                        <Plus className="w-4 h-4" /> Nueva Factura / Nota
                    </Link>
                </div>
            </div>

            {/* BARRA DE PESTAÑAS POR TIPO DE DOCUMENTO */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-gray-200 text-sm no-scrollbar">
                <button
                    onClick={() => { setActiveTab('ALL'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'ALL' 
                            ? 'bg-slate-900 text-white shadow-sm' 
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <span>Todos</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'ALL' ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'}`}>
                        {counts.ALL}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('DELIVERY_NOTE'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'DELIVERY_NOTE' 
                            ? 'bg-purple-700 text-white shadow-sm' 
                            : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
                    }`}
                >
                    <Truck className="w-4 h-4" />
                    <span>Notas de Entrega (NE)</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'DELIVERY_NOTE' ? 'bg-purple-800 text-purple-100' : 'bg-purple-100 text-purple-800'}`}>
                        {counts.DELIVERY_NOTE}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('INVOICE'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'INVOICE' 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                    }`}
                >
                    <Receipt className="w-4 h-4" />
                    <span>Facturas de Venta</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'INVOICE' ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>
                        {counts.INVOICE}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('QUOTATION'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'QUOTATION' 
                            ? 'bg-sky-700 text-white shadow-sm' 
                            : 'bg-white text-sky-700 hover:bg-sky-50 border border-sky-200'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    <span>Cotizaciones</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'QUOTATION' ? 'bg-sky-800 text-sky-100' : 'bg-sky-100 text-sky-800'}`}>
                        {counts.QUOTATION}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('PURCHASE_ORDER'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'PURCHASE_ORDER' 
                            ? 'bg-indigo-700 text-white shadow-sm' 
                            : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
                    }`}
                >
                    <span>Órdenes de Compra (OC)</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'PURCHASE_ORDER' ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-100 text-indigo-800'}`}>
                        {counts.PURCHASE_ORDER}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('BILL'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'BILL' 
                            ? 'bg-orange-700 text-white shadow-sm' 
                            : 'bg-white text-orange-700 hover:bg-orange-50 border border-orange-200'
                    }`}
                >
                    <span>Facturas de Compra</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'BILL' ? 'bg-orange-800 text-orange-100' : 'bg-orange-100 text-orange-800'}`}>
                        {counts.BILL}
                    </span>
                </button>

                <button
                    onClick={() => { setActiveTab('POS'); setKpiFilter(null); }}
                    className={`px-3.5 py-2 rounded-lg font-semibold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                        activeTab === 'POS' 
                            ? 'bg-emerald-700 text-white shadow-sm' 
                            : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                >
                    <ShoppingCart className="w-4 h-4" />
                    <span>POS (Caja)</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === 'POS' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-800'}`}>
                        {counts.POS}
                    </span>
                </button>
            </div>

            {/* TARJETAS KPI INTERACTIVAS SEGÚN LA PESTAÑA */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {tabKpis.map(kpi => {
                    const isSelected = kpiFilter === kpi.id || (!kpiFilter && kpi.id === 'ALL');
                    return (
                        <button
                            key={kpi.id}
                            type="button"
                            onClick={() => {
                                if (kpi.id === 'ALL') setKpiFilter(null);
                                else setKpiFilter(prev => prev === kpi.id ? null : kpi.id);
                            }}
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                                isSelected 
                                    ? `${kpi.color} ring-2 ring-blue-500 shadow-sm scale-[1.02]` 
                                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                        >
                            <div className="text-xs font-semibold uppercase tracking-wider opacity-80 line-clamp-1">
                                {kpi.label}
                            </div>
                            <div className="text-xl md:text-2xl font-bold font-mono mt-1">
                                {kpi.count}
                            </div>
                            {isSelected && (
                                <span className="absolute bottom-1 right-2 text-[10px] font-semibold opacity-70">
                                    Filtrado
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTROS AVANZADOS */}
            <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Omnibox de Búsqueda */}
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input 
                            placeholder="Buscar por código (NE-, 0204, COT-), cliente, RIF, proyecto, o notas..." 
                            className="w-full border border-gray-300 pl-10 pr-9 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                                title="Limpiar búsqueda"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtro por Proyecto */}
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

                    {/* Filtro por Estado Comercial */}
                    <select 
                        className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700 min-w-[170px]"
                        value={commercialStatusFilter}
                        onChange={e => setCommercialStatusFilter(e.target.value)}
                    >
                        <option value="">Estado Comercial</option>
                        <option value="POSTED">⏳ Por Cobrar / Abrir</option>
                        <option value="PARTIALLY_PAID">💰 Abonada (Parcial)</option>
                        <option value="PAID">✅ Pagada / Cobrada</option>
                        <option value="APPROVED">✨ Aprobada (Cotiz.)</option>
                        <option value="PENDING">🕒 En Evaluación (Cotiz.)</option>
                        <option value="DRAFT">📝 Borrador</option>
                        <option value="CANCELLED">🚫 Anulada</option>
                    </select>

                    {/* Filtro de Estado Logístico (Despacho) */}
                    {(activeTab === 'ALL' || activeTab === 'DELIVERY_NOTE') && (
                        <select 
                            className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700 min-w-[170px]"
                            value={dispatchFilter}
                            onChange={e => setDispatchFilter(e.target.value)}
                        >
                            <option value="">Estado Despacho</option>
                            <option value="PENDING_DISPATCH">🕒 Pendiente Despacho</option>
                            <option value="DISPATCHED">🚚 En Tránsito / Despachada</option>
                            <option value="DELIVERED">✅ Entregada al Cliente</option>
                            <option value="INVOICED">📄 Facturada Oficialmente</option>
                            <option value="UNINVOICED">⚠️ Sin Factura Oficial</option>
                        </select>
                    )}

                    {/* Filtro de Vencimiento */}
                    <select 
                        className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700"
                        value={dueFilter}
                        onChange={e => setDueFilter(e.target.value)}
                    >
                        <option value="">Plazo Vencimiento</option>
                        <option value="OVERDUE">⚠️ Vencidas</option>
                        <option value="TODAY">⏰ Vencen Hoy</option>
                        <option value="UPCOMING">⏳ Próximos 7 días</option>
                        <option value="PAID">✅ Pagadas al día</option>
                    </select>
                </div>

                {/* Resumen de filtros activos y botón de reset */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-gray-500">
                    <div>
                        Mostrando <span className="font-bold text-gray-800 font-mono">{filteredDocs.length}</span> de <span className="font-bold text-gray-800 font-mono">{docsInActiveTab.length}</span> documentos
                        {projectFilter && <span> • Proyecto seleccionado</span>}
                        {commercialStatusFilter && <span> • Estado: {commercialStatusFilter}</span>}
                        {dispatchFilter && <span> • Despacho: {dispatchFilter}</span>}
                        {kpiFilter && <span> • Filtro KPI: {kpiFilter}</span>}
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Limpiar todos los filtros
                        </button>
                    )}
                </div>
            </div>

            {/* TABLA PRINCIPAL DE DOCUMENTOS */}
            {loading ? (
                <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-gray-200">
                    <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-500 text-sm mt-3 font-medium">Consultando registros y estados de documentos...</span>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <h3 className="text-base font-semibold text-gray-800">No se encontraron documentos</h3>
                    <p className="text-gray-500 text-sm mt-1">No hay registros que coincidan con los filtros aplicados en esta sección.</p>
                    {hasActiveFilters && (
                        <button 
                            onClick={resetFilters}
                            className="mt-3 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold text-xs transition cursor-pointer"
                        >
                            Restablecer todos los filtros
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Barra de desplazamiento rápido */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-medium">
                            <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                            <span>Desplazamiento horizontal de tabla:</span>
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

                    <div className="bg-white shadow-xs border border-gray-200 rounded-xl overflow-hidden relative">
                        <div ref={tableContainerRef} className="overflow-x-auto scroll-smooth">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                            Tipo & Documento
                                        </th>
                                        <th className="px-4 py-3 text-left">Proyecto</th>
                                        <th className="px-4 py-3 text-left">Cliente / Proveedor</th>
                                        <th className="px-4 py-3 text-left">Emisión & Vencimiento</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-left">Estado Comercial</th>
                                        <th className="px-4 py-3 text-left">Estado Logístico / Despacho</th>
                                        <th className="px-4 py-3 text-right sticky right-0 bg-gray-50 z-10 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                    {filteredDocs.map(doc => {
                                        const isNE = doc.docCategory === 'DELIVERY_NOTE';
                                        const isSaleInvoice = doc.docCategory === 'INVOICE';
                                        const isQuote = doc.docCategory === 'QUOTATION';
                                        const isPO = doc.docCategory === 'PURCHASE_ORDER';
                                        const isBill = doc.docCategory === 'BILL';
                                        const isPos = doc.docCategory === 'POS';

                                        return (
                                            <tr key={doc.code + '_' + doc.rawId} className="hover:bg-gray-50/80 transition group">
                                                {/* 1. TIPO & DOCUMENTO */}
                                                <td className="px-4 py-3.5 whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50/95 z-5 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {/* Badge de Tipo */}
                                                            {isNE && (
                                                                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                                                                    NOTA ENTREGA
                                                                </span>
                                                            )}
                                                            {isSaleInvoice && (
                                                                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200">
                                                                    FACTURA
                                                                </span>
                                                            )}
                                                            {isQuote && (
                                                                <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded border border-sky-200">
                                                                    COTIZACIÓN
                                                                </span>
                                                            )}
                                                            {isPO && (
                                                                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                                                    ORDEN COMPRA
                                                                </span>
                                                            )}
                                                            {isBill && (
                                                                <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded border border-orange-200">
                                                                    COMPRA PROV.
                                                                </span>
                                                            )}
                                                            {isPos && (
                                                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                                                    CAJA POS
                                                                </span>
                                                            )}

                                                            {/* Código del Documento */}
                                                            <span className="font-semibold text-gray-900 font-mono text-xs sm:text-sm">
                                                                {doc.code}
                                                            </span>
                                                        </div>

                                                        {/* Trazabilidad cruzada: NE -> Factura */}
                                                        {isNE && doc.invoicedAsCode && (
                                                            <Link 
                                                                href={`/invoices/${doc.invoicedAsId || ''}`}
                                                                className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono font-bold px-1.5 py-0.5 rounded border border-indigo-200 flex items-center gap-1 w-fit transition"
                                                                title="Factura fiscal emitida para esta nota de entrega"
                                                            >
                                                                <Receipt className="w-3 h-3 text-indigo-600" />
                                                                <span>Fac: #{doc.invoicedAsCode}</span>
                                                            </Link>
                                                        )}

                                                        {/* Trazabilidad cruzada: Factura -> NE */}
                                                        {isSaleInvoice && doc.sourceDeliveryNoteCode && (
                                                            <Link
                                                                href={`/invoices/${doc.sourceDeliveryNoteId || ''}`}
                                                                className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 font-mono font-bold px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1 w-fit transition"
                                                                title="Despacho efectuado bajo esta Nota de Entrega"
                                                            >
                                                                <Truck className="w-3 h-3 text-purple-600" />
                                                                <span>NE: #{doc.sourceDeliveryNoteCode}</span>
                                                            </Link>
                                                        )}

                                                        {/* Trazabilidad: Proviene de Cotización */}
                                                        {doc.purchaseOrder && doc.purchaseOrder.startsWith('COT-') && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSearch(doc.purchaseOrder);
                                                                }}
                                                                className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 w-fit transition cursor-pointer"
                                                                title="Filtrar por esta Cotización"
                                                            >
                                                                <FileText className="w-3 h-3 text-slate-500" />
                                                                <span>Cotiz: <strong>{doc.purchaseOrder}</strong></span>
                                                            </button>
                                                        )}

                                                        {/* Si es Cotización y tiene facturas asociadas */}
                                                        {isQuote && doc.relatedInvoices && doc.relatedInvoices.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {doc.relatedInvoices.map((rel: any) => (
                                                                    <Link
                                                                        key={rel.id || rel.code}
                                                                        href={`/invoices/${rel.id}`}
                                                                        className="text-[9.5px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 transition"
                                                                    >
                                                                        <span>{rel.code?.startsWith('NE') ? '🚚' : '📄'}</span>
                                                                        <span>{rel.code}</span>
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 2. PROYECTO */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                                                        📁 {doc.projectName}
                                                    </span>
                                                </td>

                                                {/* 3. CLIENTE / PROVEEDOR */}
                                                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 text-xs sm:text-sm">
                                                    <div className="font-medium text-gray-900 flex items-center gap-1">
                                                        {(isPO || isBill) && <span className="text-xs text-slate-400">🏢</span>}
                                                        {doc.contactName}
                                                    </div>
                                                    {doc.taxId && (
                                                        <div className="text-[10px] text-gray-400 font-mono">{doc.taxId}</div>
                                                    )}
                                                </td>

                                                {/* 4. EMISIÓN & VENCIMIENTO */}
                                                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 text-xs">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1 font-medium text-gray-900">
                                                            <span className="text-[10px] text-gray-400">Emis:</span>
                                                            {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString('es-VE') : '-'}
                                                        </div>
                                                        {doc.dueDate && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-gray-400">Venc:</span>
                                                                <span className="font-medium text-gray-700">{new Date(doc.dueDate).toLocaleDateString('es-VE')}</span>
                                                            </div>
                                                        )}
                                                        {(() => {
                                                            const dueInfo = calculateDueStatus(doc.dueDate, doc.status);
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

                                                {/* 5. TOTAL */}
                                                <td className="px-4 py-3.5 whitespace-nowrap text-right">
                                                    <div className="font-mono font-bold text-gray-900">
                                                        {Number(doc.total).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {doc.currency}
                                                    </div>
                                                    {isSaleInvoice && doc.status === 'PAID' && doc.netProfit ? (
                                                        <div className="text-[10px] text-emerald-600 font-mono font-medium">
                                                            +{Number(doc.netProfit).toLocaleString('es-VE', { minimumFractionDigits: 2 })} util.
                                                        </div>
                                                    ) : null}
                                                    {(isPO || isBill) && doc.status !== 'PAID' && (
                                                        <div className="text-[10px] text-amber-600 font-mono">
                                                            Pend: {Number(doc.outstanding).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 6. ESTADO COMERCIAL */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {isQuote ? (
                                                        <span className={`px-2.5 py-1 inline-flex text-[11px] leading-4 font-semibold rounded-full items-center ${
                                                            doc.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                            doc.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                                            ['INVOICED', 'FULLY_INVOICED', 'PARTIALLY_INVOICED', 'PO_GENERATED'].includes(doc.status) ? 'bg-indigo-100 text-indigo-800' :
                                                            'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {doc.status === 'APPROVED' ? 'APROBADA' :
                                                             doc.status === 'REJECTED' ? 'RECHAZADA' :
                                                             doc.status === 'FULLY_INVOICED' ? 'DESPACHO TOTAL' :
                                                             doc.status === 'PARTIALLY_INVOICED' ? 'DESPACHO PARCIAL' :
                                                             doc.status === 'INVOICED' ? 'FACTURADA' :
                                                             'EN EVALUACIÓN'}
                                                        </span>
                                                    ) : (
                                                        <span className={`px-2.5 py-1 inline-flex text-[11px] leading-4 font-semibold rounded-full items-center ${
                                                            doc.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 
                                                            doc.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                            doc.status === 'POSTED' || doc.status === 'OPEN' ? ((isPO || isBill) ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800') : 
                                                            doc.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {
                                                                doc.status === 'POSTED' || doc.status === 'OPEN' ? ((isPO || isBill) ? 'POR PAGAR' : 'POR COBRAR') : 
                                                                doc.status === 'PAID' ? ((isPO || isBill) ? 'PAGADA' : 'COBRADA') : 
                                                                doc.status === 'PARTIALLY_PAID' ? 'ABONADA' :
                                                                doc.status === 'DRAFT' ? 'BORRADOR' : doc.status
                                                            }
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 7. ESTADO LOGÍSTICO / DESPACHO */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {isNE ? (
                                                        <div className="flex flex-col gap-1">
                                                            {doc.dispatchStatus === 'DELIVERED' && (
                                                                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200 w-fit">
                                                                    ✓ Entregada
                                                                </span>
                                                            )}
                                                            {doc.dispatchStatus === 'DISPATCHED' && (
                                                                <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200 w-fit">
                                                                    🚚 Despachada
                                                                </span>
                                                            )}
                                                            {(!doc.dispatchStatus || doc.dispatchStatus === 'PENDING_DISPATCH') && (
                                                                <span className="text-[11px] bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full border border-amber-200 w-fit">
                                                                    🕒 Pend. Despacho
                                                                </span>
                                                            )}
                                                            {doc.invoicedAsCode ? (
                                                                <span className="text-[9.5px] text-indigo-700 font-medium">
                                                                    Facturada (#{doc.invoicedAsCode})
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9.5px] text-orange-600 font-medium">
                                                                    Sin factura oficial
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : isSaleInvoice && doc.sourceDeliveryNoteCode ? (
                                                        <span className="text-[11px] bg-purple-50 text-purple-700 font-medium px-2 py-0.5 rounded-full border border-purple-200">
                                                            🚚 Despacho bajo NE #{doc.sourceDeliveryNoteCode}
                                                        </span>
                                                    ) : isQuote ? (
                                                        <div className="text-xs text-gray-500">
                                                            {doc.dispatchMetrics ? (
                                                                <span>
                                                                    Despacho: <strong>{doc.dispatchMetrics.totalDispatchedUnits}</strong> / {doc.dispatchMetrics.totalQuotedUnits} uds
                                                                </span>
                                                            ) : (
                                                                <span>-</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* 8. ACCIONES */}
                                                <td className="px-4 py-3.5 whitespace-nowrap text-right font-medium sticky right-0 bg-white group-hover:bg-gray-50/95 z-5 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                                                    <div className="flex gap-1.5 justify-end items-center">
                                                        {/* Botón Ver */}
                                                        {isQuote ? (
                                                            <Link 
                                                                href={`/quotations?search=${encodeURIComponent(doc.code)}`}
                                                                className="text-sky-700 hover:text-sky-900 border border-sky-200 px-2.5 py-1 rounded text-xs hover:bg-sky-50 font-semibold transition"
                                                            >
                                                                Ver
                                                            </Link>
                                                        ) : (
                                                            <Link 
                                                                href={`/invoices/${doc.rawId}`}
                                                                className="text-blue-600 hover:text-blue-900 border border-blue-200 px-2.5 py-1 rounded text-xs hover:bg-blue-50 font-semibold transition"
                                                            >
                                                                Ver
                                                            </Link>
                                                        )}

                                                        {/* Botón PDF oficial */}
                                                        {isQuote ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(`/backend-api/api/quotations/${doc.code}/pdf`, '_blank')}
                                                                className="text-slate-700 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded text-xs hover:bg-slate-50 font-medium transition cursor-pointer"
                                                                title="Ver PDF oficial de cotización"
                                                            >
                                                                PDF
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(`/backend-api/api/invoices/${doc.rawId}/pdf`, '_blank')}
                                                                className="text-slate-700 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded text-xs hover:bg-slate-50 font-medium transition cursor-pointer"
                                                                title="Ver PDF oficial"
                                                            >
                                                                PDF
                                                            </button>
                                                        )}

                                                        {/* Botón Facturar Nota de Entrega si aún no está facturada */}
                                                        {isNE && !doc.invoicedAsCode && (
                                                            <Link
                                                                href={`/invoices/${doc.rawId}`}
                                                                className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1"
                                                                title="Emitir factura fiscal oficial para esta nota"
                                                            >
                                                                <Receipt className="w-3 h-3" />
                                                                <span>Facturar</span>
                                                            </Link>
                                                        )}

                                                        {/* Botón Eliminar */}
                                                        {!isQuote && (
                                                            <button 
                                                                onClick={() => handleDelete(doc.rawId)}
                                                                className="text-red-600 hover:text-red-900 border border-red-200 px-2 py-1 rounded text-xs hover:bg-red-50 font-medium transition cursor-pointer"
                                                                title="Eliminar documento"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Barra flotante inferior de scroll horizontal rápido */}
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

export default function InvoicesPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center p-16">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <InvoicesPageContent />
        </Suspense>
    );
}
