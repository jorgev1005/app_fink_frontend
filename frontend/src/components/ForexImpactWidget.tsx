"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCcw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "../lib/api";

interface Project {
  id: string;
  name: string;
}

interface ImpactSource {
    source: string;
    rateToday: number;
    rateYesterday: number;
    rateTodayEUR?: number;
    rateYesterdayEUR?: number;
    lossUSD: number;
    lossBS: number;
    lossEUR?: number;
    devaluationPercentage: number;
    devaluationPercentageEUR?: number;
    sourceDateToday?: string;
}

interface ForexImpactData {
  totalBs: number;
  impactBySource: ImpactSource[];
  accounts?: any[];
}

export default function ForexImpactWidget() {
  const [data, setData] = useState<ForexImpactData | null>(null);
  // Default currency is USD, user cannot toggle anymore
  const currency = "USD"; 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("all");
  const [isExpanded, setIsExpanded] = useState(true); 
  const [refreshKey, setRefreshKey] = useState(0);

  // Date Range State
  const [dateMode, setDateMode] = useState<"24h" | "custom">("24h");
  const [startDate, setStartDate] = useState<string>(() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Cargar lista de proyectos
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await apiClient.get('/api/projects?limit=100');
        const json = res.data;
        if (json.success) {
          setProjects(json.data.projects || json.data);
        }
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    };
    fetchProjects();
  }, []);

  // Cargar datos de Forex (depende del projectId y fechas)
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = '/api/reports/forex-impact';
        const params: any = {};
        if (projectId && projectId !== "all") {
          params.projectId = projectId;
        }
        
        if (dateMode === 'custom' && startDate && endDate) {
            params.startDate = startDate;
            params.endDate = endDate;
        }
        
        const res = await apiClient.get(url, { params });
        const json = res.data;

        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error?.message || "Error desconocido del servidor");
        }
      } catch (err: any) {
        console.error("Error fetching forex data:", err);
        setError(err.response?.data?.message || err.message || "Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    if (dateMode === 'custom' && (!startDate || !endDate)) {
        // Don't fetch if dates are incomplete
        return;
    }

    fetchData();
  }, [projectId, refreshKey, dateMode, startDate, endDate]);

  const formatCurrency = (amount: number, currency: "USD" | "VES") => {
    return new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "VES",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getSourceLabel = (s: string) => {
    if (!s) return 'Desconocido';
    switch(s.toUpperCase()) {
      case 'BCV': return 'BCV (Oficial)';
      case 'BINANCE': return 'Binance P2P';
      case 'PARALELO': return 'Dólar Paralelo';
      case 'CUSTOM': return 'Personalizada';
      default: return s;
    }
  };

  const manuallyRefresh = () => {
     setRefreshKey(prev => prev + 1);
  };

  // Helper to safely get item from data array
  const getSourceData = (key: string): ImpactSource => {
     const defaultItem: ImpactSource = {
         source: key,
         rateToday: 0,
         rateYesterday: 0,
         lossUSD: 0,
         lossBS: 0,
         devaluationPercentage: 0
     };

     if (!data?.impactBySource) return defaultItem;
     return data.impactBySource.find(s => s.source === key) || defaultItem;
  };

  return (
    <div className="w-full shadow-sm select-none rounded-lg border bg-card text-card-foreground bg-white">
      <div className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-gray-100 bg-gray-50/50 px-4 py-3 h-14 rounded-t-lg">
        <div 
            className="flex items-center gap-2 cursor-pointer group" 
            onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
             <ChevronUp className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          ) : (
             <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          )}
          <h3 className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
            Riesgo Cambiario {dateMode === 'custom' ? '(Rango)' : '(24h)'}
          </h3>
        </div>
        
        <div className="flex items-center space-x-2">
            {/* Removed USD/EUR toggle as requested */}

            {/* Date Selection */}
            <div className="flex items-center space-x-1">
               <select
                 value={dateMode}
                 onChange={(e) => setDateMode(e.target.value as any)}
                 className="h-8 text-xs bg-white border border-gray-200 rounded px-2 outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer w-[90px]"
                 title="Seleccionar periodo"
               >
                  <option value="24h">24 Horas</option>
                  <option value="custom">Rango</option>
               </select>
            </div>

            {dateMode === 'custom' && (
                <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-4 duration-300">
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 text-xs bg-white border border-gray-200 rounded px-1 w-[105px] outline-none focus:ring-1 focus:ring-gray-300"
                      title="Fecha Inicial"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 text-xs bg-white border border-gray-200 rounded px-1 w-[105px] outline-none focus:ring-1 focus:ring-gray-300"
                      title="Fecha Final"
                    />
                </div>
            )}

            <div className="relative">
              <select 
                value={projectId}  
                onChange={(e) => setProjectId(e.target.value)}
                className="w-[140px] h-8 text-xs bg-white border border-gray-200 rounded px-2 outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer truncate"
              >
                <option value="all">Todos los Proyectos</option>
                {Array.isArray(projects) && projects.map((p) => (
                  <option key={p.id} value={p.id}>
                      {p.name}
                  </option>
                ))}
              </select>
            </div>
            
             <button
                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={manuallyRefresh}
                title="Actualizar datos"
            >
                <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-white transition-all duration-200 ease-in-out rounded-b-lg">
            {loading && !data ? (
               <div className="flex flex-col items-center justify-center py-8">
                 <RefreshCcw className="h-6 w-6 animate-spin text-blue-500 mb-2" />
                 <span className="text-xs text-gray-400">Calculando impacto...</span>
               </div>
            ) : error ? (
                <div className="flex items-center text-red-500 text-sm p-4 bg-red-50 rounded-md border border-red-100">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    {error}
                </div>
            ) : !data ? (
                <div className="text-sm text-gray-500 text-center p-4">No hay datos de riesgo cambiario disponibles.</div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {['BCV', 'BINANCE', 'EURO_BCV', 'CUSTOM'].map(sourceKey => {
                        // Special handling for EURO_BCV virtual source
                        const isEuroVirtual = sourceKey === 'EURO_BCV';
                        const realKey = isEuroVirtual ? 'BCV' : sourceKey;
                        
                        const safeItem = getSourceData(realKey);

                        // If it's the virtual Euro card, FORCE Euro values regardless of global currency
                        // Otherwise respect global currency (unless PARALELO/BINANCE don't have EUR, then adjust)
                        
                        const forceCurrency = isEuroVirtual ? 'EUR' : currency;

                        const rateToday = forceCurrency === 'USD' ? safeItem.rateToday : (safeItem.rateTodayEUR || 0);
                        const loss = forceCurrency === 'USD' ? safeItem.lossUSD : (safeItem.lossEUR || 0);
                        const deval = forceCurrency === 'USD' ? safeItem.devaluationPercentage : (safeItem.devaluationPercentageEUR || 0);
                        
                        const willDevaluate = deval > 0;
                        const hasChange = deval !== 0; // Check if there's any movement
                        
                        // Custom Label for Euro Card
                        const label = isEuroVirtual ? 'BCV (EURO)' : `${getSourceLabel(sourceKey)} (${forceCurrency})`;

                        return (
                            <div key={sourceKey} className={`relative flex flex-col p-3 rounded-lg border transition-all hover:shadow-sm ${willDevaluate ? 'bg-red-50/30 border-red-100' : 'bg-gray-50/50 border-gray-100'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                                    {hasChange ? (
                                        <div className={`flex items-center text-xs font-bold ${willDevaluate ? 'text-red-600' : 'text-green-600'}`}>
                                            {willDevaluate ? <TrendingDown className="h-3 w-3 mr-1"/> : <TrendingUp className="h-3 w-3 mr-1"/>}
                                            {Math.abs(deval).toFixed(2)}%
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-300 font-mono">-</span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs text-gray-400">Tasa Hoy</span>
                                        <span className="text-sm font-mono font-medium text-gray-800">
                                            {rateToday > 0 ? rateToday.toFixed(2) : '--'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end pt-1 border-t border-gray-100/50">
                                        <span className="text-xs text-gray-400">Impacto</span>
                                        <span className={`text-sm font-mono font-bold ${loss > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {loss > 0 ? '-' : (loss < 0 ? '+' : '')}
                                            {Math.abs(loss) < 0.01 ? (forceCurrency === 'USD' ? '$0.00' : '€0.00') : 
                                              `${forceCurrency === 'USD' ? '$' : '€'}${Math.abs(loss).toFixed(2)}`
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                    
                    <div className="flex justify-end items-center pt-2 border-t border-gray-100">
                         <span className="text-xs text-gray-400 flex items-center gap-2">
                           Balance en Bs expuesto: 
                           <span className="font-mono font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                             {formatCurrency(data.totalBs, "VES")}
                           </span>
                        </span>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
