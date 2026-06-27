// src/components/notifications/NotificationItem.tsx
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, AlertCircle, Info, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { Notification } from '@/services/notifications/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAction?: (action: string, data: any) => void;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircle;
    case 'warning': return AlertTriangle;
    case 'error': return AlertCircle;
    case 'alert': return Bell;
    default: return Info;
  }
};

const getColor = (type: string) => {
  switch (type) {
    case 'success': return 'text-emerald-400';
    case 'warning': return 'text-yellow-400';
    case 'error': return 'text-red-400';
    case 'alert': return 'text-red-400';
    default: return 'text-blue-400';
  }
};

const getBg = (type: string) => {
  switch (type) {
    case 'success': return 'bg-emerald-400/10';
    case 'warning': return 'bg-yellow-400/10';
    case 'error': return 'bg-red-400/10';
    case 'alert': return 'bg-red-400/10';
    default: return 'bg-blue-400/10';
  }
};

export function NotificationItem({ notification, onRead, onDelete, onAction }: NotificationItemProps) {
  const Icon = getIcon(notification.type);
  const color = getColor(notification.type);
  const bg = getBg(notification.type);

  const handleClick = () => {
    if (!notification.read && onRead) {
      onRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <div
      className={cn(
        'p-4 rounded-lg transition-all duration-200 cursor-pointer hover:bg-neutral-800/30',
        !notification.read ? 'bg-neutral-800/50 border-l-2 border-lime-400' : 'bg-neutral-800/20',
        'border border-neutral-800'
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', bg)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-white text-sm">{notification.title}</p>
              <p className="text-sm text-neutral-400 mt-0.5">{notification.body}</p>
            </div>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                className="text-neutral-500 hover:text-neutral-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-neutral-500">
              {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
            </span>
            <span className="text-xs px-2 py-0.5 bg-neutral-800 rounded text-neutral-400 capitalize">
              {notification.category}
            </span>
          </div>
          {notification.actionLabel && notification.actionUrl && (
            <Button
              size="sm"
              className="mt-2 bg-lime-400 text-black hover:bg-lime-300 text-xs h-7 px-3"
              onClick={(e) => {
                e.stopPropagation();
                if (onAction) {
                  onAction('click', notification);
                }
                window.location.href = notification.actionUrl;
              }}
            >
              {notification.actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}