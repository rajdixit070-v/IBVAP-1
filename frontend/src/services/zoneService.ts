import api from './api';
import { SecurityZone, SecurityZoneCreate, SecurityZoneUpdate } from '../types/zone';

export const zoneService = {
  async getZones(cameraId?: string, enabled?: boolean): Promise<SecurityZone[]> {
    const params: any = {};
    if (cameraId) params.camera_id = cameraId;
    if (enabled !== undefined) params.enabled = enabled;
    const response = await api.get<SecurityZone[]>('/zones/', { params });
    return response.data;
  },

  async getZone(zoneId: string): Promise<SecurityZone> {
    const response = await api.get<SecurityZone>(`/zones/${zoneId}`);
    return response.data;
  },

  async createZone(data: SecurityZoneCreate): Promise<SecurityZone> {
    const response = await api.post<SecurityZone>('/zones/', data);
    return response.data;
  },

  async updateZone(zoneId: string, data: SecurityZoneUpdate): Promise<SecurityZone> {
    const response = await api.put<SecurityZone>(`/zones/${zoneId}`, data);
    return response.data;
  },

  async deleteZone(zoneId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/zones/${zoneId}`);
    return response.data;
  }
};
