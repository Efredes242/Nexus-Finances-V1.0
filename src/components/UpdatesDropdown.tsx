import React, { useState, useEffect, useRef } from 'react';
import { APP_UPDATES, AppUpdate } from '../config/updates';
import { getThemeColors } from '../utils/theme';

interface UpdatesDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: () => void;
  onSelectUpdate: (update: AppUpdate) => void;
}

export const UpdatesDropdown: React.FC<UpdatesDropdownProps> = ({ 
  isOpen, 
  onClose, 
  onMarkAsRead,
  onSelectUpdate 
}) => {
  const themeColors = getThemeColors();
  const theme = localStorage.getItem('colorTheme') || 'new';
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Mark as read when opened
      onMarkAsRead();
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, onMarkAsRead]);

  if (!isOpen) return null;

  return (
    <div 
      ref={dropdownRef}
      className={`
        fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-4 
        w-auto sm:w-96 glass rounded-[2rem] sm:rounded-3xl border border-white/10 
        shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 overflow-hidden 
        ${themeColors.card}
      `}
    >
      <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400`}>
            <i className="fas fa-bullhorn text-sm"></i>
          </div>
          <h3 className="font-black text-sm tracking-tight text-white">Novedades y Actualizaciones</h3>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <i className="fas fa-times text-xs"></i>
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-4 space-y-4">
        {APP_UPDATES.map((update, index) => (
          <div 
            key={update.id}
            onClick={() => onSelectUpdate(update)}
            className={`p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all group relative overflow-hidden cursor-pointer`}
          >
            {/* Category Badge */}
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                update.category === 'Seguridad' ? 'bg-rose-500/10 text-rose-400' :
                update.category === 'Mejora' ? 'bg-blue-500/10 text-blue-400' :
                update.category === 'Bugfix' ? 'bg-amber-500/10 text-amber-400' :
                'bg-emerald-500/10 text-emerald-400'
              }`}>
                {update.category}
              </span>
              <span className="text-[10px] font-bold text-slate-500">{update.date}</span>
            </div>

            <h4 className="font-bold text-sm text-white mb-1 group-hover:text-blue-400 transition-colors">
              {update.title}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              {update.description}
            </p>

            {/* Shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </div>
        ))}

        {APP_UPDATES.length === 0 && (
          <div className="py-8 text-center text-slate-500 italic text-sm">
            No hay actualizaciones recientes.
          </div>
        )}
      </div>

      <div className="p-4 bg-white/5 text-center">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Nexus Finance v1.1.1</p>
      </div>
    </div>
  );
};
