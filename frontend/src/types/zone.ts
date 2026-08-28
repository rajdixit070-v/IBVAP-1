export interface NormalizedPoint {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
}

export type ZoneType = 'RESTRICTED' | 'HIGH_SECURITY' | 'BUFFER' | 'MONITORING' | 'CUSTOM';

export interface SecurityZone {
  id: number;
  zone_id: string;
  camera_id: string;
  name: string;
  zone_type: ZoneType;
  polygon: NormalizedPoint[];
  monitored_classes: string[];
  direction_rule: string;
  severity: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecurityZoneCreate {
  camera_id: string;
  name: string;
  zone_type: ZoneType;
  polygon: NormalizedPoint[];
  monitored_classes: string[];
  direction_rule?: string;
  severity?: string;
  enabled?: boolean;
}

export interface SecurityZoneUpdate {
  name?: string;
  zone_type?: ZoneType;
  polygon?: NormalizedPoint[];
  monitored_classes?: string[];
  direction_rule?: string;
  severity?: string;
  enabled?: boolean;
}
