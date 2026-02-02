import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PartyView } from './views/PartyView';
import { InvitationModal } from './components/InvitationModal';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid, PieChart, Pie, Sector, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  CategoryType, BudgetEntry, AppState,
  TransactionStatus, PaymentMethod, SavingsGoal, InstallmentPurchase,
  DEFAULT_CATEGORY_MAP
} from './types';
import { InstallmentModal } from './components/InstallmentModal';
import { EntryModal } from './components/EntryModal';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Layout } from './components/Layout';
import { DashboardView } from './views/DashboardView';
import { PresupuestoView } from './views/PresupuestoView';
import { AnnualView } from './views/AnnualView';
import { TarjetasView } from './views/TarjetasView';
import { MetasView } from './views/MetasView';
import { ConfigView } from './views/ConfigView';
import { PrivacyView } from './views/PrivacyView';
import { TermsView } from './views/TermsView';
import { LandingView } from './views/LandingView';
import { APP_TITLE_PREFIX, APP_TITLE_SUFFIX, APP_SUBTITLE } from './config/constants';
import { parseDocument } from './services/geminiService';
import { api } from './services/api';
import { exportToExcel } from './utils/excelExport';
import { generateUUID } from './utils/helpers';
import { OnboardingModal } from './components/OnboardingModal';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loadingData, setLoadingData] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // Desktop sidebar state

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    window.location.reload();
  };

  // --- ESTADO GLOBAL ---
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('finanzas_pro_v4_ultimate');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure config exists
        if (!parsed.config) {
          parsed.config = {
            currency: '$',
            userName: 'Usuario',
            categories: DEFAULT_CATEGORY_MAP
          };
        } else {
          // Ensure categories are merged with defaults if missing
          parsed.config.categories = { ...DEFAULT_CATEGORY_MAP, ...parsed.config.categories };

          // Restore defaults if specific categories are empty (as requested by user)
          Object.keys(DEFAULT_CATEGORY_MAP).forEach(k => {
            const key = k as CategoryType;
            if (!parsed.config.categories[key] || parsed.config.categories[key].length === 0) {
              parsed.config.categories[key] = DEFAULT_CATEGORY_MAP[key];
            }
          });
        }
        return parsed;
      } catch (e) {
        console.error("Error loading state", e);
      }
    }
    return {
      budgets: {},
      goals: [],
      installmentPurchases: [],
      currentMonth: new Date().toISOString().slice(0, 7),
      config: {
        currency: '$',
        userName: 'Usuario',
        categories: DEFAULT_CATEGORY_MAP
      }
    };
  });

  // --- ESTADOS DE UI ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'presupuesto' | 'tarjetas' | 'metas' | 'config' | 'admin' | 'annual' | 'party'>(() => {
    const saved = localStorage.getItem('finanzas_pro_ui_state');
    if (saved) {
      try {
        return JSON.parse(saved).activeTab || 'dashboard';
      } catch {
        return 'dashboard';
      }
    }
    return 'dashboard';
  });
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentPurchase | null>(null);
  const [viewingInstallment, setViewingInstallment] = useState<InstallmentPurchase | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EXPANDED ROWS STATE ---
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // --- PRIVACY MODE ---
  const [privacyMode, setPrivacyMode] = useState(false);

  // --- COLLAPSED CATEGORIES ---
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const formatMoney = (amount: number) => {
    if (privacyMode) return '****';
    return state.config.currency + amount.toLocaleString();
  };

  // --- PENDING INVITES STATE ---
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  // --- SYNC WITH DB ---
  useEffect(() => {
    if (!user) return;

    const initData = async () => {
      setLoadingData(true);
      try {
        const data = await api.syncData();

        // Fetch pending invites
        try {
          const invites = await api.getInvitations();
          setPendingInvitesCount(invites.length);
        } catch (e) {
          console.error("Error fetching invites", e);
        }

        if (data) {
          const hasDbData = data.entries.length > 0 || data.goals.length > 0 || data.installments.length > 0 || data.config || (data.categoryBudgets && data.categoryBudgets.length > 0);

          if (hasDbData) {
            const newBudgets: Record<string, any> = {};
            data.entries.forEach((e: any) => {
              if (!newBudgets[e.month_year]) newBudgets[e.month_year] = { month: e.month_year, entries: [] };
              newBudgets[e.month_year].entries.push(e);
            });

            const budgetsMap: Record<string, number> = {};
            if (data.categoryBudgets) {
              data.categoryBudgets.forEach((b: any) => {
                budgetsMap[b.category] = b.amount;
              });
            }

            setState(prev => {
              const mergedConfig = data.config ? { ...prev.config, ...data.config } : prev.config;

              // Ensure categories are merged with defaults if missing (even after DB sync)
              if (mergedConfig.categories) {
                mergedConfig.categories = { ...DEFAULT_CATEGORY_MAP, ...mergedConfig.categories };
                Object.keys(DEFAULT_CATEGORY_MAP).forEach(k => {
                  const key = k as CategoryType;
                  if (!mergedConfig.categories[key] || mergedConfig.categories[key].length === 0) {
                    mergedConfig.categories[key] = DEFAULT_CATEGORY_MAP[key];
                  }
                });
              }

              return {
                ...prev,
                budgets: newBudgets,
                goals: data.goals,
                installmentPurchases: data.installments,
                categoryBudgets: budgetsMap,
                config: mergedConfig
              };
            });
          } else {
            // DB vacío, migrar datos locales si existen
            Object.values(state.budgets).forEach(b => {
              b.entries.forEach(e => api.saveEntry(e));
            });
            state.goals.forEach(g => api.saveGoal(g));
            state.installmentPurchases.forEach(i => api.saveInstallment(i));
            api.saveConfig(state.config);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoadingData(false);
      }
    };
    initData();
  }, [user]);

  // Sync Config changes
  useEffect(() => {
    if (!user) return; // Only sync if user is logged in
    const timeout = setTimeout(() => {
      api.saveConfig(state.config);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [state.config, user]);

  // --- PERSISTENCIA ---
  useEffect(() => {
    localStorage.setItem('finanzas_pro_v4_ultimate', JSON.stringify(state));
  }, [state]);

  // --- PERSISTENCIA UI ---
  useEffect(() => {
    localStorage.setItem('finanzas_pro_ui_state', JSON.stringify({ activeTab }));
  }, [activeTab]);

  // --- LÓGICA DE TIEMPO (AISLAMIENTO ANUAL/MENSUAL) ---
  const currentYear = useMemo(() => state.currentMonth.split('-')[0], [state.currentMonth]);
  const currentMonthNum = useMemo(() => {
    if (activeTab === 'annual') return 'annual';
    return state.currentMonth.split('-')[1];
  }, [state.currentMonth, activeTab]);

  // --- CÁLCULOS DINÁMICOS ---
  const currentBudgetEntries = useMemo(() => {
    const manualEntries = state.budgets[state.currentMonth]?.entries || [];

    // Crear un Set con los IDs de las entradas manuales para evitar duplicados
    const manualEntryIds = new Set(manualEntries.map(e => e.id));

    // 1. Extraer orden guardado de las agregaciones de tarjetas
    const savedCardOrders = new Map<string, number>();
    manualEntries.forEach(e => {
      if (e.id.startsWith('card-agg-') && e.order !== undefined) {
        savedCardOrders.set(e.id, e.order);
      }
    });

    // Filtrar entradas activas (no borradas)
    // Excluir agregaciones existentes para regenerarlas
    const activeManualEntries = manualEntries.filter(e => !e.deleted && !e.id.startsWith('card-agg-'));

    // Separar manuales: 
    // - manualOtherEntries: Todo lo que NO es crédito, O lo que es crédito pero es INGRESO (para que aparezca en Ingresos)
    const manualOtherEntries = activeManualEntries.filter(e =>
      e.paymentMethod !== PaymentMethod.CREDIT || e.category === CategoryType.INCOME
    );

    // - manualCreditEntries: Todo lo que es crédito (incluyendo ingresos, para agregarlos al detalle de la tarjeta)
    const manualCreditEntries = activeManualEntries.filter(e => e.paymentMethod === PaymentMethod.CREDIT);

    // Generar cuotas automáticas para el mes actual
    const installmentEntries: BudgetEntry[] = [];

    // Estructura de acumulación: Clave = CardName + Category
    const accumulatedByCardAndCat: Record<string, {
      total: number,
      items: BudgetEntry[],
      cardName: string,
      category: CategoryType
    }> = {};

    // Helper para acumular
    const addToAccumulator = (entry: BudgetEntry, cardName: string) => {
      // Usar la categoría de la entrada, excepto para ingresos que van al grupo de Variables (o donde corresponda)
      // para visualizarlos junto con los consumos, pero SIN sumar al total de gastos.
      // Si es ingreso, lo metemos en VARIABLE_EXPENSE por defecto para que se vea en el detalle de la tarjeta.
      const targetCategory = entry.category === CategoryType.INCOME ? CategoryType.VARIABLE_EXPENSE : entry.category;

      const normalizedCardName = cardName.trim().toUpperCase();
      const key = `${normalizedCardName}-${targetCategory}`;

      if (!accumulatedByCardAndCat[key]) {
        accumulatedByCardAndCat[key] = {
          total: 0,
          items: [],
          cardName: cardName, // Keep the first encountered casing for display, or could normalize 
          category: targetCategory
        };
      }

      accumulatedByCardAndCat[key].items.push(entry);

      // SOLO sumamos al total si NO es ingreso. 
      // Si es ingreso, no restamos ni sumamos aquí porque ya está contabilizado en manualOtherEntries como ingreso positivo.
      // Si restáramos aquí, duplicaríamos el beneficio en el flujo neto (Ingreso + Reducción de Gasto).
      if (entry.category !== CategoryType.INCOME) {
        accumulatedByCardAndCat[key].total += entry.amount;
      }
    };

    // Procesar Cuotas (Installments)
    state.installmentPurchases.forEach(p => {
      const [startYear, startMonth] = p.startDate.split('-').map(Number);
      const [currYear, currMonth] = state.currentMonth.split('-').map(Number);

      const totalMonthsPassed = (currYear - startYear) * 12 + (currMonth - startMonth);

      if (totalMonthsPassed >= 0 && totalMonthsPassed < p.installments) {
        const generatedId = `inst-${p.id}-${state.currentMonth}`;

        // Si ya existe una entrada manual con este ID, NO la generamos de nuevo
        if (manualEntryIds.has(generatedId)) return;

        const amount = p.totalAmount / p.installments;
        const entry: BudgetEntry = {
          id: generatedId,
          name: `${p.name} (Cuota ${totalMonthsPassed + 1}/${p.installments})`,
          amount: amount,
          category: p.category, // Respetar categoría original (Fijo/Variable)
          tag: p.tag,
          date: state.currentMonth + '-01',
          status: TransactionStatus.PENDING,
          paymentMethod: PaymentMethod.CREDIT,
          installmentRef: p.id,
          currentInstallment: totalMonthsPassed + 1,
          totalInstallments: p.installments
        };

        let targetCard = p.cardName;
        if (!targetCard) {
          targetCard = (state.config.creditCards && state.config.creditCards.length === 1)
            ? state.config.creditCards[0]
            : (Object.keys(accumulatedByCardAndCat).length > 0 ? accumulatedByCardAndCat[Object.keys(accumulatedByCardAndCat)[0]].cardName : 'Otros');
        }

        addToAccumulator(entry, targetCard);
      }
    });

    // Procesar Entradas Manuales de Crédito
    manualCreditEntries.forEach(e => {
      let targetCard = e.cardName;
      if (!targetCard) {
        targetCard = (state.config.creditCards && state.config.creditCards.length === 1)
          ? state.config.creditCards[0]
          : 'Otros'; // Default a Otros si no se puede inferir
      }
      addToAccumulator(e, targetCard);
    });

    // Generar Entradas Agrupadas
    Object.entries(accumulatedByCardAndCat).forEach(([key, data]) => {
      // Ordenar items
      data.items.sort((a, b) => {
        const remA = a.totalInstallments ? (a.totalInstallments - (a.currentInstallment || 0)) : 999;
        const remB = b.totalInstallments ? (b.totalInstallments - (b.currentInstallment || 0)) : 999;
        return remA - remB;
      });

      const aggId = `card-agg-${key}-${state.currentMonth}`;

      const categoryLabel = data.category === CategoryType.FIXED_EXPENSE ? ' (Fijos)' : '';

      installmentEntries.push({
        id: aggId,
        name: data.cardName === 'Otros' ? `Consumo Tarjeta${categoryLabel}` : `Consumo ${data.cardName}${categoryLabel}`,
        amount: data.total,
        category: data.category, // Respetar categoría (Fijo o Variable)
        tag: 'Tarjeta de Crédito',
        order: savedCardOrders.get(aggId),
        date: state.currentMonth + '-01',
        status: TransactionStatus.PENDING,
        paymentMethod: PaymentMethod.CREDIT,
        subEntries: data.items,
        cardName: data.cardName
      });
    });

    return [...manualOtherEntries, ...installmentEntries];
  }, [state.budgets, state.currentMonth, state.installmentPurchases, state.config.creditCards]);

  const confirmedTotals = useMemo(() => {
    return currentBudgetEntries
      .filter(e => !e.is_provisional)
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<CategoryType, number>);
  }, [currentBudgetEntries]);

  const projectedTotals = useMemo(() => {
    return currentBudgetEntries.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<CategoryType, number>);
  }, [currentBudgetEntries]);

  // Compatibility alias for existing components that expect 'currentTotals'
  const currentTotals = confirmedTotals;

  const netFlow = useMemo(() => {
    const income = confirmedTotals[CategoryType.INCOME] || 0;
    const expense = (confirmedTotals[CategoryType.FIXED_EXPENSE] || 0) +
      (confirmedTotals[CategoryType.VARIABLE_EXPENSE] || 0) +
      (confirmedTotals[CategoryType.DEBT] || 0) +
      (confirmedTotals[CategoryType.SAVINGS] || 0);
    return income - expense;
  }, [confirmedTotals]);

  const projectedNetFlow = useMemo(() => {
    const income = projectedTotals[CategoryType.INCOME] || 0;
    const expense = (projectedTotals[CategoryType.FIXED_EXPENSE] || 0) +
      (projectedTotals[CategoryType.VARIABLE_EXPENSE] || 0) +
      (projectedTotals[CategoryType.DEBT] || 0) +
      (projectedTotals[CategoryType.SAVINGS] || 0);
    return income - expense;
  }, [projectedTotals]);

  const totalGoalsSaved = useMemo(() => {
    return state.goals.reduce((acc, g) => acc + g.currentAmount, 0);
  }, [state.goals]);

  // --- CHART STATE ---
  const [activeIndex, setActiveIndex] = useState(0);
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const trendData = useMemo(() => {
    const data = [];
    const [year, month] = state.currentMonth.split('-').map(Number);

    // Generar últimos 6 meses (incluyendo el actual)
    for (let i = 5; i >= 0; i--) {
      // Calcular fecha
      let y = year;
      let m = month - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      const mStr = `${y}-${m.toString().padStart(2, '0')}`;

      const d = new Date(y, m - 1, 1);
      const monthName = d.toLocaleString('es-ES', { month: 'short' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const budget = state.budgets[mStr];
      let inc = 0;
      let exp = 0;

      if (budget) {
        budget.entries.forEach(e => {
          if (e.category === CategoryType.INCOME) inc += e.amount;
          else if (e.category !== CategoryType.SAVINGS) exp += e.amount;
        });
      }

      // Si es el mes actual y no hay datos históricos, usar currentTotals
      if (i === 0 && !budget) {
        inc = currentTotals[CategoryType.INCOME] || 0;
        exp = (currentTotals[CategoryType.FIXED_EXPENSE] || 0) +
          (currentTotals[CategoryType.VARIABLE_EXPENSE] || 0) +
          (currentTotals[CategoryType.DEBT] || 0);
      }

      data.push({
        name: capitalizedMonth,
        Ingresos: inc,
        Gastos: exp
      });
    }
    return data;
  }, [state.budgets, state.currentMonth, currentTotals]);

  // --- HANDLERS ---
  const saveEntry = async (entry: BudgetEntry) => {
    try {
      await api.saveEntry(entry);

      // Calcular actualizaciones de metas antes de actualizar el estado
      const oldEntry = state.budgets[state.currentMonth]?.entries.find(e => e.id === entry.id);
      const goalsToUpdate = new Map<string, SavingsGoal>();

      const getGoal = (id: string) => {
        if (goalsToUpdate.has(id)) return goalsToUpdate.get(id)!;
        const g = state.goals.find(g => g.id === id);
        return g ? { ...g } : null;
      };

      // Revertir impacto de la entrada anterior
      if (oldEntry && oldEntry.goalId) {
        const g = getGoal(oldEntry.goalId);
        if (g) {
          g.currentAmount = Math.max(0, g.currentAmount - oldEntry.amount);
          goalsToUpdate.set(g.id, g);
        }
      }

      // Aplicar impacto de la nueva entrada
      if (entry.goalId) {
        const g = getGoal(entry.goalId);
        if (g) {
          g.currentAmount += entry.amount;
          goalsToUpdate.set(g.id, g);
        }
      }

      setState(prev => {
        const monthData = prev.budgets[prev.currentMonth] || { month: prev.currentMonth, entries: [] };
        const exists = monthData.entries.find(e => e.id === entry.id);
        const newEntries = exists
          ? monthData.entries.map(e => e.id === entry.id ? entry : e)
          : [...monthData.entries, entry];

        const newGoals = prev.goals.map(g => goalsToUpdate.has(g.id) ? goalsToUpdate.get(g.id)! : g);

        return {
          ...prev,
          budgets: { ...prev.budgets, [prev.currentMonth]: { ...monthData, entries: newEntries } },
          goals: newGoals
        };
      });
      setEditingEntry(null);
      goalsToUpdate.forEach(g => api.saveGoal(g));

    } catch (e: any) {
      console.error("Failed to save entry:", e);
      alert("Error al guardar el movimiento: " + (e.message || "Error desconocido"));
    }
  };

  const deleteEntry = (id: string) => {
    const isGenerated = id.startsWith('inst-') || id.startsWith('card-agg-');

    // Helper function to find entry (recursive)
    const findEntryRecursive = (entries: BudgetEntry[], targetId: string): BudgetEntry | undefined => {
      for (const entry of entries) {
        if (entry.id === targetId) return entry;
        if (entry.subEntries) {
          const found = findEntryRecursive(entry.subEntries, targetId);
          if (found) return found;
        }
      }
      return undefined;
    };

    // Actualizar metas si es necesario
    // Use recursive find to locate the entry even if it's nested
    const entryToDelete = findEntryRecursive(state.budgets[state.currentMonth]?.entries || [], id);

    const goalsToUpdate = new Map<string, SavingsGoal>();

    if (entryToDelete && entryToDelete.goalId) {
      const g = state.goals.find(g => g.id === entryToDelete.goalId);
      if (g) {
        const updatedGoal = { ...g, currentAmount: Math.max(0, g.currentAmount - entryToDelete.amount) };
        goalsToUpdate.set(g.id, updatedGoal);
      }
    }

    setState(prev => {
      const currentBudget = prev.budgets[prev.currentMonth] || { month: prev.currentMonth, entries: [] };
      let newEntries;

      if (isGenerated) {
        // If it's a generated ID, we mark it as deleted. 
        // We need to check if it exists in the persisted entries.
        const existingEntry = currentBudget.entries.find(e => e.id === id);

        if (existingEntry) {
          // It's already in the DB/State, mark as deleted
          newEntries = currentBudget.entries.map(e => e.id === id ? { ...e, deleted: true } : e);
        } else {
          // It's not in DB yet (dynamic), but we want to delete it.
          // We need to find it in the CALCULATED currentBudgetEntries to get its data
          // and add it to state as "deleted" so it doesn't show up next time.
          const itemToDelete = findEntryRecursive(currentBudgetEntries, id);

          if (itemToDelete) {
            // We add it to the state explicitly marked as deleted
            newEntries = [...currentBudget.entries, { ...itemToDelete, deleted: true }];
          } else {
            // Can't find it, nothing to do
            newEntries = currentBudget.entries;
          }
        }
      } else {
        // Standard manual entry, just filter it out
        newEntries = currentBudget.entries.filter(e => e.id !== id);
      }

      const newGoals = prev.goals.map(g => goalsToUpdate.has(g.id) ? goalsToUpdate.get(g.id)! : g);

      return {
        ...prev,
        budgets: {
          ...prev.budgets,
          [prev.currentMonth]: {
            ...currentBudget,
            entries: newEntries
          }
        },
        goals: newGoals
      };
    });

    if (isGenerated) {
      // Logic for generated items (like installments)
      // Check if we need to call API to save this "deletion" state
      const itemToDelete = findEntryRecursive(currentBudgetEntries, id);
      if (itemToDelete) {
        api.saveEntry({ ...itemToDelete, deleted: true });
      }
    } else {
      // Standard deletion
      api.deleteEntry(id);
    }
    goalsToUpdate.forEach(g => api.saveGoal(g));
  };

  const handleReorderEntries = (reorderedEntries: BudgetEntry[]) => {
    setState(prev => {
      const monthData = prev.budgets[prev.currentMonth] || { month: prev.currentMonth, entries: [] };
      const orderMap = new Map(reorderedEntries.map(e => [e.id, e.order]));

      // 1. Update existing manual entries
      const updatedManualEntries = monthData.entries.map(e => {
        if (orderMap.has(e.id)) {
          return { ...e, order: orderMap.get(e.id) };
        }
        return e;
      });

      // 2. Identify new entries to materialize (generated entries that are now being reordered)
      const existingIds = new Set(monthData.entries.map(e => e.id));
      const entriesToMaterialize = reorderedEntries.filter(e => !existingIds.has(e.id));

      return {
        ...prev,
        budgets: {
          ...prev.budgets,
          [prev.currentMonth]: {
            ...monthData,
            entries: [...updatedManualEntries, ...entriesToMaterialize]
          }
        }
      };
    });
    reorderedEntries.forEach(entry => api.saveEntry(entry));
  };

  const saveInstallment = (p: InstallmentPurchase) => {
    setState(prev => {
      const exists = prev.installmentPurchases.find(i => i.id === p.id);
      return {
        ...prev,
        installmentPurchases: exists
          ? prev.installmentPurchases.map(i => i.id === p.id ? p : i)
          : [...prev.installmentPurchases, p]
      };
    });
    setEditingInstallment(null);
    api.saveInstallment(p);
  };

  const deleteInstallment = (id: string) => {
    setState(prev => ({ ...prev, installmentPurchases: prev.installmentPurchases.filter(i => i.id !== id) }));
    api.deleteInstallment(id);
  };

  const handleUpdateBudget = (category: string, amount: number) => {
    setState(prev => ({
      ...prev,
      categoryBudgets: {
        ...prev.categoryBudgets,
        [category]: amount
      }
    }));
    api.saveCategoryBudget(category, amount);
  };

  const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await parseDocument(base64, file.type);

        const newEntries: BudgetEntry[] = result.items.map(item => ({
          id: generateUUID(),
          name: item.name,
          amount: item.amount,
          category: item.category as CategoryType,
          tag: item.tag,
          date: new Date().toISOString().slice(0, 10),
          status: TransactionStatus.PAID,
          paymentMethod: PaymentMethod.DEBIT
        }));

        setState(prev => {
          const current = prev.budgets[prev.currentMonth] || { month: prev.currentMonth, entries: [] };
          return {
            ...prev,
            budgets: {
              ...prev.budgets,
              [prev.currentMonth]: { ...current, entries: [...current.entries, ...newEntries] }
            }
          };
        });
        alert(`¡Éxito! Se han importado ${newEntries.length} movimientos.`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert("Error al procesar el documento con IA.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCardRenames = (renames: Record<string, string>) => {
    setState(prev => {
      // 1. Update Installment Purchases
      const updatedInstallments = prev.installmentPurchases.map(p => {
        if (p.cardName && renames[p.cardName]) {
          const updated = { ...p, cardName: renames[p.cardName] };
          api.saveInstallment(updated);
          return updated;
        }
        return p;
      });

      // 2. Update Budgets (Entries)
      const updatedBudgets = { ...prev.budgets };
      Object.keys(updatedBudgets).forEach(monthKey => {
        const monthBudget = updatedBudgets[monthKey];
        let monthModified = false;
        const newEntries = monthBudget.entries.map(e => {
          if (e.cardName && renames[e.cardName]) {
            monthModified = true;
            const updated = { ...e, cardName: renames[e.cardName] };
            api.saveEntry(updated);
            return updated;
          }
          return e;
        });

        if (monthModified) {
          updatedBudgets[monthKey] = { ...monthBudget, entries: newEntries };
        }
      });

      return {
        ...prev,
        installmentPurchases: updatedInstallments,
        budgets: updatedBudgets
      };
    });
  };

  const usedCardNames = useMemo(() => {
    const names = new Set<string>();
    state.installmentPurchases.forEach(p => {
      if (p.cardName) names.add(p.cardName);
    });
    Object.values(state.budgets).forEach(budget => {
      budget.entries.forEach(e => {
        if (e.cardName) names.add(e.cardName);
      });
    });
    return Array.from(names);
  }, [state.installmentPurchases, state.budgets]);

  const handleExportExcel = () => {
    exportToExcel({
      currentMonth: state.currentMonth,
      currentTotals,
      netFlow,
      totalGoalsSaved,
      currentBudgetEntries
    });
  };

  // --- ROUTING ---
  const currentPath = window.location.pathname;
  if (currentPath === '/privacy') return <PrivacyView />;
  if (currentPath === '/terminos') return <TermsView />;

  // Si no hay usuario, mostrar Landing o Login Manual
  if (!user) {
    if (currentPath === '/login-manual') {
      return <Login onLogin={setUser} />;
    }
    return <LandingView onLogin={setUser} />;
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold animate-pulse">Cargando tus finanzas...</p>
        </div>
      </div>
    );
  }
  // --- ADMIN BREADCRUMB ---
  // --- APP BREADCRUMB ---
  const adminBreadcrumb = (
    <div className="bg-[#1e1e1e] rounded-lg border border-white/10 text-xs text-gray-400 p-2 font-mono flex items-center gap-1 select-all shadow-lg w-fit">
      <span className="text-blue-400">Inicio</span>
      {activeTab === 'dashboard' && <span className="text-purple-400"> &gt; Dashboard</span>}
      {activeTab === 'party' && (
        <>
          <span>&gt;</span>
          <span className="text-purple-400">Gastos en Grupo</span>
          <span>&gt;</span>
          <span className="text-white font-bold">Detalle de Grupo</span>
        </>
      )}
      {activeTab === 'presupuesto' && <span className="text-purple-400"> &gt; Movimientos</span>}
      {activeTab === 'annual' && <span className="text-purple-400"> &gt; Vista Anual</span>}
      {activeTab === 'tarjetas' && <span className="text-purple-400"> &gt; Cuotas / Tarjetas</span>}
      {activeTab === 'metas' && <span className="text-purple-400"> &gt; Metas</span>}
      {activeTab === 'config' && <span className="text-purple-400"> &gt; Configuración</span>}
      {activeTab === 'admin' && <span className="text-purple-400"> &gt; Admin Panel</span>}
    </div>
  );

  return (
    <Layout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      desktopSidebarOpen={desktopSidebarOpen}
      setDesktopSidebarOpen={setDesktopSidebarOpen}
      titlePrefix={APP_TITLE_PREFIX}
      titleSuffix={APP_TITLE_SUFFIX}
      sidebar={
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          desktopSidebarOpen={desktopSidebarOpen}
          setDesktopSidebarOpen={setDesktopSidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          netFlow={netFlow}
          projectedNetFlow={projectedNetFlow}
          formatMoney={formatMoney}
          onExport={handleExportExcel}
          onLogout={handleLogout}
        />
      }
      header={
        <Header
          currentYear={currentYear}
          currentMonthNum={currentMonthNum}
          onYearChange={(year) => setState(prev => ({ ...prev, currentMonth: `${year}-${state.currentMonth.split('-')[1]}` }))}
          onMonthChange={(month) => {
            if (month === 'annual') {
              setActiveTab('annual');
            } else {
              if (activeTab === 'annual') setActiveTab('dashboard');
              setState(prev => ({ ...prev, currentMonth: `${currentYear}-${month}` }));
            }
          }}
          privacyMode={privacyMode}
          setPrivacyMode={setPrivacyMode}
          totalIncome={currentTotals[CategoryType.INCOME] || 0}
          formatMoney={formatMoney}
          user={user}
          adminBreadcrumb={adminBreadcrumb}
        />
      }
      modals={
        <>
          <InvitationModal />
          {editingEntry && (
            <EntryModal
              entry={editingEntry}
              onClose={() => setEditingEntry(null)}
              onSave={(entry, newCard, newTag) => {
                if (newCard) {
                  const newCards = [...(state.config.creditCards || []), newCard];
                  const newConfig = { ...state.config, creditCards: newCards };
                  setState(prev => ({ ...prev, config: newConfig }));
                  api.saveConfig(newConfig);
                }
                if (newTag) {
                  const currentTags = state.config.categories[entry.category] || [];
                  if (!currentTags.includes(newTag)) {
                    const newCategories = {
                      ...state.config.categories,
                      [entry.category]: [...currentTags, newTag]
                    };
                    const newConfig = { ...state.config, categories: newCategories };
                    setState(prev => ({ ...prev, config: newConfig }));
                    api.saveConfig(newConfig);
                  }
                }
                saveEntry(entry);
              }}
              categories={state.config.categories}
              creditCards={state.config.creditCards || []}
              goals={state.goals}
              onDeleteCard={(card) => {
                const newCards = state.config.creditCards?.filter(c => c !== card) || [];
                const newConfig = { ...state.config, creditCards: newCards };
                setState(prev => ({ ...prev, config: newConfig }));
                api.saveConfig(newConfig);
              }}
            />
          )}

          {editingGoal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <Card title="Plan de Ahorro" className="w-full max-w-md border border-white/10 shadow-2xl">
                <div className="space-y-5 mt-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre del Objetivo</label>
                    <input className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-bold outline-none" placeholder="Ej: Viaje a Japón" value={editingGoal.name} onChange={e => setEditingGoal({ ...editingGoal, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto Objetivo</label>
                      <input type="number" className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-black text-emerald-400 outline-none" value={editingGoal.targetAmount || ''} onChange={e => setEditingGoal({ ...editingGoal, targetAmount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ya Ahorrado</label>
                      <input type="number" className="w-full bg-slate-900 rounded-2xl p-4 border border-white/5 font-black text-blue-400 outline-none" value={editingGoal.currentAmount || ''} onChange={e => setEditingGoal({ ...editingGoal, currentAmount: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-6 border-t border-white/5">
                    <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditingGoal(null)}>Descartar</Button>
                    <Button className="flex-1 rounded-xl shadow-lg shadow-blue-500/20" onClick={() => {
                      setState(prev => ({ ...prev, goals: prev.goals.find(g => g.id === editingGoal.id) ? prev.goals.map(g => g.id === editingGoal.id ? editingGoal : g) : [...prev.goals, editingGoal] }));
                      setEditingGoal(null);
                    }}>Fijar Meta</Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {editingInstallment && (
            <InstallmentModal
              installment={editingInstallment}
              onClose={() => setEditingInstallment(null)}
              onSave={saveInstallment}
              creditCards={state.config.creditCards || []}
              categories={state.config.categories}
              onAddCard={(newCard) => {
                const currentCards = state.config.creditCards || [];
                if (!currentCards.includes(newCard)) {
                  const newCards = [...currentCards, newCard];
                  const newConfig = { ...state.config, creditCards: newCards };
                  setState(prev => ({ ...prev, config: newConfig }));
                  api.saveConfig(newConfig);
                }
              }}
              onDeleteCard={(card) => {
                const newCards = state.config.creditCards?.filter(c => c !== card) || [];
                const newConfig = { ...state.config, creditCards: newCards };
                setState(prev => ({ ...prev, config: newConfig }));
                api.saveConfig(newConfig);
              }}
            />
          )}

          {viewingInstallment && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
              <Card title={viewingInstallment.name} subtitle="Plan de amortización proyectado" className="w-full max-w-lg border border-indigo-500/30 shadow-[0_0_100px_rgba(59,130,246,0.2)]">
                <div className="space-y-6 mt-6">
                  <div className="grid grid-cols-2 gap-6 bg-blue-600/5 p-6 rounded-[2rem] border border-blue-500/10">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Inversión Total</span>
                      <p className="text-2xl font-black">{formatMoney(viewingInstallment.totalAmount)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Costo Mensual</span>
                      <p className="text-2xl font-black text-blue-400">{formatMoney(viewingInstallment.totalAmount / viewingInstallment.installments)}</p>
                    </div>
                  </div>

                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-3">
                    <div className="space-y-2">
                      {Array.from({ length: viewingInstallment.installments }).map((_, i) => {
                        const [sY, sM] = viewingInstallment.startDate.split('-').map(Number);
                        const date = new Date(sY, sM - 1 + i, 1);
                        const isCurrent = date.toISOString().slice(0, 7) === state.currentMonth;
                        const isPast = date.toISOString().slice(0, 7) < state.currentMonth;

                        return (
                          <div key={i} className={`flex justify-between items-center p-5 rounded-2xl border transition-all ${isCurrent ? 'bg-blue-600/20 border-blue-500/40 shadow-lg' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black text-slate-500 bg-white/5 w-8 h-8 flex items-center justify-center rounded-lg">#{i + 1}</span>
                              <span className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                {date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                              </span>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${isPast ? 'bg-emerald-500/10 text-emerald-500' : isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                              {isPast ? 'Saldada' : isCurrent ? 'Periodo Actual' : 'Pendiente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <Button className="w-full rounded-2xl" variant="outline" onClick={() => setViewingInstallment(null)}>Cerrar Detalle</Button>
                </div>
              </Card>
            </div>
          )}
        </>
      }
    >
      {/* TAB: ANNUAL VIEW */}
      {activeTab === 'annual' && (
        <AnnualView
          year={currentYear}
          budgets={state.budgets}
          formatMoney={formatMoney}
        />
      )}

      {/* TAB: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <DashboardView
          user={user}
          trendData={trendData}
          currentTotals={currentTotals}
          netFlow={netFlow}
          projectedNetFlow={projectedNetFlow}
          totalGoalsSaved={totalGoalsSaved}
          formatMoney={formatMoney}
        />
      )}

      {/* TAB: GASTOS EN GRUPO */}
      {activeTab === 'party' && (
        <PartyView user={user} currentMonth={state.currentMonth} />
      )}

      {/* TAB: PRESUPUESTO / MOVIMIENTOS */}
      {activeTab === 'presupuesto' && (
        <PresupuestoView
          fileInputRef={fileInputRef}
          handleAIUpload={handleAIUpload}
          isParsing={isParsing}
          collapsedCategories={collapsedCategories}
          setCollapsedCategories={setCollapsedCategories}
          currentTotals={currentTotals}
          formatMoney={formatMoney}
          setEditingEntry={setEditingEntry}
          categories={state.config.categories}
          currentMonth={state.currentMonth}
          installmentPurchases={state.installmentPurchases}
          currentBudgetEntries={currentBudgetEntries}
          setViewingInstallment={setViewingInstallment}
          expandedRows={expandedRows}
          setExpandedRows={setExpandedRows}
          deleteEntry={deleteEntry}
          categoryBudgets={state.categoryBudgets}
          onUpdateBudget={handleUpdateBudget}
          onReorderEntries={handleReorderEntries}
          onConfirmEntry={(entry) => saveEntry({ ...entry, is_provisional: false })}
        />
      )}

      {/* ONBOARDING MODAL */}
      {user && (!user.firstName || !user.lastName || !user.birthDate) && (
        <OnboardingModal
          user={user}
          onComplete={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser)); // Update persistence
          }}
        />
      )}

      {/* TAB: CUOTAS / TARJETAS */}
      {activeTab === 'tarjetas' && (
        <TarjetasView
          installmentPurchases={state.installmentPurchases}
          currentMonth={state.currentMonth}
          formatMoney={formatMoney}
          setEditingInstallment={setEditingInstallment}
          setViewingInstallment={setViewingInstallment}
          deleteInstallment={deleteInstallment}
        />
      )}

      {/* TAB: METAS */}
      {activeTab === 'metas' && (
        <MetasView
          goals={state.goals}
          appState={state}
          setEditingGoal={setEditingGoal}
          formatMoney={formatMoney}
        />
      )}

      {/* TAB: CONFIG */}
      {activeTab === 'config' && (
        <ConfigView
          user={user}
          initialConfig={state.config}
          onUpdateConfig={(newConfig) => setState(prev => ({ ...prev, config: newConfig }))}
          onCardRenames={handleCardRenames}
          usedCardNames={usedCardNames}
          onSyncToCloud={async () => {
            await api.syncAllDataToCloud({
              budgets: state.budgets,
              goals: state.goals,
              installments: state.installmentPurchases,
              config: state.config
            });
          }}
        />
      )}

      {/* TAB: ADMIN PANEL */}
      {activeTab === 'admin' && user.role === 'admin' && (
        <AdminPanel />
      )}
    </Layout>
  );
};

export default App;
