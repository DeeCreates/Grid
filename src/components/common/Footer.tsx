// src/components/common/Footer.tsx
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ChevronRight, Activity } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0A0A0A] border-t border-neutral-800/60 text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand Section with Logo */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4 group">
              <div className="relative">
                <img 
                  src="/favicon.svg" 
                  alt="GRID Security Logo" 
                  className="w-10 h-10 rounded-xl shadow-lg shadow-lime-400/20 group-hover:shadow-lime-400/30 transition-all duration-300"
                />
                <div className="absolute -inset-1 bg-lime-400/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white group-hover:text-lime-400 transition-colors">GRID Security</span>
            </Link>
            <p className="text-neutral-400 text-xs leading-relaxed max-w-xs">
              Security-as-a-Service platform for modern businesses in Ghana. 
              <span className="block mt-2 text-[10px] uppercase tracking-widest text-lime-400/60">
                // Enterprise Grade Protection
              </span>
            </p>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-lime-400 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {['Services', 'Solutions', 'Industries', 'About Us', 'Marketplace'].map((item) => (
                <li key={item}>
                  <Link 
                    to={`/${item.toLowerCase().replace(' ', '-')}`} 
                    className="text-neutral-400 hover:text-white text-xs transition-colors flex items-center group"
                  >
                    <ChevronRight className="w-3 h-3 mr-1.5 text-lime-400/0 group-hover:text-lime-400 transition-all group-hover:translate-x-0.5" />
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Support */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-lime-400 mb-4">
              Support
            </h3>
            <ul className="space-y-2.5">
              {['Contact Us', 'Resources', 'Security Assessment', 'Get Quote', 'FAQ'].map((item) => (
                <li key={item}>
                  <Link 
                    to={`/${item.toLowerCase().replace(' ', '-')}`} 
                    className="text-neutral-400 hover:text-white text-xs transition-colors flex items-center group"
                  >
                    <ChevronRight className="w-3 h-3 mr-1.5 text-lime-400/0 group-hover:text-lime-400 transition-all group-hover:translate-x-0.5" />
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Contact Info */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-lime-400 mb-4">
              Contact
            </h3>
            <ul className="space-y-3.5">
              <li className="flex items-start gap-3 text-neutral-400 hover:text-white transition-colors group">
                <Phone className="w-4 h-4 text-lime-400/60 group-hover:text-lime-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs">+233 (0) 30 2 123 456</span>
              </li>
              <li className="flex items-start gap-3 text-neutral-400 hover:text-white transition-colors group">
                <Mail className="w-4 h-4 text-lime-400/60 group-hover:text-lime-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs">info@gridsecurity.com</span>
              </li>
              <li className="flex items-start gap-3 text-neutral-400 hover:text-white transition-colors group">
                <Mail className="w-4 h-4 text-lime-400/60 group-hover:text-lime-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs">support@gridsecurity.com</span>
              </li>
              <li className="flex items-start gap-3 text-neutral-500">
                <MapPin className="w-4 h-4 text-lime-400/40 flex-shrink-0 mt-0.5" />
                <span className="text-xs">Accra, Ghana</span>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Section */}
        <div className="border-t border-neutral-800/60 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[10px] text-neutral-500 uppercase tracking-widest">
            &copy; {currentYear} GRID Security. All rights reserved.
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-neutral-600">
              <Activity className="w-3 h-3 text-lime-400/60 animate-pulse" />
              <span>System Active</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400/60 animate-pulse"></span>
              <span>24/7 Monitoring</span>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Link to="/privacy" className="text-[9px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="text-[9px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors">
              Terms
            </Link>
            <Link to="/cookies" className="text-[9px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}