'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);


  const [lastCheckCount, setLastCheckCount] = useState(0);

  // Intentar cargar sonido
  const playSound = () => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(e => {
        console.warn('Audio autoplay blocked or file missing', e);
      });
    } catch (e) {
      console.warn('Could not initialize audio', e);
    }
  };

  useEffect(() => {
    loadNotifications(true); // First load silent
    
    // Cargar notificaciones cada 30 segundos
    const interval = setInterval(() => loadNotifications(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async (silent = false) => {
    try {
      const response = await api.notifications.getAll(false);
      // Backend returns { data: { notifications: [], unreadCount: number } }
      const payload = response.data.data;
      const list = Array.isArray(payload) ? payload : (payload.notifications || []);
      
      setNotifications(list.slice(0, 10)); // Últimas 10
      
      let newUnreadCount = 0;
      // If backend provides unreadCount, use it, otherwise calculate
      if (payload.unreadCount !== undefined) {
        newUnreadCount = payload.unreadCount;
      } else {
        newUnreadCount = list.filter((n: Notification) => !n.isRead).length;
      }

      // Play sound only if count increased and not first load
      if (!silent && newUnreadCount > unreadCount) {
         playSound();
         // Opcional: Mostrar Toast visual nativo del sistema
         if (Notification.permission === 'granted') {
            new Notification('Nueva Notificación', {
                body: `Tienes ${newUnreadCount} notificaciones sin leer.`,
                icon: '/icon.png' // Asegúrate de tener un icono
            });
         }
      }

      setUnreadCount(newUnreadCount);

    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  };

  // Solicitar permiso de notificaciones al cargar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
  }, []);


  const markAsRead = async (notificationId: string) => {
    try {
      await api.notifications.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    setShowDropdown(false);

    // Navegar según el tipo de notificación
    if (notification.data?.transactionId) {
      router.push(`/transactions/${notification.data.transactionId}`);
    } else if (notification.data?.contactId) {
      router.push(`/contacts`);
    } else if (notification.data?.projectId) {
      router.push(`/projects/${notification.data.projectId}`);
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      TRANSACTION: '💰',
      PAYMENT: '💳',
      REMINDER: '🔔',
      ALERT: '⚠️',
      SUCCESS: '✅',
      INFO: 'ℹ️',
    };
    return icons[type] || '📌';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-VE', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        title="Notificaciones"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Badge Count */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-xl z-20 border border-gray-200 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Notificaciones
                </h3>
                {unreadCount > 0 && (
                  <span className="text-xs text-gray-600">
                    {unreadCount} sin leer
                  </span>
                )}
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-4xl mb-2">🔔</div>
                  <p className="text-sm">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 transition ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-sm font-medium ${
                              !notification.isRead
                                ? 'text-gray-900'
                                : 'text-gray-700'
                            }`}
                          >
                            {notification.title}
                          </h4>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        {!notification.isRead && (
                          <span className="inline-block w-2 h-2 bg-blue-600 rounded-full mt-2"></span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push('/notifications');
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ver todas las notificaciones →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
