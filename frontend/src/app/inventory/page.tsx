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
  RefreshCw,
  Upload,
  ArrowRightLeft,
  FileText,
  Truck,
  ShoppingCart,
  Check
} from 'lucide-react';
import api, { apiClient } from '@/lib/api';
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
  largoCm?: number;
  anchoCm?: number;
  altoCm?: number;
  descuentoDivisasTipo?: string;
  descuentoDivisasValor?: number;
  costPrice?: number;
  packagingCost?: number;
  division?: string;
  medidas?: string;
}

interface Project {
  id: string;
  name: string;
}

const standardDivisions = [
  "Aludra Terra (Agro)",
  "Aludra Link (Empaques)",
  "Aludra Link (Ferretería)",
  "Aludra Link (Demarcación)",
  "FERRETERIA",
  "Cotización Bobinas"
];


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
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<any>(null);
  const [ratesBySource, setRatesBySource] = useState<{ BCV?: number; BINANCE?: number; CUSTOM?: number; EUR?: number }>({});
  const [pdfRateMode, setPdfRateMode] = useState<'BCV' | 'EUR' | 'BINANCE' | 'CUSTOM'>('BCV');
  const [pdfIncludeKeywords, setPdfIncludeKeywords] = useState<string>('');
  const [pdfExcludeKeywords, setPdfExcludeKeywords] = useState<string>('');

  // Estado para modal de Lista de Precios PDF
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfAdjustmentPercent, setPdfAdjustmentPercent] = useState<number>(0);
  const [pdfSelectedProject, setPdfSelectedProject] = useState<string>('all');
  const [pdfTasaOverride, setPdfTasaOverride] = useState<string>('');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  
  // Estado para Modal de Orden de Compra (OC) a Proveedores
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [poGenerating, setGeneratingPO] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [poProjectId, setPoProjectId] = useState<string>('');
  const [poSupplierName, setPoSupplierName] = useState('SOLO MAYOR');
  const [poSupplierTaxId, setPoSupplierTaxId] = useState('J-12345678-0');
  const [poSupplierPhone, setPoSupplierPhone] = useState('0412-271-1859');
  const [poDeliveryAddress, setPoDeliveryAddress] = useState('Almacén Principal La Victoria, Aragua');
  const [poExpectedDate, setPoExpectedDate] = useState('Inmediata / 24-48 horas');
  const [poPaymentTerms, setPoPaymentTerms] = useState('Contado / Según acuerdo comercial');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<Array<{ product: Product; quantity: number; costPrice: number }>>([]);
  const [poSearch, setPoSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [savingPOInSystem, setSavingPOInSystem] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Modal State para Traspaso de Almacén entre Proyectos
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);
  const [transferTargetProjectId, setTransferTargetProjectId] = useState<string>('');
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferring, setTransferring] = useState(false);

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
    costPrice: 0,
    packagingCost: 0,
    division: 'Aludra Terra (Agro)',
  });

  useEffect(() => {
    loadProjects();
    loadExchangeRate();
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [selectedProject, search]);

  const loadSuppliers = async () => {
    try {
      const res = await api.contacts.getAll();
      setSuppliers(res.data.data || []);
    } catch (error) {
      console.error("Error loading suppliers", error);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await api.projects.getAll();
      setProjects(res.data.data || []);
    } catch (error) {
      console.error("Error loading projects", error);
    }
  };

  const loadExchangeRate = async () => {
    try {
      const res = await api.exchangeRates.getLatest();
      const latestData = res.data.data || null;
      setExchangeRate(latestData);

      const resBySource = await apiClient.get('/api/exchange-rates/latest-by-source');
      if (resBySource.data?.success) {
        const d = resBySource.data.data;
        setRatesBySource({
          BCV: d.BCV?.usdToBs || latestData?.usdToBs,
          EUR: d.BCV?.eurToBs || latestData?.eurToBs,
          BINANCE: d.BINANCE?.usdToBs,
          CUSTOM: d.CUSTOM?.usdToBs,
        });
      }
    } catch (error) {
      console.error("Error loading exchange rate", error);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 1000 };
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

  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be uploaded again
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!Array.isArray(json)) {
          toast.error("El archivo JSON debe contener un arreglo de productos");
          return;
        }

        const res = await api.products.bulkSyncCosts(json);
        if (res.data.success) {
          toast.success(`Sincronización completada: ${res.data.updatedCount} productos actualizados`);
          loadProducts();
        } else {
          toast.error("Error al sincronizar los costos");
        }
      } catch (err: any) {
        toast.error("Error al procesar el archivo JSON: " + err.message);
      }
    };
    reader.readAsText(file);
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
        largoCm: 0,
        anchoCm: 0,
        altoCm: 0,
        costPrice: 0,
        packagingCost: 0,
        division: 'Aludra Terra (Agro)',
      });
    }
    setShowModal(true);
  };

  const openTransferModal = (product?: Product) => {
    if (product) {
      setTransferProduct(product);
      setTransferQuantity(product.stock > 0 ? 1 : 0);
    } else {
      setTransferProduct(products[0] || null);
      setTransferQuantity(1);
    }
    setTransferTargetProjectId('');
    setTransferNotes('');
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferProduct) {
      toast.error("Selecciona un producto para realizar el traspaso.");
      return;
    }
    if (!transferTargetProjectId) {
      toast.error("Selecciona el proyecto de destino.");
      return;
    }
    if (transferQuantity <= 0) {
      toast.error("La cantidad a traspasar debe ser mayor a 0.");
      return;
    }
    if (transferQuantity > transferProduct.stock) {
      toast.error(`La cantidad excede el stock disponible en origen (${transferProduct.stock} ${transferProduct.unit || 'u'}).`);
      return;
    }

    setTransferring(true);
    try {
      const res = await api.products.transferStock({
        productId: transferProduct.id,
        toProjectId: transferTargetProjectId,
        quantity: transferQuantity,
        notes: transferNotes,
      });

      if (res.data.success) {
        toast.success(res.data.message || "Traspaso de inventario realizado con éxito.");
        setShowTransferModal(false);
        loadProducts();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Error al realizar el traspaso de inventario.");
    } finally {
      setTransferring(false);
    }
  };

  const handleGeneratePriceListPDF = async (action: 'view' | 'download') => {
    setPdfGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        adjustmentPercentage: pdfAdjustmentPercent.toString(),
        projectId: pdfSelectedProject,
        ...(pdfTasaOverride ? { tasaOverride: pdfTasaOverride } : {}),
        ...(pdfIncludeKeywords ? { includeKeywords: pdfIncludeKeywords } : {}),
        ...(pdfExcludeKeywords ? { excludeKeywords: pdfExcludeKeywords } : {})
      });

      const url = `/backend-api/api/products/export/price-list-pdf?${queryParams.toString()}`;

      const response = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || 'Error al generar la lista de precios PDF');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (action === 'view') {
        window.open(blobUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Lista_Precios_Aludra_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      toast.success("Lista de precios PDF generada con éxito");
    } catch (err: any) {
      toast.error(err.message || "Error al generar la lista de precios");
    } finally {
      setPdfGenerating(false);
    }
  };

  // ── MANEJO DE ORDEN DE COMPRA (PROVEEDORES) ───────────────────
  const openPurchaseOrderModal = () => {
    setPoProjectId(selectedProject || (projects.length > 0 ? projects[0].id : ''));
    setSupplierSearch('');
    loadSuppliers();
    setShowPurchaseOrderModal(true);
  };

  const handleSelectSupplier = (id: string) => {
    setSelectedSupplierId(id);
    if (!id) return;
    const supp = suppliers.find(s => s.id === id);
    if (supp) {
      setPoSupplierName(supp.name);
      setPoSupplierTaxId(supp.taxId || '');
      setPoSupplierPhone(supp.phone || '');
      if (supp.address) setPoDeliveryAddress(supp.address);
      if (supp.notes) setPoNotes(supp.notes);
      if (supp.projectId && !poProjectId) setPoProjectId(supp.projectId);
    }
  };

  const handleSavePurchaseOrderInSystem = async (andPay: boolean = false) => {
    if (poItems.length === 0) {
      toast.error('Debe agregar al menos un producto a la orden de compra');
      return;
    }
    const targetProject = poProjectId || selectedProject || (projects.length > 0 ? projects[0].id : '');
    if (!targetProject) {
      toast.error('Debe seleccionar un proyecto para la orden de compra');
      return;
    }

    setSavingPOInSystem(true);
    try {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const rand = Math.floor(Math.random() * 9000) + 1000;
      const orderCode = `OC-${year}${month}${day}-${rand}`;

      const totalCostUSD = poItems.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);

      const itemsData = poItems.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        description: item.product.name,
        sku: item.product.sku || undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.costPrice),
        price: Number(item.costPrice),
        total: Number(item.costPrice * item.quantity),
        notes: poNotes || undefined
      }));

      const payload = {
        projectId: targetProject,
        type: 'BILL',
        code: orderCode,
        vendorId: selectedSupplierId || null,
        issueDate: new Date().toISOString().slice(0, 10),
        currency: 'USD',
        total: totalCostUSD,
        lines: itemsData,
        status: 'OPEN',
        purchaseOrder: orderCode,
        purchaseOrderDate: new Date().toISOString().slice(0, 10),
        notes: poNotes || `Orden de Compra formal emitida a ${poSupplierName.trim() || 'Proveedor'}`
      };

      const res = await api.invoices.create(payload);
      const created = res.data?.data;

      toast.success(`✅ Orden de Compra #${orderCode} registrada en el sistema`);
      setShowPurchaseOrderModal(false);

      if (andPay && created?.id) {
        router.push(`/invoices/${created.id}?openPayment=true`);
      } else if (created?.id) {
        router.push(`/invoices/${created.id}`);
      }
    } catch (err: any) {
      console.error('Error saving PO in system:', err);
      toast.error(err.response?.data?.error?.message || err.message || 'Error al guardar la orden de compra');
    } finally {
      setSavingPOInSystem(false);
    }
  };

  const handleAddProductToPO = (product: Product) => {
    const existing = poItems.find(item => item.product.id === product.id);
    const unitCost = product.costPrice && product.costPrice > 0 ? product.costPrice : (product.unitPrice * 0.88);
    if (existing) {
      setPoItems(poItems.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setPoItems([...poItems, { product, quantity: 1, costPrice: unitCost }]);
    }
    toast.success(`Añadido a la orden: ${product.name}`);
  };

  const handleUpdatePOQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setPoItems(poItems.filter(item => item.product.id !== productId));
    } else {
      setPoItems(poItems.map(item => item.product.id === productId ? { ...item, quantity } : item));
    }
  };

  const handleUpdatePOCost = (productId: string, costPrice: number) => {
    setPoItems(poItems.map(item => item.product.id === productId ? { ...item, costPrice } : item));
  };

  const handleRemoveFromPO = (productId: string) => {
    setPoItems(poItems.filter(item => item.product.id !== productId));
  };

  const handleExecutePurchaseOrderPDF = async (action: 'view' | 'download' | 'whatsapp') => {
    if (poItems.length === 0) {
      toast.error('Debe agregar al menos un producto a la orden de compra');
      return;
    }

    setGeneratingPO(true);
    try {
      const token = localStorage.getItem('token');
      const supplierName = poSupplierName.trim() || 'SOLO MAYOR';

      const payload = {
        supplierName,
        supplierTaxId: poSupplierTaxId.trim() || undefined,
        supplierPhone: poSupplierPhone.trim() || undefined,
        deliveryAddress: poDeliveryAddress.trim() || undefined,
        expectedDate: poExpectedDate.trim() || undefined,
        paymentTerms: poPaymentTerms.trim() || undefined,
        projectId: poProjectId || selectedProject || undefined,
        tasaOverride: exchangeRate?.usdToBs || undefined,
        notes: poNotes.trim() || undefined,
        items: poItems.map(item => ({
          sku: item.product.sku || undefined,
          name: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit || 'UNIDAD',
          costPrice: item.costPrice,
          empaqueCantidad: item.product.empaqueCantidad || undefined,
          medidas: item.product.medidas || undefined,
        }))
      };

      const response = await fetch('/backend-api/api/pos/purchase-order-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error al generar la orden de compra en PDF');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      if (action === 'download') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `OrdenCompra_${supplierName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('📥 Orden de compra descargada');
      } else if (action === 'whatsapp') {
        const phoneClean = (poSupplierPhone || '').replace(/[^0-9]/g, '');
        const totalPOCost = poItems.reduce((acc, item) => acc + (item.costPrice * item.quantity), 0);
        const textMsg = `Estimados *${supplierName}*, adjuntamos nuestra *Orden de Compra Formal* con ${poItems.length} renglones por un total de *$${totalPOCost.toFixed(2)} USD*. Favor confirmar disponibilidad para despacho.`;
        const waUrl = phoneClean 
          ? `https://wa.me/${phoneClean.startsWith('58') ? phoneClean : '58' + phoneClean.replace(/^0+/, '')}?text=${encodeURIComponent(textMsg)}`
          : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
        
        window.open(waUrl, '_blank');
        window.open(blobUrl, '_blank');
        toast.success('📲 Abriendo WhatsApp y Orden');
      } else {
        window.open(blobUrl, '_blank');
        toast.success('👁️ Abriendo Orden de Compra');
      }

      setShowPurchaseOrderModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir orden de compra');
    } finally {
      setGeneratingPO(false);
    }
  };

  // Obtener la lista de divisiones únicas de los productos cargados
  const divisionsList = Array.from(new Set(products.map(p => p.division).filter(Boolean)));

  // Filtrar productos por división localmente
  const filteredProducts = products.filter(p => {
    if (selectedDivision && p.division !== selectedDivision) return false;
    return true;
  });

  // Calcular métricas agregadas del inventario actual
  let totalCostVal = 0;
  let totalSaleVal = 0;
  const usdToBs = exchangeRate ? (exchangeRate.usdToBs || 1) : 1;

  filteredProducts.forEach(p => {
    // Solo contemplar productos activos, aptos para la venta (isActive !== false y forSale !== false)
    if (p.isActive === false || p.forSale === false) return;

    const qty = p.stock || 0;
    if (qty <= 0) return;

    let cost = (p.costPrice || 0) + (p.packagingCost || 0);
    let price = p.unitPrice || 0;

    if (p.currency === 'BS') {
      cost = cost / usdToBs;
      price = price / usdToBs;
    }

    totalCostVal += qty * cost;
    totalSaleVal += qty * price;
  });

  const projectedProfitVal = totalSaleVal - totalCostVal;
  const profitMarginVal = totalSaleVal > 0 ? (projectedProfitVal / totalSaleVal) * 100 : 0;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* 1. Header (Título) */}
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

      {/* 2. Filtros de Proyectos y Divisiones */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Filter size={18} className="text-slate-400 shrink-0" />
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-xs font-semibold text-slate-700 transition-all"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">Todos los Proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Filter size={18} className="text-slate-400 shrink-0" />
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none text-xs font-semibold text-slate-700 transition-all"
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
          >
            <option value="">Todos los Grupos (Divisiones)</option>
            {divisionsList.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Botones de Acción */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button 
          onClick={() => setShowPdfModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all shadow-sm font-semibold text-xs cursor-pointer"
          title="Generar e imprimir Lista de Precios en PDF"
        >
          <FileText size={16} className="text-emerald-400" />
          Lista de Precios (PDF)
        </button>

        <button 
          onClick={() => openPurchaseOrderModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition-all shadow-sm font-semibold text-xs cursor-pointer"
          title="Emitir Orden de Compra formal a Proveedores"
        >
          <Truck size={16} className="text-blue-300" />
          Orden de Compra (OC)
        </button>

        <button 
          onClick={() => openTransferModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-sm font-semibold text-xs cursor-pointer"
          title="Traspasar inventario entre proyectos"
        >
          <ArrowRightLeft size={16} />
          Traspaso de Almacén
        </button>

        <button 
          onClick={syncBot}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm font-semibold text-xs cursor-pointer"
        >
          <RefreshCw size={16} />
          Sincronizar Bot
        </button>

        <label 
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm font-semibold text-xs cursor-pointer"
        >
          <Upload size={16} />
          Importar Costos
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            onChange={handleJsonUpload}
          />
        </label>

        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm font-semibold text-xs cursor-pointer"
        >
          <Plus size={16} />
          Nuevo Producto
        </button>
      </div>

      {/* 4. Buscador de Productos */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o SKU..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent outline-none transition-all text-xs font-semibold text-slate-800 placeholder:text-slate-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Resumen de Inventario (Utilidades) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Costo Total */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Costo de Inventario (Costo + Empaque)</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(totalCostVal)}
            </h3>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Equivale a {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(totalCostVal * usdToBs)} (Tasa: {usdToBs.toFixed(2)})
          </div>
        </div>

        {/* Precio Venta Total */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor de Venta Estimado</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-2">
              {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(totalSaleVal)}
            </h3>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Equivale a {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(totalSaleVal * usdToBs)}
          </div>
        </div>

        {/* Utilidad Proyectada */}
        <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Utilidad Proyectada</p>
            <h3 className="text-2xl font-bold text-emerald-800 mt-2">
              {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(projectedProfitVal)}
            </h3>
          </div>
          <div className="text-xs text-emerald-600/80 mt-2">
            Ganancia al vender todo el stock
          </div>
        </div>

        {/* Margen */}
        <div className="bg-blue-50 p-5 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Margen de Ganancia Promedio</p>
            <h3 className="text-2xl font-bold text-blue-800 mt-2">
              {profitMarginVal.toFixed(2)}%
            </h3>
          </div>
          <div className="text-xs text-blue-600/80 mt-2">
            Sobre valor de venta
          </div>
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
              ) : sortProducts(filteredProducts).length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">No se encontraron productos</td></tr>
              ) : (
                sortProducts(filteredProducts).map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{product.name}</span>
                        {product.division && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded">
                            {product.division}
                          </span>
                        )}
                      </div>
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
                          onClick={() => openTransferModal(product)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Traspasar Inventario a otro proyecto"
                        >
                          <ArrowRightLeft size={16} />
                        </button>
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grupo de Producto / División</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none mb-2"
                  value={standardDivisions.includes(formData.division || '') ? (formData.division || '') : 'custom'}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setFormData({...formData, division: ''});
                    } else {
                      setFormData({...formData, division: val});
                    }
                  }}
                >
                  <option value="Aludra Terra (Agro)">Aludra Terra (Agro)</option>
                  <option value="Aludra Link (Empaques)">Aludra Link (Empaques)</option>
                  <option value="Aludra Link (Ferretería)">Aludra Link (Ferretería)</option>
                  <option value="Aludra Link (Demarcación)">Aludra Link (Demarcación)</option>
                  <option value="FERRETERIA">FERRETERIA</option>
                  <option value="Cotización Bobinas">Cotización Bobinas</option>
                  <option value="custom">Otro (Personalizado...)</option>
                </select>
                
                {(!standardDivisions.includes(formData.division || '') || formData.division === '') && (
                  <input 
                    type="text"
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.division || ''}
                    onChange={e => setFormData({...formData, division: e.target.value})}
                    placeholder="Escribe el nombre del grupo de producto personalizado"
                  />
                )}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo Unitario (Compra/Prod.)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full border border-slate-200 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.costPrice || 0}
                      onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {formData.currency === 'BS' ? 'Bs' : '$'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Costo Embalaje/Mano Obra</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full border border-slate-200 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.packagingCost || 0}
                      onChange={e => setFormData({...formData, packagingCost: parseFloat(e.target.value) || 0})}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {formData.currency === 'BS' ? 'Bs' : '$'}
                    </span>
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

                <label className="block text-sm font-medium text-slate-700 mb-2">Dimensiones del Producto Individual (cm)</label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">Largo</span>
                      <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.largoCm || 0}
                        onChange={e => setFormData({...formData, largoCm: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">Ancho</span>
                      <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.anchoCm || 0}
                        onChange={e => setFormData({...formData, anchoCm: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-8">Alto</span>
                      <input 
                        type="number" 
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.altoCm || 0}
                        onChange={e => setFormData({...formData, altoCm: parseFloat(e.target.value) || 0})}
                      />
                    </div>
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

      {/* Modal de Traspaso de Almacén entre Proyectos */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-2 font-bold text-base">
                <ArrowRightLeft className="text-amber-400" size={20} />
                Traspaso de Almacén entre Proyectos
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {/* Producto Selección */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Producto a Traspasar *</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                  value={transferProduct?.id || ''}
                  onChange={(e) => {
                    const p = products.find(prod => prod.id === e.target.value);
                    if (p) {
                      setTransferProduct(p);
                      setTransferQuantity(p.stock > 0 ? 1 : 0);
                    }
                  }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {p.stock} {p.unit || 'u'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proyecto Origen Display */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center justify-between text-xs text-amber-900 font-medium">
                <div>
                  <span className="text-amber-700 block text-[10px] uppercase font-bold">Proyecto Origen</span>
                  {projects.find(proj => proj.id === transferProduct?.projectId)?.name || 'Sin Proyecto (Global)'}
                </div>
                <div className="text-right">
                  <span className="text-amber-700 block text-[10px] uppercase font-bold">Disponible</span>
                  <span className="font-bold text-amber-800">{transferProduct?.stock || 0} {transferProduct?.unit || 'u'}</span>
                </div>
              </div>

              {/* Proyecto Destino Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Proyecto Destino (Receptor) *</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                  value={transferTargetProjectId}
                  onChange={(e) => setTransferTargetProjectId(e.target.value)}
                >
                  <option value="">-- Selecciona el proyecto de destino --</option>
                  {projects.filter(proj => proj.id !== transferProduct?.projectId).map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                  ))}
                </select>
              </div>

              {/* Cantidad a Traspasar */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Cantidad a Traspasar *</label>
                <input 
                  type="number"
                  min="1"
                  max={transferProduct?.stock || 0}
                  step="1"
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-800"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Notas u Observaciones */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Motivo / Notas del Traspaso</label>
                <textarea 
                  rows={2}
                  placeholder="Ej. Reasignación de inventario para orden urgente..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExecuteTransfer}
                disabled={transferring}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-2"
              >
                <ArrowRightLeft size={16} />
                {transferring ? 'Procesando...' : 'Confirmar Traspaso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lista de Precios PDF */}
      {showPdfModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowPdfModal(false); }}
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 font-bold shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">Exportar Lista de Precios en PDF</h2>
                  <p className="text-[11px] text-slate-500">Mismo diseño e imagen corporativa que el Bot de WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="space-y-4 text-xs sm:text-sm text-slate-700 overflow-y-auto flex-1 py-3 pr-1">
              {/* Porcentaje de Incremento o Descuento */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Porcentaje de Incremento o Descuento (%):
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    step="0.5"
                    value={pdfAdjustmentPercent}
                    onChange={(e) => setPdfAdjustmentPercent(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 15 para +15% o -10 para -10%"
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 font-extrabold">%</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400 font-semibold">Presets de Flete / Despacho:</span>
                  <button
                    type="button"
                    onClick={() => setPdfAdjustmentPercent(0)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${pdfAdjustmentPercent === 0 ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    0% (Base Fábrica)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfAdjustmentPercent(5)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${pdfAdjustmentPercent === 5 ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    +5% (Aragua)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfAdjustmentPercent(12)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${pdfAdjustmentPercent === 12 ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    +12% (Caracas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfAdjustmentPercent(15)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${pdfAdjustmentPercent === 15 ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    +15% (Valencia / Estándar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfAdjustmentPercent(18)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border ${pdfAdjustmentPercent === 18 ? 'bg-emerald-100 border-emerald-600 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                  >
                    +18% (Lara)
                  </button>
                </div>
                <p className="text-[11px] mt-1.5 font-medium">
                  {pdfAdjustmentPercent > 0 && <span className="text-emerald-600 font-bold">↑ Incremento del +{pdfAdjustmentPercent}% aplicado a todos los precios de venta</span>}
                  {pdfAdjustmentPercent < 0 && <span className="text-amber-600 font-bold">↓ Descuento del {pdfAdjustmentPercent}% aplicado a todos los precios de venta</span>}
                  {pdfAdjustmentPercent === 0 && <span className="text-slate-500">Sin variación. Se usarán los precios base guardados.</span>}
                </p>
              </div>

              {/* Filtro por Proyecto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Filtrar Productos:
                </label>
                <select 
                  value={pdfSelectedProject}
                  onChange={(e) => setPdfSelectedProject(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-semibold outline-none"
                >
                  <option value="all">📦 Todos los Productos para la Venta (forSale: true)</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>📁 Proyecto: {proj.name}</option>
                  ))}
                </select>
              </div>

              {/* Filtro de Inclusión de Productos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center justify-between">
                  <span>Incluir Productos (Palabras Clave):</span>
                  <span className="text-[10px] text-emerald-600 font-bold lowercase">opcional</span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={pdfIncludeKeywords}
                    onChange={(e) => setPdfIncludeKeywords(e.target.value)}
                    placeholder="Ej: tuberia, caja, abrazadera"
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-semibold outline-none text-xs"
                  />
                  {pdfIncludeKeywords && (
                    <button 
                      type="button" 
                      onClick={() => setPdfIncludeKeywords('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      title="Limpiar inclusión"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Incluye <span className="font-semibold text-emerald-700">solo los productos</span> que contengan alguna de estas palabras clave (ej: <span className="font-semibold text-emerald-700">tuberia, caja, abrazadera</span>).
                </p>
              </div>

              {/* Filtro de Exclusión de Productos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center justify-between">
                  <span>Excluir Productos (Palabras Clave):</span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase">opcional</span>
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={pdfExcludeKeywords}
                    onChange={(e) => setPdfExcludeKeywords(e.target.value)}
                    placeholder="Ej: cajas, carton, recicladas"
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 font-semibold outline-none text-xs"
                  />
                  {pdfExcludeKeywords && (
                    <button 
                      type="button" 
                      onClick={() => setPdfExcludeKeywords('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      title="Limpiar exclusión"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Excluye cualquier producto por su nombre o característica (ej: <span className="font-semibold text-amber-700">cajas, cartón</span>).
                </p>
              </div>

              {/* Seleccionar Tasa de Cambio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tasa de Cambio Referencial Guardada:
                </label>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  {/* Opción BCV USD */}
                  <button
                    type="button"
                    onClick={() => {
                      setPdfRateMode('BCV');
                      const bcvVal = ratesBySource.BCV || exchangeRate?.usdToBs;
                      if (bcvVal) setPdfTasaOverride(bcvVal.toString());
                      else setPdfTasaOverride('');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer ${
                      pdfRateMode === 'BCV'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏛️ BCV (USD)</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Bs. {ratesBySource.BCV ? ratesBySource.BCV.toFixed(2) : (exchangeRate?.usdToBs ? exchangeRate.usdToBs.toFixed(2) : '771.07')}
                    </span>
                  </button>

                  {/* Opción BCV EUR */}
                  <button
                    type="button"
                    onClick={() => {
                      setPdfRateMode('EUR');
                      const eurRate = ratesBySource.EUR || exchangeRate?.eurToBs;
                      if (eurRate) setPdfTasaOverride(eurRate.toString());
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer ${
                      pdfRateMode === 'EUR'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>💶 BCV (EURO)</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Bs. {ratesBySource.EUR ? ratesBySource.EUR.toFixed(2) : (exchangeRate?.eurToBs ? exchangeRate.eurToBs.toFixed(2) : 'N/A')}
                    </span>
                  </button>

                  {/* Opción Paralelo / Binance */}
                  <button
                    type="button"
                    onClick={() => {
                      setPdfRateMode('BINANCE');
                      if (ratesBySource.BINANCE) setPdfTasaOverride(ratesBySource.BINANCE.toString());
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer ${
                      pdfRateMode === 'BINANCE'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>⚡ Paralelo / Binance</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {ratesBySource.BINANCE ? `Bs. ${ratesBySource.BINANCE.toFixed(2)}` : 'N/A'}
                    </span>
                  </button>

                  {/* Opción Tasa Guardada FINK */}
                  <button
                    type="button"
                    onClick={() => {
                      setPdfRateMode('CUSTOM');
                      if (ratesBySource.CUSTOM) setPdfTasaOverride(ratesBySource.CUSTOM.toString());
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer ${
                      pdfRateMode === 'CUSTOM'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>💼 Guardada FINK</span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {ratesBySource.CUSTOM ? `Bs. ${ratesBySource.CUSTOM.toFixed(2)}` : 'Tasa Dashboard'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer (Pinned Actions) */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleGeneratePriceListPDF('view')}
                disabled={pdfGenerating}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
              >
                👁️ {pdfGenerating ? 'Generando PDF...' : 'Ver / Imprimir Lista PDF'}
              </button>
              <button
                type="button"
                onClick={() => handleGeneratePriceListPDF('download')}
                disabled={pdfGenerating}
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer active:scale-95"
              >
                ⬇️ {pdfGenerating ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EMITIR ORDEN DE COMPRA A PROVEEDORES */}
      {showPurchaseOrderModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowPurchaseOrderModal(false); }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-5 space-y-4 text-white shadow-2xl max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center font-bold shrink-0">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Emitir Orden de Compra a Proveedor</h3>
                  <p className="text-[11px] text-slate-400">Genera la orden formal a Costo Real para reposición de stock</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPurchaseOrderModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              
              {/* Datos del Proveedor y Despacho */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <span className="font-bold text-blue-400 text-xs flex items-center gap-1.5">
                  <Truck size={14} /> 🏢 Datos del Proveedor y Condiciones de Entrega:
                </span>

                {/* Selectores desde Maestro de Proveedores y Proyecto */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-7">
                    {(() => {
                      const filtered = suppliers.filter(s => {
                        if (!supplierSearch) return true;
                        const term = supplierSearch.toLowerCase();
                        const nameMatch = (s.name || '').toLowerCase().includes(term);
                        const taxMatch = (s.taxId || '').toLowerCase().includes(term);
                        const phoneMatch = (s.phone || '').toLowerCase().includes(term);
                        return nameMatch || taxMatch || phoneMatch;
                      }).sort((a, b) => {
                        if (poProjectId) {
                          if (a.projectId === poProjectId && b.projectId !== poProjectId) return -1;
                          if (b.projectId === poProjectId && a.projectId !== poProjectId) return 1;
                        }
                        return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
                      });

                      return (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] text-blue-300 font-bold">
                              🏢 Proveedor desde el Maestro de Contactos:
                            </label>
                            <span className="text-[10px] text-slate-400">
                              ({filtered.length} disponibles)
                            </span>
                          </div>

                          {/* Input de Búsqueda Rápida de Proveedor */}
                          <div className="mb-1.5 relative">
                            <input
                              type="text"
                              placeholder="🔍 Filtrar proveedor (ej. SERDEINCA, RIF...)"
                              value={supplierSearch}
                              onChange={(e) => setSupplierSearch(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                            />
                            {supplierSearch && (
                              <button
                                type="button"
                                onClick={() => setSupplierSearch('')}
                                className="absolute right-2 top-1 text-slate-400 hover:text-white text-xs"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          <select
                            value={selectedSupplierId}
                            onChange={(e) => handleSelectSupplier(e.target.value)}
                            className="w-full bg-slate-900 border border-blue-500/60 rounded-xl p-2 text-white font-semibold text-xs outline-none focus:ring-2 focus:ring-blue-400"
                          >
                            <option value="">-- Seleccionar Proveedor ({filtered.length}) o escribir abajo --</option>
                            {filtered.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} {s.taxId ? `(${s.taxId})` : ''} {s.project?.name ? `[${s.project.name}]` : ''}
                              </option>
                            ))}
                          </select>
                        </>
                      );
                    })()}
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">
                      📁 Proyecto Asignado a la Orden:
                    </label>
                    <select
                      value={poProjectId}
                      onChange={(e) => setPoProjectId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-semibold text-xs outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccione Proyecto...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Proveedor / Razón Social *</label>
                    <input
                      type="text"
                      value={poSupplierName}
                      onChange={(e) => setPoSupplierName(e.target.value)}
                      placeholder="Ej: SOLO MAYOR"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">RIF del Proveedor</label>
                    <input
                      type="text"
                      value={poSupplierTaxId}
                      onChange={(e) => setPoSupplierTaxId(e.target.value)}
                      placeholder="J-12345678-0"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="text"
                      value={poSupplierPhone}
                      onChange={(e) => setPoSupplierPhone(e.target.value)}
                      placeholder="0412-271-1859"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Lugar de Recepción</label>
                    <input
                      type="text"
                      value={poDeliveryAddress}
                      onChange={(e) => setPoDeliveryAddress(e.target.value)}
                      placeholder="Almacén Principal La Victoria"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Tiempo de Entrega</label>
                    <input
                      type="text"
                      value={poExpectedDate}
                      onChange={(e) => setPoExpectedDate(e.target.value)}
                      placeholder="Inmediata / 24-48 horas"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-300 font-bold mb-1">Condición de Pago</label>
                    <input
                      type="text"
                      value={poPaymentTerms}
                      onChange={(e) => setPoPaymentTerms(e.target.value)}
                      placeholder="Contado / Transferencia"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Búsqueda y Selección de Productos */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                
                {/* Columna Izquierda: Catálogo para agregar */}
                <div className="lg:col-span-5 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col h-[280px]">
                  <span className="font-bold text-slate-300 text-xs mb-2 block">🔍 Buscar y Agregar Productos:</span>
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={poSearch}
                      onChange={(e) => setPoSearch(e.target.value)}
                      placeholder="Buscar por nombre o SKU..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
                    {products
                      .filter(p => {
                        if (!poSearch) return true;
                        const s = poSearch.toLowerCase();
                        return p.name.toLowerCase().includes(s) || (p.sku && p.sku.toLowerCase().includes(s));
                      })
                      .slice(0, 30)
                      .map(prod => {
                        const unitCost = prod.costPrice && prod.costPrice > 0 ? prod.costPrice : (prod.unitPrice * 0.88);
                        const isAdded = poItems.some(i => i.product.id === prod.id);
                        return (
                          <div 
                            key={prod.id} 
                            onClick={() => handleAddProductToPO(prod)}
                            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isAdded 
                                ? 'bg-blue-950/40 border-blue-700/60 text-blue-200' 
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-850'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-xs truncate">{prod.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                SKU: {prod.sku || 'N/A'} | Costo: <span className="text-blue-400 font-bold">${unitCost.toFixed(2)}</span>
                              </p>
                            </div>
                            <button
                              type="button"
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] shrink-0"
                            >
                              {isAdded ? '➕ +' : '➕ Pedir'}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Columna Derecha: Renglones en la Orden de Compra */}
                <div className="lg:col-span-7 bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col h-[280px]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-blue-400 text-xs">
                      📋 Renglones a Solicitar ({poItems.length}):
                    </span>
                    {poItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPoItems([])}
                        className="text-[10px] text-red-400 hover:underline font-bold"
                      >
                        Vaciar lista
                      </button>
                    )}
                  </div>

                  {poItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
                      <Truck size={32} className="mb-2 opacity-30" />
                      <span>Haz clic en los productos a la izquierda para agregarlos a la orden</span>
                    </div>
                  ) : (
                    <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                      {poItems.map((item, idx) => {
                        const rowTotal = item.costPrice * item.quantity;
                        return (
                          <div key={item.product.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs truncate text-white">{item.product.name}</p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                                <span>SKU: {item.product.sku || 'N/A'}</span>
                                <div className="flex items-center gap-1">
                                  <span>Costo: $</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.costPrice}
                                    onChange={(e) => handleUpdatePOCost(item.product.id, parseFloat(e.target.value) || 0)}
                                    className="w-16 bg-slate-950 border border-slate-700 rounded px-1 text-blue-400 font-bold text-[10px]"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Controles de Cantidad */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleUpdatePOQuantity(item.product.id, item.quantity - 1)}
                                className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdatePOQuantity(item.product.id, parseInt(e.target.value) || 1)}
                                className="w-12 text-center bg-slate-950 border border-slate-700 rounded text-white font-bold text-xs py-0.5"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdatePOQuantity(item.product.id, item.quantity + 1)}
                                className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                            </div>

                            {/* Subtotal y Eliminar */}
                            <div className="text-right shrink-0 min-w-[65px]">
                              <span className="font-extrabold text-xs text-blue-400 block">${rowTotal.toFixed(2)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromPO(item.product.id)}
                                className="text-[10px] text-red-400 hover:underline"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Barra de Totales */}
              {(() => {
                const totalCostUSD = poItems.reduce((acc, i) => acc + (i.costPrice * i.quantity), 0);
                const totalCostBS = totalCostUSD * (exchangeRate?.usdToBs || 1);
                return (
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Resumen de Orden</span>
                      <span className="text-xs font-bold text-slate-300 font-mono">
                        {poItems.length} renglones | {poItems.reduce((a, b) => a + b.quantity, 0)} unidades en total
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Costo Total de Compra</span>
                      <div className="text-base font-extrabold font-mono text-blue-400">${totalCostUSD.toFixed(2)} USD</div>
                      <div className="text-xs font-bold font-mono text-amber-400">Bs. {totalCostBS.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-800 shrink-0 space-y-2.5">
              {/* Acciones Principales de Registro y Pago en el Sistema ERP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrderInSystem(true)}
                  disabled={savingPOInSystem || poGenerating || poItems.length === 0}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border border-emerald-400/30"
                >
                  💳 {savingPOInSystem ? 'Registrando...' : 'Guardar Orden y Cargar Pago / Abono'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrderInSystem(false)}
                  disabled={savingPOInSystem || poGenerating || poItems.length === 0}
                  className="py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 border border-blue-400/30"
                >
                  💾 {savingPOInSystem ? 'Guardando...' : 'Guardar Orden en el Sistema'}
                </button>
              </div>

              {/* Acciones Secundarias de Exportación PDF y WhatsApp */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExecutePurchaseOrderPDF('view')}
                  disabled={poGenerating || poItems.length === 0}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  👁️ {poGenerating ? 'Generando...' : 'Ver PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExecutePurchaseOrderPDF('download')}
                  disabled={poGenerating || poItems.length === 0}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  ⬇️ Descargar PDF
                </button>
                {poSupplierPhone && (
                  <button
                    type="button"
                    onClick={() => handleExecutePurchaseOrderPDF('whatsapp')}
                    disabled={poGenerating || poItems.length === 0}
                    className="flex-1 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    📲 WhatsApp
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

