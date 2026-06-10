'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const AccountLedger = dynamic(() => import('@/components/AccountLedger'), { ssr: false });
const AuditLogPreviewButton = dynamic(() => import('@/components/AuditLogPreviewButton'), { ssr: false });
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function EditAccountPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [activeTab, setActiveTab] = useState<'details' | 'movements'>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<any>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [currency, setCurrency] = useState<'BS' | 'USD' | 'EUR'>('BS');
  const [projects, setProjects] = useState<any[]>([]);
  const [type, setType] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ASSET');
  const [subType, setSubType] = useState<string>('');

  // Adjust balance fields
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustCurrency, setAdjustCurrency] = useState<'BS' | 'USD' | 'EUR'>('BS');
  const [contraAccountId, setContraAccountId] = useState<string | undefined>(undefined);

  const [projectAccounts, setProjectAccounts] = useState<any[]>([]);
  const [adjustResult, setAdjustResult] = useState<any | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    const load = async () => {
      try {
        setLoading(true);
        const [accResp, projResp] = await Promise.all([
          api.accounts.getById(id),
          api.projects.getAll()
        ]);
        
        const data = accResp.data.data || accResp.data;
        setProjects(projResp.data.data || []);
        
        setAccount(data);
        setName(data.name || '');
        setDescription(data.description || '');
        setIsActive(data.isActive ?? true);
        setParentId(data.parent?.id || undefined);
        setProjectId(data.project?.id || undefined);
        setCurrency((data.currency as 'BS' | 'USD' | 'EUR') || 'BS');
        setType((data.type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE') || 'ASSET');
        setSubType(data.subType || '');

        // load accounts for same project to populate parent & contra selects
        if (data.project && data.project.id) {
          const list = await api.accounts.getAll({ projectId: data.project.id, isActive: true });
          const accs = (list.data && list.data.data) ? list.data.data : list.data;
          // exclude current account from options
          setProjectAccounts((accs || []).filter((a: any) => a.id !== data.id));
        }
      } catch (err) {
        console.error('Error loading account', err);
        alert('No se pudo cargar la cuenta');
        router.push('/accounts');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, router]);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.accounts.update(id, { 
        name: name.trim(), 
        description: description.trim() || undefined, 
        isActive, 
        parentId: parentId || undefined,
        projectId: projectId || null,
        currency,
        type,
        subType
      });
                    {/* Tipo contable */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo contable</label>
                      <select
                        value={type}
                        onChange={e => setType(e.target.value as any)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="ASSET">Activo</option>
                        <option value="LIABILITY">Pasivo</option>
                        <option value="EQUITY">Patrimonio</option>
                        <option value="REVENUE">Ingreso</option>
                        <option value="EXPENSE">Gasto</option>
                      </select>
                    </div>

                    {/* Subtipo contable */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subtipo</label>
                      <input
                        value={subType}
                        onChange={e => setSubType(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ej: BANK, CASH, SALES, etc."
                        required
                      />
                    </div>
      // If adjust amount provided, create an ADJUSTMENT transaction
      let savedAdjustResult: any = null;
      if (adjustAmount && Number(adjustAmount) !== 0) {
        if (!contraAccountId) {
          alert('Seleccione la cuenta contra para crear la transacción de ajuste');
          setSaving(false);
          return;
        }
        const amount = Number(adjustAmount);

        // Use dedicated adjust endpoint which will create the ADJUSTMENT transaction
        const resp = await api.accounts.adjust(id, {
          amount: Math.abs(amount),
          currency: adjustCurrency,
          contraAccountId,
          description: `Ajuste de saldo para ${account.code}`,
        });

        // guardar resultado para mostrar saldos actualizados en la UI
        savedAdjustResult = resp?.data?.updatedBalances || null;
        if (savedAdjustResult) {
          setAdjustResult(savedAdjustResult);
          // limpiar campos de ajuste
          setAdjustAmount('');
          setContraAccountId(undefined);
        }
      }

      // Si no hubo ajuste, redirigimos de inmediato. Si hubo ajuste, mostramos los saldos actualizados en la página.
      if (!savedAdjustResult) {
        router.push('/accounts');
      }
    } catch (err: any) {
      console.error('Error saving account', err);
      alert(err?.response?.data?.error?.message || err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-600 font-medium">Cargando cuenta...</p>
    </div>
  </div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 relative">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Editar Cuenta</h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Modifica los detalles de la cuenta o realiza ajustes de saldo
            </p>
          </div>
          <button
            onClick={() => router.push('/accounts')}
            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            Volver
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 space-x-4 print:hidden">
            <button
                type="button"
                className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('details')}
            >
                Detalles / Configuración
            </button>
            <button
                type="button"
                className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'movements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('movements')}
            >
                Movimientos
            </button>
        </div>

        {activeTab === 'movements' && (
            <div className="bg-white rounded-lg shadow-md p-4 md:p-8 print:shadow-none print:border-none print:p-0 print:m-0">
                <AccountLedger 
                  accountId={id} 
                  accountType={type} 
                  currency={currency} 
                  accountName={name} 
                  accountCode={account?.code || ''} 
                />
            </div>
        )}

        <div className={`bg-white rounded-lg shadow-md p-4 md:p-8 ${activeTab === 'details' ? '' : 'hidden'}`}>
          <form onSubmit={handleSave} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código</label>
                <input 
                  value={account.code || ''} 
                  readOnly 
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" 
                />
              </div>

              {/* Project */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto</label>
                <select 
                  value={projectId || ''} 
                  onChange={e => setProjectId(e.target.value || undefined)} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Global (Sin proyecto) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              {/* Tipo contable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo contable</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="ASSET">Activo</option>
                  <option value="LIABILITY">Pasivo</option>
                  <option value="EQUITY">Patrimonio</option>
                  <option value="REVENUE">Ingreso</option>
                  <option value="EXPENSE">Gasto</option>
                </select>
              </div>

              {/* Subtipo contable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subtipo</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={subType}
                  onChange={e => setSubType(e.target.value as any)}
                  required
                >
                  <option value="BANK">Banco</option>
                  <option value="CASH">Efectivo / Caja Chica</option>
                  <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                  <option value="EXCHANGE">Exchange / Broker</option>
                  <option value="WALLET">Wallet / Crypto</option>
                  <option value="FINANCIAL">Financiera / Inversión</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>

              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  required 
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as 'BS' | 'USD' | 'EUR')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="BS">Bolívares (BS)</option>
                  <option value="USD">Dólares (USD)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Descripción (opcional)</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                  rows={3} 
                />
              </div>

              {/* Parent Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta Padre (opcional)</label>
                <select 
                  value={parentId || ''} 
                  onChange={e => setParentId(e.target.value || undefined)} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Ninguna --</option>
                  {projectAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>

              {/* Active Status */}
              <div className="flex items-center h-full pt-6">
                <label className="inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isActive} 
                    onChange={e => setIsActive(e.target.checked)} 
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                  />
                  <span className="ml-2 text-gray-700 font-medium">Cuenta Activa</span>
                </label>
              </div>
            </div>

            <div className="border-t border-gray-200 my-8 pt-8">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Ajustar Saldo</h2>
              <p className="text-sm text-gray-600 mb-6">
                Si necesitas corregir el saldo actual, crea una transacción de ajuste aquí.
              </p>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monto</label>
                    <input 
                      value={adjustAmount} 
                      onChange={e => setAdjustAmount(e.target.value)} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                    <select 
                      value={adjustCurrency} 
                      onChange={e => setAdjustCurrency(e.target.value as any)} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="BS">BS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta Contrapartida</label>
                    <select 
                      value={contraAccountId || ''} 
                      onChange={e => setContraAccountId(e.target.value || undefined)} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Seleccione --</option>
                      {projectAccounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit" 
                disabled={saving} 
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button 
                type="button" 
                onClick={() => router.push('/accounts')} 
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Cancelar
              </button>
            </div>

            {adjustResult && (
              <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
                <div className="flex items-center gap-2 mb-4 text-green-800">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  <h3 className="font-bold">Saldos Actualizados Correctamente</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded border border-green-100 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cuenta Debe</h4>
                    <div className="font-medium text-gray-900 mb-1">{adjustResult.debit.code} — {adjustResult.debit.name}</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between"><span>BS:</span> <span className="font-mono">{adjustResult.debit.balanceBs?.toFixed(2) ?? 0}</span></div>
                      <div className="flex justify-between"><span>USD:</span> <span className="font-mono">{adjustResult.debit.balanceUsd?.toFixed(2) ?? 0}</span></div>
                      <div className="flex justify-between"><span>EUR:</span> <span className="font-mono">{adjustResult.debit.balanceEur?.toFixed(2) ?? 0}</span></div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded border border-green-100 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cuenta Haber</h4>
                    <div className="font-medium text-gray-900 mb-1">{adjustResult.credit.code} — {adjustResult.credit.name}</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between"><span>BS:</span> <span className="font-mono">{adjustResult.credit.balanceBs?.toFixed(2) ?? 0}</span></div>
                      <div className="flex justify-between"><span>USD:</span> <span className="font-mono">{adjustResult.credit.balanceUsd?.toFixed(2) ?? 0}</span></div>
                      <div className="flex justify-between"><span>EUR:</span> <span className="font-mono">{adjustResult.credit.balanceEur?.toFixed(2) ?? 0}</span></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => router.push('/accounts')} 
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
                  >
                    Volver a la lista de cuentas
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
      {/* Botón de preview de auditoría en la esquina inferior derecha */}
      {account && (
        <AuditLogPreviewButton accountId={account.id} projectId={account.project?.id} />
      )}
    </div>
  );
}
