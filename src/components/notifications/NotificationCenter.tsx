// src/components/notifications/NotificationCenter.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { NotificationBadge } from './NotificationBadge';
import { NotificationList } from './NotificationList';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <NotificationBadge
        onClick={() => setIsOpen(!isOpen)}
      />
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-[#161616] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="p-4 border-b border-neutral-800">
            <h3 className="text-lg font-semibold text-white">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </h3>
          </div>
          <div className="p-4">
            <NotificationList maxHeight="300px" showActions={true} />
          </div>
          <div className="p-3 border-t border-neutral-800 text-center">
            <button
              className="text-sm text-lime-400 hover:text-lime-300 transition"
              onClick={() => window.location.href = '/notifications'}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}