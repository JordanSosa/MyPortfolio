/**
 * The SFX library: one synthesised patch per SfxId.
 *
 * Every patch renders into a Voice starting at its t0; `p` is the pitch ratio
 * (from opts.pitch + the patch's own random spread). Frequencies are written in
 * Hz or as note-ish constants; `st(n)` = semitone ratio.
 *
 * Meta per sound:
 *   vol  base level            gap  min seconds between two triggers of this id
 *   max  max concurrent        pri  priority for voice stealing (0 spam .. 3 critical)
 *   rev  reverb send           rnd  random pitch spread (+- semitones)
 */
import type { SfxId, SfxOpts } from "./api";
import { semis as st, type Voice } from "./synth";

export interface SfxDef {
  play(v: Voice, p: number, o: SfxOpts): void;
  vol?: number;
  gap?: number;
  max?: number;
  pri?: number;
  rev?: number;
  rnd?: number;
}

// note frequencies used a lot
const C5 = 523.25, E5 = 659.26, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568, C7 = 2093;
// Stingers that fire during battle are tuned to the battle theme's key (A major).
const A3 = 220, A4 = 440, A6 = 1760, CS6 = 1108.7;

const VOWELS: [number, number][] = [
  [820, 1250], // a
  [330, 2350], // i
  [380, 950], // u
  [500, 1950], // e
  [540, 880], // o
];

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** sparkle tail: a few random high FM pings */
function sparkles(v: Voice, t: number, n: number, base: number, spread: number, vol: number, step = 0.045): void {
  const scale = [0, 4, 7, 12, 16, 19, 24];
  for (let i = 0; i < n; i++) {
    const s = scale[Math.floor(Math.random() * Math.min(scale.length, spread))];
    let f = base * st(s);
    while (f > 4800) f /= 2; // keep FM sidebands well below Nyquist (and ears happy)
    v.fm({ t: t + i * step + Math.random() * step * 0.5, f, ratio: 3.5, idx: 1.1, idx2: 0.05, a: 0.001, d: 0.22, s: 0, v: vol * (1 - (i / n) * 0.6), pan: rand(-0.5, 0.5) });
  }
}

/** low punchy boom */
function boom(v: Voice, t: number, f: number, dur: number, vol: number): void {
  v.tone({ t, w: "sine", f: f * 2.2, f2: f * 0.5, gt: dur * 0.35, a: 0.001, d: dur, s: 0, v: vol });
  v.tone({ t, w: "triangle", f: f * 4, f2: f, gt: 0.04, a: 0.001, d: 0.08, s: 0, v: vol * 0.35 });
}

export const SFX: Record<SfxId, SfxDef> = {
  // ------------------------------------------------------------------ UI
  uiMove: {
    vol: 0.41, gap: 0.03, max: 2, pri: 1,
    play(v, p) {
      v.tone({ w: "triangle", f: E6 * p, f2: G6 * p, gt: 0.02, a: 0.001, d: 0.055, v: 0.32 });
      v.tone({ w: "sine", f: E6 * 2 * p, a: 0.001, d: 0.03, v: 0.05 });
    },
  },
  uiConfirm: {
    vol: 0.72, gap: 0.05, max: 2, pri: 2, rev: 0.25,
    play(v, p) {
      v.tone({ w: "p25", f: A5 * p, a: 0.002, d: 0.08, v: 0.24, lp: 6000 });
      v.tone({ t: 0.06, w: "p25", f: A5 * st(7) * p, a: 0.002, d: 0.2, v: 0.24, lp: 6000 });
      v.fm({ t: 0.06, f: A6 * st(7) * p, ratio: 3.5, idx: 1, d: 0.45, v: 0.07 });
    },
  },
  uiBack: {
    vol: 0.71, gap: 0.05, max: 2, pri: 2,
    play(v, p) {
      v.tone({ w: "triangle", f: G5 * p, a: 0.002, d: 0.08, v: 0.36 });
      v.tone({ t: 0.065, w: "triangle", f: C5 * p, a: 0.002, d: 0.16, v: 0.36 });
    },
  },
  uiDeny: {
    vol: 0.96, gap: 0.12, max: 1, pri: 2,
    play(v, p) {
      for (let i = 0; i < 2; i++) v.tone({ t: i * 0.09, w: "square", f: 233 * p, f2: 196 * p, a: 0.002, d: 0.075, v: 0.2, lp: 1500 });
    },
  },
  cardFlip: {
    vol: 0.79, gap: 0.04, max: 3, pri: 1,
    play(v, p) {
      v.noise({ a: 0.004, d: 0.09, v: 0.26, bp: 1800 * p, bp2: 6500 * p, bpt: 0.08, q: 1.5 });
      v.tone({ t: 0.05, w: "triangle", f: 1760 * p, a: 0.001, d: 0.05, v: 0.16 });
    },
  },
  cardPick: {
    vol: 0.6, gap: 0.1, max: 1, pri: 2, rev: 0.35,
    play(v, p) {
      [0, 4, 7, 12, 16].forEach((s, i) => v.tone({ t: i * 0.035, w: "p25", f: A5 * st(s) * p, a: 0.002, d: 0.13, v: 0.15, lp: 7000 }));
      v.fm({ t: 0.15, f: A6 * p, ratio: 3.5, idx: 1.2, d: 0.7, v: 0.1 });
      v.noise({ a: 0.002, d: 0.14, v: 0.08, hp: 6000 });
      v.tone({ w: "sine", f: 140, f2: 70, gt: 0.08, a: 0.001, d: 0.14, v: 0.3 });
    },
  },
  reroll: {
    vol: 1.14, gap: 0.15, max: 1, pri: 2, rev: 0.2,
    play(v, p) {
      for (let i = 0; i < 10; i++) v.tone({ t: i * 0.028, w: "square", f: 600 * p * st(i * 1.5), a: 0.001, d: 0.025, v: 0.1, lp: 4500 });
      v.noise({ a: 0.05, d: 0.3, v: 0.1, bp: 1000, bp2: 5000, bpt: 0.3, q: 1 });
      v.tone({ t: 0.3, w: "p25", f: A6 * p, a: 0.002, d: 0.16, v: 0.16 });
      v.fm({ t: 0.3, f: A6 * 2 * p, ratio: 3.5, idx: 1, d: 0.3, v: 0.05 });
    },
  },
  countTick: {
    vol: 0.43, gap: 0.035, max: 2, pri: 0,
    play(v, p) {
      v.tone({ w: "square", f: 1200 * p, a: 0.001, d: 0.028, v: 0.12, lp: 5000 });
      v.tone({ w: "sine", f: 2400 * p, a: 0.001, d: 0.02, v: 0.04 });
    },
  },

  // ------------------------------------------------------------------ player
  dash: {
    vol: 1.37, gap: 0.08, max: 2, pri: 2,
    play(v, p) {
      v.noise({ a: 0.018, d: 0.22, v: 0.36, bp: 650 * p, bp2: 3800 * p, bpt: 0.13, q: 1.3 });
      v.noise({ a: 0.005, d: 0.08, v: 0.08, hp: 7000 });
      v.tone({ w: "sine", f: 480 * p, f2: 1500 * p, gt: 0.1, a: 0.004, d: 0.13, v: 0.1 });
    },
  },
  playerHurt: {
    vol: 0.67, gap: 0.12, max: 1, pri: 3,
    play(v, p) {
      v.tone({ w: "square", f: 720 * p, f2: 180 * p, gt: 0.17, a: 0.002, d: 0.22, v: 0.2, lp: 3200, drive: "soft" });
      v.tone({ w: "sawtooth", f: 370 * p, f2: 92 * p, gt: 0.17, a: 0.002, d: 0.2, v: 0.14, lp: 2200 });
      v.noise({ a: 0.001, d: 0.11, v: 0.34, bp: 1500, q: 0.8 });
      v.tone({ w: "sine", f: 150, f2: 55, gt: 0.1, a: 0.0015, d: 0.2, v: 0.5 });
    },
  },
  playerDie: {
    vol: 1.88, gap: 0.5, max: 1, pri: 3, rev: 0.4,
    play(v, p) {
      [12, 7, 3, 0, -5, -9].forEach((s, i) =>
        v.tone({ t: i * 0.11, w: "p25", f: A5 * st(s) * p, f2: A5 * st(s - 1) * p, gt: 0.22, a: 0.003, d: 0.32, v: 0.15, vib: 30, vr: 7, vd: 0.04, lp: 4500 }),
      );
      v.tone({ t: 0.66, w: "triangle", f: 220 * p, f2: 55 * p, gt: 0.9, a: 0.01, d: 1.0, v: 0.3 });
      v.noise({ a: 0.002, d: 0.5, v: 0.22, lp: 2500, lp2: 200, lpt: 0.5 });
      v.tone({ w: "sine", f: 130, f2: 40, gt: 0.4, a: 0.002, d: 0.6, v: 0.55 });
    },
  },
  heal: {
    vol: 0.75, gap: 0.15, max: 1, pri: 2, rev: 0.45,
    play(v, p) {
      [0, 4, 7, 12].forEach((s, i) => {
        v.tone({ t: i * 0.06, w: "sine", f: A5 * st(s) * p, a: 0.004, d: 0.42, v: 0.18 });
        v.fm({ t: i * 0.06 + 0.02, f: A6 * st(s) * p, ratio: 2, idx: 0.6, d: 0.4, v: 0.05 });
      });
      v.noise({ a: 0.15, d: 0.3, v: 0.04, hp: 7500 });
    },
  },
  levelUp: {
    vol: 1.24, gap: 0.2, max: 1, pri: 3, rev: 0.45,
    play(v, p) {
      const arp = [0, 4, 7, 12, 16, 19, 24];
      arp.forEach((s, i) => v.tone({ t: i * 0.045, w: "p25", f: A4 * st(s) * p, a: 0.002, d: 0.17, v: 0.17, lp: 7500, pan: (i / 6 - 0.5) * 0.5 }));
      const t0 = arp.length * 0.045;
      for (const s of [12, 16, 19, 24]) v.tone({ t: t0, w: "p25", f: A4 * st(s) * p, a: 0.004, d: 0.2, s: 0.6, len: 0.45, r: 0.45, v: 0.075, vib: 18, vr: 6.5, vd: 0.1, lp: 6500 });
      v.tone({ t: t0, w: "triangle", f: 110 * p, a: 0.003, d: 0.5, s: 0.4, len: 0.3, r: 0.3, v: 0.36 });
      v.tone({ t: t0, w: "sine", f: 55 * p, a: 0.002, d: 0.4, s: 0, v: 0.35 });
      sparkles(v, t0, 9, A6 * p, 7, 0.06, 0.055);
      v.noise({ t: t0 - 0.12, a: 0.14, d: 0.6, v: 0.07, hp: 8000 });
    },
  },
  evolve: {
    vol: 1.56, gap: 0.5, max: 1, pri: 3, rev: 0.55,
    play(v, p) {
      // rising magical whoosh
      v.noise({ a: 0.6, d: 0.1, v: 0.2, bp: 400, bp2: 9000, bpt: 0.7, q: 1.6 });
      for (let i = 0; i < 12; i++) v.tone({ t: i * 0.05, w: "p12", f: E5 * st(i * 2) * p, a: 0.002, d: 0.08, v: 0.08, lp: 8000 });
      const t0 = 0.68;
      // huge Cmaj9 bloom (detuned saws + pulses)
      for (const s of [-12, 0, 4, 7, 11, 14, 19]) {
        v.tone({ t: t0, w: "sawtooth", f: A4 * st(s) * p, det: rand(-10, 10), a: 0.01, d: 0.4, s: 0.55, len: 0.9, r: 0.9, v: 0.045, lp: 6000, lp2: 2200, lpt: 1.2 });
        v.tone({ t: t0, w: "p25", f: A4 * st(s + 12) * p, a: 0.005, d: 0.3, s: 0.4, len: 0.7, r: 0.7, v: 0.025, vib: 20, vr: 6, vd: 0.15 });
      }
      boom(v, t0, 55, 0.9, 0.55);
      v.noise({ t: t0, a: 0.002, d: 1.2, v: 0.14, hp: 4500 });
      // bell cascade down then up
      [24, 19, 16, 12, 7, 12, 16, 19, 24, 28].forEach((s, i) =>
        v.fm({ t: t0 + 0.05 + i * 0.07, f: A5 * st(s) * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.5, v: 0.07, pan: Math.sin(i) * 0.6 }),
      );
    },
  },
  revive: {
    vol: 1.47, gap: 0.5, max: 1, pri: 3, rev: 0.55,
    play(v, p) {
      v.noise({ a: 0.5, d: 0.2, v: 0.14, bp: 600, bp2: 7000, bpt: 0.6, q: 1.2 });
      for (const s of [0, 7, 12, 16, 19]) v.tone({ t: 0.25, w: "soft", f: A4 * st(s) * p, a: 0.25, d: 0.4, s: 0.7, len: 0.8, r: 0.7, v: 0.07, vib: 10, vr: 5 });
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => v.fm({ t: 0.5 + i * 0.06, f: A6 * st(s) * p, ratio: 3.5, idx: 1.2, d: 0.6, v: 0.07 }));
      boom(v, 0.5, 60, 0.7, 0.4);
    },
  },
  ultReady: {
    vol: 1.34, gap: 0.5, max: 1, pri: 3, rev: 0.45,
    play(v, p) {
      v.fm({ f: E6 * p, ratio: 3.5, idx: 1.4, idx2: 0.05, d: 0.6, v: 0.16 });
      v.fm({ t: 0.09, f: E6 * st(7) * p, ratio: 3.5, idx: 1.4, idx2: 0.05, d: 0.7, v: 0.16 });
      v.tone({ w: "p25", f: E6 * p, a: 0.002, d: 0.08, v: 0.1 });
      v.tone({ t: 0.09, w: "p25", f: E6 * st(7) * p, a: 0.002, d: 0.14, v: 0.1 });
      sparkles(v, 0.16, 6, E6 * 2 * p, 6, 0.04, 0.05);
      v.noise({ a: 0.05, d: 0.4, v: 0.05, hp: 8000 });
    },
  },
  ultCutin: {
    vol: 1.82, gap: 0.5, max: 1, pri: 3, rev: 0.4,
    play(v, p) {
      // anime whoosh up
      v.noise({ a: 0.28, d: 0.12, v: 0.4, bp: 300, bp2: 6000, bpt: 0.36, q: 1.4 });
      v.tone({ w: "sawtooth", f: 120 * p, f2: 900 * p, gt: 0.36, a: 0.2, d: 0.15, v: 0.08, lp: 3000 });
      // impact
      boom(v, 0.34, 50, 0.6, 0.5);
      v.noise({ t: 0.34, a: 0.001, d: 0.2, v: 0.25, lp: 3000 });
      // "shing!" metallic ring: inharmonic FM partials
      for (const [f, d, g] of [[2650, 1.1, 0.07], [3970, 0.9, 0.05], [5310, 0.7, 0.035], [1770, 1.0, 0.04]] as const) {
        v.fm({ t: 0.36, f: f * p, ratio: 1.41, idx: 1.6, idx2: 0.1, it: 0.4, a: 0.001, d, v: g, vib: 8, vr: 9 });
      }
      v.noise({ t: 0.36, a: 0.001, d: 0.35, v: 0.12, hp: 7000 });
    },
  },
  ultBlast: {
    vol: 0.84, gap: 0.5, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      boom(v, 0, 45, 1.6, 0.85);
      v.tone({ w: "sine", f: 90, f2: 28, gt: 1.2, a: 0.002, d: 1.8, v: 0.5 });
      v.noise({ a: 0.001, d: 1.6, v: 0.42, lp: 6000, lp2: 250, lpt: 1.4, crackle: 23 });
      v.noise({ a: 0.001, d: 2.2, v: 0.18, hp: 3500 });
      // big bright chord stab
      for (const s of [0, 7, 12, 16, 19, 24]) v.tone({ w: "sawtooth", f: A3 * st(s) * p, det: rand(-12, 12), a: 0.004, d: 0.9, s: 0, v: 0.05, lp: 7000, lp2: 900, lpt: 0.9 });
      sparkles(v, 0.25, 12, A6 * p, 7, 0.05, 0.07);
    },
  },
  voiceBlip: {
    vol: 0.96, gap: 0.05, max: 3, pri: 2, rnd: 1.5,
    play(v, p) {
      const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
      const k = 1.18; // small anime voice: formants scaled up
      const len = rand(0.055, 0.085);
      const f0 = rand(430, 520) * p;
      v.noise({ a: 0.001, d: 0.012, v: 0.08, bp: rand(2500, 5000), q: 2 });
      v.formant({
        t: 0.006, f: f0, w: "sawtooth", a: 0.006, d: 0.03, s: 0.8, len, r: 0.035, v: 0.4, q: 6,
        pc: [[0, 1.5], [0.5, 2], [1, -1]],
        vc: [[0, f1 * k * 0.7, f2 * k * 1.15], [0.35, f1 * k, f2 * k], [1, f1 * k * 0.95, f2 * k * 0.95]],
      });
    },
  },

  // ------------------------------------------------------------------ pickups
  gem: {
    vol: 0.48, gap: 0.025, max: 4, pri: 0, rev: 0.15,
    play(v, p) {
      const f = E6 * 0.75 * p;
      v.tone({ w: "triangle", f, a: 0.001, d: 0.045, v: 0.3 });
      v.tone({ t: 0.03, w: "p12", f: f * st(7), a: 0.001, d: 0.09, v: 0.16, lp: 9000 });
      v.fm({ t: 0.03, f: f * 2, ratio: 3.5, idx: 0.9, idx2: 0.05, d: 0.16, v: 0.06 });
    },
  },
  coin: {
    vol: 1.11, gap: 0.04, max: 3, pri: 1, rev: 0.15,
    play(v, p) {
      v.tone({ w: "p25", f: 1760 * p, a: 0.001, d: 0.05, v: 0.17, lp: 8000 });
      v.tone({ t: 0.045, w: "p25", f: 2349 * p, a: 0.001, d: 0.22, v: 0.15, lp: 8000 });
      v.fm({ t: 0.045, f: 2349 * p, ratio: 2.76, idx: 1.2, idx2: 0.05, d: 0.25, v: 0.05 });
    },
  },
  magnet: {
    vol: 1.71, gap: 0.3, max: 1, pri: 2, rev: 0.3,
    play(v, p) {
      v.tone({ w: "sawtooth", f: 220 * p, f2: 1400 * p, gt: 0.55, a: 0.02, d: 0.65, s: 0, v: 0.1, lp: 2600, vib: 90, vr: 14, vd: 0 });
      v.tone({ w: "sine", f: 440 * p, f2: 2200 * p, gt: 0.55, a: 0.02, d: 0.65, v: 0.12, trem: 0.7, tr: 16 });
      v.noise({ a: 0.4, d: 0.25, v: 0.12, bp: 800, bp2: 6000, bpt: 0.6, q: 2 });
      sparkles(v, 0.5, 5, A6 * p, 6, 0.05);
    },
  },
  chestDrop: {
    vol: 0.36, gap: 0.2, max: 2, pri: 2, rev: 0.25,
    play(v, p) {
      boom(v, 0, 62 * p, 0.35, 0.6);
      v.noise({ a: 0.001, d: 0.12, v: 0.28, lp: 1500 });
      v.fm({ t: 0.02, f: 1250 * p, ratio: 2.4, idx: 2, idx2: 0.1, d: 0.35, v: 0.07 });
      v.fm({ t: 0.12, f: 1250 * st(5) * p, ratio: 2.4, idx: 1.5, idx2: 0.1, d: 0.3, v: 0.05 });
      v.noise({ t: 0.1, a: 0.001, d: 0.05, v: 0.08, bp: 2500, q: 2 });
    },
  },
  chestOpen: {
    vol: 1.27, gap: 0.3, max: 1, pri: 3, rev: 0.45,
    play(v, p) {
      // creak, burst, sparkle chord
      v.tone({ w: "sawtooth", f: 140 * p, f2: 260 * p, gt: 0.22, a: 0.02, d: 0.24, v: 0.06, lp: 1400, trem: 0.8, tr: 33 });
      v.noise({ t: 0.22, a: 0.001, d: 0.35, v: 0.3, lp: 5000, lp2: 600, lpt: 0.3 });
      boom(v, 0.22, 70, 0.4, 0.4);
      [0, 4, 7, 11, 14, 19].forEach((s, i) => v.tone({ t: 0.24 + i * 0.03, w: "p25", f: A5 * st(s) * p, a: 0.002, d: 0.35, s: 0, v: 0.09, lp: 8000 }));
      sparkles(v, 0.3, 10, A6 * p, 7, 0.05, 0.05);
      v.noise({ t: 0.25, a: 0.2, d: 0.5, v: 0.06, hp: 8000 });
    },
  },
  chestReel: {
    vol: 0.59, gap: 0.045, max: 2, pri: 1,
    play(v, p) {
      v.tone({ w: "square", f: 900 * p, a: 0.001, d: 0.03, v: 0.12, lp: 4000 });
      v.tone({ t: 0.008, w: "triangle", f: 1800 * p, a: 0.001, d: 0.04, v: 0.12 });
      v.noise({ a: 0.001, d: 0.012, v: 0.06, hp: 5000 });
    },
  },
  chestJackpot: {
    vol: 1.72, gap: 0.5, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      // slot-machine jackpot: fast alternating bell trills over a rising arp, then a big chord
      for (let i = 0; i < 16; i++) v.fm({ t: i * 0.04, f: (i % 2 ? CS6 : E6) * p * st(Math.floor(i / 4) * 2), ratio: 3.5, idx: 1.2, d: 0.12, v: 0.07, pan: i % 2 ? 0.4 : -0.4 });
      [0, 4, 7, 12, 16, 19, 24, 28].forEach((s, i) => v.tone({ t: i * 0.07, w: "p25", f: A4 * st(s) * p, a: 0.002, d: 0.12, v: 0.13, lp: 7000 }));
      const t0 = 0.62;
      for (const s of [0, 4, 7, 12, 16]) v.tone({ t: t0, w: "sawtooth", f: A4 * st(s) * p, det: rand(-8, 8), a: 0.006, d: 0.3, s: 0.6, len: 0.6, r: 0.6, v: 0.05, lp: 5000, lp2: 2000, lpt: 0.8, vib: 15, vr: 6, vd: 0.2 });
      boom(v, t0, 60, 0.7, 0.5);
      v.noise({ t: t0, a: 0.002, d: 1.3, v: 0.15, hp: 4000 });
      sparkles(v, t0 + 0.05, 14, A6 * p, 7, 0.055, 0.06);
    },
  },
  food: {
    vol: 0.71, gap: 0.12, max: 1, pri: 2, rev: 0.2,
    play(v, p) {
      // "nom nom": two bubbly bloops + sparkle
      for (let i = 0; i < 2; i++) v.tone({ t: i * 0.11, w: "sine", f: 300 * p * st(i * 3), f2: 760 * p * st(i * 3), gt: 0.05, a: 0.002, d: 0.09, v: 0.35 });
      v.tone({ t: 0.22, w: "p25", f: A6 * p, a: 0.002, d: 0.12, v: 0.1 });
      sparkles(v, 0.22, 4, A6 * p, 5, 0.05);
    },
  },
  powerup: {
    vol: 1.7, gap: 0.2, max: 1, pri: 2, rev: 0.35,
    play(v, p) {
      for (let i = 0; i < 9; i++) v.tone({ t: i * 0.035, w: "square", f: A4 * p * st([0, 4, 7, 12, 4, 7, 12, 16, 19][i]), a: 0.002, d: 0.07, v: 0.1, lp: 5000 });
      v.tone({ t: 0.32, w: "p25", f: A6 * p, a: 0.003, d: 0.2, s: 0.5, len: 0.15, r: 0.25, v: 0.12, vib: 25, vr: 9, vd: 0.02 });
      v.noise({ a: 0.25, d: 0.25, v: 0.07, bp: 1500, bp2: 8000, bpt: 0.3, q: 1.5 });
    },
  },

  // ------------------------------------------------------------------ combat
  hit: {
    vol: 0.21, gap: 0.03, max: 4, pri: 0, rnd: 0.4,
    play(v, p) {
      v.tone({ w: "triangle", f: 1900 * p, f2: 820 * p, gt: 0.025, a: 0.001, d: 0.035, v: 0.34 });
      v.noise({ a: 0.0008, d: 0.016, v: 0.18, hp: 3500 * p });
    },
  },
  hitCrit: {
    vol: 0.67, gap: 0.04, max: 3, pri: 1, rnd: 0.5,
    play(v, p) {
      v.tone({ w: "square", f: 980 * p, f2: 260 * p, gt: 0.05, a: 0.001, d: 0.07, v: 0.2, lp: 4500, drive: "soft" });
      v.noise({ a: 0.001, d: 0.06, v: 0.3, bp: 3000 * p, q: 0.9 });
      v.fm({ t: 0.02, f: 3136 * p, ratio: 3.5, idx: 1, idx2: 0.05, d: 0.14, v: 0.08 });
      v.tone({ t: 0.02, w: "p12", f: 2637 * p, a: 0.001, d: 0.08, v: 0.06 });
    },
  },
  enemyDie: {
    vol: 0.32, gap: 0.03, max: 5, pri: 0, rnd: 1.5,
    play(v, p) {
      // bubbly pop: fast upward bloop + click + tiny sparkle
      v.tone({ w: "sine", f: 260 * p, f2: 980 * p, gt: 0.045, a: 0.001, d: 0.075, v: 0.42 });
      v.tone({ w: "triangle", f: 520 * p, f2: 1400 * p, gt: 0.03, a: 0.001, d: 0.05, v: 0.12 });
      v.noise({ a: 0.0008, d: 0.022, v: 0.16, bp: 2200, q: 1 });
      v.tone({ t: 0.04, w: "p12", f: 2093 * p, a: 0.001, d: 0.05, v: 0.05 });
    },
  },
  eliteDie: {
    vol: 0.62, gap: 0.15, max: 2, pri: 2, rev: 0.4,
    play(v, p) {
      boom(v, 0, 60 * p, 0.6, 0.55);
      v.tone({ w: "sine", f: 200 * p, f2: 1200 * p, gt: 0.08, a: 0.001, d: 0.14, v: 0.35 });
      v.noise({ a: 0.001, d: 0.4, v: 0.3, lp: 5000, lp2: 400, lpt: 0.4, crackle: 31 });
      [0, 4, 7, 12, 16, 19].forEach((s, i) => v.tone({ t: 0.06 + i * 0.04, w: "p25", f: A5 * st(s) * p, a: 0.002, d: 0.12, v: 0.09, lp: 7000 }));
      sparkles(v, 0.25, 6, A6 * p, 7, 0.05);
    },
  },
  bossHit: {
    vol: 0.49, gap: 0.06, max: 2, pri: 1, rnd: 0.5,
    play(v, p) {
      v.tone({ w: "sine", f: 220 * p, f2: 80 * p, gt: 0.06, a: 0.001, d: 0.12, v: 0.42 });
      v.tone({ w: "square", f: 560 * p, f2: 240 * p, gt: 0.04, a: 0.001, d: 0.06, v: 0.1, lp: 2500 });
      v.noise({ a: 0.001, d: 0.05, v: 0.22, bp: 1800, q: 0.8 });
    },
  },
  bossDie: {
    vol: 1.02, gap: 1, max: 1, pri: 3, rev: 0.55,
    play(v, p) {
      // descending scream
      v.tone({ w: "sawtooth", f: 900 * p, f2: 70 * p, gt: 1.4, a: 0.01, d: 1.5, s: 0, v: 0.1, lp: 3000, vib: 60, vr: 11, vd: 0, drive: "soft" });
      v.tone({ w: "sawtooth", f: 912 * p, f2: 72 * p, gt: 1.4, a: 0.01, d: 1.5, s: 0, v: 0.07, lp: 2500 });
      // chained booms
      for (let i = 0; i < 6; i++) {
        boom(v, i * 0.2, rand(48, 70), 0.6, 0.45);
        v.noise({ t: i * 0.2, a: 0.001, d: 0.35, v: 0.22, lp: 4500, lp2: 300, lpt: 0.3, pan: rand(-0.6, 0.6) });
      }
      // final huge boom + rising sparkles
      boom(v, 1.3, 40, 2, 0.8);
      v.noise({ t: 1.3, a: 0.001, d: 2, v: 0.35, lp: 7000, lp2: 200, lpt: 1.6, crackle: 19 });
      v.noise({ t: 1.3, a: 0.002, d: 2.2, v: 0.15, hp: 4000 });
      [0, 4, 7, 12, 16, 19, 24, 28, 31, 36].forEach((s, i) => v.fm({ t: 1.4 + i * 0.07, f: C6 * st(s) * p, ratio: 3.5, idx: 1.2, idx2: 0.05, d: 0.6, v: 0.06, pan: Math.sin(i * 1.7) * 0.6 }));
    },
  },
  explosion: {
    vol: 0.32, gap: 0.05, max: 4, pri: 1, rev: 0.2, rnd: 1,
    play(v, p) {
      boom(v, 0, 52 * p, 0.32, 0.6);
      v.noise({ a: 0.001, d: 0.4, v: 0.36, lp: 3200 * p, lp2: 280, lpt: 0.35 });
      v.noise({ a: 0.001, d: 0.08, v: 0.15, hp: 3000 });
      sparkles(v, 0.06, 3, 2637 * p, 5, 0.035, 0.05);
    },
  },
  explosionBig: {
    vol: 0.58, gap: 0.09, max: 3, pri: 2, rev: 0.3, rnd: 0.7,
    play(v, p) {
      boom(v, 0, 42 * p, 0.85, 0.75);
      v.tone({ w: "sine", f: 80, f2: 30, gt: 0.6, a: 0.002, d: 1.0, v: 0.35 });
      v.noise({ a: 0.001, d: 1.0, v: 0.42, lp: 4800 * p, lp2: 200, lpt: 0.9, crackle: 27 });
      v.noise({ a: 0.001, d: 0.2, v: 0.2, hp: 2500 });
      v.noise({ t: 0.05, a: 0.01, d: 0.8, v: 0.08, hp: 6000, pan: 0.3 });
      sparkles(v, 0.12, 6, 2637 * p, 6, 0.04, 0.06);
    },
  },
  thunder: {
    vol: 0.32, gap: 0.08, max: 2, pri: 2, rev: 0.35, rnd: 1,
    play(v, p) {
      // crack: bright crackling noise + zap
      v.noise({ a: 0.0008, d: 0.18, v: 0.45, hp: 1800 * p, crackle: 61 });
      v.tone({ w: "sawtooth", f: 3200 * p, f2: 180 * p, gt: 0.09, a: 0.001, d: 0.12, v: 0.12, lp: 9000, drive: "drive" });
      // rumble
      v.noise({ t: 0.04, a: 0.04, d: 1.1, v: 0.38, lp: 500, lp2: 120, lpt: 1, crackle: 13, pink: true });
      v.tone({ w: "sine", f: 110, f2: 38, gt: 0.3, a: 0.002, d: 0.5, v: 0.4 });
    },
  },
  enemyShoot: {
    vol: 0.49, gap: 0.06, max: 3, pri: 0, rnd: 1,
    play(v, p) {
      v.tone({ w: "p25", f: 980 * p, f2: 420 * p, gt: 0.06, a: 0.001, d: 0.07, v: 0.16, lp: 5000 });
      v.tone({ w: "sine", f: 1960 * p, f2: 840 * p, gt: 0.05, a: 0.001, d: 0.05, v: 0.05 });
    },
  },
  telegraph: {
    vol: 1.47, gap: 0.12, max: 2, pri: 2,
    play(v, p) {
      for (let i = 0; i < 2; i++) v.tone({ t: i * 0.11, w: "p25", f: 1175 * p, a: 0.002, d: 0.08, s: 0, v: 0.14, lp: 6000 });
      v.tone({ w: "sine", f: 2350 * p, a: 0.002, d: 0.22, v: 0.04, trem: 1, tr: 18 });
    },
  },
  freeze: {
    vol: 0.85, gap: 0.3, max: 1, pri: 2, rev: 0.5,
    play(v, p) {
      [31, 28, 24, 19, 16, 12, 7].forEach((s, i) => v.fm({ t: i * 0.05, f: A4 * st(s) * p, ratio: 4.1, idx: 1.5, idx2: 0.05, d: 0.55, v: 0.07, pan: (i % 2 ? 0.4 : -0.4) }));
      v.noise({ a: 0.01, d: 0.8, v: 0.16, hp: 6000, hp2: 9000, hpt: 0.8 });
      v.tone({ w: "sine", f: 3500 * p, f2: 1800 * p, gt: 0.6, a: 0.005, d: 0.7, v: 0.05, vib: 40, vr: 13, vd: 0 });
      // crystal crack
      v.noise({ t: 0.38, a: 0.001, d: 0.06, v: 0.2, bp: 4500, q: 2.5 });
      v.fm({ t: 0.38, f: 2800 * p, ratio: 1.41, idx: 2, idx2: 0.1, d: 0.5, v: 0.06 });
    },
  },
  propBreak: {
    vol: 1.09, gap: 0.06, max: 2, pri: 1,
    play(v, p) {
      for (let i = 0; i < 4; i++) v.noise({ t: i * rand(0.018, 0.03), a: 0.001, d: rand(0.03, 0.06), v: 0.22, bp: rand(900, 2600) * p, q: 2 });
      v.tone({ w: "triangle", f: 420 * p, f2: 180 * p, gt: 0.06, a: 0.001, d: 0.09, v: 0.25 });
      v.tone({ t: 0.06, w: "sine", f: 300 * p, f2: 900 * p, gt: 0.05, a: 0.001, d: 0.07, v: 0.2 });
    },
  },

  // ------------------------------------------------------------------ weapons (frequent: short + quiet)
  starShot: {
    vol: 0.65, gap: 0.07, max: 3, pri: 0, rnd: 1, rev: 0.12,
    play(v, p) {
      v.tone({ w: "p12", f: 1320 * p, f2: 2640 * p, gt: 0.05, a: 0.001, d: 0.08, v: 0.16, lp: 9000 });
      v.fm({ t: 0.02, f: 2640 * p, ratio: 3.5, idx: 0.8, idx2: 0.05, d: 0.12, v: 0.05 });
    },
  },
  slash: {
    vol: 0.74, gap: 0.06, max: 3, pri: 1, rnd: 1,
    play(v, p) {
      v.noise({ a: 0.006, d: 0.13, v: 0.35, bp: 1300 * p, bp2: 5200 * p, bpt: 0.08, q: 1.8 });
      v.noise({ a: 0.002, d: 0.05, v: 0.1, hp: 6500 });
      v.fm({ t: 0.03, f: 1900 * p, ratio: 1.41, idx: 1.2, idx2: 0.05, d: 0.14, v: 0.04 });
    },
  },
  boomerang: {
    vol: 0.6, gap: 0.1, max: 2, pri: 0,
    play(v, p) {
      v.tone({ w: "triangle", f: 520 * p, f2: 780 * p, gt: 0.22, a: 0.01, d: 0.26, v: 0.2, trem: 0.9, tr: 22 });
      v.noise({ a: 0.03, d: 0.2, v: 0.12, bp: 1500 * p, bp2: 2600 * p, bpt: 0.2, q: 3 });
    },
  },
  bell: {
    vol: 1.29, gap: 0.08, max: 3, pri: 1, rev: 0.35, rnd: 0.5,
    play(v, p) {
      // Thunder Bell: bright temple-bell ding + electric zap
      v.fm({ f: 1760 * p, ratio: 2.76, idx: 1.6, idx2: 0.06, it: 0.4, a: 0.001, d: 0.7, v: 0.12 });
      v.fm({ f: 880 * p, ratio: 1.4, idx: 0.8, idx2: 0.04, a: 0.001, d: 0.5, v: 0.06 });
      v.tone({ w: "sawtooth", f: 4200 * p, f2: 600 * p, gt: 0.05, a: 0.001, d: 0.06, v: 0.05, lp: 9000 });
    },
  },
  candyThrow: {
    vol: 0.41, gap: 0.08, max: 2, pri: 0, rnd: 1,
    play(v, p) {
      v.tone({ w: "sine", f: 380 * p, f2: 900 * p, gt: 0.09, a: 0.002, d: 0.13, v: 0.3 });
      v.noise({ a: 0.01, d: 0.1, v: 0.07, bp: 2500, q: 1.5 });
    },
  },
  bubblePop: {
    vol: 0.41, gap: 0.04, max: 3, pri: 0, rnd: 3,
    play(v, p) {
      v.tone({ w: "sine", f: 620 * p, f2: 1700 * p, gt: 0.025, a: 0.001, d: 0.05, v: 0.3 });
      v.tone({ t: 0.008, w: "sine", f: 1300 * p, f2: 2400 * p, gt: 0.02, a: 0.001, d: 0.03, v: 0.08 });
    },
  },
  beam: {
    vol: 1.89, gap: 0.12, max: 2, pri: 1, rev: 0.2,
    play(v, p) {
      v.tone({ w: "sawtooth", f: 330 * p, f2: 660 * p, gt: 0.08, a: 0.004, d: 0.3, s: 0.6, len: 0.38, r: 0.12, v: 0.08, bp: 1500, bp2: 4500, bpt: 0.45, q: 3 });
      v.tone({ w: "sine", f: 1320 * p, a: 0.004, d: 0.2, s: 0.6, len: 0.38, r: 0.12, v: 0.08, vib: 40, vr: 24, vd: 0 });
      v.tone({ w: "p12", f: 2640 * p, f2: 1980 * p, gt: 0.45, a: 0.004, d: 0.2, s: 0.5, len: 0.36, r: 0.1, v: 0.04 });
    },
  },
  beamBig: {
    vol: 1.97, gap: 0.3, max: 1, pri: 2, rev: 0.3,
    play(v, p) {
      for (const det of [-14, 0, 14]) v.tone({ w: "sawtooth", f: 110 * p, f2: 220 * p, gt: 0.25, det, a: 0.02, d: 0.3, s: 0.7, len: 0.9, r: 0.3, v: 0.07, lp: 3000, q: 2 });
      v.tone({ w: "sine", f: 55, a: 0.02, d: 0.3, s: 0.8, len: 0.9, r: 0.3, v: 0.3 });
      v.noise({ a: 0.05, d: 0.3, s: 0.6, len: 0.9, r: 0.3, v: 0.12, bp: 2500, q: 1.2 });
      v.tone({ w: "sine", f: 1760 * p, a: 0.02, d: 0.3, s: 0.6, len: 0.9, r: 0.3, v: 0.05, vib: 50, vr: 20, vd: 0 });
    },
  },
  meow: {
    vol: 1.09, gap: 0.09, max: 3, pri: 2, rnd: 1.5, rev: 0.15,
    play(v, p) {
      // "mi-aa-ow": rising then falling pitch through moving formants (i -> a -> u)
      const f0 = rand(600, 700) * p;
      const len = rand(0.36, 0.46);
      v.formant({
        f: f0, w: "sawtooth", a: 0.02, d: 0.05, s: 0.85, len, r: 0.08, v: 0.42, q: 6, vib: 18, vr: 7,
        pc: [[0, -1], [0.3, 3], [0.65, 1.5], [1, -5]],
        vc: [[0, 360, 2300], [0.32, 720, 1700], [0.62, 880, 1300], [1, 460, 820]],
      });
      v.noise({ a: 0.03, d: 0.1, v: 0.025, bp: 3000, q: 1.5 });
    },
  },
  orbitHit: {
    vol: 0.41, gap: 0.045, max: 3, pri: 0, rnd: 1.5,
    play(v, p) {
      v.tone({ w: "triangle", f: 560 * p, f2: 260 * p, gt: 0.04, a: 0.001, d: 0.065, v: 0.32 });
      v.noise({ a: 0.001, d: 0.02, v: 0.08, lp: 3000 });
    },
  },

  // ------------------------------------------------------------------ events
  warning: {
    vol: 1.12, gap: 0.5, max: 2, pri: 3, rev: 0.3,
    play(v, p) {
      // two-tone siren: hi-lo-hi-lo with slides, over a low "dun"
      const hi = 932 * p, lo = 698 * p;
      for (let i = 0; i < 4; i++) {
        const f = i % 2 ? lo : hi;
        for (const [w, g, det] of [["sawtooth", 0.055, -8], ["p25", 0.07, 8]] as const) {
          v.tone({ t: i * 0.22, w, f: f * 0.97, f2: f, gt: 0.04, det, a: 0.008, d: 0.05, s: 0.85, len: 0.19, r: 0.03, v: g, lp: 3500 });
        }
      }
      v.tone({ w: "sawtooth", f: 58, a: 0.004, d: 0.6, s: 0, v: 0.18, lp: 600 });
      v.tone({ w: "sine", f: 58, a: 0.004, d: 0.8, s: 0, v: 0.35 });
    },
  },
  bossRoar: {
    vol: 1.94, gap: 1, max: 1, pri: 3, rev: 0.4,
    play(v, p) {
      const dur = 1.5;
      const g = v.filter("bandpass", 380, 1100, 0.35, 1.2);
      for (const [f, det] of [[72, -18], [73.5, 9], [96, 25], [48, 0]] as const) {
        v.tone({ w: "sawtooth", f: f * p * 0.85, f2: f * p * 0.62, gt: dur, det, a: 0.08, d: 0.3, s: 0.8, len: dur * 0.75, r: 0.4, v: 0.13, drive: "drive", trem: 0.5, tr: 23, vib: 35, vr: 5.5, vd: 0.2, out: g });
      }
      v.tone({ w: "sawtooth", f: 64 * p, f2: 40 * p, gt: dur, a: 0.06, d: 0.3, s: 0.8, len: dur * 0.75, r: 0.4, v: 0.15, lp: 500 });
      v.noise({ a: 0.08, d: 0.3, s: 0.6, len: dur * 0.7, r: 0.5, v: 0.22, lp: 900, lp2: 250, lpt: dur, crackle: 17, pink: true });
      boom(v, 0, 40, 1.2, 0.5);
    },
  },
  comboUp: {
    vol: 0.65, gap: 0.08, max: 2, pri: 1,
    play(v, p) {
      v.tone({ w: "p25", f: 1175 * p, a: 0.001, d: 0.05, v: 0.15, lp: 7000 });
      v.tone({ t: 0.045, w: "p25", f: 1568 * p, a: 0.001, d: 0.1, v: 0.15, lp: 7000 });
    },
  },
  comboBreak: {
    vol: 0.74, gap: 0.3, max: 1, pri: 2, rev: 0.25,
    play(v, p) {
      // glass shatter + sad descending blips
      for (let i = 0; i < 6; i++) v.fm({ t: i * rand(0.01, 0.025), f: rand(2500, 5500) * p, ratio: 1.41, idx: 2, idx2: 0.1, d: rand(0.08, 0.2), v: 0.05, pan: rand(-0.6, 0.6) });
      v.noise({ a: 0.001, d: 0.25, v: 0.24, hp: 4000 });
      [7, 3, 0, -5].forEach((s, i) => v.tone({ t: 0.12 + i * 0.075, w: "p25", f: 880 * st(s) * p, a: 0.002, d: 0.09, v: 0.1, lp: 5000 }));
    },
  },
  rankUp: {
    vol: 0.96, gap: 0.2, max: 1, pri: 3, rev: 0.35,
    play(v, p) {
      // stamp "ka-CHUNK" + bright rising chord stab (pitch rises with the rank)
      v.noise({ a: 0.001, d: 0.06, v: 0.3, bp: 1800, q: 1.2 });
      boom(v, 0.03, 70, 0.3, 0.55);
      for (const s of [0, 4, 7, 12]) v.tone({ t: 0.04, w: "p25", f: E5 * st(s) * p, a: 0.002, d: 0.15, s: 0.45, len: 0.18, r: 0.25, v: 0.07, lp: 7000, vib: 20, vr: 7, vd: 0.08 });
      v.fm({ t: 0.06, f: E6 * 2 * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.6, v: 0.08 });
      sparkles(v, 0.1, 5, E6 * 2 * p, 6, 0.04, 0.05);
    },
  },
  waveIncoming: {
    vol: 1.49, gap: 1, max: 1, pri: 3, rev: 0.35,
    play(v, p) {
      // rumbling horn swell + drum roll
      for (const [f, det] of [[110, -10], [110, 10], [165, 0]] as const) {
        v.tone({ w: "sawtooth", f: f * p * 0.94, f2: f * p, gt: 0.6, det, a: 0.5, d: 0.3, s: 0.8, len: 0.75, r: 0.35, v: 0.08, lp: 400, lp2: 2200, lpt: 0.8 });
      }
      for (let i = 0; i < 12; i++) v.noise({ t: i * 0.06, a: 0.001, d: 0.07, v: 0.08 + i * 0.012, bp: 1900, q: 0.8 });
      boom(v, 0.75, 55, 0.6, 0.5);
      v.noise({ t: 0.75, a: 0.001, d: 0.8, v: 0.14, hp: 3500 });
    },
  },
  victory: {
    vol: 1.4, gap: 1, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      // "ta-da!": quick pickup triplet into a bright C major chord + cymbal + sparkles
      [G5, G5, G5].forEach((f, i) => v.tone({ t: i * 0.07, w: "p25", f: f * p, a: 0.002, d: 0.06, v: 0.12, lp: 7000 }));
      const t0 = 0.22;
      for (const s of [0, 4, 7, 12, 16]) v.tone({ t: t0, w: "sawtooth", f: C5 * st(s) * p, det: rand(-8, 8), a: 0.01, d: 0.3, s: 0.65, len: 0.7, r: 0.6, v: 0.05, lp: 2000, lp2: 5000, lpt: 0.1, vib: 14, vr: 5.5, vd: 0.25 });
      v.tone({ t: t0, w: "triangle", f: 130.8 * p, a: 0.004, d: 0.4, s: 0.5, len: 0.6, r: 0.5, v: 0.32 });
      boom(v, t0, 60, 0.5, 0.4);
      v.noise({ t: t0, a: 0.002, d: 1.5, v: 0.16, hp: 4000 });
      sparkles(v, t0 + 0.05, 12, C7 * p, 7, 0.05, 0.07);
    },
  },
  gameOver: {
    vol: 2.19, gap: 1, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      // soft falling "pyuu~" + low minor chord
      v.tone({ w: "p25", f: 988 * p, f2: 247 * p, gt: 0.7, a: 0.01, d: 0.8, s: 0, v: 0.12, lp: 4000, vib: 30, vr: 6, vd: 0.1 });
      for (const s of [0, 3, 7]) v.tone({ t: 0.55, w: "soft", f: 220 * st(s) * p, a: 0.05, d: 0.4, s: 0.6, len: 0.6, r: 0.8, v: 0.1, vib: 10, vr: 4.5 });
      v.tone({ t: 0.55, w: "sine", f: 110 * p, a: 0.01, d: 1.4, s: 0, v: 0.3 });
    },
  },
};
