'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Users } from 'lucide-react';

export default function EditProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const resp = await api.projects.getById(id);
        const data = resp.data.data || resp.data;
        setName(data.name || '');
        setCode(data.code || '');
        setDescription(data.description || '');
        setStartDate(data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '');
        setColor(data.color || '#2563eb');
        setStatus(data.status || '');
        setLogoUrl(data.logoUrl || null);
      } catch (err) {
        console.error('Error loading project', err);
        alert('No se pudo cargar el proyecto');
        router.push('/projects');
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [id, router]);

  const handleLogoUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
      setSaving(true); // Re-use saving state for feedback
      const res = await api.projects.uploadLogo(id, formData);
      setLogoUrl(res.data.data.logoUrl);
      alert('Logo actualizado');
    } catch (err: any) {
      console.error(err);
      alert('Error subiendo logo');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      setErrors(null);
      if (!name || name.trim().length < 3) {
        setErrors('El nombre es obligatorio y debe tener al menos 3 caracteres');
        setSaving(false);
        return;
      }
      const payload: any = { 
        name: name.trim(), 
        code: code.trim() || undefined, 
        description: description.trim() || undefined, 
        startDate: startDate || undefined, 
        color
      };
      const resp = await api.projects.update(id, payload);
      if (resp.data && resp.data.success !== false) {
        router.push('/projects');
      } else {
        alert('Error actualizando proyecto');
      }
    } catch (err: any) {
      console.error('Error updating project', err);
      alert(err?.response?.data?.message || err.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando proyecto...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Editar Proyecto</h1>
          <button
            onClick={() => router.push(`/projects/${id}/members`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
          >
            <Users size={18} />
            Gestionar Equipo
          </button>
        </div>
        {status === 'PAUSED' && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded border border-yellow-300">
            Este proyecto está <b>pausado</b>. No se puede editar hasta que sea reactivado.
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Nombre del proyecto" required disabled={status === 'PAUSED'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Código (opcional)</label>
            <input value={code} onChange={e => setCode(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Código corto del proyecto" disabled={status === 'PAUSED'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded" rows={4} disabled={status === 'PAUSED'} />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">Logo del Proyecto</label>
             <div className="flex items-center gap-4">
                 <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                     {logoUrl ? (
                         <img 
                            src={`/backend-api${logoUrl}`} 
                            alt="Logo" 
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as any).src = '' }} // Fallback if broken
                         />
                     ) : (
                         <span className="text-xs text-gray-400">Sin Logo</span>
                     )}
                 </div>
                 <div className="flex-1">
                     <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="block w-full text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100
                        "
                        disabled={status === 'PAUSED' || saving}
                     />
                     <p className="text-xs text-gray-400 mt-1">Formatos: PNG, JPG. Máx 5MB.</p>
                 </div>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving || status === 'PAUSED'} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
            <button type="button" onClick={() => router.push('/projects')} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

