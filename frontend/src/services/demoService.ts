import api from './api';

export interface DemoStatus {
  demo_active: boolean;
  total_records: number;
  counts: {
    cameras: number;
    edge_nodes: number;
    alerts: number;
    security_events: number;
    incidents: number;
    anpr_events: number;
    face_events: number;
    evidence_snapshots: number;
    global_tracks: number;
  };
}

export interface ThreatSimulatedResponse {
  status: string;
  event_id: string;
  alert_id: string;
  camera_id: string;
  title: string;
  priority: string;
  risk_score: number;
  timestamp: string;
}

export const demoService = {
  async getStatus(): Promise<DemoStatus> {
    const response = await api.get<DemoStatus>('/demo/status');
    return response.data;
  },

  async loadDemo(): Promise<DemoStatus> {
    const response = await api.post<DemoStatus>('/demo/load');
    return response.data;
  },

  async cleanDemo(): Promise<DemoStatus> {
    const response = await api.post<DemoStatus>('/demo/clean');
    return response.data;
  },

  async simulateThreat(): Promise<ThreatSimulatedResponse> {
    const response = await api.post<ThreatSimulatedResponse>('/demo/simulate-threat');
    return response.data;
  }
};
