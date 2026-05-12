'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import ContactAutocomplete from '@/components/ContactAutocomplete';
import ExchangeRatesPanel from '@/components/ExchangeRatesPanel';
import CategorySelector from '@/components/CategorySelector';
import { UserPlus, X } from 'lucide-react';

interface Transaction {
  id: string;
  code: string;
  projectId: string;
  category?: string;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  attachments?: string[];
  type: string;
  description: string;
  reference?: string;
  date: string;
  currency: string;
  amount: number;
  status: string;
  contactPersonId?: string;
  entries: Array<{
    id: string;
    debitAccountId?: string;
    creditAccountId?: string;
    debitAmount: number;
    creditAmount: number;
    description?: string;
  }>;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);

  // Quick Contact Creation State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactType, setNewContactType] = useState('CLIENT');
  const [newContactTaxId, setNewContactTaxId] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  const handleCreateContact = async () => {
    if (!newContactName.trim()) return;
    if (!formData.projectId) { alert('Selecciona un proyecto primero'); return; }
    
    setCreatingContact(true);
    try {
      const payload = {
        projectId: formData.projectId,
        name: newContactName,
        type: newContactType,
        taxId: newContactTaxId || undefined
      };
      const res = await api.contacts.create(payload);
      const contact = res.data?.data;
      if (contact) {
        setFormData(prev => ({ ...prev, contactPersonId: contact.id }));
        setShowContactModal(false);
        setNewContactName('');
        setNewContactTaxId('');
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Error creando contacto');
    } finally {
      setCreatingContact(false);
    }
  };

  const [formData, setFormData] = useState({
    projectId: '',
    type: '',
    category: '',
    categoryId: '',
    description: '',
    reference: '',
    date: '',
    currency: '',
    amount: '',
    status: '',
    debitAccountId: '',
    creditAccountId: '',
    contactPersonId: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadData();
  }, [transactionId]);

  useEffect(() => {
    if (formData.projectId) {
      loadAccounts(formData.projectId);
    }
  }, [formData.projectId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar transacción
      const transactionResponse = await api.transactions.getById(transactionId);
      const txn = transactionResponse.data.data;
      setTransaction(txn);

      // Cargar proyectos
      const projectsResponse = await api.projects.getAll();
      setProjects(projectsResponse.data.data);

      // Extraer cuentas de débito y crédito
      const debitEntry = txn.entries.find((e: any) => e.debitAccountId);
      const creditEntry = txn.entries.find((e: any) => e.creditAccountId);

      // Llenar formulario
      setFormData({
        projectId: txn.projectId,
        category: (txn.categoryRef && txn.categoryRef.name) || txn.category || '',
        categoryId: txn.categoryId || '',
        type: txn.type,
        description: txn.description,
        reference: txn.reference || '',
        date: txn.date.split('T')[0],
        currency: txn.currency,
        amount: txn.amount.toString(),
        status: txn.status,
        debitAccountId: debitEntry?.debitAccountId || '',
        creditAccountId: creditEntry?.creditAccountId || '',
        contactPersonId: txn.contactPersonId || '',
      });

      // Cargar cuentas del proyecto
      if (txn.projectId) {
        await loadAccounts(txn.projectId);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      alert('Error al cargar la transacción');
      router.push('/transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFiles = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    try {
      setSaving(true);
      const fd = new FormData();
      selectedFiles.forEach((f) => fd.append('files', f));
      await api.transactions.uploadAttachments(transactionId, fd);
      // Recargar transacción
      await loadData();
      setSelectedFiles(null);
      alert('Archivos subidos correctamente');
    } catch (err) {
      console.error('Error subiendo archivos:', err);
      alert('Error subiendo archivos');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttachment = async (fileUrl: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      const parts = fileUrl.split('/');
      const filename = parts[parts.length - 1];
      await api.transactions.deleteAttachment(transactionId, filename);
      await loadData();
      alert('Archivo eliminado');
    } catch (err) {
      console.error('Error eliminando archivo:', err);
      alert('Error eliminando archivo');
    }
  };

  const loadAccounts = async (projectId: string) => {
    try {
      const response = await api.accounts.getAll({ projectId, isActive: true });
      setAccounts(response.data.data);
    } catch (error) {
      console.error('Error cargando cuentas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.debitAccountId || !formData.creditAccountId) {
      alert('Debe seleccionar cuenta de débito y crédito');
      return;
    }

    if (window.confirm('¿Estás seguro de actualizar esta transacción?')) {
      setSaving(true);

      try {
        const updateData = {
          projectId: formData.projectId,
          type: formData.type,
          category: formData.category || undefined,
          categoryId: formData.categoryId || null,
          description: formData.description,
          reference: formData.reference || undefined,
          date: formData.date,
          currency: formData.currency,
          amount: parseFloat(formData.amount),
          status: formData.status,
          contactPersonId: formData.contactPersonId || null, // Enviar null explícitamente si está vacío
          entries: [
            {
              debitAccountId: formData.debitAccountId,
              debitAmount: parseFloat(formData.amount),
              creditAmount: 0,
              description: 'Débito',
            },
            {
              creditAccountId: formData.creditAccountId,
              creditAmount: parseFloat(formData.amount),
              debitAmount: 0,
              description: 'Crédito',
            },
          ],
        };

        await api.transactions.update(transactionId, updateData);
  // notify app that a transaction changed so dashboard can refresh
  try { window.dispatchEvent(new Event('transactionUpdated')); } catch (e) {}
  alert('✅ Transacción actualizada exitosamente');
  router.push('/transactions');
      } catch (error: any) {
        console.error('Error actualizando transacción:', error);
        alert('❌ ' + (error.response?.data?.error?.message || 'Error al actualizar'));
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        '⚠️ ¿Estás seguro de eliminar esta transacción?\n\nEsta acción no se puede deshacer.'
      )
    ) {
      try {
        await api.transactions.delete(transactionId);
        try { window.dispatchEvent(new Event('transactionDeleted')); } catch (e) {}
        alert('✅ Transacción eliminada');
        router.push('/transactions');
      } catch (error: any) {
        console.error('Error eliminando transacción:', error);
        alert('❌ ' + (error.response?.data?.error?.message || 'Error al eliminar'));
      }
    }
  };

  const getAccountsByType = (type: 'debit' | 'credit') => {
    if (formData.type === 'INCOME') {
      if (type === 'debit') {
        return accounts.filter(
          (a) => ['CASH', 'BANK'].includes(a.type) || a.type === 'ASSET'
        );
      } else {
        return accounts.filter((a) => a.type === 'REVENUE');
      }
    } else if (formData.type === 'EXPENSE') {
      if (type === 'debit') {
        return accounts.filter((a) => a.type === 'EXPENSE');
      } else {
        return accounts.filter(
          (a) => ['CASH', 'BANK'].includes(a.type) || a.type === 'ASSET'
        );
      }
    } else {
      return accounts;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando transacción...</p>
        </div>

        {/* Exchange rates panel */}
        <div className="mb-4">
          <ExchangeRatesPanel />
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">Transacción no encontrada</p>
          <button
            onClick={() => router.push('/transactions')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver a transacciones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <button
              onClick={() => router.push('/transactions')}
              className="hover:text-blue-600"
            >
              Transacciones
            </button>
            <span>›</span>
            <span className="font-medium">{transaction.code}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Editar Transacción
          </h1>
          <p className="text-gray-600 mt-2">
            Código: <span className="font-mono font-medium">{transaction.code}</span>
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Proyecto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proyecto *
              </label>
              <select
                value={formData.projectId}
                onChange={(e) =>
                  setFormData({ ...formData, projectId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled
              >
                <option value="">Seleccione un proyecto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                ℹ️ El proyecto no se puede cambiar
              </p>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="INCOME">Ingreso</option>
                <option value="EXPENSE">Gasto</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="ADJUSTMENT">Ajuste</option>
              </select>
            </div>

            {/* Descripción */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Categoría (normalizada) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
                <span className="text-gray-500 text-xs ml-2">(Opcional)</span>
              </label>
              <CategorySelector
                projectId={formData.projectId}
                value={formData.category}
                onChange={(v: any) =>
                  setFormData({
                    ...formData,
                    category: v?.name || '',
                    categoryId: v?.id || formData.categoryId || '',
                  })
                }
                placeholder="Buscar o crear categoría"
                disabled={!formData.projectId}
              />
            </div>

            {/* Cliente / Proveedor */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente / Proveedor
                <span className="text-gray-500 text-xs ml-2">(Opcional)</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ContactAutocomplete
                    projectId={formData.projectId}
                    value={formData.contactPersonId}
                    onChange={(contactId) =>
                      setFormData({ ...formData, contactPersonId: contactId || '' })
                    }
                    placeholder="Buscar o crear contacto rápido..."
                  />
                </div>
                <button 
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  title="Crear nuevo contacto"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Referencia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referencia
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Moneda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moneda *
              </label>
              <select
                value={formData.currency}
                onChange={(e) =>
                  setFormData({ ...formData, currency: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="BS">BS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Estado */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estado *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="DRAFT">Borrador</option>
                <option value="PENDING">Pendiente</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="RECONCILED">Conciliada</option>
              </select>
            </div>

            {/* Cuenta Débito */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuenta Débito *
              </label>
              <select
                value={formData.debitAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, debitAccountId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccione una cuenta</option>
                {getAccountsByType('debit').map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cuenta Crédito */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuenta Crédito *
              </label>
              <select
                value={formData.creditAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, creditAccountId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccione una cuenta</option>
                {getAccountsByType('credit').map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Adjuntos */}
          <div className="md:col-span-2 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Archivos adjuntos</label>
            <div className="space-y-2">
              {transaction.attachments && transaction.attachments.length > 0 ? (
                transaction.attachments.map((a) => {
                  const name = a.split('/').pop();
                  const lower = name?.toLowerCase() || '';
                  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].some(ext => lower.endsWith(ext));
                  return (
                    <div key={a} className="flex items-center gap-3 bg-gray-50 p-2 rounded">
                      {isImage ? (
                        <img src={a} alt={name} className="w-16 h-12 object-cover rounded" />
                      ) : (
                        <svg className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                      <a href={a} target="_blank" rel="noreferrer" className="text-blue-600 truncate">{name}</a>
                      <button type="button" onClick={() => handleDeleteAttachment(a)} className="ml-auto text-sm text-red-600 hover:underline">Eliminar</button>
                    </div>
                  )
                })
              ) : (
                <p className="text-xs text-gray-500">No hay archivos adjuntos</p>
              )}
            </div>

            <div className="mt-3">
              <input type="file" multiple accept="*/*" onChange={(e) => setSelectedFiles(e.target.files ? Array.from(e.target.files) : null)} />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={handleUploadFiles} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{saving ? 'Subiendo...' : 'Subir archivos'}</button>
                <button type="button" onClick={() => setSelectedFiles(null)} className="px-4 py-2 bg-gray-200 rounded">Limpiar</button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Se permiten múltiples formatos. Máx 10 MB por archivo.</p>
            </div>
          </div>

          {/* Botones */}
          <div className="mt-8 flex flex-col md:flex-row gap-4 justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition order-last md:order-first"
            >
              🗑️ Eliminar
            </button>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/transactions')}
                className="flex-1 md:flex-none px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 md:flex-none px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300"
              >
                {saving ? 'Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Create Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Nuevo Contacto</h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  placeholder="Ej: Juan Pérez" 
                  value={newContactName} 
                  onChange={(e) => setNewContactName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo</label>
                <select 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  value={newContactType} 
                  onChange={(e) => setNewContactType(e.target.value)}
                >
                  <option value="CLIENT">Cliente</option>
                  <option value="PROVIDER">Proveedor</option>
                  <option value="BOTH">Ambos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Identificación (RIF/CI)</label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  placeholder="Opcional" 
                  value={newContactTaxId} 
                  onChange={(e) => setNewContactTaxId(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
              <button 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                onClick={() => setShowContactModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                onClick={handleCreateContact}
                disabled={creatingContact || !newContactName.trim()}
              >
                {creatingContact ? 'Creando...' : 'Crear Contacto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
