import axios from 'axios';

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl === '/api/v1') return '/api/v1';
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Bearer token if present
api.interceptors.request.use((config) => {
  const token = (typeof window !== 'undefined')
    ? (sessionStorage.getItem('ibvap_token') || localStorage.getItem('ibvap_token'))
    : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle unauthorized responses: clear expired session only on auth failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Only wipe session if the current user profile endpoint rejected credentials
      if (url.includes('/auth/me') || url.includes('/auth/login')) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('ibvap_token');
          sessionStorage.removeItem('ibvap_user');
          localStorage.removeItem('ibvap_token');
          localStorage.removeItem('ibvap_user');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

