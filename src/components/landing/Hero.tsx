
import React from 'react';
import DashboardMockup from './DashboardMockup';

interface HeroProps {
  onScrollToDemo: () => void;
  onLogin?: () => void;
  onScrollToPricing: () => void;
}

const Hero: React.FC<HeroProps> = ({ onScrollToDemo, onLogin, onScrollToPricing }) => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-0 -right-20 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-8 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Nueva Versión 3.0 ya disponible
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight tracking-tighter">
          Potencia <span className="landing-gradient-text">Visual</span> <br className="hidden md:block" />
          para tus Finanzas
        </h1>

        <p className="max-w-2xl mx-auto text-slate-400 text-lg md:text-xl mb-12 font-medium leading-relaxed">
          Cada detalle está pensado para darte claridad absoluta. Clasifica, visualiza y proyecta tu futuro financiero en tiempo real.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <button
            onClick={onLogin}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl text-lg font-bold transition-all landing-blue-glow transform hover:scale-105 active:scale-95"
          >
            Empezar Ahora
          </button>
          <button
            onClick={onScrollToDemo}
            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white border border-white/10 px-10 py-4 rounded-2xl text-lg font-bold transition-all hover:border-white/20"
          >
            Ver Demo Interactiva
          </button>
        </div>

        {/* The Mockup Visual */}
        <div id="demo" className="mt-10 scroll-mt-24">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
};

export default Hero;
