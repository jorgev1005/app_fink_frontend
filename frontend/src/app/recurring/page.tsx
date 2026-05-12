"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import CategorySelector from '@/components/CategorySelector';
import ContactAutocomplete from '@/components/ContactAutocomplete';
import SimpleModal from '@/components/SimpleModal';
import { Plus, Play, Info, RefreshCw, Calendar, DollarSign, Clock, FileText, Hash, Layers, Search, X, Tag, Users, ArrowUpCircle, ArrowDownCircle, Trash2, UserPlus, StopCircle } from 'lucide-react';

const computeEstimatedEndDate = (start: string, frequency: string, interval: number, occurrences: number): string => {
  if (!start || occurrences < 1) return '';
  const date = new Date(start);
  const loops = occurrences - 1; 
  if (loops <= 0) return start;

  if (frequency === 'DAILY') date.setDate(date.getDate() + (interval * loops));
  else if (frequency === 'WEEKLY') date.setDate(date.getDate() + (interval * 7 * loops));
  else if (frequency === 'MONTHLY') date.setMonth(date.getMonth() + (interval * loops));
  else if (frequency === 'YEARLY') date.setFullYear(date.getFullYear() + (interval * loops));
  
  return date.toISOString().split('T')[0];
};

const InputGroup = ({ label, icon: Icon, tip, children }: { label: string, icon?: any, tip?: string, children: React.ReactNode }) => (
  <div className="space-y-1.5 relative group">
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-1">
        {Icon && <Icon size={12} />}
        {label}
      </label>
      {tip && <Info size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors cursor-help" />}
    </div>
    {children}
    {tip && (
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 w-max max-w-[280px] z-50">
        <div className="bg-slate-800 text-white text-xs rounded-xl py-2.5 px-3.5 shadow-2xl leading-relaxed text-center">
          {tip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800" />
        </div>
      </div>
    )}
  </div>
);

const inputClass = "w-full bg-white/50 backdrop-blur-sm border border-gray-200/60 text-gray-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder:text-gray-400 hover:bg-white/80";

export default function RecurringPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ 
    projectId: '', 
    name: '', 
    amount: '', 
    currency: 'BS', 
    frequency: 'MONTHLY', 
    interval: '1', 
    startDate: '', 
    description: '', 
    dueDays: '15',
    type: 'BILL',
    categoryId: '',
    contactId: '',
    autoPost: false
  });

  // End Date Logic
  const [endDateMode, setEndDateMode] = useState<'NEVER' | 'DATE' | 'OCCURRENCES'>('NEVER');
  const [occurrencesCount, setOccurrencesCount] = useState<string>('');
  const [specificEndDate, setSpecificEndDate] = useState<string>('');

  // Quick Contact Creation State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactType, setNewContactType] = useState('CLIENT');
  const [newContactTaxId, setNewContactTaxId] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  const handleCreateContact = async () => {
    if (!newContactName.trim()) return;
    if (!form.projectId) { alert('Selecciona un proyecto primero'); return; }
    
    setCreatingContact(true);
    try {
      const payload = {
        projectId: form.projectId,
        name: newContactName,
        type: newContactType,
        taxId: newContactTaxId || undefined
      };
      const res = await api.contacts.create(payload);
      const contact = res.data?.data;
      if (contact) {
        setForm(prev => ({ ...prev, contactId: contact.id }));
        setShowContactModal(false);
        setNewContactName('');
        setNewContactTaxId('');
        // Refresh contacts list
        const resContacts = await api.contacts.getAll();
        setContacts(resContacts.data?.data || []);
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Error creando contacto');
    } finally {
      setCreatingContact(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [resRules, resProjects, resCats, resContacts] = await Promise.all([
        api.recurring.getAll(),
        api.projects.getAll(),
        api.transactionCategories.getAll(),
        api.contacts.getAll()
      ]);
      setRules(resRules.data?.data || []);
      setProjects((resProjects.data?.data || []).filter((p: any) => p.status !== 'PAUSED'));
      setCategories(resCats.data?.data || []);
      setContacts(resContacts.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const trigger = async (id: string) => {
    try {
      const res = await api.recurring.trigger(id);
      if (res.data?.success) {
        alert('Regla ejecutada: creada factura/ocurrencia');
        load();
      }
    } catch (e: any) {
      alert('Error al ejecutar regla: ' + (e?.response?.data?.error?.message || e.message));
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta regla de recurrencia?')) return;
    try {
      const res = await api.recurring.delete(id);
      if (res.data?.success) {
        alert('Regla eliminada');
        load();
      } else {
        alert(res.data?.error?.message || 'Error al eliminar la regla');
      }
    } catch (e: any) {
      console.error('Error deleting rule:', e);
      alert('Error de conexión al eliminar la regla');
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      // Calculate End Date
      let finalEndDate = null;
      if (endDateMode === 'DATE' && specificEndDate) {
        finalEndDate = new Date(specificEndDate).toISOString();
      } else if (endDateMode === 'OCCURRENCES' && occurrencesCount) {
        const estDate = computeEstimatedEndDate(form.startDate || new Date().toISOString(), form.frequency, Number(form.interval || 1), Number(occurrencesCount));
        if (estDate) finalEndDate = new Date(estDate).toISOString();
      }

      const payload: any = {
        projectId: form.projectId,
        name: form.name,
        description: form.description,
        amount: Number(form.amount),
        currency: form.currency,
        entriesTemplate: [],
        frequency: form.frequency,
        interval: Number(form.interval || 1),
        startDate: form.startDate || new Date().toISOString(),
        endDate: finalEndDate,
        dueDays: form.dueDays === '' ? 15 : Number(form.dueDays),
        type: form.type,
        categoryId: form.categoryId || undefined,
        contactId: form.contactId || undefined,
        autoPost: form.autoPost
      };
      const res = await api.recurring.create(payload);
      if (res.data?.success) {
        alert('Regla creada exitosamente');
        setForm({ 
          projectId: '', 
          name: '', 
          amount: '', 
          currency: 'BS', 
          frequency: 'MONTHLY', 
          interval: '1', 
          startDate: '', 
          description: '', 
          dueDays: '15',
          type: 'BILL',
          categoryId: '',
          contactId: '',
          autoPost: false
        });
        setEndDateMode('NEVER');
        setOccurrencesCount('');
        setSpecificEndDate('');
        load();
      }
    } catch (e: any) {
      alert('Error creando regla: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setCreating(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30 p-6 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
              Reglas Periódicas
            </h2>
            <p className="text-slate-500 mt-1">Gestiona tus facturas recurrentes y automatizaciones</p>
          </div>
          <button 
            onClick={load} 
            className="p-2 rounded-full hover:bg-white/50 hover:shadow-sm transition-all text-slate-600"
            title="Refrescar"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Section */}
          <div className="lg:col-span-6 xl:col-span-5">
            <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl shadow-xl shadow-slate-200/50 p-6 sticky top-6 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-400 opacity-80" />
              
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-100/50 rounded-lg text-blue-600">
                  <Plus size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Nueva Regla</h3>
              </div>

              <div className="space-y-5">
                <InputGroup label="Proyecto" icon={Hash} tip="Define en cuál proyecto se generarán automáticamente las facturas o transacciones de esta regla.">
                  <div className="relative">
                    <input 
                      className={`${inputClass} cursor-pointer`} 
                      placeholder="Seleccionar proyecto..." 
                      value={projects.find(p => p.id === form.projectId)?.name || form.projectId} 
                      readOnly
                      onClick={() => setShowProjectModal(true)}
                    />
                    <button 
                      onClick={() => setShowProjectModal(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Search size={16} />
                    </button>
                  </div>
                </InputGroup>

                <InputGroup label="Nombre de la Regla" icon={FileText} tip="Usa un nombre fácil de reconocer. Este texto te ayudará a identificar la automatización más adelante.">
                  <input 
                    className={inputClass} 
                    placeholder="Ej. Alquiler Oficina" 
                    value={form.name} 
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} 
                  />
                </InputGroup>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Tipo" icon={form.type === 'BILL' ? ArrowDownCircle : ArrowUpCircle} tip="Gasto crea cuentas por pagar periódicas. Ingreso crea cuentas por cobrar periódicas.">
                    <div className="flex bg-white/50 rounded-xl p-1 border border-gray-200/60">
                      <button
                        className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${form.type === 'BILL' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                        onClick={() => setForm(f => ({ ...f, type: 'BILL' }))}
                      >
                        Gasto
                      </button>
                      <button
                        className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${form.type === 'INVOICE' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                        onClick={() => setForm(f => ({ ...f, type: 'INVOICE' }))}
                      >
                        Ingreso
                      </button>
                    </div>
                  </InputGroup>

                  <InputGroup label="Categoría" icon={Tag} tip="Sirve para clasificar la regla y luego filtrar o analizar mejor los movimientos generados.">
                    <CategorySelector
                      projectId={form.projectId}
                      value={categories.find(c => c.id === form.categoryId)?.name || ''}
                      onChange={(v) => setForm(f => ({ ...f, categoryId: v.id || '' }))}
                      placeholder="Seleccionar o crear..."
                    />
                  </InputGroup>
                </div>

                <InputGroup label={form.type === 'BILL' ? 'Proveedor' : 'Cliente'} icon={Users} tip={form.type === 'BILL' ? 'Asocia el proveedor al que normalmente se le paga esta obligación recurrente.' : 'Asocia el cliente que normalmente genera este cobro recurrente.'}>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <ContactAutocomplete
                        projectId={form.projectId}
                        value={form.contactId}
                        onChange={(contactId) => setForm(f => ({ ...f, contactId: contactId || '' }))}
                        placeholder="Buscar o crear contacto..."
                        disabled={!form.projectId}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!form.projectId) {
                          alert('Selecciona un proyecto primero');
                          return;
                        }
                        setShowContactModal(true);
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                      title="Crear nuevo contacto"
                    >
                      <UserPlus size={20} />
                    </button>
                  </div>
                </InputGroup>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Monto" icon={DollarSign} tip="Monto fijo que se repetirá en cada ejecución automática de la regla.">
                    <input 
                      className={inputClass} 
                      placeholder="0.00" 
                      type="number" 
                      value={form.amount} 
                      onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} 
                    />
                  </InputGroup>
                  <InputGroup label="Moneda" tip="Moneda base en la que se emitirá la cuenta por cobrar o por pagar cada vez que la regla se ejecute.">
                    <select 
                      className={inputClass} 
                      value={form.currency} 
                      onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
                    >
                      <option value="BS">Bolívares (Bs)</option>
                      <option value="USD">Dólares ($)</option>
                    </select>
                  </InputGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Frecuencia" icon={RefreshCw} tip="Indica cada cuánto tiempo debe ejecutarse la regla: diaria, semanal, mensual o anual.">
                    <select 
                      className={inputClass} 
                      value={form.frequency} 
                      onChange={(e) => setForm(f => ({ ...f, frequency: e.target.value }))}
                    >
                      <option value="DAILY">Diario</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="MONTHLY">Mensual</option>
                      <option value="YEARLY">Anual</option>
                    </select>
                  </InputGroup>
                  <InputGroup label="Intervalo" icon={Layers} tip="Número de repeticiones entre una ejecución y la siguiente. Ejemplo: 2 mensual significa cada dos meses.">
                    <input 
                      className={inputClass} 
                      placeholder="Ej. 1" 
                      type="number"
                      value={form.interval} 
                      onChange={(e) => setForm(f => ({ ...f, interval: e.target.value }))} 
                    />
                  </InputGroup>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Inicio" icon={Calendar} tip="Fecha desde la cual la regla empezará a generar sus ocurrencias automáticas.">
                    <input 
                      className={inputClass} 
                      type="date" 
                      value={form.startDate} 
                      onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} 
                    />
                  </InputGroup>
                  <InputGroup label="Vencimiento (Días)" icon={Clock} tip="Cantidad de días después de la fecha de emisión para marcar el vencimiento de la factura u obligación.">
                    <input 
                      className={inputClass} 
                      placeholder="15" 
                      type="number" 
                      value={form.dueDays} 
                      onChange={(e) => setForm(f => ({ ...f, dueDays: e.target.value }))} 
                    />
                  </InputGroup>
                </div>

                <div className="space-y-2">
                  <InputGroup label="Finalización (Opcional)" icon={StopCircle} tip="Puedes dejarla indefinida, fijar una fecha final o limitar cuántas veces se repetirá la regla.">
                    <div className="flex bg-white/50 rounded-xl p-1 border border-gray-200/60 mb-2">
                      <button
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${endDateMode === 'NEVER' ? 'bg-slate-200 text-slate-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                        onClick={() => setEndDateMode('NEVER')}
                      >
                        Nunca
                      </button>
                      <button
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${endDateMode === 'DATE' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                        onClick={() => setEndDateMode('DATE')}
                      >
                        En Fecha
                      </button>
                      <button
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${endDateMode === 'OCCURRENCES' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                        onClick={() => setEndDateMode('OCCURRENCES')}
                      >
                        Por Repeticiones
                      </button>
                    </div>
                    {endDateMode === 'DATE' && (
                       <input 
                        className={inputClass} 
                        type="date" 
                        value={specificEndDate} 
                        onChange={(e) => setSpecificEndDate(e.target.value)} 
                      />
                    )}
                    {endDateMode === 'OCCURRENCES' && (
                       <div className="flex flex-col gap-1">
                         <div className="flex gap-2 items-center">
                           <input 
                            className={`${inputClass} w-24`}
                            type="number" 
                            placeholder="Ej: 6"
                            value={occurrencesCount} 
                            onChange={(e) => setOccurrencesCount(e.target.value)} 
                          />
                          <span className="text-sm text-slate-500">
                             veces
                          </span>
                         </div>
                         {occurrencesCount && form.startDate && (
                           <div className="text-xs text-slate-400 pl-1">
                             Finalizará aprox. el: <span className="font-semibold text-slate-600">{computeEstimatedEndDate(form.startDate, form.frequency, Number(form.interval || 1), Number(occurrencesCount))}</span>
                           </div>
                         )}
                       </div>
                    )}
                  </InputGroup>
                </div>

                <div className="flex items-center gap-2 px-1">
                  <input 
                    type="checkbox" 
                    id="autoPost"
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    checked={form.autoPost}
                    onChange={(e) => setForm(f => ({ ...f, autoPost: e.target.checked }))}
                  />
                  <label htmlFor="autoPost" className="text-sm text-slate-600 font-medium cursor-pointer select-none">
                    Contabilizar automáticamente (Crear transacción)
                  </label>
                </div>
                

                <InputGroup label="Descripción" tip="Información adicional para dar contexto a la regla y a las transacciones que se generen desde ella.">
                  <textarea 
                    className={`${inputClass} min-h-[80px] resize-none`} 
                    placeholder="Detalles adicionales..." 
                    value={form.description} 
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} 
                  />
                </InputGroup>

                <div className="pt-2 flex gap-3">
                  <button 
                    className="flex-1 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-medium transition-colors"
                    onClick={() => {
                      setForm({
                        projectId: '', 
                        name: '', 
                        amount: '', 
                        currency: 'BS', 
                        frequency: 'MONTHLY', 
                        interval: '1', 
                        startDate: '', 
                        description: '', 
                        dueDays: '15',
                        type: 'BILL',
                        categoryId: '',
                        contactId: '',
                        autoPost: false
                      });
                      setEndDateMode('NEVER');
                      setOccurrencesCount('');
                      setSpecificEndDate('');
                    }}
                  >
                    Limpiar
                  </button>
                  <button 
                    className="flex-[2] py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    onClick={create} 
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" /> Procesando...
                      </>
                    ) : (
                      <>Crear Regla</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* List Section */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-bold text-slate-700">Reglas Activas</h3>
              <span className="text-sm font-medium px-3 py-1 bg-white/60 rounded-full text-slate-500 border border-white/40 shadow-sm">
                {rules.length} reglas
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <RefreshCw size={32} className="animate-spin opacity-50" />
                <p>Cargando reglas...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {rules.length === 0 && (
                  <div className="text-center py-20 bg-white/40 rounded-3xl border border-dashed border-slate-300">
                    <p className="text-slate-500">No hay reglas creadas aún.</p>
                  </div>
                )}
                {rules.map(r => (
                  <div 
                    key={r.id} 
                    className="group bg-white/60 backdrop-blur-md border border-white/60 hover:border-blue-200/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold text-slate-800 text-lg">{r.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${r.currency === 'USD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.currency}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1 items-center">
                        <span className="flex items-center gap-1" title={`ID Proyecto: ${r.projectId}`}>
                          <Hash size={12} /> {projects.find(p => p.id === r.projectId)?.name || r.projectId}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> Próxima: {r.nextRunAt ? new Date(r.nextRunAt).toLocaleDateString() : '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> Vence: {r.nextRunAt ? new Date(new Date(r.nextRunAt).getTime() + (r.dueDays ?? 15) * 24 * 60 * 60 * 1000).toLocaleDateString() : '—'}
                        </span>
                        <span className="flex items-center gap-1">
                          <RefreshCw size={12} /> {r.interval} {r.frequency}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right mr-2">
                        <div className="font-bold text-slate-900 text-lg">
                          {Number(r.amount).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">Monto por periodo</div>
                      </div>
                      <button 
                        className="p-2.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all group-hover:border-blue-200"
                        onClick={() => trigger(r.id)}
                        title="Ejecutar ahora"
                      >
                        <Play size={18} fill="currentColor" className="opacity-80" />
                      </button>
                      <button 
                        className="p-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-100 rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all group-hover:border-red-200"
                        onClick={() => deleteRule(r.id)}
                        title="Eliminar regla"
                      >
                        <Trash2 size={18} className="opacity-80" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Project Selection Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Seleccionar Proyecto</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Buscar proyecto..."
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto p-2 space-y-1">
              {projects
                .filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()) || p.code?.toLowerCase().includes(projectSearch.toLowerCase()))
                .map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setForm(f => ({ ...f, projectId: p.id }));
                    setShowProjectModal(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-between group ${form.projectId === p.id ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
                >
                  <div>
                    <div className={`font-semibold ${form.projectId === p.id ? 'text-blue-700' : 'text-slate-700 group-hover:text-blue-700'}`}>{p.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{p.code || 'Sin código'}</div>
                  </div>
                  {form.projectId === p.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="text-center py-8 text-slate-400">No hay proyectos disponibles</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Quick Contact Creation Modal */}
      <SimpleModal
        open={showContactModal}
        title="Crear Nuevo Contacto"
        onClose={() => setShowContactModal(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Juan Pérez o Empresa C.A."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={newContactType}
              onChange={(e) => setNewContactType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="CLIENT">Cliente</option>
              <option value="SUPPLIER">Proveedor</option>
              <option value="EMPLOYEE">Empleado</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RIF / Cédula (Opcional)</label>
            <input
              type="text"
              value={newContactTaxId}
              onChange={(e) => setNewContactTaxId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: J-12345678-9"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowContactModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateContact}
              disabled={!newContactName.trim() || creatingContact}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {creatingContact ? 'Guardando...' : (
                <>
                  <UserPlus size={16} />
                  Crear Contacto
                </>
              )}
            </button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
