"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Sliders, Percent, FileText, FileClock, Building } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function GeneralSettingsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Configuration Fields
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(16);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState<string>("");
  const [lastDeliveryNoteNumber, setLastDeliveryNoteNumber] = useState<string>("");

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const proj = projects.find((p) => p.id === selectedProjectId);
      if (proj) {
        setDefaultTaxRate(proj.defaultTaxRate ?? 16);
        setLastInvoiceNumber(proj.lastInvoiceNumber ?? "");
        setLastDeliveryNoteNumber(proj.lastDeliveryNoteNumber ?? "");
      }
    } else {
      setDefaultTaxRate(16);
      setLastInvoiceNumber("");
      setLastDeliveryNoteNumber("");
    }
  }, [selectedProjectId, projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.projects.getAll();
      const list = (res.data.data || []).filter((p: any) => p.status !== "PAUSED");
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId(list[0].id);
      }
    } catch (error) {
      toast.error("Error al cargar los proyectos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast.error("Selecciona un proyecto primero");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        defaultTaxRate: Number(defaultTaxRate),
        lastInvoiceNumber: lastInvoiceNumber.trim() || null,
        lastDeliveryNoteNumber: lastDeliveryNoteNumber.trim() || null,
      };

      await api.projects.update(selectedProjectId, payload);
      toast.success("Configuración del proyecto guardada exitosamente");
      
      // Update local state list to reflect changes without a full fetch
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProjectId
            ? { ...p, ...payload }
            : p
        )
      );
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message || "Error al guardar la configuración";
      toast.error(msg);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-white/50 rounded-full transition-colors glass-panel"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sliders className="text-blue-600" />
            Configuración General
          </h1>
          <p className="text-slate-500 text-sm">Gestiona los correlativos e IVA por defecto de tus proyectos.</p>
        </div>
      </div>

      {/* Banner de Permisos de Usuarios */}
      <div className="mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            🛡️ Permisos de Usuarios por Proyecto
          </h2>
          <p className="text-xs text-blue-100 mt-1">
            Asigna qué correos electrónicos tienen acceso a ver o modificar cada uno de los proyectos.
          </p>
        </div>
        <button
          onClick={() => router.push("/settings/users")}
          className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
        >
          Gestionar Permisos de Usuarios
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-500">
          <Building className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-lg">No se encontraron proyectos activos</p>
          <p className="text-sm text-slate-400 mt-1">Crea un proyecto primero para poder configurarlo.</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="grid gap-6">
          {/* Project Selector Card */}
          <div className="glass-card p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Selecciona el Proyecto a Configurar
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full p-3 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 font-medium transition-all"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Settings Parameters Card */}
          <div className="glass-card p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3">
              Parámetros de Facturación
            </h2>

            {/* Default Tax Rate */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Percent size={16} className="text-blue-500" />
                  Tasa de IVA por defecto (%)
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tasa impositiva por defecto sugerida al crear nuevos documentos de este proyecto.
                </p>
              </div>
              <div className="w-full md:w-32 relative">
                <input
                  type="number"
                  step="any"
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                  className="glass-input pr-8 text-center font-bold text-lg"
                  placeholder="16"
                  min="0"
                />
                <span className="absolute right-3 top-3 text-slate-400 font-bold text-sm">%</span>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Last Invoice Number */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText size={16} className="text-emerald-500" />
                  Último Número de Factura
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Último código/número de factura de venta emitido. Las nuevas facturas autogeneradas incrementarán desde aquí.
                </p>
              </div>
              <div className="w-full md:w-48">
                <input
                  type="text"
                  value={lastInvoiceNumber}
                  onChange={(e) => setLastInvoiceNumber(e.target.value)}
                  className="glass-input text-center font-mono"
                  placeholder="Ej: 0001 o FAC-0001"
                />
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Last Delivery Note Number */}
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileClock size={16} className="text-indigo-500" />
                  Último Número de Nota de Entrega
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Último código/número de nota de entrega de venta emitido. Las nuevas notas de entrega autogeneradas incrementarán desde aquí.
                </p>
              </div>
              <div className="w-full md:w-48">
                <input
                  type="text"
                  value={lastDeliveryNoteNumber}
                  onChange={(e) => setLastDeliveryNoteNumber(e.target.value)}
                  className="glass-input text-center font-mono"
                  placeholder="Ej: NE-0001"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="glass-btn glass-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="glass-btn glass-btn-primary flex items-center gap-2"
            >
              <Save size={18} />
              {saving ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
