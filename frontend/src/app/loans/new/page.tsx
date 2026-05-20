'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function NewLoanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');


  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    contactId: '',
    currency: 'USD',
    exchangeRate: '',
    principalAmount: '',
    interestRate: '',
    interestFrequency: 'MONTHLY',
    paymentDay: '',
    startDate: new Date().toISOString().split('T')[0],
    destinationAccountId: ''
  });

  useEffect(() => {
    // Load initial project list
    const initData = async () => {
      try {
        const pRes = await api.projects.getAll();
        const pList = pRes.data?.data || pRes.data || [];
        setProjects(pList);
        const currentP = localStorage.getItem('selectedProjectId') || '';
        if (currentP) setSelectedProjectId(currentP);
        else if (pList.length > 0) setSelectedProjectId(pList[0].id);
      } catch (e) { console.error('Error fetching projects', e); }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setAccounts([]); setContacts([]); return; }
    const loadDependencies = async () => {
      try {
        const [accRes, contRes] = await Promise.all([
          api.accounts.getAll({ projectId: selectedProjectId }),
          api.contacts.getAll({ projectId: selectedProjectId }).catch(() => ({ data: [] }))
        ]);
        const accountsList = accRes.data?.data || accRes.data || [];
        const contactsList = contRes.data?.data || contRes.data || [];
        setAccounts(accountsList.filter((a: any) => a.type === 'ASSET' && a.isActive !== false));
        setContacts(contactsList);
      } catch (error) { console.error('Error dependencies', error); }
    };
    loadDependencies();
  }, [selectedProjectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const projectId = selectedProjectId;
      
      const payload = {
        ...formData,
        projectId,
        principalAmount: Number(formData.principalAmount),
        interestRate: Number(formData.interestRate || 0),
        exchangeRate: formData.currency === 'BS' && formData.exchangeRate ? Number(formData.exchangeRate) : undefined,
      };

      await api.loans.createLoan(payload);
      
      // Actualizar el proyecto global activo para que redireccione viendolo
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedProjectId', selectedProjectId);
        window.dispatchEvent(new Event('projectChange')); // Notificar al TopBar si está escuchando
      }

      router.push('/loans');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al crear el préstamo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center mb-6">
        <Link href="/loans" className="text-blue-500 hover:underline mr-4">
          &larr; Volver
        </Link>
        <h1 className="text-2xl font-bold dark:text-white">Registrar Nuevo Préstamo</h1>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded shadow space-y-6">
        
        <div className="border-b pb-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Proyecto del Préstamo <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setFormData(prev => ({...prev, destinationAccountId: '', contactId: ''}));
            }}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Selecciona un proyecto</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre / Descripción *
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej. Préstamo Personal a Juan"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contacto Relacionado (Opcional)
            </label>
            <select
              name="contactId"
              value={formData.contactId}
              onChange={handleChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Seleccione un contacto...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Capital Prestado *
            </label>
            <input
              type="number"
              step="0.01"
              name="principalAmount"
              required
              value={formData.principalAmount}
              onChange={handleChange}
              placeholder="100.00"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Moneda
            </label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="USD">USD ($)</option>
              <option value="BS">VES (Bs.)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          {formData.currency === 'BS' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tasa de Cambio (Ej. 40.5) *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  name="exchangeRate"
                  required
                  value={formData.exchangeRate}
                  onChange={handleChange}
                  placeholder="Tasa actual"
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                {formData.principalAmount && formData.exchangeRate && (
                  <div className="flex items-center text-sm text-gray-500 whitespace-nowrap">
                    ~ ${(Number(formData.principalAmount) / Number(formData.exchangeRate)).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tasa de Interés (%) *
            </label>
            <input
              type="number"
              step="0.01"
              name="interestRate"
              required
              value={formData.interestRate}
              onChange={handleChange}
              placeholder="10.0"
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Frecuencia de Cobro *
            </label>
            <select
              name="interestFrequency"
              value={formData.interestFrequency}
              onChange={handleChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="DAILY">Diario</option>
              <option value="WEEKLY">Semanal</option>
              <option value="BIWEEKLY">Quincenal</option>
              <option value="MONTHLY">Mensual</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Día de Pago (Opcional)
            </label>
            <select
              name="paymentDay"
              value={formData.paymentDay}
              onChange={handleChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Aleatorio / Indefinido</option>
              <option value="Lunes">Lunes</option>
              <option value="Martes">Martes</option>
              <option value="Miercoles">Miércoles</option>
              <option value="Jueves">Jueves</option>
              <option value="Viernes">Viernes</option>
              <option value="Sabado">Sábado</option>
              <option value="Domingo">Domingo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de Inicio *
            </label>
            <input
              type="date"
              name="startDate"
              required
              value={formData.startDate}
              onChange={handleChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cuenta Destino / Recepción (Opcional)
            </label>
            <p className="text-xs text-gray-500 mb-1">Selecciona la cuenta bancaria donde recibiste el dinero del préstamo.</p>
            <select
              name="destinationAccountId"
              value={formData.destinationAccountId}
              onChange={handleChange}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">No generar transacción inicial</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
          <Link
            href="/loans"
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded mr-2"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Crear Préstamo'}
          </button>
        </div>
      </form>
    </div>
  );
}
