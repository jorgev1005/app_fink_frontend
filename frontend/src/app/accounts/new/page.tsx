"use client"

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
type SubType = 'BANK' | 'CASH' | 'CREDIT_CARD' | 'EXCHANGE' | 'WALLET' | 'FINANCIAL' | 'OTHER'

export default function NewAccountPage() {
        // Cargar cuentas desactivadas al montar el componente
        useEffect(() => {
          api.accounts.getAll({ showInactive: true })
            .then(resp => setDeactivatedAccounts(resp.data.data.filter((a:any) => a.isActive === false)))
            .catch(() => {});
        }, []);
      // Función para desactivar cuentas contables
      const deactivateAccount = async () => {
        if (!deactivateId) return;
        setDeactivating(true);
        try {
          await api.accounts.update(deactivateId, { isActive: false });
          // Opcional: recargar cuentas desactivadas
          const resp = await api.accounts.getAll({ showInactive: true });
          setDeactivatedAccounts(resp.data.data.filter((a:any) => a.isActive === false));
        } catch (err) {
          // Manejo de error
        } finally {
          setDeactivating(false);
        }
      };
    // Estado para desactivar cuentas contables
    const [deactivating, setDeactivating] = useState(false);
    const [deactivateId, setDeactivateId] = useState('');
    const [deactivatedAccounts, setDeactivatedAccounts] = useState<any[]>([]);
  const router = useRouter()
  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [projects, setProjects] = useState<any[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AccountType>('ASSET')
  const [subType, setSubType] = useState<SubType>('BANK')
  const [currency, setCurrency] = useState<'USD' | 'BS' | 'EUR'>('USD')
  const [initialBalance, setInitialBalance] = useState<string>('0')
  const [batch, setBatch] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<any[]>([])
  const [accountsList, setAccountsList] = useState<any[]>([])
  const [openingModalOpen, setOpeningModalOpen] = useState(false)
  const [pendingOpening, setPendingOpening] = useState<{account:any, amount:number, currency:string} | null>(null)
  const [selectedContraId, setSelectedContraId] = useState<string | undefined>(undefined)
  const [creatingContra, setCreatingContra] = useState(false)
  const [autoCreateOpening, setAutoCreateOpening] = useState<boolean>(true)

  // New states for code suggestions
  const [filteredSuggestions, setFilteredSuggestions] = useState<any[]>([])
  const [nextSuggestedCode, setNextSuggestedCode] = useState<string | null>(null)

  useEffect(() => {
    // load accounts for contra selection later
    api.accounts.getAll().then(r => setAccountsList(r.data.data)).catch(() => {})
    // load projects so user can select a project when creating accounts
    api.projects.getAll().then(r => setProjects(r.data.data)).catch(() => {})
  }, [])

  // Logic to filter accounts and suggest next code based on user input
  const handleCodeChange = (val: string) => {
    setCode(val)
    
    if (!projectId || !val) {
      setFilteredSuggestions([])
      setNextSuggestedCode(null)
      return
    }

    // Filter accounts belonging to current project
    const projectAccounts = accountsList.filter(a => a.projectId === projectId || (a.project && a.project.id === projectId))
    
    // Find accounts that start with the input value (or are parents/siblings)
    // We want to show context. If user types '1.1', show '1.1.01', '1.1.02', etc.
    const matches = projectAccounts.filter(a => a.code && a.code.startsWith(val))
    
    // Sort by code length and then alphanumerically
    matches.sort((a, b) => a.code.localeCompare(b.code))
    
    setFilteredSuggestions(matches.slice(0, 5)) // Show top 5 matches

    // Suggest next code logic
    // If user typed '1.1.01', we look for siblings at that level
    // We try to find the "parent" prefix. E.g. if input is '1.1.', parent is '1.1'
    // If input is '1.1.01', maybe they want '1.1.02'
    
    // Simple heuristic: look for the deepest level in the input
    // If input ends in dot '1.1.', look for children of '1.1'
    // If input has no dot at end '1.1.01', look for siblings
    
    let prefix = val
    if (!val.endsWith('.')) {
      const lastDot = val.lastIndexOf('.')
      if (lastDot !== -1) {
        prefix = val.substring(0, lastDot + 1) // '1.1.'
      } else {
        prefix = '' // root level
      }
    }

    if (prefix) {
      const siblings = projectAccounts.filter(a => a.code && a.code.startsWith(prefix) && a.code !== prefix && !a.code.substring(prefix.length).includes('.'))
      
      let maxSuffix = 0
      siblings.forEach(s => {
        const suffix = s.code.substring(prefix.length)
        const num = parseInt(suffix)
        if (!isNaN(num) && num > maxSuffix) maxSuffix = num
      })
      
      if (maxSuffix > 0) {
        // Pad with leading zeros if the siblings have them? 
        // For simplicity, just increment. 
        // If existing is 01, 02... we should probably keep format.
        // Let's try to detect padding from the last sibling
        const lastSibling = siblings.find(s => parseInt(s.code.substring(prefix.length)) === maxSuffix)
        if (lastSibling) {
            const suffixStr = lastSibling.code.substring(prefix.length)
            const nextNum = maxSuffix + 1
            // simple padding check
            if (suffixStr.length > 1 && suffixStr.startsWith('0')) {
                 setNextSuggestedCode(prefix + nextNum.toString().padStart(suffixStr.length, '0'))
            } else {
                 setNextSuggestedCode(prefix + nextNum)
            }
        } else {
             setNextSuggestedCode(prefix + (maxSuffix + 1))
        }
      } else {
        // No siblings found, maybe start with .01?
        setNextSuggestedCode(prefix + '01')
      }
    }
  }

  const parseBatchLines = (text: string) => {
    // each line: code | name | subtype | currency | balance
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split('|').map(p => p.trim())
      return {
        code: parts[0] || '',
        name: parts[1] || parts[0] || '',
        subType: (parts[2] || 'BANK').toUpperCase() as SubType,
        currency: (parts[3] || 'USD').toUpperCase(),
        initialBalance: parts[4] || '0',
      }
    })
  }

  const typeMajorMap: Record<AccountType, number> = {
    ASSET: 1,
    LIABILITY: 2,
    EQUITY: 3,
    REVENUE: 4,
    EXPENSE: 5,
  }

  const extractTrailingNumber = (code: string) => {
    const m = code.match(/(\d+)\s*$/)
    return m ? Number(m[1]) : null
  }

  const suggestNextCode = (t: AccountType, s: SubType) => {
    // find existing accounts of same type/subtype
    const same = accountsList.filter(a => a.type === t && a.subType === s)
    // try to find trailing numeric parts and pick max
    let maxNum = 0
    for (const a of same) {
      const n = extractTrailingNumber(a.code || '')
      if (n && n > maxNum) maxNum = n
    }
    if (maxNum > 0) {
      return String(maxNum + 1)
    }

    // fallback: build a dotted code using major and subtype index
    const major = typeMajorMap[t] || 9
    // try to find group number for subtype among existing codes for type
    const sameType = accountsList.filter(a => a.type === t && a.code)
    let subgroup = 1
    if (sameType.length > 0) {
      // try to parse first existing code like '1.2.03' and reuse the middle group
      const parts = (sameType[0].code || '').split(/[^0-9]+/).filter(Boolean)
      if (parts.length >= 2) subgroup = Number(parts[1]) || 1
    }
    return `${major}.${subgroup}.01`
  }

  useEffect(() => {
    // when accounts list or type/subtype changes, auto-suggest a code if field empty
    if (!code) {
      try {
        const suggestion = suggestNextCode(type, subType)
        if (suggestion) setCode(suggestion)
      } catch (e) {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsList, type, subType])

  const handleCreate = async (e?: any) => {
    if (e) e.preventDefault()
    setCreating(true)
    const createdAccs: any[] = []
    try {
      const items = batch ? parseBatchLines(batch) : [{ code, name, subType, currency, initialBalance }]
      // Prevent creating accounts with an initial balance when no project is selected
      // only enforce when auto creation of opening transaction is enabled
      const hasInitialWithNoProject = items.some(it => Number(it.initialBalance || 0) > 0 && !projectId && autoCreateOpening)
      if (hasInitialWithNoProject) {
        alert('Selecciona un proyecto antes de crear cuentas con saldo inicial. Asigna primero el proyecto en el formulario.')
        setCreating(false)
        return
      }
      for (const it of items) {
        // If an initial balance is provided, prepare payload to let backend create opening transaction atomically
        const initialAmt = Number(it.initialBalance || 0)
        const initialCurr = (it.currency || currency || 'BS') as 'BS' | 'USD' | 'EUR'

        let contraId: string | undefined = selectedContraId
        // find or create an EQUITY contrapartida when needed (only when autoCreateOpening is enabled)
        if (initialAmt > 0 && autoCreateOpening) {
          // try to find existing equity account in same project
          const equity = accountsList.find(a => a.type === 'EQUITY' && (a.project?.id || a.projectId) === (projectId || undefined))
          if (equity) {
            contraId = equity.id
          } else {
            // create equity account automatically
            try {
              const eqPayload = {
                code: `EQ-OPEN-${Date.now()}`,
                name: 'Opening Balances (Equity)',
                description: 'Cuenta creada automáticamente para saldos iniciales',
                type: 'EQUITY',
                subType: 'CAPITAL',
                projectId: projectId || undefined,
              }
              const eqRes = await api.accounts.create(eqPayload)
              contraId = eqRes.data.data.id
              // refresh accounts list to include the newly created equity
              const resp2 = await api.accounts.getAll()
              setAccountsList(resp2.data.data)
            } catch (err) {
              console.error('Error creando cuenta de patrimonio automática', err)
            }
          }
        }

        const payload: any = {
           code: it.code,
           name: it.name,
           description: description || '',
           type: type,
           subType: it.subType || subType,
           projectId: projectId || undefined,
           currency, // Siempre incluir la moneda seleccionada
        }

        if (initialAmt > 0 && autoCreateOpening) {
          payload.initialBalance = initialAmt
          payload.initialCurrency = initialCurr
          if (contraId) payload.contraAccountId = contraId
        }

        const res = await api.accounts.create(payload)
        const createdObj: any = { account: res.data.data, initialBalance: initialAmt, currency: it.currency }
        if (res.data.openingTransaction) createdObj.openingTransaction = res.data.openingTransaction
        createdAccs.push(createdObj)
      }
      setCreated(createdAccs)
      // reload accounts list
      const resp = await api.accounts.getAll()
      setAccountsList(resp.data.data)
      // Refresh created accounts from server to pick up any balance updates (e.g. opening transactions created separately)
      for (let i = 0; i < createdAccs.length; i++) {
        try {
          const id = createdAccs[i].account.id
          if (id) {
            const fresh = await api.accounts.getById(id)
            createdAccs[i].account = fresh.data.data
          }
        } catch (err) {
          // ignore individual refresh errors
        }
      }
      setCreated([...createdAccs])

      // Reset form fields for next entry
      setCode('')
      setName('')
      setDescription('')
      setInitialBalance('0')
      setBatch('')
      setFilteredSuggestions([])
      setNextSuggestedCode(null)

    } catch (err: any) {
      console.error('Error creating accounts', err)
      alert(err?.response?.data?.error?.message || err.message || 'Error')
    } finally {
      setCreating(false)
    }
  }

  const openOpeningModal = (acct: any, amount: number, currency: string) => {
    // set pending opening and open modal; default select an EQUITY account if present
    setPendingOpening({ account: acct, amount, currency })
    const equity = accountsList.find(a => a.type === 'EQUITY' && a.id !== acct.id)
    const firstAvailable = accountsList.find(a => a.id !== acct.id)
    setSelectedContraId(equity?.id || firstAvailable?.id)
    setOpeningModalOpen(true)
  }

  const createEquityAccount = async () => {
    // create a simple equity account for opening balances
    setCreatingContra(true)
    try {
      if (!projectId) {
        alert('Selecciona un proyecto antes de crear la cuenta de patrimonio automática.')
        setCreatingContra(false)
        return
      }
      const payload = {
        code: `EQ-OPEN-${Date.now()}`,
        name: 'Opening Balances (Equity)',
        description: 'Cuenta creada automáticamente para saldos iniciales',
        type: 'EQUITY',
        subType: 'OTHER',
        projectId: projectId || undefined,
      }
      const res = await api.accounts.create(payload)
      // refresh list and select new
      const resp = await api.accounts.getAll()
      setAccountsList(resp.data.data)
      setSelectedContraId(res.data.data.id)
    } catch (err: any) {
      console.error('Error creando cuenta de patrimonio', err)
      alert(err?.response?.data?.error?.message || err.message || 'Error creando cuenta')
    } finally {
      setCreatingContra(false)
    }
  }

  const createOpeningTransactionConfirmed = async () => {
    if (!pendingOpening) return
    const { account: acct, amount, currency } = pendingOpening
    const contra = accountsList.find(a => a.id === selectedContraId)
    if (!contra) {
      alert('Selecciona una cuenta contrapartida válida')
      return
    }

    // Ensure the account has a project; transaction creation requires projectId
    const targetProjectId = acct.project?.id || acct.projectId || undefined
    if (!targetProjectId) {
      alert('La cuenta no está asociada a un proyecto. Edita la cuenta y asigna un proyecto antes de crear el saldo inicial.')
      return
    }

    const isAsset = acct.type === 'ASSET'
    const tx: any = {
      // account object may include `project` relation (project: { id, name })
      // older code assumed `acct.projectId` which is undefined when server returns `project` object
      projectId: targetProjectId,
      type: 'ADJUSTMENT',
      description: `Saldo inicial para ${acct.code}`,
      date: new Date().toISOString().slice(0,10),
      currency,
      amount: Math.abs(amount),
      entries: []
    }

    if (isAsset) {
      // debit asset, credit contra
      tx.entries.push({ debitAccountId: acct.id, debitAmount: Math.abs(amount), creditAccountId: contra.id, creditAmount: Math.abs(amount) })
    } else {
      // liability: credit account, debit contra
      tx.entries.push({ debitAccountId: contra.id, debitAmount: Math.abs(amount), creditAccountId: acct.id, creditAmount: Math.abs(amount) })
    }

    try {
      const res = await api.transactions.create(tx)
      alert('Transacción de apertura creada: ' + res.data.data.code)
      setOpeningModalOpen(false)
      setPendingOpening(null)
    } catch (err: any) {
      console.error(err)
      alert('Error creando transacción de apertura: ' + (err?.response?.data?.error?.message || err.message))
    }
  }

  // Estado para mostrar/ocultar el listado completo de códigos
  const [showAllCodes, setShowAllCodes] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Crear Nueva Cuenta</h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Registra una nueva cuenta contable o importa varias en lote
            </p>
          </div>
          <button
            onClick={() => router.push('/accounts')}
            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
          >
            Volver
          </button>
        </div>

        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-md p-4 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Project */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto *</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={projectId || ''}
                onChange={e => setProjectId(e.target.value || undefined)}
                required
              >
                <option value="">-- Selecciona un proyecto --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Código</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                placeholder="Ej: 1.1.01"
                autoComplete="off"
              />
              {/* Suggestions Panel */}
              {(filteredSuggestions.length > 0 || nextSuggestedCode) && projectId && code && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-md text-sm">
                  {nextSuggestedCode && (
                    <div className="mb-2 pb-2 border-b border-blue-200">
                      <span className="text-gray-600">Sugerencia: </span>
                      <button 
                        type="button"
                        onClick={() => handleCodeChange(nextSuggestedCode)}
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {nextSuggestedCode}
                      </button>
                    </div>
                  )}
                  {filteredSuggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Cuentas existentes similares:</p>
                      <ul className="space-y-1">
                        {filteredSuggestions.map(acc => (
                          <li key={acc.id} className="flex justify-between text-gray-700">
                            <span className="font-mono font-medium">{acc.code}</span>
                            <span className="truncate ml-2 text-gray-500">{acc.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {/* Botón para ver todos los códigos */}
              {projectId && accountsList.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="text-xs text-blue-700 underline hover:text-blue-900"
                    onClick={() => setShowAllCodes(v => !v)}
                  >
                    {showAllCodes ? 'Ocultar todos los códigos' : 'Ver todos los códigos'}
                  </button>
                </div>
              )}
              {/* Listado completo de códigos (expandible) */}
              {showAllCodes && projectId && accountsList.length > 0 && (
                <div className="mt-2 max-h-64 overflow-y-auto border border-blue-200 bg-blue-50 rounded-md p-3 text-xs">
                  <div className="font-semibold text-gray-600 mb-2">Plan de cuentas del proyecto:</div>
                  <ul className="space-y-1">
                    {accountsList
                      .filter(acc => acc.projectId === projectId || acc.project?.id === projectId)
                      .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
                      .map(acc => (
                        <li key={acc.id} className="flex justify-between text-gray-700">
                          <span className="font-mono font-medium">{acc.code}</span>
                          <span className="truncate ml-2 text-gray-500">{acc.name}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Banco Nacional"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo Contable</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={type}
                onChange={e => setType(e.target.value as AccountType)}
              >
                <option value="ASSET">Activo</option>
                <option value="LIABILITY">Pasivo</option>
                <option value="EQUITY">Patrimonio</option>
                <option value="REVENUE">Ingreso</option>
                <option value="EXPENSE">Gasto</option>
              </select>
            </div>

            {/* SubType */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subtipo</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={subType}
                onChange={e => setSubType(e.target.value as SubType)}
              >
                <option value="BANK">Banco</option>
                <option value="CASH">Efectivo / Caja Chica</option>
                <option value="CREDIT_CARD">Tarjeta de Crédito</option>
                <option value="EXCHANGE">Exchange / Broker</option>
                <option value="WALLET">Wallet / Crypto</option>
                <option value="FINANCIAL">Financiera / Inversión</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={currency}
                onChange={e => setCurrency(e.target.value as any)}
              >
                <option value="USD">USD</option>
                <option value="BS">BS</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Initial Balance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Inicial (Opcional)</label>
              <input
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={initialBalance}
                onChange={e => setInitialBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Auto Create Checkbox */}
            <div className="md:col-span-2 flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input
                id="autoCreateOpening"
                type="checkbox"
                checked={autoCreateOpening}
                onChange={e => setAutoCreateOpening(e.target.checked)}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="autoCreateOpening" className="text-sm text-gray-700">
                Crear transacción de apertura automáticamente si se especifica saldo inicial
              </label>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descripción opcional de la cuenta..."
              />
            </div>

            {/* Batch Creation */}
            <div className="md:col-span-2 border-t pt-6 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Creación en Lote (Opcional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Pega varias líneas para crear múltiples cuentas. Formato: <code>código | nombre | subtipo | moneda | saldo</code>
              </p>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={4}
                placeholder="Ej: 101|Banco ABC|BANK|USD|1000"
                value={batch}
                onChange={e => setBatch(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creando...' : 'Crear Cuenta'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/accounts')}
              className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>

        {/* Created List */}
        {created.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Cuentas Creadas Recientemente</h2>
            <ul className="space-y-3">
              {created.map((c, idx) => (
                <li key={idx} className="p-4 border border-gray-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50">
                  <div>
                    <div className="font-semibold text-gray-900">{c.account.code} — {c.account.name}</div>
                    <div className="text-sm text-gray-500">
                      {c.account.type} / {c.account.subType} • {c.currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition"
                      onClick={() => openOpeningModal(c.account, Number(c.initialBalance || 0), c.currency)}
                    >
                      Crear saldo inicial
                    </button>
                    <button
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition"
                      onClick={() => window.location.href = `/accounts/${c.account.id}`}
                    >
                      Ver Detalle
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bloque para desactivar cuentas y ver las desactivadas */}
        <div className="mt-8 p-4 border rounded-lg">
          <h3 className="font-bold mb-2">Desactivar cuenta contable</h3>
          <select
            value={deactivateId}
            onChange={e => setDeactivateId(e.target.value)}
            className="px-3 py-2 border rounded mr-2 min-w-[250px]"
          >
            <option value="">Selecciona una cuenta...</option>
            {accountsList.filter(acc => acc.isActive !== false).map(acc => (
              <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
            ))}
          </select>
          <button
            onClick={deactivateAccount}
            disabled={deactivating || !deactivateId}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            Desactivar
          </button>
          <div className="mt-4">
            <h4 className="font-semibold">Cuentas desactivadas:</h4>
            <ul>
              {deactivatedAccounts.map(acc => (
                <li key={acc.id}>{acc.code} - {acc.name}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal */}
        {openingModalOpen && pendingOpening && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md transform transition-all">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Seleccionar Contrapartida</h3>
              <p className="text-sm text-gray-600 mb-6">
                Cuenta a abrir: <span className="font-medium text-gray-900">{pendingOpening.account.code} — {pendingOpening.account.name}</span>
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta Contrapartida</label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={selectedContraId || ''}
                  onChange={e => setSelectedContraId(e.target.value || undefined)}
                >
                  <option value="">-- Selecciona una cuenta --</option>
                  {accountsList.filter(a => a.id !== pendingOpening.account.id).map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  onClick={createOpeningTransactionConfirmed}
                >
                  Confirmar Transacción
                </button>
                
                <div className="flex gap-3">
                  <button
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                    onClick={createEquityAccount}
                    disabled={creatingContra}
                  >
                    {creatingContra ? 'Creando...' : 'Crear Patrimonio Auto'}
                  </button>
                  <button
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
                    onClick={() => setOpeningModalOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
