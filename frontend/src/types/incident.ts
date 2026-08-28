export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentType = 'SECURITY' | 'INFRASTRUCTURE';
export type IncidentStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'INVESTIGATING'
  | 'RESPONDING'
  | 'CONTAINED'
  | 'ESCALATED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'FALSE_ALARM'
  | 'DISMISSED';

export interface TimelineEvent {
  timestamp: string;
  action: string;
  actor: string;
  notes?: string;
}

export interface PlaybookStepItem {
  step_id: number;
  title: string;
  required: boolean;
  action?: string;
  is_completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
  notes?: string | null;
}

export interface IncidentPlaybook {
  id: number;
  playbook_id: string;
  name: string;
  event_type: string;
  description?: string;
  steps: PlaybookStepItem[];
  is_enabled: boolean;
  created_at: string;
}

export interface IncidentReview {
  id: number;
  review_id: string;
  incident_id: string;
  outcome_category: 'TRUE_EVENT' | 'FALSE_ALARM' | 'ENVIRONMENTAL' | 'INFRASTRUCTURE' | 'AUTHORIZED_ACTIVITY' | 'UNKNOWN';
  root_cause?: string;
  preventative_actions?: string;
  calibration_recommended: boolean;
  operator_username: string;
  reviewed_at: string;
}

export interface Alert {
  id: number;
  alert_id: string;
  event_id: string;
  camera_id: string;
  bop_site: string;
  title: string;
  priority: IncidentPriority;
  risk_score: number;
  status: 'NEW' | 'ACKNOWLEDGED' | 'DISMISSED' | 'ESCALATED';
  assigned_to?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  escalation_deadline?: string;
  is_escalated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  notification_id: string;
  title: string;
  message: string;
  priority?: IncidentPriority;
  severity?: IncidentPriority;
  channel: string;
  read?: boolean;
  is_read?: boolean;
  incident_id?: string;
  alert_id?: string;
  created_at: string;
}

export interface Evidence {
  id: number;
  evidence_id: string;
  source_event_id?: string;
  incident_id?: string;
  camera_id: string;
  evidence_type: 'SNAPSHOT' | 'PLATE_CROP' | 'FACE_CROP' | 'VIDEO_CLIP' | 'TELEMETRY';
  file_path: string;
  checksum_sha256: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface IncidentCreate {
  title: string;
  description?: string;
  priority: IncidentPriority;
  incident_type?: IncidentType;
  source_event_id?: string;
  camera_id: string;
  bop_site?: string;
  zone_name?: string;
  track_id?: number;
  risk_score?: number;
  assigned_to?: string;
  assigned_team?: string;
  assigned_unit?: string;
  playbook_id?: string;
}

export interface Incident {
  id: number;
  incident_id: string;
  title: string;
  description?: string;
  incident_type: IncidentType;
  priority: IncidentPriority;
  status: IncidentStatus;
  escalation_level: number;
  escalation_due_at?: string;
  false_alarm_reason?: string;
  false_alarm_notes?: string;
  resolution_notes?: string;
  resolution_category?: string;
  source_event_id?: string;
  camera_id: string;
  bop_site: string;
  zone_name?: string;
  track_id: number;
  global_track_id?: string;
  risk_score: number;
  related_cameras: string[];
  parent_incident_id?: string;
  playbook_id?: string;
  checklist: PlaybookStepItem[];
  review?: Record<string, any>;
  assigned_to?: string;
  assigned_team?: string;
  assigned_unit?: string;
  assigned_at?: string;
  assigned_by?: string;
  evidence_ids: string[];
  timeline: TimelineEvent[];
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  closed_at?: string;
  closed_by?: string;
  time_to_acknowledge_sec?: number;
  time_to_resolve_sec?: number;
}

export interface IncidentAnalyticsSummary {
  total_incidents: number;
  active_incidents: number;
  critical_incidents: number;
  resolved_incidents: number;
  false_alarm_count: number;
  false_alarm_rate_percent: number;
  avg_mtta_seconds: number;
  avg_mttr_seconds: number;
  incidents_by_severity: Record<string, number>;
  incidents_by_bop: Record<string, number>;
  incidents_by_type: Record<string, number>;
}
