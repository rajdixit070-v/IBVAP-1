import api from './api';

export interface GISLayer {
  layer_id: string;
  name: string;
  layer_type: string;
  site_id: string;
  is_visible: boolean;
  opacity: number;
  features_geojson: string;
  config_json: string;
}

export interface CameraFOV {
  fov_id: string;
  camera_id: string;
  site_id: string;
  bop_id?: string;
  latitude: number;
  longitude: number;
  heading_deg: number;
  horizontal_fov_deg: number;
  vertical_fov_deg: number;
  range_meters: number;
  mount_height_m: number;
  tilt_deg: number;
  polygon_geojson: string;
  updated_at: string;
}

export interface SectorCoverage {
  coverage_id: string;
  site_id: string;
  bop_id?: string;
  sector_name: string;
  total_area_sqm: number;
  covered_area_sqm: number;
  coverage_percentage: number;
  blind_area_sqm: number;
  overlap_area_sqm: number;
  calculated_at: string;
}

export interface BlindSpot {
  blind_spot_id: string;
  site_id: string;
  bop_id?: string;
  sector_name: string;
  polygon_geojson: string;
  area_sqm: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  risk_score: number;
  priority_rank: number;
  proximity_to_border_m: number;
  terrain_factor: string;
  incident_history_count: number;
  recommendations_json: string;
  is_acknowledged: boolean;
  created_at: string;
}

export interface TerrainInfo {
  latitude: number;
  longitude: number;
  elevation_m?: number;
  slope_deg?: number;
  aspect_deg?: number;
  terrain_class: string;
  status: string;
}

export const gisService = {
  async getLayers(siteId = 'SITE-BORDER-NORTH'): Promise<GISLayer[]> {
    const res = await api.get<GISLayer[]>('/gis/layers', { params: { site_id: siteId } });
    return res.data;
  },

  async updateLayer(layerId: string, data: Partial<GISLayer>): Promise<GISLayer> {
    const res = await api.put<GISLayer>(`/gis/layers/${layerId}`, data);
    return res.data;
  },

  async getCameraFOV(cameraId: string): Promise<CameraFOV> {
    const res = await api.get<CameraFOV>(`/gis/fov/${cameraId}`);
    return res.data;
  },

  async calculateSectorCoverage(params?: {
    site_id?: string;
    bop_id?: string;
    sector_name?: string;
  }): Promise<SectorCoverage> {
    const res = await api.get<SectorCoverage>('/gis/coverage/calculate', { params });
    return res.data;
  },

  async getBlindSpots(params?: { site_id?: string; risk_level?: string }): Promise<BlindSpot[]> {
    const res = await api.get<BlindSpot[]>('/gis/blind-spots', { params });
    return res.data;
  },

  async acknowledgeBlindSpot(blindSpotId: string): Promise<BlindSpot> {
    const res = await api.post<BlindSpot>(`/gis/blind-spots/${blindSpotId}/acknowledge`);
    return res.data;
  },

  async queryTerrain(lat: number, lng: number): Promise<TerrainInfo> {
    const res = await api.post<TerrainInfo>('/gis/terrain/query', { latitude: lat, longitude: lng });
    return res.data;
  }
};

