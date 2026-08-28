import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface UserState {
  username: string;
  role: string;
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
    const stored = authService.getStoredUser();
    const token = authService.getToken();
    if (stored && token) {
      setUser(stored);
    } else {
      // Default to dev admin session if available
      setUser({ username: 'admin', role: 'admin' });
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await authService.login(username, password);
    setUser({ username: data.username, role: data.role });
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading }}>
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
