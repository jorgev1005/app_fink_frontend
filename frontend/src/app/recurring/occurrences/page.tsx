"use client";
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import OccurrenceModal from './OccurrenceModal';
import BatchHistoryModal from './BatchHistoryModal';

type PageMeta = { page: number; limit: number; total: number } | null;

export default function OccurrencesPage() {
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [modalId, setModalId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined);
  const [meta, setMeta] = useState<PageMeta>(null);
  const [batchResults, setBatchResults] = useState<any[] | null>(null);
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});
  const [autoRetryRunning, setAutoRetryRunning] = useState(false);
  const [concurrency, setConcurrency] = useState<number>(() => {
    try { const v = localStorage.getItem('recurring_batch_concurrency'); return v ? Number(v) : 3; } catch { return 3; }
  });
  const [showBatchHistory, setShowBatchHistory] = useState(false);

  const counts = useMemo(() => {
    const out = { ok: 0, error: 0, skipped: 0, unknown: 0 };
    if (!batchResults) return out;
    for (const r of batchResults) {
      if (r.skipped) out.skipped += 1;
      else if (r.error) out.error += 1;
      else if (r.result) out.ok += 1;
      else out.unknown += 1;
    }
    return out;
  }, [batchResults]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const retryWithBackoff = async (id: string, maxAttempts = 3) => {
    let attempt = 0;
    const delays = [500, 1000, 2000];
    while (attempt < maxAttempts) {
      attempt += 1;
      setRetryingIds(s => ({ ...s, [id]: true }));
      try {
        const resp = await api.recurring.markPaidOccurrence(id, { autoPost: true });
        // find and update entry
        setBatchResults(prev => {
          if (!prev) return prev;
          const copy = prev.map((x:any) => ({ ...x }));
          const idx = copy.findIndex((c:any) => c.id === id);
          if (idx >= 0) {
            copy[idx].result = resp.data?.data || resp.data || { payment: resp.data?.payment };
            delete copy[idx].error;
            copy[idx].skipped = false;
          }
          return copy;
        });
        await load(1);
        return { success: true };
      } catch (err:any) {
        // if last attempt, set error
        if (attempt >= maxAttempts) {
          setBatchResults(prev => {
            if (!prev) return prev;
            const copy = prev.map((x:any) => ({ ...x }));
            const idx = copy.findIndex((c:any) => c.id === id);
            if (idx >= 0) {
              copy[idx].error = err?.response?.data?.error?.message || err?.message || String(err);
            }
            return copy;
          });
          setRetryingIds(s => { const n = { ...s }; delete n[id]; return n; });
          return { success: false };
        }
        // wait before next attempt
        await sleep(delays[Math.min(attempt - 1, delays.length - 1)]);
      } finally {
        setRetryingIds(s => { const n = { ...s }; delete n[id]; return n; });
      }
    }
    return { success: false };
  };

  const retryAllErrors = async () => {
    if (!batchResults) return;
    const errorRows = batchResults.filter(r => r.error).map(r => r.id);
    if (errorRows.length === 0) return;
    setAutoRetryRunning(true);
    const concur = concurrency || 3;
    let index = 0;
    const worker = async () => {
      while (true) {
        let id: string | undefined;
        // grab next id
        if (index < errorRows.length) {
          id = errorRows[index];
          index += 1;
        } else {
          break;
        }
        // perform retry with backoff
        // eslint-disable-next-line no-await-in-loop
        if (id) await retryWithBackoff(id, 3);
      }
    };

    const workers = Array.from({ length: Math.min(concur, errorRows.length) }, () => worker());
    await Promise.all(workers);
    setAutoRetryRunning(false);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const load = async (p = page) => {
    setLoading(true);
    try {
      const res = await api.recurring.getPendingOccurrences({ page: p, limit, projectId: projectFilter });
      setList(res.data.data || []);
      setMeta(res.data.pagination || null);
    } catch (e) {
      console.error(e);
      alert('Error fetching occurrences');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // load projects for filter
    (async () => {
      try {
        const r = await api.projects.getAll();
        setProjects(r.data.data || []);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const toggle = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const markSelected = async () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (ids.length === 0) { alert('Selecciona al menos una ocurrencia'); return; }
    const MAX_BATCH = 100;
    if (ids.length > MAX_BATCH) { alert(`Has seleccionado ${ids.length} ocurrencias. El límite por lote es ${MAX_BATCH}. Por favor selecciona menos.`); return; }
    setLoading(true);
    try {
      // Use batch endpoint to mark selected occurrences in one call
      const res = await api.recurring.markPaidBatch({ occurrenceIds: ids, autoPost: true });
      const results = res.data?.data || [];
      setBatchResults(results);
      // refresh list to reflect updated statuses
      await load(1);
      setSelected({});
    } catch (e: any) {
      console.error(e);
      alert('Error marcando ocurrencias: ' + (e?.message || JSON.stringify(e)));
    } finally { setLoading(false); }
  };

  const changePage = async (next: number) => {
    setPage(next);
    await load(next);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Ocurrencias pendientes</h2>
      <div className="mb-4 flex items-center gap-3">
        <button className="btn btn-primary" onClick={markSelected} disabled={loading}>Marcar seleccionadas como pagadas (autoPost)</button>
        <label className="flex items-center gap-2 ml-2">
          <span className="text-sm text-gray-600">Concurrency</span>
          <select className="input" value={String(concurrency)} onChange={e => { const v = Number(e.target.value); setConcurrency(v); try { localStorage.setItem('recurring_batch_concurrency', String(v)); } catch {} }}>
            <option value="1">1</option>
            <option value="3">3</option>
            <option value="5">5</option>
          </select>
        </label>
        <button className="btn btn-outline ml-2" onClick={() => load(1)} disabled={loading}>Refrescar</button>
        <button className="btn btn-ghost ml-2" onClick={() => setShowBatchHistory(true)}>Historial de lotes</button>
        <select className="ml-4" value={projectFilter || ''} onChange={e => { setProjectFilter(e.target.value || undefined); setPage(1); load(1); }}>
          <option value="">Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.code || p.name}</option>)}
        </select>
        <div className="ml-4 text-sm text-gray-600">{selectedCount} seleccionadas / 100 límite</div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-sm" disabled={!meta || meta.page <= 1} onClick={() => changePage((meta?.page || 1) - 1)}>Anterior</button>
          <span>Page {meta?.page || 1} / {Math.max(1, Math.ceil((meta?.total || 0) / (meta?.limit || limit)))}</span>
          <button className="btn btn-sm" disabled={!meta || (meta.page * meta.limit) >= (meta.total || 0)} onClick={() => changePage((meta?.page || 1) + 1)}>Siguiente</button>
        </div>
      </div>
      {loading ? <div>Cargando...</div> : (
        <div className="space-y-3">
          {list.length === 0 && <div>No hay ocurrencias pendientes.</div>}
          {list.map((o: any) => (
            <div key={o.id} className="p-3 bg-white rounded shadow-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{o.id}</div>
                <div>Factura: {o.invoice?.code} — Monto: {o.invoice?.currency} {o.invoice?.outstanding}</div>
                <div>Programado: {new Date(o.scheduledFor).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={!!selected[o.id]} onChange={() => toggle(o.id)} />
                <button className="btn btn-outline" onClick={() => setModalId(o.id)}>Ver</button>
                <button className="btn btn-fink" onClick={async () => {
                  try { await api.recurring.markPaidOccurrence(o.id, { autoPost: true }); alert('Marcada'); await load(); }
                  catch (e:any) { console.error(e); alert('Error: '+(e?.message||JSON.stringify(e))); }
                }}>Marcar pagada</button>
              </div>
            </div>
          ))}
        </div>
      )}
        {batchResults && (
          <div className="mt-4 p-3 bg-white rounded shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium">Resultados del lote</h4>
                <div className="text-sm text-gray-700">{batchResults.length} items procesados — <strong>OK:</strong> {counts.ok} &nbsp; <strong>Error:</strong> {counts.error} &nbsp; <strong>Skippado:</strong> {counts.skipped}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-1 rounded text-white bg-green-600">OK</span>
                  <span className="px-2 py-1 rounded text-white bg-gray-500">Skippado</span>
                  <span className="px-2 py-1 rounded text-white bg-red-600">Error</span>
                </div>
                <button className="btn btn-sm" onClick={() => {
                  // export CSV
                  const rows = batchResults.map((r:any) => {
                    const status = r.skipped ? 'SKIPPED' : (r.error ? 'ERROR' : (r.result ? 'OK' : 'UNKNOWN'));
                    const message = r.error ? String(r.error) : (r.skipped ? 'Skippado' : 'OK');
                    const paymentId = r.result?.payment?.id || '';
                    return { id: r.id, status, message, paymentId };
                  });
                  const csvHeader = ['id','status','message','paymentId'];
                  const csv = [csvHeader.join(',')].concat(rows.map((row:any) => {
                    const esc = (v:any) => `"${String(v || '').replace(/"/g, '""')}"`;
                    return [esc(row.id), esc(row.status), esc(row.message), esc(row.paymentId)].join(',');
                  })).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `batch_results_${Date.now()}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>Exportar resultados</button>
                <button className="btn btn-sm ml-2" disabled={autoRetryRunning || !batchResults || batchResults.filter((r:any)=>r.error).length===0} onClick={retryAllErrors}>
                  {autoRetryRunning ? 'Reintentando...' : `Reintentar autom.`}
                </button>
              </div>
            </div>

              <div className="mt-2 max-h-48 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b">
                    <th className="py-1">ID</th>
                      <th className="py-1">Acción</th>
                    <th className="py-1">Estado</th>
                    <th className="py-1">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((r:any) => {
                    const status = r.skipped ? 'SKIPPED' : (r.error ? 'ERROR' : (r.result ? 'OK' : 'UNKNOWN'));
                    const bg = status === 'OK' ? 'bg-green-50' : (status === 'SKIPPED' ? 'bg-gray-50' : 'bg-red-50');
                    const textColor = status === 'OK' ? 'text-green-700' : (status === 'SKIPPED' ? 'text-gray-700' : 'text-red-700');
                    const detail = r.error ? String(r.error) : (r.skipped ? 'Skippado' : (r.result ? `Pago ${r.result.payment?.id || 'n/a'}` : 'n/a'));
                    return (
                      <tr key={r.id} className={`${bg} border-b`}>
                          <td className="py-2 text-sm">{detail}</td>
                          <td className="py-2">
                            {status === 'ERROR' && (
                              <button className="btn btn-sm btn-outline" disabled={!!retryingIds[r.id]} onClick={async () => {
                                setRetryingIds(s => ({ ...s, [r.id]: true }));
                                try {
                                  const resp = await api.recurring.markPaidOccurrence(r.id, { autoPost: true });
                                  // update entry
                                  r.result = resp.data.data || resp.data || { payment: resp.data?.payment };
                                  delete r.error; r.skipped = false;
                                  setBatchResults(prev => prev ? [...prev] : prev);
                                  // refresh list status
                                  await load(1);
                                } catch (err:any) {
                                  r.error = err?.response?.data?.error?.message || err?.message || String(err);
                                  setBatchResults(prev => prev ? [...prev] : prev);
                                } finally { setRetryingIds(s => { const n = { ...s }; delete n[r.id]; return n; }); }
                              }}>Reintentar</button>
                            )}
                            {status === 'SKIPPED' && <span className="text-xs text-gray-600">No aplica</span>}
                            {status === 'OK' && <a className="text-sm text-blue-600" href={`/payments/${r.result?.payment?.id || ''}`} target="_blank" rel="noreferrer">Ver pago</a>}
                          </td>
                        <td className={`py-2 ${textColor} font-semibold`}>{status}</td>
                        <td className="py-2 text-sm">{detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {showBatchHistory && <BatchHistoryModal onClose={() => setShowBatchHistory(false)} />}
      {modalId && <OccurrenceModal id={modalId} onClose={() => { setModalId(null); load(); }} />}
    </div>
  );
}
