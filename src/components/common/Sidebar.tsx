// src/components/common/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  Wifi,
  HardDrive,
  Ticket,
  FileText,
  Users,
  Package,
  Calendar,
  AlertTriangle,
  BarChart3,
  Settings,
  Shield,
  Activity,
  MapPin,
  ClipboardList,
  DollarSign,
  ShoppingCart,
  LogOut,
  ChevronDown,
  ChevronRight,
  Home,
  User,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

interface SidebarProps {
  role: 'customer' | 'technician' | 'guard' | 'partner' | 'admin' | 'sales';
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  subItems?: { label: string; href: string }[];
}

const customerNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/customer/dashboard' },
  { icon: Camera, label: 'Live Monitoring', href: '/customer/monitoring' },
  { icon: HardDrive, label: 'Video Archive', href: '/customer/recordings' },
  { icon: Wifi, label: 'Services', href: '/customer/services' },
  { icon: Calendar, label: 'Bookings', href: '/customer/bookings' },
  { icon: Ticket, label: 'Support', href: '/customer/support' },
  { icon: FileText, label: 'Reports', href: '/customer/reports' },
  { icon: Settings, label: 'Settings', href: '/customer/settings' },
];

const technicianNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/technician/dashboard' },
  { icon: Calendar, label: "Today's Jobs", href: '/technician/jobs' },
  { icon: MapPin, label: 'Route', href: '/technician/route' },
  { icon: Package, label: 'Equipment', href: '/technician/equipment' },
  { icon: ClipboardList, label: 'Checklists', href: '/technician/checklists' },
  { icon: Settings, label: 'Settings', href: '/technician/settings' },
];

const guardNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/guard/dashboard' },
  { icon: MapPin, label: 'Patrol', href: '/guard/patrol' },
  { icon: AlertTriangle, label: 'Incidents', href: '/guard/incidents' },
  { icon: Activity, label: 'Checkpoints', href: '/guard/checkpoints' },
  { icon: Settings, label: 'Settings', href: '/guard/settings' },
];

const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Overview', href: '/operations/dashboard' },
  { icon: Users, label: 'Customers', href: '/operations/customers' },
  { icon: Package, label: 'Services', href: '/operations/services' },
  { icon: Calendar, label: 'Deployments', href: '/operations/deployments' },
  { icon: Package, label: 'Inventory', href: '/operations/inventory' },
  { icon: AlertTriangle, label: 'Incidents', href: '/operations/incidents' },
  { icon: BarChart3, label: 'Analytics', href: '/operations/analytics' },
  { icon: DollarSign, label: 'Billing', href: '/operations/billing' },
  { icon: Settings, label: 'Admin', href: '/operations/admin' },
];

const partnerNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/partner/dashboard' },
  { icon: Users, label: 'Leads', href: '/partner/leads' },
  { icon: DollarSign, label: 'Earnings', href: '/partner/earnings' },
  { icon: ShoppingCart, label: 'Marketplace', href: '/marketplace' },
  { icon: FileText, label: 'Reports', href: '/partner/reports' },
  { icon: Settings, label: 'Settings', href: '/partner/settings' },
];

const navItemsMap = {
  customer: customerNavItems,
  technician: technicianNavItems,
  guard: guardNavItems,
  admin: adminNavItems,
  partner: partnerNavItems,
  sales: customerNavItems,
};

export function Sidebar({ role }: SidebarProps) {
  const location = useLocation();
  const { user, userProfile, signOut } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const navItems = navItemsMap[role] || customerNavItems;

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Get user initials for avatar
  const getInitials = () => {
    const name = userProfile?.displayName || user?.email || 'User';
    return name.charAt(0).toUpperCase();
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

  return (
    <aside className={cn(
      'bg-[#0D0D0D] text-white flex flex-col h-screen sticky top-0 transition-all duration-300 border-r border-neutral-800',
      collapsed ? 'w-20' : 'w-64'
    )}>
      {/* Brand Section with Logo */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <img 
                src="/favicon.svg" 
                alt="GRID Security Logo" 
                className="w-10 h-10 rounded-xl shadow-lg shadow-lime-400/20 group-hover:shadow-lime-400/30 transition-all duration-300"
              />
              <div className="absolute -inset-1 bg-lime-400/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-white group-hover:text-lime-400 transition-colors">
                  GRID
                </span>
                <span className="text-[8px] text-lime-400 font-medium uppercase tracking-widest">
                  Security
                </span>
              </div>
            )}
          </Link>
          
          {/* Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            className="text-neutral-400 hover:text-white transition-colors hidden lg:block"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
        
        {!collapsed && (
          <p className="text-[9px] text-neutral-500 mt-2 uppercase tracking-widest">
            {getRoleDisplay()} Portal
          </p>
        )}
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center flex-shrink-0">
            <span className="text-black font-bold text-sm">{getInitials()}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userProfile?.displayName || 'User'}
              </p>
              <p className="text-[10px] text-neutral-400 truncate capitalize">
                {getRoleDisplay()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedItems.includes(item.label);

          return (
            <div key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  'flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                  active
                    ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  active ? 'text-lime-400' : 'text-neutral-400 group-hover:text-white'
                )} />
                {!collapsed && (
                  <span className="ml-3 text-sm font-medium truncate">{item.label}</span>
                )}
                {active && !collapsed && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-lime-400 rounded-r" />
                )}
                {hasSubItems && !collapsed && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleExpand(item.label);
                    }}
                    className="ml-auto text-neutral-500 hover:text-white"
                  >
                    <ChevronDown className={cn(
                      'w-4 h-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )} />
                  </button>
                )}
              </Link>
              
              {/* Sub-items */}
              {hasSubItems && isExpanded && !collapsed && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.subItems?.map((sub) => (
                    <Link
                      key={sub.href}
                      to={sub.href}
                      className={cn(
                        'flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200',
                        location.pathname === sub.href
                          ? 'text-lime-400 bg-lime-400/5'
                          : 'text-neutral-500 hover:text-white hover:bg-neutral-800/50'
                      )}
                    >
                      <span className="truncate">{sub.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-800 space-y-2">
        {/* Logout Button */}
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center w-full px-3 py-2 rounded-lg transition-all duration-200 text-neutral-400 hover:text-red-400 hover:bg-red-500/10',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="ml-3 text-sm font-medium">Logout</span>}
        </button>

        {/* Version Info */}
        {!collapsed && (
          <div className="px-3 pt-2">
            <p className="text-[8px] text-neutral-600 uppercase tracking-widest">
              v1.0.0 • © 2026 GRID Security
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}