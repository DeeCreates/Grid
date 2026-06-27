// src/components/notifications/NotificationList.tsx
import React, { useState, useCallback } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/Button';
import { Bell, CheckCheck, Trash2, Loader2 } from 'lucide-react';

interface NotificationListProps {
  maxHeight?: string;
  showActions?: boolean;
}

export function NotificationList({ maxHeight = '400px', showActions = true }: NotificationListProps) {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleMarkAsRead = useCallback(async (id: string) => {
    setProcessingId(id);
    try {
      await markAsRead(id);
    } finally {
      setProcessingId(null);
    }
  }, [markAsRead]);

  const handleDelete = useCallback(async (id: string) => {
    setProcessingId(id);
    try {
      await deleteNotification(id);
    } finally {
      setProcessingId(null);
    }
  }, [deleteNotification]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-lime-400 animate-spin" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
        <p className="text-neutral-400">No notifications</p>
        <p className="text-sm text-neutral-500">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      {showActions && (
        <div className="flex justify-between items-center pb-3 border-b border-neutral-800">
          <span className="text-sm text-neutral-400">{notifications.length} notifications</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-neutral-400 hover:text-white text-xs h-7"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div
        className="space-y-3 overflow-y-auto"
        style={{ maxHeight }}
      >
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={handleMarkAsRead}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}