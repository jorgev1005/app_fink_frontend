'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Camera, Users, Home, X, Zap } from 'lucide-react';

export default function QuickActionButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  // No mostrar en ciertas páginas
  if (pathname === '/login' || pathname === '/register' || pathname?.startsWith('/pos')) {
    return null;
  }

  const actions = [
    {
      icon: Plus,
      label: 'Nueva Transacción',
      action: () => router.push('/transactions/new'),
      color: 'bg-blue-500'
    },
    {
      icon: Camera,
      label: 'Escanear Factura',
      action: () => router.push('/transactions/new'),
      color: 'bg-purple-500'
    },
    {
      icon: Users,
      label: 'Nuevo Contacto',
      action: () => router.push('/contacts'),
      color: 'bg-emerald-500'
    },
    {
      icon: Home,
      label: 'Ir al Dashboard',
      action: () => router.push('/dashboard'),
      color: 'bg-slate-500'
    },
  ];

  return (
    <>
      {/* Overlay */}
      {showMenu && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Action Menu */}
      {showMenu && (
        <div className="fixed bottom-24 right-6 z-50 space-y-4 md:hidden flex flex-col items-end">
          {actions.map((action, index) => (
            <div
              key={index}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-sm font-medium text-slate-700 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl shadow-sm border border-white/50">
                {action.label}
              </span>
              <button
                onClick={() => {
                  action.action();
                  setShowMenu(false);
                }}
                className={`${action.color} text-white w-12 h-12 rounded-2xl shadow-lg shadow-slate-200 flex items-center justify-center transition-transform hover:scale-110 active:scale-95`}
              >
                <action.icon size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center transition-all duration-300 md:hidden ${
          showMenu
            ? 'bg-slate-800 text-white rotate-90'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        aria-label="Acciones rápidas"
      >
        {showMenu ? <X size={24} /> : <Zap size={24} />}
      </button>
    </>
  );
}
