import React, { useState, useMemo } from 'react';
import { getThemeColors } from '../utils/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Tooltip } from '../components/Tooltip';
import { CategoryType, TransactionStatus, PaymentMethod, BudgetEntry, AppState, InstallmentPurchase } from '../types';
import { categoryConfig } from '../config/constants';
import { generateUUID, isUsdTargetEntry } from '../utils/helpers';
import { SharedExpensesAPB } from '../components/SharedExpensesAPB';
import { DolarQuoteCard } from '../components/DolarQuoteCard';

interface PresupuestoViewProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAIUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isParsing: boolean;
  collapsedCategories: Set<string>;
  setCollapsedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
  currentTotals: Record<CategoryType, number>;
  formatMoney: (amount: number) => string;
  setEditingEntry: (entry: BudgetEntry) => void;
  categories: Record<CategoryType, string[]>;
  currentMonth: string;
  installmentPurchases: InstallmentPurchase[];
  currentBudgetEntries: BudgetEntry[];
  setViewingInstallment: (installment: InstallmentPurchase | null) => void;
  expandedRows: Set<string>;
  setExpandedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  deleteEntry: (id: string) => void;
  categoryBudgets: Record<CategoryType, number>;
  onUpdateBudget: (category: string, amount: number) => void;
  onReorderEntries: (entries: BudgetEntry[]) => void;
  onConfirmEntry: (entry: BudgetEntry) => void;
  onPayEntry: (entry: BudgetEntry) => void;
  initialViewMode?: 'monthly' | 'biweekly';
  applications?: string[];
  navigate?: (tab: any, params?: any) => void;
  allEntries: BudgetEntry[];
  onApplyDolarRate: (rate: number, categoryFilter?: string) => Promise<{ updatedCount: number }>;
  // Raw entries de la DB del mes visible (sin agregadores virtuales). Necesario para
  // que el botón "Aplicar" cuente sólo los USD reales y respete el filtro de categoría.
  monthRawEntries: BudgetEntry[];
}

export const PresupuestoView: React.FC<PresupuestoViewProps> = ({
  fileInputRef,
  handleAIUpload,
  isParsing,
  collapsedCategories,
  setCollapsedCategories,
  currentTotals,
  formatMoney,
  setEditingEntry,
  categories,
  currentMonth,
  installmentPurchases,
  currentBudgetEntries,
  setViewingInstallment,
  expandedRows,
  setExpandedRows,
  deleteEntry,
  categoryBudgets,
  onUpdateBudget,
  onReorderEntries,
  onConfirmEntry,
  onPayEntry,
  initialViewMode = 'monthly',
  navigate,
  allEntries,
  applications = [],
  onApplyDolarRate,
  monthRawEntries
}: PresupuestoViewProps) => {
  // Vibrant high-contrast colors for income sources (contrasting with dark blue background)
  const incomeColors = [
    { bg: 'bg-emerald-400', text: 'text-slate-950', border: 'border-emerald-200' },
    { bg: 'bg-cyan-400', text: 'text-slate-950', border: 'border-cyan-200' },
    { bg: 'bg-violet-400', text: 'text-white', border: 'border-violet-200' },
    { bg: 'bg-fuchsia-400', text: 'text-white', border: 'border-fuchsia-200' },
    { bg: 'bg-amber-400', text: 'text-slate-950', border: 'border-amber-200' },
    { bg: 'bg-sky-400', text: 'text-slate-950', border: 'border-sky-200' },
    { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-200' },
    { bg: 'bg-lime-400', text: 'text-slate-950', border: 'border-lime-200' },
    { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-200' },
    { bg: 'bg-white', text: 'text-slate-900', border: 'border-slate-300' },
  ];

  const getLinkedIncomeInfo = (incomeId: string | undefined) => {
    if (!incomeId) return null;
    const income = allEntries.find(e => e.id === incomeId);
    if (!income) return null;
    
    // Simple hash to keep colors consistent for the same name
    const charSum = income.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const color = incomeColors[charSum % incomeColors.length];
    return { name: income.name, ...color };
  };

  const themeColors = getThemeColors();
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'monthly' | 'biweekly'>(initialViewMode);

  React.useEffect(() => {
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  const [draggedItem, setDraggedItem] = useState<BudgetEntry | null>(null);
  const [showTransferSummary, setShowTransferSummary] = useState(false);

  const applicationTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    currentBudgetEntries.forEach(e => {
      // Logic: Only expenses/debts/savings (not income) that have an application assigned
      // and ideally are NOT fully paid yet (or show all based on preference - let's show all for current month)
      if (e.application && e.category !== CategoryType.INCOME) {
        const app = e.application.trim().toUpperCase();
        
        // If it's a card aggregation, we should count it if it has an app? 
        // Actually, individual entries have the app. 
        // But Installments have subEntries. We should sum subEntries if they have app.
        if (e.subEntries && e.subEntries.length > 0) {
           e.subEntries.forEach(sub => {
             if (sub.application) {
               const subApp = sub.application.trim().toUpperCase();
               totals[subApp] = (totals[subApp] || 0) + sub.amount;
             }
           });
        } else {
           totals[app] = (totals[app] || 0) + e.amount;
        }
      }
    });
    return totals;
  }, [currentBudgetEntries]);

  const sortEntries = (a: BudgetEntry, b: BudgetEntry) => {
    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;
    const isCreditA = a.paymentMethod === PaymentMethod.CREDIT || a.installmentRef || a.subEntries;
    const isCreditB = b.paymentMethod === PaymentMethod.CREDIT || b.installmentRef || b.subEntries;
    if (isCreditA && !isCreditB) return -1;
    if (!isCreditA && isCreditB) return 1;
    return 0;
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, item: BudgetEntry) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag ghost image semi-transparent
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, targetItem: BudgetEntry) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    if (draggedItem.category !== targetItem.category) return;

    const categoryEntries = currentBudgetEntries
      .filter(entry => entry.category === draggedItem.category)
      .sort(sortEntries);

    const currentIndex = categoryEntries.findIndex(e => e.id === draggedItem.id);
    const targetIndex = categoryEntries.findIndex(e => e.id === targetItem.id);

    if (currentIndex === -1 || targetIndex === -1) return;

    const newEntries = [...categoryEntries];
    newEntries.splice(currentIndex, 1);
    newEntries.splice(targetIndex, 0, draggedItem);

    const updates = newEntries.map((entry, index) => ({
      ...entry,
      order: index
    }));

    onReorderEntries(updates);
  };

  const totalConsumption = useMemo(() => {
    return Object.values(CategoryType)
      .filter(cat => cat !== CategoryType.INCOME)
      .filter(cat => filterCategory === 'ALL' || cat === filterCategory)
      .reduce((acc, cat) => acc + (currentTotals[cat] || 0), 0);
  }, [currentTotals, filterCategory]);

  // Cuenta movimientos USD del mes visible respetando el filtro de categoría activo.
  // Si filterCategory === 'ALL', cuenta todos. Si está filtrado, sólo los USD de esa categoría.
  const usdEntriesCount = useMemo(() => {
    return monthRawEntries
      .filter(isUsdTargetEntry)
      .filter(e => filterCategory === 'ALL' || e.category === filterCategory)
      .length;
  }, [monthRawEntries, filterCategory]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 mt-2 lg:mt-6 pb-32 lg:pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center lg:px-4 gap-4">

        {/* View Mode Indicator & Transfer Summary */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-900/50 rounded-xl p-2 pr-4 border border-white/5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${initialViewMode === 'biweekly' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <i className={`fas ${initialViewMode === 'biweekly' ? 'fa-calendar-week' : 'fa-calendar-alt'} text-xl`}></i>
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo de Vista</div>
              <div className={`text-sm font-bold ${initialViewMode === 'biweekly' ? 'text-purple-400' : 'text-blue-400'}`}>
                {initialViewMode === 'biweekly' ? 'Quincenal' : 'Mensual'}
              </div>
            </div>
          </div>

          {(Object.keys(applicationTotals).length > 0 || applications.length > 0) && (
            <button
              onClick={() => setShowTransferSummary(true)}
              className="group flex items-center gap-3 bg-blue-600/10 hover:bg-blue-600/20 rounded-xl p-2 pr-4 border border-blue-500/20 transition-all active:scale-95"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <i className="fas fa-money-bill-transfer text-lg"></i>
              </div>
              <div className="text-left">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1 group-hover:text-blue-400 transition-colors">Transferencias</div>
                <div className="text-sm font-black text-white uppercase tracking-tight">Ver Resumen</div>
              </div>
            </button>
          )}
        </div>

        <div className="flex-1 flex justify-center w-full sm:w-auto">
          <DolarQuoteCard
            onApply={(rate) => onApplyDolarRate(rate, filterCategory)}
            pendingUsdCount={usdEntriesCount}
            scopeLabel={filterCategory === 'ALL' ? undefined : filterCategory}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-slate-400 text-sm font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">Filtrar por:</span>
            <select
              className={`${themeColors.input} flex-1 sm:flex-none w-full sm:w-auto rounded-xl px-4 py-2.5 text-white text-xs font-bold outline-none uppercase tracking-wide cursor-pointer hover:bg-white/5 transition-colors [&>option]:bg-slate-900 [&>option]:text-white`}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">Todas las Categorías</option>
              {Object.values(CategoryType).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {Object.values(CategoryType)
        .filter(cat => filterCategory === 'ALL' || cat === filterCategory)
        .map(cat => {
          const config = categoryConfig[cat];
          return (
            <div key={cat} className="space-y-4">
              <Card className="relative overflow-hidden group border-none" variant="glass" noPadding>
                {/* Header de Categoría con Gradiente Específico */}
                <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} opacity-50 group-hover:opacity-70 transition-opacity duration-500`}></div>
                <div className="relative z-10">
                  <div
                    className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 md:p-6 pb-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors select-none gap-4"
                    onClick={() => setCollapsedCategories(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(cat)) newSet.delete(cat);
                      else newSet.add(cat);
                      return newSet;
                    })}
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <i className={`fas fa-chevron-down text-slate-400 transition-transform duration-300 ${collapsedCategories.has(cat) ? '-rotate-90' : ''}`}></i>
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-900/50 backdrop-blur-sm border ${config.border} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <i className={`fas ${config.icon} text-lg md:text-xl ${config.color} drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg md:text-xl font-black text-white tracking-tight truncate">{cat}</h3>
                          <Tooltip
                            position="right"
                            useIcon
                            content={
                              cat === CategoryType.INCOME ? "Registra aquí todos tus ingresos fijos (Sueldo) y variables (Ventas, Changas)." :
                                cat === CategoryType.FIXED_EXPENSE ? "Gastos obligatorios que se repiten todos los meses (Alquiler, Internet, Seguros)." :
                                  cat === CategoryType.VARIABLE_EXPENSE ? "Gastos del día a día que varían mes a mes (Supermercado, Salidas, Regalos)." :
                                    cat === CategoryType.SHARED_EXPENSE ? "Gastos compartidos con grupos (Cenas, Viajes, Regalos). Aquí verás lo que debes y te deben." :
                                      cat === CategoryType.SAVINGS ? "Dinero reservado para metas futuras, fondo de emergencia o inversiones." :
                                        "Sección para administrar tus movimientos."
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:inline">Total del periodo</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest md:hidden">Total</span>
                          <div className="h-px w-8 bg-white/10 hidden md:block"></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-4 pl-8 md:pl-0">
                      <div className="space-y-1 w-24 md:w-32 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Presupuesto</label>
                        <input
                          type="number"
                          className="w-full bg-slate-900 rounded-lg md:rounded-xl p-2 border border-white/5 focus:border-blue-500 outline-none text-xs md:text-sm font-bold text-right"
                          placeholder="0"
                          value={categoryBudgets?.[cat] || ''}
                          onChange={(e) => onUpdateBudget(cat, parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="text-right flex-1 md:flex-none">
                        <p className={`text-xl md:text-2xl font-black ${config.color} drop-shadow-sm`}>
                          {formatMoney(currentTotals[cat] || 0)}
                        </p>
                      </div>

                      {cat !== CategoryType.SHARED_EXPENSE && (
                        <Button size="sm" variant="glass" className={`rounded-xl border ${config.border} hover:bg-white/10 flex-shrink-0`} onClick={(e) => {
                          e.stopPropagation();
                          setEditingEntry({
                            id: generateUUID(), name: '', amount: 0, category: cat, tag: categories[cat]?.[0] || 'General',
                            date: currentMonth + '-01', status: TransactionStatus.PENDING, paymentMethod: PaymentMethod.CASH,
                          })
                        }}>
                          <i className={`fas fa-plus md:mr-2 ${config.color}`}></i> <span className="hidden md:inline">Añadir</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tabla de Movimientos */}
                  {!collapsedCategories.has(cat) && (
                    <div className="p-0 animate-in slide-in-from-top-4 duration-300 overflow-x-auto">
                      {(() => {
                        const catEntries = currentBudgetEntries
                          .filter(e => e.category === cat)
                          .filter(e => {
                            if (viewMode === 'biweekly') {
                              // Show if explicitly biweekly, OR if it's a generated/common entry (no viewType or monthly)
                              // This ensures Installments and standard expenses appear in the list
                              return e.viewType === 'biweekly' || !e.viewType || e.viewType === 'monthly';
                            }
                            return !e.viewType || e.viewType === 'monthly';
                          })
                          .sort(sortEntries);

                        // Use custom SharedExpensesAPB component for shared expenses
                        if (cat === CategoryType.SHARED_EXPENSE) {
                          return (
                            <div className="px-1 py-4 lg:px-6 lg:py-6">
                              <SharedExpensesAPB sharedExpenses={catEntries} />
                            </div>
                          );
                        }

                        if (catEntries.length === 0) {
                          return (
                            <div className="px-8 py-12 text-center text-slate-500 font-bold italic opacity-50 border-t border-white/5">
                              No hay registros este mes
                            </div>
                          );
                        }

                        const sections = [];
                        if (viewMode === 'monthly') {
                          sections.push({ title: null, entries: catEntries, defaultDate: currentMonth + '-01' });
                        } else {
                          const firstQ: BudgetEntry[] = [];
                          const secondQ: BudgetEntry[] = [];

                          catEntries.forEach(entry => {
                            if (entry.subEntries && entry.subEntries.length > 0) {
                              const subQ1 = entry.subEntries.filter(s => {
                                if (!s.date) return false;
                                const d = parseInt(s.date.split('T')[0].split('-')[2]);
                                return d <= 15;
                              });
                              const subQ2 = entry.subEntries.filter(s => {
                                if (!s.date) return false;
                                const d = parseInt(s.date.split('T')[0].split('-')[2]);
                                return d > 15;
                              });

                              if (subQ1.length > 0) {
                                firstQ.push({
                                  ...entry,
                                  id: `${entry.id}-Q1`,
                                  amount: subQ1.reduce((sum, s) => sum + s.amount, 0),
                                  subEntries: subQ1
                                });
                              }
                              if (subQ2.length > 0) {
                                secondQ.push({
                                  ...entry,
                                  id: `${entry.id}-Q2`,
                                  amount: subQ2.reduce((sum, s) => sum + s.amount, 0),
                                  subEntries: subQ2
                                });
                              }
                            } else {
                              if (!entry.date) return;
                              const day = parseInt(entry.date.split('T')[0].split('-')[2]);
                              if (day <= 15) firstQ.push(entry);
                              else secondQ.push(entry);
                            }
                          });

                          sections.push({ title: '1ª Quincena (Días 1-15)', entries: firstQ, defaultDate: currentMonth + '-01' });
                          sections.push({ title: '2ª Quincena (Días 16-Fin de mes)', entries: secondQ, defaultDate: currentMonth + '-16' });
                        }

                        return (
                          <div className="flex flex-col gap-0">
                            {sections.map((section, idx) => {
                              // Mostrar siempre si hay entradas, o si es quincenal mostrar aunque esté vacía para permitir añadir
                              // Pero para mantener consistencia con "No hay registros" si todo está vacío, mejor manejamos eso arriba.
                              // Aquí: si es quincenal y está vacío, queremos mostrar el header para poder añadir?
                              // El código original retornaba null si entries.length === 0 && viewMode === 'biweekly' && idx > 0
                              // Vamos a permitir ver el header siempre en modo quincenal para poder añadir items a esa quincena

                              return (
                                <div key={idx} className={`${viewMode === 'biweekly' && idx > 0 ? 'mt-4' : ''}`}>
                                  {section.title && (
                                    <div className="px-6 py-2 bg-indigo-900/20 border-y border-white/5 backdrop-blur-sm flex justify-between items-center group/section">
                                      <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                                        <i className="fas fa-calendar-week"></i>
                                        {section.title}
                                      </h4>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingEntry({
                                            id: generateUUID(), name: '', amount: 0, category: cat, tag: categories[cat]?.[0] || 'General',
                                            date: section.defaultDate, status: TransactionStatus.PENDING, paymentMethod: PaymentMethod.CASH
                                          });
                                        }}
                                        className="opacity-0 group-hover/section:opacity-100 transition-opacity px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-[9px] font-black text-indigo-300 uppercase tracking-wider border border-indigo-500/30"
                                      >
                                        <i className="fas fa-plus mr-1"></i> Añadir
                                      </button>
                                    </div>
                                  )}
                                  <table className="w-full text-left border-collapse table-fixed lg:table-auto">
                                    <thead className="hidden lg:table-header-group bg-white/5 border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                      <tr>
                                        <th className="px-2 py-3 pl-4 lg:px-8 lg:py-4 lg:pl-10 w-auto lg:w-2/5">Concepto</th>
                                        <th className="hidden lg:table-cell px-8 py-4">Etiqueta</th>
                                        <th className="hidden lg:table-cell px-8 py-4">Método</th>
                                        <th className="hidden lg:table-cell px-8 py-4 text-center">Estado</th>
                                        <th className="px-2 py-3 lg:px-8 lg:py-4 text-right w-[90px] lg:w-auto">Monto</th>
                                        <th className="px-1 py-3 lg:px-8 lg:py-4 text-center w-[105px] lg:w-auto">Acciones</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {section.entries.map(e => {
                                        const isCredit = e.paymentMethod === PaymentMethod.CREDIT || e.installmentRef || e.subEntries;
                                        const isPaid = e.status === TransactionStatus.PAID;
                                        return (
                                          <tr
                                            key={e.id}
                                            draggable={true}
                                            onDragStart={(ev) => handleDragStart(ev, e)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDrop={(ev) => handleDrop(ev, e)}
                                            className={`group/row flex flex-col lg:table-row px-4 py-4 lg:p-0 border-b border-white/5 lg:border-none hover:bg-white/[0.03] transition-colors cursor-pointer ${isPaid ? 'bg-amber-500/10 border border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] z-10 relative my-2 rounded-xl mx-2 lg:mx-0' : isCredit ? 'bg-indigo-900/10' : ''} ${e.is_provisional ? 'border-2 border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10' : ''}`}
                                            onClick={() => {
                                              if (e.installmentRef) {
                                                setViewingInstallment(installmentPurchases.find(i => i.id === e.installmentRef) || null);
                                                return;
                                              }
                                              // Toggle expand para todas las filas (subEntries muestra subitems,
                                              // entries simples muestran detalle inline en mobile).
                                              const newExpanded = new Set(expandedRows);
                                              if (newExpanded.has(e.id)) newExpanded.delete(e.id);
                                              else newExpanded.add(e.id);
                                              setExpandedRows(newExpanded);
                                            }}>
                                            <td className={`block lg:table-cell p-0 lg:py-4 lg:pl-10 ${!isPaid && isCredit ? 'border-l-4 border-indigo-500' : ''}`}>
                                              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                                <div className="hidden lg:block mt-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 opacity-0 group-hover/row:opacity-100 transition-opacity" title="Arrastrar para reordenar">
                                                  <i className="fas fa-grip-vertical"></i>
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                  <div className="flex justify-between items-start lg:items-center gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      {e.subEntries ? (
                                                        <i className={`fas fa-chevron-right text-xs text-blue-500 transition-transform duration-300 ${expandedRows.has(e.id) ? 'rotate-90' : ''}`}></i>
                                                      ) : (
                                                        // Mobile-only chevron para indicar que la fila es expandible (tap → detalle).
                                                        <i className={`lg:hidden fas fa-chevron-right text-[10px] text-slate-500 transition-transform duration-300 ${expandedRows.has(e.id) ? 'rotate-90' : ''}`}></i>
                                                      )}
                                                      <span className="font-bold text-white group-hover/row:text-blue-400 transition-colors text-sm truncate">{e.name}</span>
                                                      {isCredit && <i className="fas fa-credit-card text-[10px] text-indigo-400 ml-1" title="Compra con Crédito"></i>}
                                                      {e.linkedIncomeId && (
                                                        <div className="flex items-center gap-1.5 ml-1">
                                                          <i className="fas fa-link text-[10px] text-blue-400" title="Vinculado a un Ingreso"></i>
                                                          {(() => {
                                                            const info = getLinkedIncomeInfo(e.linkedIncomeId);
                                                            if (!info) return null;
                                                            return (
                                                              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border-2 shadow-lg whitespace-nowrap leading-none ${info.bg} ${info.text} ${info.border}`}>
                                                                {info.name}
                                                              </span>
                                                            );
                                                          })()}
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Amount for Mobile (hidden on desktop) */}
                                                    <div className="lg:hidden text-right flex flex-col items-end">
                                                      <span className={`font-black text-sm ${isPaid ? 'text-amber-500/50 line-through' : 'text-white'}`}>{formatMoney(e.amount)}</span>
                                                      {e.currency && e.currency !== 'ARS' && e.originalAmount && (
                                                        <span className="text-[9px] font-black text-green-400 bg-green-400/10 px-1 py-0.5 rounded border border-green-400/20 mt-0.5">
                                                          {e.currency} {e.originalAmount.toFixed(2)}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-2 mt-1">
                                                    {!e.subEntries && (
                                                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{(() => {
                                                        if (!e.date) return '';
                                                        const parts = e.date.split('T')[0].split('-');
                                                        return `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                      })()}</span>
                                                    )}
                                                    {!!e.is_provisional && (
                                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                                                        <i className="fas fa-fw fa-clock text-[9px]"></i>
                                                        <span className="text-[9px] font-black uppercase tracking-wider">Proyectado</span>
                                                      </span>
                                                    )}
                                                  </div>

                                                  {/* Detalle inline para entries simples cuando se hace tap en mobile.
                                                      En desktop estos datos viven en columnas (Etiqueta, Método, Estado),
                                                      así que sólo se muestra en `<lg`. */}
                                                  {!e.subEntries && expandedRows.has(e.id) && (
                                                    <div className="lg:hidden mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] animate-in slide-in-from-top-2 duration-200">
                                                      <div className="flex flex-col gap-0.5">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Etiqueta</span>
                                                        <span className="font-bold text-slate-300 truncate">{e.tag || '—'}</span>
                                                      </div>
                                                      <div className="flex flex-col gap-0.5">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Método</span>
                                                        <span className="font-bold text-slate-300 flex items-center gap-1">
                                                          <i className={`fas ${e.paymentMethod === PaymentMethod.CASH ? 'fa-money-bill' : e.paymentMethod === PaymentMethod.CREDIT ? 'fa-credit-card' : 'fa-building-columns'} opacity-50 text-[10px]`}></i>
                                                          {e.paymentMethod}
                                                        </span>
                                                      </div>
                                                      {e.currency && e.currency !== 'ARS' && e.originalAmount && (
                                                        <div className="flex flex-col gap-0.5">
                                                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Origen</span>
                                                          <span className="font-bold text-emerald-400">
                                                            {e.currency} {e.originalAmount.toFixed(2)} × {e.exchangeRateActual || e.exchangeRateEstimated || '?'}
                                                          </span>
                                                        </div>
                                                      )}
                                                      {e.application && (
                                                        <div className="flex flex-col gap-0.5">
                                                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">App</span>
                                                          <span className="font-bold text-slate-300 truncate">{e.application}</span>
                                                        </div>
                                                      )}
                                                      {isPaid && (
                                                        <div className="flex flex-col gap-0.5 col-span-2">
                                                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estado</span>
                                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-md text-[10px] font-black uppercase tracking-wider w-fit">
                                                            <i className="fas fa-check"></i> Pagado
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}

                                                  {e.subEntries && expandedRows.has(e.id) && (
                                                    <div className="mt-3 pl-2 sm:pl-4 border-l-[3px] border-indigo-500/30 space-y-2.5 animate-in slide-in-from-top-2 duration-200 w-full lg:max-w-2xl pr-2 sm:pr-0">
                                                      {e.subEntries.map(sub => (
                                                        <div key={sub.id} className="bg-slate-800/60 border border-slate-700/50 shadow-sm text-xs text-slate-400 flex flex-col sm:flex-row sm:justify-between sm:items-center group/sub py-3 px-3 sm:px-4 rounded-xl -ml-1 sm:-ml-2 gap-3 sm:gap-0 hover:bg-slate-700/60 transition-colors w-full relative overflow-hidden">
                                                          {/* Left color accent line based on type */}
                                                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${sub.installmentRef ? 'bg-slate-600' : sub.category === CategoryType.INCOME ? 'bg-emerald-500' : 'bg-blue-500/50'}`}></div>
                                                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                            <div className="flex items-center gap-2">
                                                              {sub.installmentRef ? (
                                                                <span className="text-[9px] font-black bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-white/5 tracking-wider uppercase">Cuota {sub.currentInstallment}/{sub.totalInstallments}</span>
                                                              ) : sub.category === CategoryType.INCOME ? (
                                                                <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 tracking-wider uppercase">Ingreso</span>
                                                              ) : (
                                                                <span className="text-[9px] font-black text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded tracking-wider uppercase">Consumo</span>
                                                              )}
                                                            </div>
                                                            <span className={`group-hover/sub:text-white transition-colors truncate max-w-[150px] sm:max-w-none ${sub.category === CategoryType.INCOME ? 'text-emerald-400 font-bold' : ''}`}>
                                                              {sub.name.replace(/\s*\(Cuota \d+\/\d+\)/, '')}
                                                            </span>
                                                            {sub.linkedIncomeId && (
                                                              <div className="flex items-center gap-1.5 min-w-0">
                                                                <i className="fas fa-link text-[10px] text-blue-400/50"></i>
                                                                {(() => {
                                                                  const info = getLinkedIncomeInfo(sub.linkedIncomeId);
                                                                  if (!info) return null;
                                                                  return (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shadow-md whitespace-nowrap leading-none ${info.bg} ${info.text} ${info.border}`}>
                                                                      {info.name}
                                                                    </span>
                                                                  );
                                                                })()}
                                                              </div>
                                                            )}
                                                          </div>
                                                          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-1 sm:mt-0">
                                                            <span className={`font-mono flex items-center gap-2 ${sub.category === CategoryType.INCOME ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                                                              {sub.currency && sub.currency !== 'ARS' && sub.originalAmount && (
                                                                <span className="text-[10px] text-slate-400 font-semibold bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                                  {sub.currency} {sub.originalAmount.toFixed(2)}
                                                                </span>
                                                              )}
                                                              <span>{sub.category === CategoryType.INCOME ? '+' : ''}{formatMoney(sub.amount)}</span>
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                              {sub.installmentRef ? (
                                                                <button
                                                                  onClick={(ev) => { ev.stopPropagation(); setEditingEntry(sub); }}
                                                                  className="p-1 px-2 text-amber-500 hover:bg-amber-500/10 rounded transition-all border border-amber-500/10 flex items-center gap-1.5"
                                                                  title="Vincular ingreso a esta cuota"
                                                                >
                                                                  <i className="fas fa-link text-[10px]"></i>
                                                                  <span className="text-[9px] font-black uppercase">Vincular</span>
                                                                </button>
                                                              ) : (
                                                                <>
                                                                  <button
                                                                    onClick={(ev) => { ev.stopPropagation(); setEditingEntry(sub); }}
                                                                    className="p-1 px-2.5 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all border border-blue-500/20 shadow-sm"
                                                                    title="Editar consumo individual"
                                                                  >
                                                                    <i className="fas fa-pencil text-[10px]"></i>
                                                                  </button>
                                                                  <button
                                                                    onClick={(ev) => { ev.stopPropagation(); deleteEntry(sub.id); }}
                                                                    className="p-1 px-2.5 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all border border-rose-500/20 shadow-sm"
                                                                    title="Eliminar consumo"
                                                                  >
                                                                    <i className="fas fa-trash text-[10px]"></i>
                                                                  </button>
                                                                </>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                            <td className="hidden lg:table-cell px-8 py-4">
                                              {e.installmentRef && e.category !== CategoryType.SHARED_EXPENSE ? (
                                                <span className="inline-flex items-center px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-wide">
                                                  <i className="fas fa-clock mr-1.5"></i> Cuota {e.currentInstallment}/{e.totalInstallments}
                                                </span>
                                              ) : (
                                                <div className="flex flex-col items-start gap-1">
                                                  <span className={`inline-flex items-center px-2.5 py-1 ${e.category === CategoryType.SHARED_EXPENSE ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-white/5 text-slate-300 border-white/10'} border rounded-lg text-[10px] font-black uppercase tracking-wide group-hover/row:border-blue-500/30 transition-colors`}>
                                                    <i className={`fas ${e.category === CategoryType.SHARED_EXPENSE ? 'fa-user-tag' : 'fa-tag'} mr-1.5 opacity-50`}></i> {e.tag}
                                                  </span>
                                                  {e.installmentRef && e.category === CategoryType.SHARED_EXPENSE && (
                                                    <span className="text-[9px] font-mono text-slate-500 ml-1">
                                                      Cuota {e.currentInstallment}/{e.totalInstallments}
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                            <td className="hidden lg:table-cell px-8 py-4">
                                              <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                                <i className={`fas ${e.paymentMethod === PaymentMethod.CASH ? 'fa-money-bill' : e.paymentMethod === PaymentMethod.CREDIT ? 'fa-credit-card' : 'fa-building-columns'} opacity-50`}></i>
                                                {e.paymentMethod}
                                              </span>
                                            </td>
                                            <td className="hidden lg:table-cell px-8 py-4 text-center">
                                              {isPaid && (
                                                <span className="inline-flex items-center px-2.5 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                                  <i className="fas fa-check mr-1.5"></i> Pago
                                                </span>
                                              )}
                                            </td>
                                            <td className="hidden lg:table-cell px-2 py-3 lg:px-8 lg:py-4 text-right">
                                              <span className={`font-black text-sm ${isPaid ? 'text-amber-500/50 line-through decoration-2' : 'text-white'}`}>{formatMoney(e.amount)}</span>
                                              {e.currency && e.currency !== 'ARS' && e.originalAmount && (
                                                <div className="flex flex-col items-end mt-1 animate-in slide-in-from-right-2 duration-300">
                                                  <span className="text-[10px] font-black text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded border border-green-400/20">
                                                    {e.currency} {e.originalAmount.toFixed(2)}
                                                  </span>
                                                  <span className="text-[9px] font-bold text-slate-500 mt-0.5">
                                                    x {e.exchangeRateActual || e.exchangeRateEstimated}
                                                  </span>
                                                </div>
                                              )}
                                            </td>
                                            <td className="block lg:table-cell p-0 lg:px-8 lg:py-4">
                                              <div className="flex justify-between items-center lg:justify-center mt-3 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-none border-white/5">
                                                {/* Tag/Badge for mobile (hidden on desktop because it has its own column) */}
                                                <div className="lg:hidden">
                                                  <span className={`inline-flex items-center px-2 py-0.5 ${e.category === CategoryType.SHARED_EXPENSE ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-white/5 text-slate-500 border-white/10'} border rounded-md text-[9px] font-black uppercase tracking-wider`}>
                                                    <i className={`fas ${e.category === CategoryType.SHARED_EXPENSE ? 'fa-user-tag' : 'fa-tag'} mr-1 opacity-50`}></i> {e.tag}
                                                  </span>
                                                </div>

                                                <div className="flex justify-end gap-2 lg:gap-2 lg:opacity-0 group-hover/row:opacity-100 transition-opacity transform lg:translate-x-2 lg:group-hover/row:translate-x-0 duration-300">
                                                  <button
                                                    onClick={(ev) => { ev.stopPropagation(); onPayEntry(e); }}
                                                    className="w-9 h-9 lg:h-8 lg:w-auto lg:px-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white border border-amber-500/30 shadow-amber-500/10"
                                                    title={isPaid ? "Deshacer pago" : "Marcar como Pagado"}
                                                  >
                                                    <i className={`fas ${isPaid ? 'fa-undo' : 'fa-check-double'} text-xs`}></i>
                                                    <span className="text-[10px] font-black uppercase tracking-wider hidden xl:inline">
                                                      {isPaid ? 'Deshacer' : 'Pague'}
                                                    </span>
                                                  </button>
                                                  {!!e.is_provisional && (
                                                    <button onClick={(ev) => { ev.stopPropagation(); onConfirmEntry(e); }} className="w-9 h-9 lg:w-8 lg:h-8 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-lg hover:shadow-amber-500/30 flex items-center justify-center" title="Confirmar movimiento">
                                                      <i className="fas fa-check text-xs"></i>
                                                    </button>
                                                  )}
                                                  {!e.installmentRef && !e.id.startsWith('card-agg-') && (
                                                    <>
                                                      <button onClick={(ev) => { ev.stopPropagation(); setEditingEntry(e); }} className={`w-9 h-9 lg:w-8 lg:h-8 rounded-xl ${themeColors.iconBg} hover:bg-opacity-100 hover:text-white transition-all shadow-lg flex items-center justify-center`} title="Editar movimiento"><i className="fas fa-pencil text-xs"></i></button>
                                                      <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }} className="w-9 h-9 lg:w-8 lg:h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg hover:shadow-rose-500/30 flex items-center justify-center" title="Eliminar movimiento"><i className="fas fa-trash text-xs"></i></button>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          );
        })}

      {/* Footer Total Consumo - Desktop: Full Card, Mobile: Sticky Floating Badge */}

      {/* Desktop Version - Full Card */}
      <Card variant="glass" className="hidden md:block border border-white/10 mt-8 relative overflow-hidden group">
        <div className={`absolute inset-0 ${themeColors.card} opacity-90`}></div>
        <div className="absolute -right-10 -bottom-10 text-white/5 rotate-12 transform scale-150">
          <i className="fas fa-coins text-9xl"></i>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center p-6 gap-4">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <i className="fas fa-sack-dollar text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-wide">Total Consumo</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                {filterCategory === 'ALL' ? 'Suma de todos los módulos' : `Total en ${filterCategory}`}
              </p>
            </div>
          </div>

          <div className="flex-1"></div>

          <div className="text-right bg-black/20 px-8 py-4 rounded-2xl border border-white/5 backdrop-blur-sm">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Monto Total</p>
            <p className="text-4xl font-black text-white tracking-tight">{formatMoney(totalConsumption)}</p>
            {(() => {
              const projectedTotalConsumption = Object.values(CategoryType)
                .filter(cat => cat !== CategoryType.INCOME)
                .filter(cat => filterCategory === 'ALL' || cat === filterCategory)
                .reduce((acc, cat) => {
                  const catEntries = currentBudgetEntries.filter(e => e.category === cat);
                  return acc + catEntries.reduce((sum, e) => sum + e.amount, 0);
                }, 0);

              if (projectedTotalConsumption !== totalConsumption) {
                return (
                  <div className="mt-2 pt-2 border-t border-white/5 animate-in slide-in-from-right-2 text-right">
                    <div className="flex items-center justify-end gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Proyectado</span>
                      <Tooltip content="Total de consumo estimado incluyendo todos los movimientos provisorios." position="left" useIcon />
                    </div>
                    <p className="text-xl font-black text-amber-500">{formatMoney(projectedTotalConsumption)}</p>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </Card>

      {/* Mobile Version - Sticky Floating Badge */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 animate-in slide-in-from-bottom-4">
        <div className={`glass rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl ${themeColors.card}`}>
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.3)] flex-shrink-0">
                <i className="fas fa-sack-dollar text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Gastos Totales</p>
                <p className="text-2xl font-black text-white tracking-tight">{formatMoney(totalConsumption)}</p>
              </div>
            </div>
            <div className="flex-1"></div>
          </div>
        </div>
      </div>


      {/* Modal Resumen de Transferencias */}
      {showTransferSummary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card 
            title="Saldos a Transferir" 
            className="w-full max-w-md shadow-2xl border-white/10 overflow-hidden" 
            noPadding
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white text-xl">
                  <i className="fas fa-building-columns"></i>
                </div>
                <div>
                   <h4 className="font-black text-white uppercase tracking-wide">Resumen por App</h4>
                   <p className="text-slate-400 text-xs font-medium">Dinero que debes mover a cada cuenta</p>
                </div>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(applicationTotals).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-500">
                      <i className="fas fa-receipt text-2xl"></i>
                    </div>
                    <div>
                      <p className="text-white font-bold">Sin transferencias</p>
                      <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest">No hay gastos vinculados a aplicaciones en este periodo</p>
                    </div>
                  </div>
                ) : (
                  Object.entries(applicationTotals).map(([app, total]) => (
                    <div key={app} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                          <i className="fas fa-mobile-screen-button text-xs"></i>
                        </div>
                        <span className="font-black text-sm text-white uppercase tracking-widest">{app}</span>
                      </div>
                      <span className="font-black text-blue-400 text-lg">{formatMoney(total)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                <div className="flex justify-between items-center px-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Vinculado</span>
                  <span className="font-black text-white">{formatMoney(Object.values(applicationTotals).reduce((a, b) => a + b, 0))}</span>
                </div>
                <Button className="w-full rounded-xl py-4 mt-2" onClick={() => setShowTransferSummary(false)}>Cerrar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
