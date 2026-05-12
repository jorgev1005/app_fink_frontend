'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Trash2, Shield, Users, Save } from 'lucide-react';
import api from '@/lib/api';

interface Member {
  id: string; // ProjectUser ID
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}

export default function ProjectMembersPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('VIEWER');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      // Use typed API helper
      const res = await api.projects.getMembers(id);
      if (res.data.success) {
        setMembers(res.data.data);
      }
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError('No se pudo cargar la lista de miembros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    try {
      setAdding(true);
      setError(null);
      setSuccess(null);

      await api.projects.addMember(id, {
        email: newEmail,
        role: newRole
      });

      setSuccess(`Usuario ${newEmail} agregado correctamente`);
      setNewEmail('');
      fetchMembers();
    } catch (err: any) {
      console.error('Invite error:', err);
      setError(err.response?.data?.error?.message || 'Error al agregar miembro');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await api.projects.updateMemberRole(id, userId, newRole);
      setSuccess('Rol actualizado');
      fetchMembers(); // Refresh to be sure
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Error al actualizar rol');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('¿Estás seguro de eliminar a este usuario del proyecto?')) return;
    try {
      await api.projects.removeMember(id, userId);
      setSuccess('Usuario eliminado del equipo');
      fetchMembers();
    } catch (err: any) {
       setError(err.response?.data?.error?.message || 'Error al eliminar usuario');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
           <div>
              <Link href={`/projects/${id}`} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 flex items-center gap-2 mb-2 transition-colors">
                <ArrowLeft size={16} /> Volver al Proyecto
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="text-blue-600" />
                Gestión de Miembros
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Controla quién tiene acceso a este proyecto y sus permisos.</p>
           </div>
        </div>

        {/* Invite Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8 border border-gray-100 dark:border-gray-700">
           <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-green-600" />
              Agregar Nuevo Miembro
           </h2>
           <form onSubmit={handleInvite} className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico</label>
                 <input 
                    type="email" 
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 />
              </div>
              <div className="w-[150px]">
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                 <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 >
                    <option value="VIEWER">Lector (Viewer)</option>
                    <option value="MEMBER">Editor (Member)</option>
                    <option value="MANAGER">Gestor (Manager)</option>
                 </select>
              </div>
              <button 
                 type="submit" 
                 disabled={adding}
                 className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                 {adding ? 'Agregando...' : <><UserPlus size={18} /> Invitar</>}
              </button>
           </form>
           {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
           {success && <div className="mt-3 text-sm text-green-600 bg-green-50 p-2 rounded">{success}</div>}
        </div>

        {/* Member List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
           <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Equipo Actual ({members.length})</h2>
           </div>
           
           {loading ? (
             <div className="p-8 text-center text-gray-500">Cargando miembros...</div>
           ) : members.length === 0 ? (
             <div className="p-8 text-center text-gray-500">No hay miembros en este proyecto.</div>
           ) : (
             <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium text-sm">
                   <tr>
                      <th className="px-6 py-3">Usuario</th>
                      <th className="px-6 py-3">Rol</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                   {members.map((m) => (
                      <tr key={m.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                         <td className="px-6 py-4">
                            <div className="font-medium text-gray-900 dark:text-white">
                                {m.user.firstName} {m.user.lastName} 
                                {m.role === 'OWNER' && <Shield size={14} className="inline ml-2 text-yellow-500" />}
                            </div>
                            <div className="text-sm text-gray-500">{m.user.email}</div>
                         </td>
                         <td className="px-6 py-4">
                            {m.role === 'OWNER' ? (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium border border-yellow-200">
                                   Owner
                                </span>
                            ) : (
                                <select 
                                   value={m.role}
                                   onChange={(e) => handleUpdateRole(m.userId, e.target.value)}
                                   className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                   <option value="VIEWER">Lector</option>
                                   <option value="MEMBER">Editor</option>
                                   <option value="MANAGER">Gestor</option>
                                </select>
                            )}
                         </td>
                         <td className="px-6 py-4 text-right">
                            {m.role !== 'OWNER' && (
                                <button 
                                   onClick={() => handleRemove(m.userId)}
                                   className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                   title="Eliminar usuario"
                                >
                                   <Trash2 size={18} />
                                </button>
                            )}
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  );
}
