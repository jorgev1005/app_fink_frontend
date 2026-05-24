"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft, 
  Filter,
  Save,
  X,
  AlertCircle,
  Percent,
  RefreshCw
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice: number;
  currency: string;
  stock: number;
  unit?: string;
  taxable: boolean;
  taxRate: number;
  projectId?: string;
  isActive: boolean;
  forSale?: boolean;
  pesoUnitarioKg?: number;
  empaqueCantidad?: number;
  empaquePesoKg?: number;
  empaqueLargoCm?: number;
  empaqueAnchoCm?: number;
  empaqueAltoCm?: number;
  descuentoDivisasTipo?: string;
  descuentoDivisasValor?: number;
}

interface Project {
  id: string;
  name: string;
}

export default function InventoryPage() {
    // Estado de ordenamiento de tabla
    const [sortBy, setSortBy] = useState<string>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Función para ordenar productos
    function sortProducts(arr: Product[]): Product[] {
      if (!sortBy) return arr;
      const sorted = [...arr].sort((a, b) => {
        let av: any, bv: any;
        if (sortBy === 'name') {
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
        } else if (sortBy === 'sku') {
          av = (a.sku || '').toLowerCase();
          bv = (b.sku || '').toLowerCase();
        } else if (sortBy === 'unitPrice') {
          av = a.unitPrice;
          bv = b.unitPrice;
        } else if (sortBy === 'stock') {
          av = a.stock;
          bv = b.stock;
        } else if (sortBy === 'taxRate') {
          av = a.taxable ? a.taxRate : -1;
          bv = b.taxable ? b.taxRate : -1;
        } else {
          av = a[sortBy as keyof Product];
          bv = b[sortBy as keyof Product];
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    description: '',
    unitPrice: 0,
    currency: 'USD',
    stock: 0,
    unit: 'u',
    taxable: true,
    taxRate: 16,
    projectId: '',
    isActive: true,
    forSale: true,
    pesoUnitarioKg: 0,
    empaqueCantidad: 1,
    empaquePesoKg: 0,
    empaqueLargoCm: 0,
    empaqueAnchoCm: 0,
    empaqueAltoCm: 0,
    descuentoDivisasTipo: 'dinamico',
    descuentoDivisasValor: 0,
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [selectedProject, search]);

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (error) {
      console.error("Error loading projects", error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (selectedProject) params.projectId = selectedProject;
      if (search) params.search = search;
      
      const res = await api.products.getAll(params);
      setProducts(res.data.data || []);
    } catch (error) {
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const syncBot = async () => {
    try {
      const botUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://crm.grupoaludra.com/api/sync-catalog'
        : 'http://localhost:3080/api/sync-catalog';
      const res = await fetch(botUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'merge' })
      });
      if(res.ok) {
        toast.success("Catálogo sincronizado exitosamente con el Bot");
      } else {
        toast.error("Error al sincronizar con el Bot");
      }
    } catch(e) {
      toast.error("Error de conexión con el servidor del Bot (Puerto 3080)");
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      if (editingProduct) {
        await api.products.update(editingProduct.id, formData);
        toast.success("Producto actualizado");
      } else {
        await api.products.create(formData);
        toast.success("Producto creado");
      }
      setShowModal(false);
      loadProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Error al guardar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    try {
      await api.products.delete(id);
      toast.success("Producto eliminado");
      loadProducts();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        description: '',
        unitPrice: 0,
        currency: 'USD',
        stock: 0,
        unit: 'u',
        taxable: true,
        taxRate: 16,
        projectId: selectedProject || (projects[0]?.id || ''),
        isActive: true,
        forSale: true,
        pesoUnitarioKg: 0,
        empaqueCantidad: 1,
        empaquePesoKg: 0,
        empaqueLargoCm: 0,
        empaqueAnchoCm: 0,
        empaqueAltoCm: 0,
      });
    }
    setShowModal(true);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-blue-600" />
              Inventario de Productos
            </h1>
            <p className="text-slate-500 text-sm">Gestiona tu catálogo de productos y servicios</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={syncBot}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium"
          >
            <RefreshCw size={18} />
            Sincronizar Bot
          </button>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <Plus size={18} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o SKU..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 min-w-[200px]">
          <Filter size={18} className="text-slate-400" />
          <select 
            className="w-full border border-slate-200 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">Todos los Proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4 cursor-pointer select-none" onClick={() => { setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Producto {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="p-4 cursor-pointer select-none" onClick={() => { setSortBy('sku'); setSortDir(sortBy === 'sku' && sortDir === 'asc' ? 'desc' : 'asc'); }}>SKU {sortBy === 'sku' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="p-4 text-right cursor-pointer select-none" onClick={() => { setSortBy('unitPrice'); setSortDir(sortBy === 'unitPrice' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Precio Unit. {sortBy === 'unitPrice' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="p-4 text-center cursor-pointer select-none" onClick={() => { setSortBy('stock'); setSortDir(sortBy === 'stock' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Stock {sortBy === 'stock' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="p-4 text-center cursor-pointer select-none" onClick={() => { setSortBy('taxRate'); setSortDir(sortBy === 'taxRate' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Impuesto {sortBy === 'taxRate' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Cargando...</td></tr>
              ) : sortProducts(products).length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron productos</td></tr>
              ) : (
                sortProducts(products).map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{product.name}</div>
                      {product.description && <div className="text-xs text-slate-500 truncate max-w-[200px]">{product.description}</div>}
                    </td>
                    <td className="p-4 text-slate-500 font-mono text-xs">{product.sku || '-'}</td>
                    <td className="p-4 text-right font-medium">
                      {new Intl.NumberFormat('es-VE', { style: 'currency', currency: product.currency === 'BS' ? 'VES' : 'USD' }).format(product.unitPrice)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {product.stock} {product.unit}
                      </span>
                    </td>
                    <td className="p-4 text-center text-xs text-slate-500">
                      {product.taxable ? `${product.taxRate}%` : 'Exento'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openModal(product)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/20 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto *</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej. Consultoría Técnica"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Código</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.sku || ''}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.projectId || ''}
                    onChange={e => setFormData({...formData, projectId: e.target.value})}
                  >
                    <option value="">Sin Proyecto (Global)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea 
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                  value={formData.description || ''}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio Unitario</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full border border-slate-200 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.unitPrice}
                      onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                    <button 
                      className={`flex-1 py-2 text-sm font-medium ${formData.currency === 'USD' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                      onClick={() => setFormData({...formData, currency: 'USD'})}
                    >
                      USD
                    </button>
                    <button 
                      className={`flex-1 py-2 text-sm font-medium ${formData.currency === 'BS' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                      onClick={() => setFormData({...formData, currency: 'BS'})}
                    >
                      BS
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock Inicial</label>
                  <input 
                    type="number" 
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.unit || ''}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    placeholder="u, kg, lts..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="taxable"
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    checked={formData.taxable}
                    onChange={e => setFormData({...formData, taxable: e.target.checked})}
                  />
                  <label htmlFor="taxable" className="text-sm font-medium text-slate-700">Aplica Impuesto</label>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <input 
                    type="checkbox" 
                    id="forSale"
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    checked={formData.forSale !== false}
                    onChange={e => setFormData({...formData, forSale: e.target.checked})}
                  />
                  <label htmlFor="forSale" className="text-sm font-medium text-slate-700">Para la Venta (Bot/CRM)</label>
                </div>
                
                {formData.taxable && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="w-20 border border-slate-200 rounded-lg p-1 text-sm text-right"
                      value={formData.taxRate}
                      onChange={e => setFormData({...formData, taxRate: parseFloat(e.target.value) || 0})}
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                )}
              </div>

              {/* SECCIÓN COMERCIAL Y DESCUENTOS */}
              <div className="pt-4 border-t border-slate-200 mt-4">
                <h4 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Percent size={18} className="text-blue-600"/>
                  Comercial y Descuentos
                </h4>
                
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Descuento Divisas Bot (Efectivo/Cripto)
                    </label>
                    <select 
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.descuentoDivisasTipo || 'dinamico'}
                      onChange={e => setFormData({...formData, descuentoDivisasTipo: e.target.value})}
                    >
                      <option value="dinamico">Dinámico (Márgen de Brecha)</option>
                      <option value="fijo">Fijo (Porcentaje Exacto)</option>
                      <option value="desactivado">Desactivado (Sin Descuento)</option>
                    </select>
                  </div>
                  
                  {formData.descuentoDivisasTipo === 'fijo' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Porcentaje de Descuento (%)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          step="0.1"
                          className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.descuentoDivisasValor || 0}
                          onChange={e => setFormData({...formData, descuentoDivisasValor: parseFloat(e.target.value) || 0})}
                        />
                        <span className="text-slate-500 text-sm font-medium">%</span>
                      </div>
                    </div>
                  )}
                </div>
                {formData.descuentoDivisasTipo === 'desactivado' && (
                  <p className="text-xs text-orange-600 font-medium mb-2">
                    * Este producto cobrará el precio base en dólares directamente sin importar la brecha cambiaria. (Excepción de Terceros)
                  </p>
                )}
              </div>

              {/* SECCIÓN LÓGISTICA Y EMPAQUE */}
              <div className="pt-4 border-t border-slate-200 mt-4">
                <h4 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Package size={18} className="text-blue-600"/>
                  Logística y Empaque
                </h4>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Peso Unid. (Kg)</label>
                    <input 
                      type="number" 
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.pesoUnitarioKg || 0}
                      onChange={e => setFormData({...formData, pesoUnitarioKg: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Unid. x Empaque</label>
                    <input 
                      type="number" 
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.empaqueCantidad || 1}
                      onChange={e => setFormData({...formData, empaqueCantidad: parseInt(e.target.value) || 1})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Peso Empaque (Kg)</label>
                    <input 
                      type="number" 
                      className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.empaquePesoKg || 0}
                      onChange={e => setFormData({...formData, empaquePesoKg: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700 mb-2">Dimensiones del Empaque / Bulto (cm)</label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">Largo</span>
                      <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.empaqueLargoCm || 0}
                        onChange={e => setFormData({...formData, empaqueLargoCm: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">Ancho</span>
                      <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.empaqueAnchoCm || 0}
                        onChange={e => setFormData({...formData, empaqueAnchoCm: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">Alto</span>
                      <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.empaqueAltoCm || 0}
                        onChange={e => setFormData({...formData, empaqueAltoCm: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                {/* Cálculo en tiempo real */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-blue-500" />
                    <span className="text-sm text-blue-800 font-medium">Peso Volumétrico Referencial:</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    {(((formData.empaqueLargoCm || 0) * (formData.empaqueAnchoCm || 0) * (formData.empaqueAltoCm || 0)) / 5000).toFixed(2)} Kg
                  </span>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium flex items-center gap-2"
              >
                <Save size={18} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
