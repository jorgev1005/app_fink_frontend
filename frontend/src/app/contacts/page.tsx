'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  taxId?: string;
  isActive: boolean;
  projectId?: string;
  project: {
    id?: string;
    name: string;
    code: string;
  };
}

export default function ContactsPage() {
    // Estado de ordenamiento de tabla
    const [sortBy, setSortBy] = useState<string>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Función para ordenar contactos
    function sortContacts(arr: Contact[]): Contact[] {
      if (!sortBy) return arr;
      const sorted = [...arr].sort((a, b) => {
        let av: any, bv: any;
        if (sortBy === 'name') {
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
        } else if (sortBy === 'type') {
          av = a.type.toLowerCase();
          bv = b.type.toLowerCase();
        } else if (sortBy === 'contact') {
          av = (a.email || a.phone || '').toLowerCase();
          bv = (b.email || b.phone || '').toLowerCase();
        } else if (sortBy === 'taxId') {
          av = (a.taxId || '').toLowerCase();
          bv = (b.taxId || '').toLowerCase();
        } else if (sortBy === 'project') {
          av = a.project?.name?.toLowerCase() || '';
          bv = b.project?.name?.toLowerCase() || '';
        } else {
          av = a[sortBy as keyof Contact];
          bv = b[sortBy as keyof Contact];
        }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return sorted;
    }
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [editingId, setEditingId] = useState<string | null>(null);

  // debounce searchTerm for client-side filtering (200ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 200);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const initialFormState = {
    name: '',
    type: 'OTHER',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    projectId: '',
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contactsRes, projectsRes] = await Promise.all([
        api.contacts.getAll({}),
        api.projects.getAll(),
      ]);

      setContacts(contactsRes.data.data);
      setProjects(projectsRes.data.data);
      
      if (projectsRes.data.data.length > 0) {
        setFormData(prev => ({ ...prev, projectId: projectsRes.data.data[0].id }));
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.contacts.update(editingId, formData);
        alert('Contacto actualizado exitosamente');
      } else {
        await api.contacts.create(formData);
        alert('Contacto creado exitosamente');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ ...initialFormState, projectId: selectedProject || projects[0]?.id || '' });
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Error al guardar contacto');
    }
  };

  const handleEdit = (contact: any) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      type: contact.type,
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      taxId: contact.taxId || '',
      projectId: contact.projectId,
      notes: contact.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este contacto?')) return;
    try {
      await api.contacts.delete(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Error al eliminar contacto');
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ ...initialFormState, projectId: selectedProject || projects[0]?.id || '' });
    setShowModal(true);
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesProject = !selectedProject || contact.projectId === selectedProject || contact.project?.code === projects.find(p => p.id === selectedProject)?.code;
    const s = searchTerm.toLowerCase().trim();
    const matchesSearch = !s || 
      contact.name.toLowerCase().includes(s) || 
      (contact.taxId && contact.taxId.toLowerCase().includes(s)) ||
      (contact.email && contact.email.toLowerCase().includes(s)) ||
      (contact.phone && contact.phone.toLowerCase().includes(s));
    return matchesProject && matchesSearch;
  });

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CUSTOMER: 'Cliente',
      SUPPLIER: 'Proveedor',
      BOTH: 'Cliente/Proveedor',
      OTHER: 'Otro',
    };
    return labels[type] || type;
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      CUSTOMER: 'bg-blue-100 text-blue-800',
      SUPPLIER: 'bg-green-100 text-green-800',
      BOTH: 'bg-purple-100 text-purple-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || colors.OTHER;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando contactos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes y Proveedores</h1>
            <p className="text-gray-600 mt-2">Gestiona tus contactos de negocio</p>
          </div>
          <button
            onClick={openNewModal}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Nuevo Contacto</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm !== debouncedSearch && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proyecto</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los proyectos</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de contactos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => { setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Nombre {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => { setSortBy('type'); setSortDir(sortBy === 'type' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Tipo {sortBy === 'type' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => { setSortBy('contact'); setSortDir(sortBy === 'contact' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Contacto {sortBy === 'contact' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => { setSortBy('taxId'); setSortDir(sortBy === 'taxId' && sortDir === 'asc' ? 'desc' : 'asc'); }}>RIF/NIT {sortBy === 'taxId' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => { setSortBy('project'); setSortDir(sortBy === 'project' && sortDir === 'asc' ? 'desc' : 'asc'); }}>Proyecto {sortBy === 'project' && (sortDir === 'asc' ? '▲' : '▼')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortContacts(filteredContacts).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-sm">No hay contactos registrados</p>
                      <button
                        onClick={openNewModal}
                        className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        + Crear primer contacto
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortContacts(filteredContacts).map(contact => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(contact.type)}`}>
                        {getTypeLabel(contact.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.email && <div>✉️ {contact.email}</div>}
                      {contact.phone && <div>📞 {contact.phone}</div>}
                      {!contact.email && !contact.phone && <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.taxId || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {contact.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Contacto */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{editingId ? 'Editar Contacto' : 'Nuevo Contacto'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="CUSTOMER">Cliente</option>
                      <option value="SUPPLIER">Proveedor</option>
                      <option value="BOTH">Cliente y Proveedor</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proyecto *</label>
                    <select
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RIF / NIT</label>
                    <input
                      type="text"
                      value={formData.taxId}
                      onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="J-12345678-9"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    {editingId ? 'Guardar Cambios' : 'Crear Contacto'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
