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

  async googleLogin(credential) {
    const res = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
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
  }
};
