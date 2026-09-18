import { authService } from './authService';
import { getWsBaseUrl } from './api';

export class LiveFeedWebSocket {
  private ws: WebSocket | null = null;
  private cameraId: string;
  private onFrame: (blobUrl: string) => void;
  private onError?: (err: any) => void;
  private currentBlobUrl: string | null = null;
  private isDestroyed = false;

  constructor(cameraId: string, onFrame: (blobUrl: string) => void, onError?: (err: any) => void) {
    this.cameraId = cameraId;
    this.onFrame = onFrame;
    this.onError = onError;
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;
    const wsBase = getWsBaseUrl();
    const token = authService.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${wsBase}/ws/live-feed/${this.cameraId}${tokenParam}`;

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'blob';

    this.ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        if (this.currentBlobUrl) {
          URL.revokeObjectURL(this.currentBlobUrl);
        }
        this.currentBlobUrl = URL.createObjectURL(event.data);
        this.onFrame(this.currentBlobUrl);
      }
    };

    this.ws.onerror = (e) => {
      if (this.onError) this.onError(e);
    };

    this.ws.onclose = () => {
      if (!this.isDestroyed) {
        // Auto reconnect after 2 seconds
        setTimeout(() => this.connect(), 2000);
      }
    };
  }

  public close() {
    this.isDestroyed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}

export class HealthWebSocket {
  private ws: WebSocket | null = null;
  private onHealthUpdate: (data: any) => void;
  private isDestroyed = false;

  constructor(onHealthUpdate: (data: any) => void) {
    this.onHealthUpdate = onHealthUpdate;
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;
    const wsBase = getWsBaseUrl();
    const token = localStorage.getItem('ibvap_token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${wsBase}/ws/health${tokenParam}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.onHealthUpdate(parsed);
      } catch (e) {
        // ignore
      }
    };

    this.ws.onopen = () => {
      // Keep alive ping
      const pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('ping');
        } else {
          clearInterval(pingInterval);
        }
      }, 10000);
    };

    this.ws.onclose = () => {
      if (!this.isDestroyed) {
        setTimeout(() => this.connect(), 3000);
      }
    };
  }

  public close() {
    this.isDestroyed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export class AlertsWebSocket {
  private ws: WebSocket | null = null;
  private onAlert: (data: any) => void;
  private isDestroyed = false;

  constructor(onAlert: (data: any) => void) {
    this.onAlert = onAlert;
    this.connect();
  }

  private connect() {
    if (this.isDestroyed) return;
    const wsBase = getWsBaseUrl();
    const token = authService.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${wsBase}/ws/alerts${tokenParam}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.onAlert(parsed);
          window.dispatchEvent(new CustomEvent('ibvap:alert-received', { detail: parsed }));
          window.dispatchEvent(new CustomEvent('ibvap:refresh-all'));
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          setTimeout(() => this.connect(), 2500);
        }
      };
    } catch (e) {
      if (!this.isDestroyed) {
        setTimeout(() => this.connect(), 3000);
      }
    }
  }

  public close() {
    this.isDestroyed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

