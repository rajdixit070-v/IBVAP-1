// Web Audio API Tactical Threat Siren & Web Speech API Voice Alert Synthesizer
// Runs natively in all modern browsers with automatic AudioContext unlock, speech queue management, & fallback

export interface VoiceAlertOptions {
  title?: string;
  message?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  priority?: string;
  cameraId?: string;
  location?: string;
}

class AlertSoundService {
  private muted: boolean = false;
  private audioCtx: AudioContext | null = null;
  private unlocked: boolean = false;
  private voicesLoaded: boolean = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    const saved = localStorage.getItem('ibvap_alarm_muted');
    this.muted = saved === 'true';

    // Auto-unlock AudioContext and SpeechSynthesis on first user interaction anywhere on screen
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        try {
          const ctx = this.getAudioContext();
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().then(() => {
              this.unlocked = true;
            });
          } else if (ctx && ctx.state === 'running') {
            this.unlocked = true;
          }
        } catch (_) {}

        // Preload voices
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.getVoices();
          } catch (_) {}
        }
      };

      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('mousedown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('focus', unlockAudio, { passive: true });

      // Init speech voices listener
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.initVoice();
        };
        this.initVoice();
      }
    }
  }

  private initVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      this.voicesLoaded = true;
      // Prefer crisp standard English voices
      const preferred =
        voices.find(
          (v) =>
            (v.lang.startsWith('en') || v.lang.startsWith('hi')) &&
            (v.name.includes('Google') ||
              v.name.includes('Natural') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel') ||
              v.name.includes('Zira') ||
              v.name.includes('David') ||
              v.name.includes('Alex'))
        ) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferred) {
        this.selectedVoice = preferred;
      }
    } catch (_) {}
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public isVoiceSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem('ibvap_alarm_muted', muted ? 'true' : 'false');
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Tactical Audio Siren Sound (Web Audio API)
  public async playAlarm(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' = 'HIGH'): Promise<void> {
    if (this.muted) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (severity === 'CRITICAL') {
        // High-urgency military warble siren (880Hz down to 520Hz back to 880Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.30);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.45);
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.60);

        gain.gain.setValueAtTime(0.55, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.65);
      } else if (severity === 'HIGH') {
        // Dual-tone security chime (660Hz -> 880Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(880, now + 0.15);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Soft operational notification beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);

        gain.gain.setValueAtTime(0.20, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio alert playback failed:', e);
    }
  }

  // Voice Alert Speech Synthesizer (Web Speech API)
  public speakVoiceAlert(text: string, options?: { rate?: number; pitch?: number; volume?: number; priority?: string }): void {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      const cleanText = this.formatSpokenText(text);
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = options?.rate ?? 1.02;
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = options?.volume ?? 1.0;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      } else if (!this.voicesLoaded) {
        this.initVoice();
        if (this.selectedVoice) utterance.voice = this.selectedVoice;
      }

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('Voice speak error:', err);
        }
      }, 50);
    } catch (e) {
      console.warn('Voice alert synthesis failed:', e);
    }
  }

  // Clean and format text into natural military/tactical speech announcement
  private formatSpokenText(raw: string): string {
    if (!raw) return '';
    let text = raw
      .replace(/[\{\}\[\]\<\>\(\)\#\*\_\`]/g, ' ')
      .replace(/ALT-[0-9]+/gi, '')
      .replace(/CAM-([A-Za-z0-9_-]+)/gi, 'Camera $1')
      .replace(/BOP-([A-Za-z0-9_-]+)/gi, 'Border Outpost $1')
      .replace(/SECTOR-([A-Za-z0-9_-]+)/gi, 'Sector $1')
      .replace(/CRITICAL/gi, 'Critical')
      .replace(/INTRUSION/gi, 'Intrusion')
      .replace(/UNAUTHORIZED/gi, 'Unauthorized')
      .replace(/DETECTED/gi, 'Detected')
      .replace(/\s+/g, ' ')
      .trim();

    // Limit length so announcement remains crisp and timely
    if (text.length > 180) {
      text = text.substring(0, 180);
      const lastDot = text.lastIndexOf('.');
      if (lastDot > 60) {
        text = text.substring(0, lastDot + 1);
      }
    }
    return text;
  }

  // Unified Alert: Plays Tactical Siren Chime followed by Voice Announcement
  public async playAlertWithVoice(alert: VoiceAlertOptions | string, severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO'): Promise<void> {
    if (this.muted) return;

    let sev: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' = 'HIGH';
    let spokenSentence = '';

    if (typeof alert === 'string') {
      spokenSentence = alert;
      sev = severity || 'HIGH';
    } else {
      const alertSev = alert.severity || alert.priority;
      sev = alertSev === 'CRITICAL' ? 'CRITICAL' : alertSev === 'MEDIUM' ? 'MEDIUM' : 'HIGH';

      const prefix = sev === 'CRITICAL' ? 'Warning! Critical security threat.' : sev === 'HIGH' ? 'Alert!' : 'Operational notice.';
      const title = alert.title || 'Intrusion Alert';
      const loc = alert.location || (alert.cameraId ? `on camera ${alert.cameraId}` : '');

      spokenSentence = `${prefix} ${title} ${loc ? 'detected at ' + loc : ''}.`;
    }

    // 1. Play tactical audio siren immediately
    await this.playAlarm(sev);

    // 2. Play clear spoken voice announcement after a short 250ms gap
    setTimeout(() => {
      this.speakVoiceAlert(spokenSentence, { priority: sev });
    }, 300);
  }

  // Test full sound & voice alert
  public testVoiceAlert(): void {
    const wasMuted = this.muted;
    this.muted = false;
    this.playAlertWithVoice({
      title: 'Perimeter Intrusion Detected',
      severity: 'CRITICAL',
      cameraId: 'CAM-01',
      location: 'Sector North Bravo'
    });
    this.muted = wasMuted;
  }

  public testAlarm(): void {
    this.testVoiceAlert();
  }
}

export const alertSoundService = new AlertSoundService();

