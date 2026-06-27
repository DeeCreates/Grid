import { Link } from 'react-router-dom';
import { Navbar } from '@/components/common/Navbar';
import {
  ShieldCheck,
  Camera,
  Eye,
  Fingerprint,
  Activity,
  Clock,
  ArrowRight,
  Play,
  Shield,
  Building2,
  Home,
  Warehouse,
  Bell,
  Lock,
  ChevronRight,
} from 'lucide-react';

// Import the image
import surveillanceImage from '@/assets/Surveillance-2.jpg';

export function Hero() {
  const stats = [
    { value: '24/7', label: 'Monitoring', icon: Eye },
    { value: '500+', label: 'Sites Protected', icon: Shield },
    { value: '99.9%', label: 'Uptime', icon: Activity },
    { value: '<5min', label: 'Response Time', icon: Clock },
  ];

  const features = [
    { icon: Camera, label: 'HD CCTV' },
    { icon: Eye, label: 'Live Monitoring' },
    { icon: Fingerprint, label: 'Access Control' },
    { icon: Bell, label: 'Alarm Systems' },
    { icon: Lock, label: 'Intrusion Detection' },
  ];

  const industries = [
    { icon: Building2, label: 'Offices' },
    { icon: Warehouse, label: 'Warehouses' },
    { icon: Home, label: 'Homes' },
    { icon: Shield, label: 'Infrastructure' },
  ];

  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <Navbar />

      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={surveillanceImage}
          alt="Security surveillance backdrop"
          className="w-full h-full object-cover"
        />
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/40" />
        
        {/* Lime Accent Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lime-500/10 rounded-full blur-[100px]" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-20 min-h-screen flex items-center">
        <div className="w-full">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-lime-500/30 bg-lime-500/10 backdrop-blur-sm mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs text-lime-400 font-medium tracking-wide">24/7 Active Protection</span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1]">
              Security you can
              <span className="block text-lime-400">
                count on.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-lg">
              Professional surveillance, access control, and monitoring 
              for businesses, homes, and critical facilities.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-4 mt-8">
              <Link to="/contact">
                <button className="group px-8 py-3.5 rounded-full bg-lime-400 text-black font-medium hover:bg-lime-300 transition flex items-center gap-2 shadow-lg shadow-lime-500/20">
                  Get Started
                  <ChevronRight size={18} className="group-hover:translate-x-0.5 transition" />
                </button>
              </Link>
              <Link to="/services">
                <button className="px-8 py-3.5 rounded-full border border-white/20 hover:bg-white/10 transition text-white/80 backdrop-blur-sm">
                  <Play size={16} className="inline mr-2 fill-white/80" />
                  See Solutions
                </button>
              </Link>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-2 mt-10">
              {features.map((item, i) => {
                const Icon = item.icon;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm text-white/70"
                  >
                    <Icon size={14} className="text-lime-400" />
                    {item.label}
                  </span>
                );
              })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/10">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={16} className="text-lime-400" />
                      <span className="text-2xl font-semibold tracking-tight">{stat.value}</span>
                    </div>
                    <span className="text-xs text-white/50 uppercase tracking-wider">
                      {stat.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Industries */}
          <div className="mt-16 pt-8 border-t border-white/10 max-w-4xl">
            <p className="text-center text-xs text-white/40 uppercase tracking-[0.2em] mb-6">
              Security solutions for
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {industries.map((item, i) => {
                const Icon = item.icon;
                return (
                  <span
                    key={i}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-sm text-white/60"
                  >
                    <Icon size={14} className="text-lime-400" />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}