
import React from 'react';
import { Check } from 'lucide-react';
import { PRICING } from './constants';

const Pricing: React.FC = () => {
  const handleSelectPlan = (planName: string) => {
    alert(`Has seleccionado el plan ${planName}. Serás redirigido a la pasarela de pago segura.`);
  };

  return (
    <section id="pricing" className="py-24 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Planes para todos</h2>
          <p className="text-slate-400 text-lg font-medium">Escala tu control financiero a medida que crecen tus metas.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative landing-glass rounded-[2.5rem] p-10 flex flex-col border transition-all hover:scale-[1.02] ${plan.recommended ? 'border-blue-500/50 bg-blue-600/5 shadow-2xl shadow-blue-900/10' : 'border-white/5'}`}
            >
              {plan.recommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-full shadow-lg shadow-blue-500/40">
                  Recomendado
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-slate-500 text-sm font-semibold">/mes</span>
                </div>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feat) => (
                  <div key={feat} className="flex items-center gap-3 text-slate-300">
                    <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="text-sm font-medium">{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelectPlan(plan.name)}
                className={`w-full py-4 rounded-2xl font-extrabold transition-all transform active:scale-95 ${plan.recommended ? 'bg-blue-600 text-white landing-blue-glow hover:bg-blue-500' : 'bg-white/5 text-white hover:bg-white/10 hover:border-white/20 border border-white/5'}`}
              >
                Seleccionar Plan
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
