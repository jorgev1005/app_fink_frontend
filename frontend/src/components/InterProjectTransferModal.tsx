"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { ArrowRightLeft, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface InterProjectTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSourceProjectId?: string;
}

export default function InterProjectTransferModal({ isOpen, onClose, onSuccess, defaultSourceProjectId }: InterProjectTransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  
  // Form State
  const [sourceProjectId, setSourceProjectId] = useState(defaultSourceProjectId || '');
  const [targetProjectId, setTargetProjectId] = useState('');
  
  const [sourceAccounts, setSourceAccounts] = useState<any[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<any[]>([]);
  
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BS');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');

  // Commission State
  const [hasCommission, setHasCommission] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionAccountId, setCommissionAccountId] = useState('');
  // Moneda de la comisión (por defecto igual a la transacción)
  const [commissionCurrency, setCommissionCurrency] = useState(currency);

  // Sincronizar moneda de comisión con la principal al cambiarla, solo si el usuario no la ha cambiado manualmente
  useEffect(() => {
    setCommissionCurrency(currency);
  }, [currency]);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  useEffect(() => {
    if (sourceProjectId) loadAccounts(sourceProjectId, setSourceAccounts);
    else setSourceAccounts([]);
  }, [sourceProjectId]);

  useEffect(() => {
    if (targetProjectId) loadAccounts(targetProjectId, setTargetAccounts);
    else setTargetAccounts([]);
  }, [targetProjectId]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects((res.data.data || []).filter((p: any) => p.status !== 'PAUSED'));
    } catch (e) {
      console.error(e);
      toast.error('Error cargando proyectos');
    }
  };

  const loadAccounts = async (projectId: string, setter: (accs: any[]) => void) => {
    try {
      const res = await api.accounts.getAll({ projectId, isActive: true });
      const all = res.data.data || [];
      // Filter for liquid assets usually used for transfers (Bank, Cash)
      // But allow any for flexibility
      setter(all);
    } catch (e) {
      console.error(e);
      toast.error('Error cargando cuentas');
    }
  };

  const handleSubmit = async () => {
    if (!sourceProjectId || !targetProjectId || !sourceAccountId || !targetAccountId || !amount || !description) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    if (sourceProjectId === targetProjectId) {
      toast.error('Para transferencias internas usa la opción normal de Transferencia');
      return;
    }

    if (hasCommission && (!commissionAmount || !commissionAccountId)) {
      toast.error('Por favor completa los campos de comisión');
      return;
    }

    try {
      setLoading(true);

      const entries = [
        {
          description: 'Salida de fondos',
          creditAccountId: sourceAccountId, // Decrease Source
          creditAmount: Number(amount)
        },
        {
          description: 'Entrada de fondos',
          debitAccountId: targetAccountId, // Increase Target
          debitAmount: Number(amount)
        }
      ];

      // Add commission entry if enabled
      if (hasCommission && commissionAmount) {
        entries.push({
          description: 'Comisión por transferencia',
          debitAccountId: commissionAccountId,
          debitAmount: Number(commissionAmount),
        });
      }

      const payload = {
        projectId: sourceProjectId, // The transaction belongs to the source project
        type: 'TRANSFER',
        description: `Transferencia a ${projects.find(p => p.id === targetProjectId)?.name}: ${description}`,
        date: new Date(date).toISOString(),
        currency,
        amount: Number(amount),
        reference,
        status: 'COMPLETED',
        entries,
        tags: ['Inter-Proyecto', 'Transferencia']
      };

      await api.transactions.create(payload);
      toast.success('Transferencia realizada con éxito');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.error?.message || 'Error al realizar transferencia');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-0 z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Transferencia entre Proyectos</h3>
              <p className="text-sm text-slate-500">Mueve fondos de un proyecto a otro</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
            {/* Source */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">1</span>
                Origen (Sale dinero)
              </h4>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Proyecto Origen</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={sourceProjectId}
                  onChange={(e) => setSourceProjectId(e.target.value)}
                >
                  <option value="">Seleccionar Proyecto...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cuenta Origen</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  disabled={!sourceProjectId}
                >
                  <option value="">Seleccionar Cuenta...</option>
                  {sourceAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency}) - Saldo: {a.currency === 'USD' ? a.balanceUsd : a.balanceBs}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Arrow Divider */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="bg-slate-100 p-2 rounded-full border border-slate-200 text-slate-400">
                <ArrowRightLeft size={20} />
              </div>
            </div>

            {/* Target */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">2</span>
                Destino (Entra dinero)
              </h4>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Proyecto Destino</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                >
                  <option value="">Seleccionar Proyecto...</option>
                  {projects.filter(p => p.id !== sourceProjectId).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cuenta Destino</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  disabled={!targetProjectId}
                >
                  <option value="">Seleccionar Cuenta...</option>
                  {targetAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency}) - Saldo: {a.currency === 'USD' ? a.balanceUsd : a.balanceBs}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Monto</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <select 
                    className="w-24 p-2 border border-slate-200 rounded-lg text-sm bg-slate-50"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="BS">Bs</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
                <input 
                  type="date"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
                <input 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: Préstamo para nómina"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Referencia (Opcional)</label>
                <input 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej: REF-123456"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Commission Section */}
          <div className="border-t border-slate-100 pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasCommission}
                onChange={(e) => setHasCommission(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-700">Incluir comisión por transferencia</span>
            </label>

            {hasCommission && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Monto de Comisión</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      placeholder="0.00"
                      value={commissionAmount}
                      onChange={(e) => setCommissionAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Moneda de Comisión</label>
                    <select
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={commissionCurrency}
                      onChange={e => setCommissionCurrency(e.target.value)}
                    >
                      <option value="BS">Bs</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Cuenta de Comisión</label>
                    <select
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={commissionAccountId}
                      onChange={(e) => setCommissionAccountId(e.target.value)}
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {sourceAccounts.filter(a => a.id !== sourceAccountId && a.id !== targetAccountId).map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.currency})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3 text-sm text-blue-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Esta acción creará una transacción vinculada entre ambos proyectos. 
              Se descontará el saldo de la cuenta origen y se sumará a la cuenta destino.
              Si necesitas revertir esta operación, simplemente cancela la transacción desde cualquiera de los dos proyectos.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-xl flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <ArrowRightLeft size={18} />
                Transferir Fondos
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
