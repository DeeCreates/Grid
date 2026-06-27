// src/services/notifications/PushNotificationService.ts
import { getMessaging, getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import { PushNotificationPayload } from './types';

class PushNotificationService {
  private messaging: any;
  private vapidKey: string;
  private isSupported: boolean;

  constructor() {
    this.vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.messaging = null;
    
    if (this.isSupported) {
      this.initialize();
    }
  }

  private async initialize() {
    try {
      // Dynamically import messaging to avoid SSR issues
      const { getMessaging } = await import('firebase/messaging');
      const { app } = await import('@/lib/firebase/config');
      this.messaging = getMessaging(app);
      
      // Listen for foreground messages
      if (this.messaging) {
        onMessage(this.messaging, (payload) => {
          this.handleForegroundMessage(payload);
        });
      }
    } catch (error) {
      console.warn('Push notifications not supported:', error);
    }
  }

  // Check if push is supported
  isSupportedBrowser(): boolean {
    return this.isSupported;
  }

  // Request permission and get token
  async requestPermission(): Promise<string | null> {
    if (!this.isSupportedBrowser()) {
      console.warn('Push notifications not supported');
      return null;
    }

    try {
      // Check permission status
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: this.vapidKey,
      });

      if (token) {
        // Save token to Firestore
        await this.saveToken(token);
        console.log('✅ Push notification token saved:', token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return null;
    }
  }

  // Save FCM token to Firestore
  private async saveToken(token: string): Promise<void> {
    try {
      const { useAuthStore } = await import('@/stores/authStore');
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.warn('No user logged in, cannot save token');
        return;
      }

      // Create token document
      await setDoc(doc(db, 'fcmTokens', token), {
        token,
        userId: user.uid,
        createdAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
        deviceInfo: {
          platform: navigator.platform || 'unknown',
          browser: navigator.userAgent || 'unknown',
          os: navigator.userAgent || 'unknown',
        },
      });

    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  // Delete FCM token
  async deleteToken(): Promise<void> {
    try {
      const { useAuthStore } = await import('@/stores/authStore');
      const user = useAuthStore.getState().user;
      
      if (!user) return;

      // Delete token from Firestore
      const tokensQuery = query(
        collection(db, 'fcmTokens'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(tokensQuery);
      
      for (const docSnap of snapshot.docs) {
        await deleteDoc(doc(db, 'fcmTokens', docSnap.id));
      }

      // Delete from FCM
      if (this.messaging) {
        await deleteToken(this.messaging);
      }
      
      console.log('✅ FCM token deleted');
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }

  // Handle foreground message
  private handleForegroundMessage(payload: any) {
    const { title, body, data } = payload.notification || {};
    
    if (title && body) {
      // Dispatch event for in-app notification
      window.dispatchEvent(new CustomEvent('push-notification', {
        detail: {
          title,
          body,
          data: data || {},
          icon: payload.notification?.icon || '/icon-192.png',
        },
      }));
    }
  }

  // Send push notification (via Cloud Function)
  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; results?: any }> {
    try {
      // This would call a Firebase Cloud Function
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { functions } = await import('@/lib/firebase/config');
      
      const sendPush = httpsCallable(functions, 'sendPushNotification');
      const result = await sendPush({
        userId,
        ...payload,
      });

      return result.data;
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false };
    }
  }

  // Send test notification
  async sendTestNotification(): Promise<void> {
    const { useAuthStore } = await import('@/stores/authStore');
    const user = useAuthStore.getState().user;
    
    if (!user) {
      console.warn('No user logged in');
      return;
    }

    await this.sendPushNotification(user.uid, {
      title: '🔔 Test Notification',
      body: 'This is a test push notification from GRID Security!',
      icon: '/icon-192.png',
      badge: '/badge-icon.png',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
      requireInteraction: true,
      vibrate: [200, 100, 200],
    });
  }

  // Get notification status
  async getNotificationStatus(): Promise<{
    permission: NotificationPermission;
    tokenExists: boolean;
  }> {
    const permission = 'Notification' in window ? Notification.permission : 'denied';
    const { useAuthStore } = await import('@/stores/authStore');
    const user = useAuthStore.getState().user;
    
    let tokenExists = false;
    if (user) {
      const tokensQuery = query(
        collection(db, 'fcmTokens'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(tokensQuery);
      tokenExists = !snapshot.empty;
    }

    return {
      permission,
      tokenExists,
    };
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();