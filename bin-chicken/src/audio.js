// Every sound is synthesised with WebAudio — honks, crunches, shouts, bins.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return this.ctx.resume?.();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ambience();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  suspend() { this.ctx?.suspend?.(); }
  resume() { this.ctx?.resume?.(); }

  // --- building blocks -----------------------------------------------------
  env(gain, t, a, peak, d) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  noiseBurst(t, dur, type, freq, q, peak) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.005, peak, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return f;
  }

  tone(t, type, f0, f1, dur, peak, dest = this.master) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.01, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  // --- effects -------------------------------------------------------------
  honk() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.2;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 850;
      bp.Q.value = 1.3;
      const g = ctx.createGain();
      g.gain.value = 1;
      // a grunty tremolo
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 38;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg).connect(g.gain);
      lfo.start(s);
      lfo.stop(s + 0.3);
      bp.connect(g).connect(this.master);
      this.tone(s, "sawtooth", 150 - i * 15, 92, 0.24, 0.35, bp);
      this.tone(s, "square", 152 - i * 15, 95, 0.24, 0.12, bp);
    }
  }

  crunch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.noiseBurst(t + i * 0.07 + Math.random() * 0.03, 0.05, "highpass", 1800 + Math.random() * 1500, 0.7, 0.5);
  }

  peck() {
    if (!this.ctx) return;
    this.noiseBurst(this.ctx.currentTime, 0.03, "highpass", 2500, 0.8, 0.2);
  }

  flap() {
    if (!this.ctx) return;
    const f = this.noiseBurst(this.ctx.currentTime, 0.18, "bandpass", 700, 0.9, 0.5);
    f.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.18);
  }

  grab() {
    if (!this.ctx) return;
    this.tone(this.ctx.currentTime, "triangle", 520, 980, 0.12, 0.3);
  }

  score(combo = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 523.25 * Math.pow(2, (combo - 1) * 2 / 12);
    [1, 1.25, 1.5].forEach((m, i) => this.tone(t + 0.06 * i, "triangle", base * m, base * m, 0.18, 0.22));
  }

  oi() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const pitch = 170 + Math.random() * 90;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.linearRampToValueAtTime(pitch * 1.35, t + 0.12);
    o.frequency.linearRampToValueAtTime(pitch * 0.9, t + 0.4);
    const g = ctx.createGain();
    this.env(g, t, 0.02, 0.5, 0.4);
    o.connect(g);
    // two formants sliding from "o" to "i"
    for (const [a, b] of [[550, 320], [900, 2300]]) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 6;
      f.frequency.setValueAtTime(a, t);
      f.frequency.linearRampToValueAtTime(a, t + 0.12);
      f.frequency.linearRampToValueAtTime(b, t + 0.3);
      const fg = ctx.createGain();
      fg.gain.value = 1.4;
      g.connect(f).connect(fg).connect(this.master);
    }
    o.start(t);
    o.stop(t + 0.5);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.55, "lowpass", 2400, 0.5, 0.7);
    this.tone(t, "sine", 110, 45, 0.35, 0.7);
    for (let i = 0; i < 4; i++) this.tone(t + 0.05 + i * 0.09, "square", 600 + Math.random() * 600, 300, 0.06, 0.08);
  }

  thump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, "sine", 160, 60, 0.2, 0.6);
    this.noiseBurst(t, 0.12, "lowpass", 900, 0.5, 0.4);
  }

  whistle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, "sine", 1800, 2600, 0.15, 0.2);
    this.tone(t + 0.18, "sine", 2600, 2000, 0.3, 0.2);
  }

  fanfare(good) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = good ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23, 329.63, 261.63];
    notes.forEach((n, i) => this.tone(t + i * 0.14, "triangle", n, n, 0.3, 0.25));
  }

  ambience() {
    const ctx = this.ctx;
    // harbour wash: looped low-passed noise with a slow swell
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = ctx.createGain();
    lg.gain.value = 0.03;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    // distant birds
    const chirp = () => {
      if (!this.ctx) return;
      const t = ctx.currentTime;
      const n = 2 + Math.floor(Math.random() * 3);
      const f = 2400 + Math.random() * 1600;
      for (let i = 0; i < n; i++) this.tone(t + i * 0.11, "sine", f, f * 1.25, 0.07, 0.035);
      setTimeout(chirp, 3000 + Math.random() * 6000);
    };
    setTimeout(chirp, 2500);
  }
}
