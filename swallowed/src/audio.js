// Opt-in ambient audio synthesised entirely with WebAudio — no fetched files.
// A soft drone per stage plus occasional gentle squelches. OFF by default;
// only starts after a user gesture (the sound toggle).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.master = null;
    this.drone = null;
    this.droneGain = null;
    this.filter = null;
    this.lfo = null;
    this.squelchTimer = null;
    this.currentStage = 0;
  }

  // Per-stage drone base frequency (Hz) and filter cutoff — moody, low.
  _stageTone(i) {
    const tones = [
      { freq: 70, cutoff: 300 },   // bite
      { freq: 90, cutoff: 480 },   // mouth
      { freq: 64, cutoff: 360 },   // esophagus
      { freq: 48, cutoff: 240 },   // stomach — ominous, low
      { freq: 110, cutoff: 700 },  // small — radiant, higher, warmer
      { freq: 58, cutoff: 320 },   // large — earthy
      { freq: 140, cutoff: 1200 }, // exit — light, opening up
    ];
    return tones[Math.max(0, Math.min(tones.length - 1, i))];
  }

  async enable() {
    if (this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);

    // Drone: two detuned oscillators through a lowpass with a slow LFO wobble.
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.5;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 360;
    this.filter.Q.value = 2;

    this.osc1 = this.ctx.createOscillator();
    this.osc2 = this.ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc2.type = "sine";
    this.osc1.frequency.value = 70;
    this.osc2.frequency.value = 70 * 1.01;

    this.lfo = this.ctx.createOscillator();
    this.lfoGain = this.ctx.createGain();
    this.lfo.frequency.value = 0.15;
    this.lfoGain.gain.value = 40;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    this.osc1.connect(this.droneGain);
    this.osc2.connect(this.droneGain);
    this.droneGain.connect(this.filter);
    this.filter.connect(this.master);

    this.osc1.start();
    this.osc2.start();
    this.lfo.start();

    this.enabled = true;
    // fade in
    this.master.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 1.4);
    this.setStage(this.currentStage);
    this._scheduleSquelch();
  }

  disable() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(0.0, t + 0.6);
    if (this.squelchTimer) clearTimeout(this.squelchTimer);
    this.enabled = false;
    setTimeout(() => {
      try { this.ctx && this.ctx.suspend(); } catch (e) { /* noop */ }
    }, 700);
  }

  toggle() {
    if (this.enabled) { this.disable(); return false; }
    this.enable();
    return true;
  }

  setStage(i) {
    this.currentStage = i;
    if (!this.enabled || !this.ctx) return;
    const tone = this._stageTone(i);
    const t = this.ctx.currentTime;
    this.osc1.frequency.linearRampToValueAtTime(tone.freq, t + 2.0);
    this.osc2.frequency.linearRampToValueAtTime(tone.freq * 1.01, t + 2.0);
    this.filter.frequency.linearRampToValueAtTime(tone.cutoff, t + 2.0);
  }

  // A gentle filtered noise burst — the "squelch" of the gut.
  _squelch() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const dur = 0.35;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 200 + Math.random() * 400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.05);
    g.gain.linearRampToValueAtTime(0.0, ctx.currentTime + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
  }

  _scheduleSquelch() {
    if (!this.enabled) return;
    const next = 2500 + Math.random() * 4000;
    this.squelchTimer = setTimeout(() => {
      this._squelch();
      this._scheduleSquelch();
    }, next);
  }
}
