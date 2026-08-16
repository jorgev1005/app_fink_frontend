'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Users, ArrowLeft, Building2, CreditCard, QrCode, Smartphone, Landmark, DollarSign, Bitcoin, Save } from 'lucide-react';
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

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [activeTab, setActiveTab] = useState<'general' | 'payments'>('general');

  // General fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [status, setStatus] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Accounts list for select dropdowns
  const [accounts, setAccounts] = useState<any[]>([]);

  // Payment Config fields
  const [paymentConfig, setPaymentConfig] = useState({
    pagoMovil: {
      bankCode: '0105',
      bankName: 'Banco Mercantil',
      phone: '',
      taxId: '',
      accountId: '',
      qrImageUrl: ''
    },
    transferencia: {
      bankName: 'Banco Mercantil',
      accountNumber: '',
      beneficiary: '',
      taxId: '',
      accountId: ''
    },
    zelle: {
      email: '',
      beneficiary: '',
      accountId: ''
    },
    binance: {
      payId: '',
      email: '',
      walletAddress: '',
      network: 'TRC20',
      accountId: '',
      qrImageUrl: ''
    },
    puntoVenta: {
      bankName: '',
      accountId: ''
    },
    efectivo: {
      accountIdUsd: '',
      accountIdBs: ''
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const [resp, accResp] = await Promise.all([
          api.projects.getById(id),
          api.accounts.getAll({ projectId: id }).catch(() => ({ data: { data: [] } }))
        ]);

        const data = resp.data.data || resp.data;
        setName(data.name || '');
        setCode(data.code || '');
        setDescription(data.description || '');
        setStartDate(data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '');
        setColor(data.color || '#2563eb');
        setStatus(data.status || '');
        setLogoUrl(data.logoUrl || null);

        if (data.paymentConfig) {
          setPaymentConfig(prev => ({
            ...prev,
            ...data.paymentConfig,
            pagoMovil: { ...prev.pagoMovil, ...(data.paymentConfig.pagoMovil || {}) },
            transferencia: { ...prev.transferencia, ...(data.paymentConfig.transferencia || {}) },
            zelle: { ...prev.zelle, ...(data.paymentConfig.zelle || {}) },
            binance: { ...prev.binance, ...(data.paymentConfig.binance || {}) },
            puntoVenta: { ...prev.puntoVenta, ...(data.paymentConfig.puntoVenta || {}) },
            efectivo: { ...prev.efectivo, ...(data.paymentConfig.efectivo || {}) }
          }));
        }

        const rawAccs = Array.isArray(accResp?.data?.data) ? accResp.data.data : [];
        setAccounts(rawAccs);
      } catch (err) {
        console.error('Error loading project', err);
        toast.error('No se pudo cargar el proyecto');
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [id, router]);

  const handleLogoUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
      setSaving(true);
      const res = await api.projects.uploadLogo(id, formData);
      setLogoUrl(res.data.data.logoUrl);
      toast.success('Logo actualizado con éxito');
    } catch (err: any) {
      console.error(err);
      toast.error('Error subiendo logo');
    } finally {
      setSaving(false);
    }
  };

  const handleQrUpload = (type: 'pagoMovil' | 'binance', file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPaymentConfig(prev => ({
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

  const handleSave = async (e?: any) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      setErrors(null);
      if (!name || name.trim().length < 3) {
        setErrors('El nombre es obligatorio y debe tener al menos 3 caracteres');
        setSaving(false);
        return;
      }
      const payload: any = { 
        name: name.trim(), 
        code: code.trim() || undefined, 
        description: description.trim() || undefined, 
        startDate: startDate || undefined, 
        color,
        paymentConfig
      };
      const resp = await api.projects.update(id, payload);
      if (resp.data && resp.data.success !== false) {
        toast.success('Proyecto y configuración de cobro guardados con éxito');
        router.push('/projects');
      } else {
        toast.error('Error actualizando proyecto');
      }
    } catch (err: any) {
      console.error('Error updating project', err);
      toast.error(err?.response?.data?.message || err.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Cargando datos del proyecto...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/projects')}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Building2 className="text-blue-600" size={22} />
                Editar Proyecto: {name}
              </h1>
              <p className="text-xs text-slate-500 font-mono">Código: {code || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/projects/${id}/members`)}
              className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200 text-xs font-bold"
            >
              <Users size={16} />
              Equipo
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || status === 'PAUSED'}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors shadow-sm text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Todo'}
            </button>
          </div>
        </div>

        {status === 'PAUSED' && (
          <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs">
            ⚠️ Este proyecto está <b>pausado</b>. No se puede editar hasta que sea reactivado.
          </div>
        )}

        {errors && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-medium">
            {errors}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 size={16} />
            Datos Generales
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'payments'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard size={16} />
            ⚙️ Cuentas de Cobro & QR (POS)
          </button>
        </div>

        {/* TAB 1: DATOS GENERALES */}
        {activeTab === 'general' && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Nombre del Proyecto *</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none" 
                placeholder="Nombre del proyecto" 
                required 
                disabled={status === 'PAUSED'} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Código Único (opcional)</label>
              <input 
                value={code} 
                onChange={e => setCode(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none" 
                placeholder="Código corto del proyecto" 
                disabled={status === 'PAUSED'} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Descripción (opcional)</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none" 
                rows={3} 
                disabled={status === 'PAUSED'} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Logo del Proyecto</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img 
                      src={`/backend-api${logoUrl}`} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                      onError={(e) => { (e.target as any).src = '' }}
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">Sin Logo</span>
                  )}
                </div>
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    disabled={status === 'PAUSED' || saving}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Formatos recomendados: PNG, JPG, WebP. Máx 5MB.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: METODOS DE COBRO & CUENTAS POR PROYECTO */}
        {activeTab === 'payments' && (
          <div className="space-y-6 pt-2 text-xs text-slate-700">
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
              <h3 className="font-extrabold text-emerald-900 text-xs flex items-center gap-2">
                💡 Cuentas Receptoras & Datos de Cobro en POS
              </h3>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Configura a dónde va el dinero de las ventas de este proyecto cuando el cliente pague por Pago Móvil, Zelle, Transferencia o Binance.
              </p>
            </div>

            {/* SECCIÓN 1: PAGO MÓVIL */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                  <Smartphone size={16} className="text-emerald-600" />
                  📱 Datos de Pago Móvil (VES)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Moneda: Bolívares (VES)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Banco Receptor</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-semibold outline-none"
                    value={paymentConfig.pagoMovil.bankCode}
                    onChange={e => {
                      const selectedBank = VENEZUELAN_BANKS.find(b => b.code === e.target.value);
                      setPaymentConfig(prev => ({
                        ...prev,
                        pagoMovil: {
                          ...prev.pagoMovil,
                          bankCode: e.target.value,
                          bankName: selectedBank?.name || 'Banco'
                        }
                      }));
                    }}
                  >
                    {VENEZUELAN_BANKS.map(b => (
                      <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Teléfono Pago Móvil</label>
                  <input
                    type="text"
                    placeholder="Ej: 0414-1234567"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none"
                    value={paymentConfig.pagoMovil.phone}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      pagoMovil: { ...prev.pagoMovil, phone: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cédula o RIF</label>
                  <input
                    type="text"
                    placeholder="Ej: J-40500250-6"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none"
                    value={paymentConfig.pagoMovil.taxId}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      pagoMovil: { ...prev.pagoMovil, taxId: e.target.value }
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Contable Destino en FINK</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.pagoMovil.accountId}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      pagoMovil: { ...prev.pagoMovil, accountId: e.target.value }
                    }))}
                  >
                    <option value="">Seleccionar Cuenta Contable (Auto)...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'VES'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Imagen QR Pago Móvil (Opcional)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => e.target.files?.[0] && handleQrUpload('pagoMovil', e.target.files[0])}
                      className="w-full text-[11px] text-slate-500 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700"
                    />
                    {paymentConfig.pagoMovil.qrImageUrl && (
                      <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1">✓ QR</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: ZELLE */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                  <DollarSign size={16} className="text-purple-600" />
                  💵 Datos de Cobro Zelle (USD)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Moneda: Dólares (USD)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Correo Electrónico Zelle</label>
                  <input
                    type="email"
                    placeholder="Ej: pagos@empresa.com"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold outline-none"
                    value={paymentConfig.zelle.email}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      zelle: { ...prev.zelle, email: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Nombre del Titular Zelle</label>
                  <input
                    type="text"
                    placeholder="Ej: Inversiones Lucem LLC"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.zelle.beneficiary}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      zelle: { ...prev.zelle, beneficiary: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Contable Destino en FINK</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.zelle.accountId}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      zelle: { ...prev.zelle, accountId: e.target.value }
                    }))}
                  >
                    <option value="">Seleccionar Cuenta en Dólares...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: BINANCE / CRIPTO */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                  <Bitcoin size={16} className="text-amber-500" />
                  ⚡ Binance Pay / USDT Cripto (USD)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Moneda: USDT / Cripto</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Binance Pay ID o Correo</label>
                  <input
                    type="text"
                    placeholder="Ej: 198273645"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none"
                    value={paymentConfig.binance.payId}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      binance: { ...prev.binance, payId: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Dirección de Billetera USDT / Red</label>
                  <input
                    type="text"
                    placeholder="Ej: T9yB... (TRC20)"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono text-[11px] outline-none"
                    value={paymentConfig.binance.walletAddress}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      binance: { ...prev.binance, walletAddress: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Contable Destino en FINK</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.binance.accountId}
                    onChange={e => setPaymentConfig(prev => ({
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

            {/* SECCIÓN 4: TRANSFERENCIA BANCARIA */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                  <Landmark size={16} className="text-blue-600" />
                  🏦 Transferencia Bancaria
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Banco</label>
                  <input
                    type="text"
                    placeholder="Ej: Banco Mercantil"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.transferencia.bankName}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, bankName: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Número de Cuenta (20 Dígitos)</label>
                  <input
                    type="text"
                    placeholder="0105-XXXX-XX-XXXXXXXXXX"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold outline-none"
                    value={paymentConfig.transferencia.accountNumber}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, accountNumber: e.target.value }
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Titular / RIF</label>
                  <input
                    type="text"
                    placeholder="Ej: Inversiones Lucem C.A. (J-40500250-6)"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.transferencia.beneficiary}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, beneficiary: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: PUNTO DE VENTA Y CAJAS */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                  <CreditCard size={16} className="text-slate-700" />
                  💳 Punto de Venta & Cajas en Efectivo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Punto de Venta (Tarjeta)</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.puntoVenta.accountId}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      puntoVenta: { ...prev.puntoVenta, accountId: e.target.value }
                    }))}
                  >
                    <option value="">Cuenta Banco del POS...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Caja Efectivo USD</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.efectivo.accountIdUsd}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      efectivo: { ...prev.efectivo, accountIdUsd: e.target.value }
                    }))}
                  >
                    <option value="">Caja General USD...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'USD'})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Cuenta Caja Efectivo Bs</label>
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium outline-none"
                    value={paymentConfig.efectivo.accountIdBs}
                    onChange={e => setPaymentConfig(prev => ({
                      ...prev,
                      efectivo: { ...prev.efectivo, accountIdBs: e.target.value }
                    }))}
                  >
                    <option value="">Caja General Bs...</option>
                    {accounts.filter(a => a.type === 'ASSET').map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.currency || 'VES'})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving || status === 'PAUSED'}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                {saving ? 'Guardando Configuración...' : 'Guardar Métodos de Cobro'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
