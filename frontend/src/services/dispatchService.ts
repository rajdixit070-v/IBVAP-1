import api from './api';
import { BOPDispatch, BOPDispatchCreateInput } from '../types/dispatch';

class DispatchService {
  async listDispatches(params?: { bop_id?: string; status?: string; priority?: string }): Promise<BOPDispatch[]> {
    const res = await api.get('/dispatches', { params });
    return res.data;
  }

  async createDispatch(input: BOPDispatchCreateInput): Promise<BOPDispatch> {
    const res = await api.post('/dispatches', input);
    return res.data;
  }

  async quickSendEvidence(evidenceId: string, priority: string = 'URGENT', notes?: string): Promise<BOPDispatch> {
    const res = await api.post('/dispatches/quick-send-evidence', {
      evidence_id: evidenceId,
      priority,
      officer_notes: notes
    });
    return res.data;
  }

  async acknowledgeDispatch(dispatchId: string, hqNotes: string, status: string = 'ACKNOWLEDGED_BY_HQ'): Promise<BOPDispatch> {
    const res = await api.post(`/dispatches/${dispatchId}/acknowledge`, {
      status,
      hq_notes: hqNotes
    });
    return res.data;
  }
}

export const dispatchService = new DispatchService();
