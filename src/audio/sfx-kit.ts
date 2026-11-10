/**
 * Shared building blocks for the SFX libraries (sfx.ts, sfx-s2.ts).
 */
import type { SfxOpts } from "./api";
import { curve, semis as st, type Voice } from "./synth";

export interface SfxDef {
  play(v: Voice, p: number, o: SfxOpts): void;
  vol?: number;
  gap?: number;
  max?: number;
  pri?: number;
  rev?: number;
  rnd?: number;
  /** Never subject to the engine's global low-priority voice budget (UI ticks, boss hits). */
  free?: boolean;
  /** Always subject to that budget despite a higher priority (spammy weapon booms). */
  budget?: boolean;
}

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** sparkle tail: a few random high FM pings */
export function sparkles(v: Voice, t: number, n: number, base: number, spread: number, vol: number, step = 0.045): void {
  const scale = [0, 4, 7, 12, 16, 19, 24];
  for (let i = 0; i < n; i++) {
    const s = scale[Math.floor(Math.random() * Math.min(scale.length, spread))];
    let f = base * st(s);
    while (f > 4800) f /= 2; // keep FM sidebands well below Nyquist (and ears happy)
    v.fm({ t: t + i * step + Math.random() * step * 0.5, f, ratio: 3.5, idx: 1.1, idx2: 0.05, a: 0.001, d: 0.22, s: 0, v: vol * (1 - (i / n) * 0.6), pan: rand(-0.5, 0.5) });
  }
}

/** low punchy boom */
export function boom(v: Voice, t: number, f: number, dur: number, vol: number): void {
  v.tone({ t, w: "sine", f: f * 2.2, f2: f * 0.5, gt: dur * 0.35, a: 0.001, d: dur, s: 0, v: vol });
  v.tone({ t, w: "triangle", f: f * 4, f2: f, gt: 0.04, a: 0.001, d: 0.08, s: 0, v: vol * 0.35 });
}

/** A sub-bus through a wave-shaper (bitcrush / drive) into the voice output. */
export function shaped(v: Voice, kind: "crush" | "lofi" | "drive", gain = 1): GainNode {
  const g = v.ctx.createGain();
  g.gain.value = gain;
  const ws = v.ctx.createWaveShaper();
  ws.curve = curve(v.kit, kind);
  g.connect(ws).connect(v.out);
  return g;
}
