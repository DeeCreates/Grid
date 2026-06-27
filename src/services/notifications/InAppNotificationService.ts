// src/services/notifications/InAppNotificationService.ts
import { collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Notification, InAppNotification, NotificationStats } from './types';

class InAppNotificationService {
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private unsubscribe: (() => void) | null = null;
  private currentUserId: string | null = null;

  // Initialize real-time listener for a user
  initializeListener(userId: string): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.currentUserId = userId;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        readAt: doc.data().readAt?.toDate() || null,
        expiresAt: doc.data().expiresAt?.toDate() || null,
      })) as Notification[];

      this.notifyListeners(notifications);
    }, (error) => {
      console.error('Error listening to notifications:', error);
    });
  }

  // Clean up listener
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.currentUserId = null;
  }

  // Add listener
  addListener(callback: (notifications: Notification[]) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners(notifications: Notification[]): void {
    this.listeners.forEach(callback => callback(notifications));
  }

  // Create in-app notification
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'readAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        ...notification,
        read: false,
        readAt: null,
        createdAt: serverTimestamp(),
        expiresAt: notification.expiresAt ? Timestamp.fromDate(notification.expiresAt) : null,
      });

      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get notification stats
  async getStats(userId: string): Promise<NotificationStats> {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      const total = snapshot.docs.length;
      const unread = snapshot.docs.filter(doc => !doc.data().read).length;

      const byCategory: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        byCategory[data.category] = (byCategory[data.category] || 0) + 1;
        byPriority[data.priority] = (byPriority[data.priority] || 0) + 1;
      });

      return {
        total,
        unread,
        byCategory,
        byPriority,
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return { total: 0, unread: 0, byCategory: {}, byPriority: {} };
    }
  }

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('userId', '==', userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Show toast notification (for foreground)
  showToast(notification: InAppNotification): void {
    window.dispatchEvent(new CustomEvent('in-app-notification', {
      detail: {
        ...notification,
        duration: notification.duration || 5000,
        dismissible: notification.dismissible !== false,
      },
    }));
  }
}

export const inAppNotificationService = new InAppNotificationService();