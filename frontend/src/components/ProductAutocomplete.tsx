'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Package, Check, Tag, Info } from 'lucide-react';

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
  const [isCustomMode, setIsCustomMode] = useState(value === 'CUSTOM');
  const [hoveredProduct, setHoveredProduct] = useState<ProductItem | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Match selected product either from prop value or by customName
  const selectedProduct = useMemo(() => {
    if (!value || value === 'CUSTOM') return null;
    return products.find(p => p.id === value) || null;
  }, [products, value]);

  // Sync custom mode when value changes
  useEffect(() => {
    if (value === 'CUSTOM') {
      setIsCustomMode(true);
    } else if (value) {
      setIsCustomMode(false);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredProduct(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-term intelligent search (e.g. "caja apilable peque")
  const filteredProducts = useMemo(() => {
    if (!search.trim()) {
      return products.slice(0, 50);
    }
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return products.filter(p => {
      const target = `${p.name} ${p.sku || ''} ${p.description || ''} ${p.division || ''}`.toLowerCase();
      return terms.every(term => target.includes(term));
    }).slice(0, 60);
  }, [products, search]);

  const handleSelectProduct = (product: ProductItem) => {
    setIsCustomMode(false);
    setSearch('');
    setIsOpen(false);
    setHoveredProduct(null);
    onSelect(product);
  };

  const handleSelectCustom = () => {
    setIsCustomMode(true);
    setIsOpen(false);
    setHoveredProduct(null);
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

  // ── ESTADO 1: PRODUCTO SELECCIONADO ─────────────────────────────
  if (selectedProduct && !isCustomMode) {
    return (
      <div 
        className={`relative p-2.5 bg-blue-50/90 border border-blue-300/80 rounded-xl text-xs transition-all shadow-sm group hover:border-blue-400 ${className}`}
        title={selectedProduct.name}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedProduct.sku && (
                <span className="bg-blue-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shadow-xs shrink-0">
                  {selectedProduct.sku}
                </span>
              )}
              {selectedProduct.division && (
                <span className="bg-slate-200/80 text-slate-700 text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0">
                  {selectedProduct.division}
                </span>
              )}
            </div>
            
            {/* Nombre completo sin truncar */}
            <p className="font-bold text-slate-900 text-xs leading-snug whitespace-normal break-words">
              {selectedProduct.name}
            </p>

            {/* Metadatos de precio y stock */}
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium pt-0.5">
              <span className="text-blue-700 font-extrabold font-mono">
                Precio: ${selectedProduct.unitPrice !== undefined ? selectedProduct.unitPrice.toFixed(2) : '0.00'} USD
              </span>
              {selectedProduct.stock !== undefined && (
                <span className={`${(selectedProduct.stock || 0) > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                  Stock: {selectedProduct.stock} {selectedProduct.unit || 'und'}
                </span>
              )}
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 px-2 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
              title="Cambiar producto seleccionado"
            >
              <X size={13} />
              <span>Cambiar</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── ESTADO 2: MODO PERSONALIZADO / LIBRE ────────────────────────
  if (isCustomMode) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => onCustomChange && onCustomChange(e.target.value)}
            placeholder="Escriba el nombre o descripción del ítem personalizado..."
            disabled={disabled}
            className="w-full p-2 text-xs bg-amber-50/80 border border-amber-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-300 font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs"
            autoFocus
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl shrink-0 text-[11px] font-bold transition-colors cursor-pointer"
              title="Volver a buscar en catálogo"
            >
              🔍 Catálogo
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── ESTADO 3: CAMPO DE BÚSQUEDA Y DROPDOWN CON TOOLTIP FLOTANTE ───
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
          className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 placeholder:text-slate-400 font-semibold"
        />
        <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 mt-1.5 w-[300px] sm:w-[480px] md:w-[540px] max-w-[90vw] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header del dropdown con contador */}
          <div className="px-3 py-2 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-200">
            <span className="font-semibold">
              {filteredProducts.length} producto{filteredProducts.length === 1 ? '' : 's'} encontrado{filteredProducts.length === 1 ? '' : 's'}
            </span>
            <span className="text-[10px] text-slate-400">Pasa el cursor para ver el nombre completo</span>
          </div>

          {/* Lista scrolleable de productos */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectProduct(p)}
                  onMouseEnter={() => setHoveredProduct(p)}
                  className="p-2.5 hover:bg-blue-50/80 cursor-pointer flex items-start justify-between gap-3 transition-colors text-left group"
                  title={p.name}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.sku && (
                        <span className="bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-700 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors shrink-0">
                          {p.sku}
                        </span>
                      )}
                      {p.division && (
                        <span className="text-[10px] text-slate-400 truncate">
                          {p.division}
                        </span>
                      )}
                    </div>

                    {/* Nombre completo legible */}
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-900 leading-snug whitespace-normal break-words">
                      {p.name}
                    </p>
                  </div>

                  {/* Precios y Stock */}
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs font-extrabold text-emerald-600 font-mono block">
                      ${p.unitPrice !== undefined ? p.unitPrice.toFixed(2) : '0.00'}
                    </span>
                    {p.stock !== undefined && (
                      <span className={`text-[10px] font-medium block ${(p.stock || 0) > 0 ? 'text-slate-600' : 'text-amber-600'}`}>
                        Stock: {p.stock} {p.unit || 'und'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5 text-center text-xs text-slate-500 space-y-1">
                <Package size={24} className="mx-auto text-slate-300 mb-1" />
                <p className="font-semibold">No se encontraron productos con "{search}"</p>
                <p className="text-[11px] text-slate-400">Puedes usar la opción de texto personalizado abajo</p>
              </div>
            )}
          </div>

          {/* Opción de texto libre */}
          <div
            onClick={handleSelectCustom}
            className="p-2.5 bg-slate-50 hover:bg-amber-50 text-amber-900 font-bold text-xs cursor-pointer flex items-center justify-between border-t border-slate-200 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span>➕ Usar texto personalizado</span>
              {search && <span className="font-normal text-slate-600">("{search}")</span>}
            </span>
            <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-mono font-bold">Personalizado</span>
          </div>

          {/* Vista previa flotante del ítem resaltado */}
          {hoveredProduct && (
            <div className="p-2.5 bg-blue-950 text-white text-[11px] border-t border-blue-900 flex items-center gap-2 animate-in fade-in duration-100">
              <Info size={14} className="text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-bold text-blue-300 mr-1.5">[{hoveredProduct.sku || 'N/A'}]</span>
                <span className="font-medium text-slate-100">{hoveredProduct.name}</span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
