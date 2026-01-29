
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import PrivacyPage from './components/PrivacyPage';
import TermsPage from './components/TermsPage';

export type View = 'home' | 'privacy' | 'terms';

function App() {
  const [view, setView] = useState<View>('home');

  // Handle smooth scroll to elements by ID
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavigate = (newView: View, sectionId?: string) => {
    if (newView === 'home') {
      setView('home');
      if (sectionId) {
        // Wait for state update and render if we were on a different view
        setTimeout(() => scrollToSection(sectionId), 100);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      setView(newView);
      window.scrollTo(0, 0);
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'privacy':
        return <PrivacyPage />;
      case 'terms':
        return <TermsPage />;
      default:
        return (
          <>
            <Hero onScrollToDemo={() => scrollToSection('demo')} onScrollToPricing={() => scrollToSection('pricing')} />
            
            {/* Statistics section for social proof */}
            <section className="py-20 border-y border-white/5 bg-slate-900/20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { label: 'Usuarios Activos', value: '500k+' },
                    { label: 'Transacciones', value: '$2B+' },
                    { label: 'Países', value: '45+' },
                    { label: 'Rating App Store', value: '4.9/5' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center group cursor-default">
                      <p className="text-3xl md:text-4xl font-extrabold text-white mb-2 group-hover:text-blue-400 transition-colors">{stat.value}</p>
                      <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <Features />
            
            {/* Interactive CTA Section */}
            <section className="py-24 relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-600/5"></div>
              <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
                <div className="glass p-12 md:p-20 rounded-[3rem] border border-blue-500/20 shadow-2xl shadow-blue-900/20">
                  <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">
                    ¿Listo para dominar <br /> tu futuro financiero?
                  </h2>
                  <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto font-medium">
                    Únete a miles de personas que ya están transformando su relación con el dinero gracias a Nexus Finance.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button 
                      onClick={() => scrollToSection('pricing')}
                      className="bg-blue-600 text-white px-10 py-5 rounded-2xl text-lg font-bold transition-all blue-glow hover:scale-105 active:scale-95"
                    >
                      Prueba Gratis por 14 días
                    </button>
                  </div>
                  <p className="mt-6 text-slate-500 text-xs font-semibold tracking-wide">Sin tarjeta de crédito requerida.</p>
                </div>
              </div>
            </section>

            <Pricing />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen text-slate-200 selection:bg-blue-500/30 overflow-x-hidden">
      <Navbar onNavigate={handleNavigate} />
      
      <main>
        {renderContent()}
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

export default App;
