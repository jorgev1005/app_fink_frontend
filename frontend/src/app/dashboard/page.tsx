"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, Calculator, LogOut, Zap, Plus, FileText, Users, BarChart3, Wallet, ArrowRight, Info, ChevronDown, ChevronUp, Layers, Tag, FileClock, Eye, EyeOff, Package, ArrowRightLeft, HardDrive, Banknote, Settings, ShoppingCart, FileCheck } from 'lucide-react';

import NotificationBell from "@/components/NotificationBell";
import ExchangeRatesPanel from '@/components/ExchangeRatesPanel';
import ForexImpactWidget from '@/components/ForexImpactWidget';
import CFOWidget from '@/components/CFOWidget';
import InterProjectTransferModal from '@/components/InterProjectTransferModal';
import IntraProjectTransferModal from '@/components/IntraProjectTransferModal';
import api from "@/lib/api";

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  description?: string;
  color?: string;
  transactionCount: number;
  income?: number;
  expenses?: number;
  balance?: number;
  incomeBs?: number;
  expensesBs?: number;
  balanceBs?: number;
  accountsBalanceUsd?: number;
  accountsBalanceBs?: number;
  incomeUsd?: number;
  expensesUsd?: number;
  balanceUsd?: number;
}

interface DashboardSummary {
  totalIncomeUsd?: number;
  totalExpensesUsd?: number;
  totalBalanceUsd?: number;
  totalIncomeBs?: number;
  totalExpensesBs?: number;
  totalBalanceBs?: number;
  totalBalanceBsConverted?: number;
  projectCount?: number;
  pendingDocuments?: number;
  overdueDocuments?: number;
  rateUsed?: {
    source?: string;
    usdToBs?: number;
    eurToBs?: number;
    date?: string | null;
    isFallback?: boolean;
  } | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [currency, setCurrency] = useState<"BS" | "USD">("BS");
  const [mounted, setMounted] = useState(false);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);
  const [dragOverItemIdx, setDragOverItemIdx] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("fink_currency");
      if (saved === "USD") setCurrency("USD");
    } catch (e) {}
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [allUpdating, setAllUpdating] = useState(false);
  const [allMessage, setAllMessage] = useState<string | null>(null);

  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);

  const [ratesCompact, setRatesCompact] = useState<any>(null);
  const [ratesCompactLoading, setRatesCompactLoading] = useState(false);
  const [ratesExpanded, setRatesExpanded] = useState(false);
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [projectAccounts, setProjectAccounts] = useState<Record<string, any[]>>({});
  const [projectAccountsLoading, setProjectAccountsLoading] = useState<Record<string, boolean>>({});
  const [userName, setUserName] = useState('');
  const [showTotals, setShowTotals] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showIntraTransferModal, setShowIntraTransferModal] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(`${user.firstName} ${user.lastName}`);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!showLogoutConfirm) return;
    previousActiveElement.current = document.activeElement;
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const modal = modalRef.current;
    const focusFirst = () => {
      if (!modal) return;
      const el = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector)).find(e => !e.hasAttribute('disabled'));
      if (el) el.focus();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowLogoutConfirm(false);
        return;
      }
      if (e.key === 'Tab') {
        if (!modal) return;
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector)).filter(el => !el.hasAttribute('disabled'));
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const t = window.setTimeout(focusFirst, 20);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', handleKey);
      try { (previousActiveElement.current as HTMLElement | null)?.focus?.(); } catch {}
    };
  }, [showLogoutConfirm]);

  const fetchDashboard = useCallback(async (extraParams: any = {}) => {
    try {
      setLoading(true);
      let params: any = { ...extraParams };
      try {
        const pref = localStorage.getItem('preferredExchangeRate');
        if (pref) {
          if (['BCV','BINANCE','CUSTOM','BCV_EUR'].includes(pref)) params.rateSource = pref === 'BCV_EUR' ? 'BCV' : pref;
          else params.exchangeRateId = pref;
        }
      } catch {}
      params.currency = currency;
      const resp = await api.dashboard.getGeneral(params);
      const data = resp.data.data;
      
      let loadedProjects = data.projects || [];
      try {
        const savedOrder = localStorage.getItem('dashboard_project_order');
        if (savedOrder) {
          const orderArray = JSON.parse(savedOrder);
          loadedProjects.sort((a: any, b: any) => {
            const idxA = orderArray.indexOf(a.id);
            const idxB = orderArray.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }
      } catch (e) {}

      setProjects(loadedProjects);
      setSummary(data.summary || null);
    } catch (err) {
      console.error("Error cargando dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [currency]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItemIdx(index);
  };

  const handleDragEnd = () => {
    setDraggedItemIdx(null);
    setDragOverItemIdx(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedItemIdx === null) return;
    if (draggedItemIdx === dropIndex) {
      setDragOverItemIdx(null);
      return;
    }

    const newProjects = [...projects];
    const draggedItem = newProjects[draggedItemIdx];
    newProjects.splice(draggedItemIdx, 1);
    newProjects.splice(dropIndex, 0, draggedItem);

    setProjects(newProjects);
    try {
      localStorage.setItem('dashboard_project_order', JSON.stringify(newProjects.map(p => p.id)));
    } catch (e) {}
    setDraggedItemIdx(null);
    setDragOverItemIdx(null);
  };

  // Fetch rates for compact view
  const fetchRatesCompact = async () => {
      try {
          setRatesCompactLoading(true);
          const resp = await api.exchangeRates.getLatestBySource();
          if (resp.data.success) {
              setRatesCompact(resp.data.data);
          }
      } catch (e) {
          console.error("Error fetching rates compact", e);
      } finally {
          setRatesCompactLoading(false);
      }
  };

  useEffect(() => {
    fetchRatesCompact();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    (async () => {
      await fetchDashboard();
    })();
    const onPrefChange = () => fetchDashboard();
    const onRatesLoaded = () => fetchDashboard();
    window.addEventListener('preferredExchangeRateChanged', onPrefChange as any);
    window.addEventListener('exchangeRatesLoaded', onRatesLoaded as any);
    return () => {
      window.removeEventListener('preferredExchangeRateChanged', onPrefChange as any);
      window.removeEventListener('exchangeRatesLoaded', onRatesLoaded as any);
    };
  }, [router, currency, fetchDashboard]);

  const fetchProjectAccounts = async (projectId: string) => {
    try {
      setProjectAccountsLoading(prev => ({ ...prev, [projectId]: true }));
      const resp = await api.accounts.getAll({ projectId, isActive: true });
      const body = resp.data;
      if (body?.data) setProjectAccounts(prev => ({ ...prev, [projectId]: body.data }));
    } catch (err) {
      console.error('Error loading project accounts', err);
    } finally {
      setProjectAccountsLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const found = prev.includes(projectId);
      const next = found ? prev.filter(id => id !== projectId) : [...prev, projectId];
      if (!found && !projectAccounts[projectId]) fetchProjectAccounts(projectId);
      return next;
    });
  };

  // Ordena cuentas: filtra por tipos permitidos, saldos no cero y ordena por monto descendente
  const sortProjectAccounts = (accounts: any[] | undefined) => {
    if (!accounts || accounts.length === 0) return [];
    
    // Filter: only show BANK, WALLET, EXCHANGE (covers crypto)
    const allowed = ['BANK', 'WALLET', 'EXCHANGE', 'FINANCIAL', 'CASH'];
    
    const filtered = accounts.filter(a => {
      const s = (a.subType || a.subtype || '').toString().toUpperCase();
      if (!allowed.includes(s)) return false;

      // Filter out zero balances
      const val = a.currency === 'USD' ? Number(a.balanceUsd ?? a.balance ?? 0) : Number(a.balanceBs ?? a.balance ?? 0);
      return Math.abs(val) > 0.001; // Treat very small numbers as zero
    });

    const copy = [...filtered];
    const rate = summary?.rateUsed?.usdToBs || 0;

    copy.sort((a: any, b: any) => {
      // Convert everything to BS for sorting comparison
      let aVal = a.currency === 'USD' ? Number(a.balanceUsd ?? a.balance ?? 0) : Number(a.balanceBs ?? a.balance ?? 0);
      let bVal = b.currency === 'USD' ? Number(b.balanceUsd ?? b.balance ?? 0) : Number(b.balanceBs ?? b.balance ?? 0);

      if (rate > 0) {
          if (a.currency === 'USD') aVal = aVal * rate;
          if (b.currency === 'USD') bVal = bVal * rate;
      }

      // Sort by value descending
      return bVal - aVal;
    });
    return copy;
  };

  const handleNavigation = (path: string) => router.push(path);

  const QuickAction = ({ icon: Icon, label, path, action, color = "blue" }: any) => (
    <button 
      onClick={(e) => {
        // Prevent ghost clicks issues on touch devices
        // and ensure immediate feedback
        e.stopPropagation(); 
        if (action) action();
        else handleNavigation(path);
      }}
      className="glass-panel p-4 flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 active:bg-slate-50 transition-all duration-200 group touch-manipulation cursor-pointer select-none ring-offset-2 focus:ring-2 focus:outline-none"
    >
      <div className={`p-3 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:bg-${color}-100 transition-colors`}>
        <Icon size={24} />
      </div>
      <span className="font-semibold text-sm text-slate-700 text-center leading-tight">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen p-6 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
              {userName ? `Hola, ${userName}` : 'Dashboard'}
            </h1>
            <p className="text-slate-500 mt-1">Resumen general de tus finanzas</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pos"
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 font-bold"
              title="Abrir Punto de Venta Express"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Caja POS</span>
            </Link>
            <button
              onClick={() => router.push('/projects/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-slate-600 font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Proyecto</span>
            </button>

            <NotificationBell />
            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              className="glass-btn glass-btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </header>

          <CFOWidget projects={projects} />

          {/* Controls & Summary */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4 items-stretch">
          {/* Left Column: Controls & Rates */}
          <div className="lg:w-1/3 space-y-4">
            <div className="glass-card px-4 py-3 h-full flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-700 text-sm">Configuración</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      setAllMessage(null); setAllUpdating(true);
                      try {
                        await api.exchangeRates.updateAll();
                        setAllMessage('Actualizado');
                        fetchDashboard();
                      } catch (err: any) { setAllMessage('Error'); }
                      finally { setAllUpdating(false); }
                    }}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                    title="Actualizar Tasas"
                  >
                    <RefreshCw size={18} className={allUpdating ? "animate-spin" : ""} />
                  </button>
                  <button 
                    onClick={() => setShowRecalcConfirm(true)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                    title="Recalcular Saldos"
                  >
                    <Calculator size={18} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs font-medium text-slate-500">Moneda Base:</label>
                <div className="flex bg-slate-100 p-0.5 rounded-md">
                  <button 
                    onClick={() => { setCurrency("BS"); localStorage.setItem("fink_currency", "BS"); }}
                    className={`px-3 py-0.5 rounded text-xs font-medium transition-all ${currency === "BS" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Bs
                  </button>
                  <button 
                    onClick={() => { setCurrency("USD"); localStorage.setItem("fink_currency", "USD"); }}
                    className={`px-3 py-0.5 rounded text-xs font-medium transition-all ${currency === "USD" ? "bg-white shadow-sm text-green-600" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    USD
                  </button>
                </div>
              </div>

              {allMessage && <div className="text-[10px] text-green-600 bg-green-50 p-1 rounded mb-2">{allMessage}</div>}
              {recalcMessage && <div className="text-[10px] text-blue-600 bg-blue-50 p-1 rounded mb-2">{recalcMessage}</div>}

              <div className="border-t border-slate-100 pt-3 mt-1">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-600">Tasa de Cambio Seleccionada</span>
                    <button onClick={() => setRatesExpanded(!ratesExpanded)} className="text-xs text-blue-600 hover:underline">
                      {ratesExpanded ? 'Ocultar' : 'Ver detalles'}
                    </button>
                 </div>
                 
                 {!ratesExpanded && summary?.rateUsed && (
                    <div className="mb-2">
                       {(function(){
                          let activeKey = 'BCV_OFFICIAL'; 
                          let displaySource = 'BCV USD';
                          
                          // Determine the active key mainly from storage to respect user selection
                          if (mounted) {
                            try {
                                const stored = localStorage.getItem('preferredExchangeRate');
                                if (stored) activeKey = stored;
                                else {
                                    // Fallback to source inference
                                    if (summary.rateUsed.source === 'API') activeKey = 'BINANCE';
                                    else if (summary.rateUsed.source === 'CUSTOM') activeKey = 'CUSTOM';
                                    else if (summary.rateUsed.source === 'BCV') activeKey = 'BCV_OFFICIAL';
                                }
                            } catch {
                                if (summary.rateUsed.source === 'API') activeKey = 'BINANCE';
                            }
                          } else {
                             // On server/hydration, stick to source default
                             if (summary.rateUsed.source === 'API') activeKey = 'BINANCE';
                             else if (summary.rateUsed.source === 'CUSTOM') activeKey = 'CUSTOM';
                             else if (summary.rateUsed.source === 'BCV') activeKey = 'BCV_OFFICIAL';
                          }

                          // Override if mismatch with actual returned source (safety check)
                          if (summary.rateUsed.source === 'API' && activeKey !== 'BINANCE') activeKey = 'BINANCE';
                          if (summary.rateUsed.source === 'CUSTOM' && activeKey !== 'CUSTOM') activeKey = 'CUSTOM';
                          if (summary.rateUsed.source === 'BCV' && !activeKey.startsWith('BCV')) activeKey = 'BCV_OFFICIAL';

                          let rateValue = summary.rateUsed.usdToBs || 0;
                          if (activeKey === 'BCV_EUR') {
                              rateValue = summary.rateUsed.eurToBs || 0;
                              displaySource = 'BCV EURO (Oficial)';
                          } else if (activeKey === 'BCV_OFFICIAL') {
                              displaySource = 'BCV USD (Oficial)';
                          } else if (activeKey === 'BINANCE') {
                              displaySource = 'Paralelo (Binance)';
                          } else if (activeKey === 'CUSTOM') {
                             displaySource = 'Custom';
                          }

                          return (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide opacity-80">{displaySource}</span>
                                        {summary.rateUsed.date && (
                                            <span className="text-[9px] text-slate-400">
                                                {new Date(summary.rateUsed.date).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-lg font-bold text-slate-800 font-mono leading-none">
                                        {`Bs ${new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(Number(rateValue))}`}
                                    </div>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                   {activeKey.includes('BCV') ? '$' : (activeKey === 'BINANCE' ? 'B' : '#')} 
                                </div>
                            </div>
                          );
                       })()}
                    </div>
                 )}

                 {ratesExpanded ? (
                   <ExchangeRatesPanel summary={summary} currency={currency} />
                 ) : (
                   <div className="grid grid-cols-3 gap-2 mt-2">
                      {(function(){
                          let activeKey = 'BCV_OFFICIAL'; 
                          if (mounted) {
                            try {
                                const stored = localStorage.getItem('preferredExchangeRate');
                                if (stored) activeKey = stored;
                                else {
                                  if (summary?.rateUsed) {
                                      if (summary.rateUsed.source === 'API') activeKey = 'BINANCE';
                                      else if (summary.rateUsed.source === 'CUSTOM') activeKey = 'CUSTOM';
                                      else if (summary.rateUsed.source === 'BCV') activeKey = 'BCV_OFFICIAL';
                                  }
                                }
                            } catch {}
                          } else {
                                if (summary?.rateUsed) {
                                    if (summary.rateUsed.source === 'API') activeKey = 'BINANCE';
                                    else if (summary.rateUsed.source === 'CUSTOM') activeKey = 'CUSTOM';
                                    else if (summary.rateUsed.source === 'BCV') activeKey = 'BCV_OFFICIAL';
                                }
                          }
                          
                          // Safety Check
                          if (summary?.rateUsed) {
                            if (summary.rateUsed.source === 'API' && activeKey !== 'BINANCE') activeKey = 'BINANCE';
                            if (summary.rateUsed.source === 'CUSTOM' && activeKey !== 'CUSTOM') activeKey = 'CUSTOM';
                            if (summary.rateUsed.source === 'BCV' && !activeKey.startsWith('BCV')) activeKey = 'BCV_OFFICIAL';
                          }

                          const all = [
                              { key: 'BCV_OFFICIAL', label: 'BCV USD', val: ratesCompact?.BCV?.usdToBs },
                              { key: 'BCV_EUR', label: 'BCV EUR', val: ratesCompact?.BCV?.eurToBs },
                              { key: 'BINANCE', label: 'Paralelo', val: ratesCompact?.BINANCE?.usdToBs },
                              { key: 'CUSTOM', label: 'Custom', val: ratesCompact?.CUSTOM?.usdToBs }
                          ];
                          
                          // Show the *other* 3 rates
                          return all.filter(x => x.key !== activeKey).slice(0, 3).map(item => (
                              <div key={item.key} className="bg-slate-50 p-1.5 rounded text-center border border-slate-100 min-w-[30%]">
                                  <div className="text-[9px] text-slate-400 uppercase tracking-tight">{item.label}</div>
                                  <div className="font-semibold text-slate-700 text-xs">
                                    {item.val ? `Bs ${Number(item.val).toFixed(2)}` : '—'}
                                  </div>
                              </div>
                          ));
                      })()}
                   </div>
                 )}
              </div>
            </div>
          </div>

          {/* Right Column: Global Summary */}
          <div className="lg:w-2/3">
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
                <div 
                  className="glass-card px-4 py-3 flex flex-col justify-between bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-blue-200 cursor-pointer hover:shadow-lg transition-all group min-h-[140px]"
                  onClick={() => setShowTotals(!showTotals)}
                >
                  <div>
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="text-blue-100 text-xs font-medium uppercase tracking-wide">Total General (Bs)</div>
                      <div className="opacity-50 group-hover:opacity-100 transition-opacity">
                        {showTotals ? <EyeOff size={14} /> : <Eye size={14} />}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold tracking-tight transition-all duration-300 ${showTotals ? '' : 'blur-md select-none'}`}>
                      {`Bs ${new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(Number((summary as any).totalBalanceBsConverted ?? summary.totalBalanceBs ?? 0))}`}
                    </div>
                  </div>
                  <div className={`mt-2 pt-2 border-t border-white/20 text-[10px] text-blue-100 flex justify-between transition-all duration-300 ${showTotals ? '' : 'blur-sm select-none'}`}>
                    <span>Ingresos: {new Intl.NumberFormat("es-VE", { compactDisplay: "short", notation: "compact" }).format(Number(summary.totalIncomeBs || 0))}</span>
                    <span>Gastos: {new Intl.NumberFormat("es-VE", { compactDisplay: "short", notation: "compact" }).format(Number(summary.totalExpensesBs || 0))}</span>
                  </div>
                </div>

                <div 
                  className="glass-card px-4 py-3 flex flex-col justify-between bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none shadow-emerald-200 cursor-pointer hover:shadow-lg transition-all group min-h-[140px]"
                  onClick={() => setShowTotals(!showTotals)}
                >
                  <div>
                    <div className="flex justify-between items-start mb-0.5">
                      <div className="text-emerald-100 text-xs font-medium uppercase tracking-wide">Total General (USD)</div>
                      <div className="opacity-50 group-hover:opacity-100 transition-opacity">
                        {showTotals ? <EyeOff size={14} /> : <Eye size={14} />}
                      </div>
                    </div>
                    <div className={`text-2xl font-bold tracking-tight transition-all duration-300 ${showTotals ? '' : 'blur-md select-none'}`}>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(summary.totalBalanceUsd || 0))}
                    </div>
                  </div>
                  <div className={`mt-2 pt-2 border-t border-white/20 text-[10px] text-emerald-100 flex justify-between transition-all duration-300 ${showTotals ? '' : 'blur-sm select-none'}`}>
                    <span>In: {new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD" }).format(Number(summary.totalIncomeUsd || 0))}</span>
                    <span>Out: {new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD" }).format(Number(summary.totalExpensesUsd || 0))}</span>
                  </div>
                </div>

                <div className="glass-card px-4 py-3 flex flex-col justify-center items-center text-center min-h-[140px]">
                  <div className="text-3xl font-bold text-slate-800 mb-0.5">{summary.projectCount || 0}</div>
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Proyectos Activos</div>
                  <div className="mt-3 flex gap-2 text-[10px]">
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                      {summary.pendingDocuments || 0} Pendientes
                    </span>
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                      {summary.overdueDocuments || 0} Vencidos
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <ForexImpactWidget />
        </div>

        

        {/* Projects List */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Layers size={20} className="text-slate-400" /> Proyectos
          </h2>
          <button
            onClick={() => router.push('/consolidations')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-sm font-medium"
          >
            <BarChart3 size={16} className="text-blue-600" />
            <span>Ver Consolidaciones</span>
          </button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-slate-400" size={32} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((p, index) => (
              <div 
                key={p.id} 
                draggable 
                onDragStart={(e) => handleDragStart(e, index)} 
                onDragEnter={(e) => handleDragEnter(e, index)} 
                onDragEnd={handleDragEnd} 
                onDragOver={(e) => e.preventDefault()} 
                onDrop={(e) => handleDrop(e, index)} 
                className={`glass-card p-0 overflow-hidden group hover:shadow-2xl transition-all duration-300 cursor-move ${dragOverItemIdx === index ? 'opacity-50 ring-2 ring-blue-500' : ''}`}
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: p.color || '#3b82f6' }} />
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                      {p.description && (
                        <p className="mt-1 max-w-xs text-xs text-slate-500 leading-relaxed line-clamp-2">
                          {p.description}
                        </p>
                      )}
                      <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{p.code}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">
                        {currency === "BS" 
                          ? `Bs ${new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2 }).format(Number(p.balanceBs ?? p.balance ?? 0))}` 
                          : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number((p as any).balanceUsd ?? p.balance ?? 0))}
                      </div>
                      <div className="text-xs text-slate-500">Balance Total</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Ingresos</div>
                      <div className="text-sm font-semibold text-green-600">
                        {currency === "BS" 
                          ? `Bs ${new Intl.NumberFormat("es-VE", { compactDisplay: "short", notation: "compact" }).format(Number(p.incomeBs || 0))}` 
                          : new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD" }).format(Number((p as any).incomeUsd || 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">Gastos</div>
                      <div className="text-sm font-semibold text-red-600">
                        {currency === "BS" 
                          ? `Bs ${new Intl.NumberFormat("es-VE", { compactDisplay: "short", notation: "compact" }).format(Number(p.expensesBs || 0))}` 
                          : new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD" }).format(Number((p as any).expensesUsd || 0))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-slate-500">
                      {p.transactionCount} transacciones
                    </div>
                    <button 
                      onClick={() => toggleProjectExpanded(p.id)}
                      className="text-xs font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                      {expandedProjects.includes(p.id) ? 'Ocultar cuentas' : 'Ver cuentas'}
                      {expandedProjects.includes(p.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {expandedProjects.includes(p.id) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                      {projectAccountsLoading[p.id] ? (
                        <div className="text-center py-2 text-xs text-slate-400">Cargando...</div>
                      ) : (
                        <div className="space-y-2">
                          {(sortProjectAccounts(projectAccounts[p.id]) || []).slice(0, 5).map((a: any) => (
                            <div key={a.id} className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-default">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${a.currency === 'USD' ? 'bg-green-400' : 'bg-blue-400'}`} />
                                <span className="text-slate-700 truncate max-w-[120px]">{a.name}</span>
                              </div>
                              <span className="font-mono text-xs font-medium text-slate-900">
                                {(() => {
                                  const isUsdAccount = a.currency === 'USD';
                                  const balUsd = Number(a.balanceUsd ?? a.balance ?? 0);
                                  const balBs = Number(a.balanceBs ?? a.balance ?? 0);
                                  const rate = summary?.rateUsed?.usdToBs || 0;

                                  if (currency === 'USD') {
                                    // Show in USD
                                    let val = isUsdAccount ? balUsd : (rate > 0 ? balBs / rate : 0);
                                    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
                                  } else {
                                    // Show in BS
                                    let val = isUsdAccount ? (rate > 0 ? balUsd * rate : 0) : balBs;
                                    return `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(val)}`;
                                  }
                                })()}
                              </span>
                            </div>
                          ))}
                          <button 
                            onClick={() => router.push(`/accounts?projectId=${p.id}`)}
                            className="w-full text-center text-xs text-blue-500 hover:text-blue-700 py-1 mt-1"
                          >
                            Ver todas las cuentas
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions Grid (Moved to bottom) */}
        <div className="mt-12 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Zap size={20} className="text-slate-400" /> Accesos Rápidos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <QuickAction icon={FileCheck} label="Cotizaciones" path="/quotations" color="blue" />
            <QuickAction icon={Calculator} label="Presupuesto Pagos" path="/payment-budget" color="blue" />
            <QuickAction icon={Users} label="Contactos" path="/contacts" color="cyan" />
            <QuickAction icon={Zap} label="Registro de Operaciones" path="/transactions/quick" color="indigo" />
            <QuickAction icon={FileText} label="Transacciones" path="/transactions" color="slate" />
            <QuickAction icon={FileClock} label="Facturas Pendientes" path="/invoices" color="orange" />
            <QuickAction icon={Wallet} label="Cuentas" path="/accounts" color="emerald" />
            <QuickAction icon={Banknote} label="Préstamos" path="/loans" color="emerald" />
            <QuickAction icon={RefreshCw} label="Reglas Periódicas" path="/recurring" color="violet" />
            <QuickAction icon={Package} label="Inventario" path="/inventory" color="amber" />
            <QuickAction icon={Tag} label="Categorías" path="/categories" color="pink" />
            <QuickAction icon={BarChart3} label="Reportes" path="/reports" color="blue" />
            <QuickAction icon={ArrowRightLeft} label="Transferencias entre proyectos" action={() => setShowTransferModal(true)} color="teal" />
            <QuickAction icon={Wallet} label="Transferencias internas" action={() => setShowIntraTransferModal(true)} color="purple" />
            <QuickAction icon={HardDrive} label="Respaldos" path="/settings/backups" color="rose" />
            <QuickAction icon={Settings} label="Configuración General" path="/settings" color="blue" />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/20 p-4">
          <div className="glass-card p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">¿Cerrar sesión?</h3>
            <p className="text-sm text-slate-500 mb-6">Tendrás que volver a ingresar tus credenciales para acceder.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="glass-btn glass-btn-ghost">Cancelar</button>
              <button 
                onClick={() => { try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch (e) {} setShowLogoutConfirm(false); router.push('/login'); }} 
                className="glass-btn bg-red-500 hover:bg-red-600 text-white shadow-red-200"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecalcConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/20 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Recalcular Saldos</h3>
            <p className="text-sm text-slate-500 mb-6">Esta operación recalculará los saldos de todas las cuentas basándose en el historial de transacciones. Puede tardar unos segundos.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRecalcConfirm(false)} className="glass-btn glass-btn-ghost" disabled={recalcLoading}>Cancelar</button>
              <button 
                onClick={async () => {
                  setRecalcMessage(null); setRecalcLoading(true);
                  try {
                    const resp = await api.admin.recalculateBalances();
                    setRecalcMessage('Recálculo completado');
                    fetchDashboard();
                  } catch (err: any) {
                    setRecalcMessage('Error al recalcular');
                  } finally {
                    setRecalcLoading(false);
                    setShowRecalcConfirm(false);
                  }
                }} 
                className="glass-btn bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                disabled={recalcLoading}
              >
                {recalcLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <InterProjectTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={() => {
          fetchDashboard();
        }}
      />

      <IntraProjectTransferModal
        isOpen={showIntraTransferModal}
        onClose={() => setShowIntraTransferModal(false)}
        onSuccess={() => {
          fetchDashboard();
        }}
      />
    </div>
  );
}

