"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Plus, Search, Tag, Trash2, Edit2, Save, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.transactionCategories.getAll();
      setCategories(res.data?.data || []);
    } catch (e) {
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

        function sortCategories(arr: any[]): any[] {
          return [...arr].sort((a, b) => {
            const av = a.name.toLowerCase();
            const bv = b.name.toLowerCase();
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
          });
        }
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    try {
      await api.transactionCategories.delete(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      alert('Error al eliminar');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await api.transactionCategories.update(id, { name: editName });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editName } : c));
      setEditingId(null);
    } catch (e) {
      alert('Error al actualizar');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api.transactionCategories.create({ name: newName });
      setCategories(prev => [res.data.data, ...prev]);
      setNewName('');
    } catch (e) {
      alert('Error al crear');
    } finally {
      setCreating(false);
    }
  };

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/30 p-6 md:p-8 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.back()} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                    <button
                      className="ml-2 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none"
                      onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                      title="Ordenar"
                    >
                      Nombre {sortDir === 'asc' ? '▲' : '▼'}
                    </button>
                <ArrowLeft size={20} className="text-slate-500" />
              </button>
              <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                Categorías
              </h2>
            </div>
            <p className="text-slate-500 ml-8">Gestiona las categorías para tus transacciones</p>
          </div>
        </header>

        <div className="grid gap-6">
          {/* Create New */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Nueva Categoría
            </h3>
            <div className="flex gap-3">
              <input 
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Nombre de la categoría..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <button 
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
              >
                {creating ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>

          {/* List */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Search size={20} className="text-slate-400" />
              <input 
                className="bg-transparent border-none focus:outline-none w-full text-slate-600 placeholder:text-slate-400"
                placeholder="Buscar categorías..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-slate-400">Cargando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No se encontraron categorías</div>
              ) : (
                filtered.map(cat => (
                  <div key={cat.id} className="group flex items-center justify-between p-3 hover:bg-white rounded-xl border border-transparent hover:border-slate-100 transition-all">
                    {editingId === cat.id ? (
                      <div className="flex-1 flex items-center gap-2 mr-4">
                        <input 
                          className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                        />
                        <button onClick={() => handleUpdate(cat.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Save size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                          <Tag size={16} />
                        </div>
                        <span className="font-medium text-slate-700">{cat.name}</span>
                      </div>
                    )}
                    
                    {editingId !== cat.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
