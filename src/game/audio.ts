import { WeatherType } from './types';

/**
 * 100% Procedural Web Audio API synthesizer for Ultimate Fishing Simulator 3D.
 * Zero external audio files; gracefully unlocks on first user gesture.
 */
export class FishingAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oceanGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private volume = 0.65;
  private muted = false;
  private paused = false;
  private lastReelClick = 0;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.effectiveVolume();
      this.masterGain.connect(this.ctx.destination);
      this.setupAmbientLoops();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private effectiveVolume(): number {
    return this.muted || this.paused ? 0 : this.volume;
  }

  public setSettings(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    this.applyMasterGain();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(this.effectiveVolume(), this.ctx.currentTime, 0.05);
  }

  private createNoiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 3.2;
    }
    return buf;
  }

  private setupAmbientLoops(): void {
    if (!this.ctx || !this.masterGain) return;
    const noiseBuf = this.createNoiseBuffer(3);
    if (!noiseBuf) return;

    // Gentle ocean / shore surf loop
    const oceanSrc = this.ctx.createBufferSource();
    oceanSrc.buffer = noiseBuf;
    oceanSrc.loop = true;
    const oceanFilter = this.ctx.createBiquadFilter();
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 340;
    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.value = 0.08;
    oceanSrc.connect(oceanFilter);
    oceanFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.masterGain);
    oceanSrc.start();

    // Rain / wind loop
    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = noiseBuf;
    rainSrc.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1800;
    rainFilter.Q.value = 0.7;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSrc.start();

    // Boat outboard motor hum
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 48;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 170;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();
  }

  public updateAmbience(weather: WeatherType, boatActive: boolean, boatSpeedRatio: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.oceanGain) {
      const targetOcean = weather === 'stormy' ? 0.16 : weather === 'rainy' ? 0.12 : 0.075;
      this.oceanGain.gain.setTargetAtTime(targetOcean, t, 0.4);
    }
    if (this.rainGain) {
      const targetRain = weather === 'stormy' ? 0.14 : weather === 'rainy' ? 0.09 : 0;
      this.rainGain.gain.setTargetAtTime(targetRain, t, 0.4);
    }
    if (this.engineGain && this.engineOsc) {
      const targetGain = boatActive ? 0.03 + boatSpeedRatio * 0.065 : 0;
      const targetFreq = 42 + boatSpeedRatio * 72;
      this.engineGain.gain.setTargetAtTime(targetGain, t, 0.12);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.12);
    }
  }

  public playCastWhoosh(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.24);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playSplash(intensity = 0.6): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    const buf = this.createNoiseBuffer(0.45);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950 + intensity * 600, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + 0.35);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
  }

  public playBiteAlert(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      gain.gain.setValueAtTime(0.001, t + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.09 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.22);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.24);
    });
    this.playSplash(0.8);
  }

  public playReelTick(tension: number): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const now = performance.now();
    const minInterval = Math.max(42, 115 - tension * 72);
    if (now - this.lastReelClick < minInterval) return;
    this.lastReelClick = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420 + tension * 620 + (Math.random() - 0.5) * 35, t);
    gain.gain.setValueAtTime(0.04 + tension * 0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  public playCatchFanfare(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      gain.gain.setValueAtTime(0.001, t + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.14, t + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.45);
    });
  }

  public playLineSnap(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.3);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playCoinChime(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.07);
      gain.gain.setValueAtTime(0.12, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.28);
    });
  }

  public dispose(): void {
    try {
      this.engineOsc?.stop();
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
