// Web Audio API Tactical Threat Siren & Audio Synthesizer
// Runs natively in all modern browsers with automatic AudioContext unlock & fallback

class AlertSoundService {
  private muted: boolean = false;
  private audioCtx: AudioContext | null = null;
  private unlocked: boolean = false;

  constructor() {
    const saved = localStorage.getItem('ibvap_alarm_muted');
    this.muted = saved === 'true';

    // Auto-unlock AudioContext on first user interaction anywhere on screen
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
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('mousedown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
      window.addEventListener('focus', unlockAudio, { passive: true });
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }


  public setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem('ibvap_alarm_muted', muted ? 'true' : 'false');
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
      console.warn('Audio alert playback not allowed or failed:', e);
    }
  }

  public testAlarm(): void {
    const wasMuted = this.muted;
    this.muted = false;
    this.playAlarm('CRITICAL');
    this.muted = wasMuted;
  }
}

export const alertSoundService = new AlertSoundService();

