"use client";
import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { Briefcase, Loader2, Sparkles, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ProjectSummary {
  id: string;
  name: string;
}

interface CFOWidgetProps {
  projects?: ProjectSummary[];
}

const CACHE_HOURS = 12;

export default function CFOWidget({ projects = [] }: CFOWidgetProps) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(''); // Vacio = Todos

  useEffect(() => {
    fetchSummary(selectedProjectId, false);
  }, [selectedProjectId]);

  const fetchSummary = (id: string, forceRefresh: boolean = false) => {
    const cacheKey = "cfo_summary_" + (id || "global");
    
    if (!forceRefresh) {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const now = Date.now();
          const isExpired = now - parsed.timestamp > (CACHE_HOURS * 60 * 60 * 1000);
          
          if (!isExpired && parsed.summary) {
            setSummary(parsed.summary);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Ignorar errores de cache
        }
      }
    }

    setLoading(true);
    setSummary('');
    api.cfo.getSummary(id)
      .then(res => {
        if (res.data?.success) {
          const newSummary = res.data.data.summary;
          setSummary(newSummary);
          localStorage.setItem(cacheKey, JSON.stringify({
            summary: newSummary,
            timestamp: Date.now()
          }));
        } else {
          throw new Error("Respuesta inválida del servidor");
        }
      })
      .catch(err => {
        console.error("CFO Widget Fetch Error:", err);
        // Guardamos un mensaje temporal en la caché por 12 horas para evitar martillar la API en cada visita al fallar
        const fallbackMessage = "Mis servidores de IA presentan demoras temporales de conexión en este momento. Si necesitas un análisis urgente, haz clic en Actualizar consejo abajo.";
        setSummary(fallbackMessage);
        localStorage.setItem(cacheKey, JSON.stringify({
          summary: fallbackMessage,
          timestamp: Date.now()
        }));
      })
      .finally(() => setLoading(false));
  };

  const handleManualRefresh = () => {
    fetchSummary(selectedProjectId, true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="bg-indigo-600 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <Briefcase size={18} />
          <h3 className="font-medium whitespace-nowrap">CFO Virtual</h3>

          {/* Selector de Proyecto */}
          <div className="ml-2 relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="appearance-none bg-indigo-700/50 hover:bg-indigo-700 text-white text-sm py-1 pl-3 pr-8 rounded-md border border-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors cursor-pointer"
            >
              <option value="">Todos los Proyectos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-indigo-200 pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-200 text-xs sm:text-right">
          <Sparkles size={14} />
          <span className="hidden sm:inline">Inteligencia Financiera</span>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 py-2">
            <Loader2 size={18} className="animate-spin text-indigo-500" />
            <p className="text-sm">Analizando estado financiero...</p>
          </div>
        ) : summary ? (
          <div className="relative">
            <p className="text-slate-700 text-sm md:text-base leading-relaxed pl-3 border-l-2 border-indigo-300">
              "{summary}"
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleManualRefresh}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                title="Volver a consultar al CFO con los datos más recientes"
              >
                <RefreshCw size={14} />
                <span>Actualizar consejo</span>
              </button>
              
              <Link
                href={"/reports/cfo?projectId=" + selectedProjectId}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors border border-indigo-100"
              >
                Ver Análisis Detallado &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle size={18} />
              <p className="text-sm">No se pudo generar el consejo.</p>
            </div>
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <RefreshCw size={14} />
              <span>Reintentar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
