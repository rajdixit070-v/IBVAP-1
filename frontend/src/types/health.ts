export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'WARNING' | 'CRITICAL';
export type ComponentStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN' | 'MAINTENANCE';
export type CameraPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface HealthContributor {
  name: string;
  score: number;
  weight: number;
  status: HealthStatus;
  description: string;
}

export interface SystemHealthSummary {
  overall_score: number;
  status: HealthStatus;
  status_label: string;
  contributors: HealthContributor[];
  active_critical_issues: number;
  active_warnings: number;
  calculated_at: string;
}

export interface CameraHealthItem {
  camera_id: string;
  camera_name: string;
  bop_site: string;
  sector: string;
  status: ComponentStatus;
  priority: CameraPriority;
  actual_fps: number;
  expected_fps: number;
  fps_degraded: boolean;
  frame_drops: number;
  stream_latency_ms: number;
  latency_classification: 'NORMAL' | 'ELEVATED' | 'HIGH';
  resolution?: string;
  bitrate_kbps: number;
  uptime_seconds: number;
  reconnect_count: number;
  health_score: number;
  
  // Optical Quality
  image_quality_score: number;
  blur_score: number;
  brightness_score: number;
  contrast_score: number;
  low_light_confidence: number;
  quality_classification: 'GOOD' | 'ACCEPTABLE' | 'POOR';
  
  // Tampering / Obstruction
  tampering_detected: boolean;
  tampering_reason?: string;
  
  // Maintenance
  is_maintenance: boolean;
  maintenance_reason?: string;
  
  last_seen_at?: string;
}

export interface EdgeNodeHealthItem {
  node_id: string;
  name: string;
  bop_site: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE';
  cpu_percent: number;
  memory_percent: number;
  gpu_percent: number;
  disk_percent: number;
  temperature_celsius?: number;
  active_cameras_count: number;
  total_cameras_count: number;
  affected_cameras: string[];
  queued_events_count: number;
  sync_status: string;
  latency_ms: number;
  heartbeat_age_seconds: number;
  is_unresponsive: boolean;
  low_bandwidth_mode: boolean;
  last_heartbeat?: string;
}

export interface ServiceDependencyItem {
  service_name: string;
  component_type: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  latency_ms: number;
  last_successful_operation: string;
  error_rate_percent: number;
  details?: string;
}

export interface NetworkHealthSummary {
  status: 'GOOD' | 'DEGRADED' | 'POOR' | 'OFFLINE';
  average_latency_ms: number;
  packet_loss_percent: number;
  bandwidth_utilization_mbps: number;
  low_bandwidth_mode_active: boolean;
  affected_nodes: string[];
  active_degradations: number;
}

export interface StorageHealthSummary {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  used_percent: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  evidence_storage_gb: number;
  database_size_mb: number;
  temp_files_mb: number;
  retention_days: number;
  estimated_days_remaining: number;
  growth_rate_gb_per_day: number;
  oldest_evidence_date?: string;
}

export interface QueueHealthItem {
  queue_name: string;
  queue_depth: number;
  processing_rate_per_sec: number;
  oldest_item_age_seconds: number;
  failure_count: number;
  status: 'HEALTHY' | 'DEGRADED' | 'BACKLOG';
  estimated_delay_seconds: number;
}

export interface ModelHealthItem {
  model_name: string;
  model_version: string;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  inference_fps: number;
  avg_latency_ms: number;
  error_rate_percent: number;
  data_quality_score: number;
  confidence_avg: number;
  last_execution: string;
  affected_cameras: string[];
}

export interface DiagnosticRecommendation {
  action_type: string;
  recommendation: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DiagnosticResultItem {
  diagnostic_id: string;
  event_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  what_happened: string;
  affected_components: string[];
  possible_root_cause: string;
  confidence_percent: number;
  evidence_signals: string[];
  recommendations: DiagnosticRecommendation[];
  detected_at: string;
  incident_id?: string;
}

export interface HealthEventItem {
  id: number;
  event_id: string;
  event_type: string;
  source_type: string;
  source_id: string;
  severity: string;
  status: string;
  title: string;
  description?: string;
  started_at: string;
  detected_at: string;
  recovered_at?: string;
  downtime_seconds: number;
  incident_id?: string;
}

export interface MaintenanceWindow {
  id: number;
  maintenance_id: string;
  target_type: 'CAMERA' | 'EDGE_NODE' | 'SERVICE';
  target_id: string;
  reason: string;
  authorized_by: string;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  started_at: string;
  expected_end_at?: string;
  ended_at?: string;
}

export interface MaintenanceWindowCreate {
  target_type: 'CAMERA' | 'EDGE_NODE' | 'SERVICE';
  target_id: string;
  reason: string;
  authorized_by?: string;
  duration_minutes: number;
}

export interface HealthConfig {
  heartbeat_timeout_seconds: number;
  fps_degradation_ratio: number;
  stream_latency_elevated_ms: number;
  stream_latency_high_ms: number;
  storage_warning_percent: number;
  storage_critical_percent: number;
  queue_backlog_threshold: number;
  cpu_high_threshold: number;
  memory_high_threshold: number;
  gpu_high_threshold: number;
  notes?: string;
  changed_by?: string;
}
