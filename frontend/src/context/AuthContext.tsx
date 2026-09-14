import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface UserState {
  username: string;
  role: string;
  scope_type?: string;
  scope_id?: string;
  scope_role?: string;
  post_name?: string;
  sector?: string;
}

interface AuthContextType {
  user: UserState | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = authService.getToken();
      if (token) {
        try {
          const currentUser = await authService.getCurrentUser();
          setUser({
            username: currentUser.username,
            role: currentUser.role,
            scope_type: currentUser.scope_type,
            scope_id: currentUser.scope_id,
            scope_role: currentUser.scope_role,
            post_name: currentUser.post_name,
            sector: currentUser.sector
          });
        } catch {
          // If token is invalid or expired, clear session
          authService.logout();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await authService.login(username, password);
    setUser({
      username: data.username,
      role: data.role,
      scope_type: data.scope_type,
      scope_id: data.scope_id,
      scope_role: data.scope_role,
      post_name: data.post_name,
      sector: data.sector
    });
  };


  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user && !!authService.getToken(), login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
