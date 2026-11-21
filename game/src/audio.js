// audio.js — Semua bunyi disintesis WebAudio sendiri; tanpa file audio eksternal.
// AudioContext dibuat malas (klik/tombol pertama) agar tidak diblokir browser.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    } catch { this.ctx = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* abaikan */ }
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch { /* abaikan */ }
  }

  step() { this.noise(0.07, 0.05, 500); this.tone(90, 0.06, 'triangle', 0.05, 70); }
  pickup() { this.tone(660, 0.12, 'sine', 0.22, 990); setTimeout(() => this.tone(990, 0.18, 'sine', 0.2, 1320), 90); }
  alert() { this.tone(220, 0.3, 'sawtooth', 0.22, 440); setTimeout(() => this.tone(330, 0.3, 'sawtooth', 0.2, 220), 160); }
  suspicious() { this.tone(440, 0.15, 'square', 0.1, 520); }
  potion() { this.tone(520, 0.25, 'sine', 0.2, 1040); this.noise(0.3, 0.06, 2400); }
  throwBottle() { this.noise(0.15, 0.12, 3000); this.tone(880, 0.2, 'sine', 0.14, 440); }
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'sine', 0.22), i * 140)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'triangle', 0.2), i * 160)); }
  exit() { this.tone(784, 0.3, 'sine', 0.2, 1175); }

  // Desis kuali + dengung rendah yang terus-menerus, sangat pelan.
  startAmbient() {
    try {
      const ctx = this.ctx;
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 320;
      const g = ctx.createGain(); g.gain.value = 0.035;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 55;
      const og = ctx.createGain(); og.gain.value = 0.03;
      o.connect(og); og.connect(this.master);
      o.start();
      this.ambientNodes = [src, o];
    } catch { /* abaikan */ }
  }
}
