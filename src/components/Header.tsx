import React, { useState, useEffect, useRef } from 'react';
import { getThemeColors } from '../utils/theme';
import { UpdatesDropdown } from './UpdatesDropdown';
import { UpdateDetailModal } from './UpdateDetailModal';
import { APP_UPDATES, AppUpdate } from '../config/updates';

interface HeaderProps {
  currentYear: string;
  currentMonthNum: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
  privacyMode: boolean;
  setPrivacyMode: (mode: boolean) => void;
  totalIncome: number;
  formatMoney: (amount: number) => string;
  user: any;
  onSelectUpdate: (update: AppUpdate) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentYear,
  currentMonthNum,
  onYearChange,
  onMonthChange,
  privacyMode,
  setPrivacyMode,
  totalIncome,
  formatMoney,
  user,
  onSelectUpdate
}) => {
  const themeColors = getThemeColors();
  const theme = localStorage.getItem('colorTheme') || 'new';

  const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);

  // Check for unread updates
  useEffect(() => {
    const lastSeenId = localStorage.getItem('lastSeenUpdateId');
    const latestId = APP_UPDATES.length > 0 ? APP_UPDATES[0].id : null;
    
    if (latestId && lastSeenId !== latestId) {
      setHasUnreadUpdates(true);
    }
  }, []);

  const handleMarkAsRead = () => {
    if (APP_UPDATES.length > 0) {
      localStorage.setItem('lastSeenUpdateId', APP_UPDATES[0].id);
      setHasUnreadUpdates(false);
    }
  };

  // Auto-hide header on mobile
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Find the scroll container (the main content area)
    const scrollContainer = document.querySelector('.custom-scrollbar') as HTMLElement;
    scrollContainerRef.current = scrollContainer;

    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScrollY = scrollContainer.scrollTop;

      // Only apply auto-hide on mobile (< 1024px)
      if (window.innerWidth >= 1024) {
        setIsHeaderVisible(true);
        return;
      }

      // Show header when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsHeaderVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    // Touch gesture detection for pull-down to show header
    let touchStartY = 0;
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndY = e.touches[0].clientY;

      // If at top of scroll and pulling down, show header
      if (scrollContainer.scrollTop === 0 && touchEndY > touchStartY + 50) {
        if (window.innerWidth < 1024) {
          setIsHeaderVisible(true);
        }
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
    };
  }, [lastScrollY]);

  // Auto-hide when year or month changes (mobile only)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsHeaderVisible(false);
      // Show briefly then hide
      const timer = setTimeout(() => setIsHeaderVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [currentYear, currentMonthNum]);

  return (
    <header className={`z-40 glass rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col items-center justify-between border border-white/5 shadow-xl relative transition-all duration-300 ease-in-out ${isHeaderVisible
      ? 'max-h-96 mb-4 opacity-100 p-4 lg:px-10'
      : 'max-h-0 mb-0 opacity-0 p-0 border-0 lg:max-h-96 lg:mb-4 lg:opacity-100 lg:p-4 lg:px-10 lg:border lg:border-white/5'
      }`}>

      <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0">

        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 w-full lg:w-auto">
          <div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 lg:gap-0 w-full lg:w-auto justify-between lg:justify-start">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0 lg:mb-1">Año Fiscal</span>
            <select
              className={`${theme === 'new' ? 'glass-select-new focus:border-teal-500' : 'glass-select focus:border-blue-500'} rounded-xl px-5 py-2 font-black text-sm outline-none cursor-pointer hover:border-white/20 transition-colors w-32 ${themeColors.card}`}
              value={currentYear}
              onChange={(e) => onYearChange(e.target.value)}
            >
              {['2024', '2025', '2026', '2027', '2028'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="hidden lg:block h-10 w-px bg-white/10"></div>

          <div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 lg:gap-0 w-full lg:w-auto justify-between lg:justify-start">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0 lg:mb-1">Periodo</span>
            <select
              className={`${theme === 'new' ? 'glass-select-new focus:border-teal-500' : 'glass-select focus:border-blue-500'} rounded-xl px-5 py-2 font-black text-white text-sm outline-none cursor-pointer hover:border-white/20 transition-colors w-full lg:w-48 ${themeColors.card}`}
              value={currentMonthNum}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              <option value="annual" className="text-yellow-400 font-bold">★ VISTA ANUAL</option>
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={(i + 1).toString().padStart(2, '0')}>
                  {new Date(2000, i).toLocaleString('es-ES', { month: 'long' }).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 w-full lg:w-auto border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
          
          {/* Notifications / Updates Bell */}
          <div className="relative">
            <button
              onClick={() => setIsUpdatesOpen(!isUpdatesOpen)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 relative group overflow-hidden border border-white/5 hover:border-white/20 bg-white/5 hover:bg-white/10`}
              title="Novedades y Actualizaciones"
            >
              <i className={`fas fa-bell text-lg transition-all duration-300 ${hasUnreadUpdates ? 'text-blue-400 group-hover:scale-110' : 'text-slate-400 group-hover:text-white'}`}></i>
              {hasUnreadUpdates && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#030712] animate-pulse"></span>
              )}
              
              {/* Subtle Blue Glow when unread */}
              {hasUnreadUpdates && (
                <div className="absolute inset-0 bg-blue-500/5 blur-xl pointer-events-none"></div>
              )}
            </button>
            <UpdatesDropdown 
              isOpen={isUpdatesOpen}
              onClose={() => setIsUpdatesOpen(false)}
              onMarkAsRead={handleMarkAsRead}
              onSelectUpdate={(update) => {
                setIsUpdatesOpen(false);
                onSelectUpdate(update);
              }}
            />
          </div>

          <div className="text-center lg:text-right w-full lg:w-auto flex flex-row lg:flex-col justify-between lg:justify-center items-center">
            <div className="flex items-center justify-end gap-2 mb-0 lg:mb-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos Mes</span>
              <button
                onClick={() => setPrivacyMode(!privacyMode)}
                className={`text-slate-500 hover:${themeColors.accent} transition-colors`}
                title={privacyMode ? "Mostrar valores" : "Ocultar valores"}
              >
                <i className={`fas ${privacyMode ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
              </button>
            </div>
            <p className={`text-xl font-black ${themeColors.amountText}`}>
              {formatMoney(totalIncome)}
            </p>
          </div>
          <div className="hidden lg:flex w-12 h-12 rounded-2xl bg-slate-800 border border-white/5 items-center justify-center font-black text-blue-500 shadow-inner overflow-hidden" title={user.username}>
            {user.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user.username[0].toUpperCase()
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
