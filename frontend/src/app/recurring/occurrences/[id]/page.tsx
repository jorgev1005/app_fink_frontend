"use client";
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../../../lib/api';

export default function OccurrenceDetailPage({ params }: any) {
  const id = params?.id;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [invoiceDueDate, setInvoiceDueDate] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.recurring.getOccurrence(id);
      setData(res.data.data);
      const occ = res.data.data.occurrence;
      setScheduledFor(new Date(occ.scheduledFor).toISOString().slice(0,16));
      setInvoiceDueDate(occ.invoice?.dueDate ? new Date(occ.invoice.dueDate).toISOString().slice(0,10) : '');
    } catch (e) {
      console.error(e);
      alert('Error cargando ocurrencia');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const save = async () => {
    if (!confirm('Guardar cambios en la ocurrencia?')) return;
    setLoading(true);
    try {
      await api.recurring.updateOccurrence(id, { scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null, invoiceDueDate: invoiceDueDate || null });
      alert('Guardado');
      router.back();
    } catch (e) {
      console.error(e);
      alert('Error guardando cambios');
    } finally { setLoading(false); }
  };

  const cancelOccurrence = async () => {
    if (!confirm('Confirmar cancelar esta ocurrencia?')) return;
    setLoading(true);
    try {
      await api.recurring.cancelOccurrence(id);
      alert('Ocurrencia cancelada');
      router.back();
    } catch (e) {
      console.error(e);
      alert('Error cancelando ocurrencia');
    } finally { setLoading(false); }
  };

  if (!data) return <div>Cargando...</div>;

  const occ = data.occurrence;
  const logs = data.activityLogs || [];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Detalle Ocurrencia {id}</h2>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm">Programado</label>
          <input className="input" type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm">Due Date (Factura)</label>
          <input className="input" type="date" value={invoiceDueDate} onChange={e => setInvoiceDueDate(e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium">Factura</h4>
        <div>Code: {occ.invoice?.code}</div>
        <div>Outstanding: {occ.invoice?.outstanding}</div>
        <div>Currency: {occ.invoice?.currency}</div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium">Líneas</h4>
        {occ.invoice?.lines && occ.invoice.lines.length ? (
          <ul className="list-disc ml-5">{occ.invoice.lines.map((l:any,i:number)=>(<li key={i}>{l.description} — {l.amount}</li>))}</ul>
        ) : <div>No hay líneas.</div>}
      </div>

      <div className="mb-4">
        <h4 className="font-medium">Pagos</h4>
        {occ.invoice?.payments && occ.invoice.payments.length ? (
          <ul className="list-disc ml-5">{occ.invoice.payments.map((p:any)=>(<li key={p.id}>{p.code} — {p.amount} — {p.status}</li>))}</ul>
        ) : <div>No hay pagos.</div>}
      </div>

      <div className="mb-4">
        <h4 className="font-medium">Activity Log</h4>
        {logs.length ? (
          <ul className="list-disc ml-5">{logs.map((l:any)=>(<li key={l.id}>{new Date(l.createdAt).toLocaleString()} — {l.userId} — {l.description}</li>))}</ul>
        ) : <div>No hay logs.</div>}
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={save} disabled={loading}>Guardar</button>
        <button className="btn" onClick={() => router.back()}>Cancelar</button>
      </div>
    </div>
  );
}
