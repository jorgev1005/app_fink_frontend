'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Package, Check, Tag } from 'lucide-react';

export interface ProductItem {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice?: number;
  priceList?: number;
  stock?: number;
  unit?: string;
  division?: string;
  currency?: string;
}

interface ProductAutocompleteProps {
  products: ProductItem[];
  value?: string; // productId
  customName?: string;
  onSelect: (product: ProductItem | null) => void;
  onCustomChange?: (name: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ProductAutocomplete({
  products = [],
  value,
  customName = '',
  onSelect,
  onCustomChange,
  placeholder = 'Buscar por nombre, SKU o código...',
  className = '',
  disabled = false,
}: ProductAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected product object
  const selectedProduct = products.find(p => p.id === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products by all search terms (e.g. "caja pequeña")
  const filteredProducts = React.useMemo(() => {
    if (!search.trim()) {
      return products.slice(0, 40);
    }
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return products.filter(p => {
      const searchTarget = `${p.name} ${p.sku || ''} ${p.description || ''} ${p.division || ''}`.toLowerCase();
      return terms.every(term => searchTarget.includes(term));
    }).slice(0, 50);
  }, [products, search]);

  const handleSelectProduct = (product: ProductItem) => {
    setIsCustomMode(false);
    setSearch('');
    setIsOpen(false);
    onSelect(product);
  };

  const handleSelectCustom = () => {
    setIsCustomMode(true);
    setIsOpen(false);
    onSelect(null);
    if (onCustomChange && search) {
      onCustomChange(search);
    }
  };

  const handleClear = () => {
    setIsCustomMode(false);
    setSearch('');
    onSelect(null);
    if (onCustomChange) onCustomChange('');
    setTimeout(() => {
      inputRef.current?.focus();
      setIsOpen(true);
    }, 50);
  };

  // If a product is already selected
  if (selectedProduct && !isCustomMode) {
    return (
      <div className={`relative flex items-center justify-between p-2 bg-blue-50/70 border border-blue-200 rounded-lg text-xs ${className}`}>
        <div className="min-w-0 flex-1 flex items-center gap-1.5 pr-2">
          {selectedProduct.sku && (
            <span className="bg-blue-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">
              {selectedProduct.sku}
            </span>
          )}
          <span className="font-semibold text-slate-800 truncate" title={selectedProduct.name}>
            {selectedProduct.name}
          </span>
          {selectedProduct.unitPrice !== undefined && (
            <span className="text-[10px] text-blue-700 font-bold ml-auto shrink-0 font-mono">
              ${selectedProduct.unitPrice.toFixed(2)}
            </span>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 hover:bg-blue-200/60 rounded text-blue-600 hover:text-blue-900 transition-colors shrink-0"
            title="Cambiar producto"
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  }

  // If in custom mode
  if (isCustomMode) {
    return (
      <div className={`relative flex items-center gap-1.5 ${className}`}>
        <input
          type="text"
          value={customName}
          onChange={(e) => onCustomChange && onCustomChange(e.target.value)}
          placeholder="Escriba descripción personalizada..."
          disabled={disabled}
          className="w-full p-2 text-xs bg-amber-50 border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-200 font-medium text-slate-800"
          autoFocus
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg shrink-0 text-[10px] font-bold"
            title="Volver a buscar en catálogo"
          >
            Catálogo
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-7 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all text-slate-800 placeholder:text-slate-400 font-medium"
        />
        <Search className="absolute left-2 top-2.5 text-slate-400" size={13} />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100 min-w-[280px]">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectProduct(p)}
                className="p-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-2 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {p.sku && (
                      <span className="bg-slate-100 text-slate-700 font-mono text-[9px] font-bold px-1 rounded shrink-0">
                        {p.sku}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {p.name}
                    </span>
                  </div>
                  {p.division && (
                    <span className="text-[10px] text-slate-400 block truncate">
                      {p.division}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-emerald-600 font-mono block">
                    ${p.unitPrice !== undefined ? p.unitPrice.toFixed(2) : '0.00'}
                  </span>
                  {p.stock !== undefined && (
                    <span className="text-[9px] text-slate-400">
                      Stock: {p.stock} {p.unit || 'u'}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-xs text-slate-500">
              No se encontraron productos con "{search}"
            </div>
          )}

          <div
            onClick={handleSelectCustom}
            className="p-2.5 bg-slate-50 hover:bg-amber-50 text-amber-800 font-bold text-xs cursor-pointer flex items-center justify-between border-t border-slate-200"
          >
            <span>➕ Usar texto personalizado {search ? `("${search}")` : ''}</span>
            <span className="text-[10px] bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded font-mono">Otro</span>
          </div>
        </div>
      )}
    </div>
  );
}
