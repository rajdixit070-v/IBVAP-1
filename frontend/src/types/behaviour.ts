export type RiskLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export type BehaviourEventType =
  | 'BEHAVIOUR_ANOMALY'
  | 'REPEATED_APPROACH'
  | 'POTENTIAL_PERIMETER_PROBING_PATTERN'
  | 'FENCE_EDGE_MOVEMENT'
  | 'DIRECTION_ANOMALY'
  | 'RAPID_DIRECTION_CHANGE'
  | 'STOP_GO_ANOMALY'
  | 'SUDDEN_SPEED_CHANGE'
  | 'ACTIVITY_DENSITY_ANOMALY'
  | 'VEHICLE_DWELL_ANOMALY'
  | 'REPEATED_VEHICLE_VISIT'
  | 'AFTER_HOURS_ACTIVITY'
  | 'POTENTIAL_ABANDONED_OBJECT'
  | 'LEFT_BEHIND_OBJECT'
  | 'ROUTE_ANOMALY'
  | 'REPEATED_ROUTE_ANOMALY'
  | 'BASELINE_ACTIVITY_ANOMALY'
  | 'IMPOSSIBLE_MOVEMENT_PATTERN';

export interface RiskFactorItem {
  factor: string;
  weight: number;
  description: string;
}

export interface CounterSignalItem {
  signal: string;
  mitigation: number;
  description: string;
}

export interface ExplainableRiskResponse {
  risk_score: number;
  decayed_risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  factors: RiskFactorItem[];
  counter_factors: CounterSignalItem[];
  decay_explanation?: string;
}

export interface BehaviourEvent {
  id: number;
  event_id: string;
  global_track_id?: string;
  camera_id: string;
  local_track_id?: number;
  object_type: string;
  event_type: BehaviourEventType | string;
  risk_score: number;
  decayed_risk_score: number;
  risk_level: RiskLevel;
  confidence: number;
  zone_id?: string;
  zone_name?: string;
  factors: RiskFactorItem[];
  counter_factors: CounterSignalItem[];
  details: Record<string, any>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BehaviourRule {
  id: number;
  rule_id: string;
  name: string;
  description?: string;
  event_type: string;
  is_enabled: boolean;
  dwell_threshold_sec: number;
  stop_count_threshold: number;
  speed_threshold_ms: number;
  direction_change_threshold: number;
  after_hours_start: string;
  after_hours_end: string;
  base_risk_weight: number;
  max_risk_cap: number;
  cooldown_sec: number;
  rule_version: number;
  changed_by: string;
  created_at: string;
  updated_at: string;
}

export interface BehaviourRuleCreate {
  rule_id: string;
  name: string;
  description?: string;
  event_type: string;
  is_enabled?: boolean;
  dwell_threshold_sec?: number;
  stop_count_threshold?: number;
  speed_threshold_ms?: number;
  direction_change_threshold?: number;
  after_hours_start?: string;
  after_hours_end?: string;
  base_risk_weight?: number;
  max_risk_cap?: number;
  cooldown_sec?: number;
}

export interface ActivityBaseline {
  id: number;
  camera_id: string;
  zone_id?: string;
  hour_of_day: number;
  expected_person_count: number;
  expected_vehicle_count: number;
  expected_dwell_sec: number;
  expected_speed_ms: number;
  density_std_dev: number;
  samples_count: number;
  version: number;
  updated_at: string;
}

export interface BehaviourFeedback {
  id: number;
  event_id: string;
  feedback_type: 'CORRECT_DETECTION' | 'FALSE_POSITIVE' | 'NEEDS_REVIEW';
  operator_username: string;
  notes?: string;
  created_at: string;
}

export interface BehaviourAnalyticsSummary {
  total_behaviour_events: number;
  elevated_risk_events: number;
  repeated_approaches_count: number;
  route_anomalies_count: number;
  active_rules_count: number;
  false_positive_rate_percent: number;
  confirmed_events_count: number;
}
