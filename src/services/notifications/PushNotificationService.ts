// src/services/notifications/PushNotificationService.ts
import { 
  getMessaging, 
  getToken, 
  onMessage, 
  deleteToken,
  Messaging
} from 'firebase/messaging';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { 
  getFunctions, 
  httpsCallable 
} from 'firebase/functions';
import { db, app } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import { PushNotificationPayload } from './types';

class PushNotificationService {
  private messaging: Messaging | null = null;
  private vapidKey: string;
  private isSupported: boolean;
  private initialized: boolean = false;

  constructor() {
    this.vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
    this.isSupported = this.checkSupport();
    
    // Auto-initialize if supported
    if (this.isSupported) {
      this.initialize();
    }
  }

  /**
   * Check if browser supports push notifications
   */
  private checkSupport(): boolean {
    return 'Notification' in window && 
           'serviceWorker' in navigator && 
           'PushManager' in window;
  }

  /**
   * Initialize Firebase Messaging
   */
  private async initialize(): Promise<void> {
    if (this.initialized || !this.isSupported) return;

    try {
      this.messaging = getMessaging(app);
      this.initialized = true;
      
      // Listen for foreground messages
      if (this.messaging) {
        onMessage(this.messaging, (payload) => {
          this.handleForegroundMessage(payload);
        });
      }
      
      console.log('✅ Push notification service initialized');
    } catch (error) {
      console.warn('Push notifications initialization failed:', error);
      this.isSupported = false;
    }
  }

  /**
   * Check if push is supported
   */
  isSupportedBrowser(): boolean {
    return this.isSupported && this.initialized;
  }

  /**
   * Request permission and get FCM token
   */
  async requestPermission(): Promise<string | null> {
    if (!this.isSupported) {
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

      // Ensure messaging is initialized
      if (!this.messaging) {
        await this.initialize();
        if (!this.messaging) {
          throw new Error('Messaging not initialized');
        }
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

  /**
   * Save FCM token to Firestore
   */
  private async saveToken(token: string): Promise<void> {
    try {
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.warn('No user logged in, cannot save token');
        return;
      }

      // Create or update token document
      const tokenRef = doc(db, 'fcmTokens', token);
      await setDoc(tokenRef, {
        token,
        userId: user.uid,
        userEmail: user.email || '',
        createdAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
        deviceInfo: {
          platform: navigator.platform || 'unknown',
          userAgent: navigator.userAgent || 'unknown',
          language: navigator.language || 'unknown',
          screenResolution: `${window.screen.width}x${window.screen.height}`,
        },
      }, { merge: true });

    } catch (error) {
      console.error('Error saving FCM token:', error);
      throw error;
    }
  }

  /**
   * Delete FCM token
   */
  async deleteToken(): Promise<void> {
    try {
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.warn('No user logged in');
        return;
      }

      // Delete token from Firestore
      const tokensQuery = query(
        collection(db, 'fcmTokens'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(tokensQuery);
      
      const deletePromises = snapshot.docs.map(async (docSnap) => {
        await deleteDoc(doc(db, 'fcmTokens', docSnap.id));
      });
      
      await Promise.all(deletePromises);

      // Delete from FCM
      if (this.messaging) {
        try {
          await deleteToken(this.messaging);
        } catch (error) {
          // Token might already be deleted or invalid
          console.debug('FCM token deletion error (ignored):', error);
        }
      }
      
      console.log('✅ FCM token deleted');
    } catch (error) {
      console.error('Error deleting FCM token:', error);
      throw error;
    }
  }

  /**
   * Handle foreground message
   */
  private handleForegroundMessage(payload: any): void {
    const { title, body, data, icon, image } = payload.notification || {};
    
    if (title && body) {
      // Dispatch event for in-app notification
      window.dispatchEvent(new CustomEvent('push-notification', {
        detail: {
          title,
          body,
          data: data || {},
          icon: icon || '/icon-192.png',
          image: image || null,
          timestamp: new Date().toISOString(),
        },
      }));
      
      console.log('📨 Foreground notification received:', { title, body });
    }
  }

  /**
   * Send push notification via Cloud Function
   */
  async sendPushNotification(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const functions = getFunctions(app);
      const sendPush = httpsCallable(functions, 'sendPushNotification');
      
      const result = await sendPush({
        userId,
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/badge-icon.png',
        data: payload.data || {},
        requireInteraction: payload.requireInteraction || false,
        vibrate: payload.vibrate || [200, 100, 200],
        clickAction: payload.clickAction || '/',
      });

      return { 
        success: true, 
        messageId: result.data?.messageId 
      };
    } catch (error: any) {
      console.error('Error sending push notification:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error' 
      };
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(): Promise<void> {
    const user = useAuthStore.getState().user;
    
    if (!user) {
      console.warn('No user logged in');
      return;
    }

    const result = await this.sendPushNotification(user.uid, {
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
      clickAction: '/notifications',
    });

    if (result.success) {
      console.log('✅ Test notification sent successfully');
    } else {
      console.error('❌ Failed to send test notification:', result.error);
    }
  }

  /**
   * Get notification status
   */
  async getNotificationStatus(): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    tokenExists: boolean;
    initialized: boolean;
  }> {
    const permission = 'Notification' in window ? Notification.permission : 'denied';
    const user = useAuthStore.getState().user;
    
    let tokenExists = false;
    if (user) {
      try {
        const tokensQuery = query(
          collection(db, 'fcmTokens'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(tokensQuery);
        tokenExists = !snapshot.empty;
      } catch (error) {
        console.warn('Error checking token existence:', error);
      }
    }

    return {
      supported: this.isSupported,
      permission,
      tokenExists,
      initialized: this.initialized,
    };
  }

  /**
   * Refresh token (useful for re-authentication)
   */
  async refreshToken(): Promise<string | null> {
    try {
      // Delete old token
      await this.deleteToken();
      
      // Request new token
      const newToken = await this.requestPermission();
      
      if (newToken) {
        console.log('✅ Token refreshed successfully');
        return newToken;
      }
      
      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Handle user logout - cleanup tokens
   */
  async handleLogout(): Promise<void> {
    await this.deleteToken();
    console.log('✅ Push notifications cleaned up for logout');
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();

// Export types
export type { PushNotificationPayload };