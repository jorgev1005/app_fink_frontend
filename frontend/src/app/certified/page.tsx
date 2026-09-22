'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  Download, 
  Eye, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Calendar,
  FileText,
  User,
  Phone,
  Hash,
  Activity,
  Layers
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface AuditLog {
  id: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  payload?: string;
  createdAt: string;
}

interface CertifiedDelivery {
  id: string;
  docCategory: 'INVOICE' | 'QUOTATION' | 'DELIVERY_NOTE' | 'PURCHASE_ORDER' | string;
  documentNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  recipientTaxId?: string;
  title?: string;
  totalAmount?: number;
  currency?: string;
  fileUrl: string;
  fileHashSha256: string;
  token: string;
  status: 'SENT' | 'VIEWED' | 'CONFIRMED' | 'REJECTED' | string;
  sentAt: string;
  firstViewedAt?: string;
  confirmedAt?: string;
  clientNotes?: string;
  createdAt: string;
  trackingUrl: string;
  actaUrl: string;
  _count?: {
    auditLogs: number;
  };
  auditLogs?: AuditLog[];
}

export default function CertifiedAuditPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<CertifiedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal de detalle forense
  const [selectedDelivery, setSelectedDelivery] = useState<CertifiedDelivery | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await (apiClient as any).get(`/api/certified/deliveries?${params.toString()}`);
      if (res.data?.success) {
        setDeliveries(res.data.data);
      }
    } catch (err: any) {
      console.error('Error cargando certificados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeliveries();
  };

  const openAuditDetail = async (item: CertifiedDelivery) => {
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const res = await (apiClient as any).get(`/api/certified/deliveries/${item.id}`);
      if (res.data?.success) {
        setSelectedDelivery(res.data.data);
      } else {
        setSelectedDelivery(item);
      }
    } catch (e) {
      setSelectedDelivery(item);
    } finally {
      setDetailLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = deliveries.length;
    const confirmed = deliveries.filter(d => d.status === 'CONFIRMED').length;
    const viewed = deliveries.filter(d => d.status === 'VIEWED').length;
    const sent = deliveries.filter(d => d.status === 'SENT').length;
    return { total, confirmed, viewed, sent };
  }, [deliveries]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={13} className="text-emerald-600" /> Confirmado
          </span>
        );
      case 'VIEWED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Eye size={13} className="text-blue-600" /> Visto por Cliente
          </span>
        );
      case 'SENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={13} className="text-amber-600" /> Enviado (Sin Abrir)
          </span>
        );
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'INVOICE': return { label: 'Factura', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'QUOTATION': return { label: 'Cotización', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'DELIVERY_NOTE': return { label: 'Nota de Entrega', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'PURCHASE_ORDER': return { label: 'Orden de Compra', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      default: return { label: cat, color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur border border-slate-700/60 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              title="Volver al Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-7 h-7 text-cyan-400" />
                <h1 className="text-2xl font-black tracking-tight text-white">Auditoría de Certificados Digitales</h1>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Trazabilidad fehaciente, hash SHA-256 e historial de recepción de documentos en tiempo real
              </p>
            </div>
          </div>

          <button
            onClick={fetchDeliveries}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-cyan-900/30 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-slate-400 uppercase font-semibold">Total Emitidos</div>
            <div className="text-2xl font-black text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-emerald-400 uppercase font-semibold">Confirmados</div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{stats.confirmed}</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-blue-400 uppercase font-semibold">Vistos</div>
            <div className="text-2xl font-black text-blue-400 mt-1">{stats.viewed}</div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-xl">
            <div className="text-xs text-amber-400 uppercase font-semibold">Pendientes</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{stats.sent}</div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="w-full md:w-80 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar número, cliente, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
              <Filter size={14} /> Filtrar:
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="INVOICE">Facturas</option>
              <option value="DELIVERY_NOTE">Notas de Entrega</option>
              <option value="QUOTATION">Cotizaciones</option>
              <option value="PURCHASE_ORDER">Órdenes de Compra</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">Todos los estados</option>
              <option value="CONFIRMED">Confirmados</option>
              <option value="VIEWED">Vistos</option>
              <option value="SENT">Enviados</option>
            </select>
          </div>
        </div>

        {/* Tabla de Certificaciones */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="animate-spin text-cyan-400" size={30} />
              <p className="text-sm">Cargando pistas de auditoría...</p>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <ShieldCheck size={40} className="mx-auto text-slate-600 mb-2" />
              <p className="font-semibold text-white">No se encontraron certificados</p>
              <p className="text-xs text-slate-500 mt-1">Aún no se han generado certificados bajo estos criterios.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/70 text-slate-400 uppercase tracking-wider border-b border-slate-700">
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Destinatario</th>
                    <th className="py-3 px-4">Monto</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Emisión</th>
                    <th className="py-3 px-4">Visto / Confirmado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {deliveries.map((item) => {
                    const catInfo = getCategoryLabel(item.docCategory);
                    return (
                      <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className="font-mono font-bold text-white text-sm">
                              {item.documentNumber}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[200px]" title={item.fileHashSha256}>
                            SHA: {item.fileHashSha256.slice(0, 16)}...
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{item.recipientName}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {item.recipientPhone || 'Sin teléfono'}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-200">
                          {item.totalAmount ? `$${Number(item.totalAmount).toFixed(2)}` : '—'}
                        </td>

                        <td className="py-3 px-4">
                          {getStatusBadge(item.status)}
                        </td>

                        <td className="py-3 px-4 text-slate-400">
                          {new Date(item.sentAt || item.createdAt).toLocaleDateString('es-VE')}
                          <span className="block text-[10px] text-slate-500">
                            {new Date(item.sentAt || item.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-400">
                          {item.confirmedAt ? (
                            <span className="text-emerald-400 font-medium">
                              {new Date(item.confirmedAt).toLocaleDateString('es-VE')} {new Date(item.confirmedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : item.firstViewedAt ? (
                            <span className="text-blue-400 font-medium">
                              {new Date(item.firstViewedAt).toLocaleDateString('es-VE')} {new Date(item.firstViewedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openAuditDetail(item)}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-cyan-300 rounded-lg transition"
                              title="Ver Registro Forense y Línea de Tiempo"
                            >
                              <Activity size={14} />
                            </button>
                            
                            <a
                              href={item.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition"
                              title="Abrir Visor Público"
                            >
                              <ExternalLink size={14} />
                            </a>

                            <a
                              href={item.actaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-400 rounded-lg transition"
                              title="Descargar Acta de Certificación en PDF"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Detalle de Auditoría */}
        {showDetailModal && selectedDelivery && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-cyan-400" size={20} />
                  <span className="font-bold text-white text-base">
                    Auditoría Forense: {selectedDelivery.documentNumber}
                  </span>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
                
                {/* Resumen */}
                <div className="grid grid-cols-2 gap-3 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                  <div>
                    <span className="text-slate-500">Destinatario:</span>
                    <p className="font-bold text-white mt-0.5">{selectedDelivery.recipientName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Teléfono:</span>
                    <p className="font-mono text-white mt-0.5">{selectedDelivery.recipientPhone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Estado:</span>
                    <div className="mt-1">{getStatusBadge(selectedDelivery.status)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Documento:</span>
                    <p className="font-mono font-bold text-emerald-400 mt-0.5">
                      {selectedDelivery.totalAmount ? `$${Number(selectedDelivery.totalAmount).toFixed(2)}` : '—'}
                    </p>
                  </div>
                </div>

                {/* Integridad Criptográfica */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Huella Criptográfica SHA-256</span>
                    <span className="text-[10px] bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800 font-semibold">Inmutable</span>
                  </div>
                  <p className="font-mono text-[11px] text-cyan-300 mt-2 break-all bg-slate-900/80 p-2 rounded border border-slate-800">
                    {selectedDelivery.fileHashSha256}
                  </p>
                </div>

                {/* Línea de tiempo */}
                <div>
                  <h4 className="font-bold text-white mb-3 flex items-center gap-1.5">
                    <Activity size={14} className="text-cyan-400" />
                    Eventos Registrados ({selectedDelivery.auditLogs?.length || 0})
                  </h4>

                  {detailLoading ? (
                    <div className="py-6 text-center text-slate-500">Cargando eventos...</div>
                  ) : !selectedDelivery.auditLogs || selectedDelivery.auditLogs.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 bg-slate-800/40 rounded-xl">Sin eventos registrados aún</div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedDelivery.auditLogs.map((log: any, index: number) => (
                        <div key={index} className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-xl flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="font-bold text-white text-xs inline-block bg-slate-700 px-2 py-0.5 rounded">
                              {log.eventType}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              <span className="text-slate-500">IP:</span> {log.ipAddress || 'Interna / Servidor'}
                            </div>
                            {log.userAgent && (
                              <div className="text-[10px] text-slate-500 truncate max-w-md" title={log.userAgent}>
                                {log.userAgent}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('es-VE')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                <a
                  href={selectedDelivery.actaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl transition"
                >
                  <Download size={14} />
                  Descargar Acta Oficial en PDF
                </a>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
