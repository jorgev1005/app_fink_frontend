'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Solo activar si no estamos en un input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ctrl/Cmd + tecla
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            router.push('/transactions/new');
            break;
          case 't':
            e.preventDefault();
            router.push('/transactions');
            break;
          case 'c':
            e.preventDefault();
            router.push('/contacts');
            break;
          case 'h':
            e.preventDefault();
            router.push('/dashboard');
            break;
          case 'k':
            e.preventDefault();
            // Abrir búsqueda rápida (implementar después)
            break;
        }
      }

      // Teclas simples
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        switch (e.key) {
          case '?':
            e.preventDefault();
            showShortcutsHelp();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [router]);

  const showShortcutsHelp = () => {
    const shortcuts = `
🎹 ATAJOS DE TECLADO FINK

Ctrl/Cmd + N → Nueva Transacción
Ctrl/Cmd + T → Ver Transacciones
Ctrl/Cmd + C → Contactos
Ctrl/Cmd + H → Dashboard
? → Mostrar esta ayuda

💡 Los atajos funcionan en cualquier página
    `;
    alert(shortcuts);
  };

  return null; // Este componente no renderiza nada
}
