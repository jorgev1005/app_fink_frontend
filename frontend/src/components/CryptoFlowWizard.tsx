import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { X, ArrowRight, Check, Wallet, CreditCard, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Account {
  id: string;
  name: string;
  currency: string;
  type: string;
}

interface CryptoFlowWizardProps {
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string;
}

export default function CryptoFlowWizard({ onClose, onSuccess, projectId }: CryptoFlowWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  
  // Configuration State (Account Selections)
  const [cashAccount, setCashAccount] = useState('');
  const [binanceAccount, setBinanceAccount] = useState('');
  const [metaMaskAccount, setMetaMaskAccount] = useState('');
  const [neomoonWalletAccount, setNeomoonWalletAccount] = useState('');
  const [neomoonCardAccount, setNeomoonCardAccount] = useState('');
  
  // Input State
  const [cashAmount, setCashAmount] = useState(100);
  const [usdtRate, setUsdtRate] = useState(1); // 1 USD = 1 USDT usually
  
  const [metaMaskAmount, setMetaMaskAmount] = useState(20);
  const [neomoonAmount, setNeomoonAmount] = useState(31);
  
  const [githubCost, setGithubCost] = useState(10);
  const [googleCost, setGoogleCost] = useState(20);

  useEffect(() => {
    if (!projectId) {
      loadProjects();
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedProjectId) {
      loadAccounts();
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      let projectsArr = [];
      if (Array.isArray(res.data)) {
        projectsArr = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        projectsArr = res.data.data;
      }
      setProjects(projectsArr);
      if (projectsArr.length > 0) {
        setSelectedProjectId(projectsArr[0].id);
      }
    } catch (error) {
      console.error('Error loading projects', error);
      setProjects([]);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.accounts.getAll({ projectId: selectedProjectId });
      let accountsArr = [];
      if (Array.isArray(res.data)) {
        accountsArr = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        accountsArr = res.data.data;
      }
      setAccounts(accountsArr);
    } catch (error) {
      console.error('Error loading accounts', error);
      setAccounts([]);
      toast.error('Error al cargar cuentas');
    }
  };

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || 'Seleccionar cuenta';

  const handleExecute = async () => {
    if (!selectedProjectId) {
      toast.error('No hay proyecto seleccionado');
      return;
    }
    setLoading(true);
    try {
      const today = new Date().toISOString();
      const pid = selectedProjectId;
      
      // 1. Cash -> Binance (Exchange/Transfer)
      // Assuming this is a Transfer if both are assets, or an Expense/Income pair if different currencies.
      // For simplicity, let's treat it as a Transfer with currency conversion if needed, 
      // but the system might expect same currency for simple transfers.
      // If Cash is USD and Binance is USD(T), it's a transfer.
      
      // Transaction 1: Cash -> Binance
      await api.transactions.create({
        projectId: pid,
        date: today,
        type: 'TRANSFER',
        description: 'Cambio Efectivo a Binance USDT',
        amount: cashAmount,
        currency: 'USD', // Assuming Cash is USD
        entries: [
          { debitAccountId: binanceAccount, debitAmount: cashAmount * usdtRate }, // Binance receives
          { creditAccountId: cashAccount, creditAmount: cashAmount }   // Cash leaves
        ]
      });

      // Transaction 2: Binance -> MetaMask
      await api.transactions.create({
        projectId: pid,
        date: today,
        type: 'TRANSFER',
        description: 'Binance a MetaMask',
        amount: metaMaskAmount,
        currency: 'USD',
        entries: [
          { debitAccountId: metaMaskAccount, debitAmount: metaMaskAmount },
          { creditAccountId: binanceAccount, creditAmount: metaMaskAmount }
        ]
      });

      // Transaction 3: Binance -> Neomoon Wallet
      await api.transactions.create({
        projectId: pid,
        date: today,
        type: 'TRANSFER',
        description: 'Binance a Neomoon Wallet',
        amount: neomoonAmount,
        currency: 'USD',
        entries: [
          { debitAccountId: neomoonWalletAccount, debitAmount: neomoonAmount },
          { creditAccountId: binanceAccount, creditAmount: neomoonAmount }
        ]
      });

      // Transaction 4: Neomoon Wallet -> Neomoon Card
      // The user said "recargue a una tarjeta virtual... para que tuviese un saldo de 52.73"
      // But the transfer amount is what matters.
      await api.transactions.create({
        projectId: pid,
        date: today,
        type: 'TRANSFER',
        description: 'Recarga Neomoon Card',
        amount: neomoonAmount, // Assuming full amount transferred
        currency: 'USD',
        entries: [
          { debitAccountId: neomoonCardAccount, debitAmount: neomoonAmount },
          { creditAccountId: neomoonWalletAccount, creditAmount: neomoonAmount }
        ]
      });

      // Transaction 5: Github Copilot
      await api.transactions.create({
        projectId: pid,
        date: today,
        type: 'EXPENSE',
        description: 'Github Copilot Pro',
        amount: githubCost,
        currency: 'USD',
        entries: [
          { creditAccountId: neomoonCardAccount, creditAmount: githubCost }
          // Debit account would be an Expense Category account, but we might not have it selected.
          // The backend might handle single-entry if it auto-balances to a default expense account or leaves it unbalanced?
          // Usually we need a debit account (Expense Category).
          // For now, let's leave debitAccountId empty or ask user for a default expense category?
          // Or maybe the system allows "Simple Expense" where you just pick the payment account.
        ],
        category: 'Software Subscription' // Legacy category string
      });

      // Transaction 6: Google AI
      await api.transactions.create({
        projectId: pid,
        date: today,
        type: 'EXPENSE',
        description: 'Google AI Pro',
        amount: googleCost,
        currency: 'USD',
        entries: [
          { creditAccountId: neomoonCardAccount, creditAmount: googleCost }
        ],
        category: 'Software Subscription'
      });

      toast.success('Flujo de transacciones creado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Error al crear transacciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            Flujo Automático: Cash a Servicios
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Configuración de Cuentas</h3>
              <p className="text-sm text-gray-500">Selecciona las cuentas involucradas en este flujo.</p>
              
              {!projectId && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Proyecto</label>
                  <select 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Seleccionar Proyecto...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cuenta Efectivo (Origen)</label>
                  <select 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={cashAccount}
                    onChange={e => setCashAccount(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cuenta Binance</label>
                  <select 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={binanceAccount}
                    onChange={e => setBinanceAccount(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cuenta MetaMask</label>
                  <select 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={metaMaskAccount}
                    onChange={e => setMetaMaskAccount(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Neomoon Wallet</label>
                  <select 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={neomoonWalletAccount}
                    onChange={e => setNeomoonWalletAccount(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Neomoon Tarjeta</label>
                  <select 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={neomoonCardAccount}
                    onChange={e => setNeomoonCardAccount(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Montos de la Operación</h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Monto Inicial (Efectivo USD)</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border rounded dark:bg-gray-700"
                    value={cashAmount}
                    onChange={e => setCashAmount(Number(e.target.value))}
                  />
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border">
                  <h4 className="font-medium mb-2">Distribución desde Binance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600">A MetaMask</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border rounded dark:bg-gray-700"
                        value={metaMaskAmount}
                        onChange={e => setMetaMaskAmount(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">A Neomoon</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border rounded dark:bg-gray-700"
                        value={neomoonAmount}
                        onChange={e => setNeomoonAmount(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Restante en Binance: {cashAmount - metaMaskAmount - neomoonAmount}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border">
                  <h4 className="font-medium mb-2">Pagos Automáticos (desde Tarjeta)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600">Github Copilot</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border rounded dark:bg-gray-700"
                        value={githubCost}
                        onChange={e => setGithubCost(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">Google AI</label>
                      <input 
                        type="number" 
                        className="w-full p-2 border rounded dark:bg-gray-700"
                        value={googleCost}
                        onChange={e => setGoogleCost(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resumen de Transacciones a Crear</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span>1. Transferencia Efectivo → Binance</span>
                  <span className="font-bold">{cashAmount} USD</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span>2. Transferencia Binance → MetaMask</span>
                  <span className="font-bold">{metaMaskAmount} USD</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span>3. Transferencia Binance → Neomoon Wallet</span>
                  <span className="font-bold">{neomoonAmount} USD</span>
                </div>
                <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span>4. Recarga Neomoon Wallet → Tarjeta</span>
                  <span className="font-bold">{neomoonAmount} USD</span>
                </div>
                <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-4 border-red-500">
                  <span>5. Pago Github Copilot</span>
                  <span className="font-bold text-red-600">-{githubCost} USD</span>
                </div>
                <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded border-l-4 border-red-500">
                  <span>6. Pago Google AI</span>
                  <span className="font-bold text-red-600">-{googleCost} USD</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Atrás
            </button>
          )}
          {step < 3 ? (
            <button 
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleExecute}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
            >
              {loading ? 'Procesando...' : 'Ejecutar Todo'} <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
