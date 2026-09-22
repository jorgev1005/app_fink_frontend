"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowLeft,
  Tag,
  DollarSign,
  Copy,
  Check,
  Share2,
  Package,
  TrendingUp,
  Percent,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Building2,
  X
} from 'lucide-react';
import api, { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import skuSupplierCodes from '@/data/sku_supplier_codes.json';

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
  isActive: boolean;
  forSale?: boolean;
  costPrice?: number;
  packagingCost?: number;
  division?: string;
  supplierCode?: string;
  medidas?: string;
}

export default function PriceCheckPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'priceAsc' | 'priceDesc' | 'marginDesc' | 'stockDesc'>('name');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [currencyMode, setCurrencyMode] = useState<'both' | 'usd' | 'bs'>('both');

  const [exchangeRate, setExchangeRate] = useState<any>(null);
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const defaultDivisions = [
    "Aludra Terra (Agro)",
    "Aludra Link (Empaques)",
    "Aludra Link (Ferretería)",
    "Aludra Link (Demarcación)",
    "FERRETERIA",
    "Cartón Reciclado",
    "TAPAS",
    "Cercos Eléctricos",
    "Cotización Bobinas",
    "Catálogo Ampliado"
  ];

  const [divisions, setDivisions] = useState<string[]>(defaultDivisions);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    loadRates();
    // Auto-focus search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadProducts(debouncedSearch, selectedDivision);
  }, [debouncedSearch, selectedDivision]);

  const loadRates = async () => {
    try {
      const res = await api.exchangeRates.getLatest();
      const data = res.data.data;
      if (data?.usdToBs) {
        setExchangeRate(data);
        setBcvRate(data.usdToBs);
      } else {
        const resBySource = await apiClient.get('/api/exchange-rates/latest-by-source');
        if (resBySource.data?.success && resBySource.data.data?.BCV?.usdToBs) {
          setBcvRate(resBySource.data.data.BCV.usdToBs);
        }
      }
    } catch (e) {
      console.error("Error loading exchange rate", e);
    }
  };

  const loadProducts = async (query?: string, div?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (query && query.trim()) {
        params.search = query.trim();
        params.limit = 1000;
      } else {
        params.limit = 5000;
      }
      if (div && div !== 'all') {
        params.division = div;
      }
      const res = await api.products.getAll(params);
      const list: Product[] = res.data.data || [];
      setProducts(list);
      if (list.length > 0) {
        const currentDivs = list.map(p => p.division).filter(Boolean) as string[];
        setDivisions(prev => Array.from(new Set([...prev, ...currentDivs])).sort());
      }
    } catch (e) {
      toast.error("Error al cargar la lista de productos");
    } finally {
      setLoading(false);
    }
  };

  // Helper para resolver el código de proveedor
  const sCodes = skuSupplierCodes as Record<string, string>;
  const getSupplierCode = (p: Product): string | null => {
    if (p.supplierCode) return p.supplierCode;
    if (p.sku && sCodes[p.sku]) return sCodes[p.sku];
    if (p.description) {
      const m = p.description.match(/C[oó]digo Proveedor:\s*([^|\n\r]+)/i);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  };

  // Filtrado y ordenamiento de productos
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products.filter(p => {
      // Filtrar por estado activo
      if (p.isActive === false) return false;

      // Filtro de división
      if (selectedDivision !== 'all' && p.division !== selectedDivision) {
        return false;
      }

      // Filtro de solo stock
      if (onlyInStock && (p.stock || 0) <= 0) {
        return false;
      }

      // Búsqueda en múltiples campos
      if (q) {
        const sCode = (getSupplierCode(p) || '').toLowerCase();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesSku = (p.sku || '').toLowerCase().includes(q);
        const matchesSupplier = sCode.includes(q);
        const matchesDesc = (p.description || '').toLowerCase().includes(q);
        const matchesDivision = (p.division || '').toLowerCase().includes(q);

        if (!matchesName && !matchesSku && !matchesSupplier && !matchesDesc && !matchesDivision) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const costA = (a.costPrice || 0) + (a.packagingCost || 0);
      const priceA = a.unitPrice || 0;
      const marginA = priceA > 0 ? ((priceA - costA) / priceA) * 100 : 0;

      const costB = (b.costPrice || 0) + (b.packagingCost || 0);
      const priceB = b.unitPrice || 0;
      const marginB = priceB > 0 ? ((priceB - costB) / priceB) * 100 : 0;

      if (sortBy === 'priceAsc') return priceA - priceB;
      if (sortBy === 'priceDesc') return priceB - priceA;
      if (sortBy === 'marginDesc') return marginB - marginA;
      if (sortBy === 'stockDesc') return (b.stock || 0) - (a.stock || 0);
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [products, search, selectedDivision, onlyInStock, sortBy]);

  // Copiar al portapapeles
  const handleCopyText = (text: string, label: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(keyId);
    toast.success(`${label} copiado`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Formato para cotización rápida WhatsApp
  const handleCopyProductQuote = (p: Product) => {
    const sCode = getSupplierCode(p);
    const priceUsd = (p.unitPrice || 0).toFixed(2);
    const priceBs = bcvRate > 0 ? ((p.unitPrice || 0) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
    
    let text = `📦 *${p.name}*\n`;
    if (p.sku) text += `▫️ *SKU:* \`${p.sku}\`\n`;
    if (sCode) text += `▫️ *Cód. Prov:* \`${sCode}\`\n`;
    if (p.division) text += `▫️ *División:* ${p.division}\n`;
    text += `💰 *Precio Venta:* $${priceUsd} USD`;
    if (priceBs) text += ` (${priceBs} Bs. @ BCV ${bcvRate.toFixed(2)})`;
    text += `\n📊 *Disponibilidad:* ${p.stock || 0} ${p.unit || 'u'}`;
    if (p.description) {
      text += `\n📝 *Descripción:* ${p.description.replace(/C[oó]digo Proveedor:[^\n\r]+/i, '').trim()}`;
    }

    handleCopyText(text, "Ficha para cotización", `quote-${p.id}`);
  };

  const handleOpenWhatsApp = (p: Product) => {
    const sCode = getSupplierCode(p);
    const priceUsd = (p.unitPrice || 0).toFixed(2);
    const priceBs = bcvRate > 0 ? ((p.unitPrice || 0) * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
    
    let msg = `Hola, te comparto la información de disponibilidad y precio:\n\n*${p.name}*\n`;
    if (p.sku) msg += `SKU: ${p.sku}\n`;
    if (sCode) msg += `Cód. Prov: ${sCode}\n`;
    msg += `Precio: $${priceUsd} USD`;
    if (priceBs) msg += ` / ${priceBs} Bs.`;
    msg += `\nStock disponible: ${p.stock || 0} ${p.unit || 'u'}\n`;
    if (p.description) {
      const cleanDesc = p.description.replace(/C[oó]digo Proveedor:[^\n\r]+/i, '').trim();
      if (cleanDesc) msg += `Detalle: ${cleanDesc}`;
    }

    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  // Métricas de resumen de la vista actual
  const stats = useMemo(() => {
    let totalStock = 0;
    let withSupplierCodeCount = 0;
    let totalMarginAcc = 0;
    let pricedCount = 0;

    filteredProducts.forEach(p => {
      totalStock += (p.stock || 0);
      if (getSupplierCode(p)) withSupplierCodeCount++;

      const cost = (p.costPrice || 0) + (p.packagingCost || 0);
      const price = p.unitPrice || 0;
      if (price > 0) {
        const m = ((price - cost) / price) * 100;
        totalMarginAcc += m;
        pricedCount++;
      }
    });

    const avgMargin = pricedCount > 0 ? (totalMarginAcc / pricedCount) : 0;
    return {
      count: filteredProducts.length,
      totalStock,
      withSupplierCodeCount,
      avgMargin
    };
  }, [filteredProducts]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 space-y-6">
      {/* 1. Header de navegación y título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/inventory')}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 border border-slate-200"
            title="Volver a Inventario Completo"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <Tag size={18} />
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                Consulta Rápida de Precios y Costos
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200/60">
                Ventas FINK
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Búsqueda instantánea de SKU, Código de Proveedor, Costo base, Precio de venta y Margen
            </p>
          </div>
        </div>

        {/* Indicador de Tasa BCV Oficial */}
        <div className="flex items-center gap-3 self-start md:self-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tasa Oficial BCV</div>
            <div className="text-sm font-black text-slate-800">
              {bcvRate > 0 ? `${bcvRate.toFixed(2)} Bs/$` : 'Cargando...'}
            </div>
          </div>
          <button
            onClick={loadRates}
            className="p-1.5 hover:bg-white text-slate-500 hover:text-blue-600 rounded-lg transition-all border border-transparent hover:border-slate-200"
            title="Refrescar tasa de cambio"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 2. Barra de Búsqueda Principal Instantánea */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-slate-400" size={22} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Nombre, SKU FINK, Código de Proveedor, Descripción..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border-2 border-slate-200 focus:border-blue-500 rounded-xl text-slate-800 font-medium placeholder-slate-400 text-base outline-none transition-all shadow-inner"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                searchInputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
              title="Limpiar búsqueda"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Filtros de Control */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de División */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
              <Layers size={14} className="text-slate-500" />
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Todas las Divisiones ({divisions.length})</option>
                {divisions.map(div => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            </div>

            {/* Switch de Solo Stock */}
            <button
              onClick={() => setOnlyInStock(!onlyInStock)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                onlyInStock
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100/80 text-slate-600 border-slate-200/60 hover:bg-slate-200/60'
              }`}
            >
              <Package size={14} />
              Solo con existencia
            </button>

            {/* Selector de Moneda */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
              <button
                onClick={() => setCurrencyMode('both')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  currencyMode === 'both' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                USD & Bs
              </button>
              <button
                onClick={() => setCurrencyMode('usd')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  currencyMode === 'usd' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Solo USD
              </button>
              <button
                onClick={() => setCurrencyMode('bs')}
                className={`px-2 py-1 rounded-md font-bold transition-all ${
                  currencyMode === 'bs' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Solo Bs
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Selector de Orden */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
              <SlidersHorizontal size={14} className="text-slate-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="name">Ordenar: Nombre (A-Z)</option>
                <option value="priceDesc">Precio: Mayor a Menor</option>
                <option value="priceAsc">Precio: Menor a Mayor</option>
                <option value="marginDesc">Mayor Rentabilidad (%)</option>
                <option value="stockDesc">Mayor Existencia</option>
              </select>
            </div>

            {/* Alternar Vista: Tabla / Cards */}
            <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  viewMode === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tabla
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  viewMode === 'cards' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tarjetas
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Barra de Estadísticas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <span className="text-slate-500 font-medium">Productos encontrados:</span>
          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
            {stats.count}
          </span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <span className="text-slate-500 font-medium">Con Cód. Proveedor:</span>
          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
            {stats.withSupplierCodeCount}
          </span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <span className="text-slate-500 font-medium">Existencia total:</span>
          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
            {stats.totalStock.toLocaleString()} u
          </span>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <span className="text-slate-500 font-medium">Margen promedio:</span>
          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
            {stats.avgMargin.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 4. Contenido Principal: Resultados */}
      {loading ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center space-y-3">
          <RefreshCw className="animate-spin text-blue-600 mx-auto" size={36} />
          <p className="text-slate-600 font-medium text-sm">Cargando catálogo para consulta rápida...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center space-y-3">
          <Package className="text-slate-300 mx-auto" size={48} />
          <h3 className="text-lg font-bold text-slate-700">No se encontraron productos</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {search ? `No hay coincidencias para "${search}". Prueba con otra palabra clave o limpia el filtro.` : 'No hay productos registrados en esta división.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-2 px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-xl text-xs hover:bg-blue-100 transition-colors"
            >
              Ver todos los productos
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* VISTA TABLA COMPACTA Y COMPLETA */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                  <th className="p-3.5 pl-5">Producto / Descripción</th>
                  <th className="p-3.5">SKU FINK</th>
                  <th className="p-3.5">Cód. Proveedor</th>
                  <th className="p-3.5">División</th>
                  <th className="p-3.5 text-right">Costo Base ($)</th>
                  <th className="p-3.5 text-right">Precio Venta</th>
                  <th className="p-3.5 text-right">Margen</th>
                  <th className="p-3.5 text-center">Stock</th>
                  <th className="p-3.5 pr-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const sCode = getSupplierCode(p);
                  const cost = (p.costPrice || 0) + (p.packagingCost || 0);
                  const price = p.unitPrice || 0;
                  const marginAmt = price - cost;
                  const marginPct = price > 0 ? (marginAmt / price) * 100 : 0;
                  const priceBs = bcvRate > 0 ? price * bcvRate : 0;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors group">
                      {/* Nombre y Descripción */}
                      <td className="p-3.5 pl-5 max-w-sm">
                        <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                        {p.description && (
                          <div className="text-slate-500 text-[11px] mt-0.5 line-clamp-2" title={p.description}>
                            {p.description.replace(/C[oó]digo Proveedor:[^\n\r]+/i, '').trim()}
                          </div>
                        )}
                      </td>

                      {/* SKU FINK con botón copiar */}
                      <td className="p-3.5 whitespace-nowrap">
                        {p.sku ? (
                          <button
                            onClick={() => handleCopyText(p.sku!, 'SKU', `sku-${p.id}`)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Click para copiar SKU"
                          >
                            {copiedId === `sku-${p.id}` ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} className="text-slate-400 group-hover:text-slate-600" />
                            )}
                            {p.sku}
                          </button>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">Sin SKU</span>
                        )}
                      </td>

                      {/* Código de Proveedor con botón copiar */}
                      <td className="p-3.5 whitespace-nowrap">
                        {sCode ? (
                          <button
                            onClick={() => handleCopyText(sCode, 'Código del Proveedor', `supp-${p.id}`)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-md font-mono text-[11px] font-bold transition-colors cursor-pointer"
                            title="Click para copiar Código del Proveedor"
                          >
                            {copiedId === `supp-${p.id}` ? (
                              <Check size={12} className="text-emerald-600" />
                            ) : (
                              <Copy size={12} className="text-amber-500" />
                            )}
                            {sCode}
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>

                      {/* División */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">
                          {p.division || 'General'}
                        </span>
                      </td>

                      {/* Costo Base */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <span className="font-semibold text-slate-600 font-mono text-xs">
                          ${cost.toFixed(2)}
                        </span>
                      </td>

                      {/* Precio de Venta (USD / Bs) */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        {(currencyMode === 'both' || currencyMode === 'usd') && (
                          <div className="font-extrabold text-blue-700 font-mono text-sm">
                            ${price.toFixed(2)}
                          </div>
                        )}
                        {(currencyMode === 'both' || currencyMode === 'bs') && bcvRate > 0 && (
                          <div className="text-[11px] font-bold text-slate-500 font-mono">
                            {priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                          </div>
                        )}
                      </td>

                      {/* Margen */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className={`font-bold text-xs ${
                          marginPct >= 30 ? 'text-emerald-700' : marginPct >= 15 ? 'text-blue-700' : marginPct > 0 ? 'text-amber-700' : 'text-red-600'
                        }`}>
                          {marginPct.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          +${marginAmt.toFixed(2)}
                        </div>
                      </td>

                      {/* Stock */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                          (p.stock || 0) > 10 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                            : (p.stock || 0) > 0 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                        }`}>
                          {p.stock || 0} {p.unit || 'u'}
                        </span>
                      </td>

                      {/* Acciones Rápidas */}
                      <td className="p-3.5 pr-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleCopyProductQuote(p)}
                            className="p-1.5 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Copiar ficha de venta para WhatsApp"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenWhatsApp(p)}
                            className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                            title="Compartir por WhatsApp"
                          >
                            <Share2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA TARJETAS (CARDS) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const sCode = getSupplierCode(p);
            const cost = (p.costPrice || 0) + (p.packagingCost || 0);
            const price = p.unitPrice || 0;
            const marginAmt = price - cost;
            const marginPct = price > 0 ? (marginAmt / price) * 100 : 0;
            const priceBs = bcvRate > 0 ? price * bcvRate : 0;

            return (
              <div
                key={p.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                      {p.division || 'General'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      (p.stock || 0) > 10 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                        : (p.stock || 0) > 0 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/60' 
                        : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                    }`}>
                      Stock: {p.stock || 0} {p.unit || 'u'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-2 leading-tight">
                    {p.name}
                  </h3>

                  {p.description && (
                    <p className="text-slate-500 text-xs mt-1 line-clamp-3">
                      {p.description.replace(/C[oó]digo Proveedor:[^\n\r]+/i, '').trim()}
                    </p>
                  )}

                  {/* Badges de códigos */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                    {p.sku && (
                      <button
                        onClick={() => handleCopyText(p.sku!, 'SKU', `csku-${p.id}`)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-xs font-semibold transition-colors cursor-pointer"
                        title="Copiar SKU"
                      >
                        <span className="text-[10px] text-slate-400 uppercase font-sans">SKU</span>
                        {p.sku}
                        <Copy size={11} className="text-slate-400" />
                      </button>
                    )}

                    {sCode && (
                      <button
                        onClick={() => handleCopyText(sCode, 'Código Proveedor', `csupp-${p.id}`)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-md font-mono text-xs font-bold transition-colors cursor-pointer"
                        title="Copiar Código de Proveedor"
                      >
                        <span className="text-[10px] text-amber-600/70 uppercase font-sans">Prov</span>
                        {sCode}
                        <Copy size={11} className="text-amber-500" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Precios, Costo y Margen */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Costo Base:</span>
                    <span className="font-semibold text-slate-700 font-mono">${cost.toFixed(2)}</span>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-slate-200/60 pt-1.5">
                    <span className="text-xs font-bold text-slate-700">Precio Venta:</span>
                    <div className="text-right">
                      <div className="text-lg font-black text-blue-700 font-mono leading-none">
                        ${price.toFixed(2)}
                      </div>
                      {bcvRate > 0 && (
                        <div className="text-[11px] font-bold text-slate-500 font-mono mt-0.5">
                          {priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Margen estimado:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-500 text-[11px]">+${marginAmt.toFixed(2)}</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                        marginPct >= 30 ? 'bg-emerald-100 text-emerald-800' : marginPct >= 15 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleCopyProductQuote(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Copy size={14} />
                    Copiar Ficha
                  </button>
                  <button
                    onClick={() => handleOpenWhatsApp(p)}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors cursor-pointer"
                    title="Enviar por WhatsApp"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
