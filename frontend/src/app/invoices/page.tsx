'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([]); // Typed as any[] to avoid 'never' error
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        try {
            setLoading(true);
            const res = await api.invoices.getAll();
            const list = res.data.data? res.data.data : (Array.isArray(res.data) ? res.data : []);
            setInvoices(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este documento permanentemente? Esta acción revertirá cualquier efecto contable o contable asociado.')) {
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
        if (statusFilter && inv.status !== statusFilter) return false;
        if (search) {
             const term = search.toLowerCase();
             const codeMatch = inv.code?.toLowerCase().includes(term);
             // Try to find client/contact name
             const name = inv.clientName || inv.contact?.name || inv.contactName || '';
             const nameMatch = name.toLowerCase().includes(term);
             return codeMatch || nameMatch;
        }
        return true;
    });

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
                    <p className="text-gray-500 text-sm">Gestiona tus documentos de cobro</p>
                </div>
                <Link href="/invoices/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center">
                    + Nueva Factura
                </Link>
            </div>
            
             <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-4">
                <input 
                    placeholder="Buscar por código o cliente..." 
                    className="flex-1 border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select 
                    className="border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    <option value="DRAFT">Borrador</option>
                    <option value="POSTED">Publicada / Por cobrar</option>
                    <option value="PAID">Pagada / Cobrada</option>
                    <option value="CANCELLED">Anulada</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                   <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">No se encontraron facturas</p>
                </div>
            ) : (
                <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Utilidad (Margen)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {filtered.map(inv => (
                                <tr key={inv.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{inv.code}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                        {inv.clientName || inv.contact?.name || inv.contactName || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-900">
                                        {Number(inv.total || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {inv.currency}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
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
                                                    <span className="font-mono text-green-600 font-semibold">
                                                        +{Number(inv.netProfit || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} {inv.currency}
                                                    </span>
                                                    <div className="text-xs text-gray-500">
                                                        Margen: {marginPercent.toFixed(1)}%
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium flex gap-2 justify-end">
                                        <Link href={`/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-900 border border-blue-200 px-3 py-1 rounded hover:bg-blue-50">
                                            Ver
                                        </Link>
                                        <button 
                                            onClick={() => handleDelete(inv.id)}
                                            className="text-red-600 hover:text-red-900 border border-red-200 px-3 py-1 rounded hover:bg-red-50"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

