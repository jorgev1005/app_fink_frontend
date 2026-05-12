"use client";
import React, { useEffect, useState } from 'react';
import api from '../../../lib/api';

export default function OccurrenceModal({ id, onClose, onUpdated }: { id: string; onClose: () => void; onUpdated?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.recurring.getOccurrence(id);
      setData(res.data.data);
    } catch (e) {
      console.error(e);
      alert('Error cargando ocurrencia');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const markPaid = async () => {
    if (!confirm('Confirmar marcar como pagada (autoPost)?')) return;
    setLoading(true);
    try {
      await api.recurring.markPaidOccurrence(id, { autoPost: true });
      alert('Marcada como pagada');
      if (onUpdated) onUpdated();
      onClose();
    } catch (e:any) {
      console.error(e);
      alert('Error marcando como pagada: ' + (e?.message || JSON.stringify(e)));
    } finally { setLoading(false); }
  };

  if (!data) return null;

  const occ = data.occurrence;
  const logs = data.activityLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded p-4 w-[900px] max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Ocurrencia {occ.id}</h3>
          <div className="flex items-center gap-2">
            <a className="btn btn-outline" href={`/recurring/occurrences/${occ.id}`} target="_blank" rel="noreferrer">Abrir detalle</a>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <div className="mb-4">
          <div><strong>Programado:</strong> {new Date(occ.scheduledFor).toLocaleString()}</div>
          <div><strong>Status:</strong> {occ.status}</div>
          <div className="mt-2"><strong>Factura:</strong> {occ.invoice?.code} — {occ.invoice?.currency} {occ.invoice?.outstanding}</div>
          <div><strong>DueDate:</strong> {occ.invoice?.dueDate ? new Date(occ.invoice.dueDate).toLocaleDateString() : '-'}</div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium">Líneas</h4>
          {occ.invoice?.lines && occ.invoice.lines.length ? (
            <ul className="list-disc ml-5">
              {occ.invoice.lines.map((l: any, idx: number) => <li key={idx}>{l.description || ''} — {l.amount}</li>)}
            </ul>
          ) : <div>No hay líneas.</div>}
        </div>

        <div className="mb-4">
          <h4 className="font-medium">Pagos</h4>
          {occ.invoice?.payments && occ.invoice.payments.length ? (
            <ul className="list-disc ml-5">
              {occ.invoice.payments.map((p: any) => <li key={p.id}>{p.code} — {p.amount} — {p.status}</li>)}
            </ul>
          ) : <div>No hay pagos registrados.</div>}
        </div>

        <div className="mb-4">
          <h4 className="font-medium">Activity Log</h4>
          {logs.length ? (
            <ul className="list-disc ml-5">
              {logs.map((l: any) => <li key={l.id}>{new Date(l.createdAt).toLocaleString()} — {l.userId} — {l.description}</li>)}
            </ul>
          ) : <div>No hay logs.</div>}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button className="btn btn-fink" onClick={markPaid} disabled={loading}>Marcar pagada (autoPost)</button>
          <button className="btn btn-ghost" onClick={async () => {
            if (!confirm('Confirmar cancelar esta ocurrencia? Esta acción marcará la ocurrencia como CANCELLED.')) return;
            try {
              await api.recurring.cancelOccurrence(id);
              alert('Ocurrencia cancelada');
              onClose();
            } catch (e:any) { console.error(e); alert('Error cancelando: '+(e?.message||JSON.stringify(e))); }
          }}>Cancelar</button>
          <a className="btn btn-outline" href={`/recurring/occurrences/${occ.id}`} target="_blank" rel="noreferrer">Abrir detalle (editar)</a>
        </div>
      </div>
    </div>
  );
}
