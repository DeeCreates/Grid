// src/hooks/useNotifications.ts
import { useNotifications } from '@/contexts/NotificationContext';

export const usePushNotifications = () => {
  const { 
    requestPushPermission,
    sendTestNotification,
    isPushSupported,
    pushPermission,
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return {
    requestPushPermission,
    sendTestNotification,
    isPushSupported,
    pushPermission,
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
  };
};