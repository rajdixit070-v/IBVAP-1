import api, { getApiBaseUrl } from './api';
import { authService } from './authService';
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
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.get<Camera>(`/cameras/${cleanId}`);
    return response.data;
  },

  async createCamera(data: CameraCreateInput): Promise<Camera> {
    const response = await api.post<Camera>('/cameras', data);
    return response.data;
  },

  async updateCamera(id: string | number, data: CameraUpdateInput): Promise<Camera> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.put<Camera>(`/cameras/${cleanId}`, data);
    return response.data;
  },

  async deleteCamera(id: string | number): Promise<{ success: boolean; message: string }> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.delete<{ success: boolean; message: string }>(`/cameras/${cleanId}`);
    return response.data;
  },

  async testRawStream(data: CameraTestRequest): Promise<CameraTestResponse> {
    const response = await api.post<CameraTestResponse>('/cameras/test-raw', data);
    return response.data;
  },

  async testSavedCamera(id: string | number): Promise<CameraTestResponse> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.post<CameraTestResponse>(`/cameras/${cleanId}/test-connection`);
    return response.data;
  },

  async startStream(id: string | number): Promise<{ success: boolean; status: string }> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.post(`/cameras/${cleanId}/start`);
    return response.data;
  },

  async stopStream(id: string | number): Promise<{ success: boolean; status: string }> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.post(`/cameras/${cleanId}/stop`);
    return response.data;
  },

  async getCameraStatus(id: string | number): Promise<CameraHealthStatus> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.get<CameraHealthStatus>(`/cameras/${cleanId}/status`);
    return response.data;
  },

  async getCameraLogs(id: string | number, limit = 50): Promise<CameraDiagnosticLog[]> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.get<CameraDiagnosticLog[]>(`/cameras/${cleanId}/logs`, { params: { limit } });
    return response.data;
  },

  async clearCameraLogs(id: string | number): Promise<{ success: boolean; message: string }> {
    const cleanId = encodeURIComponent(String(id).trim());
    const response = await api.delete<{ success: boolean; message: string }>(`/cameras/${cleanId}/logs`);
    return response.data;
  },

  getLiveStreamUrl(cameraId: string, fps = 25, profile: 'main' | 'sub' = 'main'): string {
    const token = authService.getToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const base = getApiBaseUrl();
    const cleanId = encodeURIComponent(String(cameraId).trim());
    return `${base}/cameras/${cleanId}/live?fps=${fps}&profile=${profile}${tokenParam}`;
  },

  getSnapshotUrl(cameraId: string): string {
    const token = authService.getToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const base = getApiBaseUrl();
    const cleanId = encodeURIComponent(String(cameraId).trim());
    return `${base}/cameras/${cleanId}/snapshot?t=${Date.now()}${tokenParam}`;
  },

  async getSnapshotBlob(cameraId: string): Promise<Blob> {
    const cleanId = encodeURIComponent(String(cameraId).trim());
    const response = await api.get(`/cameras/${cleanId}/snapshot`, { responseType: 'blob' });
    return response.data;
  },

  async downloadSnapshot(cameraId: string): Promise<void> {
    const blob = await this.getSnapshotBlob(cameraId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(cameraId).trim()}_snapshot_${Date.now()}.jpg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async ingestDirectFrame(cameraId: string, frameBlob: Blob): Promise<void> {
    const cleanId = encodeURIComponent(String(cameraId).trim());
    await api.post(`/cameras/${cleanId}/ingest-frame`, frameBlob, {
      headers: { 'Content-Type': 'image/jpeg' }
    });
  }
};
