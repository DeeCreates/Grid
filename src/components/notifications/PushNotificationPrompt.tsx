// src/components/notifications/PushNotificationPrompt.tsx
import React, { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

interface PushNotificationPromptProps {
  onClose?: () => void;
  className?: string;
}

export function PushNotificationPrompt({ onClose, className }: PushNotificationPromptProps) {
  const { isPushSupported, pushPermission, requestPushPermission } = useNotifications();
  const [loading, setLoading] = useState(false);

  if (!isPushSupported || pushPermission === 'granted') {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    await requestPushPermission();
    setLoading(false);
    if (onClose) onClose();
  };

  return (
    <Card className={cn('bg-[#161616] border-neutral-800', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-lime-400/10 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-lime-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white">Enable Notifications</h4>
            <p className="text-sm text-neutral-400 mt-0.5">
              Get real-time alerts for security incidents, service updates, and more.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleEnable}
                loading={loading}
                className="bg-lime-400 text-black hover:bg-lime-300 h-7 text-xs"
              >
                <Bell className="w-3 h-3 mr-1" />
                Enable
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-neutral-400 hover:text-white h-7 text-xs"
              >
                <BellOff className="w-3 h-3 mr-1" />
                Not now
              </Button>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-300 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}