"use client";
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';

export default function BatchHistoryModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [viewBatch, setViewBatch] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.recurring.listBatches({ page: 1, limit: 50 });
      setBatches(res.data.data || []);
    } catch (e) {
      console.error(e);
      alert('Error cargando historial');
    } finally { setLoading(false); }
  };

  const viewDetail = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.recurring.getBatch(id);
      setViewBatch(res.data.data);
    } catch (e) {
      console.error(e);
      alert('Error cargando detalle');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded p-4 w-[900px] max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Historial de lotes</h3>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <div>
          {loading ? <div>Cargando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-600 border-b">
                  <th className="py-1">ID</th>
                  <th className="py-1">Usuario</th>
                  <th className="py-1">Items</th>
                  <th className="py-1">Fecha</th>
                  <th className="py-1">Acción</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-b">
                    <td className="py-2 font-mono text-xs">{b.id}</td>
                    <td className="py-2">{b.user?.email || b.userId}</td>
                    <td className="py-2">{(b.requestParams?.occurrenceIds || []).length || '-'}</td>
                    <td className="py-2">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <button className="text-sm text-blue-600" onClick={() => viewDetail(b.id)}>Ver</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {viewBatch && (
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <h4 className="font-medium">Batch {viewBatch.id}</h4>
            <div className="text-sm">Creado: {new Date(viewBatch.createdAt).toLocaleString()} por {viewBatch.userId}</div>
            <div className="mt-2 max-h-48 overflow-auto">
              <pre className="text-xs">{JSON.stringify(viewBatch.results, null, 2)}</pre>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn btn-sm" onClick={() => { setViewBatch(null); }}>Cerrar detalle</button>
              <button className="btn btn-sm" onClick={() => {
                const csvHeader = ['id','status','message','paymentId'];
                const rows = (viewBatch.results || []).map((r:any) => {
                  const status = r.skipped ? 'SKIPPED' : (r.error ? 'ERROR' : (r.result ? 'OK' : 'UNKNOWN'));
                  const message = r.error ? String(r.error) : (r.skipped ? 'Skippado' : 'OK');
                  const paymentId = r.result?.payment?.id || '';
                  const esc = (v:any) => `"${String(v || '').replace(/"/g, '""')}"`;
                  return [esc(r.id), esc(status), esc(message), esc(paymentId)].join(',');
                });
                const csv = [csvHeader.join(',')].concat(rows).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `batch_${viewBatch.id}_results.csv`; a.click(); URL.revokeObjectURL(url);
              }}>Exportar CSV</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
