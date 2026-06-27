// src/components/common/BottomNavWithFAB.tsx
import { useState } from 'react';
import { Plus, X, Camera, Calendar, Mail, Phone, FileText } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { Button } from '@/components/ui/Button';

export function BottomNavWithFAB() {
  const [isFabOpen, setIsFabOpen] = useState(false);

  const quickActions = [
    { icon: Camera, label: 'Quick Scan', color: 'bg-blue-500' },
    { icon: Calendar, label: 'New Booking', color: 'bg-green-500' },
    { icon: Mail, label: 'Send Report', color: 'bg-purple-500' },
    { icon: Phone, label: 'Emergency', color: 'bg-red-500' },
    { icon: FileText, label: 'New Ticket', color: 'bg-yellow-500' },
  ];

  return (
    <>
      <BottomNav />
      
      {/* FAB Button */}
      <div className="fixed bottom-20 right-4 z-50 md:hidden">
        {/* FAB Actions */}
        {isFabOpen && (
          <div className="absolute bottom-16 right-0 space-y-2 animate-slide-up">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className={`${action.color} text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-110 flex items-center gap-2 min-w-[120px] justify-end`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="text-xs font-medium">{action.label}</span>
                <action.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
        
        {/* FAB Toggle */}
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={cn(
            'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300',
            isFabOpen ? 'bg-red-500 rotate-45' : 'bg-lime-400 hover:bg-lime-300'
          )}
        >
          {isFabOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Plus className="w-6 h-6 text-black" />
          )}
        </button>
      </div>
    </>
  );
}