import { cameraService } from './cameraService';

class WebcamStreamService {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private timer: any = null;
  private activeCameraId: string | null = null;
  private isBroadcasting = false;
  private listeners: Array<(active: boolean, cameraId: string | null) => void> = [];

  public async startStream(cameraId: string): Promise<boolean> {
    if (this.isBroadcasting && this.activeCameraId === cameraId) {
      return true;
    }
    this.stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: false
      });

      this.stream = stream;
      this.activeCameraId = cameraId;
      this.isBroadcasting = true;

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      this.video = video;

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      this.timer = setInterval(() => {
        if (!this.isBroadcasting || !this.video || !ctx || !this.activeCameraId) return;

        try {
          ctx.drawImage(this.video, 0, 0, 640, 480);
          canvas.toBlob(
            (blob) => {
              if (blob && this.activeCameraId && this.isBroadcasting) {
                cameraService.ingestDirectFrame(this.activeCameraId, blob).catch(() => {});
              }
            },
            'image/jpeg',
            0.65
          );
        } catch (e) {
          // ignore frame dropped
        }
      }, 80);

      this.notifyListeners();
      return true;
    } catch (err) {
      console.warn('Unable to access webcam stream:', err);
      this.stopStream();
      return false;
    }
  }

  public stopStream(): void {
    this.isBroadcasting = false;
    this.activeCameraId = null;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.notifyListeners();
  }

  public isActive(): boolean {
    return this.isBroadcasting;
  }

  public getActiveCameraId(): string | null {
    return this.activeCameraId;
  }

  public subscribe(listener: (active: boolean, cameraId: string | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.isBroadcasting, this.activeCameraId);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l(this.isBroadcasting, this.activeCameraId));
  }
}

export const webcamStreamService = new WebcamStreamService();
