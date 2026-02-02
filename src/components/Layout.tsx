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
  titleSuffix
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
      <main className={`flex-1 m-0 lg:my-4 lg:mr-4 lg:ml-10 flex flex-col overflow-hidden relative min-h-0 ${themeColors.background}`}>

        {/* Mobile Header Bar */}
        <div className="lg:hidden flex items-center justify-between mb-4 px-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10 active:scale-95 transition-transform"
          >
            <i className="fas fa-bars"></i>
          </button>
          <span className="font-black text-sm tracking-widest text-slate-400">{titlePrefix} {titleSuffix}</span>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        {/* Header Superior con Selectores SLOT */}
        {header}

        {/* --- SCROLL AREA --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-0 lg:pr-4 pb-0 min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};
