import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const generateId = () => Math.random().toString(36).substr(2, 9);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((type: NotificationType, message: string) => {
    const id = generateId();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeNotification(id), 4000);
  }, [removeNotification]);

  const showSuccess = useCallback((message: string) => showNotification('success', message), [showNotification]);
  const showError = useCallback((message: string) => showNotification('error', message), [showNotification]);
  const showInfo = useCallback((message: string) => showNotification('info', message), [showNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification, showSuccess, showError, showInfo }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

const NotificationItem: React.FC<{ notification: Notification; onClose: () => void }> = ({ notification, onClose }) => {
  const configs = {
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle, iconColor: 'text-emerald-400' },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertCircle, iconColor: 'text-red-400' },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Info, iconColor: 'text-blue-400' }
  };

  const config = configs[notification.type];
  const Icon = config.icon;

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-4 shadow-lg flex items-start gap-3 animate-in slide-in-from-right duration-300`}>
      <Icon className={`${config.iconColor} flex-shrink-0 mt-0.5`} size={20} />
      <p className="text-sm text-zinc-200 flex-1">{notification.message}</p>
      <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
