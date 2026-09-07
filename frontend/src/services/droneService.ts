import api from './api';

export interface Drone {
  id: number;
  drone_id: string;
  name: string;
  model: string;
  site_id: string;
  bop_id?: string;
  status: 'AVAILABLE' | 'MISSION' | 'PATROL' | 'RETURNING' | 'CHARGING' | 'MAINTENANCE' | 'OFFLINE';
  battery_pct: number;
  latitude: number;
  longitude: number;
  altitude_m: number;
  heading_deg: number;
  speed_mps: number;
  flight_state: 'TAKEOFF' | 'CRUISE' | 'HOVER' | 'TRACKING' | 'RTH' | 'LANDED';
  gps_satellites: number;
  link_quality_pct: number;
  camera_stream_url?: string;
  camera_gimbal_pitch: number;
  capabilities_json?: string;
  last_seen_at?: string;
}

export interface DroneMission {
  id: number;
  mission_id: string;
  drone_id: string;
  site_id: string;
  bop_id?: string;
  mission_type: 'PATROL' | 'INTERCEPT' | 'TRACK_TARGET' | 'RECONNAISSANCE' | 'EMERGENCY_RESPONSE';
  status: 'DRAFT' | 'PLANNED' | 'AUTHORIZED' | 'DISPATCHED' | 'ACTIVE' | 'COMPLETED' | 'ABORTED' | 'PAUSED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  objective: string;
  target_track_id?: number;
  global_track_id?: string;
  waypoints_json: string;
  geofence_boundary_json: string;
  max_duration_sec: number;
  min_battery_threshold: number;
  dispatched_by_user: string;
  start_time?: string;
  end_time?: string;
  abort_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface DroneHandoffEvent {
  handoff_id: string;
  source_type: 'CAMERA' | 'DRONE';
  source_id: string;
  destination_type: 'DRONE' | 'CAMERA';
  destination_id: string;
  global_track_id: string;
  target_class: string;
  confidence: number;
  reason?: string;
  location_lat?: number;
  location_lng?: number;
  evidence_json?: string;
  timestamp: string;
}

export const droneService = {
  async getDrones(params?: { site_id?: string; status?: string }): Promise<Drone[]> {
    const res = await api.get<Drone[]>('/drones', { params });
    return res.data;
  },

  async getDroneById(droneId: string): Promise<Drone> {
    const res = await api.get<Drone>(`/drones/${droneId}`);
    return res.data;
  },

  async registerDrone(data: Partial<Drone>): Promise<Drone> {
    const res = await api.post<Drone>('/drones', data);
    return res.data;
  },

  async updateTelemetry(droneId: string, telemetry: {
    latitude: number;
    longitude: number;
    altitude_m: number;
    heading_deg: number;
    speed_mps: number;
    battery_pct: number;
    flight_state: string;
    gps_satellites: number;
    link_quality_pct: number;
    camera_gimbal_pitch?: number;
  }): Promise<Drone> {
    const res = await api.post<Drone>(`/drones/${droneId}/telemetry`, telemetry);
    return res.data;
  },

  async getMissions(params?: { site_id?: string; status?: string }): Promise<DroneMission[]> {
    const res = await api.get<DroneMission[]>('/drones/missions/list', { params });
    return res.data;
  },

  async createMission(data: {
    drone_id: string;
    site_id?: string;
    mission_type: string;
    priority?: string;
    objective: string;
    target_track_id?: number;
    global_track_id?: string;
    waypoints_json?: string;
    geofence_boundary_json?: string;
    max_duration_sec?: number;
  }): Promise<DroneMission> {
    const res = await api.post<DroneMission>('/drones/missions', data);
    return res.data;
  },

  async dispatchMission(missionId: string): Promise<DroneMission> {
    const res = await api.post<DroneMission>(`/drones/missions/${missionId}/dispatch`);
    return res.data;
  },

  async abortMission(missionId: string, reason?: string): Promise<DroneMission> {
    const res = await api.post<DroneMission>(`/drones/missions/${missionId}/abort`, null, {
      params: { reason }
    });
    return res.data;
  },

  async executeHandoff(data: {
    source_type: 'CAMERA' | 'DRONE';
    source_id: string;
    destination_type: 'DRONE' | 'CAMERA';
    destination_id: string;
    global_track_id: string;
    target_class?: string;
    location_lat?: number;
    location_lng?: number;
    reason?: string;
  }): Promise<DroneHandoffEvent> {
    const res = await api.post<DroneHandoffEvent>('/drones/handoff', data);
    return res.data;
  },

  async getHandoffHistory(globalTrackId?: string, limit = 50): Promise<DroneHandoffEvent[]> {
    const res = await api.get<DroneHandoffEvent[]>('/drones/handoff/history', {
      params: { global_track_id: globalTrackId, limit }
    });
    return res.data;
  },

  async deleteHandoff(handoffId: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/drones/handoff/${handoffId}`);
    return res.data;
  },

  async clearHandoffHistory(): Promise<{ message: string; deleted_count: number }> {
    const res = await api.delete<{ message: string; deleted_count: number }>('/drones/handoff/clear');
    return res.data;
  },

  async deleteDrone(droneId: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/drones/${droneId}`);
    return res.data;
  },

  async deleteMission(missionId: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/drones/missions/${missionId}`);
    return res.data;
  },

  async clearAllDrones(): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>('/drones/clear-all');
    return res.data;
  }
};


