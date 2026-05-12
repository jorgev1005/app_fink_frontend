'use client';

import { useState, useEffect, useRef } from 'react';
import { Calculator, X, RefreshCw, GripHorizontal, Copy, Check } from 'lucide-react';
import api from '@/lib/api';

const RATE_STYLE_MAP = {
  blue: {
    row: 'bg-blue-50/50 border-blue-100/50 hover:bg-blue-100/50',
    text: 'text-blue-700',
    grip: 'text-blue-400',
    gripHover: 'group-hover:text-blue-600',
    copy: 'text-blue-600',
    hoverBorder: 'hover:border-blue-200',
  },
  emerald: {
    row: 'bg-emerald-50/50 border-emerald-100/50 hover:bg-emerald-100/50',
    text: 'text-emerald-700',
    grip: 'text-emerald-400',
    gripHover: 'group-hover:text-emerald-600',
    copy: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-200',
  },
  amber: {
    row: 'bg-amber-50/50 border-amber-100/50 hover:bg-amber-100/50',
    text: 'text-amber-700',
    grip: 'text-amber-400',
    gripHover: 'group-hover:text-amber-600',
    copy: 'text-amber-600',
    hoverBorder: 'hover:border-amber-200',
  },
  purple: {
    row: 'bg-purple-50/50 border-purple-100/50 hover:bg-purple-100/50',
    text: 'text-purple-700',
    grip: 'text-purple-400',
    gripHover: 'group-hover:text-purple-600',
    copy: 'text-purple-600',
    hoverBorder: 'hover:border-purple-200',
  },
} as const;

type RateStyleKey = keyof typeof RATE_STYLE_MAP;

export default function CalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [baseCurrency, setBaseCurrency] = useState<'VES' | 'USD'>('VES');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
      setOffset({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      });
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
      activePointerId.current = null;
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handleGlobalPointerMove);
      window.addEventListener('pointerup', handleGlobalPointerUp);
      window.addEventListener('pointercancel', handleGlobalPointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isDragging]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-no-drag="true"]')) return;
    activePointerId.current = e.pointerId;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const [rates, setRates] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (isOpen) fetchRates();
  }, [isOpen]);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const resp = await api.exchangeRates.getLatestBySource();
      if (resp.data?.success) {
        setRates(resp.data.data || {});
      }
    } catch (error) {
      console.error('Error fetching rates for calculator', error);
    } finally {
      setLoading(false);
    }
  };

  const getConvertedResult = (rateEntry: any, name: string) => {
    if (!rateEntry || !rateEntry.usdToBs) return { text: "N/A", raw: 0 };
    const val = Number(amount) || 0;
    if (val === 0) return { text: "0.00", raw: 0 };
    
    if (baseCurrency === "VES") {
      const result = val / rateEntry.usdToBs;
      const cur = name.includes("EURO") ? "€" : "$";
      if (name === "EURO BCV" && rateEntry.eurToUsd) {
         const rh = result / rateEntry.eurToUsd;
         return { text: `€ ${rh.toFixed(2)}`, raw: rh.toFixed(2) };
      }
      return { text: `${cur} ${result.toFixed(2)}`, raw: result.toFixed(2) };
    } else {
      const bsResult = val * rateEntry.usdToBs;
      if (name === "EURO BCV" && rateEntry.eurToUsd) {
          const resBs = val * rateEntry.eurToUsd * rateEntry.usdToBs;
          return { text: `Bs ${resBs.toFixed(2)}`, raw: resBs.toFixed(2) };      
      }
      return { text: `Bs ${bsResult.toFixed(2)}`, raw: bsResult.toFixed(2) };
    }
  };
  return (
    <>
      {/* Floating Button right above QuickActionButton */}
      {/* Assuming QuickActionButton is bottom-6, right-6, we'll put this slightly higher */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-[104px] right-6 z-40 bg-indigo-600 text-white p-3.5 rounded-2xl shadow-xl shadow-indigo-200/50 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 group"
          title="Calculadora Rápida"
        >
          <Calculator size={24} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Modal / Popup */}
      {isOpen && (
        <div className="fixed sm:bottom-[104px] sm:right-6 bottom-0 left-0 sm:left-auto right-0 z-[999] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 sm:w-80 w-full animate-in slide-in-from-bottom-5 transition-shadow" style={offset.x !== 0 || offset.y !== 0 ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : {}}>
          <div className="flex bg-slate-50 items-center justify-between p-4 border-b border-slate-200 sm:rounded-t-2xl rounded-t-2xl cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors touch-none" onPointerDown={handlePointerDown}>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Calculator size={18} className="text-indigo-600" />
              Calculadora de Costos
            </h3>
            <div className="flex items-center gap-2">
              <button data-no-drag="true" onPointerDown={(e) => e.stopPropagation()} onClick={fetchRates} className={`text-slate-400 hover:text-indigo-600 ${loading ? 'animate-spin' : ''}`}>
                <RefreshCw size={16} />
              </button>
              <button data-no-drag="true" onPointerDown={(e) => e.stopPropagation()} onClick={toggleOpen} className="text-slate-400 hover:text-red-500">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Monto a Consultar</label>
                <input
                  type="number"
                  placeholder="Ej: 1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full border-slate-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-slate-500 mb-1">Moneda</label>
                <select
                  value={baseCurrency}
                  onChange={(e: any) => setBaseCurrency(e.target.value)}
                  className="w-full border-slate-200 rounded-lg p-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-semibold bg-slate-50"
                >
                  <option value="VES">Bs</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              
              {[
                { key: 'USD BCV', rate: rates?.BCV, color: 'blue' as RateStyleKey },
                { key: 'EURO BCV', rate: rates?.BCV, color: 'emerald' as RateStyleKey },
                { key: 'BINANCE', rate: rates?.BINANCE, color: 'amber' as RateStyleKey },
                { key: 'CUSTOM', rate: rates?.CUSTOM, color: 'purple' as RateStyleKey }
              ].map(item => {
                const res = getConvertedResult(item.rate, item.key);
                const styles = RATE_STYLE_MAP[item.color];
                return (
                  <div key={item.key} className={`flex justify-between items-center group p-2 rounded-lg border transition-colors ${styles.row}`}>
                    <span className="text-sm font-medium text-slate-600 flex-1">{item.key}</span>
                    <div className="flex items-center gap-2">
                       <span
                         className={`font-bold cursor-grab active:cursor-grabbing px-2 py-1 -my-1 rounded-md border border-transparent flex items-center gap-1 bg-white/50 ${styles.text} ${styles.hoverBorder}`}
                         draggable
                         title="Arrastrar monto a un campo"
                         onDragStart={(e) => {
                           if(res.raw) {
                             e.dataTransfer.setData("text/plain", res.raw.toString());
                             e.dataTransfer.effectAllowed = "copy";
                           }
                         }}
                       >
                         <GripHorizontal size={14} className={`opacity-0 group-hover:opacity-100 mr-0.5 transition-opacity ${styles.grip} ${styles.gripHover}`} />
                         {res.text}
                       </span>
                       <button
                         data-no-drag="true"
                         onPointerDown={(e) => e.stopPropagation()}
                         onClick={() => { if(res.raw){ navigator.clipboard.writeText(res.raw.toString()); setCopiedKey(item.key); setTimeout(()=>setCopiedKey(null),2000); } }}
                         className={`p-1.5 rounded-md transition-colors hover:bg-white ${styles.copy}`}
                         title="Copiar monto"
                       >
                         {copiedKey === item.key ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                       </button>
                    </div>
                  </div>
                );
              })}

            </div>

            <p className="text-[10px] text-slate-400 text-center !mt-4">
              Usando las tasas actualizadas del sistema.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
