// src/contexts/notificationContext.tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ToastStack, { type ToastItem } from '../components/toast';
import { getInitialAlerts, subscribeToAlerts } from '../services/quality/alertsService';
import { SOURCE_LABEL_KEY } from '../constants/alertLabels';
import { NotificationContext, type NotificationItem } from './useNotifications';

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected'>('connecting');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const initial = await getInitialAlerts();
      if (cancelled) return;
      setNotifications(initial.map((a) => ({ ...a, read: true })));
    })();

    const connectTimer = setTimeout(() => {
      if (!cancelled) setConnectionStatus('connected');
    }, 400);

    const unsubscribe = subscribeToAlerts((alert) => {
      setNotifications((prev) => [{ ...alert, read: false }, ...prev]);
      setToasts((prev) => [
        ...prev,
        {
          id: alert.id,
          title: t(SOURCE_LABEL_KEY[alert.source]),
          message: t(alert.messageKey, alert.messageParams),
          severity: alert.severity,
        },
      ]);
    });

    return () => {
      cancelled = true;
      clearTimeout(connectTimer);
      unsubscribe();
    };
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, connectionStatus, markRead, markAllRead }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}
