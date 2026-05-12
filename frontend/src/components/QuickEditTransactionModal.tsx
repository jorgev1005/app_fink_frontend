"use client";
import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import SimpleModal from './SimpleModal';
import CategorySelector from './CategorySelector';
import ContactAutocomplete from './ContactAutocomplete';
import { UserPlus, X, Mic, Trash2, Plus } from 'lucide-react';

interface QuickEditTransactionModalProps {
  transactionId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickEditTransactionModal({ transactionId, onClose, onSuccess }: QuickEditTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transaction, setTransaction] = useState<any>(null);

  // Form fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BS');
  const [date, setDate] = useState('');
  const [reference, setReference] = useState('');
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [contactPersonId, setContactPersonId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [lines, setLines] = useState<any[]>([]);

  // Lists
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Quick Contact Creation State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactType, setNewContactType] = useState('CLIENT');
  const [newContactTaxId, setNewContactTaxId] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  // Voice Recognition State
  const [isListening, setIsListening] = useState(false);

  const processVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    
    // 1. Detect Currency
    if (lower.includes('dólar') || lower.includes('dolar') || lower.includes('usd') || lower.includes('usdt')) setCurrency('USD');
    else if (lower.includes('bolívar') || lower.includes('bolivar') || lower.includes('bs')) setCurrency('BS');
    else if (lower.includes('euro') || lower.includes('eur')) setCurrency('EUR');

    // 2. Detect Amount (simple regex for numbers)
    const amountMatch = text.match(/(\d+([.,]\d+)?)/);
    if (amountMatch) {
      const val = parseFloat(amountMatch[0].replace(',', '.'));
      if (!isNaN(val)) {
        setAmount(val.toString());
      }
    }

    // 3. Set Description
    const formattedDesc = text.charAt(0).toUpperCase() + text.slice(1);
    setDescription(formattedDesc);
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz. Prueba Chrome o Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error('Speech error', event);
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processVoiceCommand(transcript);
    };

    recognition.start();
  };

  const handleLineChange = (index: number, field: string, value: any) => {
     const newLines = [...lines];
     newLines[index] = { ...newLines[index], [field]: value };
     
     // If changing product, try to fill defaults
     if (field === 'productId') {
        const prod = productsList.find(p => p.id === value);
        if (prod) {
           newLines[index].product = prod.name;
           newLines[index].unitPrice = prod.price || 0;
           newLines[index].unit = prod.unit || 'und';
        }
     }
     
     setLines(newLines);
     
     // Auto-calculate total amount if needed (Optional, user might want to set it manually)
     // But usually amount = sum(lines). Let's update amount if lines exist.
     // const total = newLines.reduce((acc, l) => acc + (Number(l.qty)*Number(l.unitPrice)), 0);
     // setAmount(total.toFixed(2)); 
     // We won't force update amount to avoid overwriting user input if they differ.
  };

  const addLine = () => {
     setLines([...lines, { product: '', qty: 1, unitPrice: 0, unit: 'und' }]);
  };

  const removeLine = (index: number) => {
     setLines(lines.filter((_, i) => i !== index));
  };

  const handleCreateContact = async () => {
    if (!newContactName.trim()) return;
    if (!transaction?.projectId) { alert('No hay proyecto asociado'); return; }
    
    setCreatingContact(true);
    try {
      const payload = {
        projectId: transaction.projectId,
        name: newContactName,
        type: newContactType,
        taxId: newContactTaxId || undefined
      };
      const res = await api.contacts.create(payload);
      const contact = res.data?.data;
      if (contact) {
        setContactPersonId(contact.id);
        setShowContactModal(false);
        setNewContactName('');
        setNewContactTaxId('');
      }
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Error creando contacto');
    } finally {
      setCreatingContact(false);
    }
  };

  useEffect(() => {
    // Load lists
    const fetchLists = async () => {
       try {
         const [pRes, aRes, prodRes] = await Promise.all([
            api.projects.getAll({ limit: 100 }),
            api.accounts.getAll({ limit: 1000 }), // Ensure we get all accounts
            api.products.getAll({ limit: 1000 })
         ]);
         setProjects(pRes.data?.data || []);
         setAccounts(aRes.data?.data || []);
         setProductsList(prodRes.data?.data || []);
       } catch (e) {
         console.error('Error loading lists', e);
       }
    };
    fetchLists();
  }, []);

  useEffect(() => {
    if (transactionId) {
      loadTransaction();
    }
  }, [transactionId]);

  const loadTransaction = async () => {
    if (!transactionId) return;
    try {
      setLoading(true);
      const res = await api.transactions.getById(transactionId);
      const t = res.data.data;
      setTransaction(t);
      
      // Populate form
      setDescription(t.description || '');
      setAmount(String(t.amount || 0));
      setCurrency(t.currency || 'BS');
      
      if (t.date) {
        const d = new Date(t.date);
        const localDateStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setDate(localDateStr);
      } else {
        setDate('');
      }

      setReference(t.reference || '');
      setCategory(t.categoryRef?.name || t.category || '');
      setCategoryId(t.categoryId || '');
      setContactPersonId(t.contactPersonId || '');
      setPaymentStatus(t.paymentStatus || 'PENDING');
      setStatus(t.status || 'COMPLETED');
      setNotes(t.notes || '');
      setProjectId(t.projectId || '');
      
      // Helper to parse values that might have come as strings with commas from AI
      const parseInitialVal = (v: any, fallback: number) => {
         if (typeof v === 'number') return v;
         if (!v && v !== 0) return fallback;
         const str = String(v).replace(',', '.').replace(/[^0-9.-]/g, '');
         const num = parseFloat(str);
         return isNaN(num) ? fallback : num;
      };

      // Initialize lines
      let initialLines: any[] = [];
      if (t.lines) {
         let parsedData = t.lines;
         if (typeof t.lines === 'string') {
            try { parsedData = JSON.parse(t.lines); } catch(e) {}
         }
         
         if (Array.isArray(parsedData)) {
            initialLines = parsedData.map((l: any) => ({
               id: l.id,
               productId: l.productId,
               product: l.product || l.description || '', // Fallback
               qty: parseInitialVal(l.qty !== undefined ? l.qty : l.quantity, 1),
               unitPrice: parseInitialVal(l.unitPrice !== undefined ? l.unitPrice : l.price, 0),
               taxRate: l.taxRate || 0,
               unit: l.unit || 'und'
            }));
         }
      }
      setLines(initialLines);

      // Try to find the bank/cash account in entries
      if (t.entries && t.entries.length > 0) {
         // Lógica: La cuenta del "Haber" (Credit) si es Gasto, o "Debe" (Debit) si es Ingreso, que sea de tipo Activo (Banco/Caja)
         // O simplemente buscamos la cuenta que sea de tipo ASSET (BANK/CASH)
         // Sin embargo, t.entries no siempre trae el objeto completo 'account'.
         // Asumimos que podemos inferir por el ID si tuvieramos la lista, pero aquí solo tenemos el ID en los entries.
         // Vamos a intentar buscar la entry que NO es la de la categoría (ingreso/gasto).
         
         // Simplificación: Buscamos la entry que tenga una cuenta de tipo ASSET en nuestra lista de accounts cargada
         // Pero accounts se carga asíncronamente.
         // Mejor: Iteramos entries y asignamos el primero que machee con nuestra lista de accounts 'bancarias'.
         
         // Por ahora, solo guardamos el bankAccountId si lo encontramos en la data populada (si el backend lo devuelve plano)
         // Si no, analizaremos entries al renderizar o comparar.
         
         // Hack: check accounts list if available
         // We can't easily rely on accounts state inside this function due to closures if it's not in dependency.
         // We will retry detecting account inside a useEffect dependent on transaction and accounts.
      }
    } catch (err) {
      console.error('Error loading transaction', err);
      alert('Error cargando la transacción');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Detect bank account when transaction or accounts change
  useEffect(() => {
     if (transaction && accounts.length > 0) {
        // If we already have a selected account (e.g. user manually changed it), don't overwrite it unless it's empty
        if (bankAccountId) return;
        
        let targetAccountId = '';
        
        // 1. Try to find in entries (Best way)
        if (transaction.entries && Array.isArray(transaction.entries)) {
           const assetEntry = transaction.entries.find((e: any) => {
              const acct = accounts.find(a => a.id === e.accountId);
              // Check for Asset/Bank/Cash OR if the account name looks like a bank
              if (acct) {
                 return acct.type === 'ASSET' || acct.subType === 'BANK' || acct.subType === 'CASH' || 
                        acct.name.toLowerCase().includes('banco') || acct.name.toLowerCase().includes('caja');
              }
              return false;
           });
           if (assetEntry) targetAccountId = assetEntry.accountId;
        }

        // 2. Fallback: If no entry found, check if transaction object has account info directly
        if (!targetAccountId && transaction.accountId) {
           targetAccountId = transaction.accountId;
        }

        if (targetAccountId) {
           setBankAccountId(targetAccountId);
        }
     }
  }, [transaction, accounts]);

  const handleSave = async () => {
    if (!transactionId) return;
    try {
      setSaving(true);
      
      // Update entries if account changed
      let updatedEntries = undefined;
      if (transaction.entries && bankAccountId) {
          // Find old asset entry to replace it
          const assetEntryIndex = transaction.entries.findIndex((e: any) => {
             const acct = accounts.find(a => a.id === e.accountId);
             return acct && (acct.type === 'ASSET' || acct.subType === 'BANK' || acct.subType === 'CASH');
          });
          
          if (assetEntryIndex >= 0 && transaction.entries[assetEntryIndex].accountId !== bankAccountId) {
             updatedEntries = [...transaction.entries];
             updatedEntries[assetEntryIndex] = {
                ...updatedEntries[assetEntryIndex],
                accountId: bankAccountId
             };
          }
      }

      const payload = {
        description,
        amount: Number(amount.replace(',', '.')),
        currency,
        date: new Date(date).toISOString(),
        reference,
        category,
        categoryId,
        contactPersonId: contactPersonId || null,
        paymentStatus,
        status,
        projectId,
        notes,
        lines: lines.map(l => ({
           productId: l.productId,
           product: l.product,
           description: l.product, // Some backends use description
           qty: Number(l.qty),
           quantity: Number(l.qty),
           unitPrice: Number(l.unitPrice),
           price: Number(l.unitPrice),
           taxRate: Number(l.taxRate || 0)
        })),
        ...(updatedEntries ? { entries: updatedEntries } : {})
      };

      await api.transactions.update(transactionId, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating transaction', err);
      alert(err?.response?.data?.error?.message || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    if (!transactionId) return;
    if (!window.confirm('¿Estás seguro de que deseas revertir esta transacción?\n\nEsta acción:\n1. Revertirá los saldos de las cuentas afectadas.\n2. Cancelará los pagos asociados.\n3. Marcará la transacción como CANCELADA.\n\nEsta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      setSaving(true);
      await api.transactions.cancel(transactionId);
      alert('Transacción revertida correctamente');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error reverting transaction', err);
      alert(err?.response?.data?.error?.message || 'Error al revertir transacción');
    } finally {
      setSaving(false);
    }
  };

  if (!transactionId) return null;

  return (
    <>
    <SimpleModal 
      open={!!transactionId} 
      onClose={onClose} 
      title="Edición Rápida de Transacción"
      hideFooter={true}
    >
      {loading ? (
        <div className="p-8 text-center">Cargando...</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <div className="flex gap-2">
                <input 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  title="Dictar descripción"
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              {isListening && <p className="text-xs text-red-500 mt-1 animate-pulse">Escuchando... Di algo como "Pago de 50 dólares"</p>}
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Proyecto</label>
              <select 
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
              >
                <option value="">-- Sin Proyecto --</option>
                {projects.map(p => (
                   <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Cuenta de Pago (Origen/Destino)</label>
              <select 
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={bankAccountId}
                onChange={e => setBankAccountId(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                {accounts
                  .filter(a => a.projectId === projectId || !projectId) // Filter by project if selected
                  .filter(a => a.type === 'ASSET' || a.subType === 'BANK' || a.subType === 'CASH')
                  .map(a => (
                   <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Monto</label>
              <input 
                type="number"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Moneda</label>
              <select 
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                <option value="BS">BS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha y Hora</label>
              <input 
                type="datetime-local"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Referencia</label>
              <input 
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>

            <div className="col-span-2">
               <label className="block text-sm font-medium text-gray-700">Notas / Comentarios</label>
               <textarea 
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Detalles adicionales..."
               />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <CategorySelector 
                projectId={transaction?.projectId}
                value={categoryId ? { id: categoryId, name: category } : category}
                onChange={(v) => { setCategory(v.name || ''); setCategoryId(v.id || ''); }}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Cliente / Proveedor</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ContactAutocomplete 
                    projectId={transaction?.projectId}
                    value={contactPersonId}
                    onChange={(id) => setContactPersonId(id || '')}
                  />
                </div>
                <button 
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  title="Crear nuevo contacto"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Estado General</label>
              <select 
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="PENDING">Pendiente</option>
                <option value="COMPLETED">Completada</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="DRAFT">Borrador</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Estado de Pago</label>
              <select 
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value)}
              >
                <option value="PENDING">Pendiente</option>
                <option value="PARTIAL">Parcial</option>
                <option value="PAID">Pagado</option>
              </select>
            </div>
          </div>

          {/* Lines / Products Detail */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
               <h4 className="text-sm font-semibold text-slate-700">Detalle de Productos / Servicios</h4>
               <button 
                 type="button" 
                 onClick={addLine}
                 className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
               >
                 <Plus size={14} /> Agregar Item
               </button>
            </div>
            
            <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 w-[40%]">Producto</th>
                    <th className="px-3 py-2 text-center w-[15%]">Cant.</th>
                    <th className="px-3 py-2 text-right w-[20%]">Precio</th>
                    <th className="px-3 py-2 text-right w-[20%]">Total</th>
                    <th className="px-3 py-2 w-[5%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lines.length === 0 && (
                     <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 text-xs italic">
                           No hay productos agregados.
                        </td>
                     </tr>
                  )}
                  {lines.map((line: any, idx: number) => {
                      const parseVal = (v: any) => {
                           if (typeof v === 'number') return v;
                           if (!v) return 0;
                           const str = String(v).replace(',', '.').replace(/[^0-9.-]/g, '');
                           const num = parseFloat(str);
                           return isNaN(num) ? 0 : num;
                      };

                      const qty = parseVal(line.qty || line.quantity);
                      const price = parseVal(line.unitPrice || line.price);
                      let total = qty * price;
                      
                      return (
                          <tr key={idx}>
                            <td className="px-2 py-2">
                              {/* Product Selector / Input */}
                              <div className="flex flex-col gap-1">
                                 <input 
                                   list={`products-list-${idx}`}
                                   className="w-full text-xs p-1 border rounded bg-white"
                                   placeholder="Buscar o escribir..."
                                   value={line.product}
                                   onChange={e => {
                                      // Check if selected from list
                                      const val = e.target.value;
                                      const existing = productsList.find(p => p.name === val);
                                      if (existing) {
                                         handleLineChange(idx, 'productId', existing.id);
                                         // productId handler sets name/price automatically
                                      } else {
                                         handleLineChange(idx, 'product', val);
                                         handleLineChange(idx, 'productId', null);
                                      }
                                   }}
                                 />
                                 <datalist id={`products-list-${idx}`}>
                                    {productsList.map(p => <option key={p.id} value={p.name} />)}
                                 </datalist>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="number" 
                                className="w-full text-xs p-1 border rounded text-center"
                                value={line.qty}
                                onChange={e => handleLineChange(idx, 'qty', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input 
                                type="number" 
                                className="w-full text-xs p-1 border rounded text-right"
                                value={line.unitPrice}
                                onChange={e => handleLineChange(idx, 'unitPrice', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800">
                              {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(total)}
                            </td>
                            <td className="px-2 py-2 text-center">
                               <button 
                                 type="button" 
                                 onClick={() => removeLine(idx)}
                                 className="text-slate-400 hover:text-red-500"
                               >
                                  <Trash2 size={14} />
                               </button>
                            </td>
                          </tr>
                      );
                  })}
                </tbody>
              </table>
              
              {/* Summary Footer */}
              {lines.length > 0 && (
                 <div className="p-2 bg-slate-100 border-t flex justify-end gap-4 text-xs font-bold text-slate-700">
                    <span>Total Líneas:</span>
                    <span>
                       {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(
                          lines.reduce((acc, l) => {
                             const parseVal = (v: any) => {
                                if (typeof v === 'number') return v;
                                if (!v) return 0;
                                const str = String(v).replace(',', '.').replace(/[^0-9.-]/g, '');
                                const num = parseFloat(str);
                                return isNaN(num) ? 0 : num;
                             };
                             return acc + (parseVal(l.qty||0)*parseVal(l.unitPrice||0));
                          }, 0)
                       )}
                    </span>
                 </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            {status !== 'CANCELLED' && (
              <button 
                onClick={handleRevert}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                type="button"
              >
                Revertir Transacción
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SimpleModal>

      {/* Create Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Nuevo Contacto</h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  placeholder="Ej: Juan Pérez" 
                  value={newContactName} 
                  onChange={(e) => setNewContactName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo</label>
                <select 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  value={newContactType} 
                  onChange={(e) => setNewContactType(e.target.value)}
                >
                  <option value="CLIENT">Cliente</option>
                  <option value="PROVIDER">Proveedor</option>
                  <option value="BOTH">Ambos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Identificación (RIF/CI)</label>
                <input 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  placeholder="Opcional" 
                  value={newContactTaxId} 
                  onChange={(e) => setNewContactTaxId(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
              <button 
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                onClick={() => setShowContactModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                onClick={handleCreateContact}
                disabled={creatingContact || !newContactName.trim()}
              >
                {creatingContact ? 'Creando...' : 'Crear Contacto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
