
import React from 'react';
import { FEATURES } from '../constants';

const Features: React.FC = () => {
  return (
    <section id="features" className="py-24 bg-slate-950/50 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">Todo lo que necesitas</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
            Hemos construido las herramientas más potentes para que tengas el control total, sin complicaciones.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {FEATURES.map((feature) => (
            <div 
              key={feature.id} 
              className="glass p-8 rounded-[2.5rem] border border-white/5 hover:border-blue-500/30 transition-all hover:-translate-y-2 duration-300 group cursor-default"
            >
              <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600/20 transition-colors ring-1 ring-white/5 group-hover:ring-blue-500/20">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
