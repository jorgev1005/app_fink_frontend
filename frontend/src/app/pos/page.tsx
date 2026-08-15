"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowLeft, 
  QrCode, 
  Send, 
  Printer, 
  CreditCard, 
  User, 
  UserPlus, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  X, 
  Calculator,
  RefreshCw,
  RotateCcw,
  Package
} from 'lucide-react';
import { posAPI, productsAPI, projectsAPI, accountsAPI, exchangeRatesAPI } from '@/lib/api';
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
  costPrice?: number;
  packagingCost?: number;
  division?: string;
  empaqueCantidad?: number;
  forSale?: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Account {
  id: string;
  name: string;
  code: string;
  type: string;
  subType: string;
  currency: string;
}

// Helpers defensivos para formateo numérico seguro
const safeNum = (v: any): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: any, decimals = 2): string => {
  return safeNum(v).toFixed(decimals);
};

class POSBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; errorMsg: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error?.message || 'Error cliente' };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("POS Component Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center text-3xl font-bold">
            ⚠️
          </div>
          <h2 className="text-xl font-extrabold text-white">Reinicio de la Caja POS</h2>
          <p className="text-xs text-slate-400 max-w-md">Se detectó una pequeña interrupción en la memoria de la sesión. Haz clic para recargar el punto de venta de forma limpia.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} /> Recargar Caja Registradora
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function POSComponent() {
  const router = useRouter();

  // Master States
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(764.35); // fallback tasa USD to BS
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart' | 'history'>('catalog');

  // Session State
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false);
  const [initialUsd, setInitialUsd] = useState(0);
  const [initialBs, setInitialBs] = useState(0);
  const [sessionNotes, setSessionNotes] = useState('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCurrency, setCartCurrency] = useState<'USD' | 'BS'>('USD');
  const [applyTax, setApplyTax] = useState<boolean>(false); // por defecto Sin IVA (Exento)
  
  // Customer State
  const [customerType, setCustomerType] = useState<'generic' | 'express'>('generic');
  const [expressCustomer, setExpressCustomer] = useState({ name: '', taxId: '', phone: '', email: '', address: '' });
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentEntries, setPaymentEntries] = useState<Array<{ method: string; currency: 'USD' | 'BS'; amount: number; accountId: string; reference: string }>>([]);
  const [cashReceivedUsd, setCashReceivedUsd] = useState<number>(0);
  const [cashReceivedBs, setCashReceivedBs] = useState<number>(0);
  const [processingSale, setProcessingSale] = useState(false);

  // Receipt Modal State
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Summary / Close Session Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  const [finalUsd, setFinalUsd] = useState(0);
  const [finalBs, setFinalBs] = useState(0);

  // Rate Override Modal State
  const [showRateModal, setShowRateModal] = useState(false);
  const [tempRate, setTempRate] = useState<number>(764.35);
  const [savingRate, setSavingRate] = useState(false);

  const handleSaveRate = async (saveToSystem: boolean) => {
    const newRate = safeNum(tempRate);
    if (newRate <= 0) {
      toast.error('La tasa de cambio debe ser mayor a 0');
      return;
    }
    setExchangeRate(newRate);

    if (saveToSystem) {
      setSavingRate(true);
      try {
        await exchangeRatesAPI.createCustom({
          usdToBs: newRate,
          eurToBs: newRate * 1.08,
          notes: 'Tasa personalizada establecida desde Caja POS'
        });
        toast.success(`Tasa de Bs. ${fmt(newRate)} guardada en el sistema`);
      } catch (err: any) {
        toast.error('Tasa aplicada al turno POS. Error al guardar en BD');
      } finally {
        setSavingRate(false);
      }
    } else {
      toast.success(`Tasa de Bs. ${fmt(newRate)} aplicada al turno actual`);
    }
    setShowRateModal(false);
  };

  // Load Initial Data
  useEffect(() => {
    initLoad();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProducts(selectedProjectId);
      checkActiveSession(selectedProjectId);
      loadAccounts(selectedProjectId);
    }
  }, [selectedProjectId, search]);

  const initLoad = async () => {
    try {
      const [projRes, rateRes] = await Promise.all([
        projectsAPI.getAll(),
        exchangeRatesAPI.getLatest()
      ]);
      const projList = Array.isArray(projRes?.data?.data) ? projRes.data.data : [];
      setProjects(projList);
      if (projList.length > 0) {
        setSelectedProjectId(projList[0].id);
      }
      if (rateRes?.data?.data?.usdToBs) {
        setExchangeRate(safeNum(rateRes.data.data.usdToBs) || 764.35);
      }
    } catch (err) {
      toast.error('Error al inicializar datos del POS');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (projId: string) => {
    try {
      const res = await productsAPI.getAll({ projectId: projId, search, limit: 500, forSale: true });
      const rawList: any[] = Array.isArray(res?.data?.data) ? res.data.data : [];
      // Solo mostrar productos con forSale = true (Para la Venta)
      const forSaleOnly = rawList.filter(p => p && p.forSale !== false);
      setProducts(forSaleOnly);
    } catch (err) {
      toast.error('Error al cargar catálogo de productos');
    }
  };

  const loadAccounts = async (projId: string) => {
    try {
      const res = await accountsAPI.getAll({ projectId: projId });
      const accList = Array.isArray(res?.data?.data) ? res.data.data : [];
      setAccounts(accList);
    } catch (err) {}
  };

  const checkActiveSession = async (projId: string) => {
    try {
      const res = await posAPI.getActiveSession(projId);
      setActiveSession(res?.data?.data || null);
    } catch (err) {}
  };

  // Open Session Handler
  const handleOpenSession = async () => {
    try {
      const res = await posAPI.openSession({
        projectId: selectedProjectId,
        initialBalanceUsd: initialUsd,
        initialBalanceBs: initialBs,
        notes: sessionNotes
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Turno de caja abierto');
        setActiveSession(res.data.data);
        setShowOpenSessionModal(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error al abrir caja');
    }
  };

  // Cart Functions
  const addToCart = (product: Product) => {
    if (safeNum(product.stock) <= 0) {
      toast.error(`Producto "${product.name}" sin stock disponible`);
      return;
    }

    const existingIndex = cart.findIndex(ci => ci.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > safeNum(product.stock)) {
        toast.error(`Stock máximo alcanzado (${product.stock} u)`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { product, quantity: 1, unitPrice: safeNum(product.unitPrice) }]);
    }
    toast.success(`Añadido: ${product.name}`);
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const updated = cart.map(item => {
      if (item.product.id === productId) {
        if (newQty > safeNum(item.product.stock)) {
          toast.error(`Stock máximo disponible: ${item.product.stock}`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    });
    setCart(updated);
  };

  const addPackageToCart = (product: Product, pkgSize?: number) => {
    const qtyToAdd = pkgSize && pkgSize > 0 ? pkgSize : (product.empaqueCantidad && product.empaqueCantidad > 0 ? product.empaqueCantidad : 12);
    if (safeNum(product.stock) <= 0) {
      toast.error(`Producto "${product.name}" sin stock disponible`);
      return;
    }

    const existingIndex = cart.findIndex(ci => ci.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      const targetQty = currentQty + qtyToAdd;
      if (targetQty > safeNum(product.stock)) {
        toast.error(`Stock máximo alcanzado (${product.stock} u)`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity = targetQty;
      setCart(updated);
    } else {
      const initialQty = Math.min(qtyToAdd, safeNum(product.stock));
      setCart([...cart, { product, quantity: initialQty, unitPrice: safeNum(product.unitPrice) }]);
    }
    toast.success(`Añadido empaque (+${qtyToAdd} u): ${product.name}`);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(ci => ci.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setPaymentEntries([]);
    setCashReceivedUsd(0);
    setCashReceivedBs(0);
    setCustomerType('generic');
    toast.success('🛒 Carrito de compras blanqueado (0)');
  };

  // Calculations
  const subtotalUSD = cart.reduce((acc, ci) => acc + (safeNum(ci.unitPrice) * safeNum(ci.quantity)), 0);
  const taxAmountUSD = applyTax ? subtotalUSD * 0.16 : 0;
  const totalUSD = subtotalUSD + taxAmountUSD;
  const totalBS = totalUSD * safeNum(exchangeRate);

  // Open Payment Modal
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('El carrito de compras está vacío');
      return;
    }

    const defaultAccount = accounts.find(a => a.type === 'ASSET' && (a.subType === 'CASH' || a.subType === 'BANK'))?.id || '';
    setPaymentEntries([
      { method: 'CASH', currency: 'USD', amount: totalUSD, accountId: defaultAccount, reference: '' }
    ]);
    setCashReceivedUsd(totalUSD);
    setCashReceivedBs(totalBS);
    setShowPaymentModal(true);
  };

  // Execute Sale Process
  const handleExecuteSale = async () => {
    setProcessingSale(true);
    try {
      const payload = {
        projectId: selectedProjectId,
        posSessionId: activeSession?.id || null,
        customer: customerType === 'express' ? expressCustomer : { name: 'Venta de Mostrador (Cliente Contado)', taxId: 'V-99999999' },
        items: cart.map(ci => ({
          productId: ci.product.id,
          name: ci.product.name,
          sku: ci.product.sku,
          quantity: ci.quantity,
          unitPrice: safeNum(ci.unitPrice),
          costPrice: safeNum(ci.product.costPrice)
        })),
        currency: cartCurrency,
        payments: paymentEntries,
        taxRate: applyTax ? 16 : 0
      };

      const res = await posAPI.processSale(payload);
      if (res.data.success) {
        toast.success(`Venta ${res.data.data.posCode} procesada exitosamente`);
        setLastCompletedSale({
          posCode: res.data.data.posCode,
          customerName: res.data.data.customerName,
          customerTaxId: res.data.data.customerTaxId,
          totalUSD,
          totalBS,
          items: [...cart],
          payments: [...paymentEntries],
          date: new Date().toLocaleString()
        });
        clearCart();
        setShowPaymentModal(false);
        setShowReceiptModal(true);
        loadProducts(selectedProjectId);
        if (activeSession) checkActiveSession(selectedProjectId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error al procesar la venta POS');
    } finally {
      setProcessingSale(false);
    }
  };

  // WhatsApp Share Generator
  const shareWhatsAppReceipt = () => {
    if (!lastCompletedSale) return;
    const phone = expressCustomer.phone ? expressCustomer.phone.replace(/[^0-9]/g, '') : '';
    const text = `🧾 *COMPROBANTE DE VENTA POS*\n\n` +
      `📌 *N° Recibo:* ${lastCompletedSale.posCode}\n` +
      `👤 *Cliente:* ${lastCompletedSale.customerName} (${lastCompletedSale.customerTaxId})\n` +
      `📅 *Fecha:* ${lastCompletedSale.date}\n\n` +
      `🛍️ *DETALLE DE COMPRA:*\n` +
      lastCompletedSale.items.map((i: any) => `• ${i.product.name} x${i.quantity} = $${fmt(safeNum(i.unitPrice) * safeNum(i.quantity))}`).join('\n') +
      `\n\n💵 *TOTAL COMPRA:* $${fmt(lastCompletedSale.totalUSD)} USD / Bs. ${fmt(lastCompletedSale.totalBS)}\n\n` +
      `¡Gracias por tu compra! ✨`;

    const waUrl = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  // Print Thermal Ticket (80mm Format)
  const printThermalTicket = () => {
    window.print();
  };

  // Close Session Summary
  const handleOpenCloseModal = async () => {
    if (!activeSession) return;
    try {
      const res = await posAPI.getSessionSummary(activeSession.id);
      setSessionSummary(res.data.data);
      setShowCloseModal(true);
    } catch (err) {
      toast.error('Error al obtener arqueo de caja');
    }
  };

  const handleExecuteCloseSession = async () => {
    if (!activeSession) return;
    try {
      const res = await posAPI.closeSession({
        sessionId: activeSession.id,
        finalBalanceUsd: finalUsd,
        finalBalanceBs: finalBs,
        notes: sessionNotes
      });
      if (res.data.success) {
        toast.success('Turno de caja cerrado exitosamente (Cierre Z)');
        setActiveSession(null);
        setShowCloseModal(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error al cerrar caja');
    }
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const divisionsList = Array.from(new Set(safeProducts.map(p => p?.division).filter(Boolean)));
  const filteredProducts = safeProducts.filter(p => !selectedDivision || p?.division === selectedDivision);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Mobile Navigation & Session Bar */}
      <header className="bg-slate-900 border-b border-slate-800 p-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <ArrowLeft size={20} className="text-slate-400" />
              </button>
              <div>
                <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                  <ShoppingCart className="text-emerald-400" size={22} />
                  FINK Express POS
                </h1>
                <p className="text-[11px] text-slate-400">Caja Registradora & Ventas Móviles</p>
              </div>
            </div>

            {/* Mobile Cart Badge */}
            <button 
              onClick={() => setActiveTab(activeTab === 'cart' ? 'catalog' : 'cart')} 
              className="sm:hidden relative p-2.5 bg-emerald-600 rounded-xl text-white font-bold flex items-center gap-1.5 shadow-lg"
            >
              <ShoppingCart size={18} />
              <span className="text-xs font-mono">{cart.length}</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping"></span>
              )}
            </button>
          </div>

          {/* Project & Session Status Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Project Select */}
            <select 
              className="bg-slate-800 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Tasa Ticker Interactivo */}
            <button 
              onClick={() => {
                setTempRate(exchangeRate);
                setShowRateModal(true);
              }}
              title="Haz clic para cambiar la tasa de cambio"
              className="bg-slate-800/80 border border-slate-700/60 hover:border-amber-500/60 px-3 py-1.5 rounded-xl text-[11px] text-slate-300 font-mono flex items-center gap-1.5 cursor-pointer transition-all group"
            >
              <span className="text-amber-400 font-bold">BCV/Tasa:</span> 
              <span className="text-white font-extrabold font-mono">Bs. {fmt(exchangeRate)}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-amber-400">✏️</span>
            </button>

            {/* Session Indicator */}
            {activeSession ? (
              <button 
                onClick={handleOpenCloseModal}
                className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Unlock size={14} className="text-emerald-400" /> Turno Abierto (Cierre Z)
              </button>
            ) : (
              <button 
                onClick={() => setShowOpenSessionModal(true)}
                className="bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Lock size={14} className="text-amber-400" /> Abrir Caja
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Responsive Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT PANEL: Catalog & Touch Product Selector */}
        <section className={`lg:col-span-7 flex flex-col space-y-3 ${activeTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Search & Division Pills */}
          <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por Nombre, SKU o escanear código..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Division Selector Filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              <button 
                onClick={() => setSelectedDivision('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${!selectedDivision ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                Todos
              </button>
              {divisionsList.map(div => (
                <button 
                  key={div}
                  onClick={() => setSelectedDivision(div!)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedDivision === div ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {div}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid List */}
          <div className="flex-1 overflow-y-auto max-h-[600px] grid grid-cols-2 sm:grid-cols-3 gap-2.5 pr-1">
            {filteredProducts.map(p => (
              <div 
                key={p.id}
                className="bg-slate-900 border border-slate-800/80 hover:border-emerald-500/50 p-3 rounded-2xl flex flex-col justify-between transition-all group"
              >
                <button 
                  onClick={() => addToCart(p)}
                  disabled={safeNum(p.stock) <= 0}
                  className="text-left w-full disabled:opacity-40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">{p.name}</span>
                    </div>
                    {p.sku && <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{p.sku}</span>}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-emerald-400 font-mono font-bold text-sm block">${fmt(p.unitPrice)}</span>
                      <span className="text-[9px] text-slate-500 block font-mono">Bs. {fmt(safeNum(p.unitPrice) * safeNum(exchangeRate))}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${safeNum(p.stock) > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-red-950 text-red-300 border border-red-500/30'}`}>
                      {p.stock} {p.unit || 'u'}
                    </span>
                  </div>
                </button>

                {/* Quick Add Package Button if available */}
                {p.empaqueCantidad && p.empaqueCantidad > 1 && safeNum(p.stock) > 0 && (
                  <button 
                    onClick={() => addPackageToCart(p)}
                    className="mt-2 w-full py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-mono font-bold flex items-center justify-center gap-1 transition-all"
                    title={`Añadir 1 Empaque completo (${p.empaqueCantidad} unidades)`}
                  >
                    <Package size={12} /> +Empaque ({p.empaqueCantidad}u)
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT PANEL: Shopping Cart & Instant Checkout */}
        <section className={`lg:col-span-5 flex flex-col bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4 shadow-xl ${activeTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
          
          {/* Customer Selection & Cart Actions Bar */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <User className="text-emerald-400 shrink-0" size={18} />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
                <span className="text-xs font-bold text-white truncate block">
                  {customerType === 'express' ? expressCustomer.name : 'Venta Mostrador'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button 
                onClick={() => setShowCustomerModal(true)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                title="Asignar Cliente Express"
              >
                <UserPlus size={13} /> Express
              </button>

              {cart.length > 0 && (
                <button 
                  onClick={clearCart}
                  className="px-2.5 py-1.5 bg-red-950/90 hover:bg-red-900 text-red-300 border border-red-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                  title="Vaciar todo el carrito y volver a cero"
                >
                  <RotateCcw size={13} /> Blanquear (0)
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-500 space-y-2">
                <ShoppingCart size={36} className="mx-auto text-slate-700" />
                <p className="text-xs font-medium">El carrito de compras está vacío</p>
                <p className="text-[10px] text-slate-600">Haz clic en los productos para agregarlos a la venta</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs text-white block truncate">{item.product.name}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-emerald-400 font-bold">${fmt(item.unitPrice)} USD</span>
                      {item.product.empaqueCantidad && item.product.empaqueCantidad > 1 && (
                        <span className="text-[9px] text-slate-400 font-mono">
                          (Emp: {item.product.empaqueCantidad}u)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    {/* Editable Qty Input & Controls */}
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button 
                        onClick={() => updateCartQty(item.product.id, item.quantity - 1)} 
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                        title="Restar 1"
                      >
                        <Minus size={12} />
                      </button>
                      
                      {/* Direct Numeric Input */}
                      <input 
                        type="number"
                        min="1"
                        max={item.product.stock || 9999}
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          updateCartQty(item.product.id, val);
                        }}
                        className="w-14 bg-slate-950 border border-slate-700 text-center font-mono font-extrabold text-xs text-emerald-400 rounded py-0.5 outline-none focus:ring-1 focus:ring-emerald-500"
                        title="Tipear cantidad exacta a mano"
                      />

                      <button 
                        onClick={() => updateCartQty(item.product.id, item.quantity + 1)} 
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                        title="Sumar 1"
                      >
                        <Plus size={12} />
                      </button>

                      {/* Package Button inside Cart */}
                      {item.product.empaqueCantidad && item.product.empaqueCantidad > 1 && (
                        <button 
                          onClick={() => updateCartQty(item.product.id, item.quantity + (item.product.empaqueCantidad || 1))}
                          className="px-1.5 py-0.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-mono font-bold whitespace-nowrap transition-all"
                          title={`Sumar 1 Empaque (${item.product.empaqueCantidad} unidades)`}
                        >
                          +{item.product.empaqueCantidad} Emp
                        </button>
                      )}
                    </div>

                    <span className="font-mono font-bold text-xs text-white min-w-14 text-right">
                      ${fmt(safeNum(item.unitPrice) * safeNum(item.quantity))}
                    </span>

                    <button 
                      onClick={() => removeFromCart(item.product.id)} 
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      title="Eliminar de la lista"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals Breakdown Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-2 font-mono">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal:</span>
              <span>${fmt(subtotalUSD)} USD</span>
            </div>

            {/* Checkbox Venta Sin IVA / Con IVA */}
            <div className="flex items-center justify-between py-1 px-2 bg-slate-900 rounded-lg border border-slate-800">
              <label htmlFor="taxToggle" className="text-xs font-semibold text-slate-300 flex items-center gap-2 cursor-pointer select-none">
                <input 
                  id="taxToggle"
                  type="checkbox"
                  checked={applyTax}
                  onChange={(e) => setApplyTax(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                />
                <span>Aplicar IVA (16%)</span>
              </label>
              <span className={`text-xs font-mono font-bold ${applyTax ? 'text-amber-400' : 'text-slate-400'}`}>
                {applyTax ? `$${fmt(taxAmountUSD)} USD` : 'Exento (Sin IVA)'}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-sm font-sans font-extrabold text-white">TOTAL COBRO:</span>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400 block">${fmt(totalUSD)} USD</span>
                <span className="text-xs text-slate-300 block font-normal">Bs. {fmt(totalBS)} VES</span>
              </div>
            </div>
          </div>

          {/* Process Checkout Button */}
          <button 
            onClick={openPaymentModal}
            disabled={cart.length === 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={18} />
            Procesar Cobro POS (${fmt(totalUSD)})
          </button>
        </section>

      </main>

      {/* MODAL 1: PROCESAR COBRO MULTI-MONEDA / QR */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-5 text-white shadow-2xl">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <CreditCard className="text-emerald-400" size={20} />
                Desglose de Cobro Multi-Moneda
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Total Banner */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total a Cobrar</span>
                <div className="text-xl font-mono font-bold text-emerald-400">${fmt(totalUSD)} USD</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Tasa de Cambio</span>
                <div className="text-xs font-mono text-amber-400 font-bold">Bs. {fmt(exchangeRate)}</div>
              </div>
            </div>

            {/* QR Dinámico de Pago Móvil */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-indigo-500/30 flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl">
                <QrCode className="text-slate-900" size={40} />
              </div>
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-indigo-300 block">📱 QR Dinámico de Pago Móvil</span>
                <span className="text-slate-300 block font-mono">RIF: J-501920310 | Banco Mercantil (0105)</span>
                <span className="text-slate-400 block font-mono">Teléfono: 0414-1234567 | Monto: <strong className="text-emerald-400">Bs. {fmt(totalBS)}</strong></span>
              </div>
            </div>

            {/* Payment Entry Form */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">Forma de Pago & Banco Receptor</label>

              {paymentEntries.map((pe, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Método</label>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-medium"
                        value={pe.method}
                        onChange={(e) => {
                          const updated = [...paymentEntries];
                          updated[idx].method = e.target.value;
                          setPaymentEntries(updated);
                        }}
                      >
                        <option value="CASH">Efectivo</option>
                        <option value="PAGO_MOVIL">Pago Móvil</option>
                        <option value="CARD">Punto de Venta / Tarjeta</option>
                        <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                        <option value="ZELLE">Zelle</option>
                        <option value="USDT">USDT / Binance Pay</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Moneda</label>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-medium"
                        value={pe.currency}
                        onChange={(e) => {
                          const updated = [...paymentEntries];
                          const cur = e.target.value as 'USD' | 'BS';
                          updated[idx].currency = cur;
                          updated[idx].amount = cur === 'USD' ? totalUSD : totalBS;
                          setPaymentEntries(updated);
                        }}
                      >
                        <option value="USD">USD ($)</option>
                        <option value="BS">VES (Bs.)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Monto Cobrado</label>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold"
                        value={pe.amount}
                        onChange={(e) => {
                          const updated = [...paymentEntries];
                          updated[idx].amount = parseFloat(e.target.value) || 0;
                          setPaymentEntries(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Últimos 4 Núm. Referencia</label>
                      <input 
                        type="text" 
                        placeholder="Ej: 4910"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                        value={pe.reference}
                        onChange={(e) => {
                          const updated = [...paymentEntries];
                          updated[idx].reference = e.target.value;
                          setPaymentEntries(updated);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Change Calculator */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="block text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Calculator size={12} className="text-amber-400" /> Calculadora de Vuelto / Cambio
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">Recibido Efectivo USD:</span>
                  <input 
                    type="number" 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
                    value={cashReceivedUsd}
                    onChange={(e) => setCashReceivedUsd(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">Vuelto a Entregar:</span>
                  <span className="text-amber-400 font-mono font-bold block text-sm">
                    ${fmt(Math.max(0, safeNum(cashReceivedUsd) - safeNum(totalUSD)))} USD
                  </span>
                  <span className="text-slate-400 text-[9px] block">
                    o Bs. {fmt(Math.max(0, safeNum(cashReceivedUsd) - safeNum(totalUSD)) * safeNum(exchangeRate))}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleExecuteSale}
              disabled={processingSale}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle2 size={18} />
              {processingSale ? 'Registrando Venta POS...' : 'Confirmar & Finalizar Venta'}
            </button>

          </div>
        </div>
      )}

      {/* MODAL 2: COMPROBANTE SIN PAPEL / WHATSAPP */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 text-white shadow-2xl text-center">
            
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
              <CheckCircle2 />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-white">¡Venta POS Registrada!</h3>
              <p className="text-xs text-slate-400 mt-1">Comprobante N° <strong className="text-emerald-400">{lastCompletedSale.posCode}</strong></p>
            </div>

            {/* Receipt Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-400 border-b border-slate-800 pb-2">
                <span>Cliente: {lastCompletedSale.customerName}</span>
                <span>{lastCompletedSale.customerTaxId}</span>
              </div>

              <div className="space-y-1 py-1">
                {lastCompletedSale.items.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-300 truncate max-w-[180px]">{it.product.name} x{it.quantity}</span>
                    <span className="text-white">${fmt(safeNum(it.unitPrice) * safeNum(it.quantity))}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span className="text-emerald-400">${fmt(lastCompletedSale.totalUSD)} USD</span>
              </div>
            </div>

            {/* Paperless WhatsApp Buttons */}
            <div className="space-y-2">
              <button 
                onClick={shareWhatsAppReceipt}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <Send size={16} /> 📲 Enviar Recibo Digital por WhatsApp
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={printThermalTicket}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Printer size={14} /> Ticket 80mm
                </button>
                <button 
                  onClick={() => setShowReceiptModal(false)}
                  className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={14} /> Nueva Venta
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: APERTURA / CIERRE Z DE CAJA */}
      {showOpenSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-white">
            <h3 className="font-extrabold text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <Unlock className="text-amber-400" size={20} />
              Apertura de Turno de Caja (Fondo Inicial)
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Fondo Inicial USD ($)</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-sm font-bold"
                  value={initialUsd}
                  onChange={(e) => setInitialUsd(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Fondo Inicial VES (Bs.)</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-sm font-bold"
                  value={initialBs}
                  onChange={(e) => setInitialBs(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Observación de Apertura</label>
                <input 
                  type="text" 
                  placeholder="Ej. Turno Mañana Mostrador..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowOpenSessionModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button onClick={handleOpenSession} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md">Confirmar Apertura</button>
            </div>
          </div>
        </div>
      )}

      {showCloseModal && sessionSummary && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-white">
            <h3 className="font-extrabold text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="text-amber-400" size={20} />
              Arqueo & Cierre de Turno de Caja (Cierre Z)
            </h3>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Ventas Realizadas:</span>
                <span className="text-white font-bold">{sessionSummary.countInvoices} ventas</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Ventas USD:</span>
                <span className="text-emerald-400 font-bold">${fmt(sessionSummary.totalSalesUsd)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Ventas VES:</span>
                <span className="text-emerald-400 font-bold">Bs. {fmt(sessionSummary.totalSalesBs)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Conteo Físico Final USD ($)</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-sm font-bold"
                  value={finalUsd}
                  onChange={(e) => setFinalUsd(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Conteo Físico Final VES (Bs.)</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-sm font-bold"
                  value={finalBs}
                  onChange={(e) => setFinalBs(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button onClick={handleExecuteCloseSession} className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-md">Cerrar Turno Definitivo</button>
            </div>
          </div>
        </div>
      )}

      {/* EXPRESS CUSTOMER MODAL */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-white">
            <h3 className="font-extrabold text-base flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserPlus className="text-emerald-400" size={20} />
              Registro de Cliente Express (5 Segundos)
            </h3>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Nombre / Razón Social *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Inversiones Los Andes C.A."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  value={expressCustomer.name}
                  onChange={(e) => setExpressCustomer({ ...expressCustomer, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-bold">RIF / C.I. *</label>
                <input 
                  type="text" 
                  placeholder="Ej: J-12345678-0 o V-18920192"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  value={expressCustomer.taxId}
                  onChange={(e) => setExpressCustomer({ ...expressCustomer, taxId: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Teléfono WhatsApp (Para enviar recibo)</label>
                <input 
                  type="text" 
                  placeholder="Ej: 04141234567"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  value={expressCustomer.phone}
                  onChange={(e) => setExpressCustomer({ ...expressCustomer, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCustomerModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Cancelar</button>
              <button 
                onClick={() => {
                  if (!expressCustomer.name || !expressCustomer.taxId) {
                    toast.error('Nombre y RIF/C.I. son requeridos');
                    return;
                  }
                  setCustomerType('express');
                  setShowCustomerModal(false);
                  toast.success(`Cliente express asignado: ${expressCustomer.name}`);
                }} 
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Asignar a la Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CAMBIO / AJUSTE DE TASA DE CAMBIO */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-amber-400">
                <Calculator size={20} />
                Ajustar Tasa de Cambio (VES / USD)
              </h3>
              <button onClick={() => setShowRateModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Tasa de Cambio Actual (Bs. por 1 USD)</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-lg font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
                  value={tempRate}
                  onChange={(e) => setTempRate(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1 font-mono">
                <p>💡 <strong className="text-slate-200">¿Cómo afecta a la caja?</strong></p>
                <p>• Todos los cálculos de ventas en Bolívares y Pago Móvil QR se recalcularán automáticamente con esta nueva tasa.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => handleSaveRate(true)}
                disabled={savingRate}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {savingRate ? 'Guardando...' : '💾 Guardar y Aplicar en Todo el Sistema'}
              </button>
              <button 
                onClick={() => handleSaveRate(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                ⚡ Usar Solo para este Turno de POS
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function POSPage() {
  return (
    <POSBoundary>
      <POSComponent />
    </POSBoundary>
  );
}
