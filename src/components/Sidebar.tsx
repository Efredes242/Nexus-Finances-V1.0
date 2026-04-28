import React from 'react';
import { APP_TITLE_PREFIX, APP_TITLE_SUFFIX, APP_SUBTITLE } from '../config/constants';
import { Tooltip } from './Tooltip';
import { getThemeColors } from '../utils/theme';
import { api } from '../services/api';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  desktopSidebarOpen: boolean;
  setDesktopSidebarOpen: (open: boolean) => void;
  activeTab: 'dashboard' | 'presupuesto' | 'tarjetas' | 'metas' | 'config' | 'admin' | 'annual' | 'party';
  setActiveTab: (tab: 'dashboard' | 'presupuesto' | 'tarjetas' | 'metas' | 'config' | 'admin' | 'annual' | 'party') => void;
  user: any;
  netFlow: number;
  projectedNetFlow: number;
  formatMoney: (amount: number) => string;
  onExport: () => void;
  onLogout: () => void;
  pendingInvitesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  desktopSidebarOpen,
  setDesktopSidebarOpen,
  activeTab,
  setActiveTab,
  user,
  netFlow,
  projectedNetFlow,
  formatMoney,
  onExport,
  onLogout,
  pendingInvitesCount: propPendingInvitesCount = 0
}) => {
  const themeColors = getThemeColors();
  const theme = localStorage.getItem('colorTheme') || 'new';
  const [pendingCount, setPendingCount] = React.useState(0);

  // Fetch Admin Pending Count
  React.useEffect(() => {
    const fetchPending = async () => {
      // Check if user is admin or the specific super admin email
      if (user?.role === 'admin' || user?.email === 'ezequiel.fredes.mondragon@gmail.com') {
        try {
          const { count } = await api.getPendingUserCount() as any;
          setPendingCount(count);
        } catch (e) {
          console.error('Failed to fetch pending count', e);
        }
      }
    };

    fetchPending();

    // Optional: Poll every 30 seconds
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Rename prop to avoid conflict/confusion if needed, though pendingInvitesCount is for Party
  const pendingInvitesCount = propPendingInvitesCount;

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 lg:w-full glass 
      lg:relative lg:m-4 lg:mr-0 lg:rounded-[2.5rem] lg:h-[calc(100vh-2rem)]
      flex flex-col p-r-r lg:border border-white/5 shadow-2xl 
      transition-all duration-300 ease-in-out
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      overflow-visible
      ${themeColors.sidebarBg}
    `}>
      {/* Mobile Close Button */}
      <button
        onClick={() => setSidebarOpen(false)}
        className="absolute top-4 right-4 lg:hidden text-slate-400 hover:text-white"
      >
        <i className="fas fa-times text-xl"></i>
      </button>

      {/* Desktop Toggle Button - Centered Right Edge with Glow */}
      <button
        onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
        className="hidden lg:flex absolute top-1/2 -right-3 transform -translate-y-1/2 w-[26px] h-[26px] bg-[#020617]/90 rounded-full border border-[#00D1FF] items-center justify-center text-[#00D1FF] z-50 transition-all duration-300 ease-in-out hover:scale-110 group/toggle"
        style={{
          boxShadow: '0 0 0 0 rgba(0, 209, 255, 0)',
        }}
        title={desktopSidebarOpen ? "Contraer Menú" : "Expandir Menú"}
      >
        <div className="absolute inset-0 rounded-full opacity-0 group-hover/toggle:opacity-100 transition-all duration-300 pointer-events-none"
          style={{
            boxShadow: '0 0 15px 2px rgba(0, 209, 255, 0.7)',
            filter: 'drop-shadow(0 0 5px #00D1FF)'
          }}
        />
        <i className={`fas fa-chevron-left text-[10px] transition-transform duration-300 ${!desktopSidebarOpen ? 'rotate-180' : ''}`}></i>
      </button>

      <div className={`flex flex-row items-center ${desktopSidebarOpen ? 'justify-start px-6' : 'justify-center px-2'} gap-2.5 mb-8 group mt-6 lg:mt-6 w-full transition-all duration-300`}>
        <div
          onClick={() => setActiveTab('dashboard')}
          className={`w-10 h-10 bg-gradient-to-tr ${themeColors.logoGradient} rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-500 shine-hover cursor-pointer shrink-0`}
        >
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/logo-n.png" alt="Logo" className="w-6 h-6 object-contain mix-blend-screen drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          </div>
        </div>
        <div className={`text-left overflow-hidden transition-all duration-300 ${desktopSidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
          <h1 className="text-lg font-outfit font-black tracking-wide leading-none text-white whitespace-nowrap">{APP_TITLE_PREFIX}<span className="text-blue-500">{APP_TITLE_SUFFIX}</span></h1>
          {APP_SUBTITLE && <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase mt-0.5 block whitespace-nowrap">{APP_SUBTITLE}</span>}
        </div>
      </div>

      <nav className="space-y-3 flex-1 overflow-y-auto custom-scrollbar px-3">
        {[
          { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
          { id: 'presupuesto', icon: 'fa-receipt', label: 'Movimientos' },
          { id: 'party', icon: 'fa-users', label: 'Gastos en Grupo' },
          { id: 'tarjetas', icon: 'fa-credit-card', label: 'Cuotas / Tarjetas' },
          { id: 'metas', icon: 'fa-bullseye', label: 'Metas' },
          { id: 'config', icon: 'fa-cog', label: 'Configuración' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as any);
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center ${desktopSidebarOpen ? 'justify-start px-4 gap-4' : 'justify-center px-0 gap-0'} py-3 rounded-2xl transition-all duration-300 relative overflow-hidden group ${activeTab === item.id
              ? themeColors.sidebarActive
              : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            title={!desktopSidebarOpen ? item.label : ''}
          >
            {activeTab === item.id && (
              <div className="absolute inset-0 bg-blue-500/5 blur-xl"></div>
            )}
            <i className={`fas ${item.icon} text-lg w-6 flex justify-center relative z-10 ${activeTab === item.id ? 'text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : ''}`}></i>
            <span className={`font-bold text-sm relative z-10 transition-all duration-300 whitespace-nowrap overflow-hidden ${desktopSidebarOpen ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0 hidden'}`}>{item.label}</span>
            {item.id === 'party' && pendingInvitesCount > 0 && (
              <span className={`absolute ${desktopSidebarOpen ? 'right-4' : 'top-2 right-2'} bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-20 shadow-lg animate-pulse`}>
                {pendingInvitesCount}
              </span>
            )}
          </button>
        ))}
      </nav>



      <div className={`mt-auto transition-all duration-300 ${desktopSidebarOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none h-0'}`}>
        {/* User Profile Info */}
        {desktopSidebarOpen && (
          <div className="flex items-center gap-3 px-6 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center font-bold text-blue-500 shadow-inner shrink-0 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.username?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-white truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : (user?.username || 'Usuario')}
              </p>
              <p className="text-[10px] text-slate-500 truncate" title={user?.email}>{user?.email}</p>
            </div>
          </div>
        )}

        {/* Admin Panel Button - Only for admin */}
        {(user?.email?.toLowerCase().trim() === 'ezequiel.fredes.mondragon@gmail.com' || user?.role === 'admin') && (
          <div className="px-3 mb-3">
            <button
              onClick={() => {
                setActiveTab('admin');
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center ${desktopSidebarOpen ? 'justify-start px-4 gap-4' : 'justify-center px-0 gap-0'} py-3 rounded-2xl transition-all duration-300 relative overflow-hidden group border border-rose-500/20 ${activeTab === 'admin'
                ? 'bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300'
                }`}
              title={!desktopSidebarOpen ? 'Admin Panel' : ''}
            >
              {activeTab === 'admin' && (
                <div className="absolute inset-0 bg-rose-500/10 blur-xl"></div>
              )}
              <i className={`fas fa-users-cog text-lg w-6 flex justify-center relative z-10 ${activeTab === 'admin' ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]' : ''}`}></i>
              <span className={`font-bold text-sm relative z-10 transition-all duration-300 whitespace-nowrap overflow-hidden ${desktopSidebarOpen ? 'opacity-100 max-w-[150px]' : 'opacity-0 max-w-0 hidden'}`}>Admin Panel</span>
              {typeof pendingCount === 'number' && pendingCount > 0 && (
                <span className={`absolute ${desktopSidebarOpen ? 'right-4' : 'top-2 right-2'} bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-20 shadow-lg animate-pulse`}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Footer Links - Only visible when expanded */}
        {desktopSidebarOpen && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-6 mb-2">
            <a href="/privacy" className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">Privacidad</a>
            <a href="/terminos" className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors">Términos</a>
          </div>
        )}

        <div className={`glass p-6 rounded-3xl border border-white/5 relative group mx-4 mb-4 ${themeColors.card}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${theme === 'new' ? 'from-teal-600/10' : 'from-blue-600/10'} to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>
          <span className={`text-[10px] font-black ${themeColors.accent} uppercase tracking-widest block mb-1 relative z-10`}>Balance Mensual</span>
          <p className={`text-xl font-black relative z-10 ${netFlow >= 0 ? 'text-white drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}>
            {formatMoney(netFlow)}
          </p>
          {projectedNetFlow !== netFlow && (
            <div className="relative z-10 mt-2 pt-2 border-t border-white/5 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Proyectado</span>
              </div>
              <p className={`text-sm font-black text-amber-500`}>
                {formatMoney(projectedNetFlow)}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
