"use client";
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import ContactAutocomplete from '@/components/ContactAutocomplete';
import CategorySelector from '@/components/CategorySelector';
import InvoiceCamera from '@/components/InvoiceCamera';
import SimpleCalculator from '@/components/SimpleCalculator';
import { 
  Calendar, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Plus, 
  Trash2, 
  User, 
  Tag, 
  Briefcase, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Save,
  Calculator,
  Building2,
  Wallet,
  UserPlus,
  X,
  Camera,
  Upload,
  Paperclip,
  Mic,
  Star,
  Bookmark,
  BookmarkPlus
} from 'lucide-react';

type Line = {
  id: string;
  product: string;
  qty: number | '';
  unitPrice: string; // Changed to string to support decimals better
  currency: 'BS' | 'USD';
  // product details editable inline
  unit?: string;
  taxable?: boolean;
  taxRate?: number | '';
  stock?: number | '';
};

function uid() { return Math.random().toString(36).slice(2,9); }

export default function QuickTransaction({ defaultProjectId }: { defaultProjectId?: string }) {
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '');
  const [projects, setProjects] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [currency, setCurrency] = useState<'BS'|'USD'>('BS');
  // Use backend enum values for `type` but show Spanish labels in the UI
  const [transactionType, setTransactionType] = useState<'INCOME'|'EXPENSE'|'TRANSFER'|'ADJUSTMENT'>('EXPENSE');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [makePending, setMakePending] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<string>('');
  const [descriptionText, setDescriptionText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [contactPersonId, setContactPersonId] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [rateMode, setRateMode] = useState<'DASHBOARD' | 'CUSTOM'>('DASHBOARD');
  const [showRateCalculator, setShowRateCalculator] = useState(false);
  const [hasAccountPrefs, setHasAccountPrefs] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');

  // Attachments & Camera
  const [showCamera, setShowCamera] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Voice Recognition State
  const [isListening, setIsListening] = useState(false);

  const processVoiceCommand = (text: string) => {
    const lower = text.toLowerCase();
    
    // 1. Detect Project (Improved)
    // Tokenize project names and look for matches in the spoken text
    let bestMatchProjId = '';
    let maxMatchLen = 0;
    // Common words to ignore in project names to avoid false positives
    const stopWords = ['inversiones', 'grupo', 'corporacion', 'empresa', 'sociedad', 'c.a.', 's.a.', 's.r.l.', 'rl', 'proyecto', 'familia', 'casa', 'de', 'el', 'la', 'los', 'las', 'y'];

    projects.forEach(p => {
       // Normalize project name: lowercase, remove special chars
       const cleanName = p.name.toLowerCase().replace(/[.,-]/g, '');
       const nameParts = cleanName.split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.includes(w));
       
       for (const part of nameParts) {
          // Check if this distinctive keyword appears in the spoken text (whole word match preferred)
          // We use a simple includes first, but could use regex for word boundaries
          if (lower.includes(part)) {
             if (part.length > maxMatchLen) {
                maxMatchLen = part.length;
                bestMatchProjId = p.id;
             }
          }
       }
    });

    if (bestMatchProjId) {
      setProjectId(bestMatchProjId);
    } else {
       // Fallback: Try exact match of full name or "lucem" special case
       const matchedProject = projects.find(p => lower.includes(p.name.toLowerCase()));
       if (matchedProject) setProjectId(matchedProject.id);
       else if (lower.includes('lucem')) {
          const lucem = projects.find(p => p.name.toLowerCase().includes('lucem'));
          if (lucem) setProjectId(lucem.id);
       }
    }

    // 2. Detect Type
    if (lower.includes('gasto') || lower.includes('compra') || lower.includes('pago')) setTransactionType('EXPENSE');
    else if (lower.includes('ingreso') || lower.includes('cobro') || lower.includes('venta')) setTransactionType('INCOME');
    else if (lower.includes('transferencia')) setTransactionType('TRANSFER');

    // 3. Detect Currency
    if (lower.includes('dólar') || lower.includes('dolar') || lower.includes('usd') || lower.includes('usdt')) setCurrency('USD');
    else if (lower.includes('bolívar') || lower.includes('bolivar') || lower.includes('bs')) setCurrency('BS');

    // 4. Detect Amount (simple regex for numbers)
    // Looks for patterns like "50 dólares" or "100.50"
    const amountMatch = text.match(/(\d+([.,]\d+)?)/);
    if (amountMatch) {
      const val = parseFloat(amountMatch[0].replace(',', '.'));
      if (!isNaN(val)) {
        setLines(prev => {
          const newLines = [...prev];
          if (newLines.length > 0) {
            newLines[0].unitPrice = val.toString();
            newLines[0].qty = 1;
          }
          return newLines;
        });
      }
    }

    // 5. Set Description
    // Capitalize first letter
    const formattedDesc = text.charAt(0).toUpperCase() + text.slice(1);
    setDescriptionText(formattedDesc);
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

  const handleCaptureInvoice = async (file: File) => {
    setInvoiceImage(file);
    setSelectedFiles(prev => [...prev, file]);
    setShowCamera(false);

    // Auto-scan (OCR)
    setIsScanning(true);
    const toastId = toast.loading('🔍 Analizando factura...');

    try {
      const res = await api.scan.invoice(file);
      const { amount, date: scannedDate, nif } = res.data.data;
      
      let msgParts: string[] = [];
      
      if (amount) {
         setLines(prev => prev.map((l, idx) => idx === 0 ? { ...l, unitPrice: amount.toString() } : l));
         msgParts.push(`Monto: ${amount}`);
      }

      if (scannedDate) {
        // Tries to parse dd/mm/yyyy or yyyy-mm-dd
        let isoDate = scannedDate;
        if (scannedDate.includes('/')) {
             const parts = scannedDate.split('/');
             if (parts.length === 3) {
                // assume dd/mm/yyyy
                isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
             }
        }
        // Basic check if valid date
        if (!isNaN(Date.parse(isoDate))) {
            setDate(isoDate);
            msgParts.push(`Fecha: ${isoDate}`);
        }
      }

      if (nif) {
         if (!descriptionText) setDescriptionText(`Factura ${nif}`);
         if (!reference) setReference(nif);
         msgParts.push(`NIF: ${nif}`);
      }

      if (msgParts.length > 0) {
        toast.success(`Datos detectados: ${msgParts.join(', ')}`, { id: toastId });
      } else {
        toast.info('No se encontraron datos legibles en la imagen', { id: toastId });
      }

    } catch (e) {
      console.error(e);
      toast.error('Error al procesar la imagen', { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    if (projectId) {
      api.transactionTemplates.getAll(projectId).then(res => {
        setTemplates(res.data?.data || []);
      }).catch(() => {});
    } else {
      setTemplates([]);
    }
  }, [projectId]);

  // Quick Contact Creation State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactType, setNewContactType] = useState('CLIENT');
  const [newContactTaxId, setNewContactTaxId] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  const handleCreateContact = async () => {
    if (!newContactName.trim()) return;
    if (!projectId) { setError('Selecciona un proyecto primero'); return; }
    
    setCreatingContact(true);
    try {
      const payload = {
        projectId,
        name: newContactName,
        type: newContactType,
        taxId: newContactTaxId || undefined
      };
      const res = await api.contacts.create(payload);
      const contact = res.data?.data;
      if (contact) {
        setContactPersonId(contact.id);
        setSuccess(`Contacto "${contact.name}" creado`);
        setShowContactModal(false);
        setNewContactName('');
        setNewContactTaxId('');
      }
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Error creando contacto');
    } finally {
      setCreatingContact(false);
    }
  };

  // Save/load prefs with optional scope: project-level, by-type, by-category
  const saveAccountPrefs = (projId: string, debitId: string | '', creditId: string | '', opts?: { type?: string | null, categoryId?: string | null }) => {
    if (!projId) return;
    try {
      // project-level
      const projKey = `fink_accounts_pref_${projId}`;
      localStorage.setItem(projKey, JSON.stringify({ debit: debitId || null, credit: creditId || null }));
      // by-type
      if (opts?.type) {
        const byTypeKey = `fink_accounts_pref_${projId}_byType`;
        const existing = JSON.parse(localStorage.getItem(byTypeKey) || '{}');
        existing[opts.type] = { debit: debitId || null, credit: creditId || null };
        localStorage.setItem(byTypeKey, JSON.stringify(existing));
      }
      // by-category
      if (opts?.categoryId) {
        const catKey = `fink_accounts_pref_${projId}_cat_${opts.categoryId}`;
        localStorage.setItem(catKey, JSON.stringify({ debit: debitId || null, credit: creditId || null }));
      }
      setHasAccountPrefs(true);
      if (opts?.type) setHasAccountPrefsDetail(`tipo:${opts.type}`);
      else if (opts?.categoryId) setHasAccountPrefsDetail(`categoria:${opts.categoryId}`);
      else setHasAccountPrefsDetail('proyecto');
    } catch (e) {}
  };

  const loadAccountPrefs = (projId: string, opts?: { type?: string | null, categoryId?: string | null }) => {
    if (!projId) return null;
    try {
      // priority: category -> type -> project
      if (opts?.categoryId) {
        const catKey = `fink_accounts_pref_${projId}_cat_${opts.categoryId}`;
        const v = localStorage.getItem(catKey);
        if (v) return JSON.parse(v);
      }
      if (opts?.type) {
        const byTypeKey = `fink_accounts_pref_${projId}_byType`;
        const stored = localStorage.getItem(byTypeKey);
        if (stored) {
          const parsed = JSON.parse(stored || '{}');
          if (parsed[opts.type]) return parsed[opts.type];
        }
      }
      const projKey = `fink_accounts_pref_${projId}`;
      const v = localStorage.getItem(projKey);
      if (!v) return null;
      return JSON.parse(v);
    } catch (e) { return null; }
  };

  const clearAccountPrefs = (projId: string) => {
    if (!projId) return;
    try { localStorage.removeItem(`fink_accounts_pref_${projId}`); localStorage.removeItem(`fink_accounts_pref_${projId}_byType`); setHasAccountPrefs(false); setHasAccountPrefsDetail(null); } catch (e) {}
  };
  const [hasAccountPrefsDetail, setHasAccountPrefsDetail] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([{ id: uid(), product: '', qty: 1, unitPrice: '', currency: 'BS', unit: undefined, taxable: false, taxRate: '', stock: '' }]);
  const [rates, setRates] = useState<any>(null);
  const [dashboardRate, setDashboardRate] = useState<number | null>(null);
  const [quickProducts, setQuickProducts] = useState<string[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const pj = await api.projects.getAll();
        setProjects((pj.data?.data || []).filter((p: any) => p.status !== 'PAUSED'));
      } catch (e) {
        // ignore
      }

      try {
        // Fetch all rates to determine the correct dashboard rate based on preference
        const r = await api.exchangeRates.getLatestBySource();
        const allRates = r.data?.data || {};
        
        // Determine preferred rate
        const preferred = localStorage.getItem('preferredExchangeRate');
        let rateToUse = allRates.BCV?.usdToBs; // Default to BCV

        if (preferred) {
           if (preferred === 'BINANCE' || preferred === 'API') {
             rateToUse = allRates.BINANCE?.usdToBs || allRates.API?.usdToBs;
           } else if (preferred === 'CUSTOM') {
             rateToUse = allRates.CUSTOM?.usdToBs;
           } else if (preferred === 'BCV' || preferred === 'BCV_OFFICIAL') {
             rateToUse = allRates.BCV?.usdToBs;
           } else if (allRates.CUSTOM?.id === preferred) {
             rateToUse = allRates.CUSTOM?.usdToBs;
           }
        }
        
        // Fallback if preferred is missing
        if (!rateToUse) rateToUse = allRates.BCV?.usdToBs;

        setDashboardRate(rateToUse);
        setRates({ usdToBs: rateToUse }); // Keep compatibility with existing code using rates.usdToBs

        // try to use dashboard-selected rate from localStorage if present
        try {
          const keys = ['selected_exchange_rate','fink_selected_rate','exchange_rate','selectedRate'];
          let stored = null;
          for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v) { stored = v; break; }
          }
          if (stored) {
            const n = Number(stored);
            if (!isNaN(n) && n > 0) {
              setSelectedRate(n);
              // If stored rate differs significantly from dashboard rate, assume custom
              if (rateToUse && Math.abs(n - rateToUse) > 0.01) {
                setRateMode('CUSTOM');
              } else {
                setRateMode('DASHBOARD');
                setSelectedRate(null); // Use dashboard rate dynamically
              }
            }
          } else {
            setRateMode('DASHBOARD');
          }
        } catch (e) {}
      } catch (e) {
        // ignore
      }

      // Exponer helpers globales para probar/ajustar la tasa desde consola u otras vistas
      try {
        (window as any).setFinkSelectedRate = (v: number | string) => {
          try { localStorage.setItem('selected_exchange_rate', String(v)); return true; } catch (e) { return false; }
        };
        (window as any).getFinkSelectedRate = () => {
          try { return localStorage.getItem('selected_exchange_rate'); } catch (e) { return null; }
        };
      } catch (e) {}

      try {
        // Load global products (no project filter) to populate quick list
        const prodResp = await api.products.getAll({ limit: 100 });
        const prods = prodResp.data?.data || [];
        setProductsList(prods);
        const names = Array.from(new Set(prods.map((p: any) => (p.name || '').toString().trim()).filter(Boolean)));
        // apply aggressive normalization and dedupe
        const normalized = dedupeDisplayNames(names as string[]);
        setQuickProducts(normalized.slice(0, 50));
      } catch (e) {
        // fallback to localStorage for older setups
        try {
          const stored = localStorage.getItem('quick_products');
          if (stored) setQuickProducts(JSON.parse(stored));
        } catch (er) {}
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const ac = await api.accounts.getAll({ projectId });
        const accs = ac.data?.data || [];
        setAccounts(accs);
        // Try load persisted prefs first
          try {
          const prefs = loadAccountPrefs(projectId, { type: transactionType as any, categoryId: categoryId || null });
            if (prefs && prefs.debit) {
              // ensure stored ids still exist in accounts
              const foundDebit = accs.find((a: any) => a.id === prefs.debit);
              const foundCredit = prefs.credit ? accs.find((a: any) => a.id === prefs.credit) : null;
              if (foundDebit) {
                setDebitAccount(foundDebit.id);
                setCreditAccount(foundCredit ? foundCredit.id : (accs.find((a: any) => a.id !== foundDebit.id)?.id || foundDebit.id));
                setHasAccountPrefs(true);
                // mark detail depending on what matched (category preferred earlier)
                if (categoryId) setHasAccountPrefsDetail(`categoria:${categoryId}`);
                else setHasAccountPrefsDetail(`tipo:${transactionType}`);
              } else {
                setHasAccountPrefs(false);
                setHasAccountPrefsDetail(null);
              }
            } else {
            // Preseleccionar cuentas por proyecto: preferir cuentas de tipo/banco
            let debitId: string | '' = '';
            let creditId: string | '' = '';
            if (accs.length > 0) {
              const bySubType = (a: any) => (a.subType || a.subtype || a.subType || '').toString().toUpperCase();
              const byType = (a: any) => (a.type || '').toString().toUpperCase();
              
              if (transactionType === 'INCOME') {
                // Income: Debit = BANK/CASH (asset), Credit = REVENUE
                const debitCandidate = accs.find((a: any) => bySubType(a) === 'CASH') || accs.find((a: any) => bySubType(a) === 'BANK') || accs.find((a: any) => byType(a) === 'ASSET');
                const creditCandidate = accs.find((a: any) => byType(a) === 'REVENUE') || accs.find((a: any) => byType(a) === 'EQUITY') || accs.find((a: any) => a.id !== (debitCandidate?.id || ''));
                debitId = debitCandidate?.id || (accs[0]?.id || '');
                creditId = creditCandidate?.id || accs.find((a: any) => a.id !== debitId)?.id || debitId;
              } else if (transactionType === 'EXPENSE') {
                // Expense: Debit = EXPENSE account, Credit = BANK/CASH
                const debitCandidate = accs.find((a: any) => byType(a) === 'EXPENSE') || accs.find((a: any) => bySubType(a) === 'OPERATIONAL') || accs.find((a: any) => byType(a) !== 'ASSET');
                const creditCandidate = accs.find((a: any) => bySubType(a) === 'CASH') || accs.find((a: any) => bySubType(a) === 'BANK') || accs.find((a: any) => byType(a) === 'ASSET');
                debitId = debitCandidate?.id || (accs[0]?.id || '');
                creditId = creditCandidate?.id || accs.find((a: any) => a.id !== debitId)?.id || debitId;
              } else {
                // default fallback
                const bankAccs = accs.filter((a: any) => bySubType(a).includes('BANK'));
                if (bankAccs.length > 0) {
                  debitId = bankAccs[0].id;
                  if (bankAccs.length > 1) creditId = bankAccs[1].id;
                  else creditId = accs.find((a: any) => a.id !== debitId)?.id || debitId;
                } else {
                  debitId = accs[0].id;
                  creditId = accs.length > 1 ? accs[1].id : accs[0].id;
                }
              }
            }
            setDebitAccount(debitId);
            setCreditAccount(creditId);
            // persist heuristics so user will have consistent defaults next time
            try { saveAccountPrefs(projectId, debitId, creditId); } catch (e) {}
          }
        } catch (e) {
          // ignore selection errors
        }
      } catch (e) {
        setAccounts([]);
      }
      // load products for project to show in quick list
      try {
        const presp = await api.products.getAll({ projectId, limit: 200 });
        const prods = presp.data?.data || [];
        setProductsList(prods);
        const names = Array.from(new Set(prods.map((p: any) => (p.name || '').toString().trim()).filter(Boolean)));
        const normalized = dedupeDisplayNames(names as string[]);
        setQuickProducts(normalized);
      } catch (e) {
        // ignore
      }
    })();
  }, [projectId]);

  const addLine = () => setLines(l => [...l, { id: uid(), product: '', qty: 1, unitPrice: '', currency, unit: undefined, taxable: false, taxRate: '', stock: '' }]);
  const removeLine = (id: string) => setLines(l => l.filter(x => x.id !== id));
  const updateLine = (id: string, patch: Partial<Line>) => setLines(l => l.map(x => x.id === id ? { ...x, ...patch } : x));

  const normalizeNumber = (v: string|number|undefined) => {
    if (v === undefined || v === null) return 0;
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (!s) return 0;
    return Number(s.replace(/\./g,'').replace(/,/g,'.')) || 0;
  };

  const lineTotal = (ln: Line) => {
    const q = Number(ln.qty || 0);
    const p = normalizeNumber(ln.unitPrice);
    let subtotal = q * p;
    if (ln.taxable && ln.taxRate) {
      subtotal += subtotal * (Number(ln.taxRate) / 100);
    }
    return subtotal;
  };

  const totals = () => {
    // compute totals in BS and USD using selectedRate (from dashboard/localStorage) or API rates
    const usdToBs = (selectedRate && Number(selectedRate)) ? Number(selectedRate) : (dashboardRate ? Number(dashboardRate) : undefined);
    let totalBs = 0;
    let totalUsd = 0;
    for (const ln of lines) {
      const t = lineTotal(ln);
      if (ln.currency === 'BS') {
        totalBs += t;
        if (usdToBs) totalUsd += t / usdToBs;
      } else {
        totalUsd += t;
        if (usdToBs) totalBs += t * usdToBs;
      }
    }
    return { totalBs, totalUsd };
  };

  // Templates Handlers
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      const payload = {
        name: newTemplateName,
        projectId,
        type: transactionType,
        description: descriptionText,
        categoryId: categoryId || undefined,
        contactPersonId: contactPersonId || undefined,
        currency,
        amount: currency === 'USD' ? totals().totalUsd : totals().totalBs,
        debitAccountId: debitAccount || undefined,
        creditAccountId: creditAccount || undefined,
        paymentMethod,
        lines
      };
      const res = await api.transactionTemplates.create(payload);
      if (res.data?.success) {
        setTemplates(prev => [res.data.data, ...prev]);
        setShowSaveTemplateModal(false);
        setNewTemplateName('');
        setSuccess('Plantilla guardada');
      }
    } catch (e) {
      setError('Error guardando plantilla');
    }
  };

  const handleLoadTemplate = (t: any) => {
    setTransactionType(t.type);
    setDescriptionText(t.description || '');
      setNotes(t.notes || '');
    setCategoryId(t.categoryId || '');
    setCategory(''); 
    setContactPersonId(t.contactPersonId || '');
    setCurrency(t.currency as any);
    setDebitAccount(t.debitAccountId || '');
    setCreditAccount(t.creditAccountId || '');
    setPaymentMethod(t.paymentMethod || 'CASH');
    
    if (t.lines && Array.isArray(t.lines)) {
      setLines(t.lines.map((l: any) => ({ ...l, id: uid() })));
    }
    
    setShowTemplatesModal(false);
    setSuccess('Plantilla cargada');
  };

  const handleDeleteTemplate = async (id: string) => {
      if(!confirm('¿Eliminar plantilla?')) return;
      try {
          await api.transactionTemplates.delete(id);
          setTemplates(prev => prev.filter(t => t.id !== id));
      } catch(e) {}
  };

  const saveQuickProduct = async (name: string, projId?: string, unitPrice?: number | '', curr?: string, unit?: string, taxable?: boolean, taxRate?: number | '', stock?: number | '', qty?: number, type?: string) => {
    if (!name) return;
    
    // Check if product already exists
    const existing = productsList.find(p => normalizeForKey(p.name) === normalizeForKey(name));
    
    if (projId) {
      try {
        if (existing) {
           // Update stock if qty and type are provided
           if (qty && type) {
             let newStock = Number(existing.stock || 0);
             if (type === 'EXPENSE') newStock += qty;
             else if (type === 'INCOME') newStock -= qty;
             
             // Only update if changed
             if (newStock !== existing.stock) {
                await api.products.update(existing.id, { stock: newStock });
                // update local list
                setProductsList(prev => prev.map(p => p.id === existing.id ? { ...p, stock: newStock } : p));
             }
           }
           return;
        }

        const payload: any = {
          name,
          projectId: projId,
          unitPrice: unitPrice || 0,
          currency: curr || 'USD',
          ...(unit !== undefined && { unit }),
          ...(taxable !== undefined && { taxable }),
          ...(taxRate !== undefined && { taxRate }),
          stock: (stock !== undefined && stock !== '') ? stock : (type === 'EXPENSE' && qty ? qty : 0),
        };
        const resp = await api.products.create(payload);
        const p = resp.data?.data;
        if (p) {
          // update local lists
          setProductsList(prev => [p, ...prev].slice(0,200));
          setQuickProducts(prev => dedupeDisplayNames([p.name, ...prev]).slice(0,50));
          return;
        }
      } catch (err) {
        // if backend fails, fallback to localStorage below
      }
    }

    // fallback: keep in localStorage for offline/dev
    const arr = dedupeDisplayNames([name, ...quickProducts]).slice(0,50);
    setQuickProducts(arr);
    try { localStorage.setItem('quick_products', JSON.stringify(arr)); } catch (e) {}
  };

  // Aggressive normalization to dedupe similar product names.
  // Lowercase, remove diacritics, strip punctuation, collapse spaces, remove common company tokens.
  const normalizeForKey = (s: string) => {
    if (!s) return '';
    let t = s.toString().trim().toLowerCase();
    // remove accents
    try { t = t.normalize('NFD').replace(/\p{Diacritic}/gu, ''); } catch (e) { /* ignore if not supported */ }
    // replace punctuation with space
    t = t.replace(/[\.\,_\-\(\)\[\]\/:]/g, ' ');
    // remove common corporate suffixes and tokens
    t = t.replace(/\b(srl|s\.r\.l\.|ltda|c\.a\.|ca|inc|sa|corp|co|company|ci|c\.?a\.?)\b/g, '');
    // remove any non-alphanumeric except space
    t = t.replace(/[^a-z0-9\s]/g, '');
    // collapse spaces
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  };

  const dedupeDisplayNames = (names: string[]) => {
    const map = new Map<string, string>();
    for (const n of names) {
      const k = normalizeForKey(n);
      if (!k) continue;
      if (!map.has(k)) map.set(k, n);
    }
    return Array.from(map.values());
  };

  const submit = async () => {
    setError(null); setSuccess(null);
    if (!projectId) return setError('Selecciona un proyecto');
    if (!descriptionText || descriptionText.trim().length === 0) return setError('La descripción es requerida');
    if (!debitAccount || !creditAccount) return setError('Selecciona cuentas débito y crédito');
    
    // Check for currency mismatches
    const debitObj = accounts.find((a: any) => a.id === debitAccount);
    const creditObj = accounts.find((a: any) => a.id === creditAccount);
    const debitMismatch = debitObj && debitObj.currency && debitObj.currency !== currency;
    const creditMismatch = creditObj && creditObj.currency && creditObj.currency !== currency;
    
    if (debitMismatch || creditMismatch) {
      let msg = '⚠️ ADVERTENCIA DE MONEDA ⚠️\n\n';
      msg += `Estás registrando una transacción en ${currency}, pero:\n`;
      if (debitMismatch) msg += `- La cuenta origen (${debitObj.name}) es ${debitObj.currency}.\n`;
      if (creditMismatch) msg += `- La cuenta destino (${creditObj.name}) es ${creditObj.currency}.\n`;
      msg += '\nEsto forzará al sistema a aplicar una conversión automática a la tasa del día para ajustar los saldos.\n\n¿Estás SEGURO de que deseas continuar?';
      
      const proceed = window.confirm(msg);
      if (!proceed) return;
    }

    const entries: any[] = [];
      for (const ln of lines) {
      const amt = lineTotal(ln);
      if (amt <= 0) continue;
      // push debit entry
      entries.push({ debitAccountId: debitAccount, debitAmount: amt, description: ln.product });
      // push credit entry
      entries.push({ creditAccountId: creditAccount, creditAmount: amt, description: ln.product });
      if (ln.product && ln.product.trim()) await saveQuickProduct(ln.product.trim(), projectId, normalizeNumber(ln.unitPrice), ln.currency, ln.unit, ln.taxable, ln.taxRate as any, ln.stock as any, Number(ln.qty), transactionType);
    }
    if (entries.length === 0) return setError('No hay líneas válidas');

    const usdToBs = (selectedRate && Number(selectedRate)) ? Number(selectedRate) : (dashboardRate ? Number(dashboardRate) : undefined);

    const payload: any = {
      mode: 'TRANSACTION',
      projectId,
      type: transactionType,
      description: descriptionText || 'Transacción rápida',
      contactPersonId: contactPersonId || undefined,
      reference: reference || undefined,
        notes: notes || undefined,
      category: category || undefined,
      categoryId: categoryId || undefined,
      date,
      status: makePending ? 'PENDING' : undefined,
      dueDate: makePending && dueDate ? dueDate : undefined,
      currency,
      exchangeRate: usdToBs || undefined,
      amount: currency === 'USD' ? totals().totalUsd : totals().totalBs,
      entries,
      lines, // Send the lines detail to backend
      createAsPending: makePending,
      paymentMethod: !makePending ? paymentMethod : undefined,
      paymentReference: !makePending && paymentReference ? paymentReference : undefined,
    };

    setLoading(true);
    try {
      const res = await api.entries.create(payload);
      const j = res.data;
      if (j.success) {
        const createdId = j.data?.transaction?.id || j.data?.id;
        
        // Upload attachments if any
        if (createdId && selectedFiles.length > 0) {
          const fd = new FormData();
          selectedFiles.forEach((f) => fd.append('files', f));
          try {
            await api.transactions.uploadAttachments(createdId, fd);
          } catch (err) {
            console.warn('Error subiendo attachments:', err);
            alert('Transacción creada, pero hubo un error subiendo archivos.');
          }
        }

        setSuccess('Transacción creada');
        // reset
        setLines([{ id: uid(), product: '', qty: 1, unitPrice: '', currency, unit: undefined, taxable: false, taxRate: '', stock: '' }]);
        setDescriptionText('');
        setReference('');
        setContactPersonId('');
        setSelectedFiles([]);
        setInvoiceImage(null);
      } else {
        setError(j.error?.message || 'Error al crear transacción');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const { totalBs, totalUsd } = totals();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="w-6 h-6 text-blue-600" />
              Registro de Operaciones
            </h3>
            <p className="text-slate-500 text-sm mt-1">Registra movimientos, gastos o ingresos con múltiples líneas</p>
          </div>
          <div className="flex gap-2">
             <button 
                className="btn btn-ghost text-sm text-slate-500 hover:text-amber-600" 
                type="button" 
                onClick={() => setShowTemplatesModal(true)}
                title="Cargar Favorito"
              >
                <Bookmark className="w-4 h-4 mr-2 inline" />
                Favoritos
              </button>
              <button 
                className="btn btn-ghost text-sm text-slate-500 hover:text-amber-600" 
                type="button" 
                onClick={() => setShowSaveTemplateModal(true)}
                title="Guardar como Favorito"
                disabled={!projectId || !descriptionText}
              >
                <BookmarkPlus className="w-4 h-4 mr-2 inline" />
                Guardar
              </button>
             <button 
                className="btn btn-ghost text-sm text-slate-500 hover:text-blue-600" 
                type="button" 
                onClick={() => {
                  setLines([{ id: uid(), product: '', qty: 1, unitPrice: '', currency, unit: undefined, taxable: false, taxRate: '', stock: '' }]); 
                  setSuccess(null); 
                  setError(null); 
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                Limpiar
              </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Header Section: Project, Type, Date */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Proyecto</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm appearance-none"
                  value={projectId} 
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">-- Seleccionar Proyecto --</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ${p.name}` : p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tipo de Transacción</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm appearance-none"
                  value={transactionType} 
                  onChange={(e) => setTransactionType(e.target.value as any)}
                >
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Gasto</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="ADJUSTMENT">Ajuste</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Moneda Principal</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm appearance-none"
                  value={currency} 
                  onChange={(e) => {
                    const newCurr = e.target.value as 'BS'|'USD';
                    setCurrency(newCurr);
                    // Opcional: actualizar todas las líneas a la nueva moneda para agilizar
                    setLines(prev => prev.map(l => ({ ...l, currency: newCurr })));
                  }}
                >
                  <option value="BS">BS</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-4">
             <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Soportes (Facturas, Recibos)</label>
                <div className="flex items-center gap-3">
                   <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium shadow-sm"
                   >
                      <Camera className="w-4 h-4" />
                      Escanear
                   </button>
                   <div className="relative">
                      <input
                         type="file"
                         multiple
                         id="file-upload"
                         className="hidden"
                         onChange={(e) => setSelectedFiles(prev => [...prev, ...(e.target.files ? Array.from(e.target.files) : [])])}
                      />
                      <label 
                        htmlFor="file-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium cursor-pointer shadow-sm"
                      >
                        <Paperclip className="w-4 h-4" />
                        Adjuntar
                      </label>
                   </div>
                </div>
             </div>
             
             {/* File List */}
             {(selectedFiles.length > 0) && (
                <div className="flex-1 w-full">
                   <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Archivos Seleccionados ({selectedFiles.length})</div>
                   <div className="flex flex-wrap gap-2">
                      {selectedFiles.map((f, i) => (
                         <div key={i} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm shadow-sm">
                            <span className="truncate max-w-[150px]">{f.name}</span>
                            <button 
                               type="button"
                               onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                               className="text-slate-400 hover:text-red-500"
                            >
                               <X className="w-3 h-3" />
                            </button>
                         </div>
                      ))}
                   </div>
                </div>
             )}
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      placeholder="Ej: Pago de servicios del mes" 
                      value={descriptionText} 
                      onChange={(e) => setDescriptionText(e.target.value)} 
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`p-2 rounded-xl transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    title="Dictar descripción"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
                {isListening && <p className="text-xs text-red-500 mt-1 animate-pulse">Escuchando... Di algo como "Gasto de 50 dólares en Lucem"</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cliente / Proveedor</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <ContactAutocomplete 
                      projectId={projectId} 
                      value={contactPersonId} 
                      onChange={(cid: string | null) => setContactPersonId(cid || '')} 
                      placeholder="Buscar contacto..." 
                      disabled={!projectId} 
                    />
                  </div>
                  <button 
                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    disabled={!projectId}
                    title="Crear nuevo contacto"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
                {!projectId && <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Selecciona un proyecto primero</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notas / Comentarios</label>
                  <textarea
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm resize-none"
                    placeholder="Detalles adicionales..."
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Referencia</label>
                  <input 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                    placeholder="Ej: Factura #123" 
                    value={reference} 
                    onChange={(e) => setReference(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Categoría</label>
                  <CategorySelector 
                    projectId={projectId} 
                    value={category} 
                    onChange={(v: any) => { setCategory(v?.name || ''); setCategoryId(v?.id || ''); }} 
                    placeholder="Seleccionar..." 
                    disabled={!projectId} 
                  />
                </div>
              </div>
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tasa de Cambio</label>
                  <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                    <button 
                      type="button"
                      onClick={() => {
                        setRateMode('DASHBOARD');
                        setSelectedRate(null);
                        localStorage.removeItem('selected_exchange_rate');
                      }} 
                      className={`px-2 py-1 text-[10px] rounded transition-colors ${rateMode === 'DASHBOARD' ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Dashboard
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setRateMode('CUSTOM');
                        if (!selectedRate && dashboardRate) {
                          setSelectedRate(dashboardRate);
                        }
                      }} 
                      className={`px-2 py-1 text-[10px] rounded transition-colors ${rateMode === 'CUSTOM' ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200 relative">
                  {rateMode === 'CUSTOM' && (
                    <button 
                      type="button"
                      onClick={() => setShowRateCalculator(!showRateCalculator)}
                      className={`p-1 rounded hover:bg-slate-100 transition-colors ${showRateCalculator ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                      title="Calculadora"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                  )}
                  {rateMode === 'DASHBOARD' && <Calculator className="w-4 h-4 text-slate-400" />}
                  
                  {rateMode === 'DASHBOARD' ? (
                    <span className="flex-1 text-sm font-mono font-medium text-slate-600">
                      {dashboardRate ? new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(dashboardRate) : '---'}
                    </span>
                  ) : (
                    <input 
                      type="number"
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-mono font-medium text-slate-700 p-0"
                      value={selectedRate || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSelectedRate(isNaN(val) ? null : val);
                        localStorage.setItem('selected_exchange_rate', e.target.value);
                      }}
                      placeholder="0.00"
                    />
                  )}
                  <span className="text-xs text-slate-400 font-medium">Bs/USD</span>

                  {showRateCalculator && rateMode === 'CUSTOM' && (
                    <SimpleCalculator 
                      initialValue={selectedRate || ''}
                      onClose={() => setShowRateCalculator(false)}
                      onResult={(val) => {
                        setSelectedRate(val);
                        localStorage.setItem('selected_exchange_rate', String(val));
                        setShowRateCalculator(false);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Payment & Status Section */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex flex-wrap gap-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Estado de Pago</label>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-200">
                  <input 
                    type="checkbox" 
                    id="makePending"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    checked={makePending} 
                    onChange={(e) => setMakePending(e.target.checked)} 
                  />
                  <label htmlFor="makePending" className="text-sm text-slate-700 cursor-pointer select-none">
                    Marcar como Pendiente (Por Pagar/Cobrar)
                  </label>
                </div>
              </div>

              {makePending ? (
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fecha de Vencimiento</label>
                  <input 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                  />
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Método de Pago</label>
                    <select 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      value={paymentMethod} 
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="BANK_TRANSFER">Transferencia bancaria</option>
                      <option value="MOBILE_PAYMENT">Pago Móvil</option>
                      <option value="CARD">Tarjeta (Crédito/Débito)</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ref. Pago</label>
                    <input 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                      placeholder="Opcional" 
                      value={paymentReference} 
                      onChange={(e) => setPaymentReference(e.target.value)} 
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Lines Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalle de Items</label>
              <button 
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                onClick={addLine}
              >
                <Plus className="w-3 h-3" /> Añadir Línea
              </button>
            </div>
            
            <div className="space-y-3">
              {lines.map((ln, idx) => (
                <div key={ln.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap gap-3 items-start">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Producto / Servicio</label>
                      <input 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                        placeholder="Producto o Servicio" 
                        value={ln.product} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = productsList.find((p: any) => p.name === val);
                          updateLine(ln.id, { 
                            product: val,
                            stock: found ? (found.stock ?? '') : ln.stock,
                            unit: found?.unit || ln.unit
                          });
                        }} 
                        list="quick-products" 
                      />
                      <datalist id="quick-products">
                        {quickProducts.map((p) => <option key={p} value={p} />)}
                      </datalist>
                      {(ln.stock !== '' && ln.stock !== undefined) && (
                        <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                           <span className="font-bold">Stock:</span> {ln.stock}
                        </div>
                      )}
                    </div>
                    
                    <div className="w-20">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-center">Cant.</label>
                      <input 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-center"
                        type="number" 
                        min="0" 
                        step="1" 
                        placeholder="Cant."
                        value={String(ln.qty)} 
                        onChange={(e) => updateLine(ln.id, { qty: Number(e.target.value) || '' })} 
                      />
                    </div>
                    
                    <div className="w-32">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 text-right">Precio</label>
                      <input 
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm text-right"
                        placeholder="Precio" 
                        value={String(ln.unitPrice)} 
                        onChange={(e) => updateLine(ln.id, { unitPrice: e.target.value })} 
                      />
                    </div>
                    
                    <div className="w-24">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Moneda</label>
                      <select 
                        className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                        value={ln.currency} 
                        onChange={(e) => updateLine(ln.id, { currency: e.target.value as any })}
                      >
                        <option value="BS">Bs</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>

                    <div className="w-32 py-2 text-right font-mono font-medium text-slate-700 mt-5">
                      {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(lineTotal(ln))}
                    </div>

                    <div className="flex items-center gap-1 mt-5">
                      <button 
                        className={`p-2 rounded-lg hover:bg-slate-100 transition-colors ${ln.unit ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                        onClick={() => updateLine(ln.id, { unit: ln.unit ? undefined : (ln.unit || 'u') })} 
                        title="Detalles adicionales"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => removeLine(ln.id)}
                        title="Eliminar línea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {ln.unit !== undefined && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-1">
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 font-bold">Unidad</label>
                        <select 
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                          value={ln.unit || ''} 
                          onChange={(e) => updateLine(ln.id, { unit: e.target.value })} 
                        >
                          <option value="">-- Seleccionar --</option>
                          {["Unidad", "Piezas", "Caja", "Bolsa", "Docena", "centimetro", "milimetro", "metro", "kilgramo", "gramo", "litro", "mililitro", "paleta", "contenedor", "Otros"].map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 font-bold">Impuestos</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={!!ln.taxable} 
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              updateLine(ln.id, { 
                                taxable: isChecked,
                                taxRate: isChecked ? (ln.taxRate || 16) : ln.taxRate 
                              });
                            }} 
                          />
                          <span className="text-xs text-slate-600">Gravable</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 font-bold">Tasa (%)</label>
                        <input 
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                          type="number" 
                          step="0.01" 
                          value={String(ln.taxRate ?? '')} 
                          onChange={(e) => updateLine(ln.id, { taxRate: Number(e.target.value) || '' })} 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-slate-400 font-bold">Stock</label>
                        <input 
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                          type="number" 
                          step="0.0001" 
                          value={String(ln.stock ?? '')} 
                          onChange={(e) => updateLine(ln.id, { stock: Number(e.target.value) || '' })} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-end items-center gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase font-bold">Total Bolívares</div>
                <div className="text-xl font-mono font-bold text-slate-800">Bs {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalBs)}</div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase font-bold">Total Dólares</div>
                <div className="text-xl font-mono font-bold text-green-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUsd)}</div>
              </div>
            </div>
          </div>

          {/* Accounts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {transactionType === 'INCOME' ? 'Cuenta a Recibir (Banco/Caja)' : 
                 transactionType === 'EXPENSE' ? 'Categoría de Gasto (Alquiler, Nómina)' : 
                 'Cuenta Débito (Entrada)'}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  value={debitAccount} 
                  onChange={(e) => { const v = e.target.value; setDebitAccount(v); try { if (projectId) saveAccountPrefs(projectId, v, creditAccount); } catch {} }}
                >
                  <option value="">-- Seleccionar --</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} — ${a.name}` : a.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                {transactionType === 'INCOME' ? 'Categoría de Ingreso (Ventas, Servicios)' : 
                 transactionType === 'EXPENSE' ? 'Cuenta a Pagar (Banco/Caja)' : 
                 'Cuenta Crédito (Salida)'}
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                  value={creditAccount} 
                  onChange={(e) => { const v = e.target.value; setCreditAccount(v); try { if (projectId) saveAccountPrefs(projectId, debitAccount, v); } catch {} }}
                >
                  <option value="">-- Seleccionar --</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} — ${a.name}` : a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          
          {hasAccountPrefs && projectId && (
            <div className="flex items-center justify-between bg-green-50 px-4 py-2 rounded-lg border border-green-100">
              <span className="text-xs text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Cuentas predeterminadas cargadas para este proyecto
              </span>
              <button 
                type="button" 
                className="text-xs text-green-700 hover:text-green-800 underline font-medium" 
                onClick={() => { clearAccountPrefs(projectId); }}
              >
                Restablecer preferencias
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-slate-100">
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-sm mr-auto">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-100 text-sm mr-auto">
                <CheckCircle2 className="w-4 h-4" />
                {success}
              </div>
            )}
            
            <button 
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={submit} 
              disabled={loading}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'Guardando...' : 'Guardar Operación'}
            </button>
          </div>
        </div>
      </div>

      {/* Create Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
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
      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-500" />
                Transacciones Favoritas
              </h3>
              <button onClick={() => setShowTemplatesModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {templates.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Star className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                  <p>No tienes plantillas guardadas</p>
                </div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all cursor-pointer" onClick={() => handleLoadTemplate(t)}>
                    <div>
                      <div className="font-medium text-slate-800">{t.name}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{t.description}</div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                      className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Guardar como Favorito</h3>
              <button onClick={() => setShowSaveTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de la plantilla</label>
              <input 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm"
                placeholder="Ej: Pago de Nómina"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                autoFocus
              />
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                  onClick={() => setShowSaveTemplateModal(false)}
                >
                  Cancelar
                </button>
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  onClick={handleSaveTemplate}
                  disabled={!newTemplateName.trim()}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <InvoiceCamera
          onCapture={handleCaptureInvoice}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}
