'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [errors, setErrors] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [sourceProjectId, setSourceProjectId] = useState('');
  const [includeBalances, setIncludeBalances] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) router.push('/login');
    
    // Load existing projects for import
    api.projects.getAll().then(resp => {
      setProjects(resp.data.data || resp.data || []);
    }).catch(err => console.error(err));
  }, [router]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      // client-side validation
      setErrors(null);
      if (!name || name.trim().length < 3) {
        setErrors('El nombre es obligatorio y debe tener al menos 3 caracteres');
        setLoading(false);
        return;
      }

      const payload: any = { 
        name: name.trim(), 
        code: code.trim() || undefined, 
        description: description.trim() || undefined, 
        startDate: startDate || undefined, 
        color,
        sourceProjectId: sourceProjectId || undefined,
        includeBalances: sourceProjectId ? includeBalances : false
      };
      
      const resp = await api.projects.create(payload);
      if (resp.data && resp.data.success !== false) {
        const created = resp.data.data || resp.data;
        router.push(`/projects/${created.id}`);
      } else {
        alert('Error creando proyecto');
      }
    } catch (err: any) {
      console.error('Error creating project', err);
      alert(err?.response?.data?.message || err.message || 'Error al crear');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Crear Proyecto</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Nombre del proyecto" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código (opcional)</label>
            <input value={code} onChange={e => setCode(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Código corto del proyecto" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded" rows={4} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-10 p-1 border rounded" />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Importar configuración</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Importar cuentas de otro proyecto</label>
                <select 
                  value={sourceProjectId} 
                  onChange={e => setSourceProjectId(e.target.value)} 
                  className="w-full px-3 py-2 border rounded mt-1"
                >
                  <option value="">-- No importar (empezar desde cero) --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Se copiará toda la estructura de cuentas del proyecto seleccionado.</p>
              </div>
              
              {sourceProjectId && (
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="includeBalances" 
                    checked={includeBalances} 
                    onChange={e => setIncludeBalances(e.target.checked)} 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="includeBalances" className="text-sm text-gray-700">
                    Incluir saldos iniciales (copiar balances actuales)
                  </label>
                </div>
              )}
            </div>
          </div>

          {errors && <div className="text-sm text-red-600">{errors}</div>}

          <div className="flex items-center gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{loading ? 'Creando...' : 'Crear proyecto'}</button>
            <button type="button" onClick={() => router.push('/projects')} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
