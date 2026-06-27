// src/components/notifications/NotificationBadge.tsx
import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  onClick?: () => void;
  className?: string;
  iconSize?: number;
}

export function NotificationBadge({ onClick, className, iconSize = 24 }: NotificationBadgeProps) {
  const { unreadCount } = useNotifications();

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-2 rounded-full hover:bg-neutral-800/50 transition-colors',
        className
      )}
    >
      <Bell className="w-5 h-5 text-neutral-400" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}