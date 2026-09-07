import api from './api';

export interface Officer {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  locked_until?: string | null;
  failed_login_attempts: number;
  scope_type: string;
  scope_id: string;
  post_name: string;
  scope_role: string;
  assigned_by?: string;
}

export interface OfficerCreate {
  username: string;
  email?: string;
  password: string;
  role: string;
  post_scope_id: string;
  post_scope_type?: string;
  full_name?: string;
}

export interface OfficerUpdate {
  email?: string;
  role?: string;
  is_active?: boolean;
  post_scope_id?: string;
  post_scope_type?: string;
}

export const userService = {
  async listOfficers(): Promise<Officer[]> {
    const response = await api.get<Officer[]>('/users');
    return response.data;
  },

  async createOfficer(data: OfficerCreate): Promise<Officer> {
    const response = await api.post<Officer>('/users', data);
    return response.data;
  },

  async updateOfficer(id: number, data: OfficerUpdate): Promise<Officer> {
    const response = await api.put<Officer>(`/users/${id}`, data);
    return response.data;
  },

  async resetPassword(id: number, newPassword: string): Promise<{ status: string; message: string; username: string }> {
    const response = await api.post<{ status: string; message: string; username: string }>(`/users/${id}/reset-password`, {
      new_password: newPassword
    });
    return response.data;
  },

  async deleteOfficer(id: number): Promise<{ status: string; message: string; username: string }> {
    const response = await api.delete<{ status: string; message: string; username: string }>(`/users/${id}`);
    return response.data;
  }
};
