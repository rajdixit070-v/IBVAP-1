import { BoundingBox } from './ai';

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
}

export interface EventTimelineEntry {
  timestamp: string;
  message: string;
}

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EventStatus = 'DETECTED' | 'CONFIRMED' | 'ACTIVE' | 'ACKNOWLEDGED' | 'EXPIRED' | 'DISMISSED' | 'RESOLVED';

export interface SecurityEvent {
  id: number;
  event_id: string;
  camera_id: string;
  zone_id?: string;
  zone_name?: string;
  track_id: number;
  object_type: string;
  event_type: string;
  severity: string;
  risk_score: number;
  risk_level: RiskLevel;
  status: EventStatus;
  environment: string;
  location_description?: string;
  factors: RiskFactor[];
  timeline: EventTimelineEntry[];
  last_bbox?: BoundingBox;
  last_direction?: string;
  last_speed: number;
  evidence_id?: string;
  evidence_url?: string;
  started_at: string;
  last_updated_at: string;
}

export interface SecurityEventsSummary {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_active: number;
  recent_events: SecurityEvent[];
}

export interface SystemRiskConfig {
  weight_restricted_zone: number;
  weight_fence_crossing: number;
  weight_forbidden_direction: number;
  weight_night_movement: number;
  weight_loitering: number;
  weight_stationary_vehicle: number;
  weight_group_movement: number;
  weight_rapid_movement: number;
  penalty_low_confidence: number;
  loitering_duration_sec: number;
  stationary_vehicle_duration_sec: number;
  group_max_distance_norm: number;
  event_cooldown_sec: number;
  night_start_hour: number;
  night_end_hour: number;
}
