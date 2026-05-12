"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw, HardDrive, AlertTriangle, ArrowLeft, RotateCcw, Download } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

interface BackupConfig {
  enabled: boolean;
  schedule: string;
  keepLast: number;
}

interface BackupFile {
    id: string;
    name: string;
    size: number;
    createdAt: string;
    path: string;
}

export default function BackupSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningManual, setRunningManual] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: false,
    schedule: "0 2 * * *",
    keepLast: 7,
  });

  useEffect(() => {
    fetchConfig();
    fetchBackups();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.backups.getConfig();
      setConfig(res.data);
    } catch (error) {
      toast.error("Error al cargar configuración de respaldos");
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
      try {
          const res = await api.backups.list();
          setBackups(res.data);
      } catch (error) {
          console.error("Error fetching backups list", error);
      }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.backups.updateConfig(config);
      toast.success("Configuración guardada correctamente");
    } catch (error) {
      toast.error("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleManualBackup = async () => {
    if (!confirm("¿Estás seguro de ejecutar el respaldo ahora? Esto puede impactar el rendimiento momentáneamente.")) return;
    
    setRunningManual(true);
    const toastId = toast.loading("Ejecutando respaldo...");
    try {
      const res = await api.backups.triggerManual();
      toast.success("Respaldo completado exitosamente", { id: toastId });
      fetchBackups(); // Refresh list
    } catch (error: any) {
      toast.error("Error al ejecutar respaldo: " + (error.response?.data?.message || error.message), { id: toastId });
    } finally {
      setRunningManual(false);
    }
  };

  const handleRestore = async (backup: BackupFile) => {
      if (!confirm(`⚠️ PELIGRO:\n\nEstás a punto de restaurar el respaldo del: ${new Date(backup.createdAt).toLocaleString()}\n\nESTO BORRARÁ TODOS LOS DATOS ACTUALES Y LOS REEMPLAZARÁ.\n\n¿Estás absolutamente seguro?`)) return;

      const confirmText = prompt("Para confirmar, escribe 'RESTAURAR' en mayúsculas:");
      if (confirmText !== 'RESTAURAR') return;

      setRestoring(backup.id);
      const toastId = toast.loading("Iniciando restauración... El sistema se reiniciará en breve.");

      try {
          await api.backups.restore(backup.id);
          toast.success("Restauración iniciada. Por favor espera 1 minuto y recarga la página.", { id: toastId, duration: 10000 });
      } catch (error: any) {
          toast.error("Error al iniciar restauración: " + (error.response?.data?.message || error.message), { id: toastId });
          setRestoring(null);
      }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  if (loading) return <div className="p-8 text-center">Cargando configuración...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.back()} 
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-slate-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <HardDrive className="text-blue-600" />
            Copias de Seguridad
          </h1>
          <p className="text-slate-500">Configura la frecuencia y retención de los respaldos automáticos del sistema.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Automatic Backup Card */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Automatización</h2>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${config.enabled ? 'text-green-600' : 'text-slate-400'}`}>
                {config.enabled ? 'Activado' : 'Desactivado'}
              </span>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${config.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expresión Cron (Horario)
              </label>
              <input
                type="text"
                value={config.schedule}
                onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="0 2 * * *"
                disabled={!config.enabled}
              />
              <p className="text-xs text-slate-500 mt-1">
                Ejemplo: "0 2 * * *" = Todos los días a las 2:00 AM.
                <br />
                Formato: Minuto Hora Día Mes DíaSemana
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Retener últimos (días)
              </label>
              <input
                type="number"
                value={config.keepLast}
                onChange={(e) => setConfig({ ...config, keepLast: parseInt(e.target.value) || 7 })}
                className="w-full max-w-[120px] px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                disabled={!config.enabled}
              />
              <p className="text-xs text-slate-500 mt-1">
                Cantidad de copias recientes a mantener en el servidor.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="glass-btn bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Manual Action Card */}
        <div className="glass-card p-6 border-l-4 border-l-orange-400">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Acciones Manuales</h2>
          <p className="text-sm text-slate-600 mb-4">
            Puedes forzar la creación de un respaldo inmediato. Esto guardará la base de datos y los archivos cargados.
            <br />
            <span className="flex items-center gap-1 mt-2 text-orange-600 font-medium">
              <AlertTriangle size={16} />
              Nota: Puede ralentizar el sistema mientras se ejecuta.
            </span>
          </p>
          
          <button
            onClick={handleManualBackup}
            disabled={runningManual}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm font-medium"
          >
            <RefreshCw size={18} className={runningManual ? "animate-spin" : ""} />
            {runningManual ? 'Ejecutando respaldo...' : 'Ejecutar Respaldo Ahora'}
          </button>
        </div>

        {/* Restore List Card */}
        <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Archivos Disponibles</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Archivo</th>
                            <th className="px-4 py-3">Tamaño</th>
                            <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {backups.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-4 text-center text-slate-500">
                                    No hay respaldos disponibles. Ejecuta uno manual para empezar.
                                </td>
                            </tr>
                        ) : (
                            backups.map((backup) => (
                                <tr key={backup.id} className="border-b hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium">
                                        {new Date(backup.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                                        {backup.name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {formatBytes(backup.size)}
                                    </td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <button 
                                            onClick={() => handleRestore(backup)}
                                            disabled={!!restoring}
                                            className="text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                                        >
                                            {restoring === backup.id ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                            Restaurar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}
