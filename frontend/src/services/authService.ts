import api from './api';
import { AuthResponse, User } from '../types/auth';

export const authService = {
  async login(username: string, password: string):Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login-json', { username, password });
    localStorage.setItem('ibvap_token', response.data.access_token);
    localStorage.setItem('ibvap_user', JSON.stringify({
      username: response.data.username,
      role: response.data.role
    }));
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('ibvap_token');
    localStorage.removeItem('ibvap_user');
  },

  getToken(): string | null {
    return localStorage.getItem('ibvap_token');
  },

  getStoredUser(): { username: string; role: string } | null {
    const u = localStorage.getItem('ibvap_user');
    return u ? JSON.parse(u) : null;
  }
};
