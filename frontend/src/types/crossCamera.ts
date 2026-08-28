export type GlobalTrackStatus = 'CREATED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'EXPIRED';

export type MatchCategory =
  | 'HIGH_CONFIDENCE_MATCH'
  | 'MEDIUM_CONFIDENCE_MATCH'
  | 'LOW_CONFIDENCE_MATCH'
  | 'NO_MATCH';

export type AssociationStatus = 'AUTO_CONFIRMED' | 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';

export type AnomalyType =
  | 'IMPOSSIBLE_TRANSITION'
  | 'ROUTE_DEVIATION'
  | 'PLATE_CONFLICT'
  | 'PROLONGED_PERIMETER_LOITERING';

export interface CameraTransition {
  id: number;
  from_camera_id: string;
  to_camera_id: string;
  min_travel_time_sec: number;
  expected_travel_time_sec: number;
  max_travel_time_sec: number;
  direction: string;
  transition_confidence: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CameraTransitionCreate {
  from_camera_id: string;
  to_camera_id: string;
  min_travel_time_sec?: number;
  expected_travel_time_sec?: number;
  max_travel_time_sec?: number;
  direction?: string;
  transition_confidence?: number;
  is_enabled?: boolean;
}

export interface TrackObservation {
  id: number;
  observation_id: string;
  global_track_id: string;
  camera_id: string;
  local_track_id: number;
  object_type: string;
  timestamp: string;
  bbox_json: string;
  direction: string;
  plate_number?: string;
  plate_confidence?: number;
  confidence: number;
}

export interface TrackAssociation {
  id: number;
  association_id: string;
  global_track_id: string;
  from_observation_id: string;
  to_observation_id: string;
  from_camera_id: string;
  to_camera_id: string;
  association_score: number;
  match_category: MatchCategory;
  status: AssociationStatus;
  reviewed_by?: string;
  review_notes?: string;
  created_at: string;
}

export interface MovementAnomaly {
  id: number;
  anomaly_id: string;
  global_track_id?: string;
  anomaly_type: AnomalyType;
  from_camera_id?: string;
  to_camera_id?: string;
  time_delta_sec?: number;
  expected_time_sec?: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  details: Record<string, any>;
  created_at: string;
}

export interface GlobalTrack {
  id: number;
  global_track_id: string;
  object_type: string;
  primary_identifier?: string;
  status: GlobalTrackStatus;
  current_camera_id: string;
  previous_camera_id?: string;
  last_observation_time: string;
  total_observations: number;
  overall_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface GlobalTrackDetail extends GlobalTrack {
  observations: TrackObservation[];
  associations: TrackAssociation[];
  anomalies: MovementAnomaly[];
}

export interface CrossCameraAnalyticsSummary {
  total_global_tracks: number;
  active_global_tracks: number;
  vehicle_journeys: number;
  movement_anomalies: number;
  pending_association_reviews: number;
  active_transitions_count: number;
}
