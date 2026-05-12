"use client";
import { useEffect, useState } from "react";
import { DollarSign, Euro, Globe, TrendingUp, SlidersHorizontal } from 'lucide-react';
import api from "@/lib/api";
import SimpleModal from './SimpleModal';

interface RateEntry {
  date: string;
  usdToBs?: number;
  eurToBs?: number;
  eurToUsd?: number;
  source?: string;
  isOfficial?: boolean;
  isFallback?: boolean;
}

export default function ExchangeRatesPanel({ summary, currency }: { summary?: any; currency?: string }) {
  const [rates, setRates] = useState<{ BCV?: RateEntry; BINANCE?: RateEntry; CUSTOM?: RateEntry }>({});
  const [preferred, setPreferred] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState<string>('');
  const [savingCustom, setSavingCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallbackHelp, setShowFallbackHelp] = useState(false);

  // load function reused by refresh button
  const loadRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.exchangeRates.getLatestBySource();
      const body = resp.data;
      if (!body || !body.success) throw new Error(body?.error?.message || 'No se pudo obtener las tasas');
      setRates(body.data || {});
        // load preferred from localStorage
        const stored = typeof window !== 'undefined' ? localStorage.getItem('preferredExchangeRate') : null;
        if (stored) setPreferred(stored);
      // notify listeners that rates were loaded (so dashboard can sync)
      try { window.dispatchEvent(new CustomEvent('exchangeRatesLoaded', { detail: { rates: body.data } })); } catch {}
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  // normalize rate source coming from backend for UI comparisons
  const resolvedRateSource = (() => {
    const s = (summary as any)?.rateUsed?.source;
    if (!s) return null;
    // backend stores BINANCE rates as source 'API' (Prisma enum), so map it for the UI
    if (s === 'API') return 'BINANCE';
    // map BCV_OFFICIAL to BCV for card highlighting, but the preferred value may be 'BCV_OFFICIAL'
    if (s === 'BCV_OFFICIAL') return 'BCV';
    return s;
  })();

  // Determine which key should be considered active for highlighting
  const activePreferredKey = (() => {
    if (preferred) return preferred;
    // if no explicit preferred, derive from summary.rateUsed
    const s = (summary as any)?.rateUsed;
    if (!s) return null;
    const src = s.source;
    if (src === 'API') return 'BINANCE';
    if (src === 'BCV') {
      // default to BCV_OFFICIAL when backend returned BCV
      return 'BCV_OFFICIAL';
    }
    if (src === 'CUSTOM') return 'CUSTOM';
    return src;
  })();

  return (
    <div className="bg-white p-3 rounded shadow border border-gray-200">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold mb-2">Tasas de cambio</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadRates}
            disabled={loading}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-60">
            {loading ? '⏳ Refrescando...' : 'Refrescar tasa'}
          </button>
          <button
            type="button"
            onClick={() => setShowFallbackHelp(true)}
            title="¿Qué es FALLBACK?"
            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-200">
            ¿Fallback?
          </button>
        </div>
            <div className="mt-2 text-xs text-gray-500">
              Al elegir una fuente preferida, la tasa numérica se guarda automáticamente y se sincroniza con la Transacción Rápida. (Clave localStorage: <code>selected_exchange_rate</code>)
            </div>
      </div>
      {loading && <div className="text-xs text-gray-500">Cargando tasas...</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 p-2">
            <div className="text-xs text-gray-500">Fuente preferida para consultas</div>
            <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
              {/* Replace radios with square pink buttons */}
              {(function () {
                const customId = (rates.CUSTOM as any)?.id;
                const btn = (key: string, label: string, isFallback?: boolean, valueIsId?: boolean) => {
                  const value = valueIsId && customId ? customId : key;
                  const active = preferred === value;
                  return (
                    <button
                      type="button" 
                      key={key}
                      onClick={() => {
                        setPreferred(value);
                        try { if (typeof window !== 'undefined') localStorage.setItem('preferredExchangeRate', value); } catch {}
                        
                        // Calculate numeric rate
                        let numericRate: number | null = null;
                        const r: any = rates || {};
                        
                        if (value === 'BCV_OFFICIAL' || value === 'BCV') numericRate = r.BCV?.usdToBs ?? null;
                        else if (value === 'BCV_EUR') numericRate = r.BCV?.eurToBs ?? null;
                        else if (value === 'BINANCE') numericRate = r.BINANCE?.usdToBs ?? null;
                        else if (value === 'CUSTOM') numericRate = r.CUSTOM?.usdToBs ?? null;
                        else {
                            const custom = r.CUSTOM;
                            if (custom && custom.id === value) numericRate = custom.usdToBs ?? null;
                        }

                        // Debug log to console
                        console.log('Selected rate:', value, 'Numeric:', numericRate);

                        if (numericRate && !isNaN(Number(numericRate))) {
                            try { localStorage.setItem('selected_exchange_rate', String(Number(numericRate))); } catch (e) {}
                        } else {
                            // If rate is missing/invalid, maybe warn or allow but it won't be used for calculations
                        }
                        try { window.dispatchEvent(new CustomEvent('preferredExchangeRateChanged', { detail: value })); } catch {}
                      }}
                      className={"flex items-center gap-2 px-1 py-1 sm:px-3 sm:py-2 rounded-md shadow-sm text-xs sm:text-sm border min-w-[56px] sm:min-w-[120px] justify-center " + (active ? 'btn-fink btn-fink-outline' : 'bg-white text-gray-700 border-gray-200 hover:bg-[rgba(217,63,101,0.06)]')}
                    >
                      {/* icon visible on small screens, hidden from md up */}
                      <span className="block sm:hidden">
                        {key === 'BCV_OFFICIAL' && <DollarSign className="w-4 h-4" />}
                        {key === 'BCV_EUR' && <Euro className="w-4 h-4" />}
                        {key === 'BINANCE' && <TrendingUp className="w-4 h-4" />}
                        {key === 'CUSTOM' && <SlidersHorizontal className="w-4 h-4" />}
                      </span>
                      {/* text visible from small/md up; hidden on very small screens */}
                      <span className="hidden sm:inline font-medium text-xs sm:text-sm">{label}</span>
                      {isFallback ? <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">FALLBACK</span> : null}
                    </button>
                  );
                };

                // If the page's currency is USD, emphasize and show the four preferred sources as square buttons
                if (currency === 'USD') {
                  return [
                    btn('BCV_OFFICIAL', 'BCV USD (oficial)', rates.BCV?.isFallback),
                    btn('BCV_EUR', 'EURO (oficial)'),
                    btn('BINANCE', 'BINANCE', rates.BINANCE?.isFallback),
                    btn('CUSTOM', 'CUSTOM', rates.CUSTOM?.isFallback, true),
                  ];
                }

                // For other currencies show a compact button set (still square/pink style)
                return [
                  btn('BCV_OFFICIAL', 'BCV USD', rates.BCV?.isFallback),
                    btn('BCV_EUR', 'EURO (oficial)', rates.BCV?.isFallback),
                  btn('BINANCE', 'BINANCE', rates.BINANCE?.isFallback),
                  btn('CUSTOM', 'CUSTOM', rates.CUSTOM?.isFallback, true),
                ];
              })()}
            </div>
          </div>
          {/* BCV group: separate USD and EUR official cards with clearer subtitles */}
          <div className="col-span-2 p-2 border rounded bg-white">
            <div className="text-sm font-semibold text-gray-700">BCV (Banco Central de Venezuela) — Tasas oficiales</div>
            <div className="text-xs text-gray-500">Tasas publicadas por el BCV. Selecciona USD (oficial) o EURO (oficial).</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className={"p-2 rounded " + ((activePreferredKey === 'BCV_OFFICIAL' || (resolvedRateSource === 'BCV' && activePreferredKey === null)) ? 'bg-red-50 border border-red-200' : 'border border-gray-100')}>
                <div className="text-xs text-gray-600 font-semibold">USD → Bs (Oficial)</div>
                <div className="font-medium mt-1">{rates.BCV?.usdToBs ? `Bs ${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(Number(rates.BCV.usdToBs))}` : '—'}</div>
                <div className="text-xs text-gray-400">{rates.BCV?.date ? new Date(rates.BCV.date).toLocaleString() : ''}</div>
              </div>

              <div className={"p-2 rounded " + ((activePreferredKey === 'BCV_EUR' || (resolvedRateSource === 'BCV' && summary?.rateUsed?.eurToBs && activePreferredKey === null)) ? 'bg-red-50 border border-red-200' : 'border border-gray-100')}>
                <div className="text-xs text-gray-600 font-semibold">EUR → Bs (Oficial)</div>
                <div className="font-medium mt-1">{rates.BCV?.eurToBs ? `Bs ${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(Number(rates.BCV.eurToBs))}` : '—'}</div>
                <div className="text-xs text-gray-400">{rates.BCV?.date ? new Date(rates.BCV.date).toLocaleString() : ''}</div>
              </div>
            </div>
          </div>

          <div className={"p-2 " + ((activePreferredKey === 'BINANCE' || resolvedRateSource === 'BINANCE') ? 'bg-red-50 border border-red-200' : '')}>
            <div className="text-xs text-gray-500">USD (Binance)</div>
            <div className="font-medium">{rates.BINANCE?.usdToBs ? `Bs ${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(Number(rates.BINANCE.usdToBs))}` : (rates.BINANCE?.usdToBs === 0 ? '0' : '—')}</div>
            <div className="text-xs text-gray-400">{rates.BINANCE?.date ? new Date(rates.BINANCE.date).toLocaleString() : ''}</div>
          </div>

          <div className={"p-2 " + ((activePreferredKey === 'CUSTOM' || (resolvedRateSource === 'CUSTOM') || (activePreferredKey && activePreferredKey === (rates.CUSTOM as any)?.id)) ? 'bg-red-50 border border-red-200' : '')}>
            <div className="text-xs text-gray-500">USD (Custom)</div>
            <div className="font-medium">{rates.CUSTOM?.usdToBs ? `Bs ${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2}).format(Number(rates.CUSTOM.usdToBs))}` : '—'}</div>
            <div className="text-xs text-gray-400">{rates.CUSTOM?.date ? new Date(rates.CUSTOM.date).toLocaleString() : ''}</div>
          </div>
        </div>
      )}
      {/* Custom rate editor when user selected CUSTOM */}
      {!loading && !error && (preferred === 'CUSTOM' || (rates.CUSTOM && preferred === (rates.CUSTOM as any)?.id)) && (
        <div className="mt-3 border-t pt-3">
          <div className="text-xs text-gray-500 mb-2">Configurar USD → Bs (Custom)</div>
          <div className="flex gap-2 items-center">
            <input value={customValue} onChange={(e) => setCustomValue(e.target.value)} placeholder={rates.CUSTOM?.usdToBs ? String(rates.CUSTOM.usdToBs) : 'Ej: 250000'} className="border px-2 py-1 rounded text-sm" />
            <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm" disabled={savingCustom} onClick={async () => {
              const val = Number(customValue.replace(/[,\s]/g, ''));
              if (!val || val <= 0) return alert('Ingrese un valor numérico válido para USD → Bs');
              setSavingCustom(true);
              try {
                // derive eurToBs using BCV eurToUsd if available
                const bcv = rates.BCV as any;
                const eurToUsd = bcv?.eurToUsd ? Number(bcv.eurToUsd) : undefined;
                const eurToBs = eurToUsd ? (eurToUsd * val) : undefined;
                const resp = await api.exchangeRates.createCustom({ usdToBs: val, eurToBs });
                if (!resp?.data?.success) throw new Error(resp?.data?.error?.message || 'Error creando tasa custom');
                const created = resp.data.data;
                setRates(prev => ({ ...prev, CUSTOM: created }));
                setPreferred(created.id);
                if (typeof window !== 'undefined') localStorage.setItem('preferredExchangeRate', created.id);
              } catch (err: any) {
                alert(err?.message || String(err));
              } finally {
                setSavingCustom(false);
              }
            }}>Guardar</button>
          </div>
        </div>
      )}
      <SimpleModal open={showFallbackHelp} title="¿Qué significa FALLBACK?" onClose={() => setShowFallbackHelp(false)}>
        <p className="mb-2">Cuando una fuente remota (por ejemplo BCV o BINANCE) no está disponible, la aplicación inserta una tasa <strong>FALLBACK</strong> usando valores preconfigurados o una tasa custom guardada. Esto indica que la tasa no fue recogida en tiempo real desde la API oficial.</p>
        <p className="text-xs text-gray-500">Si eres administrador puedes forzar una actualización desde el servidor para intentar obtener la tasa oficial más reciente.</p>
      </SimpleModal>
    </div>
  );
}
