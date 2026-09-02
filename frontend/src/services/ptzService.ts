import api from './api';

export interface PTZDevice {
  device_id: string;
  camera_id: string;
  onvif_endpoint?: string;
  onvif_port: number;
  onvif_profile_token: string;
  supports_continuous_move: boolean;
  supports_absolute_move: boolean;
  supports_presets: boolean;
  pan_min: number;
  pan_max: number;
  tilt_min: number;
  tilt_max: number;
  zoom_min: number;
  zoom_max: number;
  current_pan: number;
  current_tilt: number;
  current_zoom: number;
  status: string;
  is_locked: boolean;
  locked_by_user?: string;
  tracking_target_id?: string;
  auto_track_enabled: boolean;
}

export interface PTZPreset {
  preset_id: string;
  camera_id: string;
  preset_token: string;
  preset_name: string;
  pan: number;
  tilt: number;
  zoom: number;
  fov_heading_deg: number;
  created_at: string;
}

export interface ONVIFDevice {
  camera_id: string;
  device_ip: string;
  onvif_endpoint: string;
  manufacturer: string;
  model: string;
  firmware_version: string;
  profiles: string[];
  supports_ptz: boolean;
}

export const ptzService = {
  async discoverDevices(): Promise<ONVIFDevice[]> {
    const res = await api.get<ONVIFDevice[]>('/ptz/discover');
    return res.data;
  },

  async getPTZStatus(cameraId: string): Promise<PTZDevice> {
    const res = await api.get<PTZDevice>(`/ptz/${cameraId}/status`);
    return res.data;
  },

  async movePTZ(cameraId: string, data: {
    move_type?: 'CONTINUOUS' | 'ABSOLUTE' | 'RELATIVE';
    pan_speed?: number;
    tilt_speed?: number;
    zoom_speed?: number;
    timeout_sec?: number;
  }): Promise<any> {
    const res = await api.post(`/ptz/${cameraId}/move`, data);
    return res.data;
  },

  async stopPTZ(cameraId: string): Promise<any> {
    const res = await api.post(`/ptz/${cameraId}/stop`);
    return res.data;
  },

  async getPresets(cameraId: string): Promise<PTZPreset[]> {
    const res = await api.get<PTZPreset[]>(`/ptz/${cameraId}/presets`);
    return res.data;
  },

  async createPreset(cameraId: string, data: { preset_name: string; pan?: number; tilt?: number; zoom?: number }): Promise<PTZPreset> {
    const res = await api.post<PTZPreset>(`/ptz/${cameraId}/presets`, data);
    return res.data;
  },

  async gotoPreset(cameraId: string, token: string): Promise<any> {
    const res = await api.post(`/ptz/${cameraId}/presets/${token}/goto`);
    return res.data;
  },

  async setAutoTrack(cameraId: string, data: {
    enable: boolean;
    target_id?: string;
    bbox?: number[];
    max_zoom?: number;
  }): Promise<any> {
    const res = await api.post(`/ptz/${cameraId}/auto-track`, data);
    return res.data;
  }
};

