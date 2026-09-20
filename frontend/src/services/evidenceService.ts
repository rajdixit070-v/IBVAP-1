import api, { getApiBaseUrl } from './api';
import { Evidence } from '../types/incident';

export const getEvidenceFileUrl = (evidenceId: string): string => {
  const base = getApiBaseUrl();
  const token = localStorage.getItem('token');
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/evidence/${encodeURIComponent(evidenceId)}/file${tokenParam}`;
};

export const formatEvidenceUrl = (urlOrId?: string | null): string | null => {
  if (!urlOrId) return null;
  const token = localStorage.getItem('token');
  if (urlOrId.startsWith('http://') || urlOrId.startsWith('https://')) {
    if (token && !urlOrId.includes('token=')) {
      const sep = urlOrId.includes('?') ? '&' : '?';
      return `${urlOrId}${sep}token=${encodeURIComponent(token)}`;
    }
    return urlOrId;
  }
  const base = getApiBaseUrl();
  const cleanId = urlOrId
    .replace(/^\/?api\/v1\/evidence\//, '')
    .replace(/^\/?evidence\//, '')
    .replace(/\/file$/, '')
    .replace(/\/download$/, '');
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/evidence/${encodeURIComponent(cleanId)}/file${tokenParam}`;
};

export const evidenceService = {
  async listEvidence(params?: { camera_id?: string; evidence_type?: string; limit?: number }): Promise<Evidence[]> {
    const res = await api.get<Evidence[]>('/evidence', { params });
    return res.data;
  },

  async getEvidenceDetail(evidenceId: string): Promise<Evidence> {
    const res = await api.get<Evidence>(`/evidence/${evidenceId}`);
    return res.data;
  },

  async verifyEvidence(evidenceId: string, content: string): Promise<any> {
    const res = await api.post(`/evidence/${evidenceId}/verify`, { content });
    return res.data;
  },

  async captureCameraEvidence(cameraId: string, evidenceType: string = 'SNAPSHOT', notes?: string): Promise<Evidence> {
    const res = await api.post<Evidence>(`/evidence/capture/${cameraId}`, null, {
      params: { evidence_type: evidenceType, notes }
    });
    return res.data;
  },

  async uploadEvidence(file: File, cameraId: string = 'EXTERNAL_IMPORT', evidenceType: string = 'SNAPSHOT'): Promise<Evidence> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('camera_id', cameraId);
    formData.append('evidence_type', evidenceType);
    const res = await api.post<Evidence>('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async deleteEvidence(evidenceId: string): Promise<any> {
    const res = await api.delete(`/evidence/${evidenceId}`);
    return res.data;
  },

  async clearAllEvidence(cameraId?: string): Promise<any> {
    const res = await api.delete('/evidence/clear-all', { params: { camera_id: cameraId } });
    return res.data;
  }
};
