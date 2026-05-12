"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft,
  BarChart2,
  TrendingUp,
  Package,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Printer,
  CheckSquare,
  Square,
  Share2,
  Calculator,
  ArrowRight
} from 'lucide-react';
import html2canvas from 'html2canvas';
import api from "@/lib/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function AdvancedReportsPage() {
  const router = useRouter();
  const ratesRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'monthly' | 'products' | 'rates' | 'projects'>('monthly');
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [currency, setCurrency] = useState<"BS" | "USD">("USD");

// Rate Calculator State (Default: This week so far)
    const [calcStartDate, setCalcStartDate] = useState<string>(() => {
      const d = new Date();
      const day = d.getDay() || 7; // Convertir Domingo (0) a 7 para matemática
      d.setDate(d.getDate() - (day - 1)); return format(d, 'yyyy-MM-dd'); });
  const [calcEndDate, setCalcEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [calcRateType, setCalcRateType] = useState<string>('bcvUsd');

  // Data States
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [rateHistory, setRateHistory] = useState<any[]>([]);
  const [projectStats, setProjectStats] = useState<any[]>([]);
  
  // Project Comparison Filter
  const [excludedProjects, setExcludedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedProject, startDate, endDate, currency]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (e) { console.error(e); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { projectId: selectedProject || undefined, startDate, endDate, currency };

      if (activeTab === 'monthly') {
        const res = await api.reports.getTrend({ ...params, interval: 'month' });
        setMonthlyData(res.data.data || []);
      } 
      else if (activeTab === 'products') {
        const res = await api.reports.getProductStats(params);
        setProductData(res.data.data || []);
      }
      else if (activeTab === 'rates') {
        // Rate history is global usually, but we can filter by date
        const res = await api.exchangeRates.getHistory(365, 'ALL');
        setRateHistory(res.data.data || []);
      }
      else if (activeTab === 'projects') {
        // We use summary to get all projects data
        const res = await api.reports.getSummary({ startDate, endDate, currency });
        setProjectStats(res.data.data.byProject || []);
      }
    } catch (error) {
      console.error("Error loading report data", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: currency === 'BS' ? 'VES' : 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const toggleProjectExclusion = (name: string) => {
    const next = new Set(excludedProjects);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setExcludedProjects(next);
  };

  // --- RENDERERS ---

  const renderMonthly = () => {
    const data = {
      labels: monthlyData.map(d => format(new Date(d.date + '-02'), 'MMM yyyy', { locale: es })),
      datasets: [
        {
          label: 'Ingresos',
          data: monthlyData.map(d => d.income),
          borderColor: '#10B981',
          backgroundColor: '#10B981',
          tension: 0.3
        },
        {
          label: 'Egresos',
          data: monthlyData.map(d => d.expense),
          borderColor: '#EF4444',
          backgroundColor: '#EF4444',
          tension: 0.3
        }
      ]
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="relative w-full h-[450px]">
            <Line options={{ maintainAspectRatio: false, responsive: true }} data={data} />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="p-3">Mes</th>
                <th className="p-3 text-right">Ingresos</th>
                <th className="p-3 text-right">Egresos</th>
                <th className="p-3 text-right">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3 font-medium capitalize">{format(new Date(d.date + '-02'), 'MMMM yyyy', { locale: es })}</td>
                  <td className="p-3 text-right text-green-600">{formatCurrency(d.income)}</td>
                  <td className="p-3 text-right text-red-600">{formatCurrency(d.expense)}</td>
                  <td className={`p-3 text-right font-bold ${d.income - d.expense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(d.income - d.expense)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderProducts = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
           <h3 className="font-bold text-slate-700">Rendimiento de Productos</h3>
           <span className="text-xs text-slate-500">Basado en descripciones de transacciones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="p-3">Producto</th>
                <th className="p-3 text-center">Stock Actual</th>
                <th className="p-3 text-right">Total Comprado</th>
                <th className="p-3 text-right">Total Vendido</th>
                <th className="p-3 text-right">Margen Bruto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productData.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">No hay datos de productos para este periodo</td></tr>
              ) : (
                productData.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">{p.name}</td>
                    <td className="p-3 text-center">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{p.stock}</span>
                    </td>
                    <td className="p-3 text-right text-red-600">
                      <div className="font-medium">{formatCurrency(p.boughtAmount)}</div>
                      <div className="text-[10px] text-slate-400">{p.boughtCount} txs</div>
                    </td>
                    <td className="p-3 text-right text-green-600">
                      <div className="font-medium">{formatCurrency(p.soldAmount)}</div>
                      <div className="text-[10px] text-slate-400">{p.soldCount} txs</div>
                    </td>
                    <td className={`p-3 text-right font-bold ${p.soldAmount - p.boughtAmount >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(p.soldAmount - p.boughtAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const exportRatesImage = async () => {
    if (!ratesRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(ratesRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Blob is null');
      const file = new File([blob], 'tasas_fink.jpg', { type: 'image/jpeg' });
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Histórico de Tasas FINK',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tasas_fink.jpg';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Error exportando:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const renderRates = () => {
    // 1. Unificar datos por fecha para fácil acceso
    const rateMap = new Map<string, { bcvUsd?: number, bcvEur?: number, binUsd?: number, binEur?: number }>();
    
    rateHistory.forEach(r => {
      const dateKey = format(new Date(r.date), 'yyyy-MM-dd');
      const current = rateMap.get(dateKey) || {};
      
      if (r.source === 'BCV') {
        current.bcvUsd = r.usdToBs;
        current.bcvEur = r.eurToBs;
      } else if (r.source === 'BINANCE') {
        current.binUsd = r.usdToBs;
        current.binEur = r.eurToBs;
      }
      rateMap.set(dateKey, current);
    });

    const dates = Array.from(rateMap.keys()).sort();
    
    // --- CHART DATA PREP ---
    const labels = dates.map(d => format(new Date(d), 'dd MMM'));
    const dsBcvUsd = dates.map(d => rateMap.get(d)?.bcvUsd || null);
    const dsBcvEur = dates.map(d => rateMap.get(d)?.bcvEur || null);
    const dsBinUsd = dates.map(d => rateMap.get(d)?.binUsd || null);

    const chartData = {
      labels,
      datasets: [
        {
          label: 'USD BCV',
          data: dsBcvUsd,
          borderColor: '#2563EB', // Blue 600
          backgroundColor: '#2563EB',
          tension: 0.1,
          pointRadius: 2,
          spanGaps: true
        },
        {
          label: 'EUR BCV',
          data: dsBcvEur,
          borderColor: '#7C3AED', // Violet 600
          backgroundColor: '#7C3AED',
          tension: 0.1,
          pointRadius: 2,
          spanGaps: true
        },
        {
          label: 'USD BINANCE',
          data: dsBinUsd,
          borderColor: '#F59E0B', // Amber 500
          backgroundColor: '#F59E0B',
          tension: 0.1,
          pointRadius: 2,
          spanGaps: true
        }
      ]
    };

    // --- GAP ANALYSIS (Monthly Averages) ---
    // Estructura: mes -> { sumGap1, countGap1, sumGap2, countGap2, ... }
    const monthlyStats = new Map<string, { 
      gapUsdEurSum: number, gapUsdEurCount: number,
      gapUsdBinSum: number, gapUsdBinCount: number,
      gapEurBinSum: number, gapEurBinCount: number
    }>();

    dates.forEach(d => {
      const monthKey = format(new Date(d), 'yyyy-MM');
      const data = rateMap.get(d);
      if (!data) return;

      const stats = monthlyStats.get(monthKey) || { 
        gapUsdEurSum: 0, gapUsdEurCount: 0, 
        gapUsdBinSum: 0, gapUsdBinCount: 0, 
        gapEurBinSum: 0, gapEurBinCount: 0 
      };

      // 1. USD BCV vs EUR BCV
      if (data.bcvUsd && data.bcvEur) {
        // (EUR - USD) / USD
        const gap = ((data.bcvEur - data.bcvUsd) / data.bcvUsd) * 100;
        stats.gapUsdEurSum += gap;
        stats.gapUsdEurCount++;
      }

      // 2. USD BCV vs BINANCE (USD)
      if (data.bcvUsd && data.binUsd) {
        // (Bin - BCV) / BCV
        const gap = ((data.binUsd - data.bcvUsd) / data.bcvUsd) * 100;
        stats.gapUsdBinSum += gap;
        stats.gapUsdBinCount++;
      }

      // 3. EURO BCV vs BINANCE (USD)
      // Interpretación: Que tan lejos está el Dolar Paralelo del Euro Oficial
      if (data.bcvEur && data.binUsd) {
        // (BinUSD - EurBCV) / EurBCV
        const gap = ((data.binUsd - data.bcvEur) / data.bcvEur) * 100;
        stats.gapEurBinSum += gap;
        stats.gapEurBinCount++;
      }

      monthlyStats.set(monthKey, stats);
    });

    const reportRows = Array.from(monthlyStats.entries())
      .sort((a,b) => b[0].localeCompare(a[0])) // Descending months
      .map(([month, stats]) => ({
        month,
        avgUsdEur: stats.gapUsdEurCount ? (stats.gapUsdEurSum / stats.gapUsdEurCount) : 0,
        avgUsdBin: stats.gapUsdBinCount ? (stats.gapUsdBinSum / stats.gapUsdBinCount) : 0,
        avgEurBin: stats.gapEurBinCount ? (stats.gapEurBinSum / stats.gapEurBinCount) : 0
      }));

    // --- RATE CALCULATOR ---
    let calcStartVal = 0;
    let calcEndVal = 0;
    let calcVariation = 0;
    let hasCalcData = false;

    // Helper: Encuentra la tasa para una fecha exacta o la más reciente disponible hacia atrás (ej. Viernes previo)
    const getRateWithFallback = (targetDate: string, type: keyof {bcvUsd: number, bcvEur: number, binUsd: number}): number => {
      // Buscamos hacia atrás hasta encontrar un dato válido, con un límite de 14 días para no asumir data muy vieja
      let currentDate = new Date(targetDate + 'T12:00:00Z');
      for (let i = 0; i < 14; i++) {
        const dKey = format(currentDate, 'yyyy-MM-dd');
        const data = rateMap.get(dKey);
        if (data && data[type as keyof typeof data]) {
          return data[type as keyof typeof data] as number;
        }
        // Retroceder 1 día
        currentDate.setDate(currentDate.getDate() - 1);
      }
      return 0;
    };

    if (calcStartDate && calcEndDate && calcRateType) {
      calcStartVal = getRateWithFallback(calcStartDate, calcRateType as any);
      calcEndVal = getRateWithFallback(calcEndDate, calcRateType as any);
      
      if (calcStartVal > 0 && calcEndVal > 0) {
         calcVariation = ((calcEndVal - calcStartVal) / calcStartVal) * 100;
         hasCalcData = true;
      }
    }

    return (
      <div className="space-y-8">
        {/* Export Wrapper */}
        <div ref={ratesRef} className="space-y-4 p-4 -mx-4 mb-4 bg-slate-50 rounded-xl max-w-full overflow-hidden shrink-0">
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-xl font-bold text-slate-800">Reporte Histórico de Tasas</h2>
            <button
              onClick={exportRatesImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 border border-transparent text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
              title="Compartir reporte a WhatsApp / Redes Sociales"
            >
              <Share2 className="w-4 h-4" />
              {isExporting ? 'Exportando...' : 'Compartir Histórico'}
            </button>
          </div>

          {/* CHART SECTION */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-600"/>
                Evolución Histórica (Bs/Divisa)
              </h3>
            </div>
            <div className="relative w-full h-[450px]">
              <Line 
              options={{ 
              maintainAspectRatio: false, 
              responsive: true,
              interaction: { mode: 'index', intersect: false },
              // Fix: Added safety check for null values to satisfy TS check in Vercel build
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const val = ctx.parsed.y;
                      return `${ctx.dataset.label}: Bs ${val ? val.toFixed(2) : 'N/A'}`;
                    }
                  }
                }
              }
            }}
            data={chartData}
            />
            </div>
        </div>

        {/* CALCULATOR SECTION */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Calculator size={20} className="text-blue-600"/>
              Calculadora de Variación Cambiaria
              <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 ml-2">
                Semana en Curso
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tasa a comparar</label>
              <select 
                value={calcRateType}
                onChange={e => setCalcRateType(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 min-h-[42px] border bg-white"
              >
                <option value="bcvUsd">Dólar Oficial (BCV)</option>
                <option value="bcvEur">Euro Oficial (BCV)</option>
                <option value="binUsd">Dólar Paralelo (Binance)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Inicial</label>
              <input 
                type="date" 
                max={calcEndDate || undefined}
                value={calcStartDate}
                onChange={e => setCalcStartDate(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 min-h-[42px] border bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha Final</label>
              <input 
                type="date" 
                min={calcStartDate || undefined}
                value={calcEndDate}
                onChange={e => setCalcEndDate(e.target.value)}
                className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 min-h-[42px] border bg-white"
              />
            </div>
          </div>
          
          {calcStartDate && calcEndDate && (
             calcStartDate > calcEndDate ? (
               <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-100 flex items-center justify-center">
                 <p className="text-sm text-red-600 font-medium">
                   ⚠️ La fecha inicial no puede ser mayor que la fecha final.
                 </p>
               </div>
             ) : (
             <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
               {hasCalcData ? (
                 <>
                   <div className="flex items-center gap-4 text-center md:text-left justify-center flex-1">
                     <div>
                       <p className="text-xs text-slate-500">Valor Inicial</p>
                       <p className="font-mono font-medium text-slate-800">Bs. {calcStartVal.toFixed(2)}</p>
                     </div>
                     <ArrowRight className="text-slate-300 hidden md:block" size={16}/>
                     <div>
                       <p className="text-xs text-slate-500">Valor Final</p>
                       <p className="font-mono font-medium text-slate-800">Bs. {calcEndVal.toFixed(2)}</p>
                     </div>
                   </div>
                   <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6 w-full md:w-auto min-w-[150px]">
                     <p className="text-xs text-slate-500 mb-1">Variación Acumulada</p>
                     <p className={`text-xl font-bold ${
                        calcVariation > 0 ? 'text-red-500' : 
                        calcVariation < 0 ? 'text-green-500' : 
                        'text-slate-600'
                     }`}>
                       {calcVariation > 0 ? '+' : ''}{calcVariation.toFixed(2)}%
                     </p>
                   </div>
                 </>
               ) : (
                 <p className="text-sm text-amber-600 font-medium text-center w-full">
                   ⚠️ No hay registros exactos para ambas fechas. Intenta moviendo un día.
                 </p>
               )}
             </div>
             )
          )}
          <div className="mt-12 mb-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Filter size={18} className="text-slate-500"/>
              Análisis de Brechas Cambiarias (Promedios Mensuales)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Diferencias porcentuales promedio entre las distintas tasas oficiales y paralelas.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-6">Mes</th>
                  <th className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>USD BCV vs EUR BCV</span>
                      <span className="text-xs text-slate-400 font-normal mt-0.5">(Relación Oficial)</span>
                    </div>
                  </th>
                  <th className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>USD BCV vs BINANCE</span>
                      <span className="text-xs text-slate-400 font-normal mt-0.5">(Brecha Dólar)</span>
                    </div>
                  </th>
                  <th className="p-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>EUR BCV vs BINANCE</span>
                      <span className="text-xs text-slate-400 font-normal mt-0.5">(Arbitraje Cruzado)</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportRows.map((row) => (
                  <tr key={row.month} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 pl-6 font-medium text-slate-700 capitalize">
                      {format(new Date(row.month + '-02'), 'MMMM yyyy', { locale: es })}
                    </td>
                    
                    {/* Columna 1: USD vs EUR */}
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                        {row.avgUsdEur.toFixed(2)}%
                      </span>
                    </td>

                    {/* Columna 2: Brecha Dólar */}
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-md font-bold border ${
                        row.avgUsdBin > 20 ? 'bg-red-50 text-red-700 border-red-100' : 
                        row.avgUsdBin > 10 ? 'bg-orange-50 text-orange-700 border-orange-100' :
                        'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        {row.avgUsdBin.toFixed(2)}%
                      </span>
                    </td>

                    {/* Columna 3: Cruzado */}
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200">
                        {row.avgEurBin.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {reportRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                      No hay datos históricos suficientes para calcular promedios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    );
  };

  const renderProjects = () => {
    // Merge projectStats with all projects to ensure we show 0-value projects too
    const statsMap = new Map(projectStats.map(p => [p.name, p]));
    const fullStats = projects.map(p => ({
      name: p.name,
      income: statsMap.get(p.name)?.income || 0,
      expense: statsMap.get(p.name)?.expense || 0
    }));

    const filtered = fullStats.filter(p => !excludedProjects.has(p.name));
    
    const sortedByProfit = [...filtered].sort((a, b) => (b.income - b.expense) - (a.income - a.expense));

    const chartData = {
      labels: sortedByProfit.map(p => p.name),
      datasets: [
        {
          label: 'Ingresos',
          data: sortedByProfit.map(p => p.income),
          backgroundColor: '#10B981',
        },
        {
          label: 'Egresos',
          data: sortedByProfit.map(p => p.expense),
          backgroundColor: '#EF4444',
        }
      ]
    };

    return (
      <div className="space-y-6">
        {/* Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-700 mb-3">Incluir/Excluir Proyectos:</p>
          <div className="flex flex-wrap gap-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => toggleProjectExclusion(p.name)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  !excludedProjects.has(p.name) 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                {!excludedProjects.has(p.name) ? <CheckSquare size={14} /> : <Square size={14} />}
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[400px]">
            <Bar 
              options={{ 
                maintainAspectRatio: false, 
                responsive: true,
                indexAxis: 'y' as const,
              }} 
              data={chartData} 
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="p-3">Proyecto</th>
                  <th className="p-3 text-right">Rentabilidad</th>
                  <th className="p-3 text-right">Margen %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedByProfit.map((p, i) => {
                  const profit = p.income - p.expense;
                  const margin = p.income > 0 ? (profit / p.income) * 100 : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className={`p-3 text-right font-bold ${profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(profit)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${margin >= 20 ? 'bg-green-100 text-green-700' : margin > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen print:bg-white print:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Reportes Avanzados</h1>
            <p className="text-slate-500 text-sm">Análisis detallado de operaciones</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
                <Printer size={18} />
                <span className="hidden sm:inline">Imprimir</span>
            </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center print:hidden">
        <div className="flex bg-slate-100 rounded-lg p-1">
          {[
            { id: 'monthly', label: 'Mensual', icon: Calendar },
            { id: 'products', label: 'Productos', icon: Package },
            { id: 'rates', label: 'Tasas', icon: TrendingUp },
            { id: 'projects', label: 'Proyectos', icon: BarChart2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

        {activeTab !== 'rates' && (
          <>
            <select 
              className="border-slate-200 rounded-lg text-sm py-2 pl-3 pr-8 focus:ring-blue-500 focus:border-blue-500"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">Todos los Proyectos</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="border-slate-200 rounded-lg text-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                className="border-slate-200 rounded-lg text-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button 
                className={`px-3 py-2 text-sm font-medium ${currency === 'BS' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                onClick={() => setCurrency('BS')}
              >
                Bs
              </button>
              <button 
                className={`px-3 py-2 text-sm font-medium ${currency === 'USD' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                onClick={() => setCurrency('USD')}
              >
                USD
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'monthly' && renderMonthly()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'rates' && renderRates()}
            {activeTab === 'projects' && renderProjects()}
          </>
        )}
      </div>
    </div>
  );
}
