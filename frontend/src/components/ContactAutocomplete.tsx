'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string;
  taxId?: string;
}

interface ContactAutocompleteProps {
  projectId: string;
  value?: string;
  onChange: (contactId: string | null, contactName?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ContactAutocomplete({
  projectId,
  value,
  onChange,
  placeholder = 'Buscar cliente o proveedor...',
  className = '',
  disabled = false,
}: ContactAutocompleteProps) {
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buscar contactos cuando cambia el texto
  useEffect(() => {
    if (!projectId) return;

    const delaySearch = setTimeout(async () => {
      if (search.length >= 2) {
        setLoading(true);
        try {
          const response = await api.contacts.search(projectId, search, 100);
          setContacts(response.data.data);
          setShowDropdown(true);
        } catch (error) {
          console.error('Error buscando contactos:', error);
          setContacts([]);
        } finally {
          setLoading(false);
        }
      } else if (search.length === 0) {
        // Cargar contactos recientes al hacer click sin buscar
        try {
          const response = await api.contacts.getAll({ projectId, limit: 100 });
          setContacts(response.data.data);
        } catch (error) {
          console.error('Error cargando contactos:', error);
        }
      }
  }, 200);

    return () => clearTimeout(delaySearch);
  }, [search, projectId]);

  // Cargar contacto seleccionado al iniciar
  useEffect(() => {
    if (value && !selectedContact) {
      api.contacts.getById(value)
        .then(response => {
          const contact = response.data.data;
          setSelectedContact(contact);
          setSearch(contact.name);
        })
        .catch(err => console.error('Error cargando contacto:', err));
    }
  }, [value]);

  const handleSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setSearch(contact.name);
    setShowDropdown(false);
    onChange(contact.id, contact.name);
  };

  const handleClear = () => {
    setSelectedContact(null);
    setSearch('');
    onChange(null);
    setContacts([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!e.target.value) {
      handleClear();
    }
  };

  const getContactTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      CUSTOMER: '👤 Cliente',
      SUPPLIER: '🏢 Proveedor',
      BOTH: '🔄 Cliente/Proveedor',
      OTHER: '📋 Otro'
    };
    return types[type] || '📋';
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => {
            if (contacts.length > 0 || search.length >= 2) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          autoComplete="off"
        />
        
        {/* Botón limpiar */}
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Indicador de carga */}
        {loading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showDropdown && contacts.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => handleSelect(contact)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{contact.name}</div>
                  {contact.email && (
                    <div className="text-sm text-gray-500 mt-0.5">✉️ {contact.email}</div>
                  )}
                  {contact.taxId && (
                    <div className="text-xs text-gray-400 mt-0.5">RIF: {contact.taxId}</div>
                  )}
                </div>
                <span className="ml-2 text-xs text-gray-500">
                  {getContactTypeLabel(contact.type)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Mensaje cuando no hay resultados + Opción de crear */}
      {showDropdown && !loading && search.length >= 2 && contacts.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="p-4 text-center text-gray-500 border-b border-gray-200">
            <p className="text-sm">No se encontraron contactos con "{search}"</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!projectId) {
                alert('⚠️ Selecciona un proyecto antes de crear un contacto.');
                return;
              }

              if (window.confirm(`¿Crear nuevo contacto "${search}"?`)) {
                try {
                  setLoading(true);
                  const response = await api.contacts.create({
                    projectId,
                    name: search,
                    type: 'OTHER',
                    isActive: true,
                  });
                  const newContact = response.data.data;
                  handleSelect(newContact);
                  alert('✅ Contacto creado. Puedes editarlo después desde el administrador de contactos.');
                } catch (error: any) {
                  console.error('Error creando contacto:', error);
                  // Mejor detalle del error cuando esté disponible
                  const msg = error?.response?.data?.error?.message || error?.message || 'Error desconocido';
                  alert('❌ Error al crear contacto: ' + msg);
                } finally {
                  setLoading(false);
                }
              }
            }}
            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-2 text-blue-600 font-medium"
          >
            <span className="text-xl">➕</span>
            <span>Crear contacto rápido: "{search}"</span>
          </button>
          <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50">
            💡 Se creará con el nombre ingresado. Podrás editar sus datos completos después.
          </p>
        </div>
      )}
    </div>
  );
}
