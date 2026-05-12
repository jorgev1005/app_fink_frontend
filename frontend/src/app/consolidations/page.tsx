"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Layers, Plus, ArrowRight, BarChart3, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

type ConsolidationCurrency = 'BS' | 'USD' | 'EUR' | 'MIXED' | null;

const getAccountCurrencyBalance = (account: any, currency: ConsolidationCurrency) => {
  if (currency === 'USD') return Number(account.balanceUsd || 0);
  if (currency === 'EUR') return Number(account.balanceEur || 0);
  return Number(account.balanceBs || 0);
};

const getGroupSummary = (group: any) => {
  if (group.consolidatedCurrency !== undefined || group.consolidatedBalance !== undefined) {
    return {
      currency: (group.consolidatedCurrency ?? null) as ConsolidationCurrency,
      balance: Number(group.consolidatedBalance || 0),
    };
  }

  const linkedAccounts = (group.accounts || []).map((item: any) => item.account).filter(Boolean);
  const currencies = [...new Set(linkedAccounts.map((account: any) => account.currency).filter(Boolean))];

  if (currencies.length === 0) {
    return { currency: null as ConsolidationCurrency, balance: 0 };
  }

  if (currencies.length > 1) {
    return { currency: 'MIXED' as ConsolidationCurrency, balance: 0 };
  }

  const currency = currencies[0] as ConsolidationCurrency;
  const balance = linkedAccounts.reduce(
    (sum: number, account: any) => sum + getAccountCurrencyBalance(account, currency),
    0,
  );

  return { currency, balance };
};

const formatConsolidatedBalance = (amount: number, currency: ConsolidationCurrency) => {
  if (!currency) return 'Sin cuentas vinculadas';
  if (currency === 'MIXED') return 'Monedas mixtas';

  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'Bs';
  return `${symbol} ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0))}`;
};

export default function ConsolidationsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await api.consolidation.list();
      setGroups(resp.data.data || resp.data);
    } catch (err) {
      console.error(err);
      toast.error('No se pudieron cargar los grupos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || newName.trim().length < 2) {
      toast.error('El nombre es muy corto');
      return;
    }
    try {
      setCreating(true);
      const resp = await api.consolidation.create({ name: newName.trim() });
      const g = resp.data.data || resp.data;
      setNewName('');
      setShowCreateModal(false);
      toast.success('Grupo creado exitosamente');
      router.push(`/consolidations/${g.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error?.message || 'Error creando grupo');
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este grupo?')) return;
    try {
      await api.consolidation.delete(id);
      setGroups(groups.filter(g => g.id !== id));
      toast.success('Grupo eliminado');
    } catch (err) {
      console.error(err);
      toast.error('Error eliminando grupo');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Layers className="text-blue-600" size={32} />
              Consolidaciones
            </h1>
            <p className="text-slate-500 mt-1">
              Agrupa cuentas de múltiples proyectos para reportes unificados
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
            >
              Volver al Dashboard
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 shadow-sm shadow-blue-200"
            >
              <Plus size={18} />
              Nuevo Grupo
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="text-blue-500" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No hay grupos de consolidación</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Crea grupos para combinar saldos de cuentas específicas a través de diferentes proyectos y generar reportes consolidados.
            </p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Crear Primer Grupo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((g) => {
              const summary = getGroupSummary(g);

              return (
              <div 
                key={g.id} 
                onClick={() => router.push(`/consolidations/${g.id}`)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <BarChart3 size={24} />
                  </div>
                  <button 
                    onClick={(e) => handleDelete(g.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                    title="Eliminar grupo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {g.name}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                  <FileText size={14} />
                  <span>{g.accounts?.length || 0} cuentas vinculadas</span>
                </div>

                <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
                    Saldo consolidado
                  </div>
                  <div className={`text-base font-bold ${summary.currency === 'MIXED' ? 'text-amber-600' : 'text-slate-900'}`}>
                    {formatConsolidatedBalance(summary.balance, summary.currency)}
                  </div>
                </div>
                
                <div className="flex items-center text-blue-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
                  Ver detalles <ArrowRight size={16} className="ml-1" />
                </div>
              </div>
            )})}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Nuevo Grupo de Consolidación</h3>
              <form onSubmit={handleCreate}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nombre del Grupo</label>
                  <input 
                    autoFocus
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    placeholder="Ej: Consolidado General 2025" 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
                  />
                </div>
                <div className="flex gap-3 justify-end mt-6">
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={creating} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {creating ? 'Creando...' : 'Crear Grupo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
