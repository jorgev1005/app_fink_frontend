"use client";
import { useEffect, useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { Calendar, Filter, Download, RefreshCw, ArrowRight, PieChart as PieChartIcon } from 'lucide-react';
import api from "@/lib/api";
import { format } from "date-fns";
import Link from "next/link";
import SimpleModal from "@/components/SimpleModal";

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', 
  '#f43f5e', '#8b5cf6', '#d946ef', '#ec4899', '#f97316', '#f59e0b', 
  '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', 
  '#0ea5e9', '#0284c7', '#3b82f6', '#6366f1', '#a855f7'
];

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Filters
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [currency, setCurrency] = useState<"BS" | "USD">("BS");

  // Data
  const [summary, setSummary] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Category Details Modal
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [selectedCategoryTransactions, setSelectedCategoryTransactions] = useState<any[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedProject, startDate, endDate, currency]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (error) {
      console.error("Error loading projects", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        projectId: selectedProject || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        currency
      };

      const [resSummary, resTrend, resCats, resMethods] = await Promise.all([
        api.reports.getSummary(params),
        api.reports.getTrend(params),
        api.reports.getCategories({ ...params, type: 'EXPENSE' }), // Default to expense categories
        api.reports.getPaymentMethods(params)
      ]);

      setSummary(resSummary.data.data);
      setTrend(resTrend.data.data);
      setCategories(resCats.data.data);
      setPaymentMethods(resMethods.data.data);

    } catch (error) {
      console.error("Error loading report data", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: currency === 'BS' ? 'VES' : 'USD' 
    }).format(val);
  };

  const getFrequencyText = (txs: any[]) => {
    if (!txs || txs.length < 2) return "N/A (Muy pocos cálculos)";
    try {
      const sorted = [...txs].sort((a,b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
      const diffTime = Math.abs(new Date(sorted[sorted.length-1].date || 0).getTime() - new Date(sorted[0].date || 0).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Transacciones el mismo día";
      const avgDays = Math.round(diffDays / (sorted.length - 1));
      
      if (avgDays >= 28 && avgDays <= 33) return "Mensual (~30 días)";
      if (avgDays >= 13 && avgDays <= 17) return "Quincenal (~15 días)";
      if (avgDays >= 6 && avgDays <= 8) return "Semanal (~7 días)";
      if (avgDays >= 355 && avgDays <= 375) return "Anual (~365 días)";
      
      return `Cada ${avgDays} días aprox.`;
    } catch(e) {
      return "Frecuencia desconocida";
    }
  };

  const handlePrintCategory = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const frequencyText = getFrequencyText(selectedCategoryTransactions);
    const tableRows = selectedCategoryTransactions.map((tx: any) => `
      <tr>
        <td>${tx.date ? format(new Date(tx.date), "dd/MM/yyyy") : 'N/A'}</td>
        <td>${tx.description || 'Sin descripción'}</td>
        <td class="text-right">${new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(tx.amountBs || 0)}</td>
        <td class="text-right">${new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(tx.amountUsd || 0)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte: ${selectedCategoryName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h2 { border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 5px; }
            .meta { font-size: 14px; color: #555; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f9f9f9; }
            .text-right { text-align: right; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h2>Categoría: ${selectedCategoryName}</h2>
          <div class="meta">
            <strong>Frecuencia estimada:</strong> ${frequencyText}
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th class="text-right">Monto (Bs)</th>
                <th class="text-right">Monto (USD)</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reportes y Análisis</h1>
          <p className="text-gray-500 text-sm">Visualiza el rendimiento financiero</p>
        </div>
        
        <div className="flex gap-2">
           <Link href="/reports/aging" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
              Cuentas por Cobrar/Pagar
           </Link>
           <Link href="/reports/distribution" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
              Distribución de Ingresos
           </Link>
           <Link href="/reports/advanced" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              Reportes Avanzados <ArrowRight size={16} />
           </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-lg shadow-sm">
          <select 
            className="border rounded-md p-2 text-sm"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">Todos los Proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 border rounded-md p-2 bg-white">
            <Calendar size={16} className="text-gray-400" />
            <input 
              type="date" 
              className="text-sm outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <input 
              type="date" 
              className="text-sm outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex border rounded-md overflow-hidden">
            <button 
              className={`px-3 py-2 text-sm ${currency === 'BS' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              onClick={() => setCurrency('BS')}
            >
              Bs
            </button>
            <button 
              className={`px-3 py-2 text-sm ${currency === 'USD' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              onClick={() => setCurrency('USD')}
            >
              USD
            </button>
          </div>

          <button 
            onClick={loadData}
            className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          <a 
            href="/reports/budget"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Calendar size={16} />
            Presupuesto de Pagos
          </a>
          <a 
            href="/reports/distribution"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
          >
            <PieChartIcon size={16} />
            Distribución de Ingresos
          </a>
        </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500 text-sm font-medium">Ingresos Totales</p>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {formatCurrency(summary.global.income)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
            <p className="text-gray-500 text-sm font-medium">Gastos Totales</p>
            <p className="text-2xl font-bold text-gray-800 mt-2">
              {formatCurrency(summary.global.expense)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm font-medium">Balance Neto</p>
            <p className={`text-2xl font-bold mt-2 ${summary.global.income - summary.global.expense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.global.income - summary.global.expense)}
            </p>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold mb-6">Tendencia de Ingresos vs Gastos</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Ingresos" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" name="Gastos" stroke="#EF4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm flex flex-col h-full">
          <h3 className="text-lg font-semibold mb-6">Gastos por Categoría</h3>
          <div className="h-[250px] w-full flex justify-center shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {(categories || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Categories Table */}
          <div className="mt-6 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium rounded-tl-md">Categoría</th>
                  <th className="px-3 py-2 font-medium text-right">Monto</th>
                  <th className="px-3 py-2 font-medium text-right rounded-tr-md">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(categories || []).map((cat, idx) => {
                  const total = (categories || []).reduce((sum, c) => sum + c.value, 0);
                  const percent = total > 0 ? ((cat.value / total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={idx} className="hover:bg-slate-50 cursor-pointer" onClick={() => {
                        setSelectedCategoryName(cat.name);
                        setSelectedCategoryTransactions(cat.transactions || []);
                    }}>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                        <span className="truncate max-w-[150px]" title={cat.name}>{cat.name}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        {formatCurrency(cat.value)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {percent}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Methods Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-6">Métodos de Pago</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentMethods || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" name="Monto" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <SimpleModal
        open={!!selectedCategoryName}
        onClose={() => {
          setSelectedCategoryName(null);
          setSelectedCategoryTransactions([]);
        }}
        title={`Gastos en: ${selectedCategoryName}`}
      >
        {selectedCategoryTransactions.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No hay detalles o no se encontraron transacciones en esta vista previa.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div>
                <span className="text-xs text-blue-500 font-semibold uppercase tracking-wider">Frecuencia de Pagos</span>
                <p className="text-sm font-medium text-slate-800">{getFrequencyText(selectedCategoryTransactions)}</p>
              </div>
              <button 
                onClick={handlePrintCategory}
                className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir PDF
              </button>
            </div>
          
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium rounded-tl-md">Fecha</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium text-right">Bs</th>
                  <th className="px-3 py-2 font-medium text-right rounded-tr-md">USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedCategoryTransactions.map((tx: any, idx: number) => (
                  <tr key={tx.id || idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{tx.date ? format(new Date(tx.date), "dd/MM/yyyy") : "N/A"}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]" title={tx.description}>{tx.description}</td>
                    <td className="px-3 py-2 text-right">
                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(tx.amountBs || 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(tx.amountUsd || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </SimpleModal>
    </div>
  );
}
