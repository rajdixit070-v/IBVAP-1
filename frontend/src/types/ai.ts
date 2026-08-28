export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface TrackedObject {
  track_id: number;
  camera_id: string;
  object_type: string;
  category: 'person' | 'vehicle' | 'animal' | 'drone' | 'other';
  confidence: number;
  bbox: BoundingBox;
  center: Point2D;
  bottom_center: Point2D;
  first_seen_at: string;
  last_seen_at: string;
  frame_count: number;
  speed: number;
  direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'NORTH_EAST' | 'NORTH_WEST' | 'SOUTH_EAST' | 'SOUTH_WEST' | 'STATIONARY' | 'UNKNOWN';
  tracking_state: 'DETECTED' | 'TRACKING' | 'TEMPORARILY_LOST' | 'REACQUIRED' | 'EXPIRED';
  trajectory: Point2D[];
}

export interface CameraAICounters {
  people: number;
  vehicles: number;
  animals: number;
  other: number;
  total_tracks: number;
}

export interface CameraAIStatus {
  camera_id: string;
  status: 'ACTIVE' | 'STARTING' | 'PAUSED' | 'ERROR' | 'NO_STREAM';
  inference_fps: number;
  latency_ms: number;
  frames_processed: number;
  frames_skipped: number;
  active_tracks_count: number;
  counters: CameraAICounters;
  device: string;
  model_name: string;
  error_message?: string | null;
}

export interface CameraAIConfig {
  camera_id: string;
  enabled: boolean;
  model_name: string;
  target_fps: number;
  input_size: number;
  device: string;
  conf_person: number;
  conf_vehicle: number;
  conf_animal: number;
  conf_drone: number;
  conf_other: number;
  track_thresh: number;
  match_thresh: number;
  max_lost_frames: number;
  max_trajectory_length: number;
}

export interface CameraAIConfigUpdate {
  enabled?: boolean;
  model_name?: string;
  target_fps?: number;
  conf_person?: number;
  conf_vehicle?: number;
  conf_animal?: number;
  conf_drone?: number;
  conf_other?: number;
  track_thresh?: number;
  match_thresh?: number;
}

export interface AIRealTimeTelemetryMessage {
  event: string;
  camera_id: string;
  timestamp: string;
  status: 'ACTIVE' | 'STARTING' | 'PAUSED' | 'ERROR' | 'NO_STREAM';
  inference_fps: number;
  latency_ms: number;
  counters: CameraAICounters;
  tracks: TrackedObject[];
}

export interface AIMetrics {
  active_workers: number;
  total_cameras_configured: number;
  total_frames_processed: number;
  avg_latency_ms: number;
  total_active_tracks: number;
  model: string;
  device: string;
}
