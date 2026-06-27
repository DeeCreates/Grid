// src/services/notifications/types.ts
export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  priority: 'low' | 'medium' | 'high';
  category: 'service' | 'incident' | 'booking' | 'payment' | 'system' | 'marketing' | 'security';
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  data?: Record<string, any>;
  actions?: {
    action: string;
    title: string;
    icon?: string;
  }[];
  image?: string;
  vibrate?: number[];
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  silent?: boolean;
}

export interface InAppNotification extends Notification {
  duration?: number;
  dismissible?: boolean;
}

export interface NotificationPreferences {
  push: {
    enabled: boolean;
    serviceUpdates: boolean;
    incidentAlerts: boolean;
    paymentReceipts: boolean;
    marketing: boolean;
    securityAlerts: boolean;
  };
  inApp: {
    enabled: boolean;
    serviceUpdates: boolean;
    incidentAlerts: boolean;
    paymentReceipts: boolean;
    marketing: boolean;
    securityAlerts: boolean;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface FCMToken {
  token: string;
  userId: string;
  deviceInfo?: {
    platform: string;
    browser: string;
    os: string;
  };
  createdAt: Date;
  lastUsed: Date;
}

export type { Notification as NotificationType };