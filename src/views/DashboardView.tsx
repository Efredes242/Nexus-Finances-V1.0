import React, { useState, useMemo } from 'react';
import { getThemeColors } from '../utils/theme';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Sector
} from 'recharts';
import { Card } from '../components/Card';
import { Tooltip as InfoTooltip } from '../components/Tooltip';
import { CategoryType, BudgetEntry, TransactionStatus } from '../types';
import { categoryConfig } from '../config/constants';

interface DashboardViewProps {
  user: any;
  trendData: any[];
  currentTotals: Record<CategoryType, number>;
  netFlow: number;
  projectedNetFlow: number;
  totalGoalsSaved: number;
  formatMoney: (amount: number) => string;
  currentBudgetEntries: BudgetEntry[];
  categoryBudgets: Record<CategoryType, number>;
}

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill="#fff" className="text-xl font-black">
        {payload.name.replace('Gastos ', '')}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#fff" className="text-sm font-bold">{`$${value.toLocaleString()}`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#94a3b8" className="text-xs">
        {`(${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  trendData,
  currentTotals,
  netFlow,
  projectedNetFlow,
  totalGoalsSaved,
  formatMoney,
  currentBudgetEntries,
  categoryBudgets,
}) => {
  const theme = localStorage.getItem('colorTheme') || 'new';
  const themeColors = getThemeColors();
  const primaryHex = theme === 'new' ? '#2dd4bf' : '#3b82f6'; // Teal-400 vs Blue-500

  const [activeIndex, setActiveIndex] = useState(0);
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const currentHour = new Date().getHours();
  let greeting = 'Buenos días';
  if (currentHour >= 12 && currentHour < 19) greeting = 'Buenas tardes';
  if (currentHour >= 19) greeting = 'Buenas noches';

  // Próximos vencimientos: items pendientes con fecha dentro de los próximos 7 días.
  // Excluye Ingresos (no se "vencen") y entries de agregación virtual.
  const upcomingDue = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 7);

    return currentBudgetEntries
      .filter(e => {
        if (e.category === CategoryType.INCOME) return false;
        if (e.status === TransactionStatus.PAID) return false;
        if (e.id.startsWith('card-agg-') || e.id.startsWith('shared-')) return false;
        if (!e.date) return false;
        const d = new Date(e.date.split('T')[0]);
        return d >= now && d <= horizon;
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 4);
  }, [currentBudgetEntries]);

  // Top categoría del mes (mayor gasto, excluyendo Ingresos) y su % vs presupuesto.
  const topCategory = useMemo(() => {
    const candidates = Object.values(CategoryType)
      .filter(cat => cat !== CategoryType.INCOME)
      .map(cat => ({
        category: cat,
        total: currentTotals[cat] || 0,
        budget: categoryBudgets?.[cat] || 0,
      }))
      .sort((a, b) => b.total - a.total);
    const top = candidates[0];
    if (!top || top.total === 0) return null;
    const pct = top.budget > 0 ? Math.round((top.total / top.budget) * 100) : null;
    return { ...top, pct };
  }, [currentTotals, categoryBudgets]);

  const formatRelativeDate = (dateStr: string): string => {
    const d = new Date(dateStr.split('T')[0]);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays < 7) return `En ${diffDays} días`;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* 0. Header Strip + 2 widgets accionables (3 columnas en desktop, apilados en mobile) */}

      {/* Saludo compacto (1 columna en desktop) */}
      <div className={`bg-gradient-to-br ${theme === 'new' ? 'from-teal-900/40 to-emerald-900/40' : 'from-blue-900/40 to-indigo-900/40'} border border-white/5 rounded-3xl p-5 relative overflow-hidden group flex items-center gap-4`}>
        <div className={`absolute inset-0 ${theme === 'new' ? 'bg-teal-500/5' : 'bg-blue-500/5'} blur-3xl`}></div>
        <div className={`relative z-10 w-14 h-14 rounded-full bg-gradient-to-br ${themeColors.logoGradient} flex items-center justify-center text-white text-xl shadow-lg shrink-0`}>
          {user.avatar ? (
            <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="User" />
          ) : (
            <span className="font-black">{user.firstName ? user.firstName[0] : user.username[0].toUpperCase()}</span>
          )}
        </div>
        <div className="relative z-10 min-w-0">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{greeting}</p>
          <h2 className={`text-xl font-black text-white tracking-tight truncate`}>
            {user.firstName || user.username}
          </h2>
        </div>
      </div>

      {/* Widget 1: Próximos vencimientos */}
      <Card variant="glass" className="!p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <i className="fas fa-calendar-day text-sm"></i>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimientos esta semana</span>
        </div>
        {upcomingDue.length === 0 ? (
          <div className="text-center py-4">
            <i className="fas fa-check-circle text-emerald-400/40 text-2xl mb-2"></i>
            <p className="text-[11px] text-slate-500 font-bold">Nada pendiente esta semana</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingDue.map(e => {
              const cfg = categoryConfig[e.category as CategoryType];
              return (
                <div key={e.id} className="flex items-center gap-2 text-[12px]">
                  <i className={`fas ${cfg?.icon || 'fa-circle'} ${cfg?.color || 'text-slate-400'} text-[10px] w-4 text-center`}></i>
                  <span className="font-bold text-white truncate flex-1">{e.name}</span>
                  <span className="font-mono text-slate-300 whitespace-nowrap">{formatMoney(e.amount)}</span>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider whitespace-nowrap">
                    {formatRelativeDate(e.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Widget 2: Top categoría del mes + presupuesto */}
      <Card variant="glass" className="!p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/20 flex items-center justify-center">
            <i className="fas fa-fire text-sm"></i>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Más gasto del mes</span>
        </div>
        {!topCategory ? (
          <div className="text-center py-4">
            <p className="text-[11px] text-slate-500 font-bold">Aún no hay gastos registrados</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-black text-white truncate mb-1">{topCategory.category}</p>
            <p className="text-2xl font-black text-rose-400 tracking-tight">{formatMoney(topCategory.total)}</p>
            {topCategory.pct !== null && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Presupuesto</span>
                  <span className={`text-[10px] font-black ${topCategory.pct > 100 ? 'text-rose-400' : topCategory.pct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {topCategory.pct}%
                  </span>
                </div>
                <div className="w-full bg-slate-800/50 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${topCategory.pct > 100 ? 'bg-rose-500' : topCategory.pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(topCategory.pct, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
            {topCategory.pct === null && (
              <p className="text-[10px] text-slate-500 italic mt-2">Sin presupuesto definido</p>
            )}
          </>
        )}
      </Card>

      {/* 1. Flujo Financiero (Evolución Mensual) */}
      <Card className="lg:col-span-3" title="Flujo Financiero" subtitle="Evolución de Ingresos vs gastos proyectados." variant="glass">
        <div className="h-[350px] mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryHex} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={primaryHex} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#94a3b8" />
              <YAxis
                axisLine={false}
                tickLine={false}
                stroke="#94a3b8"
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
                  return `$${value}`;
                }}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900/90 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-md">
                        <p className="text-slate-400 text-xs mb-1 font-medium uppercase tracking-wider">{label}</p>
                        {payload.map((p: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${p.name === 'Ingresos' ? (theme === 'new' ? 'bg-teal-500' : 'bg-blue-500') : 'bg-rose-500'}`}></div>
                            <span className="text-slate-300 text-xs">{p.name}:</span>
                            <span className={`text-sm font-bold ${p.name === 'Ingresos' ? (theme === 'new' ? 'text-teal-400' : 'text-blue-400') : 'text-rose-400'}`}>
                              {formatMoney(p.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="Ingresos"
                stroke={primaryHex}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorIngresos)"
              />
              <Area
                type="monotone"
                dataKey="Gastos"
                stroke="#f43f5e"
                strokeWidth={3}
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#colorGastos)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 2. Stats Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 lg:col-span-3">
        {/* New Balance Card (Actual vs Projected) */}
        <Card className={`group hover:-translate-y-1 transition-transform duration-300 relative !overflow-visible shine-hover col-span-1 md:col-span-2 lg:col-span-1 ${theme === 'new' ? 'border-teal-500/30' : 'border-blue-500/30'}`} variant="glass">
          <div className={`absolute inset-0 bg-gradient-to-br ${theme === 'new' ? 'from-teal-600/20 to-emerald-500/10' : 'from-blue-600/20 to-cyan-500/10'} opacity-50 rounded-2xl`}></div>
          <div className="relative z-10 flex flex-col justify-center h-full">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl ${theme === 'new' ? 'bg-teal-500/20 text-teal-400' : 'bg-blue-500/20 text-blue-400'} flex items-center justify-center`}>
                <i className="fas fa-chart-line text-lg"></i>
              </div>
              <span className={`text-[10px] font-black ${theme === 'new' ? 'text-teal-300' : 'text-blue-300'} uppercase tracking-widest`}>Saldo Proyectado</span>
              <InfoTooltip content="Esta es la proyección de tu saldo final considerando gastos e ingresos marcados como 'Provisorios'." position="top" useIcon />
            </div>

            <div className="flex items-end gap-2">
              <span className={`text-3xl font-black ${projectedNetFlow >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {formatMoney(projectedNetFlow)}
              </span>
              {Math.abs(projectedNetFlow - netFlow) > 1 && (
                <span className="text-sm font-bold text-slate-400 mb-1.5 ml-1">
                  (Actual: {formatMoney(netFlow)})
                </span>
              )}
            </div>
            <div className="mt-2 w-full bg-slate-800/50 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${projectedNetFlow >= 0 ? (theme === 'new' ? 'bg-teal-500' : 'bg-blue-500') : 'bg-rose-500'}`}
                style={{ width: '100%' }} // Simple bar for now
              ></div>
            </div>
          </div>
        </Card>

        {[
          { label: 'Ingresos Totales', val: currentTotals[CategoryType.INCOME] || 0, icon: 'fa-wallet', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-transparent' },
          { label: 'Gastos Fijos', val: currentTotals[CategoryType.FIXED_EXPENSE] || 0, icon: 'fa-lock', color: 'text-indigo-400', bg: 'from-indigo-500/10 to-transparent' },
          { label: 'Gastos Variables', val: currentTotals[CategoryType.VARIABLE_EXPENSE] || 0, icon: 'fa-shopping-bag', color: 'text-amber-400', bg: 'from-amber-500/10 to-transparent' },
          { label: 'Gastos Compartidos', val: currentTotals[CategoryType.SHARED_EXPENSE] || 0, icon: 'fa-users', color: 'text-teal-400', bg: 'from-teal-500/10 to-transparent' },
          {
            label: 'Ahorro Real',
            val: (currentTotals[CategoryType.SAVINGS] || 0) + totalGoalsSaved,
            icon: 'fa-piggy-bank',
            color: theme === 'new' ? 'text-teal-400' : 'text-blue-400',
            bg: theme === 'new' ? 'from-teal-500/10 to-transparent' : 'from-blue-500/10 to-transparent',
            customValue: `${formatMoney(currentTotals[CategoryType.SAVINGS] || 0)} / ${formatMoney(totalGoalsSaved)}`,
            tooltip: "Suma de depósitos directos a Ahorro + Aportes a Metas."
          }
        ].map((stat, i) => (
          <Card key={i} className={`group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden shine-hover`} variant="glass">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} opacity-50`}></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500">
                <i className={`fas ${stat.icon} text-2xl ${stat.color} drop-shadow-md`}></i>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                  {'tooltip' in stat && <InfoTooltip content={stat.tooltip as string} position="top" useIcon />}
                </div>
                <p className={`text-2xl font-black text-white tracking-tight`}>{'customValue' in stat ? stat.customValue : formatMoney(stat.val)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 3. Bottom Grid: Donut Chart Full Width */}

      {/* Distribución de Gastos (Donut) */}
      <Card className="lg:col-span-3" title="Distribución de Gastos" subtitle="Desglose detallado por categorías." variant="glass">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-auto lg:h-[400px]">
          {/* Chart */}
          <div className="h-[300px] lg:h-full flex flex-col items-center justify-center">
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    data={[
                      { name: 'Gastos Fijos', value: currentTotals[CategoryType.FIXED_EXPENSE] || 0, fill: '#818cf8' },
                      { name: 'Gastos Variables', value: currentTotals[CategoryType.VARIABLE_EXPENSE] || 0, fill: '#fbbf24' },
                      { name: 'Gastos Compartidos', value: currentTotals[CategoryType.SHARED_EXPENSE] || 0, fill: '#2dd4bf' },
                      { name: 'Deudas', value: currentTotals[CategoryType.DEBT] || 0, fill: '#f43f5e' },
                      { name: 'Ahorro', value: currentTotals[CategoryType.SAVINGS] || 0, fill: '#34d399' },
                    ].filter(i => i.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    onMouseEnter={onPieEnter}
                    stroke="none"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Texto del Total Debajo del Gráfico */}
            <div className="mt-4 text-center">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">TOTAL GASTOS</span>
              <span className="text-3xl font-black text-white drop-shadow-lg">
                {formatMoney((currentTotals[CategoryType.FIXED_EXPENSE] || 0) + (currentTotals[CategoryType.VARIABLE_EXPENSE] || 0) + (currentTotals[CategoryType.SHARED_EXPENSE] || 0) + (currentTotals[CategoryType.DEBT] || 0) + (currentTotals[CategoryType.SAVINGS] || 0))}
              </span>
            </div>
          </div>

          {/* Legend / Details */}
          <div className="space-y-4 pr-2 lg:pr-8 overflow-y-auto max-h-[320px] custom-scrollbar">
            {[
              { name: 'Gastos Fijos', value: currentTotals[CategoryType.FIXED_EXPENSE] || 0, color: 'text-indigo-400', bg: 'bg-indigo-500' },
              { name: 'Gastos Variables', value: currentTotals[CategoryType.VARIABLE_EXPENSE] || 0, color: 'text-amber-400', bg: 'bg-amber-500' },
              { name: 'Gastos Compartidos', value: currentTotals[CategoryType.SHARED_EXPENSE] || 0, color: 'text-teal-400', bg: 'bg-teal-500' },
              { name: 'Deudas', value: currentTotals[CategoryType.DEBT] || 0, color: 'text-rose-400', bg: 'bg-rose-500' },
              { name: 'Ahorro', value: currentTotals[CategoryType.SAVINGS] || 0, color: 'text-emerald-400', bg: 'bg-emerald-500' },
            ].filter(i => i.value > 0).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-12 rounded-full ${item.bg} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}></div>
                  <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">{item.name}</p>
                    <p className={`text-xl font-black ${item.color} drop-shadow-sm`}>{formatMoney(item.value)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-600 group-hover:text-white transition-colors opacity-30 group-hover:opacity-100">
                    {((item.value / ((currentTotals[CategoryType.FIXED_EXPENSE] || 0) + (currentTotals[CategoryType.VARIABLE_EXPENSE] || 0) + (currentTotals[CategoryType.SHARED_EXPENSE] || 0) + (currentTotals[CategoryType.DEBT] || 0) + (currentTotals[CategoryType.SAVINGS] || 0))) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
