// src/contexts/useNotifications.ts
import { createContext, useContext } from 'react';
import type { LiveAlert } from '../services/quality/alertsService';

export interface NotificationItem extends LiveAlert {
  read: boolean;
}

export interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  connectionStatus: 'connecting' | 'connected';
  markRead: (id: string) => void;
  markAllRead: () => void;
}

// Lives here (not in notificationContext.tsx) since a file that exports
// both a component and a context/hook breaks Vite Fast Refresh
// (react-refresh/only-export-components).
export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
