// src/components/ui/Tabs.tsx
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  variant?: 'underline' | 'pills' | 'cards';
  onChange?: (tabId: string) => void;
}

export function Tabs({ tabs, defaultTab, variant = 'underline', onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const variants = {
    underline: {
      container: 'border-b border-gray-200',
      tab: (isActive: boolean) =>
        cn(
          'px-4 py-2 text-sm font-medium transition-all -mb-px',
          isActive
            ? 'border-b-2 border-blue-600 text-blue-600'
            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
        ),
    },
    pills: {
      container: 'flex gap-2',
      tab: (isActive: boolean) =>
        cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-all',
          isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
        ),
    },
    cards: {
      container: 'grid grid-cols-3 gap-4',
      tab: (isActive: boolean) =>
        cn(
          'p-4 text-center rounded-xl border-2 transition-all',
          isActive
            ? 'border-blue-600 bg-blue-50 text-blue-600'
            : 'border-gray-200 text-gray-600 hover:border-gray-300'
        ),
    },
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div>
      <div className={variants[variant].container}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(variants[variant].tab(tab.id === activeTab), 'flex items-center gap-2')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6">{activeTabContent}</div>
    </div>
  );
}