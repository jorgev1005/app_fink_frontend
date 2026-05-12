"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, TrendingDown, DollarSign, Wallet, AlertTriangle, Info } from 'lucide-react';
import api from '@/lib/api';

interface AccountImpact {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  balanceBs: number;
}

interface ForexImpactSource {
  source: string;
  sourceDateToday: string;
  sourceDateYesterday: string;
  rateToday: number;
  rateYesterday: number;
  valueYesterdayUSD: number;
  valueTodayUSD: number;
  lossUSD: number;
  lossBS: number;
  devaluationPercentage: number;
}

interface ForexImpactData {
  totalBs: number;
  impactBySource: ForexImpactSource[];
  accounts: AccountImpact[];
}

export default function ForexImpactReportPage() {
  const [data, setData] = useState<ForexImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('BCV');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.reports.getForexImpact();
      if (res.data.success) {
        setData(res.data.data);
        // Set default source preference
        if (res.data.data.impactBySource.length > 0) {
             const hasCustom = res.data.data.impactBySource.find((s: any) => s.source === 'CUSTOM');
             const hasBcv = res.data.data.impactBySource.find((s: any) => s.source === 'BCV');
             if (hasCustom) setSelectedSource('CUSTOM');
             else if (hasBcv) setSelectedSource('BCV');
             else setSelectedSource(res.data.data.impactBySource[0].source);
        }
      }
    } catch (error) {
      console.error('Failed to load forex impact', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentImpact = data?.impactBySource.find(s => s.source === selectedSource);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 flex items-center gap-2 mb-2 transition-colors">
              <ArrowLeft size={16} /> Volver al Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingDown className="text-orange-600" />
              Reporte de Impacto Cambiario
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Análisis detallado de pérdida de valor por tenencia de Bolívares.
            </p>
          </div>
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all text-gray-600 dark:text-gray-300"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
           <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center animate-pulse">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mx-auto mb-4"></div>
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mx-auto"></div>
           </div>
        ) : !data || data.totalBs === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Sin exposición cambiaria</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    No tienes cuentas con saldo positivo en Bolívares actualmente. ¡Bien hecho!
                </p>
            </div>
        ) : (
            <>
                {/* Controls & Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tasa Selector */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">Escenario de Tasa</h3>
                        <div className="flex gap-2 mb-6">
                             {data.impactBySource.map(s => (
                                 <button
                                    key={s.source}
                                    onClick={() => setSelectedSource(s.source)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all border ${
                                        selectedSource === s.source 
                                        ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800' 
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                                    }`}
                                 >
                                    {s.source}
                                 </button>
                             ))}
                        </div>

                        {currentImpact && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tasa Ayer ({new Date(currentImpact.sourceDateYesterday).toLocaleDateString()})</div>
                                    <div className="text-xl font-mono font-medium text-gray-900 dark:text-white">Bs. {currentImpact.rateYesterday.toFixed(2)}</div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tasa Hoy ({new Date(currentImpact.sourceDateToday).toLocaleDateString()})</div>
                                    <div className="text-xl font-mono font-bold text-gray-900 dark:text-white">Bs. {currentImpact.rateToday.toFixed(2)}</div>
                                    <div className="text-xs text-red-500 font-medium mt-1">+{currentImpact.devaluationPercentage.toFixed(2)}% INC</div>
                                </div>
                            </div>
                        )}
                         <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <Info size={14} className="mt-0.5 text-blue-500" />
                            <p>El cálculo asume que mantuviste el saldo en Bolívares desde la fecha de la tasa anterior hasta hoy. La "Pérdida" representa cuántos dólares menos puedes comprar hoy con esos mismos Bolívares.</p>
                        </div>
                    </div>

                    {/* Total Impact Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white shadow-lg shadow-orange-200 dark:shadow-none flex flex-col justify-between">
                         <div>
                            <h3 className="text-orange-100 text-sm font-medium uppercase tracking-wide flex items-center gap-2">
                                <AlertTriangle size={16} /> Pérdida Estimada Total
                            </h3>
                            <div className="mt-2 text-4xl font-bold tracking-tight">
                                -${currentImpact?.lossUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                            </div>
                            <div className="mt-1 text-orange-100 text-sm">
                                Equivalent a perder <span className="font-bold text-white">Bs. {currentImpact?.lossBS.toLocaleString('es-VE', { minimumFractionDigits: 2 }) ?? '0'}</span>
                            </div>
                         </div>
                         <div className="mt-6 pt-6 border-t border-white/20">
                            <div className="flex justify-between items-center">
                                <span className="text-orange-100 text-sm">Capital Total Expuesto</span>
                                <span className="text-white font-medium text-lg">Bs. {data.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                            </div>
                         </div>
                    </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Detalle por Cuenta</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
                                <tr>
                                    <th className="px-6 py-3">Cuenta / Proyecto</th>
                                    <th className="px-6 py-3 text-right">Saldo (Bs)</th>
                                    <th className="px-6 py-3 text-right">Valor Ayer ($)</th>
                                    <th className="px-6 py-3 text-right">Valor Hoy ($)</th>
                                    <th className="px-6 py-3 text-right text-red-600 dark:text-red-400">Pérdida ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {data.accounts.map(acc => {
                                    const valYesterday = currentImpact ? acc.balanceBs / currentImpact.rateYesterday : 0;
                                    const valToday = currentImpact ? acc.balanceBs / currentImpact.rateToday : 0;
                                    const loss = valYesterday - valToday;

                                    return (
                                        <tr key={acc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{acc.name}</div>
                                                <div className="text-xs text-gray-500">{acc.projectName}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-600 dark:text-gray-300">
                                                {acc.balanceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-500">
                                                ${valYesterday.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-gray-900 dark:text-white font-medium">
                                                ${valToday.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/10">
                                                -${loss.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
}
