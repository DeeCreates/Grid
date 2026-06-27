// src/components/common/BottomNav.tsx
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Camera, 
  Calendar, 
  User, 
  Settings,
  Users,
  Package,
  BarChart3,
  Shield,
  Briefcase,
  Activity,
  Bell,
  Plus,
  Search,
  Menu,
  X,
  LogOut,
  Truck,
  MapPin,
  AlertTriangle,
  DollarSign,
  Building,
  ClipboardList,
  Wifi,
  HardDrive,
  Ticket,
  FileText,
  Clock,
  CheckCircle,
  ChevronUp,
  Grid,
  LayoutDashboard,
  ShoppingCart,
  Heart,
  MessageCircle,
  Star,
  TrendingUp,
  Award
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  active?: boolean;
  badge?: number;
}

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, signOut } = useAuthStore();
  const [showMore, setShowMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Handle scroll hide/show
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Get role-based navigation items with icons
  const getNavItems = (role: string = 'customer'): NavItem[] => {
    const baseItems: NavItem[] = [];

    switch (role) {
      case 'customer':
        baseItems.push(
          { icon: LayoutDashboard, label: 'Home', path: '/customer/dashboard' },
          { icon: Camera, label: 'Monitor', path: '/customer/monitoring' },
          { icon: HardDrive, label: 'Archive', path: '/customer/recordings' },
          { icon: Ticket, label: 'Support', path: '/customer/support' },
          { icon: User, label: 'Profile', path: '/customer/settings' }
        );
        break;

      case 'technician':
        baseItems.push(
          { icon: LayoutDashboard, label: 'Dashboard', path: '/technician/dashboard' },
          { icon: Calendar, label: 'Jobs', path: '/technician/jobs' },
          { icon: MapPin, label: 'Route', path: '/technician/route' },
          { icon: Package, label: 'Equipment', path: '/technician/equipment' },
          { icon: User, label: 'Profile', path: '/technician/settings' }
        );
        break;

      case 'guard':
        baseItems.push(
          { icon: LayoutDashboard, label: 'Dashboard', path: '/guard/dashboard' },
          { icon: MapPin, label: 'Patrol', path: '/guard/patrol' },
          { icon: AlertTriangle, label: 'Incidents', path: '/guard/incidents' },
          { icon: Activity, label: 'Checkpoints', path: '/guard/checkpoints' },
          { icon: User, label: 'Profile', path: '/guard/settings' }
        );
        break;

      case 'partner':
        baseItems.push(
          { icon: LayoutDashboard, label: 'Dashboard', path: '/partner/dashboard' },
          { icon: Users, label: 'Leads', path: '/partner/leads' },
          { icon: DollarSign, label: 'Earnings', path: '/partner/earnings' },
          { icon: FileText, label: 'Reports', path: '/partner/reports' },
          { icon: User, label: 'Profile', path: '/partner/settings' }
        );
        break;

      case 'admin':
        baseItems.push(
          { icon: LayoutDashboard, label: 'Overview', path: '/operations/dashboard' },
          { icon: Users, label: 'Customers', path: '/operations/customers' },
          { icon: Package, label: 'Inventory', path: '/operations/inventory' },
          { icon: Calendar, label: 'Deployments', path: '/operations/deployments' },
          { icon: BarChart3, label: 'Analytics', path: '/operations/analytics' }
        );
        break;

      default:
        baseItems.push(
          { icon: Home, label: 'Home', path: '/' },
          { icon: User, label: 'Login', path: '/login' }
        );
    }

    return baseItems;
  };

  const navItems = getNavItems(userProfile?.role);
  const currentPath = location.pathname;

  // Check if path matches
  const isActive = (path: string) => {
    if (path === '/') return currentPath === path;
    return currentPath.startsWith(path);
  };

  // Handle navigation
  const handleNavigate = (path: string) => {
    navigate(path);
    setShowMore(false);
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
    setShowMore(false);
  };

  // Get visible items (first 4 for main nav)
  const visibleItems = navItems.slice(0, 4);
  const moreItems = navItems.slice(4);

  // If no items, don't render
  if (navItems.length === 0) return null;

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'md:hidden',
        'transition-all duration-300 transform',
        isVisible ? 'translate-y-0' : 'translate-y-full',
        className
      )}>
        {/* Glass effect background */}
        <div className="relative bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-neutral-800/50 shadow-2xl shadow-black/50">
          {/* Brand indicator line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-lime-400/0 via-lime-400 to-lime-400/0 rounded-full" />
          
          <div className="flex items-center justify-around h-[68px] px-2">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    'flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200',
                    'relative group',
                    active ? 'text-lime-400' : 'text-neutral-500 hover:text-neutral-300'
                  )}
                >
                  <div className="relative">
                    <div className={cn(
                      'p-1.5 rounded-lg transition-all duration-200',
                      active ? 'bg-lime-400/10' : 'group-hover:bg-neutral-800/50'
                    )}>
                      <Icon className={cn(
                        'w-5 h-5 transition-all duration-200',
                        active && 'scale-110'
                      )} />
                    </div>
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'text-[8px] font-medium mt-0.5 transition-colors',
                    active ? 'text-lime-400' : 'text-neutral-500'
                  )}>
                    {item.label}
                  </span>
                  {active && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-lime-400 to-lime-300 rounded-full shadow-lg shadow-lime-400/50" />
                  )}
                </button>
              );
            })}

            {/* More Button */}
            {moreItems.length > 0 && (
              <button
                onClick={() => setShowMore(!showMore)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200',
                  showMore ? 'text-lime-400' : 'text-neutral-500 hover:text-neutral-300'
                )}
              >
                <div className="p-1.5 rounded-lg transition-all duration-200">
                  <Grid className={cn(
                    'w-5 h-5 transition-transform duration-200',
                    showMore && 'rotate-90'
                  )} />
                </div>
                <span className="text-[8px] font-medium mt-0.5">
                  {showMore ? 'Close' : 'More'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* More Menu */}
        {showMore && moreItems.length > 0 && (
          <div className="absolute bottom-[76px] left-3 right-3 bg-[#161616]/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-lime-400 rounded-lg flex items-center justify-center">
                  <Grid className="w-3 h-3 text-black" />
                </div>
                <span className="text-sm font-medium text-white">More Options</span>
              </div>
              <button
                onClick={() => setShowMore(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {moreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className={cn(
                        'flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all duration-200',
                        active 
                          ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20' 
                          : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300'
                      )}
                    >
                      <Icon className={cn(
                        'w-5 h-5 transition-transform duration-200',
                        active && 'scale-110'
                      )} />
                      <span className={cn(
                        'text-[8px] font-medium mt-1.5',
                        active ? 'text-lime-400' : 'text-neutral-500'
                      )}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800/50" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2 bg-[#161616] text-[8px] text-neutral-500">Account</span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-xs font-medium">Sign Out</span>
              </button>
            </div>

            {/* Pull indicator */}
            <div className="flex justify-center py-2 border-t border-neutral-800/50">
              <div className="w-8 h-1 bg-neutral-700 rounded-full" />
            </div>
          </div>
        )}
      </nav>

      {/* Backdrop for More Menu */}
      {showMore && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setShowMore(false)}
        />
      )}
    </>
  );
}