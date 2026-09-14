import api from './api';
import { AuthResponse, User } from '../types/auth';

export interface OfficerRegisterPayload {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
  role?: string;
  sector?: string;
  bop_id?: string;
}

export const authService = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login-json', { username, password });
    sessionStorage.setItem('ibvap_token', response.data.access_token);
    sessionStorage.setItem('ibvap_user', JSON.stringify({
      username: response.data.username,
      role: response.data.role
    }));
    try {
      localStorage.setItem('ibvap_token', response.data.access_token);
      localStorage.setItem('ibvap_user', JSON.stringify({
        username: response.data.username,
        role: response.data.role
      }));
    } catch {}
    return response.data;
  },

  async registerOfficer(payload: OfficerRegisterPayload): Promise<any> {
    const response = await api.post('/auth/register-officer', payload);
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  logout() {
    sessionStorage.removeItem('ibvap_token');
    sessionStorage.removeItem('ibvap_user');
    localStorage.removeItem('ibvap_token');
    localStorage.removeItem('ibvap_user');
  },

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('ibvap_token') || localStorage.getItem('ibvap_token');
  },

  getStoredUser(): { username: string; role: string } | null {
    if (typeof window === 'undefined') return null;
    const u = sessionStorage.getItem('ibvap_user') || localStorage.getItem('ibvap_user');
    return u ? JSON.parse(u) : null;
  }
};
