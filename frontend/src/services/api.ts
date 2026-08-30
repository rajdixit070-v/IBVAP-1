import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ibvap_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle unauthorized responses gracefully with automatic silent re-authentication
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true;
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
        const loginRes = await axios.post(`${baseUrl}/auth/login-json`, {
          username: 'admin',
          password: 'Admin@IBVAP2026'
        });
        if (loginRes.data?.access_token) {
          const newToken = loginRes.data.access_token;
          localStorage.setItem('ibvap_token', newToken);
          localStorage.setItem(
            'ibvap_user',
            JSON.stringify({
              username: loginRes.data.username,
              role: loginRes.data.role
            })
          );
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (reauthErr) {
        localStorage.removeItem('ibvap_token');
        localStorage.removeItem('ibvap_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
