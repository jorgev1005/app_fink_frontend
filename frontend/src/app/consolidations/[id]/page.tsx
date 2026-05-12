"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { ArrowLeft, Save, Search, FileSpreadsheet, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type CurrencyCode = 'BS' | 'USD' | 'EUR';
type SelectedCurrency = CurrencyCode | 'MIXED' | null;

const getCurrencySymbol = (currency: CurrencyCode) => {
  if (currency === 'USD') return '$';
  if (currency === 'EUR') return '€';
  return 'Bs';
};

const getAccountBalance = (account: any) => {
  if (account.currency === 'USD') return Number(account.balanceUsd || 0);
  if (account.currency === 'EUR') return Number(account.balanceEur || 0);
  return Number(account.balanceBs || 0);
};

const formatMoney = (amount: number, currency: CurrencyCode) => {
  return `${getCurrencySymbol(currency)} ${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0))}`;
};

export default function ConsolidationDetail() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const id = params.id;

  const [group, setGroup] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [gResp, aResp] = await Promise.all([
        api.consolidation.getById(id),
        api.accounts.getAll({ limit: 1000 })
      ]);

      const g = gResp.data.data || gResp.data;
      const a = aResp.data.data || aResp.data;
      setGroup(g);
      setAccounts(a || []);
      const sel: Record<string, boolean> = {};
      (g.accounts || []).forEach((row: any) => { sel[row.accountId] = true; });
      setSelected(sel);
    } catch (err) {
      console.error(err);
      toast.error('Error cargando datos');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const selectedAccounts = useMemo(
    () => accounts.filter((acc) => selected[acc.id]),
    [accounts, selected],
  );

  const selectedCurrency = useMemo<SelectedCurrency>(() => {
    const currencies = [...new Set(selectedAccounts.map((acc) => acc.currency).filter(Boolean))];
    if (currencies.length === 0) return null;
    if (currencies.length === 1) return currencies[0] as CurrencyCode;
    return 'MIXED';
  }, [selectedAccounts]);

  const selectedCurrencies = useMemo(
    () => [...new Set(selectedAccounts.map((acc) => acc.currency).filter(Boolean))] as CurrencyCode[],
    [selectedAccounts],
  );

  const totalSelectedBalance = useMemo(
    () => selectedAccounts.reduce((sum, acc) => sum + getAccountBalance(acc), 0),
    [selectedAccounts],
  );

  const toggle = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;

    const isSelecting = !selected[accountId];
    if (isSelecting) {
      if (selectedCurrency === 'MIXED') {
        toast.error('El grupo ya tiene monedas mixtas. Deja una sola moneda seleccionada antes de agregar más cuentas');
        return;
      }

      if (selectedCurrency && account.currency !== selectedCurrency) {
        toast.error('Solo puedes consolidar cuentas de la misma moneda');
        return;
      }
    }

    setSelected(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const handleKeepOnlyCurrency = (currency: CurrencyCode) => {
    const matchingAccounts = selectedAccounts.filter((acc) => acc.currency === currency);
    if (!matchingAccounts.length) {
      toast.error(`No hay cuentas ${currency} seleccionadas para conservar`);
      return;
    }

    if (!window.confirm(`Se conservarán solo las cuentas en ${currency} y se desmarcarán las demás. ¿Deseas continuar?`)) {
      return;
    }

    const nextSelected: Record<string, boolean> = {};
    matchingAccounts.forEach((acc) => {
      nextSelected[acc.id] = true;
    });
    setSelected(nextSelected);
    toast.success(`Se dejaron seleccionadas solo las cuentas en ${currency}`);
  };

  const handleSave = async () => {
    if (selectedCurrency === 'MIXED') {
      toast.error('No se puede guardar una consolidación con cuentas de monedas diferentes');
      return;
    }

    const confirmMessage = selectedCurrency
      ? `Se guardará la consolidación con ${selectedCount} cuentas en ${selectedCurrency} por un total de ${formatMoney(totalSelectedBalance, selectedCurrency)}. ¿Deseas continuar?`
      : 'Se guardará la consolidación sin cuentas vinculadas. ¿Deseas continuar?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setSaving(true);
      const accountIds = Object.keys(selected).filter(k => selected[k]);
      const resp = await api.consolidation.replaceAccounts(id, { accountIds });
      setGroup(resp.data.data || resp.data);
      toast.success('Cambios guardados correctamente');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error?.message || 'Error guardando');
    } finally { setSaving(false); }
  };

  const handleExportCSV = async () => {
    try {
        const resp = await api.consolidation.getById(id);
        const group = resp.data.data || resp.data;
        // call preview endpoint to get accounts with balances
        const previewResp = await api.consolidation.getPreview(id);
        const payload = previewResp.data.data || previewResp.data;
      const rows = (payload.accounts || []).map((a: any) => ({
        'ID Cuenta': a.accountId,
        'Código': a.code,
        'Cuenta': a.name,
        'Proyecto': a.projectName || '',
        'Saldo Bs': a.balanceBs,
        'Saldo USD': a.balanceUsd,
        'Saldo EUR': a.balanceEur
      }));
      // use export util
      const { exportToCSV } = await import('@/lib/exportUtils');
      exportToCSV(rows, `consolidacion_${group.name.replace(/[^a-z0-9]/gi,'_').toLowerCase()}`);
      toast.success('Exportación CSV iniciada');
    } catch (err) {
      console.error(err);
      toast.error('Error exportando CSV');
    }
  };

  const handleExportExcel = async () => {
    try {
      const previewResp = await api.consolidation.getPreview(id);
      const payload = previewResp.data.data || previewResp.data;
      const rows = (payload.accounts || []).map((a: any) => ({
        'ID Cuenta': a.accountId,
        'Código': a.code,
        'Cuenta': a.name,
        'Proyecto': a.projectName || '',
        'Saldo Bs': a.balanceBs,
        'Saldo USD': a.balanceUsd,
        'Saldo EUR': a.balanceEur
      }));
      const { exportToExcel } = await import('@/lib/exportUtils');
      exportToExcel(rows, `consolidacion_${payload.group.name.replace(/[^a-z0-9]/gi,'_').toLowerCase()}`);
      toast.success('Exportación Excel iniciada');
    } catch (err) {
      console.error(err);
      toast.error('Error exportando Excel');
    }
  };

  // Group accounts by project
  const groupedAccounts = useMemo(() => {
    const filtered = accounts.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.project?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, { name: string, code: string, accounts: any[] }> = {};
    
    filtered.forEach(acc => {
      const pid = acc.project?.id || 'unknown';
      if (!groups[pid]) {
        groups[pid] = {
          name: acc.project?.name || 'Sin Proyecto',
          code: acc.project?.code || 'N/A',
          accounts: []
        };
      }
      groups[pid].accounts.push(acc);
    });

    // Sort accounts within groups by code
    Object.values(groups).forEach(g => {
      g.accounts.sort((a, b) => a.code.localeCompare(b.code));
    });

    return groups;
  }, [accounts, searchTerm]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/consolidations')} 
                className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">{group?.name}</h1>
                <p className="text-sm text-slate-500">
                  {selectedCount} cuentas seleccionadas
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar cuentas..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
              </div>
              
              <div className="flex gap-2 border-l border-slate-200 pl-2 ml-2">
                <button 
                  onClick={handleExportExcel} 
                  className="p-2 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                  title="Exportar Excel"
                >
                  <FileSpreadsheet size={18} />
                  <span className="hidden lg:inline">Excel</span>
                </button>
                <button 
                  onClick={handleExportCSV} 
                  className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-2 text-sm font-medium"
                  title="Exportar CSV"
                >
                  <FileText size={18} />
                  <span className="hidden lg:inline">CSV</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile Search */}
          <div className="mt-4 md:hidden relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cuentas..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        
        {/* Totals Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 font-medium mb-1">Total Consolidado</div>
            <div className={`text-2xl font-bold ${selectedCurrency === 'MIXED' ? 'text-amber-600' : 'text-slate-900'}`}>
              {selectedCurrency && selectedCurrency !== 'MIXED'
                ? formatMoney(totalSelectedBalance, selectedCurrency)
                : selectedCurrency === 'MIXED'
                  ? 'Monedas mixtas'
                  : 'Selecciona cuentas'}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-sm text-slate-500 font-medium mb-1">Moneda del Grupo</div>
            <div className="text-2xl font-bold text-slate-900">
              {selectedCurrency === 'MIXED' ? 'Incompatible' : selectedCurrency || 'Sin definir'}
            </div>
          </div>
        </div>

        {selectedCurrency === 'MIXED' && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium mb-2">
                Este grupo tiene cuentas con monedas distintas. Debes dejar seleccionada una sola moneda para poder guardar.
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCurrencies.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => handleKeepOnlyCurrency(currency)}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 transition text-sm font-medium"
                  >
                    Mantener solo {currency}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {Object.keys(groupedAccounts).length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No se encontraron cuentas que coincidan con tu búsqueda.
            </div>
          ) : (
            Object.entries(groupedAccounts).map(([projectId, groupData]) => (
              <div key={projectId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-slate-800">{groupData.name}</div>
                    <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded font-mono">
                      {groupData.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {groupData.accounts.length} cuentas disponibles
                  </div>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {groupData.accounts.map((acc) => (
                    (() => {
                      const hasLockedCurrency = selectedCurrency === 'BS' || selectedCurrency === 'USD' || selectedCurrency === 'EUR';
                      const isDisabled = !selected[acc.id] && (
                        selectedCurrency === 'MIXED' ||
                        (hasLockedCurrency && acc.currency !== selectedCurrency)
                      );

                      return (
                    <label 
                      key={acc.id} 
                      className={`flex items-center p-4 transition ${isDisabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : 'cursor-pointer hover:bg-blue-50'} ${selected[acc.id] ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="mr-4">
                        <input 
                          type="checkbox" 
                          checked={!!selected[acc.id]} 
                          onChange={() => toggle(acc.id)}
                          disabled={isDisabled}
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="font-mono text-sm text-slate-500">{acc.code}</div>
                          <div className="font-medium text-slate-900">{acc.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            acc.type === 'ASSET' ? 'bg-emerald-100 text-emerald-700' :
                            acc.type === 'LIABILITY' ? 'bg-red-100 text-red-700' :
                            acc.type === 'EQUITY' ? 'bg-purple-100 text-purple-700' :
                            acc.type === 'REVENUE' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {acc.type}
                          </span>
                          <span className="text-xs text-slate-400 uppercase">{acc.subType}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                            {acc.currency}
                          </span>
                        </div>
                        <div className="text-right md:text-left font-mono text-sm text-slate-600">
                          {formatMoney(getAccountBalance(acc), acc.currency as CurrencyCode)}
                        </div>
                      </div>
                    </label>
                      );
                    })()
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-20">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all font-bold disabled:opacity-70 disabled:transform-none"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Guardando...
            </>
          ) : (
            <>
              <Save size={20} />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}
