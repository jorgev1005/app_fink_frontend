"use client"

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Command, ArrowRight } from 'lucide-react'

type Action = {
  id: string
  name: string
  perform: () => void
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const actions: Action[] = [
    { id: 'dashboard', name: 'Ir al Dashboard', perform: () => router.push('/dashboard') },
    { id: 'accounts', name: 'Ver Plan de Cuentas', perform: () => router.push('/accounts') },
    { id: 'new-transaction', name: 'Nueva Transacción', perform: () => router.push('/transactions/new') },
    { id: 'contacts', name: 'Contactos', perform: () => router.push('/contacts') },
    { id: 'reports', name: 'Reportes', perform: () => router.push('/reports') },
  ]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (isMac && e.metaKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setOpen((v) => {
          const next = !v
          if (next) {
            // track palette open
            import('@/lib/analytics').then((m) => m.default.track('palette_open'))
          }
          return next
        })
      }
      if (e.key === 'Escape') setOpen(false)
    }
    // global keyboard listener
    window.addEventListener('keydown', onKey)

    // allow tests or other code to open the palette by dispatching a custom event
    const onOpenEvent = () => {
      setOpen(true)
      import('@/lib/analytics').then((m) => m.default.track('palette_open'))
    }
    window.addEventListener('open-command-palette', onOpenEvent)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setHighlight(0)
    }
  }, [open])

  const results = actions.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))

  function onSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const act = results[highlight] || actions[0]
    if (act) {
      import('@/lib/analytics').then((m) => m.default.track('palette_select', { action: act.id }))
      act.perform()
      setOpen(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      onSubmit()
    }
  }

  return (
    <div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-[15vh]">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl glass-card p-0 overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200 shadow-2xl shadow-blue-900/20">
            <div className="flex items-center border-b border-slate-100 px-4 py-3">
              <Search className="text-slate-400 mr-3" size={20} />
              <input
                id="cp-input"
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="¿Qué quieres hacer?"
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 text-lg"
                autoComplete="off"
              />
              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                <span className="font-sans">ESC</span>
              </div>
            </div>
            
            <ul className="max-h-[60vh] overflow-y-auto p-2">
              {results.length === 0 && (
                <li className="px-4 py-8 text-center text-slate-500">
                  <Command className="mx-auto mb-2 text-slate-300" size={32} />
                  <p>No se encontraron resultados</p>
                </li>
              )}
              {results.map((r, idx) => (
                <li
                  key={r.id}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => { r.perform(); setOpen(false) }}
                  className={`px-4 py-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    idx === highlight 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${idx === highlight ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Command size={16} />
                    </div>
                    <span className="font-medium">{r.name}</span>
                  </div>
                  {idx === highlight && <ArrowRight size={16} className="text-blue-400" />}
                </li>
              ))}
            </ul>
            
            <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
              <span>FINK Command Palette</span>
              <div className="flex gap-3">
                <span className="flex items-center gap-1"><kbd className="font-sans bg-white border border-slate-200 rounded px-1">↑</kbd> <kbd className="font-sans bg-white border border-slate-200 rounded px-1">↓</kbd> navegar</span>
                <span className="flex items-center gap-1"><kbd className="font-sans bg-white border border-slate-200 rounded px-1">↵</kbd> seleccionar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
