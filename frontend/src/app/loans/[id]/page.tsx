'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function LoanDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    totalAmount: '',
    principalAmount: '',
    interestAmount: '',
    bankAccountId: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [loanId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const loanRes = await api.loans.getLoanById(loanId);
      const loanData = loanRes.data;
      setLoan(loanData);
      
      // Load accounts for the loan project to be sure
      const accRes = await api.accounts.getAll({ projectId: loanData.projectId });
      
      const accountsList = accRes.data?.data || accRes.data || [];
      const assetAccounts = accountsList.filter((a: any) => a.type === 'ASSET' && a.isActive !== false);
      setAccounts(assetAccounts);
    } catch (err: any) {
      console.error(err);
      setError('Error al cargar detalles del préstamo');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({ ...prev, [name]: value }));
  };

  // Helper para autocompletar si se ingresa el total
  const handleTotalBlur = () => {
    if (paymentForm.totalAmount && !paymentForm.principalAmount && !paymentForm.interestAmount) {
      // By default logic, we might want to prioritize paying off unpaid interests, but let's just make them type it for now or do a split
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const projectId = localStorage.getItem('selectedProjectId');
      const headers = projectId ? { 'x-project-id': projectId } : {};

      await api.loans.addPayment(loanId, {
        ...paymentForm,
        totalAmount: Number(paymentForm.totalAmount),
        principalAmount: Number(paymentForm.principalAmount || 0),
        interestAmount: Number(paymentForm.interestAmount || 0),
      });

      setShowPaymentModal(false);
      loadData(); // recargar
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error registrando pago');
    }
  };

  const handleVoidLoan = async () => {
    const isConfirmed = window.confirm(
      '¿Estás seguro que deseas anular este préstamo? Se eliminará la cuenta por pagar y la transacción de ingreso inicial (Desembolso). Esta acción es irreversible.'
    );
    if (!isConfirmed) return;

    try {
      await api.loans.deleteLoan(loanId);
      router.push('/loans');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error al anular el préstamo');
    }
  };

  if (loading) return <div className="p-8 text-center dark:text-white">Cargando...</div>;
  if (!loan) return <div className="p-8 text-center text-red-500">Préstamo no encontrado</div>;

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/loans" className="text-blue-500 hover:underline mr-4">
            &larr; Volver
          </Link>
          <h1 className="text-2xl font-bold dark:text-white">Préstamo: {loan.name}</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleVoidLoan}
            className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-800/50 dark:text-red-400 font-medium py-2 px-4 rounded shadow"
          >
            Anular Préstamo
          </button>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded shadow"
            disabled={loan.status === 'PAID'}
          >
            Registrar Pago
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 font-semibold mb-1">Monto Original</h3>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {loan.currency} {loan.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 font-semibold mb-1">Capital Restante</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {loan.currency} {loan.remainingCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 font-semibold mb-1">Tasa de Interés</h3>
          <p className="text-xl font-bold text-gray-800 dark:text-white">
            {loan.interestRate}% ({loan.interestFrequency})
          </p>
          <p className="text-xs text-gray-500 mt-1">Próximo cargo: {loan.nextChargeDate ? new Date(loan.nextChargeDate).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow mb-6 mt-6">
          <h2 className="text-lg font-bold dark:text-white mb-4">Información Adicional</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Fecha de Inicio</p>
              <p className="font-semibold text-gray-800 dark:text-white">
                {loan.startDate ? new Date(loan.startDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha de Registro</p>
              <p className="font-semibold text-gray-800 dark:text-white">
                {loan.createdAt ? new Date(loan.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Día de Pago Preferido</p>
              <p className="font-semibold text-gray-800 dark:text-white">{loan.paymentDay || 'Aleatorio / Indefinido'}</p>
            </div>
            {loan.currency === 'BS' && loan.exchangeRate && (
              <div>
                <p className="text-sm text-gray-500">Tasa de Cambio Inicial</p>
                <p className="font-semibold text-gray-800 dark:text-white">{loan.exchangeRate} Bs/$</p>
              </div>
            )}
            {loan.currency === 'BS' && loan.exchangeRate && (
              <div>
                <p className="text-sm text-gray-500">Equivalente USD (Aprox)</p>
                <p className="font-semibold text-gray-800 dark:text-white">${(loan.principalAmount / loan.exchangeRate).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pagos Recibidos */}
        <div className="bg-white dark:bg-gray-800 rounded shadow">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-bold dark:text-white">Historial de Pagos</h2>
          </div>
          <div className="p-0">
            {loan.payments?.length === 0 ? (
              <p className="p-4 text-gray-500 text-center text-sm">No hay pagos registrados.</p>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Fecha</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Capital</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Interés</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loan.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 text-sm dark:text-white">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm text-right text-green-600 dark:text-green-400">{Number(p.principalAmount).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right text-orange-600 dark:text-orange-400">{Number(p.interestAmount).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right font-bold dark:text-white">{Number(p.totalAmount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Cargos Autogenerados */}
        <div className="bg-white dark:bg-gray-800 rounded shadow">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-bold dark:text-white">Cargos de Intereses (Deuda)</h2>
          </div>
          <div className="p-0">
            {loan.charges?.length === 0 ? (
              <p className="p-4 text-gray-500 text-center text-sm">No hay intereses generados aún.</p>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Descripción</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Monto</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Pagado</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loan.charges.map((c: any) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2 text-sm dark:text-white">{new Date(c.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm dark:text-gray-300">{c.description}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium dark:text-white">{Number(c.amount).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">{Number(c.paidAmount).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-center">
                        <span className={`px-2 py-1 text-xs rounded ${c.status === 'PAID' ? 'bg-green-100 text-green-800' : c.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal para Registrar Pago */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 dark:text-white">Registrar Pago Recibido</h2>
            <form onSubmit={submitPayment}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Recibido</label>
                  <input
                    type="number" step="0.01" name="totalAmount" required
                    value={paymentForm.totalAmount} onChange={handlePaymentChange} onBlur={handleTotalBlur}
                    className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capital Abonado</label>
                    <input
                      type="number" step="0.01" name="principalAmount"
                      value={paymentForm.principalAmount} onChange={handlePaymentChange}
                      className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interés Abonado</label>
                    <input
                      type="number" step="0.01" name="interestAmount"
                      value={paymentForm.interestAmount} onChange={handlePaymentChange}
                      className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
                  <input
                    type="date" name="date" required
                    value={paymentForm.date} onChange={handlePaymentChange}
                    className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta Destino (Banco / Caja)</label>
                  <select
                    name="bankAccountId"
                    value={paymentForm.bankAccountId}
                    onChange={handlePaymentChange}
                    className="w-full border p-2 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">(Sin asentar en Banco)</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded text-gray-600 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Guardar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
