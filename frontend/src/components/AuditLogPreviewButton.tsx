"use client";
import { useState } from "react";
import { auditAPI } from "@/lib/auditApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AuditLogPreviewButton({ accountId, projectId }: { accountId: string, projectId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<any[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");

  const fetchLog = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await auditAPI.getAccountLog({ accountId, projectId, adminKey });
      setLog(res.data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || "Error al consultar log");
      setLog([]);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Log de Auditoría de Cuenta", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Fecha", "Acción", "Usuario", "Detalle"]],
      body: log.map((l) => [
        l.createdAt ? new Date(l.createdAt).toLocaleString() : "",
        l.action || "",
        l.userName || l.userId || "",
        l.details || ""
      ]),
    });
    doc.save("auditoria_cuenta.pdf");
  };

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-5 py-3 rounded-full shadow-lg hover:bg-blue-700 transition"
        onClick={() => setOpen(true)}
        title="Previsualizar log de auditoría"
      >
        Preview Auditoría
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl relative">
            <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setOpen(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-4">Log de Auditoría de Cuenta</h2>
            <div className="mb-4 flex gap-2 items-end">
              <input
                type="password"
                placeholder="Clave admin"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                className="border px-3 py-2 rounded w-48"
              />
              <button
                onClick={fetchLog}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !adminKey}
              >
                Consultar
              </button>
              {log.length > 0 && (
                <button
                  onClick={exportPDF}
                  className="ml-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Exportar PDF
                </button>
              )}
            </div>
            {error && <div className="text-red-600 mb-2">{error}</div>}
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full text-sm border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Fecha</th>
                    <th className="p-2 border">Acción</th>
                    <th className="p-2 border">Usuario</th>
                    <th className="p-2 border">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="p-2 border">{l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}</td>
                      <td className="p-2 border">{l.action}</td>
                      <td className="p-2 border">{l.userName || l.userId}</td>
                      <td className="p-2 border">{l.details}</td>
                    </tr>
                  ))}
                  {log.length === 0 && !loading && (
                    <tr><td colSpan={4} className="p-4 text-center text-gray-400">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
              {loading && <div className="text-center py-4">Cargando...</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
