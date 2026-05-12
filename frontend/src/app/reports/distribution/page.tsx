"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  PieChart, 
  Wallet, 
  TrendingUp, 
  ShieldCheck, 
  Award, 
  RefreshCw,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import api from "@/lib/api";
import { format } from "date-fns";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DistributionRule {
  id: string;
  label: string;
  percent: number;
  color: string;
  icon: any;
  description: string;
}

const PRESETS = {
  BUSINESS: [
    { id: 'profit', label: 'Ganancia (Profit)', percent: 5, color: '#10B981', icon: Award, description: 'Beneficio neto para la empresa' },
    { id: 'owner', label: 'Sueldo del Dueño', percent: 10, color: '#F59E0B', icon: ShieldCheck, description: 'Compensación por tu trabajo' },
    { id: 'tax', label: 'Impuestos', percent: 15, color: '#6366F1', icon: Wallet, description: 'Reserva para obligaciones fiscales' },
    { id: 'expenses', label: 'Gastos Operativos', percent: 70, color: '#EF4444', icon: TrendingUp, description: 'Costos fijos y variables' },
  ],
  PERSONAL: [
    { id: 'needs', label: 'Necesidades Básicas', percent: 50, color: '#EF4444', icon: Wallet, description: 'Vivienda, comida, servicios, transporte' },
    { id: 'wants', label: 'Estilo de Vida / Deseos', percent: 25, color: '#3B82F6', icon: Award, description: 'Salidas, hobbies, compras personales' },
    { id: 'savings', label: 'Ahorro e Inversión', percent: 15, color: '#10B981', icon: TrendingUp, description: 'Retiro, metas futuras, patrimonio' },
    { id: 'stability', label: 'Fondo de Estabilidad', percent: 10, color: '#F59E0B', icon: ShieldCheck, description: 'Contingencias y fondo de emergencia' },
  ]
};

export default function RevenueDistributionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [currency, setCurrency] = useState<"BS" | "USD">("USD");

  // Data
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [projectedIncome, setProjectedIncome] = useState(0);
  const [includeProjections, setIncludeProjections] = useState(false);
  const [rules, setRules] = useState<DistributionRule[]>(PRESETS.BUSINESS);

  useEffect(() => {
    loadProjects();
    // Load saved rules from localStorage if available
    const savedRules = localStorage.getItem('fink_distribution_rules');
    if (savedRules) {
      try {
        const parsed = JSON.parse(savedRules);
        // Try to match with Business or Personal icons
        // We need a way to restore icons since they are not saved in JSON
        // We'll look up in both presets
        const allDefinitions = [...PRESETS.BUSINESS, ...PRESETS.PERSONAL];
        
        const merged = parsed.map((saved: any) => {
          const def = allDefinitions.find(d => d.id === saved.id);
          return def ? { ...def, percent: saved.percent } : null;
        }).filter(Boolean);
        
        if (merged.length > 0) setRules(merged);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedProject, startDate, endDate, currency, includeProjections]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (e) { console.error(e); }
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

      // 1. Get Realized Income (Completed)
      const res = await api.reports.getSummary(params);
      const income = res.data.data.global.income || 0;
      const expense = res.data.data.global.expense || 0;
      
      let projected = 0;

      // 2. Get Projected Income (Future/Recurring) if enabled
      if (includeProjections) {
        try {
          const cashFlowRes = await api.reports.getCashFlow(params);
          // CashFlow returns weekly breakdown. We sum all weeks income.
          // Note: CashFlow logic filters items >= startDate.
          // We need to be careful not to double count if getSummary included pending (it doesn't, it filters COMPLETED).
          // getCashFlow includes PENDING and RECURRING.
          
          console.log('CashFlow Response:', cashFlowRes.data);
          if (cashFlowRes.data?.data?.breakdown?.weekly) {
             projected = cashFlowRes.data.data.breakdown.weekly.reduce((acc: number, w: any) => acc + (w.income || 0), 0);
             console.log('Calculated Projected:', projected);
          }
        } catch (err) {
          console.error("Error loading projections", err);
        }
      }

      setTotalIncome(income + projected);
      setProjectedIncome(projected);
      setTotalExpense(expense);
    } catch (error) {
      console.error("Error loading data", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePercentChange = (id: string, newVal: string) => {
    const val = parseFloat(newVal) || 0;
    setRules(prev => prev.map(r => r.id === id ? { ...r, percent: val } : r));
  };

  const saveConfiguration = () => {
    const toSave = rules.map(({ id, percent }) => ({ id, percent }));
    localStorage.setItem('fink_distribution_rules', JSON.stringify(toSave));
    // Optional: Add toast notification here
  };

  const resetConfiguration = (preset: 'BUSINESS' | 'PERSONAL' = 'BUSINESS') => {
    setRules(PRESETS[preset]);
    localStorage.removeItem('fink_distribution_rules');
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: currency === 'BS' ? 'VES' : 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  const totalPercent = rules.reduce((acc, r) => acc + r.percent, 0);
  const isValidTotal = Math.abs(totalPercent - 100) < 0.1;

  // Chart Data
  const chartData = {
    labels: rules.map(r => r.label),
    datasets: [
      {
        data: rules.map(r => totalIncome * (r.percent / 100)),
        backgroundColor: rules.map(r => r.color),
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <PieChart className="text-blue-600" />
              Distribución de Ingresos
            </h1>
            <p className="text-slate-500 text-sm">Planificación financiera basada en cobros reales</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
        <select 
          className="border border-slate-200 rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
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
            className="border border-slate-200 rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-slate-400">-</span>
          <input 
            type="date" 
            className="border border-slate-200 rounded-lg text-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
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

        <button 
          onClick={loadData}
          className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors ml-auto"
          title="Recargar datos"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Projections Toggle */}
      <div className="flex items-center gap-2 px-4">
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer"
            checked={includeProjections}
            onChange={(e) => setIncludeProjections(e.target.checked)}
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ml-3 text-sm font-medium text-slate-700">Incluir Proyecciones (Reglas Recurrentes y Pendientes)</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration & Chart */}
        <div className="space-y-6">
          {/* Total Income Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center">
            <p className="text-slate-500 font-medium mb-1">Total {includeProjections ? 'Proyectado' : 'Cobrado'}</p>
            <h2 className="text-4xl font-bold text-slate-800">{formatCurrency(totalIncome)}</h2>
            {includeProjections && projectedIncome > 0 && (
               <p className="text-xs text-blue-600 mt-1 font-medium">Incluye {formatCurrency(projectedIncome)} en proyecciones</p>
            )}
            <p className="text-xs text-slate-400 mt-2">Base para la distribución</p>
          </div>

          {/* Configuration */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">Configurar Fórmula</h3>
              <div className="flex gap-2">
                <button onClick={saveConfiguration} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Guardar configuración">
                  <Save size={16} />
                </button>
              </div>
            </div>

            {/* Preset Selector */}
            <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-lg">
              <button 
                onClick={() => resetConfiguration('BUSINESS')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${rules[0]?.id === 'profit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Negocio (Profit First)
              </button>
              <button 
                onClick={() => resetConfiguration('PERSONAL')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${rules[0]?.id === 'needs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Personal (50/30/20)
              </button>
            </div>
            
            <div className="space-y-4">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${rule.color}20`, color: rule.color }}>
                    <rule.icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{rule.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      className="w-16 border border-slate-200 rounded px-2 py-1 text-right text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={rule.percent}
                      onChange={(e) => handlePercentChange(rule.id, e.target.value)}
                    />
                    <span className="text-slate-500 text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-4 p-3 rounded-lg text-sm flex justify-between items-center ${isValidTotal ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span className="font-medium">Total Asignado:</span>
              <span className="font-bold">{totalPercent}%</span>
            </div>
            {!isValidTotal && (
              <p className="text-xs text-red-500 mt-1">La suma de los porcentajes debe ser 100%</p>
            )}
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-center">
             <div className="w-48 h-48">
               <Doughnut data={chartData} options={{ cutout: '70%', plugins: { legend: { display: false } } }} />
             </div>
          </div>
        </div>

        {/* Right Column: Results Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
          {rules.map(rule => {
            const amount = totalIncome * (rule.percent / 100);
            const isExpenseRule = rule.id === 'expenses';
            const isOverBudget = isExpenseRule && totalExpense > amount;
            
            return (
              <div key={rule.id} className="bg-white p-6 rounded-xl shadow-sm border-l-4 relative overflow-hidden group hover:shadow-md transition-shadow" style={{ borderLeftColor: rule.color }}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <rule.icon size={64} color={rule.color} />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {rule.percent}%
                    </span>
                    <h3 className="font-bold text-slate-700">{rule.label}</h3>
                  </div>
                  
                  <div className="text-3xl font-bold text-slate-800 my-3">
                    {formatCurrency(amount)}
                  </div>
                  
                  <p className="text-sm text-slate-500 mb-2">
                    {rule.description}
                  </p>

                  {isExpenseRule && totalExpense > 0 && (
                    <div className={`mt-3 pt-3 border-t border-slate-100 text-xs ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                      <div className="flex justify-between mb-1">
                        <span>Gastos Reales:</span>
                        <span className="font-bold">{formatCurrency(totalExpense)}</span>
                      </div>
                      {isOverBudget ? (
                        <div className="flex items-center gap-1 font-bold">
                          <AlertCircle size={12} />
                          Excedido por {formatCurrency(totalExpense - amount)}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 font-bold">
                          <CheckCircle size={12} />
                          Dentro del presupuesto
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Summary Text */}
          <div className="col-span-1 sm:col-span-2 bg-blue-50 p-6 rounded-xl border border-blue-100 mt-4">
            <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
              <InfoIcon /> Resumen de Distribución
            </h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              De los <strong>{formatCurrency(totalIncome)}</strong> cobrados en este periodo, deberías destinar 
              <strong> {formatCurrency(totalIncome * (rules.find(r => r.id === 'expenses' || r.id === 'needs')?.percent || 0) / 100)}</strong> para cubrir tus gastos {rules[0]?.id === 'needs' ? 'básicos' : 'operativos'}. 
              Te queda un beneficio neto proyectado de <strong>{formatCurrency(totalIncome * (1 - (rules.find(r => r.id === 'expenses' || r.id === 'needs')?.percent || 0) / 100))}</strong> para distribuir en las demás categorías.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
  )
}
