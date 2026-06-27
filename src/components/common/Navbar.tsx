// src/components/common/Navbar.tsx
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ChevronDown, ArrowRight, User, LogOut, Settings, Shield, 
  Menu, X, Camera, Home, Briefcase, Phone, Info,
  ChevronRight, CheckCircle, Lock, ShoppingCart, BookOpen, Target, Activity
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, userProfile, signOut, isAuthenticated } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    navigate('/login');
  };

  const getDashboardPath = () => {
    const role = userProfile?.role || user?.role;
    switch (role) {
      case 'customer': return '/customer/dashboard';
      case 'technician': return '/technician/dashboard';
      case 'guard': return '/guard/dashboard';
      case 'partner': return '/partner/dashboard';
      case 'admin': return '/operations/dashboard';
      case 'sales': return '/customer/dashboard';
      default: return '/customer/dashboard';
    }
  };

  const navItems = [
    { path: '/services', label: 'Services', icon: Camera },
    { path: '/solutions', label: 'Solutions', icon: Target },
    { path: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
    { path: '/resources', label: 'Resources', icon: BookOpen },
    { path: '/about', label: 'About', icon: Info },
    { path: '/contact', label: 'Contact', icon: Phone },
  ];

  const isActive = (path: string) => location.pathname === path;

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out forwards;
        }
      `}</style>
      
      <header 
        className={`fixed top-0 left-0 w-full z-50 px-4 md:px-8 transition-all duration-300 ${
          scrolled ? 'py-2.5 bg-[#0A0A0A] border-b border-neutral-800/50' : 'py-4 bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* LEFT: Brand with Logo */}
          <Link to="/" className="flex items-center gap-2.5 group relative flex-shrink-0">
            <div className="relative">
              {/* Logo Image */}
              <img 
                src="/favicon.svg" 
                alt="GRID Security Logo" 
                className="w-9 h-9 rounded-xl shadow-lg shadow-lime-400/20 group-hover:shadow-lime-400/30 transition-all duration-300"
              />
              <div className="absolute -inset-1 bg-lime-400/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold tracking-tight text-sm text-white">GRID</span>
              <span className="text-[7px] uppercase tracking-[0.2em] text-neutral-500 font-medium">Security</span>
            </div>
          </Link>

          {/* CENTER: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-neutral-900/50 border border-neutral-800 rounded-full px-1.5 py-1.5 mx-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                    active 
                      ? 'bg-lime-400 text-black shadow-lg shadow-lime-400/20' 
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-black' : 'text-neutral-500'}`} />
                  {item.label}
                  {active && (
                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Quick Actions */}
            <Link to="/security-assessment" className="hidden md:flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-lime-400 hover:text-lime-300 transition-colors bg-neutral-900/50 border border-neutral-800 px-3 py-1.5 rounded-full hover:border-lime-400/30">
              <Activity className="w-3 h-3" />
              Assessment
            </Link>

            {/* Auth Section */}
            {isAuthenticated && user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2.5 bg-neutral-900/50 border border-neutral-800 rounded-full pl-2 pr-3.5 py-1.5 transition-all hover:border-neutral-600 hover:bg-neutral-800/50 group"
                >
                  <div className="relative">
                    <div className="w-7 h-7 rounded-full bg-lime-400/20 flex items-center justify-center overflow-hidden border border-lime-400/20">
                      <User className="w-3.5 h-3.5 text-lime-400" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0A0A0A]" />
                  </div>
                  <span className="max-w-[80px] truncate text-[11px] font-medium text-white group-hover:text-lime-400 transition-colors">
                    {displayName}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#161616] border border-neutral-800 rounded-2xl p-1.5 shadow-2xl shadow-black/50 overflow-hidden animate-slideDown">
                    <div className="px-3 py-2.5 border-b border-neutral-800/50 mb-1">
                      <p className="text-[10px] font-medium text-white truncate">{displayName}</p>
                      <p className="text-[8px] text-neutral-500 uppercase tracking-wider capitalize">{userProfile?.role || user?.role || 'User'}</p>
                    </div>
                    
                    <Link 
                      to={getDashboardPath()} 
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 hover:bg-neutral-800 hover:text-white rounded-xl transition-all group"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Shield className="w-3.5 h-3.5 text-neutral-500 group-hover:text-lime-400 transition-colors" /> 
                      Dashboard
                      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    
                    <Link 
                      to="/settings" 
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400 hover:bg-neutral-800 hover:text-white rounded-xl transition-all group"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <Settings className="w-3.5 h-3.5 text-neutral-500 group-hover:text-lime-400 transition-colors" /> 
                      Settings
                      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    
                    <div className="h-px bg-neutral-800/50 my-1" />
                    
                    <button 
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-red-400 hover:bg-red-500/10 rounded-xl transition-all group"
                    >
                      <LogOut className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300 transition-colors" /> 
                      Sign Out
                      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="hidden md:flex items-center text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors px-3 py-1.5">
                  Sign In
                </Link>
                <Link to="/register">
                  <button className="group relative inline-flex items-center gap-2 px-4 py-2 bg-lime-400 text-black rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-lime-300 transition-all duration-300 active:scale-95 overflow-hidden">
                    <span className="relative z-10 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      Get Started
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="lg:hidden relative w-9 h-9 flex items-center justify-center bg-neutral-900/50 border border-neutral-800 rounded-full hover:border-neutral-700 transition-all"
            >
              <div className="absolute inset-0 bg-neutral-800/20 rounded-full blur-sm opacity-0 hover:opacity-100 transition-opacity" />
              {isMenuOpen ? (
                <X className="w-4 h-4 text-white" />
              ) : (
                <Menu className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Panel */}
        {isMenuOpen && (
          <div 
            ref={menuRef}
            className="absolute left-4 right-4 top-[calc(100%+12px)] bg-[#161616] border border-neutral-800 rounded-2xl p-4 shadow-2xl shadow-black/50 lg:hidden animate-slideDown max-h-[80vh] overflow-y-auto"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      active 
                        ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20' 
                        : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-lime-400' : 'text-neutral-500'}`} />
                    <span className="text-[12px] font-medium">{item.label}</span>
                    {active && <CheckCircle className="w-3.5 h-3.5 ml-auto text-lime-400" />}
                  </Link>
                );
              })}
              
              <div className="h-px bg-neutral-800/50 my-2" />
              
              {/* Mobile Quick Links */}
              <Link
                to="/security-assessment"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-lime-400 hover:bg-lime-400/10 transition-all"
              >
                <Activity className="w-4 h-4" />
                <span className="text-[12px] font-medium">Free Security Assessment</span>
              </Link>
              
              <div className="h-px bg-neutral-800/50 my-2" />
              
              {isAuthenticated && user ? (
                <>
                  <Link
                    to={getDashboardPath()}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-300 hover:bg-neutral-800/50 hover:text-white transition-all"
                  >
                    <Shield className="w-4 h-4 text-neutral-500" />
                    <span className="text-[12px] font-medium">Dashboard</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-[12px] font-medium">Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-300 hover:bg-neutral-800/50 hover:text-white transition-all"
                  >
                    <User className="w-4 h-4 text-neutral-500" />
                    <span className="text-[12px] font-medium">Sign In</span>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-lime-400 text-black font-bold rounded-xl text-[12px] hover:bg-lime-300 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    Get Started Now
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}