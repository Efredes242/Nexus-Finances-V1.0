import React, { useState } from 'react';
import { getThemeColors } from '../utils/theme';
import { SavingsGoal, BudgetEntry, AppState } from '../types';
import { formatDate, generateUUID } from '../utils/helpers';
import { Card } from '../components/Card';
import { Tooltip } from '../components/Tooltip';

interface MetasViewProps {
  goals: SavingsGoal[];
  appState: AppState;
  setEditingGoal: (goal: SavingsGoal) => void;
  formatMoney: (amount: number) => string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (state: AppState) => boolean;
  color: string;
  bgColor: string;
  gradientColor: string;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-budget',
    title: 'Primeros Pasos',
    description: 'Registra tu primer movimiento en el presupuesto.',
    icon: 'fa-flag',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    gradientColor: 'via-blue-400',
    condition: (state) => Object.values(state.budgets).some(b => b.entries.length > 0)
  },
  {
    id: 'saver-started',
    title: 'Semilla del Ahorro',
    description: 'Comienza a ahorrar para una meta.',
    icon: 'fa-seedling',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    gradientColor: 'via-emerald-400',
    condition: (state) => state.goals.some(g => g.currentAmount > 0)
  },
  {
    id: 'goal-reached',
    title: '¡Meta Cumplida!',
    description: 'Completa una meta de ahorro al 100%.',
    icon: 'fa-trophy',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    gradientColor: 'via-yellow-400',
    condition: (state) => state.goals.some(g => g.currentAmount >= g.targetAmount && g.targetAmount > 0)
  },
  {
    id: 'credit-master',
    title: 'Estratega del Crédito',
    description: 'Registra una compra financiada en cuotas.',
    icon: 'fa-credit-card',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    gradientColor: 'via-purple-400',
    condition: (state) => state.installmentPurchases.length > 0
  },
  {
    id: 'data-analyst',
    title: 'Constancia',
    description: 'Mantén registros por más de 3 meses.',
    icon: 'fa-chart-line',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    gradientColor: 'via-cyan-400',
    condition: (state) => Object.keys(state.budgets).length >= 3
  },
  {
    id: 'debt-free',
    title: 'Libertad Financiera',
    description: 'No tener compras en cuotas activas (requiere historial).',
    icon: 'fa-dove',
    color: 'text-white',
    bgColor: 'bg-white/10',
    gradientColor: 'via-white',
    condition: (state) => state.installmentPurchases.length === 0 && Object.keys(state.budgets).length > 0
  }
];

export const MetasView: React.FC<MetasViewProps> = ({
  goals,
  appState,
  setEditingGoal,
  formatMoney
}) => {
  const theme = localStorage.getItem('colorTheme') || 'new';
  const themeColors = getThemeColors();
  const [activeTab, setActiveTab] = useState<'goals' | 'achievements'>('goals');
  const [viewingGoal, setViewingGoal] = useState<SavingsGoal | null>(null);

  const getGoalContributions = (goalId: string) => {
    const contributions: BudgetEntry[] = [];
    Object.values(appState.budgets).forEach(budget => {
      budget.entries.forEach(entry => {
        if (entry.goalId === goalId) {
          contributions.push(entry);
        }
      });
    });
    return contributions.sort((a, b) => {
      const dateA = a.maturityDate || a.date;
      const dateB = b.maturityDate || b.date;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 mt-2 lg:mt-8">

      {/* Tab Switcher */}
      <div className="flex p-1 bg-slate-900/50 backdrop-blur-md rounded-2xl w-fit border border-white/5">
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-6 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'goals' ? (theme === 'new' ? 'bg-teal-600 shadow-teal-500/20' : 'bg-blue-600 shadow-blue-500/20') + ' text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fas fa-bullseye"></i> Mis Metas
          <Tooltip content="Define objetivos de ahorro (Auto, Casa, Vacaciones) y asigna dinero mensualmente para cumplirlos." position="bottom" useIcon />
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-6 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'achievements' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fas fa-medal"></i> Logros
          <Tooltip content="Desbloquea medallas a medida que mejoras tu salud financiera." position="bottom" useIcon />
        </button>
      </div>

      {activeTab === 'goals' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => setEditingGoal({ id: generateUUID(), name: '', targetAmount: 0, currentAmount: 0, icon: 'fa-piggy-bank' })}
            className={`group h-full min-h-[250px] border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center p-12 hover:${theme === 'new' ? 'border-teal-500/50 bg-teal-500/5 text-teal-500' : 'border-blue-500/50 bg-blue-500/5 text-blue-500'} transition-all text-slate-600`}
          >
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <i className="fas fa-plus text-2xl"></i>
            </div>
            <span className="font-black uppercase tracking-widest text-xs">Nueva Meta</span>
          </button>

          {goals.map(g => (
            <Card
              key={g.id}
              title={g.name}
              subtitle={`Objetivo: ${formatMoney(g.targetAmount)}`}
              className="hover:-translate-y-1 transition-transform duration-300 shine-hover min-h-[250px] flex flex-col justify-between cursor-pointer"
              onClick={() => setViewingGoal(g)}
              headerActions={
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); setEditingGoal(g); }} className={`text-slate-500 hover:${themeColors.accent} p-2`}><i className="fas fa-pencil"></i></button>
                </div>
              }
            >
              <div className="mt-8 space-y-5">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Ahorro Actual</span>
                    <p className="text-3xl font-black text-white">{formatMoney(g.currentAmount)}</p>
                  </div>
                  <span className="text-sm font-black text-emerald-500">{Math.round((g.currentAmount / (g.targetAmount || 1)) * 100)}%</span>
                </div>
                <div className="h-3 bg-slate-900 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${Math.min(100, (g.currentAmount / (g.targetAmount || 1)) * 100)}%` }}></div>
                </div>
              </div>
            </Card>
          ))}
          {goals.length === 0 && (
            <div className="col-span-2 flex items-center justify-center p-12 text-slate-500 italic">
              No tienes metas activas. ¡Crea una para empezar a ahorrar!
            </div>
          )}
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACHIEVEMENTS.map(achievement => {
            const isUnlocked = achievement.condition(appState);
            return (
              <div
                key={achievement.id}
                className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-500 ${isUnlocked ? 'bg-slate-900/50 border-white/10 hover:border-white/20' : 'bg-slate-900/20 border-white/5 opacity-50 grayscale'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${isUnlocked ? `${achievement.bgColor} ${achievement.color}` : 'bg-slate-800 text-slate-600'}`}>
                    <i className={`fas ${achievement.icon}`}></i>
                  </div>
                  <div>
                    <h3 className={`font-black text-lg ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>{achievement.title}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">{achievement.description}</p>
                  </div>
                </div>
                {isUnlocked && (
                  <div className="absolute top-4 right-4 text-emerald-500 animate-in zoom-in duration-300">
                    <i className="fas fa-check-circle text-xl"></i>
                  </div>
                )}
                <div className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent ${isUnlocked ? achievement.gradientColor : 'via-slate-800'} to-transparent w-full opacity-50`}></div>
              </div>
            );
          })}
        </div>
      )}

      {viewingGoal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card title={viewingGoal.name} subtitle="Detalle de Ahorros e Inversiones" className="w-full max-w-2xl border border-white/10 shadow-2xl h-[80vh] flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
              {(() => {
                const contributions = getGoalContributions(viewingGoal.id);
                const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
                const initialBalance = viewingGoal.currentAmount - totalContributions;

                return (
                  <>
                    {contributions.length === 0 && initialBalance === 0 ? (
                      <div className="text-center p-10 text-slate-500">
                        <i className="fas fa-piggy-bank text-4xl mb-4 opacity-20"></i>
                        <p>No hay ahorros asignados a esta meta aún.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Saldo Inicial / Ajuste Manual */}
                        {initialBalance !== 0 && (
                          <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500/50"></div>
                            <div>
                              <p className="font-bold text-white">Saldo Inicial / Ajuste Manual</p>
                              <div className="flex gap-4 mt-1">
                                <span className="text-xs text-slate-500 font-bold uppercase">
                                  <i className="fas fa-info-circle mr-1"></i>
                                  {initialBalance > 0 ? 'Fondo previo' : 'Ajuste negativo'}
                                </span>
                              </div>
                            </div>
                            <span className={`font-black text-lg ${initialBalance > 0 ? 'text-slate-300' : 'text-rose-400'}`}>
                              {formatMoney(initialBalance)}
                            </span>
                          </div>
                        )}

                        {/* Lista de Contribuciones */}
                        {contributions.map(entry => (
                          <div key={entry.id} className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center group/item hover:bg-slate-800 transition-colors">
                            <div>
                              <p className="font-bold text-white">{entry.name}</p>
                              <div className="flex gap-4 mt-1">
                                <span className="text-xs text-slate-500 font-bold uppercase group-hover/item:text-slate-400 transition-colors">
                                  <i className="fas fa-calendar mr-1"></i>
                                  Registrado: {formatDate(entry.date)}
                                </span>
                                {entry.maturityDate && (
                                  <span className="text-xs text-emerald-400 font-bold uppercase">
                                    <i className="fas fa-clock mr-1"></i>
                                    Disponible: {formatDate(entry.maturityDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="font-black text-emerald-400 text-lg">
                              {formatMoney(entry.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="pt-6 mt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={() => setViewingGoal(null)}
                className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
