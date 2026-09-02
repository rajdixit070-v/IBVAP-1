import api from './api';

export interface CameraPair {
  id: number;
  pair_id: string;
  rgb_camera_id: string;
  thermal_camera_id: string;
  site_id: string;
  bop_id?: string;
  calibration_transform_json: string;
  overlap_area_json: string;
  overlap_ratio: number;
  sync_tolerance_ms: number;
  fusion_mode: 'RGB_ONLY' | 'THERMAL_ONLY' | 'FUSED';
  status: 'ACTIVE' | 'DEGRADED' | 'CALIBRATING' | 'OFFLINE';
  degradation_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ThermalFusionResult {
  result_id: string;
  pair_id: string;
  rgb_camera_id: string;
  thermal_camera_id: string;
  rgb_confidence: number;
  thermal_confidence: number;
  fused_confidence: number;
  fusion_mode_applied: string;
  lighting_condition: string;
  detections_json: string;
  has_heat_anomaly: boolean;
  has_thermal_obstruction: boolean;
  timestamp: string;
}

export const thermalService = {
  async getCameraPairs(params?: { site_id?: string; status?: string }): Promise<CameraPair[]> {
    const res = await api.get<CameraPair[]>('/thermal/pairs', { params });
    return res.data;
  },

  async getPairById(pairId: string): Promise<CameraPair> {
    const res = await api.get<CameraPair>(`/thermal/pairs/${pairId}`);
    return res.data;
  },

  async createCameraPair(data: Partial<CameraPair>): Promise<CameraPair> {
    const res = await api.post<CameraPair>('/thermal/pairs', data);
    return res.data;
  },

  async updateCameraPair(pairId: string, data: Partial<CameraPair>): Promise<CameraPair> {
    const res = await api.put<CameraPair>(`/thermal/pairs/${pairId}`, data);
    return res.data;
  },

  async executeFusion(payload: {
    pair_id: string;
    rgb_detections: any[];
    thermal_detections: any[];
    lighting_condition?: string;
  }): Promise<ThermalFusionResult> {
    const res = await api.post<ThermalFusionResult>('/thermal/fusion/execute', payload);
    return res.data;
  },

  async getFusionResults(pairId?: string, limit = 50): Promise<ThermalFusionResult[]> {
    const res = await api.get<ThermalFusionResult[]>('/thermal/fusion/results', {
      params: { pair_id: pairId, limit }
    });
    return res.data;
  }
};

