export type CameraStatus = 'HEALTHY' | 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'ERROR' | 'CONNECTING' | 'MAINTENANCE';
export type CameraSourceType = 'rtsp' | 'nvr' | 'dvr' | 'webcam' | 'drone' | 'android' | 'thermal' | 'ptz';

export interface Camera {
  id: number;
  camera_id: string;
  camera_name: string;
  description?: string;
  bop_site: string;
  bop_id?: string;
  site_id?: string;
  sector: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  rtsp_url: string;
  sub_stream_url?: string;
  edge_node_id?: string;
  username?: string;
  has_password?: boolean;
  stream_type: string;
  resolution?: string;
  fps: number;
  expected_fps?: number;
  frame_drops?: number;
  stream_latency_ms?: number;
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  is_maintenance?: boolean;
  image_quality_score?: number;
  tampering_detected?: boolean;
  codec?: string;
  enabled: boolean;
  status: CameraStatus;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CameraCreateInput {
  camera_id: string;
  camera_name: string;
  description?: string;
  bop_site: string;
  sector: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  rtsp_url: string;
  sub_stream_url?: string;
  edge_node_id?: string;
  username?: string;
  password?: string;
  stream_type?: string;
  enabled?: boolean;
}

export interface CameraUpdateInput {
  camera_name?: string;
  description?: string;
  bop_site?: string;
  sector?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  rtsp_url?: string;
  sub_stream_url?: string;
  edge_node_id?: string;
  username?: string;
  password?: string;
  stream_type?: string;
  enabled?: boolean;
}

export interface CameraTestRequest {
  rtsp_url: string;
  username?: string;
  password?: string;
  timeout_sec?: number;
}

export interface CameraTestResponse {
  success: boolean;
  connected: boolean;
  resolution?: string;
  fps?: number;
  codec?: string;
  latency_ms?: number;
  error_type?: string;
  error_message?: string;
  details?: Record<string, any>;
}

export interface CameraHealthStatus {
  camera_id: string;
  status: CameraStatus;
  is_streaming: boolean;
  fps: number;
  resolution?: string;
  latest_frame_time?: string;
  last_seen_at?: string;
  reconnect_attempts: number;
  latency_ms?: number;
  error_message?: string;
}

export interface CameraSummaryStats {
  total_cameras: number;
  healthy: number;
  degraded: number;
  offline: number;
  error: number;
  bop_summary: Record<string, { total: number; healthy: number; degraded: number; offline: number }>;
}

export interface CameraDiagnosticLog {
  id: number;
  camera_id: string;
  event_type: string;
  status: string;
  details?: string;
  fps: number;
  timestamp: string;
}
