import { create } from 'zustand';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove after duration
    if (notification.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, notification.duration || 5000);
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearAll: () => set({ notifications: [] }),
}));

// Hook for easy notifications
export function useNotifications() {
  const { addNotification } = useNotificationStore();

  return {
    success: (title: string, message?: string, duration?: number) =>
      addNotification({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
      addNotification({ type: 'error', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
      addNotification({ type: 'info', title, message, duration }),
    warning: (title: string, message?: string, duration?: number) =>
      addNotification({ type: 'warning', title, message, duration }),
  };
}

// Notification UI Component
export function NotificationContainer() {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="fixed top-6 right-6 z-[9999] space-y-3 max-w-md">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationItem({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const Icon = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  }[notification.type];

  const styles = {
    success: 'bg-green-600/20 border-green-600/50 text-green-400',
    error: 'bg-red-600/20 border-red-600/50 text-red-400',
    info: 'bg-blue-600/20 border-blue-600/50 text-blue-400',
    warning: 'bg-yellow-600/20 border-yellow-600/50 text-yellow-400',
  }[notification.type];

  return (
    <div
      className={`${styles} border rounded-lg p-4 shadow-2xl backdrop-blur-sm animate-in slide-in-from-right duration-300`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white mb-1">{notification.title}</h4>
          {notification.message && (
            <p className="text-sm text-gray-300">{notification.message}</p>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors flex-shrink-0"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Global error handler
export function setupGlobalErrorHandlers() {
  const { error: showError } = useNotifications();

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showError(
      'Er ging iets mis',
      'Een achtergrondtaak is mislukt. Probeer de actie opnieuw.',
      7000
    );
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Only show for non-React errors (React errors are caught by ErrorBoundary)
    if (!event.error?.stack?.includes('React')) {
      showError(
        'Onverwachte fout',
        'Er is een technisch probleem opgetreden.',
        7000
      );
    }
  });
}
