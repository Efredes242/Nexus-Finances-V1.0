import React from 'react';
import { getThemeColors } from '../utils/theme';

interface LayoutProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  modals: React.ReactNode;
  children: React.ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  desktopSidebarOpen: boolean;
  setDesktopSidebarOpen: (open: boolean) => void;
  titlePrefix: string;
  titleSuffix: string;
  currentYear: string;
  currentMonthNum: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  sidebar,
  header,
  modals,
  children,
  sidebarOpen,
  setSidebarOpen,
  desktopSidebarOpen,
  setDesktopSidebarOpen,
  titlePrefix,
  titleSuffix,
  currentYear,
  currentMonthNum,
  onYearChange,
  onMonthChange
}) => {
  const themeColors = getThemeColors();
  return (
    <div className={`flex h-screen text-slate-50 font-sans overflow-hidden ${themeColors.background} relative`}>

      {/* --- MODALS --- */}
      {modals}

      {/* --- MOBILE OVERLAY --- */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR SLOT --- */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 relative z-50 w-0 ${desktopSidebarOpen ? 'lg:w-[260px]' : 'lg:w-[80px]'}`}>
        {sidebar}
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className={`flex-1 m-0 lg:my-4 lg:mr-4 lg:ml-10 flex flex-col relative min-h-0 ${themeColors.background}`}>

        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between gap-3 mb-4 px-6 pt-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white border-2 border-blue-400/50 active:scale-95 transition-all duration-300 flex-shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.5)] hover:shadow-[0_0_30px_rgba(59,130,246,0.7)] animate-pulse-subtle group"
            aria-label="Abrir menú"
          >
            <i className="fas fa-bars text-lg group-active:rotate-90 transition-transform duration-300"></i>
            {/* Ripple effect ring */}
            <span className="absolute inset-0 rounded-xl border-2 border-blue-400/30 animate-ping-slow"></span>
          </button>

          {/* Month/Year Selectors */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              className="glass-select-new focus:border-teal-500 rounded-lg px-3 h-10 font-bold text-xs outline-none cursor-pointer bg-white/5 border border-white/10 text-white flex-1"
              value={currentYear}
              onChange={(e) => onYearChange(e.target.value)}
            >
              {['2024', '2025', '2026', '2027', '2028'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              className="glass-select-new focus:border-teal-500 rounded-lg px-3 h-10 font-bold text-xs outline-none cursor-pointer bg-white/5 border border-white/10 text-white flex-1"
              value={currentMonthNum}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              <option value="annual" className="text-yellow-400 font-bold">★ ANUAL</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={(i + 1).toString().padStart(2, '0')}>
                  {new Date(2000, i).toLocaleString('es-ES', { month: 'short' }).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Header Superior con Selectores SLOT */}
        {header}

        {/* --- SCROLL AREA --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-0 lg:pr-4 pb-0 min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};
