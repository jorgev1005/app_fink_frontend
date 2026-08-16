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
  Package,
  Settings,
  Smartphone,
  Landmark,
  DollarSign,
  Bitcoin,
  Save,
  Copy,
  ExternalLink,
  ZoomIn,
  FileText,
  Truck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { posAPI, productsAPI, projectsAPI, accountsAPI, exchangeRatesAPI, contactsAPI } from '@/lib/api';
import { toast } from 'sonner';

const VENEZUELAN_BANKS = [
  { code: '0104', name: 'Banco Venezolano de Crédito (BVC)' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0134', name: 'Banesco Banco Universal' },
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0108', name: 'Banco Provincial (BBVA)' },
  { code: '0172', name: 'Bancamiga Banco Universal' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur Banco Universal' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0174', name: 'Banplus Banco Universal' },
  { code: '0175', name: 'Banco Bicentenario' },
];

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice: number;
  priceList?: number;
  priceBs?: number;
  currency: string;
  stock: number;
  unit?: string;
  taxable: boolean;
  taxRate: number;
  costPrice?: number;
  packagingCost?: number;
  division?: string;
  empaqueCantidad?: number;
  medidas?: string;
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
  paymentConfig?: any;
}

interface Account {
  id: string;
  name: string;
  code: string;
  type: string;
  subType: string;
  currency: string;
}

interface DestinationCity {
  id: string;
  name: string;
  adjustmentPercent: number; // % de recargo en lista para cubrir flete
  minOrderUsd: number;       // Compra mínima para flete gratis
  freightCostUsd: number;    // Costo estimado del camión/transporte
  description: string;
}

const DESTINATION_CITIES: DestinationCity[] = [
  { id: 'RETIRO', name: 'Retiro en Almacén / Tienda (La Victoria)', adjustmentPercent: 0, minOrderUsd: 0, freightCostUsd: 0, description: 'Sin recargo - Retiro directo por cuenta del cliente' },
  { id: 'LOCAL_ARAGUA', name: 'La Victoria / Cagua / Maracay (Eje Aragua)', adjustmentPercent: 5, minOrderUsd: 500, freightCostUsd: 25, description: '+5% en lista | Flete Gratis a partir de $500 USD' },
  { id: 'VALENCIA', name: 'Valencia / Guacara / Naguanagua (Carabobo)', adjustmentPercent: 15, minOrderUsd: 1000, freightCostUsd: 150, description: '+15% en lista | Flete Gratis a partir de $1,000 USD' },
  { id: 'CARACAS', name: 'Caracas / Miranda / Los Teques', adjustmentPercent: 12, minOrderUsd: 1000, freightCostUsd: 120, description: '+12% en lista | Flete Gratis a partir de $1,000 USD' },
  { id: 'BARQUISIMETO', name: 'Barquisimeto / Cabudare (Lara)', adjustmentPercent: 18, minOrderUsd: 1400, freightCostUsd: 250, description: '+18% en lista | Flete Gratis a partir de $1,400 USD' },
  { id: 'CUSTOM', name: 'Destino Personalizado / Otra Ciudad', adjustmentPercent: 15, minOrderUsd: 1000, freightCostUsd: 150, description: 'Configuración libre de % y compra mínima' },
];

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
  const [currentProject, setCurrentProject] = useState<any>(null);
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

  // QR Zoom Lightbox State
  const [showQrZoomModal, setShowQrZoomModal] = useState(false);
  const [zoomQrData, setZoomQrData] = useState<{
    title: string;
    subtitle?: string;
    qrValue?: string;
    qrImage?: string;
    amountText?: string;
    details?: { label: string; value: string }[];
  } | null>(null);

  const openPagoMovilZoom = () => {
    setZoomQrData({
      title: `📱 Pago Móvil - ${currentProject?.name || 'Proyecto'}`,
      subtitle: 'Escanea con la aplicación de tu banco o cámara',
      qrValue: editPaymentConfig.pagoMovil?.qrImageUrl ? undefined : `PAGOMOVIL:${editPaymentConfig.pagoMovil?.bankCode || '0105'}:${editPaymentConfig.pagoMovil?.taxId || 'J-501920310'}:${editPaymentConfig.pagoMovil?.phone || '04141234567'}:${Number(totalBS.toFixed(2))}`,
      qrImage: editPaymentConfig.pagoMovil?.qrImageUrl,
      amountText: `Bs. ${fmt(totalBS)}`,
      details: [
        { label: 'Banco', value: editPaymentConfig.pagoMovil?.bankName || 'Mercantil (0105)' },
        { label: 'RIF / Cédula', value: editPaymentConfig.pagoMovil?.taxId || 'J-501920310' },
        { label: 'Teléfono', value: editPaymentConfig.pagoMovil?.phone || '0414-1234567' },
        { label: 'Monto a Pagar', value: `Bs. ${fmt(totalBS)}` }
      ]
    });
    setShowQrZoomModal(true);
  };

  const openBinanceZoom = () => {
    setZoomQrData({
      title: `⚡ Binance Pay / USDT - ${currentProject?.name || 'Proyecto'}`,
      subtitle: 'Escanea desde la App de Binance o Billetera Cripto',
      qrValue: editPaymentConfig.binance?.qrImageUrl ? undefined : (editPaymentConfig.binance?.walletAddress || editPaymentConfig.binance?.payId || 'BINANCE_PAY'),
      qrImage: editPaymentConfig.binance?.qrImageUrl,
      amountText: `$${fmt(totalUSD)} USDT`,
      details: [
        { label: 'Binance Pay ID', value: editPaymentConfig.binance?.payId || '198273645' },
        { label: 'Billetera / Red', value: editPaymentConfig.binance?.walletAddress || 'Red TRC20 / BEP20' },
        { label: 'Monto a Pagar', value: `$${fmt(totalUSD)} USDT` }
      ]
    });
    setShowQrZoomModal(true);
  };

  // Project Payment Config Modal State
  const [showPaymentConfigModal, setShowPaymentConfigModal] = useState(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState(false);
  const [editPaymentConfig, setEditPaymentConfig] = useState<any>({
    pagoMovil: { bankCode: '0105', bankName: 'Banco Mercantil', phone: '', taxId: '', accountId: '', qrImageUrl: '' },
    transferencia: { bankName: 'Banco Mercantil', accountNumber: '', beneficiary: '', taxId: '', accountId: '' },
    zelle: { email: '', beneficiary: '', accountId: '' },
    binance: { payId: '', email: '', walletAddress: '', network: 'TRC20', accountId: '', qrImageUrl: '' },
    puntoVenta: { bankName: '', accountId: '' },
    efectivo: { accountIdUsd: '', accountIdBs: '' }
  });

  // Quotation & Freight Modal State
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [generatingQuotation, setGeneratingQuotation] = useState(false);
  const [quoteClientName, setQuoteClientName] = useState('');
  const [quoteClientTaxId, setQuoteClientTaxId] = useState('');
  const [quoteClientPhone, setQuoteClientPhone] = useState('');
  const [quoteClientEmail, setQuoteClientEmail] = useState('');
  const [quoteSaveContact, setQuoteSaveContact] = useState(true);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('RETIRO');
  const [customCityName, setCustomCityName] = useState<string>('');
  const [customAdjustmentPercent, setCustomAdjustmentPercent] = useState<number>(15);
  const [customMinOrder, setCustomMinOrder] = useState<number>(1000);

  // Purchase Order Modal State
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [generatingPO, setGeneratingPO] = useState(false);
  const [poSupplierName, setPoSupplierName] = useState('SOLO MAYOR');
  const [poSupplierTaxId, setPoSupplierTaxId] = useState('J-12345678-0');
  const [poSupplierPhone, setPoSupplierPhone] = useState('0412-271-1859');
  const [poDeliveryAddress, setPoDeliveryAddress] = useState('Almacén Principal La Victoria, Aragua');
  const [poExpectedDate, setPoExpectedDate] = useState('Inmediata / 24-48 horas');
  const [poPaymentTerms, setPoPaymentTerms] = useState('Contado / Según acuerdo comercial');
  const [poNotes, setPoNotes] = useState('');

  const openQuotationModal = () => {
    if (cart.length === 0) {
      toast.error('El carrito de compras está vacío');
      return;
    }

    if (customerType === 'express' && expressCustomer.name) {
      setQuoteClientName(expressCustomer.name || '');
      setQuoteClientTaxId(expressCustomer.taxId || '');
      setQuoteClientPhone(expressCustomer.phone || '');
      setQuoteClientEmail(expressCustomer.email || '');
    } else if (!quoteClientName) {
      setQuoteClientName('CLIENTE ESTIMADO');
    }

    setShowQuotationModal(true);
  };

  const handleExecuteQuotationPDF = async (action: 'view' | 'download' | 'whatsapp') => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
      return;
    }

    setGeneratingQuotation(true);
    try {
      const clientName = quoteClientName.trim() || 'CLIENTE ESTIMADO';
      const token = localStorage.getItem('token');

      // Guardar automáticamente en la agenda de contactos si está marcado
      if (quoteSaveContact && clientName && clientName.toUpperCase() !== 'CLIENTE ESTIMADO' && selectedProjectId) {
        try {
          await contactsAPI.create({
            projectId: selectedProjectId,
            name: clientName,
            taxId: quoteClientTaxId.trim() || undefined,
            phone: quoteClientPhone.trim() || undefined,
            email: quoteClientEmail.trim() || undefined,
            type: 'CUSTOMER'
          });
        } catch (e) {
          console.log('Nota: Contacto ya registrado:', e);
        }
      }

      const payload = {
        clientName,
        clientTaxId: quoteClientTaxId.trim() || undefined,
        clientPhone: quoteClientPhone.trim() || undefined,
        clientEmail: quoteClientEmail.trim() || undefined,
        destinationCity: selectedCityId === 'RETIRO' ? undefined : effectiveCityName,
        freightAdjustmentPercent: effectiveFreightPercent,
        minOrderForFreeFreight: effectiveMinOrder,
        freightCost: resolvedCity.freightCostUsd,
        isFreeFreight,
        projectId: selectedProjectId,
        tasaOverride: exchangeRate,
        notes: quoteNotes.trim() || undefined,
        items: cart.map(ci => ({
          sku: ci.product.sku || undefined,
          name: ci.product.name,
          quantity: ci.quantity,
          unit: ci.product.unit || 'UNIDAD',
          unitPrice: safeNum(ci.unitPrice || ci.product.unitPrice),
          priceList: safeNum(ci.product.priceList || ci.unitPrice),
          empaqueCantidad: ci.product.empaqueCantidad || undefined,
          medidas: ci.product.medidas || undefined,
        }))
      };

      const response = await fetch('/backend-api/api/pos/quotation-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Error al generar la cotización formal en PDF');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      if (action === 'download') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Cotizacion_${clientName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('📥 Cotización descargada exitosamente');
      } else if (action === 'whatsapp') {
        const phoneClean = (quoteClientPhone || '').replace(/[^0-9]/g, '');
        const freightBanner = selectedCityId !== 'RETIRO' 
          ? (isFreeFreight ? ` 🚚 *Flete GRATIS/Incluido hasta ${effectiveCityName}*` : ` 🚚 Entrega en ${effectiveCityName}`)
          : '';
        const textMsg = `Hola *${clientName}*, le enviamos su *Cotización Formal de ${currentProject?.name || 'Inversiones Lucem'}* con ${cart.length} productos por un total de *$${fmt(adjustedTotalUSD)} USD* (Bs. ${fmt(adjustedTotalUSD * exchangeRate)} a tasa BCV).${freightBanner}`;
        const waUrl = phoneClean 
          ? `https://wa.me/${phoneClean.startsWith('58') ? phoneClean : '58' + phoneClean.replace(/^0+/, '')}?text=${encodeURIComponent(textMsg)}`
          : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
        
        window.open(waUrl, '_blank');
        window.open(blobUrl, '_blank');
        toast.success('📲 Abriendo WhatsApp y Cotización');
      } else {
        window.open(blobUrl, '_blank');
        toast.success('👁️ Abriendo Cotización en PDF');
      }

      setShowQuotationModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Error al emitir cotización');
    } finally {
      setGeneratingQuotation(false);
    }
  };

  const openPurchaseOrderModal = () => {
    if (cart.length === 0) {
      toast.error('El carrito de compras está vacío para generar orden');
      return;
    }
    setShowPurchaseOrderModal(true);
  };

  const handleExecutePurchaseOrderPDF = async (action: 'view' | 'download' | 'whatsapp') => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío');
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
        projectId: selectedProjectId,
        tasaOverride: exchangeRate,
        notes: poNotes.trim() || undefined,
        items: cart.map(ci => ({
          sku: ci.product.sku || undefined,
          name: ci.product.name,
          quantity: ci.quantity,
          unit: ci.product.unit || 'UNIDAD',
          costPrice: safeNum(ci.product.costPrice || (ci.unitPrice * 0.88)), // Costo proveedor
          empaqueCantidad: ci.product.empaqueCantidad || undefined,
          medidas: ci.product.medidas || undefined,
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
        throw new Error('Error al generar la orden de compra');
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
        const totalPOCost = cart.reduce((acc, ci) => acc + ((ci.product.costPrice || (ci.unitPrice * 0.88)) * ci.quantity), 0);
        const textMsg = `Estimados *${supplierName}*, adjuntamos nuestra *Orden de Compra Formal* con ${cart.length} renglones por un total de *$${fmt(totalPOCost)} USD*. Favor confirmar disponibilidad para despacho.`;
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
          source: 'CUSTOM'
        });
        toast.success(`Tasa personalizada guardada en FINK: Bs. ${newRate.toFixed(2)}`);
      } catch (err: any) {
        toast.error('Error al guardar tasa en el servidor');
      } finally {
        setSavingRate(false);
      }
    } else {
      toast.info(`Tasa temporal aplicada al POS: Bs. ${newRate.toFixed(2)}`);
    }
    setShowRateModal(false);
  };

  useEffect(() => {
    initLoad();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProducts(selectedProjectId);
      checkActiveSession(selectedProjectId);
      loadAccounts(selectedProjectId);
      loadProjectDetails(selectedProjectId);
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
      const res = await productsAPI.getAll({ projectId: projId, search, limit: 3000, forSale: true });
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

  const loadProjectDetails = async (projId: string) => {
    try {
      const res = await projectsAPI.getById(projId);
      const proj = res?.data?.data || res?.data;
      setCurrentProject(proj);
      if (proj?.paymentConfig) {
        setEditPaymentConfig((prev: any) => ({
          ...prev,
          ...proj.paymentConfig,
          pagoMovil: { ...prev.pagoMovil, ...(proj.paymentConfig.pagoMovil || {}) },
          transferencia: { ...prev.transferencia, ...(proj.paymentConfig.transferencia || {}) },
          zelle: { ...prev.zelle, ...(proj.paymentConfig.zelle || {}) },
          binance: { ...prev.binance, ...(proj.paymentConfig.binance || {}) },
          puntoVenta: { ...prev.puntoVenta, ...(proj.paymentConfig.puntoVenta || {}) },
          efectivo: { ...prev.efectivo, ...(proj.paymentConfig.efectivo || {}) }
        }));
      }
    } catch (err) {
      console.error('Error loading project details', err);
    }
  };

  const checkActiveSession = async (projId: string) => {
    try {
      const res = await posAPI.getActiveSession(projId);
      setActiveSession(res?.data?.data || null);
    } catch (err) {}
  };

  const handleSavePaymentConfig = async () => {
    if (!selectedProjectId) return;
    setSavingPaymentConfig(true);
    try {
      await projectsAPI.update(selectedProjectId, {
        paymentConfig: editPaymentConfig
      });
      toast.success('Configuración de cobro guardada para este proyecto');
      await loadProjectDetails(selectedProjectId);
      setShowPaymentConfigModal(false);
    } catch (err: any) {
      toast.error('Error al guardar datos de cobro');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleQrUploadModal = (type: 'pagoMovil' | 'binance', file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setEditPaymentConfig((prev: any) => ({
        ...prev,
        [type]: {
          ...prev[type],
          qrImageUrl: base64
        }
      }));
      toast.success(`Imagen QR de ${type === 'pagoMovil' ? 'Pago Móvil' : 'Binance'} cargada`);
    };
    reader.readAsDataURL(file);
  };

  // Open Session Handler
  const handleOpenSession = async () => {
    try {
      const res = await posAPI.openSession({
        projectId: selectedProjectId,
        initialBalanceUsd: safeNum(initialUsd),
        initialBalanceBs: safeNum(initialBs),
        notes: sessionNotes
      });
      if (res.data.success) {
        toast.success('Caja y Turno de POS iniciados');
        setActiveSession(res.data.data);
        setShowOpenSessionModal(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Error al abrir caja');
    }
  };

  // Close Session Handler (Cierre Z)
  const handleOpenCloseModal = async () => {
    if (!activeSession) return;
    try {
      const res = await posAPI.getSessionSummary(activeSession.id);
      if (res.data.success) {
        setSessionSummary(res.data.data);
        setShowCloseModal(true);
      }
    } catch (err: any) {
      toast.error('Error al obtener arqueo de turno');
    }
  };

  const handleExecuteCloseSession = async () => {
    try {
      const res = await posAPI.closeSession({
        sessionId: activeSession.id,
        finalBalanceUsd: safeNum(finalUsd),
        finalBalanceBs: safeNum(finalBs),
        notes: sessionNotes
      });
      if (res.data.success) {
        toast.success('Turno de caja cerrado exitosamente (Cierre Z)');
        setActiveSession(null);
        setShowCloseModal(false);
        setSessionSummary(null);
      }
    } catch (err: any) {
      toast.error('Error al cerrar caja');
    }
  };

  // Cart Management: Permite facturación inmediata con o sin stock (Bajo Pedido / Pendiente por Verificar)
  const addToCart = (product: Product, qtyToAdd: number = 1) => {
    const existing = cart.find(ci => ci.product.id === product.id);
    if (existing) {
      const newQty = existing.quantity + qtyToAdd;
      setCart(cart.map(ci => ci.product.id === product.id ? { ...ci, quantity: newQty } : ci));
    } else {
      setCart([...cart, { product, quantity: qtyToAdd, unitPrice: safeNum(product.unitPrice) }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const item = cart.find(ci => ci.product.id === productId);
    if (!item) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(ci => ci.product.id === productId ? { ...ci, quantity } : ci));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(ci => ci.product.id !== productId));
  };

  const clearCart = (notify: any = true) => {
    const shouldNotify = typeof notify === 'boolean' ? notify : true;
    setCart([]);
    setPaymentEntries([]);
    setCashReceivedUsd(0);
    setCashReceivedBs(0);
    setCustomerType('generic');
    setExpressCustomer({ name: '', taxId: '', phone: '', email: '', address: '' });
    setApplyTax(false);
    setSearch('');
    setSelectedDivision('');
    setActiveTab('catalog');
    setShowPaymentModal(false);
    setShowCustomerModal(false);
    setShowQrZoomModal(false);
    if (shouldNotify) {
      toast.success('🛒 Carrito de compras blanqueado (0)');
    }
  };

  // Helper para resolver la cuenta contable de un método según el proyecto
  const resolveMethodAccount = (method: string, currency: string = 'USD') => {
    const pConfig = currentProject?.paymentConfig;
    if (!pConfig) {
      return accounts.find(a => a.type === 'ASSET' && (a.subType === 'CASH' || a.subType === 'BANK'))?.id || '';
    }
    const m = method.toUpperCase();
    if (m === 'PAGO_MOVIL') return pConfig.pagoMovil?.accountId || '';
    if (m === 'BANK_TRANSFER' || m === 'TRANSFERENCIA') return pConfig.transferencia?.accountId || '';
    if (m === 'ZELLE') return pConfig.zelle?.accountId || '';
    if (m === 'USDT' || m === 'BINANCE') return pConfig.binance?.accountId || '';
    if (m === 'CARD' || m === 'POS') return pConfig.puntoVenta?.accountId || '';
    if (m === 'CASH' || m === 'EFECTIVO') {
      return currency === 'USD' ? (pConfig.efectivo?.accountIdUsd || '') : (pConfig.efectivo?.accountIdBs || '');
    }
    return '';
  };

  // Calculations: Dual Pricing (Precio 2 USD Divisas vs. Precio 1 BCV Lista)
  const subtotalUSD = cart.reduce((acc, ci) => acc + (safeNum(ci.unitPrice) * safeNum(ci.quantity)), 0);
  const subtotalListUSD = cart.reduce((acc, ci) => {
    const listPrice = ci.product.priceList && ci.product.priceList > 0 ? ci.product.priceList : ci.unitPrice;
    return acc + (safeNum(listPrice) * safeNum(ci.quantity));
  }, 0);

  const taxAmountUSD = applyTax ? subtotalUSD * 0.16 : 0;
  const totalUSD = subtotalUSD + taxAmountUSD;

  const taxAmountListUSD = applyTax ? subtotalListUSD * 0.16 : 0;
  const totalListUSD = subtotalListUSD + taxAmountListUSD;
  const totalBS = totalListUSD * safeNum(exchangeRate);

  // Resolved Destination City & Freight Pricing Calculations
  const resolvedCity = DESTINATION_CITIES.find(c => c.id === selectedCityId) || DESTINATION_CITIES[0];
  const effectiveFreightPercent = selectedCityId === 'CUSTOM' ? customAdjustmentPercent : resolvedCity.adjustmentPercent;
  const effectiveMinOrder = selectedCityId === 'CUSTOM' ? customMinOrder : resolvedCity.minOrderUsd;
  const effectiveCityName = selectedCityId === 'CUSTOM' ? (customCityName.trim() || 'Destino Personalizado') : resolvedCity.name;
  
  // Total cotizado ajustado con recargo de flete
  const freightMultiplier = 1 + ((effectiveFreightPercent || 0) / 100);
  const adjustedTotalUSD = totalUSD * freightMultiplier;
  const isFreeFreight = selectedCityId === 'RETIRO' ? true : (adjustedTotalUSD >= effectiveMinOrder);
  const neededForFreeFreight = Math.max(0, effectiveMinOrder - adjustedTotalUSD);

  // Open Payment Modal
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('El carrito de compras está vacío');
      return;
    }

    const defaultAcc = resolveMethodAccount('CASH', 'USD');
    setPaymentEntries([
      { method: 'CASH', currency: 'USD', amount: Number(totalUSD.toFixed(2)), accountId: defaultAcc, reference: '' }
    ]);
    setCashReceivedUsd(Number(totalUSD.toFixed(2)));
    setCashReceivedBs(Number(totalBS.toFixed(2)));
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
        payments: paymentEntries.map(pe => ({
          ...pe,
          accountId: pe.accountId || resolveMethodAccount(pe.method, pe.currency)
        })),
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
        clearCart(false);
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

  // Divisions filter
  const divisions = Array.from(new Set(products.map(p => p.division).filter(Boolean)));
  const filteredProducts = products.filter(p => {
    const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase());
    const matchDivision = !selectedDivision || p.division === selectedDivision;
    return matchSearch && matchDivision;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-12 lg:pb-0">
      
      {/* HEADER / TOP BAR */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/dashboard')}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors"
              title="Volver al Dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  FINK POS <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">Caja Registradora</span>
                </h1>
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

            {/* BOTÓN ⚙️ DATOS DE COBRO DEL PROYECTO */}
            <button
              onClick={() => setShowPaymentConfigModal(true)}
              title="Configurar cuentas bancarias, Pago Móvil, Zelle y QR de este proyecto"
              className="bg-slate-800/90 border border-slate-700 hover:border-emerald-500/60 text-slate-200 hover:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Settings size={14} className="text-emerald-400" />
              <span>⚙️ Datos de Cobro</span>
            </button>

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
                className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Unlock size={14} className="text-emerald-400" /> Turno Abierto (Cierre Z)
              </button>
            ) : (
              <button 
                onClick={() => setShowOpenSessionModal(true)}
                className="bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
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
              <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
              <input 
                type="text"
                placeholder="Buscar por nombre, código SKU o categoría..."
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-2 text-slate-500 hover:text-white text-xs font-bold">✕</button>
              )}
            </div>

            {/* Division Filters */}
            {divisions.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                <button
                  onClick={() => setSelectedDivision('')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                    !selectedDivision ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Todos ({products.length})
                </button>
                {divisions.map((d: any) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDivision(d)}
                    className={`px-3 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                      selectedDivision === d ? 'bg-emerald-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 h-32 animate-pulse"></div>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-8 text-center space-y-2">
                <Package className="mx-auto text-slate-600" size={32} />
                <p className="text-sm font-semibold text-slate-400">No se encontraron productos disponibles</p>
                <p className="text-xs text-slate-500">Verifica los filtros de búsqueda o proyecto seleccionado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {filteredProducts.map(p => {
                  const inCartItem = cart.find(ci => ci.product.id === p.id);
                  const priceUsd = safeNum(p.unitPrice);
                  const priceBs = priceUsd * safeNum(exchangeRate);
                  const packQty = p.empaqueCantidad || 12;

                  return (
                    <div 
                      key={p.id}
                      onClick={() => addToCart(p, 1)}
                      className={`group relative p-3 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                        inCartItem 
                          ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/50' 
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex justify-between items-start gap-1">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          p.stock > 10 
                            ? 'bg-slate-800 text-slate-400' 
                            : p.stock > 0 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {p.stock > 0 ? `Stock: ${p.stock} ${p.unit || 'und'}` : '📦 Bajo Pedido'}
                        </span>
                        
                        {inCartItem && (
                          <span className="bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                            x{inCartItem.quantity}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="my-2">
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 line-clamp-2 transition-colors">
                          {p.name}
                        </h4>
                        {p.sku && <span className="text-[10px] font-mono text-slate-500 block">{p.sku}</span>}
                      </div>

                      {/* Pricing & Package quick add */}
                      <div className="border-t border-slate-800/80 pt-2 space-y-1.5">
                        <div className="flex flex-col gap-1">
                          {/* Precio 2: Divisas / Efectivo / USDT / Zelle */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-400 font-mono">${fmt(priceUsd)}</span>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/30">
                              💵 Divisas
                            </span>
                          </div>

                          {/* Precio 1: BCV / Pago Móvil / Transferencia */}
                          {p.priceList && p.priceList > 0 ? (
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                              <span className="text-slate-400 font-medium">BCV: ${fmt(p.priceList)}</span>
                              <span className="font-extrabold text-amber-300">Bs. {fmt(p.priceList * exchangeRate)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                              <span>Ref. BCV:</span>
                              <span className="font-bold text-slate-300">Bs. {fmt(priceBs)}</span>
                            </div>
                          )}
                        </div>

                        {/* Botón rápido para agregar por empaque */}
                        {packQty > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(p, packQty);
                            }}
                            className="w-full py-1 bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700/60 hover:border-emerald-500/40 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                          >
                            <Package size={11} /> +Empaque ({packQty})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL: Live Cart & Fast Checkout */}
        <section className={`lg:col-span-5 flex flex-col space-y-3 ${activeTab === 'catalog' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full space-y-4">
            
            {/* Cart Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-emerald-400" size={18} />
                <h3 className="font-extrabold text-sm text-white">Carrito de Compra</h3>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {cart.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* BOTÓN BLANQUEAR CARRITO */}
                {cart.length > 0 && (
                  <button 
                    onClick={clearCart} 
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="Blanquear Carrito (Volver a Cero)"
                  >
                    <RotateCcw size={13} /> Blanquear
                  </button>
                )}

                {/* Tax toggle */}
                <button
                  onClick={() => setApplyTax(!applyTax)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                    applyTax 
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {applyTax ? 'IVA (16%)' : 'Exento (0%)'}
                </button>
              </div>
            </div>

            {/* Customer Pill / Quick Select */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <User size={15} className="text-slate-400" />
                <div>
                  <span className="font-bold text-white block">
                    {customerType === 'express' ? expressCustomer.name || 'Cliente Express' : 'Venta de Mostrador'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {customerType === 'express' ? expressCustomer.taxId || 'Sin RIF' : 'Cliente Contado General'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowCustomerModal(true)}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <UserPlus size={13} /> Modificar
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-420px)] space-y-2 pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-600 space-y-2">
                  <ShoppingCart className="mx-auto text-slate-700" size={36} />
                  <p className="text-xs font-semibold">El carrito está vacío</p>
                  <p className="text-[11px] text-slate-500">Selecciona productos del catálogo para comenzar la venta</p>
                </div>
              ) : (
                cart.map(ci => {
                  const lineTotalUSD = safeNum(ci.unitPrice) * safeNum(ci.quantity);
                  const packQty = ci.product.empaqueCantidad || 12;

                  return (
                    <div key={ci.product.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="pr-2">
                          <div className="flex items-center gap-1.5">
                            <h5 className="text-xs font-bold text-white line-clamp-1">{ci.product.name}</h5>
                            {ci.product.stock <= 0 && (
                              <span className="text-[8px] font-extrabold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 whitespace-nowrap">
                                📦 Por Verificar
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">${fmt(ci.unitPrice)} c/u</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-400">${fmt(lineTotalUSD)}</span>
                          <span className="text-[9px] text-slate-500 font-mono block">Bs. {fmt(lineTotalUSD * safeNum(exchangeRate))}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        {/* Stepper con Input Directo */}
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => updateQuantity(ci.product.id, ci.quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs"
                          >
                            <Minus size={12} />
                          </button>
                          
                          {/* Entrada manual de cantidad completa */}
                          <input 
                            type="number"
                            min="1"
                            max={ci.product.stock}
                            value={ci.quantity}
                            onChange={(e) => updateQuantity(ci.product.id, parseInt(e.target.value) || 0)}
                            className="w-12 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono font-bold text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500"
                          />

                          <button 
                            onClick={() => updateQuantity(ci.product.id, ci.quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Modificar por empaque completo */}
                        {packQty > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(ci.product.id, ci.quantity + packQty)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-[10px] font-mono font-bold"
                              title={`Sumar 1 empaque (+${packQty})`}
                            >
                              +{packQty}
                            </button>
                          </div>
                        )}

                        <button 
                          onClick={() => removeFromCart(ci.product.id)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Totals Summary */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal Neto:</span>
                <span className="font-mono font-bold text-slate-200">${fmt(subtotalUSD)} USD</span>
              </div>
              {applyTax && (
                <div className="flex justify-between text-indigo-400">
                  <span>IVA (16%):</span>
                  <span className="font-mono font-bold">${fmt(taxAmountUSD)} USD</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-2 text-sm font-extrabold text-white">
                <span>TOTAL A PAGAR:</span>
                <div className="text-right">
                  <div className="text-emerald-400 font-mono text-base">${fmt(totalUSD)} USD</div>
                  <div className="text-[11px] text-amber-400 font-mono">Bs. {fmt(totalBS)}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-1 space-y-2">
              <button
                onClick={openPaymentModal}
                disabled={cart.length === 0}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs tracking-wider uppercase shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CreditCard size={16} />
                Cobrar & Despachar (${fmt(totalUSD)} USD)
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={openQuotationModal}
                  disabled={cart.length === 0}
                  className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-400 font-bold text-xs tracking-tight border border-slate-700/80 hover:border-emerald-500/50 shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate"
                  title="Emitir Cotización Formal PDF con Flete por Ciudad"
                >
                  <FileText size={14} className="shrink-0" />
                  <span>📄 Cotización PDF</span>
                </button>

                <button
                  type="button"
                  onClick={openPurchaseOrderModal}
                  disabled={cart.length === 0}
                  className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-blue-400 font-bold text-xs tracking-tight border border-slate-700/80 hover:border-blue-500/50 shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate"
                  title="Generar Orden de Compra formal para el Proveedor a costo"
                >
                  <Truck size={14} className="shrink-0" />
                  <span>📦 Orden Compra</span>
                </button>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* ========================================================================= */}
      {/* MODALES DEL POS */}
      {/* ========================================================================= */}

      {/* MODAL: COBRO MULTI-MONEDA & BANCO RECEPTOR */}
      {showPaymentModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentModal(false); }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-3 text-white shadow-2xl max-h-[92vh] flex flex-col my-auto">
            
            {/* Header Fijo */}
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-800 shrink-0">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2 text-emerald-400">
                <CreditCard className="text-emerald-400" size={18} />
                Desglose de Cobro Multi-Moneda
              </h3>
              <button 
                onClick={() => setShowPaymentModal(false)} 
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Volver / Cerrar ventana"
              >
                <X size={16} />
                <span className="hidden sm:inline">Volver</span>
              </button>
            </div>

            {/* Contenido con SCROLL Interno */}
            <div className="overflow-y-auto pr-1 space-y-3 flex-1">
              {/* Total Banner */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total a Cobrar</span>
                  <div className="text-xl font-mono font-bold text-emerald-400">${fmt(totalUSD)} USD</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Tasa de Cambio</span>
                  <div className="text-xs font-mono text-amber-400 font-bold">Bs. {fmt(exchangeRate)}</div>
                </div>
              </div>

              {/* TARJETA DINÁMICA DE DATOS DE COBRO DEL PROYECTO SEGÚN MÉTODO */}
              {paymentEntries[0]?.method === 'PAGO_MOVIL' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-emerald-500/30 flex items-center gap-3">
                  <div 
                    onClick={openPagoMovilZoom}
                    className="relative group p-1.5 bg-white rounded-2xl shrink-0 flex flex-col items-center justify-center cursor-pointer shadow-md hover:ring-2 hover:ring-emerald-400 active:scale-95 transition-all select-none"
                    title="Toca para ampliar el código QR"
                  >
                    {editPaymentConfig.pagoMovil?.qrImageUrl ? (
                      <img 
                        src={editPaymentConfig.pagoMovil.qrImageUrl} 
                        alt="QR Pago Movil" 
                        className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg pointer-events-none"
                      />
                    ) : (
                      <QRCodeSVG 
                        value={`PAGOMOVIL:${editPaymentConfig.pagoMovil?.bankCode || '0105'}:${editPaymentConfig.pagoMovil?.taxId || 'J-501920310'}:${editPaymentConfig.pagoMovil?.phone || '04141234567'}:${Number(totalBS.toFixed(2))}`} 
                        size={60} 
                      />
                    )}
                    <span className="text-[8px] text-slate-800 font-extrabold uppercase mt-0.5 flex items-center gap-0.5 pointer-events-none">
                      <ZoomIn size={9} /> Ampliar
                    </span>
                  </div>
                  <div className="text-xs space-y-0.5 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-400 block">📱 Pago Móvil ({currentProject?.name || 'Proyecto'})</span>
                      <button 
                        type="button"
                        onClick={() => setShowPaymentConfigModal(true)}
                        className="text-[10px] text-slate-400 hover:text-emerald-300 font-semibold cursor-pointer"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                    <span className="text-slate-200 block font-mono text-[11px]">
                      Banco: <strong>{editPaymentConfig.pagoMovil?.bankName || 'Mercantil (0105)'}</strong>
                    </span>
                    <span className="text-slate-300 block font-mono text-[11px]">
                      RIF: <strong>{editPaymentConfig.pagoMovil?.taxId || 'J-501920310'}</strong> | Tel: <strong>{editPaymentConfig.pagoMovil?.phone || '0414-1234567'}</strong>
                    </span>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-amber-400 font-mono font-extrabold text-[11px]">
                        Monto Exacto: Bs. {fmt(totalBS)}
                      </span>
                      <button
                        type="button"
                        onClick={openPagoMovilZoom}
                        className="text-[10px] bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/40 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <ZoomIn size={11} /> Ver QR
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {paymentEntries[0]?.method === 'ZELLE' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-purple-500/30 flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-600/20 text-purple-400 border border-purple-500/40 rounded-xl flex items-center justify-center font-extrabold text-xl shrink-0">
                    <DollarSign size={22} />
                  </div>
                  <div className="text-xs space-y-0.5 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-purple-400 block">💵 Datos de Cobro Zelle</span>
                      <button type="button" onClick={() => setShowPaymentConfigModal(true)} className="text-[10px] text-slate-400 hover:text-purple-300 font-semibold cursor-pointer">✏️ Editar</button>
                    </div>
                    <span className="text-slate-200 block font-mono text-[11px]">
                      Correo: <strong>{editPaymentConfig.zelle?.email || 'pagos@empresa.com'}</strong>
                    </span>
                    <span className="text-slate-300 block font-mono text-[11px]">
                      Titular: <strong>{editPaymentConfig.zelle?.beneficiary || currentProject?.name}</strong>
                    </span>
                    <span className="text-emerald-400 block font-mono font-extrabold">Monto: ${fmt(totalUSD)} USD</span>
                  </div>
                </div>
              )}

              {paymentEntries[0]?.method === 'USDT' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30 flex items-center gap-3">
                  <div 
                    onClick={openBinanceZoom}
                    className="relative group p-1.5 bg-white rounded-2xl shrink-0 flex flex-col items-center justify-center cursor-pointer shadow-md hover:ring-2 hover:ring-amber-400 active:scale-95 transition-all select-none"
                    title="Toca para ampliar el código QR"
                  >
                    {editPaymentConfig.binance?.qrImageUrl ? (
                      <img src={editPaymentConfig.binance.qrImageUrl} alt="QR Binance" className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg pointer-events-none" />
                    ) : (
                      <QRCodeSVG value={editPaymentConfig.binance?.walletAddress || editPaymentConfig.binance?.payId || 'BINANCE_PAY'} size={60} />
                    )}
                    <span className="text-[8px] text-slate-800 font-extrabold uppercase mt-0.5 flex items-center gap-0.5 pointer-events-none">
                      <ZoomIn size={9} /> Ampliar
                    </span>
                  </div>
                  <div className="text-xs space-y-0.5 flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-400 block">⚡ Binance Pay / USDT Cripto</span>
                      <button type="button" onClick={() => setShowPaymentConfigModal(true)} className="text-[10px] text-slate-400 hover:text-amber-300 font-semibold cursor-pointer">✏️ Editar</button>
                    </div>
                    <span className="text-slate-200 block font-mono text-[11px]">
                      Pay ID: <strong>{editPaymentConfig.binance?.payId || '198273645'}</strong>
                    </span>
                    <span className="text-slate-400 block font-mono text-[10px] truncate max-w-[240px]">
                      Billetera: {editPaymentConfig.binance?.walletAddress || 'Red TRC20 / BEP20'}
                    </span>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-emerald-400 font-mono font-extrabold text-[11px]">
                        Monto: ${fmt(totalUSD)} USDT
                      </span>
                      <button
                        type="button"
                        onClick={openBinanceZoom}
                        className="text-[10px] bg-amber-950/80 hover:bg-amber-900 text-amber-300 font-bold px-2 py-0.5 rounded-lg border border-amber-500/40 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <ZoomIn size={11} /> Ver QR
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {paymentEntries[0]?.method === 'BANK_TRANSFER' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-blue-500/30 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-400 block">🏦 Transferencia Bancaria</span>
                    <button onClick={() => setShowPaymentConfigModal(true)} className="text-[10px] text-slate-400 hover:text-blue-300 font-semibold">✏️ Editar</button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300">
                    Banco: <strong>{editPaymentConfig.transferencia?.bankName || 'Banco Mercantil'}</strong>
                  </div>
                  <div className="font-mono text-[11px] text-slate-200 font-bold bg-slate-900 p-1.5 rounded-lg border border-slate-800 flex justify-between items-center">
                    <span>{editPaymentConfig.transferencia?.accountNumber || '0105-0000-00-0000000000'}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    Titular: {editPaymentConfig.transferencia?.beneficiary || currentProject?.name}
                  </div>
                </div>
              )}

              {/* Payment Entry Form */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">Forma de Pago & Banco Receptor</label>

                {paymentEntries.map((pe, idx) => (
                  <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Método</label>
                        <select 
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-medium outline-none"
                          value={pe.method}
                          onChange={(e) => {
                            const updated = [...paymentEntries];
                            const m = e.target.value;
                            updated[idx].method = m;
                            if (m === 'PAGO_MOVIL') {
                              updated[idx].currency = 'BS';
                              updated[idx].amount = Number(totalBS.toFixed(2));
                              updated[idx].accountId = resolveMethodAccount('PAGO_MOVIL', 'BS');
                            } else if (m === 'ZELLE' || m === 'USDT') {
                              updated[idx].currency = 'USD';
                              updated[idx].amount = Number(totalUSD.toFixed(2));
                              updated[idx].accountId = resolveMethodAccount(m, 'USD');
                            } else {
                              updated[idx].accountId = resolveMethodAccount(m, pe.currency);
                            }
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-medium outline-none"
                          value={pe.currency}
                          onChange={(e) => {
                            const updated = [...paymentEntries];
                            const cur = e.target.value as 'USD' | 'BS';
                            updated[idx].currency = cur;
                            updated[idx].amount = cur === 'USD' ? Number(totalUSD.toFixed(2)) : Number(totalBS.toFixed(2));
                            updated[idx].accountId = resolveMethodAccount(pe.method, cur);
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono font-bold outline-none"
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono outline-none"
                          value={pe.reference}
                          onChange={(e) => {
                            const updated = [...paymentEntries];
                            updated[idx].reference = e.target.value;
                            setPaymentEntries(updated);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Cuenta Contable Receptora en FINK</label>
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-200 outline-none"
                        value={pe.accountId}
                        onChange={(e) => {
                          const updated = [...paymentEntries];
                          updated[idx].accountId = e.target.value;
                          setPaymentEntries(updated);
                        }}
                      >
                        <option value="">Selección Automática por Proyecto...</option>
                        {accounts.filter(a => a.type === 'ASSET').map(a => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                        ))}
                      </select>
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
            </div>

            {/* Botones Fijos Abajo */}
            <div className="pt-2 border-t border-slate-800 shrink-0 flex gap-2">
              <button 
                type="button" 
                onClick={() => setShowPaymentModal(false)}
                className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                Volver
              </button>
              <button 
                onClick={handleExecuteSale}
                disabled={processingSale}
                className="w-2/3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} />
                {processingSale ? 'Registrando Venta POS...' : 'Confirmar & Finalizar'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAR DATOS DE COBRO DEL PROYECTO ACTIVO */}
      {showPaymentConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-5 space-y-4 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2 text-emerald-400">
                  <Settings size={20} />
                  Configurar Métodos de Cobro & Cuentas: {currentProject?.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Define a dónde va el dinero y los datos que verá el cajero/cliente.</p>
              </div>
              <button onClick={() => setShowPaymentConfigModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* PAGO MOVIL */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="font-extrabold text-emerald-400 text-xs flex items-center gap-1.5">
                  <Smartphone size={15} /> 📱 Pago Móvil (VES)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Banco Receptor</label>
                    <select
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.pagoMovil?.bankCode}
                      onChange={e => {
                        const b = VENEZUELAN_BANKS.find(x => x.code === e.target.value);
                        setEditPaymentConfig((prev: any) => ({
                          ...prev,
                          pagoMovil: { ...prev.pagoMovil, bankCode: e.target.value, bankName: b?.name || 'Banco' }
                        }));
                      }}
                    >
                      {VENEZUELAN_BANKS.map(b => (
                        <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Teléfono</label>
                    <input
                      type="text"
                      placeholder="0414-1234567"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none"
                      value={editPaymentConfig.pagoMovil?.phone || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, phone: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cédula / RIF</label>
                    <input
                      type="text"
                      placeholder="J-501920310"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none"
                      value={editPaymentConfig.pagoMovil?.taxId || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, taxId: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cuenta Contable Destino en FINK</label>
                    <select
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.pagoMovil?.accountId || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        pagoMovil: { ...prev.pagoMovil, accountId: e.target.value }
                      }))}
                    >
                      <option value="">Seleccionar Cuenta en Bolívares...</option>
                      {accounts.filter(a => a.type === 'ASSET').map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'VES'})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Subir Imagen QR (Opcional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => e.target.files?.[0] && handleQrUploadModal('pagoMovil', e.target.files[0])}
                      className="w-full text-[10px] text-slate-400 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* ZELLE */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="font-extrabold text-purple-400 text-xs flex items-center gap-1.5">
                  <DollarSign size={15} /> 💵 Datos Zelle (USD)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="pagos@empresa.com"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.zelle?.email || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        zelle: { ...prev.zelle, email: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Titular</label>
                    <input
                      type="text"
                      placeholder="Inversiones Lucem LLC"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.zelle?.beneficiary || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        zelle: { ...prev.zelle, beneficiary: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cuenta Contable FINK</label>
                    <select
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.zelle?.accountId || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        zelle: { ...prev.zelle, accountId: e.target.value }
                      }))}
                    >
                      <option value="">Seleccionar Cuenta en USD...</option>
                      {accounts.filter(a => a.type === 'ASSET').map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* BINANCE */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="font-extrabold text-amber-400 text-xs flex items-center gap-1.5">
                  <Bitcoin size={15} /> ⚡ Binance Pay / USDT Cripto
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Binance Pay ID</label>
                    <input
                      type="text"
                      placeholder="198273645"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none"
                      value={editPaymentConfig.binance?.payId || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        binance: { ...prev.binance, payId: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Billetera USDT / Red</label>
                    <input
                      type="text"
                      placeholder="T9yB... (TRC20)"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-[11px] outline-none"
                      value={editPaymentConfig.binance?.walletAddress || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        binance: { ...prev.binance, walletAddress: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cuenta Contable FINK</label>
                    <select
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.binance?.accountId || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        binance: { ...prev.binance, accountId: e.target.value }
                      }))}
                    >
                      <option value="">Seleccionar Cuenta Cripto / USD...</option>
                      {accounts.filter(a => a.type === 'ASSET').map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* TRANSFERENCIA */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="font-extrabold text-blue-400 text-xs flex items-center gap-1.5">
                  <Landmark size={15} /> 🏦 Transferencia Bancaria
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Banco</label>
                    <input
                      type="text"
                      placeholder="Banco Mercantil"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.transferencia?.bankName || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, bankName: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Número de Cuenta (20 Dígitos)</label>
                    <input
                      type="text"
                      placeholder="0105-0000-00-0000000000"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono outline-none"
                      value={editPaymentConfig.transferencia?.accountNumber || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, accountNumber: e.target.value }
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Titular / RIF</label>
                    <input
                      type="text"
                      placeholder="Inversiones Lucem C.A. (J-40500250-6)"
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none"
                      value={editPaymentConfig.transferencia?.beneficiary || ''}
                      onChange={e => setEditPaymentConfig((prev: any) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, beneficiary: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowPaymentConfigModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePaymentConfig}
                disabled={savingPaymentConfig}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Save size={15} />
                {savingPaymentConfig ? 'Guardando...' : 'Guardar Datos de Cobro'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: COMPROBANTE DE VENTA EXITOSA / TICKET */}
      {showReceiptModal && lastCompletedSale && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) { setShowReceiptModal(false); clearCart(false); } }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 text-white shadow-2xl my-auto">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="font-extrabold text-sm text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={18} /> Venta Registrada con Éxito
              </span>
              <button 
                onClick={() => { setShowReceiptModal(false); clearCart(false); }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Cerrar y volver al catálogo"
              >
                <X size={16} />
              </button>
            </div>

            {/* Ticket Preview Card */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="text-center pb-2 border-b border-dashed border-slate-800">
                <h4 className="font-bold text-white uppercase text-sm">{currentProject?.name || 'GRUPO ALUDRA'}</h4>
                <p className="text-[10px] text-slate-400">{lastCompletedSale.date}</p>
                <span className="inline-block mt-1 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                  {lastCompletedSale.posCode}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Cliente:</span>
                  <span className="font-bold text-white truncate max-w-[170px]">{lastCompletedSale.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RIF/CI:</span>
                  <span>{lastCompletedSale.customerTaxId}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-800 pt-2 space-y-1.5 text-[11px]">
                {lastCompletedSale.items.map((it: any, i: number) => {
                  const isPending = (it.product?.stock <= 0) || it.isPendingStock;
                  return (
                    <div key={i} className="flex justify-between items-start gap-1">
                      <div className="flex-1">
                        <span className="line-clamp-1 text-white">{it.quantity}x {it.product?.name || it.name}</span>
                        {isPending && (
                          <span className="text-[9px] font-bold text-amber-300 block">
                            ⚠️ Bajo Pedido (Por Verificar)
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-slate-300">${fmt(safeNum(it.unitPrice) * safeNum(it.quantity))}</span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-800 pt-2 text-right">
                <div className="text-base font-bold text-emerald-400">${fmt(lastCompletedSale.totalUSD)} USD</div>
                <div className="text-[11px] text-amber-400">Bs. {fmt(lastCompletedSale.totalBS)}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer size={15} /> Imprimir Ticket Térmico (80mm)
              </button>

              <button
                type="button"
                onClick={() => {
                  const msg = `*COMPROBANTE DE COMPRA - FINK POS*\nTicket: ${lastCompletedSale.posCode}\nCliente: ${lastCompletedSale.customerName}\nTotal: $${fmt(lastCompletedSale.totalUSD)} USD (Bs. ${fmt(lastCompletedSale.totalBS)})\nFecha: ${lastCompletedSale.date}\n\n¡Gracias por su compra!`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Send size={15} /> Enviar Comprobante por WhatsApp
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReceiptModal(false);
                  clearCart(false);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Plus size={16} /> Iniciar Nueva Venta (Volver a Productos)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: APERTURA DE CAJA / FONDO INICIAL */}
      {showOpenSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-amber-400">
                <Lock size={20} />
                Apertura de Caja & Fondo Inicial
              </h3>
              <button onClick={() => setShowOpenSessionModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Fondo Inicial en Dólares ($ USD)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  value={initialUsd}
                  onChange={(e) => setInitialUsd(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Fondo Inicial en Bolívares (Bs. VES)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  value={initialBs}
                  onChange={(e) => setInitialBs(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Notas de Apertura / Cajero</label>
                <input 
                  type="text" 
                  placeholder="Ej: Turno de la mañana - Caja 1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleOpenSession}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Unlock size={16} /> Confirmar & Abrir Turno de Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CIERRE DE CAJA / ARQUEO Z */}
      {showCloseModal && sessionSummary && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-4 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-amber-400">
                <Lock size={20} />
                Arqueo de Turno & Cierre de Caja (Cierre Z)
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Summary details */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400">Total Facturas / Ventas:</span>
                <span className="font-bold font-mono text-emerald-400 text-sm">{sessionSummary.countInvoices} ventas</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Ventas Totales USD:</span>
                <span className="font-bold font-mono text-emerald-400">${fmt(sessionSummary.totalSalesUsd)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Ventas Totales Bs:</span>
                <span className="font-bold font-mono text-amber-400">Bs. {fmt(sessionSummary.totalSalesBs)}</span>
              </div>
            </div>

            {/* Arqueo input */}
            <div className="space-y-3 text-xs">
              <span className="font-bold text-slate-300 uppercase tracking-wider block text-[10px]">Conteo Físico Final de Caja:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Efectivo USD en Gaveta ($)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold outline-none"
                    value={finalUsd}
                    onChange={(e) => setFinalUsd(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Efectivo Bs en Gaveta (Bs)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono font-bold outline-none"
                    value={finalBs}
                    onChange={(e) => setFinalBs(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button 
                onClick={() => setShowCloseModal(false)}
                className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleExecuteCloseSession}
                className="w-2/3 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Lock size={15} /> Cerrar Turno Definitivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CAMBIO / AJUSTE DE TASA DE CAMBIO */}
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

      {/* MODAL: CLIENTE EXPRESS */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-white shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-emerald-400">
                <User size={20} />
                Datos del Cliente para la Venta
              </h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-2 border-b border-slate-800 pb-2 text-xs">
              <button
                onClick={() => setCustomerType('generic')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  customerType === 'generic' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Cliente Contado (General)
              </button>
              <button
                onClick={() => setCustomerType('express')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  customerType === 'express' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Cliente Express (Con RIF)
              </button>
            </div>

            {customerType === 'express' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nombre Completo / Razón Social *</label>
                  <input
                    type="text"
                    placeholder="Ej: Inversiones del Centro C.A."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    value={expressCustomer.name}
                    onChange={(e) => setExpressCustomer({ ...expressCustomer, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Cédula / RIF</label>
                    <input
                      type="text"
                      placeholder="J-12345678-9"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                      value={expressCustomer.taxId}
                      onChange={(e) => setExpressCustomer({ ...expressCustomer, taxId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="text"
                      placeholder="0414-1234567"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                      value={expressCustomer.phone}
                      onChange={(e) => setExpressCustomer({ ...expressCustomer, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="cliente@ejemplo.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                      value={expressCustomer.email}
                      onChange={(e) => setExpressCustomer({ ...expressCustomer, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={async () => {
                  if (customerType === 'express' && !expressCustomer.name) {
                    toast.error('El nombre del cliente es obligatorio');
                    return;
                  }
                  if (customerType === 'express' && expressCustomer.name && selectedProjectId) {
                    try {
                      await contactsAPI.create({
                        projectId: selectedProjectId,
                        name: expressCustomer.name.trim(),
                        taxId: expressCustomer.taxId?.trim() || undefined,
                        phone: expressCustomer.phone?.trim() || undefined,
                        email: expressCustomer.email?.trim() || undefined,
                        type: 'CUSTOMER'
                      });
                      toast.success(`Cliente "${expressCustomer.name}" guardado en Contactos`);
                    } catch (e) {
                      // Ya registrado o no duplicar
                    }
                  }
                  setShowCustomerModal(false);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIGHTBOX / ZOOM QR EN GRANDE */}
      {showQrZoomModal && zoomQrData && (
        <div 
          style={{ zIndex: 99999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowQrZoomModal(false); }}
          className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-3 overflow-y-auto"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xs sm:max-w-sm w-full p-4 sm:p-5 space-y-3 text-white shadow-2xl text-center flex flex-col items-center my-auto">
            
            <div className="w-full flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="font-extrabold text-xs sm:text-sm text-emerald-400 truncate text-left">
                {zoomQrData.title}
              </span>
              <button 
                type="button"
                onClick={() => setShowQrZoomModal(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <X size={15} /> Cerrar
              </button>
            </div>

            {/* Gran Contenedor Blanco para el QR (Máximo Contraste para Escaneo con Teléfonos) */}
            <div className="bg-white p-3.5 rounded-3xl shadow-2xl flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
              {zoomQrData.qrImage ? (
                <img 
                  src={zoomQrData.qrImage} 
                  alt="QR Grande" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <QRCodeSVG 
                  value={zoomQrData.qrValue || ''} 
                  size={230} 
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>

            {/* Monto Destacado */}
            {zoomQrData.amountText && (
              <div className="w-full bg-slate-950 p-2 rounded-xl border border-slate-800">
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Monto a Transferir</span>
                <span className="text-xl font-extrabold font-mono text-emerald-400 block">{zoomQrData.amountText}</span>
              </div>
            )}

            {/* Datos Resumidos para Pago */}
            {zoomQrData.details && zoomQrData.details.length > 0 && (
              <div className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-left space-y-1 text-xs font-mono">
                {zoomQrData.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">{d.label}:</span>
                    <span className="font-bold text-white text-right truncate ml-2">{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            <button 
              type="button"
              onClick={() => setShowQrZoomModal(false)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              ✓ Listo / Volver al Cobro
            </button>
          </div>
        </div>
      )}

      {/* MODAL: EMITIR COTIZACIÓN FORMAL EN PDF */}
      {showQuotationModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowQuotationModal(false); }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 space-y-4 text-white shadow-2xl max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center font-bold shrink-0">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Emitir Cotización Formal PDF</h3>
                  <p className="text-[11px] text-slate-400">Mismo diseño e imagen corporativa del Bot de WhatsApp</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuotationModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
              
              {/* Resumen del Carrito & Flete Calculado */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Ítems a Cotizar</span>
                    <span className="text-sm font-bold text-white font-mono">{cart.length} productos</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Cotizado</span>
                    <div className="text-sm font-extrabold font-mono text-emerald-400">${fmt(adjustedTotalUSD)} USD</div>
                    <div className="text-[10px] font-bold font-mono text-amber-400">Bs. {fmt(adjustedTotalUSD * exchangeRate)}</div>
                  </div>
                </div>

                {/* Banner de Estado de Flete */}
                {selectedCityId !== 'RETIRO' && (
                  <div className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
                    isFreeFreight 
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' 
                      : 'bg-amber-950/60 border-amber-700 text-amber-300'
                  }`}>
                    <Truck size={16} className="shrink-0" />
                    <div className="flex-1">
                      {isFreeFreight ? (
                        <span>🎉 ¡Flete 100% GRATIS / BONIFICADO hasta {effectiveCityName}!</span>
                      ) : (
                        <span>⚠️ Faltan ${fmt(neededForFreeFreight)} USD en productos para obtener Flete Gratis hasta {effectiveCityName} (O flete estimado de ${resolvedCity.freightCostUsd} USD)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Configuración de Destino y Flete */}
              <div className="space-y-2 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                    <Truck size={14} /> 🚚 Ciudad de Destino / Política de Flete:
                  </span>
                  {effectiveFreightPercent > 0 && (
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                      +{effectiveFreightPercent}% en lista
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <select
                      value={selectedCityId}
                      onChange={(e) => setSelectedCityId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold outline-none focus:ring-2 focus:ring-amber-500 text-xs cursor-pointer"
                    >
                      {DESTINATION_CITIES.map(city => (
                        <option key={city.id} value={city.id}>
                          {city.name} {city.adjustmentPercent > 0 ? `(+${city.adjustmentPercent}% | Mín $${city.minOrderUsd})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCityId === 'CUSTOM' && (
                    <>
                      <div>
                        <label className="block text-[10px] text-slate-300 font-bold mb-0.5">Nombre Ciudad</label>
                        <input
                          type="text"
                          placeholder="Ej: San Juan de los Morros"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none"
                          value={customCityName}
                          onChange={(e) => setCustomCityName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-300 font-bold mb-0.5">% Recargo</label>
                          <input
                            type="number"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none"
                            value={customAdjustmentPercent}
                            onChange={(e) => setCustomAdjustmentPercent(safeNum(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-300 font-bold mb-0.5">Mínimo ($)</label>
                          <input
                            type="number"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none"
                            value={customMinOrder}
                            onChange={(e) => setCustomMinOrder(safeNum(e.target.value))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Datos del Cliente */}
              <div className="space-y-2.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <span className="font-bold text-emerald-400 text-xs block">👤 Datos del Cliente para el Documento:</span>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Nombre Completo / Razón Social *</label>
                  <input
                    type="text"
                    value={quoteClientName}
                    onChange={(e) => setQuoteClientName(e.target.value)}
                    placeholder="Ej: Constructora Aragua C.A. o Nombre del Cliente"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Cédula / RIF</label>
                    <input
                      type="text"
                      value={quoteClientTaxId}
                      onChange={(e) => setQuoteClientTaxId(e.target.value)}
                      placeholder="J-12345678-9"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="text"
                      value={quoteClientPhone}
                      onChange={(e) => setQuoteClientPhone(e.target.value)}
                      placeholder="0412-1234567"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={quoteClientEmail}
                      onChange={(e) => setQuoteClientEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none text-[11px] bg-slate-900/80 p-2 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={quoteSaveContact}
                      onChange={(e) => setQuoteSaveContact(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
                    />
                    <span className="text-emerald-400 font-semibold">💾 Guardar cliente automáticamente en la agenda de Contactos</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Notas o Condiciones Especiales (opcional)</label>
                  <input
                    type="text"
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Ej: Tiempo de entrega 24 horas. Despacho incluido."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>

            </div>

            {/* Botones de Acción */}
            <div className="pt-3 border-t border-slate-800 shrink-0 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteQuotationPDF('view')}
                  disabled={generatingQuotation}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  👁️ {generatingQuotation ? 'Generando PDF...' : 'Ver / Imprimir Cotización'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteQuotationPDF('download')}
                  disabled={generatingQuotation}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  ⬇️ {generatingQuotation ? 'Generando...' : 'Descargar PDF'}
                </button>
              </div>

              {quoteClientPhone && (
                <button
                  type="button"
                  onClick={() => handleExecuteQuotationPDF('whatsapp')}
                  disabled={generatingQuotation}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  📲 Enviar al WhatsApp del Cliente ({quoteClientPhone})
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL: GENERAR ORDEN DE COMPRA FORMAL (PROVEEDOR) */}
      {showPurchaseOrderModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowPurchaseOrderModal(false); }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-5 space-y-4 text-white shadow-2xl max-h-[92vh] flex flex-col my-auto animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center font-bold shrink-0">
                  <Truck size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Generar Orden de Compra (Proveedor)</h3>
                  <p className="text-[11px] text-slate-400">Documento formal con precios calculados a Costo Real</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPurchaseOrderModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
              
              {/* Resumen del Pedido a Proveedor */}
              {(() => {
                const totalPOCostUSD = cart.reduce((acc, ci) => acc + ((ci.product.costPrice || (ci.unitPrice * 0.88)) * ci.quantity), 0);
                const totalPOCostBS = totalPOCostUSD * exchangeRate;
                return (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Renglones a Solicitar</span>
                      <span className="text-sm font-bold text-white font-mono">{cart.length} productos ({cart.reduce((a, b) => a + b.quantity, 0)} unidades)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Costo Total Estimado</span>
                      <div className="text-sm font-extrabold font-mono text-blue-400">${fmt(totalPOCostUSD)} USD</div>
                      <div className="text-[10px] font-bold font-mono text-amber-400">Bs. {fmt(totalPOCostBS)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Datos del Proveedor */}
              <div className="space-y-2.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <span className="font-bold text-blue-400 text-xs block">🏢 Datos del Proveedor:</span>
                
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Nombre / Razón Social del Proveedor *</label>
                  <input
                    type="text"
                    value={poSupplierName}
                    onChange={(e) => setPoSupplierName(e.target.value)}
                    placeholder="Ej: SOLO MAYOR / DISTRIBUIDORA"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">RIF del Proveedor</label>
                    <input
                      type="text"
                      value={poSupplierTaxId}
                      onChange={(e) => setPoSupplierTaxId(e.target.value)}
                      placeholder="J-12345678-0"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="text"
                      value={poSupplierPhone}
                      onChange={(e) => setPoSupplierPhone(e.target.value)}
                      placeholder="0412-271-1859"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Lugar de Recepción / Entrega</label>
                  <input
                    type="text"
                    value={poDeliveryAddress}
                    onChange={(e) => setPoDeliveryAddress(e.target.value)}
                    placeholder="Ej: Almacén Principal La Victoria, Aragua"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Tiempo de Entrega</label>
                    <input
                      type="text"
                      value={poExpectedDate}
                      onChange={(e) => setPoExpectedDate(e.target.value)}
                      placeholder="Ej: Inmediata / 24-48 horas"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Condición de Pago</label>
                    <input
                      type="text"
                      value={poPaymentTerms}
                      onChange={(e) => setPoPaymentTerms(e.target.value)}
                      placeholder="Ej: Contado / Crédito 7 días"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Observaciones / Instrucciones de Carga (opcional)</label>
                  <input
                    type="text"
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    placeholder="Ej: Enviar factura fiscal junto con el despacho."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
              </div>

            </div>

            {/* Botones de Acción */}
            <div className="pt-3 border-t border-slate-800 shrink-0 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExecutePurchaseOrderPDF('view')}
                  disabled={generatingPO}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  👁️ {generatingPO ? 'Generando OC...' : 'Ver / Imprimir Orden'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExecutePurchaseOrderPDF('download')}
                  disabled={generatingPO}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  ⬇️ {generatingPO ? 'Generando...' : 'Descargar PDF'}
                </button>
              </div>

              {poSupplierPhone && (
                <button
                  type="button"
                  onClick={() => handleExecutePurchaseOrderPDF('whatsapp')}
                  disabled={generatingPO}
                  className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  📲 Enviar al WhatsApp del Proveedor ({poSupplierPhone})
                </button>
              )}
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
