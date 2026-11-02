/**
 * Shared effect units: generated-impulse convolution reverb, tempo-synced
 * ping-pong feedback delay, and the master dynamics chain.
 */
import { curve, kitFor } from "./synth";

/**
 * Stereo impulse response: a few early reflections, then exponentially decaying
 * noise that gets darker over time (one-pole low-pass whose cutoff falls), with
 * decorrelated L/R for width.
 */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number, bright = 0.6, seed = 1): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const buf = ctx.createBuffer(2, len, sr);
  let s = (0x1234567 * seed) >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    const pre = Math.floor(sr * 0.012); // pre-delay
    for (let i = 0; i < len; i++) {
      const tt = i / len;
      // brightness falls from `bright` to ~0.05 across the tail
      const a = 0.05 + (bright - 0.05) * Math.pow(1 - tt, 2);
      lp += a * (rnd() - lp);
      const env = i < pre ? 0 : Math.pow(1 - tt, decay) * Math.exp(-tt * 3);
      // fade-in over 4 ms after the pre-delay to avoid a hard edge
      const fin = i < pre ? 0 : Math.min(1, (i - pre) / (sr * 0.004));
      d[i] = lp * env * fin;
    }
    // early reflections
    const taps = [0.013, 0.019, 0.027, 0.034, 0.041, 0.053, 0.067];
    for (let k = 0; k < taps.length; k++) {
      const i = Math.floor(sr * (taps[k] + (c ? 0.0023 * k : 0)));
      if (i < len) d[i] += (rnd() > 0 ? 1 : -1) * 0.5 * Math.pow(0.8, k);
    }
    // normalise energy so different lengths sit at a similar level
    let e = 0;
    for (let i = 0; i < len; i++) e += d[i] * d[i];
    const g = 1 / Math.sqrt(Math.max(e, 1e-9)) * 0.9;
    for (let i = 0; i < len; i++) d[i] *= g;
  }
  return buf;
}

export interface Reverb {
  input: GainNode;
  output: GainNode;
}

export function makeReverb(ctx: BaseAudioContext, dest: AudioNode, seconds: number, decay: number, wet: number, bright = 0.6, seed = 1): Reverb {
  const input = ctx.createGain();
  // keep low end out of the reverb (mud) and tame fizz
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 260;
  const conv = ctx.createConvolver();
  conv.normalize = false;
  conv.buffer = makeImpulse(ctx, seconds, decay, bright, seed);
  const output = ctx.createGain();
  output.gain.value = wet;
  input.connect(hp).connect(conv).connect(output).connect(dest);
  return { input, output };
}

export interface Delay {
  input: GainNode;
  output: GainNode;
  setTime(sec: number, at: number): void;
}

/** Ping-pong delay with a darkening feedback loop. */
export function makeDelay(ctx: BaseAudioContext, dest: AudioNode, time: number, feedback: number, wet: number): Delay {
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = wet;
  const dl = ctx.createDelay(2);
  const dr = ctx.createDelay(2);
  dl.delayTime.value = time;
  dr.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3800;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 350;
  const merger = ctx.createChannelMerger(2);
  // input (mono sum) -> L delay -> R delay -> feedback -> L delay ...
  input.connect(hp).connect(dl);
  dl.connect(dr);
  dr.connect(tone).connect(fb).connect(dl);
  dl.connect(merger, 0, 0);
  dr.connect(merger, 0, 1);
  merger.connect(output).connect(dest);
  return {
    input,
    output,
    setTime(sec, at) {
      const v = Math.min(1.9, Math.max(0.02, sec));
      dl.delayTime.setTargetAtTime(v, at, 0.05);
      dr.delayTime.setTargetAtTime(v, at, 0.05);
    },
  };
}

export interface Master {
  input: GainNode;
  comp: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  /** final node (already connected to the destination); tap it for meters */
  output: AudioNode;
}

/**
 * master gain -> DC blocker -> glue compressor -> limiter -> soft safety clipper -> destination
 *
 * DynamicsCompressorNode applies an automatic makeup gain that depends only on its
 * (fixed) threshold/knee/ratio. The trims below cancel it (values measured in
 * Chromium: +4.80 dB for the glue comp, +1.71 dB for the limiter) so the chain is
 * unity gain below -18 dBFS - the mix stays predictable and the limiter ceiling
 * sits around -2.5 dBFS.
 */
export function makeMaster(ctx: BaseAudioContext): Master {
  const input = ctx.createGain();
  // DC blocker / sub-rumble cut: nothing useful below ~30 Hz (and phone speakers start ~150 Hz)
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 32;
  hp.Q.value = 0.6;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  const compTrim = ctx.createGain();
  compTrim.gain.value = Math.pow(10, -4.8 / 20);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  const limTrim = ctx.createGain();
  limTrim.gain.value = Math.pow(10, -1.71 / 20);
  const clip = ctx.createWaveShaper();
  clip.curve = curve(kitFor(ctx), "clip");
  input.connect(hp).connect(comp).connect(compTrim).connect(limiter).connect(limTrim).connect(clip).connect(ctx.destination);
  return { input, comp, limiter, output: clip };
}
