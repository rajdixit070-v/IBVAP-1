import api from './api';
import { authService } from './authService';
import { SecurityEvent, SecurityEventsSummary, SystemRiskConfig } from '../types/event';

export const eventService = {
  async getEvents(params?: {
    camera_id?: string;
    risk_level?: string;
    event_type?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }): Promise<SecurityEvent[]> {
    const response = await api.get<SecurityEvent[]>('/events/', { params });
    return response.data;
  },

  async getSummary(): Promise<SecurityEventsSummary> {
    const response = await api.get<SecurityEventsSummary>('/events/summary');
    return response.data;
  },

  async getEvent(eventId: string): Promise<SecurityEvent> {
    const response = await api.get<SecurityEvent>(`/events/${eventId}`);
    return response.data;
  },

  async updateEventStatus(eventId: string, status: string, comment?: string): Promise<SecurityEvent> {
    const response = await api.put<SecurityEvent>(`/events/${eventId}/status`, { status, comment });
    return response.data;
  },

  async getRiskConfig(): Promise<SystemRiskConfig> {
    const response = await api.get<SystemRiskConfig>('/risk-config/');
    return response.data;
  },

  async updateRiskConfig(data: Partial<SystemRiskConfig>): Promise<SystemRiskConfig> {
    const response = await api.put<SystemRiskConfig>('/risk-config/', data);
    return response.data;
  },

  async deleteEvent(eventId: string): Promise<any> {
    const response = await api.delete(`/events/${eventId}`);
    return response.data;
  },

  async clearAllEvents(cameraId?: string): Promise<any> {
    const response = await api.delete('/events/clear-all', { params: { camera_id: cameraId } });
    return response.data;
  }
};

export class SecurityEventsWebSocket {
  private ws: WebSocket | null = null;
  private onEventCallback: (event: { event: string; data: SecurityEvent }) => void;
  private reconnectTimeout: any = null;
  private isClosedExplicitly = false;

  constructor(onEvent: (event: { event: string; data: SecurityEvent }) => void) {
    this.onEventCallback = onEvent;
    this.connect();
  }

  private connect() {
    if (this.isClosedExplicitly) return;

    let wsBase: string;
    const envApi = import.meta.env.VITE_API_URL;
    if (envApi && envApi.startsWith('http')) {
      wsBase = envApi.replace(/^http/, 'ws').replace(/\/+$/, '');
      if (!wsBase.endsWith('/api/v1')) {
        wsBase = `${wsBase}/api/v1`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsBase = `${protocol}//${host}/api/v1`;
    }

    const token = authService.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${wsBase}/ws/security-events${tokenParam}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          this.onEventCallback(payload);
        } catch (e) {
          console.error('Error parsing security event JSON', e);
        }
      };

      this.ws.onclose = () => {
        if (!this.isClosedExplicitly) {
          this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Security events WebSocket error', err);
        this.ws?.close();
      };
    } catch (e) {
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000);
    }
  }

  public close() {
    this.isClosedExplicitly = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) this.ws.close();
  }
}
