'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { exportContactReportsToExcel, exportToCSV } from '@/lib/exportUtils';

interface ContactReport {
  contact: {
    id: string;
    name: string;
    type: string;
    email?: string;
    taxId?: string;
  };
  project: {
    name: string;
    code: string;
  };
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  transactions: Array<{
    id: string;
    code: string;
    date: string;
    type: string;
    description: string;
    amount: number;
    currency: string;
  }>;
}

interface Summary {
  totalContacts: number;
  totalIncome: number;
  totalExpense: number;
  totalTransactions: number;
}

export default function ContactReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ContactReport[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    projectId: '',
    contactType: '',
    categoryId: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadProjects();
    loadReports();
    loadCategories();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      loadReports();
    }
  }, [filters]);

  useEffect(() => {
    // reload categories when project filter changes
    loadCategories();
  }, [filters.projectId]);

  const loadProjects = async () => {
    try {
      const response = await api.projects.getAll();
      if (response.data.success) {
        setProjects(response.data.data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.projectId) params.projectId = filters.projectId;
  if (filters.contactType) params.contactType = filters.contactType;
  if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.reports.getContactReports(params);
      if (response.data.success) {
        setReports(response.data.data);
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const params: any = {};
      if (filters.projectId) params.projectId = filters.projectId;
      const resp = await api.transactionCategories.getAll(params);
      if (resp.data && resp.data.success !== false) {
        const rows = resp.data.data || resp.data || [];
        setCategories(rows);
      }
    } catch (err) {
      console.error('Error loading categories', err);
    }
  };

  const getContactTypeIcon = (type: string) => {
    const icons: any = {
      CUSTOMER: '👤',
      SUPPLIER: '🏢',
      BOTH: '🔄',
      OTHER: '📋',
    };
    return icons[type] || '📋';
  };

  const getContactTypeName = (type: string) => {
    const names: any = {
      CUSTOMER: 'Cliente',
      SUPPLIER: 'Proveedor',
      BOTH: 'Cliente/Proveedor',
      OTHER: 'Otro',
    };
    return names[type] || type;
  };

  const getContactTypeColor = (type: string) => {
    const colors: any = {
      CUSTOMER: 'bg-blue-100 text-blue-800',
      SUPPLIER: 'bg-green-100 text-green-800',
      BOTH: 'bg-purple-100 text-purple-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleContactDetails = (contactId: string) => {
    setExpandedContact(expandedContact === contactId ? null : contactId);
  };

  const handleExportExcel = () => {
    if (reports.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    const data = reports.map(r => ({
      contactPerson: r.contact,
      totalIncome: r.totalIncome,
      totalExpense: r.totalExpense,
      balance: r.balance,
      transactionCount: r.transactionCount
    }));
    const success = exportContactReportsToExcel(data);
    if (success) {
      alert('✅ Reporte exportado a Excel');
    } else {
      alert('❌ Error al exportar');
    }
  };

  const handleExportCSV = () => {
    if (reports.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    const data = reports.map(r => {
      // determine most frequent category name and id
      let mostFreqName = '';
      let mostFreqId = '';
      try {
        const counts: Record<string, number> = {};
        const idCounts: Record<string, number> = {};
        for (const t of (r.transactions || []) as any[]) {
          const name = t?.categoryRef?.name || t?.category || '';
          const id = t?.categoryId || (t?.categoryRef?.id) || '';
          if (name) counts[name] = (counts[name] || 0) + 1;
          if (id) idCounts[id] = (idCounts[id] || 0) + 1;
        }
        const entries = Object.entries(counts);
        if (entries.length > 0) {
          entries.sort((a, b) => b[1] - a[1]);
          mostFreqName = entries[0][0];
        }
        const idEntries = Object.entries(idCounts);
        if (idEntries.length > 0) {
          idEntries.sort((a, b) => b[1] - a[1]);
          mostFreqId = idEntries[0][0];
        }
      } catch (err) {
        // ignore
      }

      return {
        'Contacto': r.contact.name,
        'Tipo': getContactTypeName(r.contact.type),
        'Categoría': mostFreqName || '',
        'ID Categoría': mostFreqId || '',
        'Email': r.contact.email || '',
        'Total Ingresos': r.totalIncome,
        'Total Gastos': r.totalExpense,
        'Balance': r.balance,
        'Transacciones': r.transactionCount
      };
    });
    const success = exportToCSV(data, 'reporte_contactos');
    if (success) {
      alert('✅ Reporte exportado a CSV');
    } else {
      alert('❌ Error al exportar');
    }
  };

  if (loading) {
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
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Reportes por Cliente/Proveedor</h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Análisis de ventas y compras por contacto
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm md:text-base"
              title="Exportar a Excel"
            >
              📊 Excel
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm md:text-base"
              title="Exportar a CSV"
            >
              📄 CSV
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm md:text-base"
            >
              ← Volver
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proyecto
              </label>
              <select
                value={filters.projectId}
                onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los proyectos</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas las categorías</option>
                {categories.map((c:any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Contacto
              </label>
              <select
                value={filters.contactType}
                onChange={(e) => setFilters({ ...filters, contactType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los tipos</option>
                <option value="CUSTOMER">Clientes</option>
                <option value="SUPPLIER">Proveedores</option>
                <option value="BOTH">Ambos</option>
                <option value="OTHER">Otros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Desde
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm mb-2">Total Contactos</p>
              <p className="text-3xl font-bold text-gray-900">{summary.totalContacts}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm mb-2">Total Ingresos</p>
              <p className="text-3xl font-bold text-green-600">
                $ {formatCurrency(summary.totalIncome)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm mb-2">Total Gastos</p>
              <p className="text-3xl font-bold text-red-600">
                $ {formatCurrency(summary.totalExpense)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600 text-sm mb-2">Total Transacciones</p>
              <p className="text-3xl font-bold text-blue-600">{summary.totalTransactions}</p>
            </div>
          </div>
        )}

        {/* Reports Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Proyecto
                  </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ingresos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gastos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transacciones
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <>
                  <tr key={report.contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <div className="flex items-center gap-1">
                          <span>{getContactTypeIcon(report.contact.type)}</span>
                          <span className="font-medium">{report.contact.name}</span>
                        </div>
                        {report.contact.email && (
                          <div className="text-xs text-gray-500">{report.contact.email}</div>
                        )}
                        {report.contact.taxId && (
                          <div className="text-xs text-gray-500">RIF: {report.contact.taxId}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getContactTypeColor(report.contact.type)}`}>
                        {getContactTypeName(report.contact.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {/* Mostrar la categoría más frecuente (normalizada si existe) */}
                      {(() => {
                        try {
                          const counts: Record<string, number> = {};
                          for (const t of report.transactions as any[]) {
                            const name = t?.categoryRef?.name || t?.category || '';
                            if (!name) continue;
                            counts[name] = (counts[name] || 0) + 1;
                          }
                          const entries = Object.entries(counts);
                          if (entries.length === 0) return '-';
                          entries.sort((a, b) => b[1] - a[1]);
                          return entries[0][0];
                        } catch (err) {
                          return '-';
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {report.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-green-600">
                      $ {formatCurrency(report.totalIncome)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-red-600">
                      $ {formatCurrency(report.totalExpense)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                      report.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      $ {formatCurrency(report.balance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {report.transactionCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <button
                        onClick={() => toggleContactDetails(report.contact.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {expandedContact === report.contact.id ? '▲ Ocultar' : '▼ Ver Detalles'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Details */}
                  {expandedContact === report.contact.id && (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-gray-900 mb-3">
                            Últimas Transacciones
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Código</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Descripción</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Categoría</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Monto</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {report.transactions.map((transaction) => (
                                  <tr key={transaction.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-xs text-gray-900">{transaction.code}</td>
                                    <td className="px-4 py-2 text-xs text-gray-600">{formatDate(transaction.date)}</td>
                                    <td className="px-4 py-2 text-xs text-gray-900">{transaction.description}</td>
                                    <td className="px-4 py-2 text-xs">
                                      <span className={`px-2 py-1 rounded-full ${
                                        transaction.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {transaction.type === 'INCOME' ? 'Ingreso' : 'Gasto'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-gray-700">{(transaction as any).categoryRef?.name || (transaction as any).category || '-'}</td>
                                    <td className={`px-4 py-2 text-xs text-right font-semibold ${
                                      transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {transaction.currency} {formatCurrency(transaction.amount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {reports.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No se encontraron reportes</p>
              <p className="text-gray-400 mt-2">
                Crea transacciones con clientes o proveedores para ver reportes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
