import React from 'react';
import { AppUpdate } from '../config/updates';
import { getThemeColors } from '../utils/theme';

interface UpdateDetailModalProps {
  update: AppUpdate | null;
  onClose: () => void;
}

export const UpdateDetailModal: React.FC<UpdateDetailModalProps> = ({ update, onClose }) => {
  const themeColors = getThemeColors();
  const theme = localStorage.getItem('colorTheme') || 'new';

  if (!update) return null;

  // Simple Markdown-like parser for the APB content
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.trim().startsWith('###')) {
        return <h3 key={i} className="text-xl font-black text-white mt-6 mb-3 flex items-center gap-2">
          {line.replace('###', '').trim()}
        </h3>;
      }
      if (line.trim().startsWith('**')) {
        const parts = line.split('**');
        return <p key={i} className="mb-2 text-sm leading-relaxed">
          {parts.map((part, j) => j % 2 === 1 ? <span key={j} className="font-black text-blue-400">{part}</span> : part)}
        </p>;
      }
      if (line.trim().startsWith('-')) {
        return <div key={i} className="flex gap-2 mb-2 ml-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
          <p className="text-sm text-slate-300">{line.replace('-', '').trim()}</p>
        </div>;
      }
      if (line.trim() === '') return <div key={i} className="h-2"></div>;
      return <p key={i} className="text-sm text-slate-300 leading-relaxed mb-2">{line}</p>;
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] bg-[#030712] rounded-[2.5rem] border border-white/10 shadow-[0_0_100px_rgba(59,130,246,0.15)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Background Glow */}
        <div className={`absolute top-0 left-0 right-0 h-48 bg-gradient-to-b ${
          update.category === 'Seguridad' ? 'from-rose-500/10' :
          update.category === 'Mejora' ? 'from-blue-500/10' :
          'from-emerald-500/10'
        } to-transparent pointer-events-none`}></div>

        <div className="relative p-6 sm:p-12 flex-1 flex flex-col min-h-0">
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 active:scale-95 z-10"
          >
            <i className="fas fa-times"></i>
          </button>

          {/* Badge & Date */}
          <div className="flex items-center gap-4 mb-4 sm:mb-6">
            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
              update.category === 'Seguridad' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' :
              update.category === 'Mejora' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
            }`}>
              {update.category}
            </span>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500 tracking-wider font-mono">{update.date}</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 sm:mb-6 leading-tight tracking-tight">
            {update.title}
          </h2>

          {/* Content Area - Scrollable */}
          <div className="overflow-y-auto custom-scrollbar pr-2 sm:pr-4 -mr-2 sm:-mr-4 flex-1">
            <div className="prose prose-invert max-w-none pb-4">
              {renderContent(update.longDescription)}
            </div>
          </div>

          {/* Footer / CTA - Fixed at bottom of modal content area */}
          <div className="mt-4 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/10 shadow-inner">
                <img src="/logo-n.png" alt="Nexus" className="w-6 h-6 opacity-80" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Nexus Finance</p>
                <p className="text-sm font-bold text-white leading-none">{update.id}</p>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black text-sm px-10 py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/25 active:scale-95"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
