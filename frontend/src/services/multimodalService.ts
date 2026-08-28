import api from './api';
import {
  AIObservation,
  MultimodalSecurityEvent,
  EventTimelineItem,
  EventGraphData,
  AIModelRegistryItem,
  CameraAIProfile,
  MultimodalOverview,
  FeedbackAnalytics,
  AIAssistantResponse,
  HeatmapData,
  FlowAnalytics
} from '../types/multimodal';

export const multimodalService = {
  // Overview
  getOverview: async (siteId?: string, bopId?: string): Promise<MultimodalOverview> => {
    const params: any = {};
    if (siteId) params.site_id = siteId;
    if (bopId) params.bop_id = bopId;
    const res = await api.get<MultimodalOverview>('/multimodal/overview', { params });
    return res.data;
  },

  // Observations
  listObservations: async (params?: { camera_id?: string; observation_type?: string; limit?: number }): Promise<AIObservation[]> => {
    const res = await api.get<AIObservation[]>('/multimodal/observations', { params });
    return res.data;
  },

  recordObservation: async (data: Partial<AIObservation>): Promise<AIObservation> => {
    const res = await api.post<AIObservation>('/multimodal/observations', data);
    return res.data;
  },

  // Events
  listEvents: async (params?: { site_id?: string; bop_id?: string; event_type?: string; risk_level?: string; limit?: number }): Promise<MultimodalSecurityEvent[]> => {
    const res = await api.get<MultimodalSecurityEvent[]>('/multimodal/events', { params });
    return res.data;
  },

  getEventDetail: async (eventId: string): Promise<MultimodalSecurityEvent> => {
    const res = await api.get<MultimodalSecurityEvent>(`/multimodal/events/${eventId}`);
    return res.data;
  },

  getEventTimeline: async (eventId: string): Promise<EventTimelineItem[]> => {
    const res = await api.get<EventTimelineItem[]>(`/multimodal/events/${eventId}/timeline`);
    return res.data;
  },

  getEventGraph: async (eventId: string): Promise<EventGraphData> => {
    const res = await api.get<EventGraphData>(`/multimodal/events/${eventId}/graph`);
    return res.data;
  },

  submitFeedback: async (eventId: string, label: string, reason?: string): Promise<{ message: string; event_id: string; label: string }> => {
    const res = await api.post(`/multimodal/events/${eventId}/feedback`, { label, reason });
    return res.data;
  },

  getFeedbackAnalytics: async (): Promise<FeedbackAnalytics> => {
    const res = await api.get<FeedbackAnalytics>('/multimodal/feedback/analytics');
    return res.data;
  },

  // Search & Assistant
  search: async (params: { q?: string; event_type?: string; camera_id?: string; site_id?: string; bop_id?: string; risk_level?: string; min_confidence?: number; limit?: number }): Promise<MultimodalSecurityEvent[]> => {
    const res = await api.post<MultimodalSecurityEvent[]>('/multimodal/search', params);
    return res.data;
  },

  queryAssistant: async (query: string, siteId?: string, bopId?: string): Promise<AIAssistantResponse> => {
    const res = await api.post<AIAssistantResponse>('/multimodal/assistant/query', { query, site_id: siteId, bop_id: bopId });
    return res.data;
  },

  // Analytics & Heatmaps
  getFlows: async (siteId?: string, bopId?: string, hours: number = 24): Promise<FlowAnalytics> => {
    const params: any = { hours };
    if (siteId) params.site_id = siteId;
    if (bopId) params.bop_id = bopId;
    const res = await api.get<FlowAnalytics>('/multimodal/analytics/flows', { params });
    return res.data;
  },

  getHeatmaps: async (siteId: string = 'SITE-BORDER-NORTH', cameraId?: string, timeFrame: string = 'day'): Promise<HeatmapData> => {
    const params: any = { site_id: siteId, time_frame: timeFrame };
    if (cameraId) params.camera_id = cameraId;
    const res = await api.get<HeatmapData>('/multimodal/analytics/heatmaps', { params });
    return res.data;
  },

  // Models
  listModels: async (): Promise<AIModelRegistryItem[]> => {
    const res = await api.get<AIModelRegistryItem[]>('/multimodal/models');
    return res.data;
  },

  registerModel: async (data: Partial<AIModelRegistryItem>): Promise<AIModelRegistryItem> => {
    const res = await api.post<AIModelRegistryItem>('/multimodal/models', data);
    return res.data;
  },

  rollbackModel: async (modelId: number): Promise<{ message: string; active_model_id: number }> => {
    const res = await api.post(`/multimodal/models/${modelId}/rollback`);
    return res.data;
  },

  // Camera Profiles
  listProfiles: async (): Promise<CameraAIProfile[]> => {
    const res = await api.get<CameraAIProfile[]>('/multimodal/profiles');
    return res.data;
  },

  updateProfile: async (cameraId: string, data: Partial<CameraAIProfile>): Promise<CameraAIProfile> => {
    const res = await api.put<CameraAIProfile>(`/multimodal/profiles/${cameraId}`, data);
    return res.data;
  },

  // Export
  exportEventsUrl: (format: 'csv' | 'json' = 'csv'): string => {
    return `/api/v1/multimodal/export?format=${format}`;
  }
};
