import { Link } from 'react-router-dom';
import { Activity, Menu } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="glass sticky top-0 z-50 border-b border-slate-100/50">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className="flex justify-between items-center h-24">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-brand-500/10 p-2 rounded-lg group-hover:bg-brand-500/20 transition-colors">
                <Activity className="w-6 h-6 text-brand-600" />
              </div>
              <span className="font-display font-semibold text-xl text-slate-900 tracking-tight">
                Pulse<span className="text-brand-600">Engine</span>
              </span>
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button className="text-slate-600 hover:text-slate-900 p-2">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
