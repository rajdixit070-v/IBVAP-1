import api, { getWsBaseUrl } from './api';
import { authService } from './authService';
import {
  CameraAIStatus,
  CameraAIConfig,
  CameraAIConfigUpdate,
  TrackedObject,
  AIMetrics,
  AIRealTimeTelemetryMessage
} from '../types/ai';

export const aiService = {
  // Get AI status for all cameras
  getAIStatuses: async (): Promise<CameraAIStatus[]> => {
    const res = await api.get<CameraAIStatus[]>('/ai/status');
    return res.data;
  },

  // Get AI status for single camera
  getCameraAIStatus: async (cameraId: string): Promise<CameraAIStatus> => {
    const res = await api.get<CameraAIStatus>(`/ai/cameras/${cameraId}/status`);
    return res.data;
  },

  // Enable AI for camera
  enableCameraAI: async (cameraId: string): Promise<{ message: string; status: string }> => {
    const res = await api.post(`/ai/cameras/${cameraId}/enable`);
    return res.data;
  },

  // Disable AI for camera
  disableCameraAI: async (cameraId: string): Promise<{ message: string; status: string }> => {
    const res = await api.post(`/ai/cameras/${cameraId}/disable`);
    return res.data;
  },

  // Get active tracks for camera
  getCameraTracks: async (cameraId: string): Promise<TrackedObject[]> => {
    const res = await api.get<TrackedObject[]>(`/ai/cameras/${cameraId}/tracks`);
    return res.data;
  },

  // Get AI config for camera
  getCameraConfig: async (cameraId: string): Promise<CameraAIConfig> => {
    const res = await api.get<CameraAIConfig>(`/ai/cameras/${cameraId}/config`);
    return res.data;
  },

  // Update AI config for camera
  updateCameraConfig: async (
    cameraId: string,
    data: CameraAIConfigUpdate
  ): Promise<CameraAIConfig> => {
    const res = await api.put<CameraAIConfig>(`/ai/cameras/${cameraId}/config`, data);
    return res.data;
  },

  // Get global AI metrics
  getAIMetrics: async (): Promise<AIMetrics> => {
    const res = await api.get<AIMetrics>('/ai/metrics');
    return res.data;
  }
};

export class AIFeedWebSocket {
  private ws: WebSocket | null = null;
  private onMessage: (msg: AIRealTimeTelemetryMessage) => void;
  private onError?: (err: any) => void;
  private cameraId: string;
  private isClosedExplicitly = false;

  constructor(
    cameraId: string,
    onMessage: (msg: AIRealTimeTelemetryMessage) => void,
    onError?: (err: any) => void
  ) {
    this.cameraId = cameraId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.connect();
  }

  private connect() {
    const wsBase = getWsBaseUrl();
    const token = authService.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${wsBase}/ws/ai-feed/${this.cameraId}${tokenParam}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.onMessage(payload);
        } catch (e) {
          console.error('Failed to parse AI telemetry payload:', e);
        }
      };

      this.ws.onerror = (err) => {
        if (this.onError) this.onError(err);
      };

      this.ws.onclose = () => {
        if (!this.isClosedExplicitly) {
          // Reconnect with backoff
          setTimeout(() => {
            if (!this.isClosedExplicitly) this.connect();
          }, 3000);
        }
      };
    } catch (e) {
      if (this.onError) this.onError(e);
    }
  }

  public close() {
    this.isClosedExplicitly = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
