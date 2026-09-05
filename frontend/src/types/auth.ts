export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
  scope_type?: string;
  scope_id?: string;
  scope_role?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  scope_type?: string;
  scope_id?: string;
  scope_role?: string;
}

