import { apiClient } from './api';

export const auditAPI = {
  getAccountLog: (params: { projectId?: string; accountId: string; startDate?: string; endDate?: string; adminKey: string }) =>
    apiClient.get('/audit/account-log', { params }),
};
