// src/components/common/DashboardHeader.tsx
import { Bell, User, LogOut, Settings, ChevronDown, Shield, Search, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useNotifications } from '@/contexts/NotificationContext';

interface DashboardHeaderProps {
  role: string;
  onMenuClick?: () => void;
}

export function DashboardHeader({ role, onMenuClick }: DashboardHeaderProps) {
  const { user, userProfile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user initials for avatar
  const getInitials = () => {
    const name = userProfile?.displayName || user?.email || 'User';
    return name.charAt(0).toUpperCase();
  };

  // Get user full name
  const getFullName = () => {
    return userProfile?.displayName || user?.email?.split('@')[0] || 'User';
  };

  // Get user role display name
  const getRoleDisplay = () => {
    const roleMap: Record<string, string> = {
      customer: 'Customer',
      technician: 'Technician',
      guard: 'Security Guard',
      partner: 'Partner',
      admin: 'Administrator',
      sales: 'Sales',
    };
    return roleMap[role] || role;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log('Searching for:', searchQuery);
    }
  };

  return (
    <header className="bg-[#0D0D0D] border-b border-neutral-800 px-4 sm:px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        {/* Left Section - Mobile Menu + Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden text-neutral-400 hover:text-white transition-colors p-1"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lime-400 rounded-lg flex items-center justify-center lg:hidden">
              <Shield className="w-4 h-4 text-black" />
            </div>
            <h1 className="text-sm sm:text-base font-semibold text-white capitalize">
              {getRoleDisplay()}
            </h1>
            <span className="hidden sm:inline text-[8px] text-neutral-500 uppercase tracking-widest border border-neutral-800 rounded px-2 py-0.5">
              {role}
            </span>
          </div>
        </div>

        {/* Center Section - Search (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900/50 border border-neutral-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-lime-400/50 transition-colors"
              />
            </div>
          </form>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search (Mobile) */}
          <button
            className="md:hidden text-neutral-400 hover:text-white transition-colors p-1"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notification Center - Integrated with real data */}
          <NotificationCenter />

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-neutral-800/50 rounded-lg px-2 py-1.5 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center flex-shrink-0">
                <span className="text-black font-bold text-sm">{getInitials()}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white leading-tight">
                  {getFullName()}
                </p>
                <p className="text-[10px] text-neutral-400 leading-tight capitalize">
                  {getRoleDisplay()}
                </p>
              </div>
              <ChevronDown className={cn(
                'w-4 h-4 text-neutral-500 transition-transform',
                showUserMenu && 'rotate-180'
              )} />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[#161616] border border-neutral-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                <div className="p-3 border-b border-neutral-800">
                  <p className="text-sm font-medium text-white">{getFullName()}</p>
                  <p className="text-xs text-neutral-400">{user?.email}</p>
                  <p className="text-[10px] text-lime-400 mt-1 capitalize">{getRoleDisplay()}</p>
                </div>
                
                <div className="py-1">
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  
                  <Link
                    to={`/${role}/dashboard`}
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>

                  <Link
                    to="/operations/notifications"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800/50 transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </div>

                <div className="border-t border-neutral-800 py-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}