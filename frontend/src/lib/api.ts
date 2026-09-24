import axios from 'axios';
import type {
  Email,
  PaginatedResponse,
  ScheduleEmailPayload,
  ScheduleEmailResponse,
  User,
} from '../types/email';

const apiClient = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  auth: {
    getMe: async (): Promise<{ success: boolean; user: User }> => {
      const res = await apiClient.get('/api/auth/me');
      return res.data;
    },
    logout: async (): Promise<{ success: boolean; message: string }> => {
      const res = await apiClient.post('/api/auth/logout');
      return res.data;
    },
    devLogin: async (
      email: string,
      name?: string
    ): Promise<{ success: boolean; user: User; token: string }> => {
      const res = await apiClient.post('/api/auth/dev-login', { email, name });
      return res.data;
    },
  },
  emails: {
    getScheduled: async (
      page: number = 1,
      pageSize: number = 20
    ): Promise<PaginatedResponse<Email>> => {
      const res = await apiClient.get('/api/emails/scheduled', {
        params: { page, pageSize },
      });
      return res.data;
    },
    getSent: async (
      page: number = 1,
      pageSize: number = 20
    ): Promise<PaginatedResponse<Email>> => {
      const res = await apiClient.get('/api/emails/sent', {
        params: { page, pageSize },
      });
      return res.data;
    },
    schedule: async (
      payload: ScheduleEmailPayload
    ): Promise<ScheduleEmailResponse> => {
      const res = await apiClient.post('/api/emails/schedule', payload);
      return res.data;
    },
    getById: async (id: string): Promise<{ success: boolean; email: Email }> => {
      const res = await apiClient.get(`/api/emails/${id}`);
      return res.data;
    },
  },
};
