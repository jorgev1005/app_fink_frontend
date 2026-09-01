'use client';

import { useState, useEffect } from 'react';
import api, { projectsAPI } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [projectFilter, setProjectFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [originFilter, setOriginFilter] = useState('');
    const [search, setSearch] = useState('');

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
        
        if (originFilter === 'POS' && !inv.code?.startsWith('POS-')) return false;
        if (originFilter === 'DELIVERY_NOTE' && !inv.code?.startsWith('NE')) return false;
        if (originFilter === 'STANDARD' && (inv.code?.startsWith('POS-') || inv.code?.startsWith('NE'))) return false;

        if (search) {
             const term = search.toLowerCase();
             const codeMatch = inv.code?.toLowerCase().includes(term);
             const name = inv.clientName || inv.contact?.name || inv.contactName || '';
             const nameMatch = name.toLowerCase().includes(term);
             const projectMatch = (inv.project?.name || '').toLowerCase().includes(term);
             return codeMatch || nameMatch || projectMatch;
        }
        return true;
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Facturas & Ventas
                        {projectFilter && (
                            <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full">
                                {projects.find(p => p.id === projectFilter)?.name || 'Proyecto'}
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 text-sm">Gestiona tus documentos de cobro, notas de entrega y ventas de mostrador POS</p>
                </div>
                <div className="flex items-center gap-2">
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
                <div className="flex-1">
                    <input 
                        placeholder="Buscar por código, cliente o proyecto..." 
                        className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Filtro de Proyecto */}
                <select 
                    className="border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-sm text-gray-700 min-w-[200px]"
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
                    <option value="">Todos los tipos de venta</option>
                    <option value="POS">🛒 Ventas POS (Caja)</option>
                    <option value="STANDARD">📄 Facturas Administrativas</option>
                    <option value="DELIVERY_NOTE">📦 Notas de Entrega</option>
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
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proyecto</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilidad (Margen)</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {filtered.map(inv => {
                                    const isPos = Boolean(inv.posSessionId);
                                    const isNE = inv.code?.startsWith('NE');
                                    const projectName = inv.project?.name || projects.find(p => p.id === inv.projectId)?.name || 'General';

                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50/80 transition">
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-gray-900 font-mono text-xs sm:text-sm">{inv.code}</span>
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
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">
                                                    📁 {projectName}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 text-xs sm:text-sm">
                                                <div className="font-medium text-gray-900">{inv.clientName || inv.contact?.name || inv.contactName || '-'}</div>
                                                {inv.contact?.taxId && (
                                                    <div className="text-[10px] text-gray-400 font-mono">{inv.contact.taxId}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 text-xs">
                                                {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-bold text-gray-900">
                                                {Number(inv.total || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {inv.currency}
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                                {inv.type === 'INVOICE' && inv.status === 'PAID' ? (() => {
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
                                                      inv.status === 'POSTED' ? (inv.type === 'BILL' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800') : 
                                                      inv.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                                      'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {
                                                     inv.status === 'POSTED' ? (inv.type === 'BILL' ? 'POR PAGAR' : 'POR COBRAR') : 
                                                     inv.status === 'PAID' ? (inv.type === 'BILL' ? 'PAGADA' : 'COBRADA') : 
                                                     inv.status === 'DRAFT' ? 'BORRADOR' : inv.status
                                                    }
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 whitespace-nowrap text-right font-medium">
                                                <div className="flex gap-1.5 justify-end">
                                                    <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-900 border border-blue-200 px-2.5 py-1 rounded text-xs hover:bg-blue-50 font-semibold transition">
                                                        Ver
                                                    </Link>
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
            )}
        </div>
    );
}


