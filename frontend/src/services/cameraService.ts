import api from './api';
import {
  Camera,
  CameraCreateInput,
  CameraUpdateInput,
  CameraTestRequest,
  CameraTestResponse,
  CameraHealthStatus,
  CameraSummaryStats,
  CameraDiagnosticLog
} from '../types/camera';

export const cameraService = {
  async getCameras(params?: {
    search?: string;
    bop_site?: string;
    sector?: string;
    status?: string;
    enabled?: boolean;
  }): Promise<Camera[]> {
    const response = await api.get<Camera[]>('/cameras', { params });
    return response.data;
  },

  async getOverviewSummary(): Promise<CameraSummaryStats> {
    const response = await api.get<CameraSummaryStats>('/cameras/overview/summary');
    return response.data;
  },

  async getCameraById(id: string | number): Promise<Camera> {
    const response = await api.get<Camera>(`/cameras/${id}`);
    return response.data;
  },

  async createCamera(data: CameraCreateInput): Promise<Camera> {
    const response = await api.post<Camera>('/cameras', data);
    return response.data;
  },

  async updateCamera(id: string | number, data: CameraUpdateInput): Promise<Camera> {
    const response = await api.put<Camera>(`/cameras/${id}`, data);
    return response.data;
  },

  async deleteCamera(id: string | number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/cameras/${id}`);
    return response.data;
  },

  async testRawStream(data: CameraTestRequest): Promise<CameraTestResponse> {
    const response = await api.post<CameraTestResponse>('/cameras/test-raw', data);
    return response.data;
  },

  async testSavedCamera(id: string | number): Promise<CameraTestResponse> {
    const response = await api.post<CameraTestResponse>(`/cameras/${id}/test-connection`);
    return response.data;
  },

  async startStream(id: string | number): Promise<{ success: boolean; status: string }> {
    const response = await api.post(`/cameras/${id}/start`);
    return response.data;
  },

  async stopStream(id: string | number): Promise<{ success: boolean; status: string }> {
    const response = await api.post(`/cameras/${id}/stop`);
    return response.data;
  },

  async getCameraStatus(id: string | number): Promise<CameraHealthStatus> {
    const response = await api.get<CameraHealthStatus>(`/cameras/${id}/status`);
    return response.data;
  },

  async getCameraLogs(id: string | number, limit = 50): Promise<CameraDiagnosticLog[]> {
    const response = await api.get<CameraDiagnosticLog[]>(`/cameras/${id}/logs`, { params: { limit } });
    return response.data;
  },

  getLiveStreamUrl(cameraId: string, fps = 25): string {
    const token = localStorage.getItem('ibvap_token');
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `/api/v1/cameras/${cameraId}/live?fps=${fps}${tokenParam}`;
  },

  getSnapshotUrl(cameraId: string): string {
    const token = localStorage.getItem('ibvap_token');
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    return `/api/v1/cameras/${cameraId}/snapshot?t=${Date.now()}${tokenParam}`;
  },

  async getSnapshotBlob(cameraId: string): Promise<Blob> {
    const response = await api.get(`/cameras/${cameraId}/snapshot`, { responseType: 'blob' });
    return response.data;
  },

  async downloadSnapshot(cameraId: string): Promise<void> {
    const blob = await this.getSnapshotBlob(cameraId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cameraId}_snapshot_${Date.now()}.jpg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
