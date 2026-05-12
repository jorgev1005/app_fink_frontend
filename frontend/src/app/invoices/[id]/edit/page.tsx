"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Save, Building, Calendar, FileText, DollarSign, AlertCircle, User, Percent } from 'lucide-react';

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Lists
  const [projects, setProjects] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('BILL'); // BILL (Gasto/Compra) or INVOICE (Venta)
  const [code, setCode] = useState('');
  
  // Contact
  const [contactId, setContactId] = useState(''); // Vendor or Customer ID
  
  // Money
  const [currency, setCurrency] = useState('USD');
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState('');
  
  // Tax
  const [hasTax, setHasTax] = useState(false);
  const [taxRate, setTaxRate] = useState(16);
  const [taxAmount, setTaxAmount] = useState('0');

  // Dates
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  // Initial Load (Projects & Invoice Data)
  useEffect(() => {
    const init = async () => {
      setDataLoading(true);
      try {
        const [resProj, resInv] = await Promise.all([
            api.projects.getAll(),
            api.invoices.getById(id)
        ]);
        
        const allProjects = resProj.data.data || [];
        const inv = resInv.data.data;
        
        // Filter out paused projects, but keep the current one active even if paused (so edit doesn't break)
        const filteredProjects = allProjects.filter((p: any) => p.status !== 'PAUSED' || (inv && p.id === inv.projectId));
        setProjects(filteredProjects);
        
        if (inv) {
            setProjectId(inv.projectId);
            setType(inv.type); // BILL/INVOICE
            setCode(inv.code);
            setCurrency(inv.currency);
            
            // Reconstruct Base Amount from Total and Tax
            // Inv.Total in DB is Final Amount. We want Base for the input.
            let taxVal = 0;
            // Parse lines for description/tax
            if (inv.lines) {
                try {
                    const lines = JSON.parse(inv.lines);
                    setDescription(lines.description || '');
                    if (lines.taxAmount) {
                        taxVal = Number(lines.taxAmount);
                        setHasTax(true);
                        setTaxAmount(String(taxVal));
                    }
                } catch(e) {}
            }

            const baseVal = inv.total - taxVal;
            setTotal(String(baseVal));
            
            // Try to infer taxRate if possible (Tax / Base * 100)
            if (taxVal > 0 && baseVal > 0) {
                 const inferredRate = Math.round((taxVal / baseVal) * 100);
                 setTaxRate(inferredRate);
            }

            setIssueDate(inv.issueDate ? inv.issueDate.slice(0,10) : '');
            setDueDate(inv.dueDate ? inv.dueDate.slice(0,10) : '');
            setContactId(inv.vendorId || inv.customerId || '');
        }
      } catch (e: any) {
        console.error('Error loading data', e);
        setError(e.response?.data?.error?.message || 'Error al cargar factura');
      } finally {
        setDataLoading(false);
      }
    };
    init();
  }, [id]);

  // Load Contacts when Project Changes (after initial load)
  useEffect(() => {
    if (!projectId) {
        setContacts([]);
        return;
    }
    const loadContacts = async () => {
        try {
            const res = await api.contacts.getAll({ projectId });
            setContacts(res.data.data || []);
        } catch(e) {
            console.error('Error loading contacts', e);
        }
    };
    loadContacts();
  }, [projectId]);

  // Tax Calculator logic
  useEffect(() => {
      if (hasTax && total && !isNaN(Number(total))) {
           const base = Number(total);
           const tax = base * (taxRate / 100);
           setTaxAmount(tax.toFixed(2));
      } else if (!hasTax) {
          setTaxAmount('0');
      }
  }, [hasTax, total, taxRate]);

  const submit = async (e: any) => {
    e.preventDefault();
    if (!projectId) { setError('Selecciona un proyecto'); return; }
    if (!total || Number(total) <= 0) { setError('El monto debe ser mayor a 0'); return; }

    setLoading(true);
    setError(null);
    try {
      // Anchor dueDate to noon to avoid timezone issues
      let dueDateToSend = dueDate;
      if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        dueDateToSend = dueDate + 'T12:00:00';
      }

      // Calculate Final Total
      let finalTotal = Number(total);
      if (hasTax) {
          finalTotal += Number(taxAmount);
      }

      const body = { 
          projectId, 
          type,
          code: code || undefined, 
          currency, 
          total: finalTotal,
          issueDate: issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
          dueDate: dueDateToSend,
          vendorId: type === 'BILL' ? contactId : undefined,
          customerId: type === 'INVOICE' ? contactId : undefined,
          description,
          taxAmount: hasTax ? Number(taxAmount) : 0,
      };
      
      await api.invoices.update(id, body);
      router.push('/invoices');
      
    } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error?.message || err.message || 'Error de conexión');
    } finally {
        setLoading(false);
    }
  };

  // Filter contacts based on type
  const filteredContacts = contacts.filter(c => {
      if (type === 'BILL') return c.type === 'SUPPLIER' || c.type === 'BOTH' || c.type === 'OTHER';
      if (type === 'INVOICE') return c.type === 'CUSTOMER' || c.type === 'BOTH' || c.type === 'OTHER';
      return true;
  });

  if (dataLoading) {
      return <div className="p-8 text-center text-slate-500">Cargando información...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
            href="/invoices" 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
        >
            <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Editar Factura</h1>
            <p className="text-gray-500 text-sm">Modificar documento existente</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        <div className="p-6 md:p-8 space-y-8">
            {/* Section 1: Basic Info */}
            <section className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4" /> Configuración Inicial
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Project Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto</label>
                        <select 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none"
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                        >
                            <option value="">-- Seleccionar --</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                            <button
                                type="button"
                                onClick={() => setType('BILL')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    type === 'BILL' 
                                    ? 'bg-white text-orange-600 shadow-sm border border-orange-100' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Por Pagar (Compra)
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('INVOICE')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                                    type === 'INVOICE' 
                                    ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Por Cobrar (Venta)
                            </button>
                        </div>
                    </div>
                </div>
            </section>

             <hr className="border-gray-100" />

            {/* Section 2: Details */}
            <section className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Detalles del Documento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Contact Selector */}
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {type === 'BILL' ? 'Proveedor (Acreedor)' : 'Cliente (Deudor)'}
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <select 
                                className="w-full pl-9 p-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none disabled:opacity-50"
                                value={contactId}
                                onChange={(e) => setContactId(e.target.value)}
                                disabled={!projectId}
                            >
                                <option value="">-- Seleccionar o Dejar Vacío --</option>
                                {filteredContacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} {c.taxId ? `(${c.taxId})` : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                         <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Notas</label>
                         <textarea 
                            rows={3}
                            className="w-full p-3 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none resize-none"
                            placeholder="Ej. Servicios de consultoría mes de Enero..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                         />
                    </div>

                    {/* Code */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nro. de Factura / Control</label>
                        <input 
                            className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none"
                            placeholder="Ej. 000123"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                         <p className="text-xs text-gray-400 mt-1">Opcional (se genera auto si vacío)</p>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Emisión</label>
                            <input 
                                type="date"
                                className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                            <input 
                                type="date"
                                className="w-full p-2.5 bg-white border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-xl outline-none"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </section>

             <hr className="border-gray-100" />

            {/* Section 3: Amounts */}
            <section className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Montos e Impuestos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner">
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
                        <select 
                             className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100"
                             value={currency}
                             onChange={(e) => setCurrency(e.target.value)}
                        >
                            <option value="USD">Dólares (USD)</option>
                            <option value="BS">Bolívares (Bs)</option>
                            <option value="EUR">Euros (EUR)</option>
                        </select>
                    </div>
                    
                    <div className="md:col-span-5">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Monto (Base Imponible)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                            <input 
                                type="number"
                                step="any"
                                className="w-full pl-8 p-2.5 bg-white border border-slate-200 rounded-xl text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="0.00"
                                value={total}
                                onChange={(e) => setTotal(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="md:col-span-4 flex flex-col justify-center">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input 
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                checked={hasTax}
                                onChange={(e) => setHasTax(e.target.checked)}
                            />
                            <span className="text-sm font-medium text-slate-700">Calcula IVA</span>
                        </label>
                        
                        {hasTax && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                     <span className="text-xs text-slate-500">Tasa (%):</span>
                                     <input 
                                        type="number"
                                        className="w-16 p-1 text-sm bg-white border border-slate-200 rounded text-center outline-none focus:border-blue-300"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(Number(e.target.value))}
                                     />
                                </div>
                                <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                    <Percent className="w-4 h-4 text-slate-400" />
                                    <span>IVA:</span>
                                    <span className="font-semibold text-slate-700">{currency} {taxAmount}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold text-slate-800 pt-1 border-t border-slate-200">
                                    <span>Total:</span>
                                    <span>{currency} { Number(total || 0) + Number(taxAmount || 0) }</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
            <Link 
                href="/invoices"
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
                tabIndex={-1}
            >
                Cancelar
            </Link>
            <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-lg shadow-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    'Guardando...'
                ) : (
                    <>
                        <Save className="w-4 h-4" /> Actualizar Factura
                    </>
                )}
            </button>
        </div>
      </form>
    </div>
  );
}
