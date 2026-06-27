// src/contexts/NotificationContext.tsx 
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { inAppNotificationService } from '@/services/notifications/InAppNotificationService';
import { pushNotificationService } from '@/services/notifications/PushNotificationService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { 
  Notification, 
  NotificationStats, 
  NotificationPreferences 
} from '@/services/notifications/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats | null;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  requestPushPermission: () => Promise<string | null>;
  sendTestNotification: () => Promise<void>;
  isPushSupported: boolean;
  pushPermission: NotificationPermission;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const defaultPreferences: NotificationPreferences = {
  push: {
    enabled: true,
    serviceUpdates: true,
    incidentAlerts: true,
    paymentReceipts: true,
    marketing: false,
    securityAlerts: true,
  },
  inApp: {
    enabled: true,
    serviceUpdates: true,
    incidentAlerts: true,
    paymentReceipts: true,
    marketing: false,
    securityAlerts: true,
  },
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setStats(null);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    inAppNotificationService.initializeListener(user.uid);

    const unsubscribe = inAppNotificationService.addListener((newNotifications) => {
      setNotifications(newNotifications);
      const unread = newNotifications.filter(n => !n.read).length;
      setUnreadCount(unread);
      setLoading(false);
    });

    inAppNotificationService.getStats(user.uid)
      .then(setStats)
      .catch(err => setError(err.message));

    loadPreferences(user.uid);

    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }

    return () => {
      unsubscribe();
      inAppNotificationService.cleanup();
    };
  }, [user]);

  const loadPreferences = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.notificationPreferences) {
          setPreferences(data.notificationPreferences);
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await inAppNotificationService.markAsRead(notificationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      await inAppNotificationService.markAllAsRead(user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await inAppNotificationService.deleteNotification(notificationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    const token = await pushNotificationService.requestPermission();
    if (token) {
      setPushPermission('granted');
    } else {
      setPushPermission('denied');
    }
    return token;
  }, []);

  const sendTestNotification = useCallback(async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }
    await pushNotificationService.sendTestNotification();
  }, [user]);

  const updatePreferences = useCallback(async (prefs: Partial<NotificationPreferences>) => {
    const newPreferences = {
      push: { ...preferences.push, ...(prefs.push || {}) },
      inApp: { ...preferences.inApp, ...(prefs.inApp || {}) },
    };
    setPreferences(newPreferences);
    
    try {
      if (user) {
        await setDoc(doc(db, 'users', user.uid), {
          notificationPreferences: newPreferences,
        }, { merge: true });
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Failed to save preferences');
    }
  }, [user, preferences]);

  const isPushSupported = pushNotificationService.isSupportedBrowser();

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        stats,
        loading,
        error,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        requestPushPermission,
        sendTestNotification,
        isPushSupported,
        pushPermission,
        preferences,
        updatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}