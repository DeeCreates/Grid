// src/components/ui/StatusBadge.tsx
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' | 'urgent' | 'critical' | 'normal';
  label?: string;
}

const statusStyles = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  urgent: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
  normal: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    urgent: 'Urgent',
    critical: 'Critical',
    normal: 'Normal',
  };

  return (
    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusStyles[status])}>
      {label || labels[status]}
    </span>
  );
}