export interface Site {
  id: number;
  site_id: string;
  region_id: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED';
  created_at: string;
  updated_at: string;
}

export interface BOP {
  id: number;
  bop_id: string;
  site_id: string;
  name: string;
  code: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED';
  operational_priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  created_at: string;
  updated_at: string;
}

export interface SiteOverview {
  site_id: string;
  name: string;
  code: string;
  status: string;
  total_bops: number;
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  degraded_cameras: number;
  active_incidents: number;
  critical_alerts: number;
  current_risk: number;
  forecast_risk: string;
  system_health: number;
  system_health_status: string;
  edge_nodes_count: number;
  recent_events_count: number;
  bops: {
    bop_id: string;
    name: string;
    code: string;
    status: string;
    priority: string;
    total_cameras: number;
    online_cameras: number;
    health_score: number;
    current_risk: number;
  }[];
}

export interface BOPOverview {
  bop_id: string;
  site_id: string;
  name: string;
  code: string;
  status: string;
  operational_priority: string;
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  edge_nodes_count: number;
  zones_count: number;
  active_incidents: number;
  critical_alerts: number;
  current_risk: number;
  forecast: string;
  system_health: number;
  system_health_status: string;
  recent_events_count: number;
}

export interface SiteHealthMatrixRow {
  site_id: string;
  site_name: string;
  status: string;
  bops_count: number;
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  degraded_cameras: number;
  active_incidents: number;
  current_risk: number;
  health_score: number;
  health_status: string;
}

export interface BOPHealthMatrixRow {
  bop_id: string;
  bop_name: string;
  site_id: string;
  status: string;
  priority: string;
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  active_incidents: number;
  current_risk: number;
  health_score: number;
  health_status: string;
}

export interface GlobalOverview {
  total_sites: number;
  active_sites: number;
  total_bops: number;
  total_cameras: number;
  online_cameras: number;
  offline_cameras: number;
  degraded_cameras: number;
  active_incidents: number;
  critical_alerts: number;
  overall_health_score: number;
  overall_health_status: string;
  forecast_warnings_count: number;
  high_risk_bops_count: number;
  timestamp: string;
}

export interface UserScope {
  id: number;
  username: string;
  scope_type: 'GLOBAL' | 'REGION' | 'SITE' | 'BOP';
  scope_id: string;
  role: 'SUPER_ADMIN' | 'REGIONAL_ADMIN' | 'SITE_ADMIN' | 'BOP_OPERATOR' | 'ANALYST';
  assigned_by: string;
  created_at: string;
}

export interface EffectiveConfig {
  config_key: string;
  effective_value: any;
  resolved_from_level: string;
  resolved_scope_id: string;
  inheritance_chain: {
    level: string;
    scope_id: string;
    value: any;
    overridden_by?: string;
    reason?: string;
  }[];
}

export interface GlobalSearchResult {
  entity_type: 'SITE' | 'BOP' | 'CAMERA' | 'INCIDENT' | 'EVENT' | 'TRACK';
  entity_id: string;
  name_or_title: string;
  site_id: string;
  bop_name?: string;
  status?: string;
  risk_or_severity?: string;
  timestamp?: string;
  details: Record<string, any>;
}

export interface FederatedMapData {
  sites: {
    type: 'SITE';
    id: string;
    name: string;
    code: string;
    status: string;
    latitude: number;
    longitude: number;
    health_score: number;
    risk_score: number;
    total_cameras: number;
  }[];
  bops: {
    type: 'BOP';
    id: string;
    site_id: string;
    name: string;
    status: string;
    priority: string;
    latitude: number;
    longitude: number;
    health_score: number;
    risk_score: number;
    total_cameras: number;
  }[];
  cameras: {
    type: 'CAMERA';
    id: string;
    name: string;
    site_id: string;
    bop_id: string;
    bop_name: string;
    status: string;
    priority: string;
    latitude: number;
    longitude: number;
    fps: number;
    image_quality_score?: number;
  }[];
  clusters_summary: {
    total_sites: number;
    total_bops: number;
    total_cameras: number;
  };
}

export interface MultiSiteReport {
  report_scope: string;
  scope_id: string;
  generated_at: string;
  summary: Record<string, any>;
  site_breakdown: any[];
  bop_breakdown: any[];
  incident_statistics: Record<string, any>;
  health_metrics: Record<string, any>;
}
