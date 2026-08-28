import api from './api';
import {
  ActivityTimeSeriesResponse,
  ForecastResponse,
  EarlyWarning,
  HotspotZone,
  RecommendedAttentionResponse,
  BaselineShift,
  ModelHealth
} from '../types/predictive';

export const predictiveService = {
  async getActivityTimeSeries(params?: {
    target_type?: string;
    target_id?: string;
    window_minutes?: number;
    history_points?: number;
  }): Promise<ActivityTimeSeriesResponse> {
    const response = await api.get<ActivityTimeSeriesResponse>('/predictive/activity', { params });
    return response.data;
  },

  async getForecast(params?: {
    target_type?: string;
    target_id?: string;
    horizon_minutes?: number;
  }): Promise<ForecastResponse> {
    const response = await api.get<ForecastResponse>('/predictive/forecast', { params });
    return response.data;
  },

  async getEarlyWarnings(params?: {
    warning_level?: string;
    lifecycle_status?: string;
    camera_id?: string;
    limit?: number;
  }): Promise<EarlyWarning[]> {
    const response = await api.get<EarlyWarning[]>('/predictive/warnings', { params });
    return response.data;
  },

  async acknowledgeWarning(warningId: string, actorUsername = 'operator'): Promise<EarlyWarning> {
    const response = await api.post<EarlyWarning>(`/predictive/warnings/${warningId}/acknowledge`, {
      actor_username: actorUsername
    });
    return response.data;
  },

  async dismissWarning(warningId: string, notes = '', actorUsername = 'operator'): Promise<EarlyWarning> {
    const response = await api.post<EarlyWarning>(`/predictive/warnings/${warningId}/dismiss`, {
      actor_username: actorUsername,
      notes
    });
    return response.data;
  },

  async getHotspots(): Promise<HotspotZone[]> {
    const response = await api.get<HotspotZone[]>('/predictive/hotspots');
    return response.data;
  },

  async getRecommendedAttention(): Promise<RecommendedAttentionResponse> {
    const response = await api.get<RecommendedAttentionResponse>('/predictive/recommended-attention');
    return response.data;
  },

  async getBaselineShifts(status?: string): Promise<BaselineShift[]> {
    const response = await api.get<BaselineShift[]>('/predictive/baseline-shifts', { params: { status } });
    return response.data;
  },

  async approveBaselineShift(shiftId: string, approve: boolean, notes?: string): Promise<BaselineShift> {
    const response = await api.post<BaselineShift>(`/predictive/baseline-shifts/${shiftId}/approve`, {
      approve,
      notes,
      reviewed_by: 'admin'
    });
    return response.data;
  },

  async getModelHealth(): Promise<ModelHealth> {
    const response = await api.get<ModelHealth>('/predictive/model-health');
    return response.data;
  },

  async submitFeedback(data: {
    warning_id: string;
    feedback_type: 'USEFUL_FORECAST' | 'FALSE_PREDICTION' | 'INCONCLUSIVE';
    notes?: string;
    operator_username?: string;
  }) {
    const response = await api.post('/predictive/feedback', data);
    return response.data;
  }
};
