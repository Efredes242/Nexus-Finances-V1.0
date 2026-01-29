
import React from 'react';
import Logo from './Logo';
import { View } from '../App';

interface NavbarProps {
  onNavigate: (view: View, sectionId?: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 h-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
        >
          <Logo className="w-10 h-10" />
          <span className="text-white font-extrabold text-xl tracking-tight hidden sm:block">
            NEXUS<span className="text-blue-500">FINANCE</span>
          </span>
        </button>
        
        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => onNavigate('home')} 
            className="text-slate-400 hover:text-white transition-colors text-sm font-semibold tracking-wide"
          >
            Inicio
          </button>
          <button 
            onClick={() => onNavigate('home', 'features')} 
            className="text-slate-400 hover:text-white transition-colors text-sm font-semibold tracking-wide"
          >
            Características
          </button>
          <button 
            onClick={() => onNavigate('home', 'pricing')} 
            className="text-slate-400 hover:text-white transition-colors text-sm font-semibold tracking-wide"
          >
            Precios
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-slate-300 hover:text-white text-sm font-bold transition-colors px-4 py-2 hidden sm:block">
            ACCESO ADMIN
          </button>
          <button 
            onClick={() => onNavigate('home', 'pricing')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all blue-glow"
          >
            Empezar Gratis
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
