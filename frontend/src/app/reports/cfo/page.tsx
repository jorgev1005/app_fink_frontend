"use client";
import React, { useEffect, useState, Suspense } from 'react';
import api from '@/lib/api';
import { ArrowLeft, BrainCircuit, RefreshCw, AlertCircle, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function CFOReportContent() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';
  
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);

  // Fetch projects config to show the selector on the report page too
  useEffect(() => {
    api.dashboard.getGeneral()
      .then((res: any) => {
        if (res.data?.success && res.data.data.projects) {
          setProjects(res.data.data.projects);
        }
      })
      .catch(console.error);
  }, []);

  const fetchReport = (projectIdVal: string) => {
    setLoading(true);
    setError('');
    
    api.cfo.getDetailedReport(projectIdVal)
      .then((res: any) => {
        if (res.data?.success) {
          setReport(res.data.data.report);
        } else {
          setError(res.data?.error || 'Error desconocido al generar reporte');
        }
      })
      .catch((err: any) => {
        console.error('CFO error:', err);
        setError('Ocurrió un problema al comunicarse con el CFO Virtual.');
      })
      .finally(() => setLoading(false));
  };

  // Whenever the user changes the select or the page loads, fetch report
  useEffect(() => {
    fetchReport(selectedProjectId);
  }, [selectedProjectId]);

  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full mt-4">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4 w-full">
          <Link href="/dashboard" className="p-2 bg-white border border-slate-200 shadow-sm hover:bg-slate-100 rounded-lg transition-colors text-slate-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <BrainCircuit className="text-indigo-600" /> CFO Virtual
            </h1>
            <p className="text-sm text-slate-500">Reporte Analítico Financiero Semántico</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 size={16} className="text-slate-400" />
            </div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={loading}
              className="appearance-none w-full bg-white border border-slate-200 text-slate-700 text-sm py-2.5 pl-10 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <option value="">Todos los Proyectos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => fetchReport(selectedProjectId)}
            disabled={loading}
            className="flex items-center justify-center p-2.5 bg-indigo-600 border border-indigo-700 shadow-md rounded-lg text-white hover:bg-indigo-700 transition-colors disabled:opacity-70"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-semibold">Error al obtener recomendaciones</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-10 min-h-[500px]">
        {loading && !report ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-indigo-500 gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-100 rounded-full blur-xl animate-pulse opacity-50"></div>
              <BrainCircuit size={64} className="relative animate-pulse drop-shadow-md" />
            </div>
            <div className="text-center">
              <p className="font-medium text-lg text-slate-800">El CFO Virtual está analizando tu contexto...</p>
              <p className="text-sm text-slate-500 mt-2">Correlacionando cuentas, cuentas por cobrar y pasivos.</p>
            </div>
          </div>
        ) : report ? (
          <div className="prose prose-slate prose-indigo max-w-none 
               prose-headings:font-bold prose-h1:text-3xl prose-h1:text-slate-800
               prose-h2:text-2xl prose-h2:text-indigo-900 prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-100
               prose-h3:text-xl prose-h3:text-slate-800 
               prose-p:text-slate-700 prose-p:leading-relaxed
               prose-li:text-slate-700 prose-ul:my-4 prose-ul:list-disc
               prose-strong:text-indigo-950 prose-strong:font-bold" 
               dangerouslySetInnerHTML={{ __html: formatMarkdown(report) }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 gap-4">
            <BrainCircuit size={48} className="opacity-20" />
            <p>Ningún reporte generado todavía.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CFOReportPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      <Suspense fallback={<div className="flex flex-col items-center justify-center h-full min-h-[400px] text-indigo-500"><RefreshCw className="animate-spin" /></div>}>
        <CFOReportContent />
      </Suspense>
    </div>
  );
}

function formatMarkdown(text: string) {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gim, '<h3></h3>')
    .replace(/^## (.*$)/gim, '<h2></h2>')
    .replace(/^# (.*$)/gim, '<h1></h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong></strong>')
    .replace(/\*(.*?)\*/gim, '<em></em>')
    .replace(/^\s*\-\s(.*$)/gim, '<li></li>')
    .replace(/\n\n/gim, '<br/><br/>')
    .replace(/\n/gim, ' ');
}


