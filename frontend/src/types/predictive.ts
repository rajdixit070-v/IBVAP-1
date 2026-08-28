export type WarningLevel = 'INFO' | 'WATCH' | 'ELEVATED' | 'HIGH';
export type LifecycleStatus = 'NEW' | 'ACTIVE' | 'ACKNOWLEDGED' | 'EXPIRED' | 'DISMISSED';
export type TrendStatus = 'INCREASING' | 'STABLE' | 'DECREASING' | 'VOLATILE';

export interface ActivityTimeSeriesPoint {
  timestamp: string;
  actual_count: number;
  expected_count: number;
  lower_bound: number;
  upper_bound: number;
  is_spike: boolean;
  is_drop: boolean;
}

export interface ActivityTimeSeriesResponse {
  target_type: string;
  target_id: string;
  window_minutes: number;
  points: ActivityTimeSeriesPoint[];
  trend: TrendStatus;
  trend_slope: number;
}

export interface ForecastDriverItem {
  driver: string;
  description: string;
}

export interface ForecastCounterSignalItem {
  signal: string;
  description: string;
}

export interface ForecastResponse {
  target_type: string;
  target_id: string;
  forecast_horizon_minutes: number;
  forecast_level: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';
  expected_activity_count: number;
  expected_range_min: number;
  expected_range_max: number;
  forecast_risk_score: number;
  current_risk_score: number;
  confidence: number;
  data_quality_score: number;
  status: 'COMPLETED' | 'INSUFFICIENT_DATA' | 'INFRASTRUCTURE_DEGRADED';
  reasons: ForecastDriverItem[];
  counter_signals: ForecastCounterSignalItem[];
  model_version: string;
}

export interface EarlyWarning {
  id: number;
  warning_id: string;
  warning_level: WarningLevel;
  lifecycle_status: LifecycleStatus;
  camera_id?: string;
  zone_id?: string;
  zone_name?: string;
  site_id?: string;
  forecast_risk_score: number;
  current_risk_score: number;
  confidence: number;
  data_quality_score: number;
  current_activity_count: number;
  baseline_expected_count: number;
  deviation_percent: number;
  trend: TrendStatus;
  forecast_horizon_minutes: number;
  reasons: ForecastDriverItem[];
  counter_signals: ForecastCounterSignalItem[];
  acknowledged_by?: string;
  acknowledged_at?: string;
  notes?: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface HotspotZone {
  zone_id: string;
  name: string;
  camera_id: string;
  bop_site: string;
  latitude: number;
  longitude: number;
  hotspot_level: 'NORMAL' | 'WATCH' | 'ELEVATED' | 'HIGH';
  activity_density: number;
  current_activity: number;
  baseline_activity: number;
  deviation_percent: number;
  risk_score: number;
  contributing_factors: string[];
}

export interface RecommendedAttentionItem {
  camera_id: string;
  camera_name: string;
  bop_site: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  risk_score: number;
  trend: TrendStatus;
}

export interface RecommendedAttentionResponse {
  generated_at: string;
  recommendations: RecommendedAttentionItem[];
}

export interface BaselineShift {
  id: number;
  shift_id: string;
  camera_id: string;
  zone_id?: string;
  hour_of_day: number;
  old_baseline_value: number;
  new_observed_value: number;
  deviation_percent: number;
  status: 'REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED';
  detected_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
}

export interface ModelHealth {
  id: number;
  model_name: string;
  model_version: string;
  status: string;
  last_trained_at: string;
  training_data_points: number;
  historical_days: number;
  data_quality_score: number;
  mae_score: number;
  rmse_score: number;
  confidence_avg: number;
  updated_at: string;
}
