'use client';

import { useState } from 'react';
import { STANDARD_ACCOUNTS, StandardAccount } from '@/lib/standardAccounts';
import { X, Check, ChevronRight, ChevronDown, Info } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (accounts: StandardAccount[]) => void;
}

export default function StandardAccountImporter({ isOpen, onClose, onImport }: Props) {
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({
    ASSET: true,
    LIABILITY: false,
    EQUITY: false,
    REVENUE: false,
    EXPENSE: false,
  });

  if (!isOpen) return null;

  const toggleSelection = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedCodes(next);
  };

  const toggleType = (type: string) => {
    setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const selectAllType = (type: string) => {
    const accountsOfType = STANDARD_ACCOUNTS.filter(a => a.type === type);
    const allSelected = accountsOfType.every(a => selectedCodes.has(a.code));
    
    const next = new Set(selectedCodes);
    accountsOfType.forEach(a => {
      if (allSelected) {
        next.delete(a.code);
      } else {
        next.add(a.code);
      }
    });
    setSelectedCodes(next);
  };

  const handleImport = () => {
    const selected = STANDARD_ACCOUNTS.filter(a => selectedCodes.has(a.code));
    onImport(selected);
    onClose();
  };

  const grouped = STANDARD_ACCOUNTS.reduce((acc, curr) => {
    if (!acc[curr.type]) acc[curr.type] = [];
    acc[curr.type].push(curr);
    return acc;
  }, {} as Record<string, StandardAccount[]>);

  const typeLabels: Record<string, string> = {
    ASSET: 'Activos',
    LIABILITY: 'Pasivos',
    EQUITY: 'Patrimonio',
    REVENUE: 'Ingresos',
    EXPENSE: 'Gastos',
  };

  const typeColors: Record<string, string> = {
    ASSET: 'text-green-700 bg-green-50',
    LIABILITY: 'text-red-700 bg-red-50',
    EQUITY: 'text-blue-700 bg-blue-50',
    REVENUE: 'text-purple-700 bg-purple-50',
    EXPENSE: 'text-orange-700 bg-orange-50',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Catálogo Estándar de Cuentas</h2>
            <p className="text-sm text-slate-500 mt-1">Selecciona las cuentas que deseas agregar a tu proyecto</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {Object.entries(grouped).map(([type, accounts]) => (
            <div key={type} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className={`px-4 py-3 flex items-center justify-between ${typeColors[type] || 'bg-gray-50'}`}>
                <button 
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wide"
                >
                  {expandedTypes[type] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {typeLabels[type]}
                </button>
                <button 
                  onClick={() => selectAllType(type)}
                  className="text-xs font-medium hover:underline opacity-80"
                >
                  {accounts.every(a => selectedCodes.has(a.code)) ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              </div>
              
              {expandedTypes[type] && (
                <div className="divide-y divide-gray-100">
                  {accounts.map(account => (
                    <div 
                      key={account.code} 
                      className={`px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer ${selectedCodes.has(account.code) ? 'bg-blue-50/50' : ''}`}
                      onClick={() => toggleSelection(account.code)}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedCodes.has(account.code) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                        {selectedCodes.has(account.code) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{account.code}</span>
                          <span className="font-medium text-slate-800 text-sm">{account.name}</span>
                        </div>
                        {account.description && (
                          <p className="text-xs text-slate-500 mt-1 ml-1">{account.description}</p>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-50 rounded">
                        {account.subType}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Info className="w-4 h-4 text-blue-500" />
            <span>{selectedCodes.size} cuentas seleccionadas</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={handleImport}
              disabled={selectedCodes.size === 0}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
            >
              Importar Cuentas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
