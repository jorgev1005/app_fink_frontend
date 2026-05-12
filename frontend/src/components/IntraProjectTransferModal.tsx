"use client";
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { ArrowRightLeft, X, AlertCircle, DollarSign, CreditCard, Wallet, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface IntraProjectTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string;
}

export default function IntraProjectTransferModal({ isOpen, onClose, onSuccess, projectId }: IntraProjectTransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');

  // Form State
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
    if (selectedProjectId) {
      loadProjectAndAccounts();
    } else {
      setProject(null);
      setAccounts([]);
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      const activeProjects = (res.data.data || []).filter((p: any) => p.status !== 'PAUSED');
      setProjects(activeProjects);
      
      // Set default project if none selected
      if (!selectedProjectId && activeProjects.length > 0) {
        setSelectedProjectId(activeProjects[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error cargando proyectos');
    }
  };

  const loadProjectAndAccounts = async () => {
    if (!selectedProjectId) return;
    try {
      // Load project info
      const projectRes = await api.projects.getById(selectedProjectId);
      setProject(projectRes.data.data);
      
      // Load accounts
      const res = await api.accounts.getAll({ projectId: selectedProjectId, isActive: true });
      setAccounts(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Error cargando datos del proyecto');
    }
  };

  const getAccountIcon = (account: any) => {
    const type = (account.subType || account.subtype || '').toUpperCase();
    switch (type) {
      case 'BANK': return Building2;
      case 'WALLET': return Wallet;
      case 'EXCHANGE': return DollarSign;
      case 'CASH': return CreditCard;
      default: return Wallet;
    }
  };

  const getAccountDisplayName = (account: any) => {
    const type = (account.subType || account.subtype || '').toUpperCase();
    const typeLabels = {
      'BANK': 'Banco',
      'WALLET': 'Wallet',
      'EXCHANGE': 'Exchange',
      'CASH': 'Efectivo',
      'FINANCIAL': 'Financiero'
    };
    const typeLabel = (typeLabels as Record<string, string>)[type] || 'Cuenta';
    return `${typeLabel}: ${account.name}`;
  };

  const handleSubmit = async () => {
    if (!selectedProjectId || !sourceAccountId || !targetAccountId || !amount || !description) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    if (sourceAccountId === targetAccountId) {
      toast.error('No se puede transferir a la misma cuenta');
      return;
    }

    if (hasCommission && (!commissionAmount || !commissionAccountId)) {
      toast.error('Por favor completa los campos de comisión');
      return;
    }

    try {
      setLoading(true);

      // Validar comisión multi-moneda
      if (hasCommission && commissionAmount && commissionCurrency !== currency) {
        toast.error('No se permite comisión en moneda distinta a la transferencia.');
        setLoading(false);
        return;
      }

      const entries = [
        {
          description: 'Salida de fondos',
          creditAccountId: sourceAccountId,
          creditAmount: hasCommission && commissionAmount ? Number(amount) + Number(commissionAmount) : Number(amount),
        },
        {
          description: 'Entrada de fondos',
          debitAccountId: targetAccountId,
          debitAmount: Number(amount),
        }
      ];

      // Add commission entry if enabled (solo si es la misma moneda)
      if (hasCommission && commissionAmount) {
        entries.push({
          description: 'Comisión por transferencia',
          debitAccountId: commissionAccountId,
          debitAmount: Number(commissionAmount),
        });
      }

      const payload = {
        projectId: selectedProjectId,
        type: 'TRANSFER',
        description: `Transferencia interna: ${description}`,
        date: new Date(date).toISOString(),
        currency,
        amount: Number(amount),
        reference,
        status: 'COMPLETED',
        entries,
      };

      await api.transactions.create(payload);
      toast.success('Transferencia realizada exitosamente');
      onSuccess();
      onClose();

      // Reset form
      setSourceAccountId('');
      setTargetAccountId('');
      setAmount('');
      setDescription('');
      setReference('');
      setHasCommission(false);
      setCommissionAmount('');
      setCommissionAccountId('');

    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error?.message || 'Error al realizar la transferencia');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  
  const sourceAccount = accounts.find(a => a.id === sourceAccountId);
  const targetAccount = accounts.find(a => a.id === targetAccountId);
  const commissionAccount = accounts.find(a => a.id === commissionAccountId);

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
              <h3 className="text-xl font-bold text-slate-800">Transferencia Interna</h3>
              <p className="text-sm text-slate-500">
                {project ? `Proyecto: ${project.name} (${project.code})` : 'Mueve fondos entre tus cuentas'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Project Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Proyecto</label>
            <select
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">Seleccionar proyecto...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.code})
                </option>
              ))}
            </select>
            {project && (
              <div className="text-sm text-slate-600">
                Proyecto seleccionado: <span className="font-medium">{project.name}</span>
              </div>
            )}
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Cuenta Origen</label>
              <select
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
              >
                <option value="">Seleccionar cuenta...</option>
                {accounts.map(account => {
                  const Icon = getAccountIcon(account);
                  return (
                    <option key={account.id} value={account.id}>
                      {getAccountDisplayName(account)} - Saldo: {account.currency === 'USD' ? account.balanceUsd : account.balanceBs} {account.currency}
                    </option>
                  );
                })}
              </select>
              {sourceAccount && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Wallet size={16} />
                  <span>Saldo disponible: {sourceAccount.currency === 'USD' ? sourceAccount.balanceUsd : sourceAccount.balanceBs} {sourceAccount.currency}</span>
                </div>
              )}
            </div>

            {/* Target */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Cuenta Destino</label>
              <select
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={targetAccountId}
                onChange={(e) => setTargetAccountId(e.target.value)}
              >
                <option value="">Seleccionar cuenta...</option>
                {accounts.filter(a => a.id !== sourceAccountId).map(account => {
                  const Icon = getAccountIcon(account);
                  return (
                    <option key={account.id} value={account.id}>
                      {getAccountDisplayName(account)} - Saldo: {account.currency === 'USD' ? account.balanceUsd : account.balanceBs} {account.currency}
                    </option>
                  );
                })}
              </select>
              {targetAccount && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Wallet size={16} />
                  <span>Saldo actual: {targetAccount.currency === 'USD' ? targetAccount.balanceUsd : targetAccount.balanceBs} {targetAccount.currency}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Monto</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <select
                  className="w-24 p-3 border border-slate-200 rounded-lg bg-slate-50"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="BS">Bs</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Fecha</label>
              <input
                type="date"
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Description and Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Descripción</label>
              <input
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: De Binance a Wallet personal"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">Referencia (Opcional)</label>
              <input
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: TX-123456"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Commission Toggle */}
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
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Monto de Comisión</label>
                  <input
                    type="number"
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="0.00"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Moneda de Comisión</label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={commissionCurrency}
                    onChange={e => setCommissionCurrency(e.target.value)}
                  >
                    <option value="BS">Bs</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700">Cuenta de Comisión</label>
                  <select
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={commissionAccountId}
                    onChange={(e) => setCommissionAccountId(e.target.value)}
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {accounts.filter(a => a.id !== sourceAccountId && a.id !== targetAccountId).map(account => (
                      <option key={account.id} value={account.id}>
                        {getAccountDisplayName(account)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          {amount && sourceAccount && targetAccount && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Resumen de la Transferencia</h4>
              <div className="space-y-1 text-sm text-blue-700">
                <div className="flex justify-between">
                  <span>De:</span>
                  <span className="font-medium">{getAccountDisplayName(sourceAccount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>A:</span>
                  <span className="font-medium">{getAccountDisplayName(targetAccount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monto:</span>
                  <span className="font-medium">{amount} {currency}</span>
                </div>
                {hasCommission && commissionAmount && commissionAccount && (
                  <div className="flex justify-between text-orange-600">
                    <span>Comisión:</span>
                    <span className="font-medium">{commissionAmount} {commissionCurrency} → {getAccountDisplayName(commissionAccount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                Transferir
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}