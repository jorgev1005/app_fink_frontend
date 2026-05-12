"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ArrowLeft, DollarSign, AlertCircle, Clock, RefreshCw, Printer, Share2 } from 'lucide-react';
import api from "@/lib/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function BudgetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Filters
  const [selectedProject, setSelectedProject] = useState<string>("");
  
  // Date State
  const [mode, setMode] = useState<'month' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    return format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
  });

  const [currency, setCurrency] = useState<"BS" | "USD">("USD");

  // Data
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // Sync month selection to dates
  useEffect(() => {
    if (mode === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      setStartDate(format(start, 'yyyy-MM-dd'));
      setEndDate(format(end, 'yyyy-MM-dd'));
    }
  }, [mode, selectedMonth]);

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
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
        startDate,
        endDate,
        currency
      };

      const res = await api.reports.getCashFlow(params);
      setData(res.data.data);

    } catch (error) {
      console.error("Error loading cash flow data", error);
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

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "EEEE, dd MMM yyyy", { locale: es });
  };

  const getWeeksCount = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
    return Math.ceil(diffDays / 7);
  };

  const getMonthOptions = () => {
    const options = [];
    const today = new Date();
    for (let i = -6; i <= 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const label = format(d, "MMMM yyyy", { locale: es });
      const value = format(d, "yyyy-MM");
      options.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value });
    }
    return options;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen print:bg-white print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
            <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
            <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <div>
            <h1 className="text-2xl font-bold text-gray-800">Presupuesto de Flujo de Caja</h1>
            <p className="text-gray-500 text-sm">Proyección de ingresos y egresos</p>
            </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
                <Printer size={18} />
                <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
        </div>
      </div>

      {/* Print Header (Visible only on print) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Reporte de Flujo de Caja</h1>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
            <div>
                <p>Generado: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                <p>Periodo: {formatDate(startDate)} - {formatDate(endDate)}</p>
            </div>
            <div className="text-right">
                <p>Moneda: {currency}</p>
                {selectedProject && <p>Proyecto: {projects.find(p => p.id === selectedProject)?.name}</p>}
            </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm flex flex-wrap gap-4 items-center print:hidden">
        <select 
          className="border rounded-md p-2 text-sm min-w-[200px]"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="">Todos los Proyectos</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
          <div className="flex bg-gray-100 rounded p-1">
            <button
              onClick={() => setMode('month')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'month' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Por Mes
            </button>
            <button
              onClick={() => setMode('range')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'range' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Rango
            </button>
          </div>

          <div className="h-6 w-px bg-gray-200 mx-1"></div>

          {mode === 'month' ? (
            <select
              className="text-sm outline-none bg-transparent py-1 px-2 min-w-[140px]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 px-2">
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
          )}
          
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          
          <div className="px-2 text-xs text-gray-500 font-medium whitespace-nowrap">
            {getWeeksCount()} Semanas
          </div>
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
          className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors ml-auto"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Main Content */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:space-y-6">
          
          {/* Summary Card */}
          <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 print:shadow-none print:border print:p-4">
             <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-green-600 text-sm font-medium uppercase">Ingresos Totales</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(data.summary.totalIncome)}</p>
             </div>
             <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-red-600 text-sm font-medium uppercase">Egresos Totales</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(data.summary.totalExpense)}</p>
             </div>
             <div className={`p-4 rounded-lg border ${data.summary.netFlow >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                <p className={`${data.summary.netFlow >= 0 ? 'text-blue-600' : 'text-orange-600'} text-sm font-medium uppercase`}>Flujo Neto</p>
                <p className={`text-2xl font-bold ${data.summary.netFlow >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(data.summary.netFlow)}</p>
             </div>
          </div>

          {/* Breakdown Columns */}
          
          {/* 1. Overdue (Left Column) */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-fit sticky top-6 print:static print:h-auto print:mb-6 print:shadow-none print:border">
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg print:bg-gray-100">
              <div className="flex items-center gap-2 text-gray-700 font-bold mb-2">
                <AlertCircle size={20} />
                <h3>Vencidas (Anteriores)</h3>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                 <span>Ing: <span className="text-green-600 font-medium">{formatCurrency(data.breakdown.overdue.income)}</span></span>
                 <span>Egr: <span className="text-red-600 font-medium">{formatCurrency(data.breakdown.overdue.expense)}</span></span>
              </div>
              <div className="mt-1 text-right font-bold text-sm">
                 Neto: <span className={data.breakdown.overdue.net >= 0 ? 'text-blue-600' : 'text-red-600'}>{formatCurrency(data.breakdown.overdue.net)}</span>
              </div>
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-[calc(100vh-200px)] space-y-3 print:overflow-visible print:max-h-none">
              {data.breakdown.overdue.items.length === 0 ? (
                <p className="text-gray-400 text-center text-sm py-4">No hay items vencidos</p>
              ) : (
                data.breakdown.overdue.items.map((item: any) => (
                  <div key={item.id} className={`flex justify-between items-start text-sm p-2 rounded border-l-2 ${item.flow === 'INCOME' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    <div>
                      <p className="font-medium text-gray-800">
                        {item.type === 'TRANSACTION' && <span className="text-xs bg-gray-200 text-gray-600 px-1 rounded mr-1">Manual</span>}
                        {item.description}
                      </p>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {item.issueDate && (
                          <p className="text-xs text-gray-500">Emisión: {formatDate(item.issueDate)}</p>
                        )}
                        <p className="text-xs text-red-500 font-medium">Venció: {formatDate(item.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${item.flow === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(item.amount)}</p>
                      {item.originalCurrency !== currency && (
                        <p className="text-xs text-gray-400">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.originalCurrency }).format(item.originalAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Weekly Breakdown */}
          <div className="lg:col-span-2 space-y-6 print:space-y-8">
            {data.breakdown.weekly.map((week: any) => (
              <div key={week.weekNumber} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border print:break-inside-avoid">
                <div className="p-4 bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                        <h3 className="font-bold text-gray-800">Semana {week.weekNumber}</h3>
                        <p className="text-xs text-gray-500">
                        {formatDate(week.startDate)} - {formatDate(week.endDate)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase">Flujo Neto Semana</p>
                        <span className={`font-bold text-lg ${week.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(week.net)}</span>
                    </div>
                  </div>
                  
                  {/* Calculation Bar */}
                  <div className="flex items-center justify-between text-sm bg-white p-2 rounded border border-gray-100">
                     <div className="flex flex-col">
                        <span className="text-xs text-gray-400">Balance Inicial</span>
                        <span className={`font-medium ${week.initialBalance >= 0 ? 'text-gray-700' : 'text-red-600'}`}>{formatCurrency(week.initialBalance)}</span>
                     </div>
                     <div className="text-gray-300">+</div>
                     <div className="flex flex-col">
                        <span className="text-xs text-gray-400">Ingresos</span>
                        <span className="font-medium text-green-600">{formatCurrency(week.income)}</span>
                     </div>
                     <div className="text-gray-300">-</div>
                     <div className="flex flex-col">
                        <span className="text-xs text-gray-400">Egresos</span>
                        <span className="font-medium text-red-600">{formatCurrency(week.expense)}</span>
                     </div>
                     <div className="text-gray-300">=</div>
                     <div className="flex flex-col text-right">
                        <span className="text-xs text-gray-400">Balance Final (Excedente)</span>
                        <span className={`font-bold ${week.finalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(week.finalBalance)}</span>
                     </div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {week.items.length === 0 ? (
                    <p className="text-gray-400 text-center text-sm py-4">Sin movimientos programados</p>
                  ) : (
                    week.items.map((item: any) => (
                      <div key={item.id} className={`flex justify-between items-center p-3 hover:bg-gray-50 ${item.flow === 'INCOME' ? 'border-l-4 border-green-400' : 'border-l-4 border-red-400'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${item.flow === 'INCOME' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            <DollarSign size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                                {item.type === 'RECURRING' && <span className="text-xs bg-purple-100 text-purple-600 px-1 rounded mr-1">Recurrente</span>}
                                {item.description}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${item.flow === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>
                            {item.flow === 'INCOME' ? '+' : '-'}{formatCurrency(item.amount)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
