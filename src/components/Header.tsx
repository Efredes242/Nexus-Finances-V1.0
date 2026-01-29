import React from 'react';

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
  user
}) => {
  return (
    <header className="min-h-[6rem] h-auto glass rounded-[1.5rem] lg:rounded-[2.5rem] mb-4 flex flex-col lg:flex-row items-center justify-between p-4 lg:px-10 border border-white/5 shadow-xl gap-4 lg:gap-0">
      <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-8 w-full lg:w-auto">
        <div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 lg:gap-0 w-full lg:w-auto justify-between lg:justify-start">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0 lg:mb-1">Año Fiscal</span>
          <select 
            className="glass-select rounded-xl px-5 py-2 font-black text-sm outline-none cursor-pointer hover:border-blue-500/50 transition-colors w-32"
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
            className="glass-select rounded-xl px-5 py-2 font-black text-white text-sm outline-none cursor-pointer hover:border-blue-500/50 transition-colors w-full lg:w-48"
            value={currentMonthNum}
            onChange={(e) => onMonthChange(e.target.value)}
          >
            <option value="annual" className="text-yellow-400 font-bold">★ VISTA ANUAL</option>
            {Array.from({length: 12}).map((_, i) => (
              <option key={i} value={(i + 1).toString().padStart(2, '0')}>
                {new Date(2000, i).toLocaleString('es-ES', { month: 'long' }).toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 w-full lg:w-auto border-t lg:border-t-0 border-white/5 pt-4 lg:pt-0">
        <div className="text-center lg:text-right w-full lg:w-auto flex flex-row lg:flex-col justify-between lg:justify-center items-center">
          <div className="flex items-center justify-end gap-2 mb-0 lg:mb-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos Mes</span>
            <button 
              onClick={() => setPrivacyMode(!privacyMode)}
              className="text-slate-500 hover:text-blue-500 transition-colors"
              title={privacyMode ? "Mostrar valores" : "Ocultar valores"}
            >
              <i className={`fas ${privacyMode ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
            </button>
          </div>
          <p className="text-xl font-black text-emerald-400">
            {formatMoney(totalIncome)}
          </p>
        </div>
        <div className="hidden lg:flex w-12 h-12 rounded-2xl bg-slate-800 border border-white/5 items-center justify-center font-black text-blue-500 shadow-inner" title={user.username}>
          {user.username[0].toUpperCase()}
        </div>
      </div>
    </header>
  );
};
