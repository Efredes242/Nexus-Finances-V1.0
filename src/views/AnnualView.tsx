import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';
import { AppState, CategoryType, MonthlyBudget } from '../types';
import { Card } from '../components/Card';
import { categoryConfig } from '../config/constants';

interface AnnualViewProps {
  year: string;
  budgets: Record<string, MonthlyBudget>;
  formatMoney: (amount: number) => string;
}

export const AnnualView: React.FC<AnnualViewProps> = ({
  year,
  budgets,
  formatMoney
}) => {
  
  // 1. Aggregate Data
  const annualData = useMemo(() => {
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const monthNum = (i + 1).toString().padStart(2, '0');
      const monthKey = `${year}-${monthNum}`;
      const budget = budgets[monthKey];
      
      let income = 0;
      let expenses = 0;
      let savings = 0;

      if (budget) {
        budget.entries.forEach(e => {
            if (e.category === CategoryType.INCOME) {
                income += e.amount;
            } else if (e.category === CategoryType.SAVINGS) {
                savings += e.amount;
                expenses += e.amount; // Ahorro cuenta como salida de dinero en flujo, pero lo trackeamos separado
            } else {
                expenses += e.amount;
            }
        });
      }

      const date = new Date(parseInt(year), i, 1);
      return {
        month: monthNum,
        name: date.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
        fullName: date.toLocaleString('es-ES', { month: 'long' }).toUpperCase(),
        income,
        expenses,
        savings,
        balance: income - expenses
      };
    });

    const totalIncome = monthlyStats.reduce((acc, m) => acc + m.income, 0);
    const totalExpenses = monthlyStats.reduce((acc, m) => acc + m.expenses, 0);
    const totalSavings = monthlyStats.reduce((acc, m) => acc + m.savings, 0);
    const netResult = totalIncome - totalExpenses;

    // Category Breakdown
    const categoryTotals: Record<string, number> = {};
    Object.keys(budgets).forEach(key => {
        if (key.startsWith(year)) {
            budgets[key].entries.forEach(e => {
                if (e.category !== CategoryType.INCOME) {
                    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
                }
            });
        }
    });

    const pieData = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    return { monthlyStats, totalIncome, totalExpenses, totalSavings, netResult, pieData };
  }, [year, budgets]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-4">
        <div>
          <h3 className="text-3xl font-black text-white">Resumen Anual {year}</h3>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
            Análisis completo del periodo fiscal
          </p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <Card variant="glass" className="relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="fas fa-arrow-up text-6xl text-emerald-500"></i>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos Totales</span>
                <p className="text-3xl font-black text-emerald-400">{formatMoney(annualData.totalIncome)}</p>
            </div>
         </Card>

         <Card variant="glass" className="relative overflow-hidden group">
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="fas fa-arrow-down text-6xl text-rose-500"></i>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gastos Totales</span>
                <p className="text-3xl font-black text-rose-400">{formatMoney(annualData.totalExpenses)}</p>
            </div>
         </Card>

         <Card variant="glass" className="relative overflow-hidden group">
             <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="fas fa-piggy-bank text-6xl text-blue-500"></i>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ahorro Acumulado</span>
                <p className="text-3xl font-black text-blue-400">{formatMoney(annualData.totalSavings)}</p>
            </div>
         </Card>

         <Card variant="glass" className="relative overflow-hidden group">
             <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <i className="fas fa-wallet text-6xl text-indigo-500"></i>
            </div>
            <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resultado Neto</span>
                <p className={`text-3xl font-black ${annualData.netResult >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                    {formatMoney(annualData.netResult)}
                </p>
            </div>
         </Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 min-h-[400px]" title="Flujo de Caja Mensual" subtitle="Ingresos vs Egresos mes a mes">
             <div className="h-[350px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={annualData.monthlyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12, fontWeight: 'bold'}} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                            formatter={(value: number) => formatMoney(value)}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        <Bar dataKey="expenses" name="Egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </Card>

          <Card className="min-h-[400px]" title="Distribución de Gastos" subtitle="Por categoría anual">
            <div className="h-[350px] w-full mt-4 flex items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={annualData.pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {annualData.pieData.map((entry, index) => {
                                const config = categoryConfig[entry.name as CategoryType];
                                // Extract hex color from tailwind class map or use fallback
                                // Since we don't have direct hex map here easily without duplicating, 
                                // we'll use a simple color array or try to match config colors if possible.
                                // For simplicity, let's use a palette.
                                const COLORS = ['#f43f5e', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'];
                                return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                            })}
                        </Pie>
                        <Tooltip 
                             contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                             itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                             formatter={(value: number) => formatMoney(value)}
                        />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '20px' }} />
                    </PieChart>
                 </ResponsiveContainer>
            </div>
          </Card>
      </div>

      {/* MONTHLY DETAIL TABLE */}
      <Card title="Detalle Mensual" subtitle="Desglose numérico por mes">
          <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                          <th className="px-6 py-4">Mes</th>
                          <th className="px-6 py-4 text-right text-emerald-500">Ingresos</th>
                          <th className="px-6 py-4 text-right text-rose-500">Gastos</th>
                          <th className="px-6 py-4 text-right text-blue-500">Ahorro</th>
                          <th className="px-6 py-4 text-right text-indigo-500">Balance</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                      {annualData.monthlyStats.map((m) => (
                          <tr key={m.month} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4 font-bold text-white group-hover:text-blue-400 transition-colors">
                                  {m.fullName}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-emerald-400/80">{formatMoney(m.income)}</td>
                              <td className="px-6 py-4 text-right font-mono text-rose-400/80">{formatMoney(m.expenses)}</td>
                              <td className="px-6 py-4 text-right font-mono text-blue-400/80">{formatMoney(m.savings)}</td>
                              <td className="px-6 py-4 text-right font-mono font-black text-white">{formatMoney(m.balance)}</td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-white/5 border-t-2 border-white/10">
                      <tr>
                          <td className="px-6 py-4 font-black text-white uppercase tracking-widest text-xs">Total Anual</td>
                          <td className="px-6 py-4 text-right font-black text-emerald-400">{formatMoney(annualData.totalIncome)}</td>
                          <td className="px-6 py-4 text-right font-black text-rose-400">{formatMoney(annualData.totalExpenses)}</td>
                          <td className="px-6 py-4 text-right font-black text-blue-400">{formatMoney(annualData.totalSavings)}</td>
                          <td className="px-6 py-4 text-right font-black text-indigo-400">{formatMoney(annualData.netResult)}</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
      </Card>
    </div>
  );
};
