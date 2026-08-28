export interface AIObservation {
  id: number;
  observation_id: string;
  camera_id: string;
  site_id: string;
  bop_id?: string;
  zone_id?: string;
  track_id?: number;
  global_track_id?: string;
  observation_type: string;
  confidence: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  model_name: string;
  model_version: string;
  bbox_json?: string;
  trajectory_json?: string;
  vehicle_class?: string;
  plate_text?: string;
  plate_ocr_confidence?: number;
  face_match_status?: string;
  face_person_name?: string;
  face_match_confidence?: number;
  lighting_condition: string;
  image_quality_score: number;
  environmental_data_json?: string;
  metadata_json?: string;
  timestamp: string;
}

export interface MultimodalSecurityEvent {
  id: number;
  event_id: string;
  event_group_id: string;
  title: string;
  event_type: string;
  site_id: string;
  bop_id?: string;
  bop_name: string;
  primary_camera_id: string;
  camera_ids_json: string;
  zone_ids_json: string;
  track_ids_json: string;
  global_track_id?: string;
  vehicle_ids_json: string;
  plate_references_json: string;
  face_references_json: string;
  audio_references_json: string;
  signals_json: string;
  confidence: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  risk_level: 'INFORMATIONAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation_json: string;
  timeline_json: string;
  graph_json: string;
  evidence_bundle_json: string;
  status: 'DETECTED' | 'CONFIRMED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE' | 'UNCERTAIN';
  is_cooldown_suppressed: boolean;
  feedback_label?: string;
  feedback_reason?: string;
  feedback_by?: string;
  feedback_at?: string;
  model_versions_json: string;
  event_occurred_at: string;
  created_at: string;
  updated_at?: string;
}

export interface EventTimelineItem {
  stage: 'DETECTION' | 'TRACKING' | 'CONTEXT' | 'CORRELATION' | 'RISK' | 'ALERT' | 'INCIDENT';
  timestamp: string;
  title: string;
  description: string;
  confidence?: number;
  source_component: string;
  evidence_ref?: string;
}

export interface EventGraphNode {
  id: string;
  label: string;
  node_type: 'CAMERA' | 'TRACK' | 'ZONE' | 'CONTEXT' | 'SIGNAL' | 'ANOMALY' | 'RISK';
  status?: string;
  confidence?: number;
  details: Record<string, any>;
}

export interface EventGraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface EventGraphData {
  event_id: string;
  title: string;
  nodes: EventGraphNode[];
  edges: EventGraphEdge[];
  explanation_summary: string;
}

export interface AIModelRegistryItem {
  id: number;
  model_name: string;
  version: string;
  model_type: string;
  status: 'ACTIVE' | 'STANDBY' | 'DEPRECATED' | 'DEGRADED';
  is_active: boolean;
  deployment_profile: 'LOW' | 'BALANCED' | 'HIGH';
  precision: number;
  recall: number;
  f1_score: number;
  false_positive_rate: number;
  false_negative_rate: number;
  latency_ms: number;
  error_rate: number;
  confidence_avg: number;
  parameters_json: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface CameraAIProfile {
  id: number;
  camera_id: string;
  site_id: string;
  bop_id: string;
  profile: 'LOW' | 'BALANCED' | 'HIGH';
  target_fps: number;
  human_detection: boolean;
  vehicle_detection: boolean;
  anpr_enabled: boolean;
  face_detection: boolean;
  tracking_enabled: boolean;
  virtual_fence_enabled: boolean;
  behaviour_analytics: boolean;
  anomaly_detection: boolean;
  audio_analytics: boolean;
  loitering_threshold_seconds: number;
  updated_by: string;
  updated_at?: string;
}

export interface MultimodalOverview {
  active_ai_events: number;
  high_risk_events: number;
  anomalies_count: number;
  tracked_unique_objects: number;
  vehicle_observations_count: number;
  anpr_reads_count: number;
  face_events_count: number;
  overall_multimodal_health: number;
  overall_multimodal_status: string;
  false_positive_rate: number;
  events_by_type: Record<string, number>;
  events_by_severity: Record<string, number>;
  timestamp: string;
}

export interface FeedbackAnalytics {
  total_feedbacks: number;
  valid_count: number;
  false_positive_count: number;
  uncertain_count: number;
  false_positive_rate: number;
  validation_rate: number;
  per_model_stats: Record<string, any>;
  per_event_type_stats: Record<string, any>;
}

export interface AIAssistantResponse {
  query: string;
  parsed_filters: Record<string, any>;
  explanation: string;
  cited_event_ids: string[];
  cited_camera_ids: string[];
  results: MultimodalSecurityEvent[];
  safety_notice: string;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  intensity: number;
  zone_id?: string;
  label?: string;
}

export interface HeatmapData {
  camera_id?: string;
  site_id: string;
  time_frame: string;
  total_data_points: number;
  activity_points: HeatmapPoint[];
  anomaly_points: HeatmapPoint[];
  baseline_deviation_percentage: number;
}

export interface FlowAnalytics {
  time_range_hours: number;
  total_persons_detected: number;
  estimated_unique_persons: number;
  person_entries: number;
  person_exits: number;
  vehicles_per_hour: number;
  total_vehicles: number;
  vehicle_classes_breakdown: Record<string, number>;
  direction_flow_breakdown: Record<string, number>;
}
