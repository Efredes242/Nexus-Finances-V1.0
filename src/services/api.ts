import { AppState, BudgetEntry, InstallmentPurchase, SavingsGoal, AppConfig } from '../types';

// Detectar si estamos en localhost, Cloudflare o dominio personalizado
const hostname = window.location.hostname;

let API_URL = '/api';

// Override explícito en tiempo de build. Lo usa el preview deploy del CI para
// apuntar al Worker de preview (con su propia D1) en vez de al de producción:
// sin esto, cualquier host *.pages.dev cae en la rama de abajo y escribe en la
// base real. En build normal la variable no existe y el comportamiento no cambia.
const envApiUrl = import.meta.env.VITE_API_URL;

if (envApiUrl) {
  API_URL = envApiUrl;
} else if (hostname.includes('pages.dev') || hostname.includes('ezequielfredes.com.ar')) {
  // Si estamos en Cloudflare Pages o en el dominio personalizado, usar la URL del Worker
  API_URL = 'https://nexusfinance.ezequiel-fredes-mondragon.workers.dev/api';
} else if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
  // Development independent frontend (Vite default 5173) -> Target 3001
  if (window.location.port === '5173') {
    API_URL = 'http://localhost:3001/api';
  } else {
    // Production local (Served by Express) -> Relative path
    API_URL = '/api';
  }
}

const getHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const handleResponse = async (response: Response) => {
  // Only logout on 401 (invalid/expired token), not 403 (insufficient permissions)
  if (response.status === 401) {
    console.log('[API] 401 Unauthorized - clearing session and reloading');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.reload(); // Force re-login
    throw new Error('Unauthorized');
  }

  // For 403, try to get specific message or throw default
  if (response.status === 403) {
    const text = await response.text();
    let error;
    try {
      error = JSON.parse(text);
    } catch {
      error = { message: 'Forbidden: Insufficient permissions' };
    }
    console.log('[API] 403 Forbidden:', error);
    // Throw the raw error object so frontend can access custom properties (approval_status)
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    let error: any;
    try {
      error = JSON.parse(text);
    } catch {
      error = { error: text || `Error ${response.status}: ${response.statusText}` };
    }
    // Throw detailed error info if available
    const errorMessage = error.error || error.message || response.statusText;
    const finalError = new Error(errorMessage) as any;
    finalError.details = error.details;
    finalError.fullError = error.fullError;
    throw finalError;
  }
  return response.json();
};

console.log('API Service Loaded - Version Installments Fixed');
export const api = {
  // Update User Profile
  async updateProfile(data: { firstName: string; lastName: string; birthDate: string }) {
    const res = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },
  // Check if users exist (public endpoint for first-time setup)
  async hasUsers() {
    const res = await fetch(`${API_URL}/has-users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return { hasUsers: true }; // Default to true if error
    return res.json();
  },

  // Auth
  async login(username, password) {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    // Si es error de credenciales (401), lanzamos error SIN recargar la página
    if (res.status === 401) {
      const text = await res.text();
      let error;
      try { error = JSON.parse(text); } catch { error = { error: text }; }
      throw new Error(error.error || 'Credenciales inválidas');
    }

    return handleResponse(res);
  },

  async googleLogin(data: string | { credential?: string; accessToken?: string }) {
    const body = typeof data === 'string' ? { credential: data } : data;
    const res = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (res.status === 401) {
      throw new Error('Google Authentication failed');
    }

    return handleResponse(res);
  },

  async register(username, password) {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return handleResponse(res);
  },

  async createUser(username, password, role = 'user') {
    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password, role })
    });
    return handleResponse(res);
  },

  async getUsers() {
    const res = await fetch(`${API_URL}/users`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getPendingUserCount() {
    const res = await fetch(`${API_URL}/admin/pending-count`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async deleteUser(id: string) {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async deleteUserData(scope: 'monthly' | 'annual' | 'all', date?: string) {
    const res = await fetch(`${API_URL}/user/data`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ scope, date })
    });
    return handleResponse(res);
  },

  async updateUserRole(id: string, role: string) {
    const res = await fetch(`${API_URL}/users/${id}/role`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ role })
    });
    return handleResponse(res);
  },

  async getCategoryBudgets() {
    const res = await fetch(`${API_URL}/budgets`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async saveCategoryBudget(category: string, amount: number) {
    const res = await fetch(`${API_URL}/budgets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ category, amount })
    });
    return handleResponse(res);
  },

  // Sync all data on load — always scoped to current year to protect Worker memory limits
  async syncData(year?: string): Promise<{ entries: any[], goals: any[], installments: any[], config: any, categoryBudgets: any[] } | null> {
    console.log("Starting syncData...");
    // Always include the year. If not provided, use the current year.
    const targetYear = year || new Date().getFullYear().toString();
    try {
      const headers = getHeaders();
      const [entries, goals, installments, config, categoryBudgets] = await Promise.all([
        fetch(`${API_URL}/data?year=${targetYear}`, { headers }).then(handleResponse),
        fetch(`${API_URL}/goals`, { headers }).then(handleResponse),
        fetch(`${API_URL}/installments`, { headers }).then(handleResponse),
        fetch(`${API_URL}/config`, { headers }).then(r => r.status === 404 ? null : r.json()),
        fetch(`${API_URL}/budgets`, { headers }).then(handleResponse)
      ]);
      console.log("syncData completed successfully");
      return { 
        entries: (entries as any[]) || [], 
        goals: (goals as any[]) || [], 
        installments: (installments as any[]) || [], 
        config, 
        categoryBudgets: (categoryBudgets as any[]) || [] 
      };
    } catch (e: any) {
      console.error("API Sync failed", e);
      return null;
    }
  },

  // Load entries for a specific year (for historical navigation)
  async getEntriesByYear(year: string): Promise<any[]> {
    const res = await fetch(`${API_URL}/data?year=${year}`, { headers: getHeaders() });
    const data = await handleResponse(res);
    return (data as any[]) || [];
  },



  async saveEntry(entry: BudgetEntry) {
    const payload = {
      ...entry,
      month_year: entry.date ? entry.date.substring(0, 7) : undefined
    };
    const res = await fetch(`${API_URL}/entries`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  async deleteEntry(id: string) {
    const res = await fetch(`${API_URL}/entries/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async saveGoal(goal: SavingsGoal) {
    const res = await fetch(`${API_URL}/goals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(goal)
    });
    return handleResponse(res);
  },

  async deleteGoal(id: string) {
    const res = await fetch(`${API_URL}/goals/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async saveInstallment(installment: InstallmentPurchase) {
    const res = await fetch(`${API_URL}/installments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(installment)
    });
    return handleResponse(res);
  },

  async deleteInstallment(id: string) {
    const res = await fetch(`${API_URL}/installments/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async saveConfig(config: AppConfig) {
    const res = await fetch(`${API_URL}/config`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(config)
    });
    return handleResponse(res);
  },

  async getConfig() {
    const headers = getHeaders();
    const res = await fetch(`${API_URL}/config`, { headers });
    if (res.status === 404) return null;
    return handleResponse(res);
  },

  async driveUpload(accessToken: string) {
    const res = await fetch(`${API_URL}/sync/drive/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ accessToken })
    });
    return handleResponse(res);
  },

  async driveDownload(accessToken: string) {
    const res = await fetch(`${API_URL}/sync/drive/download`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ accessToken })
    });
    return handleResponse(res);
  },

  async getPublicUsers() {
    const res = await fetch(`${API_URL}/users/public`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },



  // --- PARTY SYSTEM ---
  async createParty(name: string, description?: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/parties`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  async updateParty(id: string, data: { name: string, description?: string }) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/parties/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  async deleteParty(id: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/parties/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return handleResponse(res);
  },

  async deletePartyExpense(partyId: string, expenseId: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/parties/${partyId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    return handleResponse(res);
  },

  async inviteToParty(partyId: string, email: string) {
    const res = await fetch(`${API_URL}/parties/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ partyId, email })
    });
    return handleResponse(res);
  },

  async addGuestMember(partyId: string, name: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}/guests`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name })
    });
    return handleResponse(res);
  },

  async cancelInvitation(memberId: string) {
    const res = await fetch(`${API_URL}/parties/members/${memberId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getDebugUsers() {
    const res = await fetch(`${API_URL}/debug/users`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return handleResponse(res);
  },

  async getInvitations() {
    const res = await fetch(`${API_URL}/invitations`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async respondToInvitation(inviteId: string, accept: boolean) {
    const res = await fetch(`${API_URL}/invitations/${inviteId}/respond`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ accept })
    });
    return handleResponse(res);
  },

  async getParties() {
    const res = await fetch(`${API_URL}/parties`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async removeMember(memberId: string) {
    const res = await fetch(`${API_URL}/parties/members/${memberId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getPartyDetails(partyId: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async addPartyExpense(partyId: string, data: any) {
    const res = await fetch(`${API_URL}/parties/${partyId}/expenses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updatePartyExpense(partyId: string, expenseId: string, data: any) {
    const res = await fetch(`${API_URL}/parties/${partyId}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async getNicknames(partyId: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}/nicknames`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async setNickname(partyId: string, memberId: string, nickname: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}/nicknames/${memberId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ nickname })
    });
    return handleResponse(res);
  },

  async syncAllDataToCloud(data: { budgets: Record<string, any>, goals: any[], installments: any[], config: any }) {
    // 1. Sync Entries (iterate all months)
    for (const monthKey in data.budgets) {
      const monthData = data.budgets[monthKey];
      for (const entry of monthData.entries) {
        await this.saveEntry(entry);
      }
    }

    // 2. Sync Goals
    for (const goal of data.goals) {
      await this.saveGoal(goal);
    }

    // 3. Sync Installments
    for (const inst of data.installments) {
      await this.saveInstallment(inst);
    }

    // 4. Sync Config
    await this.saveConfig(data.config);

    return true;
  },

  // Installment Plans
  async getInstallmentPlans(partyId: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}/installments`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createInstallmentPlan(partyId: string, data: any) {
    const res = await fetch(`${API_URL}/parties/${partyId}/installments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async updateInstallmentPlan(partyId: string, id: string, data: any) {
    const res = await fetch(`${API_URL}/parties/${partyId}/installments/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async deleteInstallmentPlan(partyId: string, id: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}/installments/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // D1 Sync (Development Only)
  async syncFromD1() {
    const res = await fetch(`${API_URL}/admin/sync-from-d1`, {
      method: 'POST',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // --- INTEGRITY SYSTEM API ---
  async getPendingApprovals(partyId: string) {
    const res = await fetch(`${API_URL}/parties/${partyId}/approvals`, {
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async createApprovalRequest(partyId: string, data: { target_expense_id: string | null, action_type: 'EDIT' | 'DELETE', data_payload: any, reason: string }) {
    const res = await fetch(`${API_URL}/parties/${partyId}/approvals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res);
  },

  async decideApproval(partyId: string, approvalId: string, decision: 'APPROVED' | 'REJECTED') {
    const res = await fetch(`${API_URL}/parties/${partyId}/approvals/${approvalId}/decide`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decision })
    });
    return handleResponse(res);
  },

  // ─── Dólar BBVA history ───
  async dolarSnapshot(compra: number, venta: number, source = 'bbva') {
    const res = await fetch(`${API_URL}/dolar/snapshot`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ compra, venta, source }),
    });
    return handleResponse(res);
  },
  // ─── Reminders / Calendario ───
  async getReminders() {
    const res = await fetch(`${API_URL}/reminders`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(res) as Promise<Array<{
      id: string; title: string; amount: number | null;
      payment_date: string; notify_from_date: string;
      last_notified_date: string | null;
      status: 'pending' | 'paid' | 'cancelled';
      notes: string | null;
      created_at: number; updated_at: number;
    }>>;
  },
  async createReminder(data: { title: string; amount?: number | null; payment_date: string; notify_from_date?: string; notes?: string; entry_id?: string }) {
    const res = await fetch(`${API_URL}/reminders`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  async getReminderByEntry(entryId: string) {
    const res = await fetch(`${API_URL}/reminders/by-entry/${encodeURIComponent(entryId)}`, {
      method: 'GET', headers: getHeaders(),
    });
    return handleResponse(res) as Promise<null | {
      id: string; title: string; amount: number | null;
      payment_date: string; notify_from_date: string;
      status: 'pending' | 'paid' | 'cancelled';
      entry_id: string | null;
    }>;
  },
  async updateReminder(id: string, data: Partial<{ title: string; amount: number | null; payment_date: string; notify_from_date: string; status: 'pending' | 'paid' | 'cancelled'; notes: string }>) {
    const res = await fetch(`${API_URL}/reminders/${id}`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  async deleteReminder(id: string) {
    const res = await fetch(`${API_URL}/reminders/${id}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    return handleResponse(res);
  },
  async markReminderPaid(id: string) {
    const res = await fetch(`${API_URL}/reminders/${id}/paid`, {
      method: 'POST', headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async dolarHistory(days = 30, source = 'bbva') {
    const res = await fetch(`${API_URL}/dolar/history?days=${days}&source=${source}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(res) as Promise<Array<{ date: string; compra: number; venta: number; snapshot_at: number }>>;
  },
};
