import { AppState, BudgetEntry, InstallmentPurchase, SavingsGoal, AppConfig } from '../types';

// Detectar si estamos en localhost o en una IP de red local
// Detectar si estamos en localhost o en una IP de red local
const hostname = window.location.hostname;

let API_URL = 'http://localhost:3001/api'; // Default dev

// Si estamos en Cloudflare Pages o en el dominio personalizado
if (hostname.includes('pages.dev') || hostname.includes('ezequielfredes.com.ar')) {
  API_URL = 'https://nexusfinance.ezequiel-fredes-mondragon.workers.dev/api';
} else {
  // Lógica para Electron / Red Local
  const apiHost = (!hostname || hostname === '') ? 'localhost' : hostname;
  API_URL = `http://${apiHost}:3001/api`;
}

const getHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

const handleResponse = async (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.reload(); // Force re-login
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const text = await response.text();
    let error;
    try {
      error = JSON.parse(text);
    } catch {
      error = { error: text || `Error ${response.status}: ${response.statusText}` };
    }
    throw new Error(error.error || error.message || response.statusText);
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

  async deleteUser(id: string) {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
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

  // Sync all data on load
  async syncData(): Promise<{ entries: any[], goals: any[], installments: any[], config: any, categoryBudgets: any[] } | null> {
    console.log("Starting syncData...");
    try {
      const headers = getHeaders();
      const [entries, goals, installments, config, categoryBudgets] = await Promise.all([
        fetch(`${API_URL}/data`, { headers }).then(handleResponse),
        fetch(`${API_URL}/goals`, { headers }).then(handleResponse),
        fetch(`${API_URL}/installments`, { headers }).then(handleResponse),
        fetch(`${API_URL}/config`, { headers }).then(r => r.status === 404 ? null : r.json()),
        fetch(`${API_URL}/budgets`, { headers }).then(handleResponse)
      ]);
      console.log("syncData completed successfully");
      return { entries, goals, installments, config, categoryBudgets };
    } catch (e) {
      console.error("API Sync failed", e);
      return null;
    }
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
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  async deletePartyExpense(partyId: string, expenseId: string) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/parties/${partyId}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown Error' }));
      throw new Error(err.error || 'Failed to delete');
    }
    return res.json();
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
    if (!res.ok) throw new Error('Failed to add guest');
    return res.json();
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
};
