'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  projectId?: string;
  // value can be a string (legacy) or an object with id/name
  value?: string | { id?: string; name: string };
  onChange: (v: { id?: string; name: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
}

export default function CategorySelector({ projectId, value = '', onChange, placeholder = 'Buscar o crear categoría', disabled, allowCreate = true }: Props) {
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const initialName = typeof value === 'string' ? value : (value?.name || '');
  const [input, setInput] = useState(initialName);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = (input || '').toLowerCase().trim();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, input]);

  useEffect(() => {
    setInput(initialName || '');
  }, [initialName]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await api.transactionCategories.getAll(projectId ? { projectId } : undefined);
        const data = resp.data.data || resp.data || [];
        if (!cancelled) setOptions(data);
      } catch (err) {
        console.error('Error cargando categorías normalizadas:', err);
      }
    };
    load();
    return () => { cancelled = true };
  }, [projectId]);

  const selectExisting = (opt: CategoryOption) => {
    setInput(opt.name);
    onChange({ id: opt.id, name: opt.name });
    setOpen(false);
  };

  async function createAndSelect(raw: string) {
    const name = normalizeCategory(raw || '');
    if (!name) return;
    try {
      const resp = await api.transactionCategories.create({ name, projectId });
      const created: CategoryOption = resp.data.data;
      setOptions(prev => [created, ...prev]);
      setInput(created.name);
      onChange({ id: created.id, name: created.name });
      setOpen(false);
    } catch (err: any) {
      console.error('Error creando categoría normalizada:', err);
      // Fallback: return name without id
      onChange({ name });
      setInput(name);
      setOpen(false);
    }
  }

  function normalizeCategory(raw: string) {
    const s = (raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    return s
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-48 overflow-auto">
          {filtered.map((opt) => (
            <div
              key={opt.id}
              onMouseDown={() => selectExisting(opt)}
              className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
            >
              {opt.name}
            </div>
          ))}
        </div>
      )}

      {/* Small helper: add button to confirm typed value */}
      {allowCreate && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => createAndSelect(input.trim())}
            disabled={!input.trim()}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50"
          >
            Usar categoría
          </button>
          <div className="text-xs text-gray-500">Sugerencias normalizadas · Selecciona o crea una categoría</div>
        </div>
      )}
    </div>
  );
}
