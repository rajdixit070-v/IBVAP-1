import api from './api';
import {
  CameraTransition,
  CameraTransitionCreate,
  GlobalTrack,
  GlobalTrackDetail,
  TrackAssociation,
  MovementAnomaly,
  CrossCameraAnalyticsSummary
} from '../types/crossCamera';

export const crossCameraService = {
  // Graph
  async getCameraGraph(): Promise<CameraTransition[]> {
    const response = await api.get<CameraTransition[]>('/cross-camera/graph');
    return response.data;
  },

  async createTransition(data: CameraTransitionCreate): Promise<CameraTransition> {
    const response = await api.post<CameraTransition>('/cross-camera/graph/transitions', data);
    return response.data;
  },

  async updateTransition(id: number, data: Partial<CameraTransitionCreate>): Promise<CameraTransition> {
    const response = await api.put<CameraTransition>(`/cross-camera/graph/transitions/${id}`, data);
    return response.data;
  },

  // Global Tracks
  async getGlobalTracks(params?: {
    status?: string;
    object_type?: string;
    search?: string;
    limit?: number;
    skip?: number;
  }): Promise<GlobalTrack[]> {
    const response = await api.get<GlobalTrack[]>('/cross-camera/tracks', { params });
    return response.data;
  },

  async getGlobalTrackDetail(globalTrackId: string): Promise<GlobalTrackDetail> {
    const response = await api.get<GlobalTrackDetail>(`/cross-camera/tracks/${globalTrackId}`);
    return response.data;
  },

  // Association Review
  async reviewAssociation(
    associationId: string,
    action: 'CONFIRM' | 'REJECT',
    notes?: string,
    operatorUsername?: string
  ): Promise<TrackAssociation> {
    const response = await api.post<TrackAssociation>(`/cross-camera/associations/${associationId}/review`, {
      action,
      notes,
      operator_username: operatorUsername || 'operator'
    });
    return response.data;
  },

  // Anomalies
  async getMovementAnomalies(params?: { anomaly_type?: string; severity?: string; limit?: number }): Promise<MovementAnomaly[]> {
    const response = await api.get<MovementAnomaly[]>('/cross-camera/anomalies', { params });
    return response.data;
  },

  // Analytics
  async getAnalyticsSummary(): Promise<CrossCameraAnalyticsSummary> {
    const response = await api.get<CrossCameraAnalyticsSummary>('/cross-camera/analytics/summary');
    return response.data;
  }
};
