import React, { useState, useMemo } from 'react';
import { getThemeColors } from '../utils/theme';
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Sector, Legend, LabelList
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
  // Nav callback para que las filas de vencimientos sean clickeables y lleven al item
  // dentro de Movimientos.
  navigate?: (tab: any, params?: any) => void;
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
  navigate,
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

  // Resumen del mes: net = ingresos - gastos del mes actual.
  // Comparamos contra mes anterior para mostrar si vamos mejor o peor.
  // El sparkline usa los últimos 6 meses (trendData ya filtrado para excluir meses sin data).
  const monthlySummary = useMemo(() => {
    const current = trendData.length > 0 ? trendData[trendData.length - 1] : null;
    const previous = trendData.length > 1 ? trendData[trendData.length - 2] : null;
    const currentNet = current ? (current.Ingresos || 0) - (current.Gastos || 0) : netFlow;
    const previousNet = previous ? (previous.Ingresos || 0) - (previous.Gastos || 0) : null;
    const sparkline = trendData.map(d => ({
      name: d.name,
      net: (d.Ingresos || 0) - (d.Gastos || 0),
    }));
    return { currentNet, previousNet, sparkline };
  }, [trendData, netFlow]);

  // Datos para los stat cards del bottom row, con barra de presupuesto cuando esté definido.
  // Quitamos cards redundantes: Saldo Proyectado (ya en sidebar), Ingresos Totales (ya en
  // header), Gastos Fijos (ya en widget "Más gasto" del top row).
  const bottomStats = useMemo(() => {
    return [
      { cat: CategoryType.VARIABLE_EXPENSE, label: 'Gastos Variables', icon: 'fa-shopping-bag', color: 'text-amber-400', bg: 'from-amber-500/10 to-transparent' },
      { cat: CategoryType.SHARED_EXPENSE, label: 'Gastos Compartidos', icon: 'fa-users', color: 'text-teal-400', bg: 'from-teal-500/10 to-transparent' },
      { cat: CategoryType.DEBT, label: 'Deudas', icon: 'fa-receipt', color: 'text-rose-400', bg: 'from-rose-500/10 to-transparent' },
      { cat: CategoryType.SAVINGS, label: 'Ahorro Real', icon: 'fa-piggy-bank', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-transparent' },
    ].map(s => {
      const total = (currentTotals[s.cat] || 0) + (s.cat === CategoryType.SAVINGS ? totalGoalsSaved : 0);
      const budget = categoryBudgets?.[s.cat] || 0;
      const pct = budget > 0 ? Math.round((total / budget) * 100) : null;
      return { ...s, total, budget, pct };
    });
  }, [currentTotals, categoryBudgets, totalGoalsSaved]);

  // Click en un vencimiento → abre el item en Movimientos.
  const goToEntry = (entry: BudgetEntry) => {
    if (!navigate) return;
    navigate('presupuesto', { entryId: entry.id, month: entry.month_year || entry.date?.substring(0, 7) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* 0. Header Strip + 2 widgets accionables (3 columnas en desktop, apilados en mobile) */}

      {/* Widget 0: Resumen del mes — net = Ingresos - Gastos con comparación vs mes anterior. */}
      <Card variant="glass" className="!p-5 relative overflow-hidden">
        <div className={`absolute inset-0 ${monthlySummary.currentNet >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5'} blur-3xl`}></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-9 h-9 rounded-xl ${monthlySummary.currentNet >= 0 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border-rose-500/20'} border flex items-center justify-center`}>
              <i className={`fas ${monthlySummary.currentNet >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-sm`}></i>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{greeting}, {user.firstName || user.username}</span>
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Balance del mes</p>
          <p className={`text-3xl font-black tracking-tight ${monthlySummary.currentNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {monthlySummary.currentNet >= 0 ? '+' : ''}{formatMoney(monthlySummary.currentNet)}
          </p>
          {monthlySummary.previousNet !== null && Math.abs(monthlySummary.previousNet) > 1 && (() => {
            const diff = monthlySummary.currentNet - monthlySummary.previousNet;
            const pctChange = monthlySummary.previousNet !== 0 ? Math.round((diff / Math.abs(monthlySummary.previousNet)) * 100) : null;
            const arrowUp = diff > 0;
            return (
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                <i className={`fas ${arrowUp ? 'fa-caret-up text-emerald-400' : 'fa-caret-down text-rose-400'} mr-1`}></i>
                {arrowUp ? '+' : ''}{formatMoney(diff)}
                {pctChange !== null && <span className="ml-1">({arrowUp ? '+' : ''}{pctChange}%)</span>}
                <span className="ml-1 text-slate-600">vs mes anterior</span>
              </p>
            );
          })()}
          {monthlySummary.sparkline.length >= 2 && (
            <div className="h-12 mt-3 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySummary.sparkline}>
                  <defs>
                    <linearGradient id="sparkNetPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke={monthlySummary.currentNet >= 0 ? '#34d399' : '#f43f5e'}
                    strokeWidth={2}
                    fill="url(#sparkNetPos)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

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
          <div className="space-y-1.5">
            {upcomingDue.map(e => {
              const cfg = categoryConfig[e.category as CategoryType];
              // Algunos items tienen el monto embebido en el nombre (ej "$491.690,53 (Menos…)").
              // Mostrarlo igual pero con `title` para que el tooltip nativo muestre el nombre
              // completo en hover, y reservar más espacio al monto/fecha.
              return (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => goToEntry(e)}
                  disabled={!navigate}
                  title={`${e.name}${navigate ? ' — click para ir al movimiento' : ''}`}
                  className={`w-full flex items-center gap-2 text-[12px] py-1.5 px-2 -mx-2 rounded-lg transition-colors text-left ${navigate ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}
                >
                  <i className={`fas ${cfg?.icon || 'fa-circle'} ${cfg?.color || 'text-slate-400'} text-[10px] w-4 text-center shrink-0`}></i>
                  <span className="font-bold text-white truncate flex-1 min-w-0">{e.name}</span>
                  <span className="font-mono text-slate-300 whitespace-nowrap text-[11px]">{formatMoney(e.amount)}</span>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider whitespace-nowrap">
                    {formatRelativeDate(e.date)}
                  </span>
                </button>
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
      <Card
        className="lg:col-span-3"
        title="Flujo Financiero"
        subtitle="Evolución de ingresos vs gastos proyectados."
        variant="glass"
        headerActions={
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full" style={{ backgroundColor: primaryHex }}></span>
              <span className="text-slate-300">Ingresos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-rose-500"></span>
              <span className="text-slate-300">Gastos</span>
            </div>
          </div>
        }
      >
        <div className="h-[350px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 30, right: 20, left: 0, bottom: 0 }}>
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
                      <div className="bg-slate-900/95 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-md">
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
              >
                <LabelList
                  dataKey="Ingresos"
                  position="top"
                  formatter={(v: any) => {
                    const n = Number(v);
                    if (!Number.isFinite(n) || n === 0) return '';
                    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
                    return `$${(n / 1000).toFixed(0)}k`;
                  }}
                  style={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
              </Area>
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

      {/* 2. Stats por categoría — sin duplicados con sidebar/header. Cada card tiene barra
              de progreso vs presupuesto (verde <80%, ámbar 80-100%, rojo >100%) cuando hay
              presupuesto definido en Configuración. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:col-span-3">
        {bottomStats.map((s, i) => {
          const showSavings = s.cat === CategoryType.SAVINGS && totalGoalsSaved > 0;
          return (
            <Card key={i} className="group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden shine-hover" variant="glass">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-50`}></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500">
                    <i className={`fas ${s.icon} text-xl ${s.color} drop-shadow-md`}></i>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{s.label}</span>
                    {showSavings && <InfoTooltip content="Suma de depósitos directos a Ahorro + Aportes a Metas." position="top" useIcon />}
                  </div>
                </div>
                <p className="text-2xl font-black text-white tracking-tight">{formatMoney(s.total)}</p>
                {showSavings && (
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                    Ahorro directo: {formatMoney(currentTotals[CategoryType.SAVINGS] || 0)} · Metas: {formatMoney(totalGoalsSaved)}
                  </p>
                )}
                {/* Barra de progreso vs presupuesto */}
                <div className="mt-3">
                  {s.pct !== null ? (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Presupuesto</span>
                        <span className={`text-[10px] font-black ${s.pct > 100 ? 'text-rose-400' : s.pct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {s.pct}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${s.pct > 100 ? 'bg-rose-500' : s.pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(s.pct, 100)}%` }}
                        ></div>
                      </div>
                    </>
                  ) : (
                    <p className="text-[9px] text-slate-600 italic">Sin presupuesto definido</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
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
