'use client';

import { useEffect, useState } from 'react';
import CategorySelector from '@/components/CategorySelector';
import StandardAccountImporter from '@/components/StandardAccountImporter';
import { StandardAccount } from '@/lib/standardAccounts';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  subType: string;
  balanceBs: number;
  balanceUsd: number;
  balanceEur: number;
  isActive: boolean;
  project?: {
    id: string;
    name: string;
    code: string;
  };
}

export default function AccountsPage() {
      const [accounts, setAccounts] = useState<Account[]>([]);
      // Filtrar solo cuentas activas para el listado y totales
      const activeAccounts = accounts.filter(acc => acc.isActive !== false);
      const totalBs = activeAccounts.reduce((sum, acc) => sum + Number(acc.balanceBs || 0), 0);
      const totalUsd = activeAccounts.reduce((sum, acc) => sum + Number(acc.balanceUsd || 0), 0);
      const totalEur = activeAccounts.reduce((sum, acc) => sum + Number(acc.balanceEur || 0), 0);
    // Estado de ordenamiento de tabla
    const [sortBy, setSortBy] = useState<string>('code');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Función para ordenar cuentas
    function sortAccounts(arr: Account[]): Account[] {
      if (!sortBy) return arr;
      const sorted = [...arr].sort((a, b) => {
        let av = a[sortBy as keyof Account];
        let bv = b[sortBy as keyof Account];
        // Código, nombre, tipo, subTipo
        if (sortBy === 'code' || sortBy === 'name' || sortBy === 'type' || sortBy === 'subType') {
          av = String(av || '').toLowerCase();
          bv = String(bv || '').toLowerCase();
        }
        // Balances
        if (sortBy === 'balanceBs' || sortBy === 'balanceUsd' || sortBy === 'balanceEur') {
          av = Number(av);
          bv = Number(bv);
        }
        // Proyecto
        if (sortBy === 'project') {
          av = a.project?.name?.toLowerCase() || '';
          bv = b.project?.name?.toLowerCase() || '';
        }
        if ((av ?? '') < (bv ?? '')) return sortDir === 'asc' ? -1 : 1;
        if ((av ?? '') > (bv ?? '')) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: '',
    search: '',
    category: '',
    categoryId: '',
    projectId: '',
  });
  const [searchTerm, setSearchTerm] = useState(filter.search);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  // Debounce searchTerm -> filter.search to avoid calling API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setFilter((f) => ({ ...f, search: searchTerm }));
    }, 200); // 200ms debounce as requested
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadAccounts();
  }, [filter]);

  // load projects for the project filter
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.projects.getAll();
        if (!mounted) return;
        setProjects(resp.data.data || resp.data || []);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false };
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      // pass filters (including categoryId) so backend can filter if supported
      const params: any = { ...filter };
      const response = await api.accounts.getAll(params);
      setAccounts(response.data.data);
    } catch (error) {
      console.error('Error cargando cuentas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportAccounts = async (selectedAccounts: StandardAccount[]) => {
    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      for (const account of selectedAccounts) {
        try {
          await api.accounts.create({
            code: account.code,
            name: account.name,
            type: account.type,
            description: account.description || '',
            subType: 'OTHER', // Default subtype
            projectId: (filter as any).projectId || undefined, // Assign to current project filter if selected
          });
          successCount++;
        } catch (error) {
          console.error(`Error creating account ${account.code}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        // Refresh list
        loadAccounts();
      }
      
      if (errorCount > 0) {
        alert(`Se importaron ${successCount} cuentas. ${errorCount} fallaron (posiblemente códigos duplicados).`);
      }
      
      setIsImporterOpen(false);
    } catch (error) {
      console.error('Error importing accounts:', error);
      alert('Error general al importar cuentas');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: any = {
      ASSET: 'bg-green-100 text-green-800',
      LIABILITY: 'bg-red-100 text-red-800',
      EQUITY: 'bg-blue-100 text-blue-800',
      REVENUE: 'bg-purple-100 text-purple-800',
      EXPENSE: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getTypeName = (type: string) => {
    const names: any = {
      ASSET: 'Activo',
      LIABILITY: 'Pasivo',
      EQUITY: 'Patrimonio',
      REVENUE: 'Ingreso',
      EXPENSE: 'Gasto',
    };
    return names[type] || type;
  };

  const formatCurrency = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat('es-VE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'Bs';
    return `${symbol} ${formatter.format(amount)}`;
  };

  // Only show the full-page loading spinner on the very first load (when there are no accounts yet).
  // When the user types into the search box we call the API and set `loading`, but we must not
  // replace the whole UI (which would unmount the input and steal focus). Instead keep the UI
  // and optionally show a small inline indicator.
  if (loading && accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Plan de Cuentas</h1>
            <p className="text-gray-600 mt-2">
              Gestiona el catálogo de cuentas contables
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              ← Volver
            </button>
            <button
              onClick={() => setIsImporterOpen(true)}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
            >
              📚 Catálogo Estándar
            </button>
            <button
              onClick={() => router.push('/accounts/new')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Nueva Cuenta
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Código o nombre de cuenta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {loading && accounts.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {/* Small SVG spinner for consistent look */}
                    <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Cuenta
              </label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los tipos</option>
                <option value="ASSET">Activo</option>
                <option value="LIABILITY">Pasivo</option>
                <option value="EQUITY">Patrimonio</option>
                <option value="REVENUE">Ingreso</option>
                <option value="EXPENSE">Gasto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto</label>
              <select
                value={(filter as any).projectId}
                onChange={(e) => setFilter({ ...filter, projectId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los proyectos</option>
                {projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría
              </label>
              <CategorySelector
                projectId={(filter as any).projectId || undefined}
                value={filter.categoryId ? { id: filter.categoryId, name: filter.category } : filter.category}
                onChange={(v) => setFilter({ ...filter, category: v.name || '', categoryId: v.id || '' })}
                placeholder="Filtrar por categoría"
              />
            </div>
          </div>
        </div>

        {/* Mobile View - Cards */}
        <div className="md:hidden space-y-4 mb-6">
          {sortAccounts(activeAccounts).map((account) => (
            <div 
              key={account.id} 
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 active:scale-[0.98] transition-transform"
              onClick={() => router.push(`/accounts/${account.id}`)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded mr-2">
                    {account.code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getTypeColor(account.type)}`}>
                    {getTypeName(account.type)}
                  </span>
                </div>
              </div>
              
              <h3 className="text-base font-semibold text-gray-900 mb-1 leading-tight">
                {account.name}
              </h3>
              
              {account.project && (
                <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  {account.project.name}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                <div>
                   <p className="text-[10px] text-gray-400 uppercase">Balance BS</p>
                   <p className="font-mono text-sm font-medium text-gray-700">{formatCurrency(Number(account.balanceBs), 'BS')}</p>
                </div>
                {(Number(account.balanceUsd) !== 0 || Number(account.balanceEur) !== 0) && (
                  <div className="text-right">
                     <p className="text-[10px] text-gray-400 uppercase">Divisas</p>
                     {Number(account.balanceUsd) !== 0 && (
                       <p className="font-mono text-sm font-medium text-green-700">{formatCurrency(Number(account.balanceUsd), 'USD')}</p>
                     )}
                     {Number(account.balanceEur) !== 0 && (
                       <p className="font-mono text-sm font-medium text-blue-700">{formatCurrency(Number(account.balanceEur), 'EUR')}</p>
                     )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
             <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                No se encontraron cuentas
             </div>
          )}
        </div>

        {/* Tabla de Cuentas - Desktop */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('code'); setSortDir(sortBy === 'code' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Código {sortBy === 'code' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Cuenta {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('type'); setSortDir(sortBy === 'type' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Tipo {sortBy === 'type' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('balanceBs'); setSortDir(sortBy === 'balanceBs' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Balance Bs {sortBy === 'balanceBs' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('balanceUsd'); setSortDir(sortBy === 'balanceUsd' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Balance USD {sortBy === 'balanceUsd' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('balanceEur'); setSortDir(sortBy === 'balanceEur' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Balance EUR {sortBy === 'balanceEur' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                  setSortBy('project'); setSortDir(sortBy === 'project' && sortDir === 'asc' ? 'desc' : 'asc');
                }}>Proyecto {sortBy === 'project' && (sortDir === 'asc' ? '▲' : '▼')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortAccounts(activeAccounts).map((account) => (
                <tr
                  key={account.id}
                  className="hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => router.push(`/accounts/${account.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {account.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(account.type)}`}>
                      {getTypeName(account.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(Number(account.balanceBs), 'BS')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(Number(account.balanceUsd), 'USD')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatCurrency(Number(account.balanceEur), 'EUR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {account.project?.name || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {accounts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No se encontraron cuentas</p>
              <p className="text-gray-400 mt-2">Crea tu primera cuenta o ajusta los filtros</p>
            </div>
          )}
        </div>

        {/* Resumen */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-gray-600 text-sm">Total Cuentas</p>
              <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">Activas</p>
              <p className="text-2xl font-bold text-green-600">
                {accounts.filter(a => a.isActive).length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm">Inactivas</p>
              <p className="text-2xl font-bold text-red-600">
                {accounts.filter(a => !a.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <StandardAccountImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={handleImportAccounts}
      />
    </div>
  );
}
