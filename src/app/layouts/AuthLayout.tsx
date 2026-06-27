// src/app/layouts/AuthLayout.tsx
import { Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toaster';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#0D0D0D]">
      <main>
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}