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
import AdminPanel from './components/AdminPanel';
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
import { generateUUID, isUsdTargetEntry } from './utils/helpers';
import { OnboardingModal } from './components/OnboardingModal';
import { UpdateDetailModal } from './components/UpdateDetailModal';
import { AppUpdate } from './config/updates';

// Helper function to format dates as DD/MM/YYYY
const formatDateDDMMYYYY = (dateStr: string): string => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState<any>(() => {
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    const parsedUser = savedUser ? JSON.parse(savedUser) : null;
    console.log('[APP] Initial user state:', parsedUser ? `Logged in as ${parsedUser.username}` : 'Not logged in');
    return parsedUser;
  });
  const [loadingData, setLoadingData] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar state
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // Desktop sidebar state

  // Wrapper for setUser with logging
  const handleSetUser = (newUser: any) => {
    console.log('[APP] setUser called with:', newUser);
    setUser(newUser);
    console.log('[APP] User state updated');
  };

  const handleLogout = () => {
    console.log('[APP] Logout called');
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
          // Ensure applications exists
          if (!parsed.config.applications || parsed.config.applications.length === 0) {
            parsed.config.applications = ['BRUBANK', 'SANTANDER RIO', 'MERCADO PAGO', 'GALICIA', 'UALA', 'MACRO', 'PERSONAL PAY', 'BBVA'];
          }
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
        categories: DEFAULT_CATEGORY_MAP,
        applications: ['BRUBANK', 'SANTANDER RIO', 'MERCADO PAGO', 'GALICIA', 'UALA', 'MACRO', 'PERSONAL PAY', 'BBVA']
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

  // --- NAVIGATION STATE ---
  const [navigationParams, setNavigationParams] = useState<any>(null);

  const navigate = (tab: 'dashboard' | 'presupuesto' | 'tarjetas' | 'metas' | 'config' | 'admin' | 'annual' | 'party', params?: any) => {
    setActiveTab(tab);
    if (params) {
      setNavigationParams(params);
    }
  };
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<InstallmentPurchase | null>(null);
  const [viewingInstallment, setViewingInstallment] = useState<InstallmentPurchase | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- EXPANDED ROWS STATE ---
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [selectedUpdate, setSelectedUpdate] = useState<AppUpdate | null>(null);

  // --- PRIVACY MODE ---
  const [privacyMode, setPrivacyMode] = useState(false);

  // --- COLLAPSED CATEGORIES ---
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const formatMoney = (amount: number) => {
    if (privacyMode) return '****';
    // Force es-AR locale (point thousands, comma decimal) and exactly 2 decimals,
    // independent of browser locale. Prevents 3-decimal artifacts from float math.
    const formatted = (amount || 0).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return state.config.currency + formatted;
  };

  // --- PENDING INVITES STATE ---
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  // --- PARTY STATE ---
  const [sharedPlans, setSharedPlans] = useState<any[]>([]);
  const [groupExpenses, setGroupExpenses] = useState<any[]>([]);
  const [partyMembers, setPartyMembers] = useState<Record<string, Record<string, string>>>({}); // PartyID -> ID -> Name map

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
          setPendingInvitesCount((invites as any).length || 0);
        } catch (e) {
          console.error("Error fetching invites", e);
        }

        // --- FETCH SHARED INSTALLMENTS (NEW) ---
        try {
          const parties = await api.getParties();
          const allPlans: any[] = [];
          const allGroupExpenses: any[] = [];

          // Store names PER PARTY to support different nicknames in different groups
          // Record<PartyID, Record<MemberID|UserID, Name>>
          const partyMemberMap: Record<string, Record<string, string>> = {};
          const globalUserMap: Record<string, string> = {};

          // Fetch users for generic naming (optimistic)
          try {
            const users = await api.getPublicUsers();
            if (Array.isArray(users)) {
              users.forEach((u: any) => globalUserMap[u.id] = u.firstName || u.username);
            }
          } catch (e) { console.warn("Could not fetch global users for naming", e); }

          // Iterate parties to get nicknames and plans
          for (const party of (parties as any[])) {
            partyMemberMap[party.id] = { ...globalUserMap }; // Start with global names

            // Get Nicknames & Details (for Guests)
            try {
              const [nicknames, details] = await Promise.all([
                api.getNicknames(party.id).catch(() => ({})),
                api.getPartyDetails(party.id).catch(() => (null))
              ]);

              // 2. Map Guest/Member Names (Member ID -> Guest Name / User Name)
              // API returns { members: [...] } or { members: { results: [...] } }
              const membersList: any[] = details ? (Array.isArray((details as any).members) ? (details as any).members : ((details as any).members?.results || [])) : [];

              const userIdToMemberId: Record<string, string> = {};

              membersList.forEach((m: any) => {
                // Track relationship for nickname mapping
                if (m.user_id) userIdToMemberId[m.user_id] = m.id;

                // Basic Name Resolution (Priority: GuestName -> FirstName -> Username)
                const name = m.guest_name || m.firstName || m.username || m.email || m.invited_email;
                if (name) {
                  const cleanName = String(name).replace(/0+$/, '');
                  partyMemberMap[party.id][m.id] = cleanName; // Map Member ID to Name
                  if (m.user_id) partyMemberMap[party.id][m.user_id] = cleanName; // Map User ID to Name
                }

                // CRITICAL: Map UserID -> MemberID relationship specifically for this party
                if (m.user_id) {
                  partyMemberMap[party.id][`uid_${m.user_id}`] = m.id;
                }
              });

              // 1. Map Nicknames (Overwrite Basic Names)
              if (nicknames && typeof nicknames === 'object') {
                Object.entries(nicknames).forEach(([uid, nick]) => {
                  if (typeof nick === 'string') {
                    // Map User ID
                    partyMemberMap[party.id][uid] = nick;
                    // Also Map Member ID if known
                    if (userIdToMemberId[uid]) {
                      partyMemberMap[party.id][userIdToMemberId[uid]] = nick;
                    }
                  }
                });
              }

            } catch (e) { }

            // Get Plans
            try {
              const plans = await api.getInstallmentPlans(party.id);
              if (Array.isArray(plans)) {
                allPlans.push(...plans.map(p => ({ ...p, partyId: party.id })));
              }
            } catch (e) { console.error(`Error fetching plans for party ${party.id}`, e); }

            // Get One-off Expenses (New)
            try {
              const details: any = await api.getPartyDetails(party.id);
              if (details && Array.isArray(details.expenses)) {
                const partyExps = details.expenses.map((exp: any) => ({ ...exp, partyId: party.id }));
                allGroupExpenses.push(...partyExps);
              }
            } catch (e) { console.error(`Error fetching expenses for party ${party.id}`, e); }
          }
          setSharedPlans(allPlans);
          setGroupExpenses(allGroupExpenses);
          setPartyMembers(partyMemberMap);
        } catch (e) {
          console.error("Error fetching party data", e);
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

              // Ensure applications has defaults if empty After merge
              if (!mergedConfig.applications || mergedConfig.applications.length === 0) {
                mergedConfig.applications = ['BRUBANK', 'SANTANDER RIO', 'MERCADO PAGO', 'GALICIA', 'UALA', 'MACRO', 'PERSONAL PAY', 'BBVA'];
              }
              
              return {
                ...prev,
                budgets: { ...prev.budgets, ...newBudgets },
                goals: data.goals || prev.goals,
                installmentPurchases: data.installments || prev.installmentPurchases,
                config: mergedConfig,
                categoryBudgets: { ...prev.categoryBudgets, ...budgetsMap }
              };
            });
          } else {
            // DB vacío, migrar datos locales si existen
            // ORDEN CRÍTICO: 1. Config, 2. Metas (para FK de entries), 3. Cuotas, 4. Entradas
            await api.saveConfig(state.config);
            for (const g of state.goals) { await api.saveGoal(g); }
            for (const i of state.installmentPurchases) { await api.saveInstallment(i); }

            for (const b of Object.values(state.budgets)) {
              for (const e of b.entries) {
                await api.saveEntry(e);
              }
            }
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

  // --- STATE FOR UNDO TOAST ---
  const [undoToast, setUndoToast] = useState<{
    entry: BudgetEntry | null;
    timeoutId: NodeJS.Timeout | null;
    timeLeft: number;
  }>({ entry: null, timeoutId: null, timeLeft: 0 });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (undoToast.entry && undoToast.timeLeft > 0) {
      interval = setInterval(() => {
        setUndoToast(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [undoToast.entry, undoToast.timeLeft]);

  // --- CÁLCULOS DINÁMICOS ---
  // --- CALCULOS DINÁMICOS OPTIMIZADOS (Punto 2) ---
  // 1. GASTOS MANUALES BASE (Rápido, se ejecuta solo al modificar manuales)
  const manualEntriesData = useMemo(() => {
    if (!user) return { manualOtherEntries: [], manualCreditEntries: [], effectiveManualEntryIds: new Set<string>(), savedCardOrders: new Map<string, number>(), savedCardStatuses: new Map<string, TransactionStatus>() };
    const effectiveManualEntries = state.budgets[state.currentMonth]?.entries || [];
    const effectiveManualEntryIds = new Set(effectiveManualEntries.map(e => e.id));

    const savedCardOrders = new Map<string, number>();
    const savedCardStatuses = new Map<string, TransactionStatus>();
    effectiveManualEntries.forEach(e => {
      if (e.id.startsWith('card-agg-')) {
        if (e.order !== undefined) savedCardOrders.set(e.id, e.order);
        if (e.status) savedCardStatuses.set(e.id, e.status);
      }
    });

    const activeManualEntries = effectiveManualEntries.filter(e => !e.deleted && !e.id.startsWith('card-agg-'));
    const manualOtherEntries = activeManualEntries.filter(e =>
      e.paymentMethod !== PaymentMethod.CREDIT || e.category === CategoryType.INCOME
    );
    const manualCreditEntries = activeManualEntries.filter(e => e.paymentMethod === PaymentMethod.CREDIT);

    return { manualOtherEntries, manualCreditEntries, effectiveManualEntryIds, savedCardOrders, savedCardStatuses };
  }, [state.budgets, state.currentMonth, user]);

  // 2. CUOTAS Y TARJETAS VIRTUALES BASE (Pesado, se calcula poco)
  const installmentVirtuals = useMemo(() => {
    const virtuals: BudgetEntry[] = [];
    if (!user) return virtuals;

    state.installmentPurchases.forEach(p => {
      const [startYear, startMonth] = p.startDate.split('-').map(Number);
      const [currYear, currMonth] = state.currentMonth.split('-').map(Number);
      const totalMonthsPassed = (currYear - startYear) * 12 + (currMonth - startMonth);

      if (totalMonthsPassed >= 0 && totalMonthsPassed < p.installments) {
        const generatedId = `inst-${p.id}-${state.currentMonth}`;
        const amount = p.totalAmount / p.installments;
        const entry: BudgetEntry = {
          id: generatedId,
          name: `${p.name} (Cuota ${totalMonthsPassed + 1}/${p.installments})`,
          amount: amount,
          category: p.category,
          tag: p.tag,
          date: state.currentMonth + '-01',
          status: TransactionStatus.PENDING,
          paymentMethod: PaymentMethod.CREDIT,
          installmentRef: p.id,
          currentInstallment: totalMonthsPassed + 1,
          totalInstallments: p.installments,
          linkedIncomeId: p.linkedIncomeId
        };
        let targetCard = p.cardName;
        if (!targetCard) {
           targetCard = (state.config.creditCards && state.config.creditCards.length > 0) ? state.config.creditCards[0] : 'Otros';
        }
        virtuals.push({ ...entry, cardName: targetCard });
      }
    });
    return virtuals;
  }, [state.installmentPurchases, state.currentMonth, state.config.creditCards, user]);

  // 3. PLANES COMPARTIDOS BASE (Cálculo matemático complejo, corre poco)
  const sharedPlansVirtuals = useMemo(() => {
    const virtuals: BudgetEntry[] = [];
    if (!user || !sharedPlans || sharedPlans.length === 0) return virtuals;
    const [currYear, currMonth] = state.currentMonth.split('-').map(Number);

    sharedPlans.forEach(plan => {
      const [startYear, startMonth] = plan.start_date.split('-').map(Number);
      const participants = typeof plan.participants === 'string'
        ? JSON.parse(plan.participants)
        : (plan.participants || [plan.debtor_id]);

      let isActive = false;
      let currentInstallmentNum = 0;

      for (let i = 0; i < plan.installments_count; i++) {
        let m = startMonth + i;
        let y = startYear;
        while (m > 12) { m -= 12; y++; }
        if (m === currMonth && y === currYear) {
          isActive = true;
          currentInstallmentNum = i + 1;
          break;
        }
      }

      if (isActive) {
        const rate = plan.exchange_rate || 1;
        const isUSD = plan.currency === 'USD';
        const installmentAmountNative = plan.installment_amount;
        const installmentAmountARS = isUSD ? installmentAmountNative * rate : installmentAmountNative;

        const myName = user?.firstName || user?.username || 'Yo';
        const partyMap = partyMembers[plan.partyId] || {};
        const payerName = partyMap[plan.payer_id] || 'Miembro';
        const myMemberId = user ? partyMap[`uid_${user.id}`] : undefined;

        const isPayerMe = user && ((plan.payer_id === user.id) || (myMemberId && plan.payer_id === myMemberId) || (partyMap[user.id] === payerName) || (payerName.toLowerCase() === myName.toLowerCase()));

        let isParticipantMe = user && (participants.includes(user.id) || (myMemberId && participants.includes(myMemberId)));
        if (user && !isParticipantMe) {
          isParticipantMe = participants.some((p: string) => {
            const pName = partyMap[p];
            return pName && (pName === partyMap[user.id] || pName.toLowerCase() === myName.toLowerCase());
          });
        }

        if (isPayerMe) {
          participants.forEach((pId: string) => {
            if (!user || pId === user.id || pId === myMemberId || partyMap[pId] === myName || partyMap[pId] === partyMap[user.id]) return;
            const debtorName = partyMap[pId] || 'Miembro';
            const vId = `shared-${plan.id}-${pId}-${state.currentMonth}`;
            const expenseDate = plan.start_date || `${state.currentMonth}-01`;
            
            virtuals.push({
              id: vId,
              name: `${plan.description} (Cobro a ${debtorName})`,
              amount: -installmentAmountARS,
              category: CategoryType.SHARED_EXPENSE,
              tag: `A COBRAR el ${formatDateDDMMYYYY(expenseDate)}`, // Keeping unformatted for simplicity
              date: expenseDate,
              status: TransactionStatus.PENDING,
              paymentMethod: PaymentMethod.TRANSFER,
              currentInstallment: currentInstallmentNum,
              totalInstallments: plan.installments_count,
              installmentRef: plan.id,
              currency: plan.currency,
              originalAmount: installmentAmountNative,
              exchangeRateActual: rate
            });
          });
        } else if (isParticipantMe) {
          const vId = `shared-${plan.id}-${user?.id || 'null'}-${state.currentMonth}`;
          const expenseDate = plan.start_date || `${state.currentMonth}-01`;
            
          virtuals.push({
            id: vId,
            name: `${plan.description} (Pago a ${payerName})`,
            amount: installmentAmountARS,
            category: CategoryType.SHARED_EXPENSE,
            tag: `A PAGAR el ${formatDateDDMMYYYY(expenseDate)}`,
            date: expenseDate,
            status: TransactionStatus.PENDING,
            paymentMethod: PaymentMethod.TRANSFER,
            currentInstallment: currentInstallmentNum,
            totalInstallments: plan.installments_count,
            installmentRef: plan.id,
            currency: plan.currency,
            originalAmount: installmentAmountNative,
            exchangeRateActual: rate
          });
        }
      }
    });

    return virtuals;
  }, [sharedPlans, state.currentMonth, partyMembers, user]);

  // 4. GASTOS GRUPALES DIRECTOS BASE
  const groupDirectVirtuals = useMemo(() => {
    const virtuals: BudgetEntry[] = [];
    if (!groupExpenses || groupExpenses.length === 0 || !user) return virtuals;

    groupExpenses.forEach(exp => {
      const expMonth = exp.date ? exp.date.substring(0, 7) : '';
      if (expMonth === state.currentMonth) {
        const partyMap = partyMembers[exp.partyId] || {};
        const myMemberId = user ? partyMap[`uid_${user.id}`] : undefined;
        const isPayerMe = user && (exp.payer_id === user.id || (myMemberId && exp.payer_id === myMemberId));
        const payerName = isPayerMe ? 'Yo' : (partyMap[exp.payer_id] || 'Miembro');

        virtuals.push({
          id: `group-exp-${exp.id}`,
          name: `${exp.description} (Pagó ${payerName})`,
          amount: exp.amount,
          category: CategoryType.SHARED_EXPENSE,
          tag: 'Gasto de Grupo',
          date: exp.date,
          status: TransactionStatus.PAID,
          paymentMethod: PaymentMethod.TRANSFER,
          is_provisional: false,
          partyId: exp.partyId
        });
      }
    });
    return virtuals;
  }, [groupExpenses, state.currentMonth, partyMembers, user]);

  // 5. COMBINADOR FINAL SUPER LIGERO
  const currentBudgetEntries = useMemo(() => {
    if (!user) return [];
    const { manualOtherEntries, manualCreditEntries, effectiveManualEntryIds, savedCardOrders, savedCardStatuses } = manualEntriesData;

    // Filtrar los que ya se cobraron/pagaron manuales
    const effectiveSharedVirtuals = sharedPlansVirtuals.filter(v => !effectiveManualEntryIds.has(v.id));
    
    const virtualIncomeFromShared: BudgetEntry[] = [];
    const totalSharedBalance = effectiveSharedVirtuals.reduce((sum, entry) => sum + entry.amount, 0);
    if (totalSharedBalance < 0) {
      const incomeId = `income-from-shared-total-${state.currentMonth}`;
      if (!effectiveManualEntryIds.has(incomeId)) {
        const latestDate = effectiveSharedVirtuals.length > 0
          ? effectiveSharedVirtuals.reduce((latest, entry) => entry.date > latest ? entry.date : latest, effectiveSharedVirtuals[0].date)
          : `${state.currentMonth}-01`;

        virtualIncomeFromShared.push({
          id: incomeId,
          name: `Gastos Compartidos del Período`,
          amount: Math.abs(totalSharedBalance),
          category: CategoryType.INCOME,
          tag: `Ingreso por Gasto Compartido`,
          date: latestDate,
          status: TransactionStatus.PENDING,
          paymentMethod: PaymentMethod.TRANSFER,
          description: `Balance neto positivo de gastos compartidos`,
          isAutoGenerated: true,
          linkedSharedExpense: 'net-balance'
        });
      }
    }

    const effectiveInstallmentVirtuals = installmentVirtuals.filter(v => !effectiveManualEntryIds.has(v.id));
    const accumulatedByCardAndCat: Record<string, any> = {};

    const addToAccumulator = (entry: BudgetEntry, cardName: string) => {
      const targetCategory = entry.category === CategoryType.INCOME ? CategoryType.VARIABLE_EXPENSE : entry.category;
      const normalizedCardName = cardName.trim().toUpperCase();
      const key = `${normalizedCardName}-${targetCategory}`;
      if (!accumulatedByCardAndCat[key]) {
        accumulatedByCardAndCat[key] = { total: 0, items: [], cardName, category: targetCategory };
      }
      accumulatedByCardAndCat[key].items.push(entry);
      if (entry.category !== CategoryType.INCOME) {
        accumulatedByCardAndCat[key].total += entry.amount;
      }
    };

    effectiveInstallmentVirtuals.forEach(e => addToAccumulator(e, e.cardName || 'Otros'));
    manualCreditEntries.forEach(e => addToAccumulator(e, e.cardName || (state.config.creditCards && state.config.creditCards.length === 1 ? state.config.creditCards[0] : 'Otros')));

    const installmentEntries: BudgetEntry[] = [];
    Object.entries(accumulatedByCardAndCat).forEach(([key, data]) => {
      data.items.sort((a: any, b: any) => {
        const remA = a.totalInstallments ? (a.totalInstallments - (a.currentInstallment || 0)) : 999;
        const remB = b.totalInstallments ? (b.totalInstallments - (b.currentInstallment || 0)) : 999;
        return remA - remB;
      });
      const aggId = `card-agg-${user?.id || 'null'}-${key}-${state.currentMonth}`;
      // Una misma tarjeta puede tener consumos en distintas categorías (Fijos / Variables / Deudas).
      // Etiquetamos siempre la categoría para que no se confundan al verse repetidos en la misma vista.
      const categoryLabel =
        data.category === CategoryType.FIXED_EXPENSE ? ' (Fijos)' :
        data.category === CategoryType.VARIABLE_EXPENSE ? ' (Variables)' :
        data.category === CategoryType.DEBT ? ' (Deudas)' :
        data.category === CategoryType.SAVINGS ? ' (Ahorros)' :
        '';
      installmentEntries.push({
        id: aggId,
        name: data.cardName === 'Otros' ? `Consumo Tarjeta${categoryLabel}` : `Consumo ${data.cardName}${categoryLabel}`,
        amount: data.total,
        category: data.category,
        tag: 'Tarjeta de Crédito',
        order: savedCardOrders.get(aggId),
        date: state.currentMonth + '-01',
        status: savedCardStatuses.get(aggId) || TransactionStatus.PENDING,
        paymentMethod: PaymentMethod.CREDIT,
        subEntries: data.items,
        cardName: data.cardName
      });
    });

    return [...manualOtherEntries, ...installmentEntries, ...effectiveSharedVirtuals, ...virtualIncomeFromShared, ...groupDirectVirtuals];
  }, [manualEntriesData, sharedPlansVirtuals, installmentVirtuals, groupDirectVirtuals, state.currentMonth, state.config.creditCards, user]);

  // Flatten all entries from all months for lookup purposes (linking labels, etc.)
  const allEntries = useMemo(() => {
    const flatMap = new Map<string, BudgetEntry>();
    
    // 1. Process Database Entries
    Object.values(state.budgets).forEach(b => {
      if (b.entries) {
        b.entries.forEach(e => flatMap.set(e.id, e));
      }
    });

    return Array.from(flatMap.values());
  }, [state.budgets]);

  const confirmedTotals = useMemo(() => {
    const viewMode = state.config.viewMode || 'monthly';
    return currentBudgetEntries
      .filter(e => !e.is_provisional)
      .filter(e => {
        if (viewMode === 'biweekly') return e.viewType === 'biweekly';
        return !e.viewType || e.viewType === 'monthly';
      })
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<CategoryType, number>);
  }, [currentBudgetEntries, state.config.viewMode]);

  const projectedTotals = useMemo(() => {
    const viewMode = state.config.viewMode || 'monthly';
    return currentBudgetEntries
      .filter(e => {
        if (viewMode === 'biweekly') return e.viewType === 'biweekly';
        return !e.viewType || e.viewType === 'monthly';
      })
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {} as Record<CategoryType, number>);
  }, [currentBudgetEntries, state.config.viewMode]);

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

      if (mStr === state.currentMonth) {
        // ALWAYS use currentTotals for the current month to correctly include dynamic installments 
        // and safely ignore saved card-agg items in raw DB entries.
        inc = currentTotals[CategoryType.INCOME] || 0;
        exp = (currentTotals[CategoryType.FIXED_EXPENSE] || 0) +
          (currentTotals[CategoryType.VARIABLE_EXPENSE] || 0) +
          (currentTotals[CategoryType.DEBT] || 0);
      } else if (budget) {
        budget.entries.forEach(e => {
          if (e.id.startsWith('card-agg-')) return; // Ignore aggregations saved in DB
          if (e.category === CategoryType.INCOME) inc += e.amount;
          else if (e.category !== CategoryType.SAVINGS) exp += e.amount;
        });
      }

      data.push({
        name: capitalizedMonth,
        Ingresos: inc,
        Gastos: exp,
        // Marcamos si es el mes actual para mantenerlo siempre, aunque esté en cero.
        _isCurrent: mStr === state.currentMonth,
      });
    }
    // Filtrar meses históricos sin movimientos para que el chart no muestre líneas planas en cero.
    // Mantenemos siempre el mes actual aunque esté vacío.
    return data.filter(d => d._isCurrent || d.Ingresos > 0 || d.Gastos > 0);
  }, [state.budgets, state.currentMonth, currentTotals]);

  const saveEntry = async (entry: BudgetEntry) => {
    try {
      const entryMonth = entry.month_year || entry.date.substring(0, 7);

      // Save directly to API
      await api.saveEntry(entry);

      // Update local state directly
      setState(prev => {
        const monthBudget = prev.budgets[entryMonth] || { month: entryMonth, entries: [] };
        const existingEntries = monthBudget.entries || [];
        const existingIndex = existingEntries.findIndex(e => e.id === entry.id);

        let updatedEntries;
        if (existingIndex >= 0) {
          updatedEntries = [...existingEntries];
          updatedEntries[existingIndex] = entry;
        } else {
          updatedEntries = [...existingEntries, entry];
        }

        return {
          ...prev,
          budgets: {
            ...prev.budgets,
            [entryMonth]: {
              ...monthBudget,
              entries: updatedEntries
            }
          }
        };
      });

      setEditingEntry(null);
    } catch (e: any) {
      console.error("Failed to save entry:", e);
      alert("Error al guardar el movimiento.");
    }
  };

  // Aplica una cotización (BBVA Compra / proxy de Brubank) a los movimientos USD
  // del mes visible. Recalcula el total en ARS = originalAmount * rate y persiste cada uno.
  // Si `categoryFilter` se pasa (distinto de 'ALL'), sólo toca las entries de esa categoría —
  // así el botón "Aplicar" respeta el filtro que el usuario tiene activo en la pantalla.
  const handleApplyDolarRate = async (rate: number, categoryFilter?: string): Promise<{ updatedCount: number }> => {
    const month = state.currentMonth;
    const monthBudget = state.budgets[month];
    if (!monthBudget?.entries?.length) return { updatedCount: 0 };

    const targets = monthBudget.entries
      .filter(isUsdTargetEntry)
      .filter(e => !categoryFilter || categoryFilter === 'ALL' || e.category === categoryFilter);

    if (targets.length === 0) return { updatedCount: 0 };

    const updates: BudgetEntry[] = targets.map(e => ({
      ...e,
      exchangeRateActual: rate,
      amount: (e.originalAmount as number) * rate,
    }));

    const results = await Promise.allSettled(updates.map(u => api.saveEntry(u)));
    const okIds = new Set<string>();
    results.forEach((r, i) => { if (r.status === 'fulfilled') okIds.add(updates[i].id); });

    if (okIds.size > 0) {
      const updatedMap = new Map(updates.filter(u => okIds.has(u.id)).map(u => [u.id, u]));
      setState(prev => {
        const mb = prev.budgets[month];
        if (!mb) return prev;
        return {
          ...prev,
          budgets: {
            ...prev.budgets,
            [month]: {
              ...mb,
              entries: mb.entries.map(e => updatedMap.get(e.id) || e),
            },
          },
        };
      });
    }

    if (okIds.size < updates.length) {
      console.error('[handleApplyDolarRate] Algunos saves fallaron:', results.filter(r => r.status === 'rejected'));
    }

    return { updatedCount: okIds.size };
  };

  const undoDelete = () => {
    if (!undoToast.entry) return;
    
    // Cancel the pending API deletion
    if (undoToast.timeoutId) clearTimeout(undoToast.timeoutId);
    
    // Restore entry in local state
    const entryToRestore = undoToast.entry;
    const entryMonth = entryToRestore.month_year || entryToRestore.date.substring(0, 7);
    
    setState(prev => {
      const monthBudget = prev.budgets[entryMonth] || { month: entryMonth, entries: [] };
      return {
        ...prev,
        budgets: {
          ...prev.budgets,
          [entryMonth]: {
            ...monthBudget,
            entries: [...monthBudget.entries, entryToRestore]
          }
        }
      };
    });
    
    setUndoToast({ entry: null, timeoutId: null, timeLeft: 0 });
  };

  const deleteEntry = (id: string) => {
    const isGenerated = id.startsWith('inst-') || id.startsWith('card-agg-') || id.startsWith('shared-');

    if (isGenerated) {
       // Virtual entries (like generated installments or aggregates) must be explicitly 
       // saved as 'deleted: true' in the DB to remember they shouldn't show up.
       const virtualEntries = currentBudgetEntries;
       const findRecursive = (entries: BudgetEntry[]): BudgetEntry | undefined => {
         for (const e of entries) {
           if (e.id === id) return e;
           if (e.subEntries) { const f = findRecursive(e.subEntries); if (f) return f; }
         }
         return undefined;
       };
       const item = findRecursive(virtualEntries);
       
       if (item) {
         api.saveEntry({ ...item, deleted: true }).catch(e => console.error("Failed to soft-delete virtual entry", e));
         
         // Optimistically hide it by adding a "deleted: true" override in current month's explicit state
         setState(prev => {
            const tempMonthBudget = prev.budgets[state.currentMonth] || { month: state.currentMonth, entries: [] };
            
            // Si ya existe, lo actualiza, sino lo agrega al state.budgets para que compute arriba.
            const existingEntries = tempMonthBudget.entries || [];
            const existingIndex = existingEntries.findIndex(e => e.id === id);
            let updatedEntries;
            
            if (existingIndex >= 0) {
              updatedEntries = [...existingEntries];
              updatedEntries[existingIndex] = { ...item, deleted: true };
            } else {
              updatedEntries = [...existingEntries, { ...item, deleted: true }];
            }
            
            return {
              ...prev,
              budgets: {
                ...prev.budgets,
                [state.currentMonth]: {
                  ...tempMonthBudget,
                  entries: updatedEntries
                }
              }
            };
         });
       }
       return;
    }

    // Standard Entry Deletion (with Undo)
    let entryToDelete: BudgetEntry | null = null;
    let entryMonth = state.currentMonth;
    
    // Find entry in state
    const currentMonthEntries = state.budgets[state.currentMonth]?.entries || [];
    entryToDelete = currentMonthEntries.find(e => e.id === id) || null;
    
    if (!entryToDelete) {
      for (const [month, budget] of Object.entries(state.budgets)) {
        const found = budget.entries.find(e => e.id === id);
        if (found) {
          entryToDelete = found;
          entryMonth = month;
          break;
        }
      }
    }

    if (!entryToDelete) return;

    // 1. Optimistic UI delete
    setState(prev => {
      const monthBudget = prev.budgets[entryMonth];
      if (!monthBudget) return prev;
      return {
        ...prev,
        budgets: {
          ...prev.budgets,
          [entryMonth]: {
            ...monthBudget,
            entries: monthBudget.entries.filter(e => e.id !== id)
          }
        }
      };
    });

    // 2. Clear old toast if exists
    if (undoToast.timeoutId) clearTimeout(undoToast.timeoutId);

    // 3. Start timer for actual API delete
    const timeoutId = setTimeout(async () => {
      try {
        await api.deleteEntry(id);
      } catch (e) {
        console.error("Failed to delete entry from API:", e);
      }
      setUndoToast(prev => {
         // Only clear if another delete hasn't overwritten the toast state
         if (prev.timeoutId === timeoutId) {
             return { entry: null, timeoutId: null, timeLeft: 0 };
         }
         return prev;
      });
    }, 5000);

    // 4. Show Undo Toast
    setUndoToast({ entry: entryToDelete, timeoutId, timeLeft: 5 });
  };

  const handleReorderEntries = (reorderedEntries: BudgetEntry[]) => {
    // For reorder, we update STATE immediately
    const entryMonth = state.currentMonth;
    
    setState(prev => {
      const monthBudget = prev.budgets[entryMonth];
      if (!monthBudget) return prev;
      
      const newEntries = monthBudget.entries.map(existing => {
         const matchingReorder = reorderedEntries.find(r => r.id === existing.id);
         return matchingReorder ? matchingReorder : existing;
      });
      
      return {
        ...prev,
        budgets: {
          ...prev.budgets,
          [entryMonth]: {
            ...monthBudget,
            entries: newEntries
          }
        }
      };
    });

    // Fire API updates in background
    Promise.all(reorderedEntries.map(e => api.saveEntry(e))).catch(e => console.error("Reorder save failed", e));
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
        const result = await parseDocument(file);

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

  // Compute currentYear and currentMonthNum from state.currentMonth


  // Handlers for year/month changes
  const handleYearChange = (year: string) => {
    setState(prev => ({ ...prev, currentMonth: `${year}-${currentMonthNum}` }));
  };

  const handleMonthChange = (month: string) => {
    if (month === 'annual') {
      setActiveTab('annual');
    } else {
      if (activeTab === 'annual') setActiveTab('dashboard');
      setState(prev => ({ ...prev, currentMonth: `${currentYear}-${month}` }));
    }
  };

  // --- ROUTING ---
  const currentPath = window.location.pathname;
  if (currentPath === '/privacy') return <PrivacyView />;
  if (currentPath === '/terminos') return <TermsView />;

  // Si no hay usuario, mostrar Landing o Login Manual
  if (!user) {
    if (currentPath === '/login-manual') {
      return <Login onLogin={handleSetUser} />;
    }
    return <LandingView onLogin={handleSetUser} />;
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


  return (
    <>
      <Layout
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        desktopSidebarOpen={desktopSidebarOpen}
        setDesktopSidebarOpen={setDesktopSidebarOpen}
        titlePrefix={APP_TITLE_PREFIX}
        titleSuffix={APP_TITLE_SUFFIX}
        currentYear={currentYear}
        currentMonthNum={currentMonthNum}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
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
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
            privacyMode={privacyMode}
            setPrivacyMode={setPrivacyMode}
            totalIncome={currentTotals[CategoryType.INCOME] || 0}
            formatMoney={formatMoney}
            user={user}
            onSelectUpdate={setSelectedUpdate}
          />
        }
        modals={
          <>
            <InvitationModal />
            <UpdateDetailModal 
              update={selectedUpdate} 
              onClose={() => setSelectedUpdate(null)} 
            />
            {editingEntry && (
            <EntryModal
              entry={editingEntry}
              onClose={() => setEditingEntry(null)}
              onSave={(entry, newCard, newTag, repeatMonths = 1, newApp) => {
                if (newCard) {
                  const newCards = [...(state.config.creditCards || []), newCard];
                  const newConfig = { ...state.config, creditCards: newCards };
                  setState(prev => ({ ...prev, config: newConfig }));
                  api.saveConfig(newConfig);
                }
                if (newApp) {
                  const currentApps = state.config.applications || [];
                  if (!currentApps.includes(newApp.toUpperCase())) {
                    const newApps = [...currentApps, newApp.toUpperCase()];
                    const newConfig = { ...state.config, applications: newApps };
                    setState(prev => ({ ...prev, config: newConfig }));
                    api.saveConfig(newConfig);
                  }
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

                // Guardar entrada original
                saveEntry(entry);

                // Manejar repetición
                if (repeatMonths && repeatMonths > 1) {
                  const [y, m, d] = entry.date.split('-').map(Number);
                  for (let i = 1; i < repeatMonths; i++) {
                    const nextDate = new Date(y, m - 1 + i, d);
                    const nextY = nextDate.getFullYear();
                    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
                    const nextD = String(nextDate.getDate()).padStart(2, '0');
                    const dateStr = `${nextY}-${nextM}-${nextD}`;
                    const monthYearStr = `${nextY}-${nextM}`;

                    const newEntry = {
                      ...entry,
                      id: crypto.randomUUID(),
                      date: dateStr,
                      month_year: monthYearStr,
                      // Limpiar campos que no deberían repetirse idénticos si fuera necesario, 
                      // pero para "gasto fijo" suelen ser iguales.
                    };
                    saveEntry(newEntry);
                  }
                }
              }}
              categories={state.config.categories}
              creditCards={state.config.creditCards || []}
              applications={state.config.applications || []}
              goals={state.goals}
              viewMode={state.config.viewMode || 'monthly'}
              onDeleteCard={(card) => {
                const newCards = state.config.creditCards?.filter(c => c !== card) || [];
                const newConfig = { ...state.config, creditCards: newCards };
                setState(prev => ({ ...prev, config: newConfig }));
                api.saveConfig(newConfig);
              }}
              allEntries={allEntries}
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
              onSave={(p, newApp) => {
                if (newApp) {
                  const currentApps = state.config.applications || [];
                  if (!currentApps.includes(newApp.toUpperCase())) {
                    const newApps = [...currentApps, newApp.toUpperCase()];
                    const newConfig = { ...state.config, applications: newApps };
                    setState(prev => ({ ...prev, config: newConfig }));
                    api.saveConfig(newConfig);
                  }
                }
                saveInstallment(p);
              }}
              creditCards={state.config.creditCards || []}
              applications={state.config.applications || []}
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
              allEntries={allEntries}
            />
          )}

          {viewingInstallment && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex items-center justify-center p-2 sm:p-4">
              <div className="relative w-full max-w-lg animate-in zoom-in-95 duration-300">
                {/* Close Button Top Right (Mobile friendly) */}
                <button
                  onClick={() => setViewingInstallment(null)}
                  className="absolute -top-1 right-2 sm:-top-4 sm:-right-4 w-10 h-10 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/40 z-[120] hover:scale-110 active:scale-90 transition-all border-2 border-white/20"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>

                <Card title={viewingInstallment.name} subtitle="Plan de amortización proyectado" className="w-full border-2 border-indigo-500/30 shadow-[0_0_100px_rgba(59,130,246,0.3)]">
                  <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
                    <div className="grid grid-cols-2 gap-3 sm:gap-6 bg-blue-600/5 p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-blue-500/10">
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase block mb-1">Inversión Total</span>
                        <p className="text-lg sm:text-2xl font-black">{formatMoney(viewingInstallment.totalAmount)}</p>
                      </div>
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase block mb-1">Costo Mensual</span>
                        <p className="text-lg sm:text-2xl font-black text-blue-400">{formatMoney(viewingInstallment.totalAmount / viewingInstallment.installments)}</p>
                      </div>
                    </div>

                    <div className="max-h-[50vh] sm:max-h-[350px] overflow-y-auto custom-scrollbar pr-2 sm:pr-3">
                      <div className="space-y-2">
                        {Array.from({ length: viewingInstallment.installments }).map((_, i) => {
                          const [sY, sM] = viewingInstallment.startDate.split('-').map(Number);
                          const date = new Date(sY, sM - 1 + i, 1);
                          const isCurrent = date.toISOString().slice(0, 7) === state.currentMonth;
                          const isPast = date.toISOString().slice(0, 7) < state.currentMonth;

                          return (
                            <div key={i} className={`flex justify-between items-center p-3 sm:p-5 rounded-xl sm:rounded-2xl border transition-all ${isCurrent ? 'bg-blue-600/20 border-blue-500/40 shadow-lg' : 'bg-white/5 border-white/5'}`}>
                              <div className="flex items-center gap-3 sm:gap-4">
                                <span className="text-[10px] sm:text-xs font-black text-slate-500 bg-white/5 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg">#{i + 1}</span>
                                <span className={`text-xs sm:text-sm font-bold ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                  {date.toLocaleString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase()}
                                </span>
                              </div>
                              <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2 py-1 sm:px-3 sm:py-1 rounded-lg ${isPast ? 'bg-emerald-500/10 text-emerald-500' : isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-600'}`}>
                                {isPast ? 'Saldada' : isCurrent ? 'Actual' : 'Pendiente'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <Button className="w-full rounded-2xl h-12 mt-2" variant="outline" onClick={() => setViewingInstallment(null)}>Cerrar Detalle</Button>
                  </div>
                </Card>
              </div>
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
          viewMode={state.config.viewMode || 'monthly'}
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
          currentBudgetEntries={currentBudgetEntries}
          categoryBudgets={state.categoryBudgets}
        />
      )}

      {/* TAB: GASTOS EN GRUPO */}
      {activeTab === 'party' && (
        <PartyView user={user} currentMonth={state.currentMonth} navigationParams={navigationParams} />
      )}

      {/* TAB: PRESUPUESTO / MOVIMIENTOS */}
      {activeTab === 'presupuesto' && (
        <PresupuestoView
          navigate={navigate}
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
          allEntries={allEntries}
          setViewingInstallment={setViewingInstallment}
          expandedRows={expandedRows}
          setExpandedRows={setExpandedRows}
          deleteEntry={deleteEntry}
          categoryBudgets={state.categoryBudgets}
          onUpdateBudget={handleUpdateBudget}
          onReorderEntries={handleReorderEntries}
          onConfirmEntry={(entry) => saveEntry({ ...entry, is_provisional: false })}
          onPayEntry={(entry) => {
            const currentStatus = entry.status ? entry.status.toLowerCase() : '';
            const isPaid = currentStatus === 'pagado' || currentStatus === 'paid';
            saveEntry({
              ...entry,
              status: isPaid ? TransactionStatus.PENDING : TransactionStatus.PAID
            });
          }}
          initialViewMode={state.config.viewMode || 'monthly'}
          applications={state.config.applications || []}
          onApplyDolarRate={handleApplyDolarRate}
          monthRawEntries={state.budgets[state.currentMonth]?.entries || []}
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
          onLogout={handleLogout}
          onExport={handleExportExcel}
        />
      )}

      {/* TAB: ADMIN PANEL */}
      {activeTab === 'admin' && user?.email === 'ezequiel.fredes.mondragon@gmail.com' && (
        <AdminPanel token={localStorage.getItem('token') || sessionStorage.getItem('token') || ''} />
      )}

      {/* TOAST DESHACER (UNDO TOAST) */}
      {undoToast.entry && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-8 duration-300 w-auto min-w-[320px] max-w-sm">
          <div className="bg-slate-900/95 border border-slate-700/50 shadow-2xl shadow-black/50 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex flex-shrink-0 items-center justify-center text-rose-400 relative">
                <i className="fas fa-trash-can text-sm"></i>
                <svg className="absolute inset-0 w-8 h-8 -rotate-90">
                  <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="2" fill="none" className="text-rose-500/20" />
                  <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="2" fill="none" className="text-rose-500" strokeDasharray="94.2" strokeDashoffset="0">
                    <animate attributeName="stroke-dashoffset" from="0" to="94.2" dur="5s" fill="freeze" />
                  </circle>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate leading-tight">Eliminado ({undoToast.timeLeft}s)</p>
                <p className="text-slate-400 text-xs truncate leading-tight">{undoToast.entry.name}</p>
              </div>
            </div>
            <button
               onClick={undoDelete}
               className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm"
            >
              Deshacer
            </button>
          </div>
        </div>
      )}

      </Layout>
    </>
  );
};

export default App;
