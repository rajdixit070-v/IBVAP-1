import axios from 'axios';
import {
  SystemHealthSummary,
  CameraHealthItem,
  EdgeNodeHealthItem,
  ServiceDependencyItem,
  NetworkHealthSummary,
  StorageHealthSummary,
  QueueHealthItem,
  ModelHealthItem,
  DiagnosticResultItem,
  HealthEventItem,
  MaintenanceWindow,
  MaintenanceWindowCreate,
  HealthConfig
} from '../types/health';

const API_BASE = '/api/v1/health';

export const healthService = {
  getSystemHealth: async (): Promise<SystemHealthSummary> => {
    const res = await axios.get(`${API_BASE}/system`);
    return res.data;
  },

  getCameraHealthList: async (): Promise<CameraHealthItem[]> => {
    const res = await axios.get(`${API_BASE}/cameras`);
    return res.data;
  },

  getCameraHealthDetail: async (cameraId: string): Promise<CameraHealthItem> => {
    const res = await axios.get(`${API_BASE}/cameras/${cameraId}`);
    return res.data;
  },

  setCameraPriority: async (cameraId: string, priority: string, reason?: string): Promise<any> => {
    const res = await axios.post(`${API_BASE}/cameras/${cameraId}/priority`, {
      priority,
      reason,
      authorized_by: 'operator'
    });
    return res.data;
  },

  getEdgeNodesHealth: async (): Promise<EdgeNodeHealthItem[]> => {
    const res = await axios.get(`${API_BASE}/edges`);
    return res.data;
  },

  getServicesHealth: async (): Promise<ServiceDependencyItem[]> => {
    const res = await axios.get(`${API_BASE}/services`);
    return res.data;
  },

  getNetworkHealth: async (): Promise<NetworkHealthSummary> => {
    const res = await axios.get(`${API_BASE}/network`);
    return res.data;
  },

  getStorageHealth: async (): Promise<StorageHealthSummary> => {
    const res = await axios.get(`${API_BASE}/storage`);
    return res.data;
  },

  getQueueHealth: async (): Promise<QueueHealthItem[]> => {
    const res = await axios.get(`${API_BASE}/queues`);
    return res.data;
  },

  getModelsHealth: async (): Promise<ModelHealthItem[]> => {
    const res = await axios.get(`${API_BASE}/models`);
    return res.data;
  },

  getDiagnostics: async (): Promise<DiagnosticResultItem[]> => {
    const res = await axios.get(`${API_BASE}/diagnostics`);
    return res.data;
  },

  getHealthEvents: async (): Promise<HealthEventItem[]> => {
    const res = await axios.get(`${API_BASE}/events`);
    return res.data;
  },

  clearHealthEvents: async (): Promise<{ success: boolean; message: string }> => {
    const res = await axios.delete(`${API_BASE}/events/clear-all`);
    return res.data;
  },


  getMaintenanceWindows: async (): Promise<MaintenanceWindow[]> => {
    const res = await axios.get(`${API_BASE}/maintenance`);
    return res.data;
  },

  createMaintenanceWindow: async (payload: MaintenanceWindowCreate): Promise<MaintenanceWindow> => {
    const res = await axios.post(`${API_BASE}/maintenance`, payload);
    return res.data;
  },

  terminateMaintenanceWindow: async (maintenanceId: string): Promise<MaintenanceWindow> => {
    const res = await axios.post(`${API_BASE}/maintenance/${maintenanceId}/terminate`);
    return res.data;
  },

  triggerDiagnostics: async (): Promise<DiagnosticResultItem[]> => {
    const res = await axios.post(`${API_BASE}/diagnostics/run`);
    return res.data;
  },

  triggerTestEvent: async (title?: string, description?: string): Promise<HealthEventItem> => {
    const res = await axios.post(`${API_BASE}/events/test`, null, {
      params: { title, description }
    });
    return res.data;
  },

  getHealthConfig: async (): Promise<HealthConfig> => {
    const res = await axios.get(`${API_BASE}/config`);
    return res.data;
  },

  updateHealthConfig: async (payload: Partial<HealthConfig>): Promise<any> => {
    const res = await axios.put(`${API_BASE}/config`, payload);
    return res.data;
  }
};

