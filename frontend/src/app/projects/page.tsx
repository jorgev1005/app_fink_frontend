'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState(search);

  // debounce local searchTerm -> search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchTerm), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await api.projects.getAll();
      setProjects(resp.data.data || resp.data || []);
    } catch (err) {
      console.error('Error loading projects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar proyecto? Esta acción no se puede deshacer.')) return;
    try {
      await api.projects.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting project', err);
      alert('No se pudo eliminar el proyecto');
    }
  };

  const filtered = projects.filter(p => p.status !== 'PAUSED' && (p.name.toLowerCase().includes(search.toLowerCase()) || (p.code || '').toLowerCase().includes(search.toLowerCase())));
  const paused = projects.filter(p => p.status === 'PAUSED' && (p.name.toLowerCase().includes(search.toLowerCase()) || (p.code || '').toLowerCase().includes(search.toLowerCase())));

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando proyectos...</div>;

  const handlePause = async (id: string) => {
    if (!confirm('¿Pausar este proyecto? No se podrá modificar hasta reactivarlo.')) return;
    try {
      await api.projects.pause(id);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'PAUSED' } : p));
    } catch (err) {
      alert('No se pudo pausar el proyecto');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await api.projects.reactivate(id);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'ACTIVE' } : p));
    } catch (err) {
      alert('No se pudo reactivar el proyecto');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre o código" className="px-3 py-2 pr-8 border rounded" />
              {searchTerm !== search && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              )}
            </div>
            <button onClick={() => router.push('/consolidations')} className="px-4 py-2 bg-indigo-600 text-white rounded">Consolidaciones</button>
            <button onClick={() => router.push('/projects/new')} className="px-4 py-2 bg-blue-600 text-white rounded">+ Nuevo proyecto</button>
          </div>
        </div>

        {/* Proyectos activos */}
        <div className="bg-white rounded shadow overflow-hidden mb-8">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moneda</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{p.code || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.currency || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.startDate ? new Date(p.startDate).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600"><span className="inline-block w-6 h-6 rounded" style={{ backgroundColor: p.color || '#eee' }} /></td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button onClick={() => router.push(`/projects/${p.id}`)} className="px-3 py-1 mr-2 bg-yellow-100 text-yellow-800 rounded">Editar</button>
                    <button onClick={() => handlePause(p.id)} className="px-3 py-1 mr-2 bg-gray-200 text-gray-800 rounded">Pausar</button>
                    <button onClick={() => handleDelete(p.id)} className="px-3 py-1 bg-red-100 text-red-800 rounded">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-6 text-center text-gray-500">No se encontraron proyectos</div>
          )}
        </div>

        {/* Proyectos pausados */}
        {paused.length > 0 && (
          <div className="bg-gray-100 rounded shadow overflow-hidden">
            <div className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-gray-200">Proyectos pausados</div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Moneda</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paused.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 opacity-60">
                    <td className="px-6 py-4 text-sm text-gray-900">{p.code || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.currency || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.startDate ? new Date(p.startDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600"><span className="inline-block w-6 h-6 rounded" style={{ backgroundColor: p.color || '#eee' }} /></td>
                    <td className="px-6 py-4 text-right text-sm">
                      <button onClick={() => handleReactivate(p.id)} className="px-3 py-1 mr-2 bg-green-100 text-green-800 rounded">Reactivar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
