// src/app/layouts/DashboardLayout.tsx
import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from '@/components/common/Sidebar';
import { DashboardHeader } from '@/components/common/DashboardHeader';
import { BottomNav } from '@/components/common/BottomNav';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  userRole: 'customer' | 'technician' | 'guard' | 'partner' | 'admin' | 'sales';
  children: ReactNode;
}

export function DashboardLayout({ userRole, children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  console.log('📐 DashboardLayout rendering with role:', userRole);

  return (
    <div className="flex flex-col h-screen bg-[#0D0D0D]">
      {/* Header */}
      <DashboardHeader 
        role={userRole} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <div className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:z-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <Sidebar 
            role={userRole} 
            onClose={() => setSidebarOpen(false)}
          />
        </div>
        
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 pb-24 md:pb-6">
              {children}
            </div>
          </main>
        </div>
      </div>
      
      {/* Bottom Navigation - Mobile */}
      <BottomNav />
    </div>
  );
}