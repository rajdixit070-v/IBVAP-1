import api from './api';

export interface Sensor {
  id: number;
  sensor_id: string;
  name: string;
  sensor_type: 'CAMERA' | 'THERMAL' | 'RADAR' | 'ACOUSTIC' | 'SEISMIC' | 'WEATHER' | 'DRONE' | 'OTHER';
  site_id: string;
  bop_id?: string;
  sector: string;
  zone_id?: string;
  camera_id?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  altitude_m?: number;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'MAINTENANCE';
  health_score: number;
  latency_ms: number;
  packet_loss_pct: number;
  battery_pct?: number;
  temperature_c?: number;
  signal_quality_pct: number;
  capabilities_json?: string;
  config_json?: string;
  reliability_weight: number;
  last_seen_at?: string;
  created_at?: string;
}

export interface SensorTelemetry {
  telemetry_id: string;
  sensor_id: string;
  timestamp: string;
  battery_pct?: number;
  temperature_c?: number;
  signal_strength_dbm?: number;
  status: string;
  reading_value?: number;
  reading_unit?: string;
  raw_payload_json?: string;
}

export interface SensorFusionEvent {
  fusion_event_id: string;
  site_id: string;
  bop_id?: string;
  sector?: string;
  zone_id?: string;
  fused_event_type: string;
  confidence: number;
  confidence_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  conflict_status: 'NONE' | 'CONFLICTING_SENSORS' | 'DEGRADED_CONSENSUS';
  fusion_method: string;
  source_sensor_ids_json: string;
  individual_observations_json: string;
  confidence_explanation_json: string;
  location_json: string;
  track_id?: number;
  global_track_id?: string;
  risk_score: number;
  is_acknowledged: boolean;
  timestamp: string;
}

export const sensorService = {
  async getSensors(params?: { site_id?: string; bop_id?: string; sensor_type?: string; status?: string }): Promise<Sensor[]> {
    const res = await api.get<Sensor[]>('/sensors', { params });
    return res.data;
  },

  async getSensorById(sensorId: string): Promise<Sensor> {
    const res = await api.get<Sensor>(`/sensors/${sensorId}`);
    return res.data;
  },

  async registerSensor(data: Partial<Sensor>): Promise<Sensor> {
    const res = await api.post<Sensor>('/sensors', data);
    return res.data;
  },

  async updateSensor(sensorId: string, data: Partial<Sensor>): Promise<Sensor> {
    const res = await api.put<Sensor>(`/sensors/${sensorId}`, data);
    return res.data;
  },

  async deleteSensor(sensorId: string): Promise<any> {
    const res = await api.delete(`/sensors/${sensorId}`);
    return res.data;
  },

  async recordTelemetry(sensorId: string, data: Partial<SensorTelemetry>): Promise<SensorTelemetry> {
    const res = await api.post<SensorTelemetry>(`/sensors/${sensorId}/telemetry`, data);
    return res.data;
  },

  async getTelemetryHistory(sensorId: string, limit = 50): Promise<SensorTelemetry[]> {
    const res = await api.get<SensorTelemetry[]>(`/sensors/${sensorId}/telemetry`, { params: { limit } });
    return res.data;
  },

  async executeMultiSensorFusion(payload: {
    site_id?: string;
    bop_id?: string;
    sector?: string;
    observations: any[];
    time_window_sec?: number;
  }): Promise<SensorFusionEvent> {
    const res = await api.post<SensorFusionEvent>('/sensors/fusion/correlate', payload);
    return res.data;
  },

  async getFusionEvents(params?: { site_id?: string; bop_id?: string; limit?: number }): Promise<SensorFusionEvent[]> {
    const res = await api.get<SensorFusionEvent[]>('/sensors/fusion/events', { params });
    return res.data;
  },

  async clearFusionEvents(): Promise<{ status: string; message: string; deleted_count: number }> {
    const res = await api.delete<{ status: string; message: string; deleted_count: number }>('/sensors/fusion/events');
    return res.data;
  }
};

