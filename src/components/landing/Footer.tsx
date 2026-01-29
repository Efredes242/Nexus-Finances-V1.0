
import React from 'react';
import Logo from './Logo';
import { View } from './types';

interface FooterProps {
  onNavigate: (view: View, sectionId?: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-white/5 py-16 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-2 md:col-span-1">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 mb-6 hover:opacity-80 transition-opacity focus:outline-none"
            >
              <Logo className="w-8 h-8" />
              <span className="text-white font-extrabold text-lg tracking-tight">NEXUS<span className="text-blue-500">FINANCE</span></span>
            </button>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              La plataforma definitiva para el control de tus finanzas personales y empresariales con visualización inteligente.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Producto</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#features" onClick={(e) => { e.preventDefault(); onNavigate('home', 'features'); }} className="hover:text-blue-400 transition-colors font-medium">Características</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="hover:text-blue-400 transition-colors font-medium">Seguridad</a></li>

            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Compañía</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="hover:text-blue-400 transition-colors font-medium">Sobre nosotros</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); onNavigate('home'); }} className="hover:text-blue-400 transition-colors font-medium">Blog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-slate-400 text-sm font-medium">
              <li><a href="/privacy" className="hover:text-blue-400 transition-colors">Privacidad</a></li>
              <li><a href="/terminos" className="hover:text-blue-400 transition-colors">Términos</a></li>
              <li><button className="hover:text-blue-400 transition-colors text-left">Cookies</button></li>
            </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-slate-500 text-xs font-medium tracking-wide">
            © 2024 Nexus Finance. Todos los derechos reservados.
          </p>
          <div className="flex gap-4">
            {['X', 'IG', 'IN'].map((social) => (
              <div
                key={social}
                className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer flex items-center justify-center text-xs font-bold text-slate-400 hover:text-blue-400"
              >
                {social}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
