// src/components/ui/StatsCard.tsx
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;
  changeLabel?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

const colorStyles = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  red: 'bg-red-100 text-red-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  purple: 'bg-purple-100 text-purple-600',
};

export function StatsCard({ title, value, icon: Icon, change, changeLabel, color = 'blue' }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                <span className={cn(
                  'text-xs font-medium',
                  change >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {change >= 0 ? '+' : ''}{change}%
                </span>
                {changeLabel && <span className="text-xs text-gray-500">{changeLabel}</span>}
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-full', colorStyles[color])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}