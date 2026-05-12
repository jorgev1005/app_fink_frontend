'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import CategorySelector from '@/components/CategorySelector';
import PayTransactionModal from '@/components/PayTransactionModal';
import InterProjectTransferModal from '@/components/InterProjectTransferModal';
import BatchPaymentModal from '@/components/BatchPaymentModal';
import QuickEditTransactionModal from '@/components/QuickEditTransactionModal';
import { exportTransactionsToExcel, exportToCSV } from '@/lib/exportUtils';
import ExchangeRatesPanel from '@/components/ExchangeRatesPanel';
import formatDateForDisplay from '@/lib/dateUtils';
import { ChevronDown, ChevronUp, Search, Filter, Download, Plus, ArrowLeft, FileText, RefreshCw, Wallet, ChevronRight, Upload, ArrowRightLeft, Printer } from 'lucide-react';

interface Transaction {
  id: string;
  code: string;
  date: string;
  type: string;
  description: string;
  reference?: string;
  category?: string;
  categoryRef?: {
    id: string;
    name: string;
  } | null;
  categoryId?: string;
  currency: string;
  amount: number;
  status: string;
  project: {
    id?: string;
    name: string;
    code: string;
  };
  tags?: string[];
  allocations?: {
    payment: {
      targetCurrency: string | null;
      exchangeRate: number | null;
    }
  }[];
  contactPerson?: {
    id: string;
    name: string;
    type: string;
    email?: string;
  };
}

interface Project {
  id: string;
  name: string;
  code: string;
}

export default function TransactionsPage() {
    // Estado de ordenamiento de tabla
    const [sortBy, setSortBy] = useState<string>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    // Función para ordenar transacciones
    function sortTransactions(arr: Transaction[]): Transaction[] {
      if (!sortBy) return arr;
      const sorted = [...arr].sort((a, b) => {
        let av = a[sortBy as keyof Transaction];
        let bv = b[sortBy as keyof Transaction];
        // Fechas
        if (sortBy === 'date') {
          av = new Date(av as string).getTime();
          bv = new Date(bv as string).getTime();
        }
        // Monto
        if (sortBy === 'amount') {
          av = Number(av);
          bv = Number(bv);
        }
        if (sortBy === 'amountPaid') {
          av = Number((a as any).amountPaid || 0);
          bv = Number((b as any).amountPaid || 0);
        }
        // Categoría
        if (sortBy === 'category') {
          av = String(a.categoryRef?.name || a.category || '').toLowerCase();
          bv = String(b.categoryRef?.name || b.category || '').toLowerCase();
        }
        // Cliente
        if (sortBy === 'contactPerson') {
          av = String(a.contactPerson?.name || '').toLowerCase();
          bv = String(b.contactPerson?.name || '').toLowerCase();
        }
        // Código, descripción, status, type, paymentStatus
        if (sortBy === 'code' || sortBy === 'description' || sortBy === 'status' || sortBy === 'type' || sortBy === 'paymentStatus') {
          if (sortBy === 'paymentStatus') {
            av = String((a as any).paymentStatus || '').toLowerCase();
            bv = String((b as any).paymentStatus || '').toLowerCase();
          } else {
            av = String(av || '').toLowerCase();
            bv = String(bv || '').toLowerCase();
          }
        }
        if ((av ?? '') < (bv ?? '')) return sortDir === 'asc' ? -1 : 1;
        if ((av ?? '') > (bv ?? '')) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: '',
    status: '',
    paymentStatus: '',
    search: '',
    startDate: '',
    endDate: '',
    category: '',
    categoryId: '',
    projectId: '',
  });
  const [searchTerm, setSearchTerm] = useState(filter.search);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  
  // Currency view state
  const [viewCurrency, setViewCurrency] = useState<'BS' | 'USD'>('BS');
  const [exchangeRate, setExchangeRate] = useState<number>(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    
    // Load saved currency preference
    const savedCurrency = localStorage.getItem('fink_currency');
    if (savedCurrency === 'USD' || savedCurrency === 'BS') {
      setViewCurrency(savedCurrency);
    }

    loadTransactions();
    loadExchangeRate();
  }, [filter]);

  const loadExchangeRate = async () => {
    try {
      const pref = localStorage.getItem('preferredExchangeRate');
      let rate = 0;
      
      // If specific rate ID or source is saved
      if (pref) {
        if (['BCV', 'BINANCE', 'CUSTOM'].includes(pref)) {
           const res = await api.exchangeRates.getLatestBySource();
           const sourceRate = res.data.find((r: any) => r.source === pref);
           if (sourceRate) rate = sourceRate.usdToBs;
        } else {
           // It's an ID? Not implemented in API client easily, fallback to latest
           const res = await api.exchangeRates.getLatest();
           rate = res.data.usdToBs;
        }
      } else {
        // Default to latest
        const res = await api.exchangeRates.getLatest();
        rate = res.data.usdToBs;
      }
      
      if (!rate) {
         // Fallback if no specific rate found
         const res = await api.exchangeRates.getLatest();
         rate = res.data.usdToBs;
      }
      
      setExchangeRate(rate);
    } catch (e) {
      console.error('Error loading exchange rate', e);
    }
  };

  const toggleViewCurrency = () => {
    const next = viewCurrency === 'BS' ? 'USD' : 'BS';
    setViewCurrency(next);
    localStorage.setItem('fink_currency', next);
  };

  // Helper to convert amount for display
  const getDisplayAmount = (amount: number, currency: string): number | null => {
    if (currency === viewCurrency) return amount;
    if (!exchangeRate || exchangeRate <= 0) return null; 
    
    if (viewCurrency === 'BS' && currency === 'USD') return amount * exchangeRate;
    if (viewCurrency === 'USD' && currency === 'BS') return amount / exchangeRate;
    return amount; 
  };

  // Debounce searchTerm -> filter.search (200ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setFilter((f) => ({ ...f, search: searchTerm }));
    }, 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      // pass categoryId explicitly so backend can filter by normalized id
      const response = await api.transactions.getAll(filter);
      setTransactions(response.data.data);
    } catch (error) {
      console.error('Error cargando transacciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    }
  };

  useEffect(() => {
    // Load projects once on mount
    loadProjects();
    
    // Load user info
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserName(`${user.firstName} ${user.lastName}`);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const getTypeColor = (type: string) => {
    const colors: any = {
      INCOME: 'bg-green-100 text-green-800',
      EXPENSE: 'bg-red-100 text-red-800',
      TRANSFER: 'bg-blue-100 text-blue-800',
      ADJUSTMENT: 'bg-yellow-100 text-yellow-800',
      PAYMENT: 'bg-slate-100 text-slate-800',
      COLLECTION: 'bg-emerald-100 text-emerald-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getTypeName = (type: string) => {
    const names: any = {
      INCOME: 'Ingreso',
      EXPENSE: 'Gasto',
      TRANSFER: 'Transferencia',
      ADJUSTMENT: 'Ajuste',
      PAYMENT: 'Pago',
      COLLECTION: 'Cobro',
    };
    return names[type] || type;
  };

  const getPaymentStatusName = (status: string) => {
    const names: any = {
      PENDING: 'Pendiente',
      PARTIAL: 'Parcial',
      PAID: 'Pagado',
      OVERDUE: 'Vencido',
    };
    return names[status] || status || 'Pendiente';
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      RECONCILED: 'bg-blue-100 text-blue-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusName = (status: string) => {
    const names: any = {
      DRAFT: 'Borrador',
      PENDING: 'Pendiente',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
      RECONCILED: 'Conciliada',
    };
    return names[status] || status;
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

  const formatCurrency = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat('es-VE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'Bs';
    return `${symbol} ${formatter.format(amount)}`;
  };

  // Use shared util to avoid timezone off-by-one for midnight timestamps
  const formatDate = (dateString: string) => formatDateForDisplay(dateString, true);

  const handleExportExcel = () => {
    if (transactions.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    const success = exportTransactionsToExcel(transactions);
    if (success) {
      alert('✅ Archivo Excel descargado');
    } else {
      alert('❌ Error al exportar');
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    const data = transactions.map(t => ({
      'Código': t.code,
      'Fecha': formatDate(t.date),
      'Tipo': t.type,
      'Descripción': t.description,
  'Categoría': t.categoryRef?.name || t.category || '',
  'ID Categoría': t.categoryId || '',
      'Referencia': t.reference || '',
      'Cliente/Proveedor': t.contactPerson?.name || '',
      'Monto': Number(t.amount),
      'Moneda': t.currency,
      'Estado': t.status,
      'Proyecto': t.project?.name || ''
    }));
    const success = exportToCSV(data, 'transacciones');
    if (success) {
      alert('✅ Archivo CSV descargado');
    } else {
      alert('❌ Error al exportar');
    }
  };

  const getPrintableRows = () => {
    return transactions.map((t) => ({
      code: t.code,
      date: formatDate(t.date),
      description: t.description,
      category: t.categoryRef?.name || t.category || '-',
      contact: t.contactPerson?.name || '-',
      type: t.type,
      amount: formatCurrency(Number(t.amount), t.currency),
      paid: formatCurrency(Number((t as any).amountPaid || 0), t.currency),
      status: t.status,
      paymentStatus: getPaymentStatusName((t as any).paymentStatus),
      project: t.project?.name || '-',
    }));
  };

  const handleExportPDF = async () => {
    if (transactions.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const rows = getPrintableRows();
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const generatedAt = new Date().toLocaleString('es-VE');

    doc.setFontSize(16);
    doc.text('Listado de Transacciones', 40, 40);
    doc.setFontSize(10);
    doc.text(`Generado: ${generatedAt}`, 40, 58);
    doc.text(`Registros: ${rows.length}`, 40, 72);

    autoTable(doc, {
      startY: 88,
      head: [[
        'Codigo',
        'Fecha',
        'Descripcion',
        'Categoria',
        'Cliente/Proveedor',
        'Tipo',
        'Monto',
        'Pagado',
        'Estado',
        'Pago',
        'Proyecto',
      ]],
      body: rows.map((row) => ([
        row.code,
        row.date,
        row.description,
        row.category,
        row.contact,
        row.type,
        row.amount,
        row.paid,
        row.status,
        row.paymentStatus,
        row.project,
      ])),
      styles: {
        fontSize: 8,
        cellPadding: 4,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [15, 23, 42],
      },
      columnStyles: {
        2: { cellWidth: 150 },
        3: { cellWidth: 90 },
        4: { cellWidth: 100 },
        10: { cellWidth: 100 },
      },
      margin: { left: 30, right: 30 },
    });

    doc.save(`transacciones-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrintTransactions = () => {
    if (transactions.length === 0) {
      alert('No hay datos para imprimir');
      return;
    }

    const rows = getPrintableRows();
    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresión');
      return;
    }

    const tableRows = rows.map((row) => `
      <tr>
        <td>${row.code}</td>
        <td>${row.date}</td>
        <td>${row.description}</td>
        <td>${row.category}</td>
        <td>${row.contact}</td>
        <td>${row.type}</td>
        <td>${row.amount}</td>
        <td>${row.paid}</td>
        <td>${row.status}</td>
        <td>${row.paymentStatus}</td>
        <td>${row.project}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Listado de Transacciones</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin: 0 0 8px; font-size: 22px; }
            p { margin: 0 0 16px; color: #475569; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f1f5f9; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Listado de Transacciones</h1>
          <p>Generado: ${new Date().toLocaleString('es-VE')} | Registros: ${rows.length}</p>
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Fecha</th>
                <th>Descripcion</th>
                <th>Categoria</th>
                <th>Cliente/Proveedor</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Pagado</th>
                <th>Estado</th>
                <th>Pago</th>
                <th>Proyecto</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Agrupar transacciones por proyecto para mostrar secciones
  const groupedTransactions: Record<string, Transaction[]> = transactions.reduce(
    (acc, t) => {
      const projName = t.project?.name ? `${t.project.name}${t.project.code ? ` (${t.project.code})` : ''}` : 'Sin proyecto';
      if (!acc[projName]) acc[projName] = [];
      acc[projName].push(t);
      return acc;
    },
    {} as Record<string, Transaction[]>
  );

  // Estado para controlar qué grupos están colapsados
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionProjectId, setSelectionProjectId] = useState<string | null>(null);
  const selectedTransactions = transactions.filter(t => selectedIds.includes(t.id));

  // Cargar estado de grupos colapsados desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem('transactions_collapsed_groups');
      if (raw) {
        setCollapsedGroups(JSON.parse(raw));
      }
    } catch (err) {
      // ignore
    }
  }, []);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      try {
        localStorage.setItem('transactions_collapsed_groups', JSON.stringify(next));
      } catch (err) {
        // ignore
      }
      return next;
    });
  };

  // only show full-page spinner on initial load
  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30 p-6 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
              Transacciones
            </h1>
            <p className="text-slate-500 font-medium">
              Libro diario de todas las operaciones
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={toggleViewCurrency}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-slate-600 font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Ver en {viewCurrency}</span>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-slate-600 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
            
            <button
              onClick={() => router.push('/accounts')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-slate-600 font-medium"
            >
              <Wallet className="w-4 h-4" />
              <span>Cuentas</span>
            </button>

            <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-white/40 rounded-xl p-1 shadow-sm">
              <button
                onClick={handlePrintTransactions}
                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
                title="Imprimir listado"
              >
                <Printer className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={handleExportPDF}
                className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                title="Exportar a PDF"
              >
                <FileText className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={handleExportExcel}
                className="p-2 hover:bg-green-50 text-slate-600 hover:text-green-600 rounded-lg transition-colors"
                title="Exportar a Excel"
              >
                <FileText className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={handleExportCSV}
                className="p-2 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                title="Exportar a CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => router.push('/transactions/import')}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-medium shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar</span>
            </button>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-medium shadow-sm"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Transferir</span>
            </button>

            <button
              onClick={() => router.push('/transactions/new')}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-200 font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva</span>
            </button>
            
            <div className="hidden md:block">
              <BatchPaymentModal 
                selected={selectedTransactions} 
                projectId={selectedTransactions[0]?.project?.id || ''} 
                onDone={() => { setSelectedIds([]); loadTransactions(); }} 
              />
            </div>
          </div>
        </div>

        {/* Exchange rates panel */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
          <button 
            onClick={() => setRatesOpen(!ratesOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <RefreshCw className="w-4 h-4" />
              </div>
              <span className="font-semibold text-slate-700">Tasas de Cambio</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${ratesOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${ratesOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-6 border-t border-slate-100 bg-white/30">
              <ExchangeRatesPanel />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Filter className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-700">Filtros de Búsqueda</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="col-span-1 md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Buscar
              </label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Código, descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                />
                {loading && transactions.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-blue-500"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative z-20">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Categoría
              </label>
              <div className="[&>div]:!bg-white/50 [&>div]:!border-slate-200 [&>div]:!rounded-xl">
                <CategorySelector
                  projectId={undefined}
                  value={filter.categoryId ? { id: filter.categoryId, name: filter.category } : filter.category}
                  onChange={(v) => setFilter({ ...filter, category: v.name || '', categoryId: v.id || '' })}
                  placeholder="Seleccionar..."
                  allowCreate={false}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Proyecto
              </label>
              <select
                value={filter.projectId}
                onChange={(e) => setFilter({ ...filter, projectId: e.target.value })}
                className="w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="">Todos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Tipo
              </label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="INCOME">Ingresos</option>
                <option value="EXPENSE">Gastos</option>
                <option value="TRANSFER">Transferencias</option>
                <option value="ADJUSTMENT">Ajustes</option>
                <option value="PAYMENT">Pagos</option>
                <option value="COLLECTION">Cobros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Estado
              </label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="PENDING">Pendiente</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="RECONCILED">Conciliada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Estado de Pago
              </label>
              <select
                value={(filter as any).paymentStatus || ''}
                onChange={(e) => setFilter({ ...filter, paymentStatus: e.target.value } as any)}
                className="w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
                <option value="OVERDUE">Vencido</option>
              </select>
            </div>

            <div className="flex gap-2 col-span-1 md:col-span-2 lg:col-span-1 xl:col-span-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Desde
                </label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {(filter.search || filter.type || filter.status || filter.startDate || filter.endDate || filter.category || filter.projectId) && (
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500 font-medium">
                {transactions.length} resultado{transactions.length !== 1 ? 's' : ''} encontrado{transactions.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFilter({ type: '', status: '', paymentStatus: '', search: '', startDate: '', endDate: '', category: '', categoryId: '', projectId: '' })}
                className="text-sm text-red-500 hover:text-red-600 font-medium hover:underline transition-all"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* Groups - Desktop */}
        <div className="hidden md:block space-y-6">
          {Object.entries(groupedTransactions).map(([projKey, txns]) => {
            const sortedTxns = sortTransactions(txns);
            // Calculate total in view currency
            const totalInView = txns.reduce((acc, x) => acc + (getDisplayAmount(Number(x.amount), x.currency) || 0), 0);
            
            return (
              <div key={projKey} className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm overflow-hidden">
                <div 
                  className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleGroup(projKey)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1 rounded-md bg-white border border-slate-200 text-slate-400 transition-transform duration-200 ${!collapsedGroups[projKey] ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-700">{projKey}</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded-full font-medium">
                      {txns.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <span className="text-xs font-bold text-slate-600">Total {viewCurrency}</span>
                      <span className="ml-2 text-sm font-bold text-slate-800">
                        {formatCurrency(totalInView, viewCurrency).replace(viewCurrency, '').trim()}
                      </span>
                    </div>
                  </div>
                </div>

                {!collapsedGroups[projKey] && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/30">
                          <th className="px-3 py-3 text-left">
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(txns.map(t => t.id));
                                  setSelectionProjectId(txns[0]?.project?.id || null);
                                } else {
                                  setSelectedIds([]);
                                  setSelectionProjectId(null);
                                }
                              }} 
                              checked={txns.every(t => selectedIds.includes(t.id))} 
                            />
                          </th>
                          {/* HEADERS */}
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hidden md:table-cell" onClick={() => {
                            setSortBy('code'); setSortDir(sortBy === 'code' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Código</th>
                          
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap" onClick={() => {
                            setSortBy('date'); setSortDir(sortBy === 'date' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Fecha</th>
                          
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none w-1/4" onClick={() => {
                            setSortBy('description'); setSortDir(sortBy === 'description' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Descripción</th>
                          
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hidden lg:table-cell" onClick={() => {
                            setSortBy('category'); setSortDir(sortBy === 'category' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Categoría</th>
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hidden xl:table-cell" onClick={() => {
                            setSortBy('contactPerson'); setSortDir(sortBy === 'contactPerson' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Cliente</th>
                          
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                            setSortBy('type'); setSortDir(sortBy === 'type' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Tipo</th>
                          
                          <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => {
                            setSortBy('amount'); setSortDir(sortBy === 'amount' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Monto</th>
                          
                          <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hidden sm:table-cell" onClick={() => {
                            setSortBy('amountPaid'); setSortDir(sortBy === 'amountPaid' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Pagado</th>
                          
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hidden sm:table-cell" onClick={() => {
                            setSortBy('status'); setSortDir(sortBy === 'status' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Estado</th>
                          
                          <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hidden sm:table-cell" onClick={() => {
                            setSortBy('paymentStatus'); setSortDir(sortBy === 'paymentStatus' && sortDir === 'asc' ? 'desc' : 'asc');
                          }}>Pago</th>
                          
                          <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedTxns.map((transaction) => (
                          <tr 
                            key={transaction.id} 
                            onClick={() => {
                              if (transaction.status !== 'CANCELLED') {
                                setEditingTransactionId(transaction.id);
                              }
                            }}
                            className={`group transition-colors ${transaction.status === 'CANCELLED' ? 'opacity-60 bg-slate-50 cursor-not-allowed' : 'hover:bg-blue-50/30 cursor-pointer'}`}
                          >
                            <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                checked={selectedIds.includes(transaction.id)} 
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const projId = transaction.project?.id || null;
                                  if (checked) {
                                    if (selectionProjectId && projId && selectionProjectId !== projId) {
                                      alert('Sólo puedes seleccionar transacciones del mismo proyecto para pagos en lote.');
                                      return;
                                    }
                                    setSelectionProjectId(projId);
                                    setSelectedIds(prev => Array.from(new Set([...prev, transaction.id])));
                                  } else {
                                    setSelectedIds(prev => {
                                      const next = prev.filter(id => id !== transaction.id);
                                      if (next.length === 0) setSelectionProjectId(null);
                                      return next;
                                    });
                                  }
                                }} 
                              />
                            </td>
                            <td className="px-3 py-4 hidden md:table-cell">
                              <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                                {transaction.code}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {formatDate(transaction.date)}
                            </td>
                            <td className="px-3 py-4 max-w-[200px] xl:max-w-[300px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-sm font-medium text-slate-900 truncate w-full" title={transaction.description}>
                                    {transaction.description}
                                </div>
                                {transaction.tags?.includes('Recurrente') && (
                                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium border border-purple-200" title="Transacción Recurrente">
                                    <RefreshCw className="w-3 h-3" />
                                    <span className="hidden xl:inline">Recu</span>
                                  </div>
                                )}
                              </div>
                              {transaction.reference && (
                                <div className="text-xs text-slate-500 mt-0.5 truncate" title={transaction.reference}>Ref: {transaction.reference}</div>
                              )}
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-600 hidden lg:table-cell max-w-[120px] truncate" title={transaction.categoryRef?.name || transaction.category || '-'}>
                              {transaction.categoryRef?.name || transaction.category || '-'}
                            </td>
                            <td className="px-3 py-4 text-sm text-slate-600 hidden xl:table-cell max-w-[150px] truncate" title={transaction.contactPerson?.name || '-'}>
                              {transaction.contactPerson?.name || '-'}
                            </td>
                            <td className="px-3 py-4">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getTypeColor(transaction.type)}`}>
                                {getTypeName(transaction.type)}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-right font-mono text-sm font-medium text-slate-700 whitespace-nowrap">
                              {(() => {
                                const paymentWithFx = transaction.allocations?.find(a => a.payment?.targetCurrency && a.payment.targetCurrency !== transaction.currency)?.payment;
                                const isFxTransfer = transaction.type === 'TRANSFER' && paymentWithFx;
                                const originalStr = formatCurrency(Number(transaction.amount), transaction.currency);
                                
                                if (isFxTransfer && paymentWithFx) {
                                  const targetCur = paymentWithFx.targetCurrency!;
                                  const rate = paymentWithFx.exchangeRate || 1;
                                  let targetAmount = transaction.currency === 'USD' && targetCur === 'BS' ? Number(transaction.amount) * rate :
                                                     transaction.currency === 'BS' && targetCur === 'USD' ? Number(transaction.amount) / rate : Number(transaction.amount) * rate;

                                  const targetStr = formatCurrency(targetAmount, targetCur);
                                  
                                  return (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-1.5 text-xs text-blue-600/90 font-bold bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100/50">
                                        <span>{originalStr}</span>
                                        <ArrowRightLeft className="w-3 h-3 text-blue-400" />
                                        <span>{targetStr}</span>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                const val = getDisplayAmount(Number(transaction.amount), transaction.currency);
                                return val !== null ? formatCurrency(val, viewCurrency) : <span title="Tasa no disponible">---</span>;
                              })()}
                              {transaction.type !== 'TRANSFER' && transaction.currency !== viewCurrency && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  Orig: {formatCurrency(Number(transaction.amount), transaction.currency)}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-4 text-right font-mono text-sm text-slate-500 hidden sm:table-cell whitespace-nowrap">
                              {(() => {
                                const val = getDisplayAmount(Number((transaction as any).amountPaid || 0), transaction.currency);
                                return val !== null ? formatCurrency(val, viewCurrency) : '---';
                              })()}
                            </td>
                            <td className="px-3 py-4 hidden sm:table-cell">
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getStatusColor(transaction.status)}`}>
                                {getStatusName(transaction.status)}
                              </span>
                            </td>
                            <td className="px-3 py-4 hidden sm:table-cell">
                              <span className={`text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap ${
                                ((transaction as any).paymentStatus) === 'PAID' ? 'bg-green-50 text-green-700' : 
                                ((transaction as any).paymentStatus) === 'PARTIAL' ? 'bg-yellow-50 text-yellow-700' : 
                                'bg-slate-50 text-slate-600'
                              }`}>
                                {getPaymentStatusName((transaction as any).paymentStatus)}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-right sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] z-10" onClick={(e) => e.stopPropagation()}>
                              {transaction.status !== 'CANCELLED' && 
                               (transaction as any).paymentStatus !== 'PAID' && 
                               ['INCOME', 'EXPENSE'].includes(transaction.type) && (
                                <PayTransactionModal 
                                  transactionId={transaction.id} 
                                  projectId={transaction.project?.id || ''} 
                                  currency={transaction.currency} 
                                  outstanding={Number(transaction.amount) - Number((transaction as any).amountPaid || 0)} 
                                  type={transaction.type}
                                  onDone={() => loadTransactions()} 
                                />
                              )}

                              {['INCOME', 'EXPENSE', 'PAYMENT', 'COLLECTION'].includes(transaction.type) && (
                                <Link 
                                  href={`/receipts/transaction/${transaction.id}`} 
                                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-2 inline-flex"
                                  title="Imprimir Recibo"
                                >
                                  <Printer className="w-4 h-4" />
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
          
          {transactions.length === 0 && (
            <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-2xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No se encontraron transacciones</h3>
              <p className="text-slate-500 mt-1">Intenta ajustar los filtros o crea una nueva transacción</p>
            </div>
          )}
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {Object.entries(groupedTransactions).map(([projKey, txns]) => {
            const total = txns.reduce((s, x) => s + (getDisplayAmount(Number(x.amount), x.currency) || 0), 0);
            
            return (
              <div key={projKey} className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm overflow-hidden">
                <div 
                  className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between"
                  onClick={() => toggleGroup(projKey)}
                >
                  <div className="flex items-center gap-2">
                    <div className={`text-slate-400 transition-transform duration-200 ${!collapsedGroups[projKey] ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-slate-700">{projKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white px-2 py-1 rounded-md border border-slate-200 font-medium text-slate-600">
                      {txns.length}
                    </span>
                    <span className="text-xs font-bold text-slate-800 bg-white px-2 py-1 rounded-md border border-slate-200">
                      {formatCurrency(total, viewCurrency)}
                    </span>
                  </div>
                </div>
                
                {!collapsedGroups[projKey] && (
                  <div className="p-3 bg-slate-50/30 space-y-3">
                    {txns.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        onClick={() => router.push(`/transactions/${transaction.id}`)} 
                        className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm active:scale-[0.98] transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {transaction.code}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatDate(transaction.date)}
                              </span>
                            </div>
                            <h4 className="font-medium text-slate-900 mt-1 flex items-center gap-2">
                              {transaction.description}
                              {transaction.tags?.includes('Recurrente') && (
                                <RefreshCw className="w-3 h-3 text-purple-500" />
                              )}
                            </h4>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getTypeColor(transaction.type)}`}>
                              {getTypeName(transaction.type)}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getStatusColor(transaction.status)}`}>
                              {getStatusName(transaction.status)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-500 text-xs">
                              {transaction.categoryRef?.name || transaction.category || 'Sin categoría'}
                            </span>
                            <span className="text-slate-900 font-medium text-xs">
                              {transaction.contactPerson?.name || transaction.project.name}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-900">
                              {(() => {
                                const val = getDisplayAmount(Number(transaction.amount), transaction.currency);
                                return val !== null ? formatCurrency(val, viewCurrency) : '---';
                              })()}
                            </div>
                            {transaction.currency !== viewCurrency && (
                              <div className="text-[10px] text-slate-400">
                                Orig: {formatCurrency(Number(transaction.amount), transaction.currency)}
                              </div>
                            )}
                            {Number((transaction as any).amountPaid || 0) > 0 && (
                              <div className="text-xs text-green-600 font-medium">
                                Pagado: {(() => {
                                  const val = getDisplayAmount(Number((transaction as any).amountPaid || 0), transaction.currency);
                                  return val !== null ? formatCurrency(val, viewCurrency) : '---';
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mobile Actions */}
                        {['INCOME', 'EXPENSE', 'PAYMENT', 'COLLECTION'].includes(transaction.type) && (
                          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                            <Link 
                              href={`/receipts/transaction/${transaction.id}`} 
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg active:bg-blue-100 transition-colors"
                            >
                              <Printer size={14} />
                              Recibo
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-4 shadow-sm">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-bold text-slate-800">{transactions.length}</p>
          </div>
          <div className="bg-green-50/50 backdrop-blur-xl border border-green-100 rounded-2xl p-4 shadow-sm">
            <p className="text-green-600 text-xs font-semibold uppercase tracking-wider mb-1">Ingresos</p>
            <p className="text-2xl font-bold text-green-700">
              {transactions.filter(t => t.type === 'INCOME').length}
            </p>
          </div>
          <div className="bg-red-50/50 backdrop-blur-xl border border-red-100 rounded-2xl p-4 shadow-sm">
            <p className="text-red-600 text-xs font-semibold uppercase tracking-wider mb-1">Gastos</p>
            <p className="text-2xl font-bold text-red-700">
              {transactions.filter(t => t.type === 'EXPENSE').length}
            </p>
          </div>
          <div className="bg-blue-50/50 backdrop-blur-xl border border-blue-100 rounded-2xl p-4 shadow-sm">
            <p className="text-blue-600 text-xs font-semibold uppercase tracking-wider mb-1">Completadas</p>
            <p className="text-2xl font-bold text-blue-700">
              {transactions.filter(t => t.status === 'COMPLETED').length}
            </p>
          </div>
        </div>
      </div>

      <QuickEditTransactionModal
        transactionId={editingTransactionId}
        onClose={() => setEditingTransactionId(null)}
        onSuccess={() => {
          loadTransactions();
          setEditingTransactionId(null);
        }}
      />

      <InterProjectTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => {
          loadTransactions();
        }}
      />
    </div>
  );
}
