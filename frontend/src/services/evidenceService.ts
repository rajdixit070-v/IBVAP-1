import api from './api';
import { Evidence } from '../types/incident';

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
  }
};
