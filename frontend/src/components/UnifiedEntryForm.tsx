"use client";
import React, { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function UnifiedEntryForm({ onSaved }: { onSaved?: (data: any) => void }) {
  const [mode, setMode] = useState<'SMART'|'TRANSACTION'|'INVOICE'|'PAYMENT'>('SMART');
  const [projectId, setProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BS');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [entriesText, setEntriesText] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string| null>(null);
  const [success, setSuccess] = useState<string| null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Helper: normalize various date text formats to yyyy-MM-dd (safe for <input type="date">)
  const toISODate = (raw?: string | null) => {
    if (!raw) return undefined;
    const s = String(raw).trim();
    // Already ISO-like (yyyy-mm-dd)
    const isoMatch = s.match(/^\d{4}-\d{2}-\d{2}$/);
    if (isoMatch) return s;
    // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
    const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (dmy) {
      let day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      if (!month || !year) return undefined;
      // compute last valid day for month
      const lastDay = new Date(year, month, 0).getDate();
      if (day > lastDay) day = lastDay;
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
    // fallback: try Date parse (may be locale-dependent) and produce yyyy-mm-dd
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const yy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return undefined;
  };
  // threshold configuration (stored in localStorage). Scope: 'user' or 'project'
  const [thresholdScope, setThresholdScope] = useState<'user'|'project'>('user');
  const [parseThreshold, setParseThreshold] = useState<number>(0.85);

  const STORAGE_KEY_USER = 'entry_parse_threshold';
  const STORAGE_KEY_PROJECT_PREFIX = 'entry_parse_threshold:project:';

  const readThreshold = (proj?: string) => {
    try {
      if (proj) {
        const v = localStorage.getItem(STORAGE_KEY_PROJECT_PREFIX + proj);
        if (v) return Number(v);
      }
      const vu = localStorage.getItem(STORAGE_KEY_USER);
      if (vu) return Number(vu);
    } catch (e) {
      // ignore
    }
    return 0.85;
  };

  // load threshold when projectId changes
  React.useEffect(() => {
    const p = projectId && projectId.trim() ? projectId.trim() : undefined;
    const localVal = readThreshold(p);
    // Try to read server-side preference (project+user -> user)
    (async () => {
      try {
        const params = p ? { projectId: p } : {};
        const res = await api.settings.getParseThreshold(params);
        const j = res.data;
        if (j.success && j.data?.threshold) {
          setParseThreshold(Number(j.data.threshold));
          setThresholdScope(j.data.source === 'project' ? 'project' : 'user');
        } else {
          setParseThreshold(typeof localVal === 'number' && !Number.isNaN(localVal) ? localVal : 0.85);
        }
      } catch (e) {
        setParseThreshold(typeof localVal === 'number' && !Number.isNaN(localVal) ? localVal : 0.85);
      }
    })();
  }, [projectId]);

  const persistThreshold = (val: number, scope: 'user'|'project') => {
    // Persist locally first
    try {
      if (scope === 'project' && projectId) {
        localStorage.setItem(STORAGE_KEY_PROJECT_PREFIX + projectId, String(val));
      } else {
        localStorage.setItem(STORAGE_KEY_USER, String(val));
      }
    } catch (e) {
      // ignore local storage errors
    }

    // Then persist on server; fall back to local-only on error
    (async () => {
      try {
        if (scope === 'project' && !projectId) {
          setError('ProjectId requerido para guardar por proyecto');
          return;
        }
        const body = { projectId: projectId || undefined, threshold: val, scope };
        const res = await api.settings.setParseThreshold(body);
        const j = res.data;
        if (j.success) {
          setParseThreshold(val);
          setThresholdScope(scope);
          setSuccess('Umbral guardado en servidor');
        } else {
          setParseThreshold(val);
          setThresholdScope(scope);
          setError('No se pudo guardar en servidor: ' + (j.error?.message || 'error'));
        }
      } catch (err: any) {
        setParseThreshold(val);
        setThresholdScope(scope);
        setError('Guardado local, falló persistencia remota');
      }
    })();
  };

  // Debounced auto-save when user moves the slider
  const saveTimer = React.useRef<number | null>(null);
  React.useEffect(() => {
    // If threshold changed by user, schedule persist
    if (saveTimer.current) {
      clearTimeout(saveTimer.current as any);
      saveTimer.current = null;
    }
    saveTimer.current = window.setTimeout(() => {
      persistThreshold(parseThreshold, thresholdScope);
    }, 600);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current as any);
        saveTimer.current = null;
      }
    };
  }, [parseThreshold, thresholdScope, projectId]);

  const submit = async (e: any) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    // Normalize localized number formats like "130.000,00" -> 130000
    const normalizeNumber = (v: string | number | undefined) => {
      if (v === undefined || v === null) return 0;
      if (typeof v === 'number') return v;
      const s = String(v).trim();
      if (s.length === 0) return 0;
      // Remove thousand separators (.) and replace decimal comma with dot
      const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    const amt = normalizeNumber(amount);
    if (!projectId) return setError('ProjectId required');
    if (mode !== 'INVOICE' && !(amt > 0)) return setError('Amount must be > 0');

    let lines = undefined;
    if (entriesText && entriesText.trim()) {
      try {
        lines = JSON.parse(entriesText);
      } catch (err) {
        return setError('Entries must be valid JSON');
      }
    }

    const body: any = {
      mode,
      projectId,
      currency,
      description,
      date: date || undefined,
      lines,
      autoPost
    };

    // Backend expects `total` for invoices; keep `amount` for other modes
    if (mode === 'INVOICE') {
      body.total = amt || undefined;
    } else {
      body.amount = amt || undefined;
    }

    setLoading(true);
    try {
      const res = await api.entries.create(body);
      const j = res.data;
      if (j.success) {
        setSuccess('Saved');
        onSaved?.(j.data);
      } else {
        setError(j.error?.message || 'Error');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const parseText = async () => {
    setError(null);
    setSuccess(null);
    if (!description || !description.trim()) return setError('Description required to parse');
    setPreviewLoading(true);
    try {
      const res = await api.entries.parse({ text: description });
      const j = res.data;
      if (j.success) {
        const s = j.data?.suggestion || {};
        const conf = typeof s.confidence === 'number' ? s.confidence : Number(s.confidence) || 0;
        if (conf >= parseThreshold) {
          // auto-apply high-confidence suggestions
          applyPreview(s);
          setSuccess(`Parsed suggestion auto-applied (confidence ${conf})`);
        } else {
          setPreview(s);
          setSuccess('Parsed suggestion available (preview)');
        }
      } else {
        setError(j.error?.message || 'Parse error');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Network error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyPreview = (sParam?: any) => {
    const s = sParam ?? preview;
    if (!s) return;
    if (s.mode) setMode(s.mode);
    if (s.amount) setAmount(String(s.amount));
    if (s.currency) setCurrency(s.currency);
    if (s.description) setDescription(s.description);
    // If parser returned a projectId use it; otherwise try to resolve projectName -> projectId
    if (s.projectId) {
      setProjectId(s.projectId);
    } else if (s.projectName) {
      // try to resolve by calling projects API
      (async () => {
        try {
          const resp = await api.projects.getAll();
          const body = resp.data;
          const projects = body?.data || [];
          const nameLower = (s.projectName || '').toLowerCase();
          const found = projects.find((p: any) => {
            const code = (p.code || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            return code === nameLower || name === nameLower || name.includes(nameLower) || code.includes(nameLower);
          });
          if (found) setProjectId(found.id);
        } catch (e) {
          // ignore resolution errors
        }
      })();
    }
    if (s.date) {
      const iso = toISODate(s.date);
      if (iso) setDate(iso);
      // if cannot normalize, do not set the date input (keeps it empty)
    }
    setPreview(null);
    setSuccess('Parsed suggestion applied');
  };

  const discardPreview = () => {
    setPreview(null);
    setSuccess(null);
  };

  const parseOnBlur = async () => {
    // trigger preview parse but do not auto-apply
    if (!description || description.trim().length === 0) return;
    await parseText();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    // small convenience: parse pasted text
    const pasted = e.clipboardData.getData('text');
    if (pasted && pasted.trim().length > 0) {
      // update description first, then parse
      setDescription(pasted);
      // allow state to update then call parse
      setTimeout(() => { parseText(); }, 120);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow max-w-2xl">
      <h3 className="text-lg font-semibold mb-3">Entrada rápida</h3>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-2">
          <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="input">
            <option value="SMART">Smart</option>
            <option value="TRANSACTION">Transaction</option>
            <option value="INVOICE">Invoice</option>
            <option value="PAYMENT">Payment</option>
          </select>
          <input className="input flex-1" placeholder="ProjectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          <select className="input w-28" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="BS">BS</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="flex gap-2">
          <input className="input" placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="input w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="input flex-1" placeholder="Description (free text)" value={description} onChange={(e) => setDescription(e.target.value)} onBlur={parseOnBlur} onPaste={handlePaste} />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Entries (JSON) — optional</label>
          <textarea className="input w-full" rows={4} placeholder='[ { "debitAccountId":"...", "creditAccountId":"...", "amount":100 } ]' value={entriesText} onChange={(e) => setEntriesText(e.target.value)} />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)} /> Auto-post</label>
          <button className="btn btn-fink" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          <button type="button" className="btn btn-secondary" onClick={parseText} disabled={previewLoading}>Parse</button>
        </div>

        <div className="mt-2 p-2 border rounded bg-white">
          <div className="text-sm font-medium mb-1">Umbral de auto-aplicación</div>
          <div className="flex items-center gap-2">
            <input type="range" min={0.5} max={0.99} step={0.01} value={parseThreshold} onChange={(e) => setParseThreshold(Number(e.target.value))} />
            <div className="text-sm w-20">{Math.round(parseThreshold * 100)}%</div>
            <select value={thresholdScope} onChange={(e) => setThresholdScope(e.target.value as any)} className="input w-40">
              <option value="user">Por usuario (local)</option>
              <option value="project">Por proyecto (local)</option>
            </select>
            <button className="btn btn-sm" onClick={() => persistThreshold(parseThreshold, thresholdScope)}>Guardar</button>
          </div>
          <div className="text-xs text-gray-500 mt-2">El ajuste se guarda localmente en tu navegador. Para valores persistentes entre dispositivos, integra preferencia en servidor.</div>
        </div>

        {preview && (
          <div className="p-3 border rounded bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-sm text-gray-700">Sugerencia (confianza: {preview.confidence ?? '—'})</div>
                <div className="text-sm">Modo: {preview.mode}</div>
                <div className="text-sm">Monto: {preview.amount} {preview.currency}</div>
                {preview.invoiceCode && <div className="text-sm">Factura: {preview.invoiceCode}</div>}
                {preview.projectName && <div className="text-sm">Proyecto: {preview.projectName}</div>}
                {preview.contactName && <div className="text-sm">Contacto: {preview.contactName}</div>}
                {preview.date && <div className="text-sm">Fecha: {preview.date}</div>}
                {preview.matchedRules && (
                  <div className="text-xs text-gray-600 mt-2">
                    <div className="font-medium">Reglas aplicadas:</div>
                    <ul className="list-disc pl-5">
                      {preview.matchedRules.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={applyPreview}>Aplicar</button>
                  <button className="btn btn-ghost" onClick={discardPreview}>Descartar</button>
                </div>
                {preview.confidenceBreakdown && (
                  <div className="text-xs text-gray-500">
                    <div className="font-medium">Desglose confianza:</div>
                    <pre className="text-xs bg-white p-2 rounded border">{JSON.stringify(preview.confidenceBreakdown, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-red-600">{error}</div>}
        {success && <div className="text-green-600">{success}</div>}
      </form>
    </div>
  );
}
