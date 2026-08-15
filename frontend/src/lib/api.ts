import axios from 'axios'
import { toast } from 'sonner'

// Default to backend dev port 4002 (backend default was changed to 4002 to avoid conflicts).
// Use NEXT_PUBLIC_API_URL when provided. During local dev, prefer the current host
// (window.location.hostname) so the frontend targets the same machine serving the app
// (useful when HOST isn't 127.0.0.1). Fall back to localhost on server-side.
const getDefaultApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: Use relative path (empty) to leverage Next.js rewrites
    // This avoids Mixed Content errors (HTTPS -> HTTP) by proxying through Vercel
    return '';
  }
  return 'http://localhost:4002';
};

// Force specific prefix on client-side to use Next.js Rewrite Proxy (avoids Mixed Content & NextAuth collisions)
// On server-side, use the full URL from Env or fallback
const API_URL = (typeof window !== 'undefined') 
  ? '/backend-api' 
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002');

console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('Using API_URL:', API_URL);

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor para agregar el token
apiClient.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para manejar errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el backend devuelve un mensaje amigable para el usuario, mostrarlo como toast
    const userMessage = error.response?.data?.error?.userMessage || error.response?.data?.error?.message;
    if (userMessage) {
      try {
        toast.error(userMessage)
      } catch (e) {
        // ignore toast errors
      }
    }

    // Mostrar advertencia específica si el error es por cuenta desactivada
    if (error.response?.data?.error?.message?.includes('No se puede usar la cuenta desactivada')) {
      try {
        toast.error('No puedes usar una cuenta desactivada en transacciones. Selecciona una cuenta activa.');
      } catch (e) {}
    }

    if (error.response?.status === 401) {
      // Redirigir al login si no está autenticado
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

// API Endpoints
export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.post('/api/auth/login', credentials),
  googleLogin: (credential: string) =>
    apiClient.post('/api/auth/google', { credential }),
  register: (data: any) =>
    apiClient.post('/api/auth/register', data),
  getProfile: () =>
    apiClient.get('/api/auth/profile'),
}

export const projectsAPI = {
  getAll: (params?: any) => apiClient.get('/api/projects', { params }),
  getById: (id: string) => apiClient.get(`/api/projects/${id}`),
  getSummary: (id: string) => apiClient.get(`/api/projects/${id}/summary`),
  create: (data: any) => apiClient.post('/api/projects', data),
  update: (id: string, data: any) => apiClient.put(`/api/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/projects/${id}`),
  pause: (id: string) => apiClient.post(`/api/projects/${id}/pause`),
  reactivate: (id: string) => apiClient.post(`/api/projects/${id}/reactivate`),
  uploadLogo: (id: string, formData: FormData) => apiClient.post(`/api/projects/${id}/logo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Project Members
  getMembers: (id: string) => apiClient.get(`/api/projects/${id}/members`),
  addMember: (id: string, data: { email: string; role: string }) => apiClient.post(`/api/projects/${id}/members`, data),
  updateMemberRole: (projectId: string, memberId: string, role: string) => apiClient.put(`/api/projects/${projectId}/members/${memberId}`, { role }),
  removeMember: (projectId: string, memberId: string) => apiClient.delete(`/api/projects/${projectId}/members/${memberId}`),
}

export const dashboardAPI = {
  getGeneral: (params?: any) => apiClient.get('/api/dashboard', { params }),
  getProject: (id: string, params?: any) => apiClient.get(`/api/dashboard/project/${id}`, { params }),
}

export const exchangeRatesAPI = {
  getLatest: () => apiClient.get('/api/exchange-rates/latest'),
  // Devuelve las últimas tasas por fuente (BCV, BINANCE, CUSTOM)
  getLatestBySource: () => apiClient.get('/api/exchange-rates/latest-by-source'),
  getHistory: (days: number = 30, source?: string) => apiClient.get(`/api/exchange-rates/history`, { params: { days, source } }),
  createCustom: (data: any) => apiClient.post('/api/exchange-rates/custom', data),
  // Fuerza la actualización de todas las fuentes en el backend (ADMIN)
  updateAll: () => apiClient.post('/api/exchange-rates/update-all'),
}

export const aiAPI = {
  getInsights: (projectId?: string) => 
    apiClient.get(`/api/ai/insights${projectId ? `?projectId=${projectId}` : ''}`),
  analyzeDocument: (data: any) => apiClient.post('/api/ai/analyze-document', data),
  generateReport: (data: any) => apiClient.post('/api/ai/generate-report', data),
}

export const notificationsAPI = {
  getAll: (unreadOnly = false) => 
    apiClient.get(`/api/notifications?unreadOnly=${unreadOnly}`),
  markAsRead: (id: string) => apiClient.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => apiClient.put('/api/notifications/read-all'),
}

export const accountsAPI = {
  getAll: (params?: any) => apiClient.get('/api/accounts', { params }),
  getById: (id: string) => apiClient.get(`/api/accounts/${id}`),
  create: (data: any) => apiClient.post('/api/accounts', data),
  update: (id: string, data: any) => apiClient.put(`/api/accounts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/accounts/${id}`),
  adjust: (id: string, data: any) => apiClient.post(`/api/accounts/${id}/adjust`, data),
  getBalance: (id: string, params?: any) => apiClient.get(`/api/accounts/${id}/balance`, { params }),
  getLedger: (id: string, params?: any) => apiClient.get(`/api/accounts/${id}/ledger`, { params }),
}

export const transactionsAPI = {
  getAll: (params?: any) => apiClient.get('/api/transactions', { params }),
  getById: (id: string) => apiClient.get(`/api/transactions/${id}`),
  create: (data: any, params?: any) => apiClient.post('/api/transactions', data, { params }),
  update: (id: string, data: any) => apiClient.put(`/api/transactions/${id}`, data),
  forcePaid: (id: string) => apiClient.patch(`/api/transactions/${id}/force-paid`),
  delete: (id: string) => apiClient.delete(`/api/transactions/${id}`),
  cancel: (id: string) => apiClient.post(`/api/transactions/${id}/cancel`),
  reverse: (id: string) => apiClient.post(`/api/transactions/${id}/reverse`),
  getCategories: (params?: any) => apiClient.get('/api/transactions/categories', { params }),
  uploadAttachments: (id: string, formData: FormData) => apiClient.post(`/api/transactions/${id}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteAttachment: (id: string, filename: string) => apiClient.delete(`/api/transactions/${id}/attachments`, { params: { filename } }),
}

export const transactionCategoriesAPI = {
  getAll: (params?: any) => apiClient.get('/api/transaction-categories', { params }),
  create: (data: any) => apiClient.post('/api/transaction-categories', data),
  update: (id: string, data: any) => apiClient.put(`/api/transaction-categories/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/transaction-categories/${id}`),
}

export const backupAPI = {
  getConfig: () => apiClient.get('/api/backups/config'),
  updateConfig: (data: { enabled: boolean; schedule: string; keepLast: number }) => apiClient.put('/api/backups/config', data),
  triggerManual: () => apiClient.post('/api/backups/trigger'),
  // New restore methods
  list: () => apiClient.get('/api/backups/list'),
  restore: (id: string) => apiClient.post('/api/backups/restore', { id }),
}

export const contactsAPI = {
  getAll: (params?: any) => apiClient.get('/api/contacts', { params }),
  getById: (id: string) => apiClient.get(`/api/contacts/${id}`),
  create: (data: any) => apiClient.post('/api/contacts', data),
  update: (id: string, data: any) => apiClient.put(`/api/contacts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/contacts/${id}`),
  search: (projectId: string, search: string, limit = 20) => 
    apiClient.get('/api/contacts', { params: { projectId, search, limit } }),
}

export const productsAPI = {
  getAll: (params?: any) => apiClient.get('/api/products', { params }),
  getById: (id: string) => apiClient.get(`/api/products/${id}`),
  create: (data: any) => apiClient.post('/api/products', data),
  update: (id: string, data: any) => apiClient.put(`/api/products/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/products/${id}`),
  search: (projectId: string, search: string, limit = 20) => apiClient.get('/api/products', { params: { projectId, search, limit } }),
  bulkSyncCosts: (data: any) => apiClient.post('/api/products/bulk-sync-costs', data),
  transferStock: (data: any) => apiClient.post('/api/products/transfer', data),
}

export const posAPI = {
  getActiveSession: (projectId: string) => apiClient.get('/api/pos/session/active', { params: { projectId } }),
  openSession: (data: any) => apiClient.post('/api/pos/session/open', data),
  closeSession: (data: any) => apiClient.post('/api/pos/session/close', data),
  getSessionSummary: (sessionId: string) => apiClient.get('/api/pos/session/summary', { params: { sessionId } }),
  processSale: (data: any) => apiClient.post('/api/pos/sale', data),
  voidSale: (id: string, reason?: string) => apiClient.post(`/api/pos/sale/${id}/void`, { reason }),
}



export const reportsAPI = {
  getContactReports: (params?: any) => apiClient.get('/api/reports/contacts', { params }),
  getSummary: (params?: any) => apiClient.get('/api/reports/summary', { params }),
  getTrend: (params?: any) => apiClient.get('/api/reports/trend', { params }),
  getCategories: (params?: any) => apiClient.get('/api/reports/categories', { params }),
  getPaymentMethods: (params?: any) => apiClient.get('/api/reports/payment-methods', { params }),
  getCashFlow: (params?: any) => apiClient.get('/api/reports/cash-flow', { params }),
  getProductStats: (params?: any) => apiClient.get('/api/reports/products', { params }),
  getAgingReport: (params?: any) => apiClient.get('/api/reports/aging', { params }),
  getForexImpact: (projectId?: string) => apiClient.get('/api/reports/forex-impact', { params: { projectId } }),
}

export const consolidationAPI = {
  list: () => apiClient.get('/api/consolidation-groups'),
  create: (data: any) => apiClient.post('/api/consolidation-groups', data),
  getById: (id: string) => apiClient.get(`/api/consolidation-groups/${id}`),
  update: (id: string, data: any) => apiClient.put(`/api/consolidation-groups/${id}`, data),
  replaceAccounts: (id: string, data: { accountIds: string[] }) => apiClient.put(`/api/consolidation-groups/${id}/accounts`, data),
  delete: (id: string) => apiClient.delete(`/api/consolidation-groups/${id}`),
  getPreview: (id: string) => apiClient.get(`/api/consolidation-groups/${id}/preview`),
}

export const adminAPI = {
  // Recalcula saldos en el backend (ADMIN)
  recalculateBalances: () => apiClient.post('/api/admin/recalculate-balances'),
  getUsers: () => apiClient.get('/api/admin/users'),
  createUser: (data: any) => apiClient.post('/api/admin/users', data),
  setUserProjects: (userId: string, assignments: { projectId: string; role?: string }[]) =>
    apiClient.put(`/api/admin/users/${userId}/projects`, { assignments }),
}

export const recurringAPI = {
  getAll: () => apiClient.get('/api/recurring'),
  trigger: (id: string) => apiClient.post(`/api/recurring/${id}/trigger`),
  markPaidOccurrence: (occurrenceId: string, data?: any) => apiClient.post(`/api/recurring/occurrence/${occurrenceId}/mark-paid`, data || {}),
  getOccurrence: (occurrenceId: string) => apiClient.get(`/api/recurring/occurrence/${occurrenceId}`),
  updateOccurrence: (occurrenceId: string, data: any) => apiClient.put(`/api/recurring/occurrence/${occurrenceId}`, data),
  cancelOccurrence: (occurrenceId: string) => apiClient.post(`/api/recurring/occurrence/${occurrenceId}/cancel`),
  getPendingOccurrences: (params?: any) => apiClient.get('/api/recurring/occurrences/pending', { params }),
  markPaidBatch: (data?: any) => apiClient.post('/api/recurring/occurrences/mark-paid-batch', data || {}),
  listBatches: (params?: any) => apiClient.get('/api/recurring/occurrences/batches', { params }),
  getBatch: (id: string) => apiClient.get(`/api/recurring/occurrences/batches/${id}`),
  create: (data: any) => apiClient.post('/api/recurring', data),
  delete: (id: string) => apiClient.delete(`/api/recurring/${id}`),
}

export const entriesAPI = {
  create: (data: any) => {
    const normalizePaymentMethod = (m: any) => {
      if (!m && m !== 0) return undefined;
      const v = String(m).toUpperCase();
      if (v === 'DEBIT_CARD' || v === 'CREDIT_CARD' || v === 'CARD') return 'CARD';
      if (['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER', 'MOBILE_PAYMENT'].includes(v)) return v;
      return 'OTHER';
    };
    const payload = { ...data };
    if (payload.paymentMethod) payload.paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    return apiClient.post('/api/entries/create', payload);
  },
  parse: (data: { text: string }) => apiClient.post('/api/entries/parse', data),
}


export const loansAPI = {
  getLoans: (projectId: string) => apiClient.get('/api/loans?projectId=' + projectId),
  getLoanById: (id: string) => apiClient.get(`/api/loans/${id}`),
  createLoan: (data: any) => apiClient.post('/api/loans', data),
  deleteLoan: (id: string) => apiClient.delete(`/api/loans/${id}`),
  addPayment: (id: string, data: any) => apiClient.post(`/api/loans/${id}/payment`, data),
  addCharge: (id: string, data: any) => apiClient.post(`/api/loans/${id}/charge`, data),
};

export const settingsAPI = {
  getParseThreshold: (params?: any) => apiClient.get('/api/settings/parse-threshold', { params }),
  setParseThreshold: (data: any) => apiClient.post('/api/settings/parse-threshold', data),
}

export const invoicesAPI = {
  getAll: (params?: any) => apiClient.get('/api/invoices', { params }),
  create: (data: any) => apiClient.post('/api/invoices', data),
  update: (id: string, data: any) => apiClient.put(`/api/invoices/${id}`, data),
  post: (id: string) => apiClient.post(`/api/invoices/${id}/post`),
  getById: (id: string) => apiClient.get(`/api/invoices/${id}`),
  delete: (id: string) => apiClient.delete(`/api/invoices/${id}`),
  pay: (id: string, data: any) => apiClient.post(`/api/invoices/${id}/pay`, data),
}

export const paymentsAPI = {
  create: (data: any) => {
    const normalizePaymentMethod = (m: any) => {
      if (!m && m !== 0) return undefined;
      const v = String(m).toUpperCase();
      if (v === 'DEBIT_CARD' || v === 'CREDIT_CARD' || v === 'CARD') return 'CARD';
      if (['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER', 'MOBILE_PAYMENT'].includes(v)) return v;
      return 'OTHER';
    };
    const payload = { ...data };
    if (payload.method) payload.method = normalizePaymentMethod(payload.method);
    if (payload.paymentMethod) payload.paymentMethod = normalizePaymentMethod(payload.paymentMethod);
    return apiClient.post('/api/payments', payload);
  },
  import: (data: any) => apiClient.post('/api/payments/import', data),
  getAll: (params?: any) => apiClient.get('/api/payments', { params }),
}

export const transactionTemplatesAPI = {
  getAll: (projectId: string) => apiClient.get('/api/transaction-templates', { params: { projectId } }),
  create: (data: any) => apiClient.post('/api/transaction-templates', data),
  delete: (id: string) => apiClient.delete(`/api/transaction-templates/${id}`),
}

export const scanAPI = {
  invoice: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post('/api/scan/invoice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
}

export const cfoAPI = {
  getSummary: (projectId: string) => apiClient.get('/api/cfo/summary', { params: { projectId } }),
  getDetailedReport: (projectId: string) => apiClient.get('/api/cfo/report', { params: { projectId } }),
};

const api = {
  auth: authAPI,
  projects: projectsAPI,
  dashboard: dashboardAPI,
  exchangeRates: exchangeRatesAPI,
  ai: aiAPI,
  notifications: notificationsAPI,
  accounts: accountsAPI,
  transactions: transactionsAPI,
  transactionCategories: transactionCategoriesAPI,
  contacts: contactsAPI,
  reports: reportsAPI,
  consolidation: consolidationAPI,
  admin: adminAPI,
  recurring: recurringAPI,
  entries: entriesAPI,
  settings: settingsAPI,
  invoices: invoicesAPI,
  payments: paymentsAPI,
  products: productsAPI,
  transactionTemplates: transactionTemplatesAPI,
  backups: backupAPI,
  scan: scanAPI,
  cfo: cfoAPI,
  loans: loansAPI,
  pos: posAPI,
}

export default api
