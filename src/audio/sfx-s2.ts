/**
 * Season 2 SFX (docs/EXPANSION.md, docs/content/*): hub / meta progression, the
 * Merch Machine gacha, satire stingers, and the new weapons / heroes / stages.
 *
 * Same conventions as sfx.ts (see its header for the meta fields). Keys:
 *  - hub / meta / gacha sounds are in A major / F# minor (the hub theme is in A
 *    major, the gacha loop in F# minor), so they sit inside the menu music;
 *  - in-run weapon sounds are short and mostly unpitched (each stage theme has its
 *    own key);
 *  - stingers are written as little arrangements (brass stabs, timpani, choir).
 * Everything is original; the satire parodies tropes (the dramatic "dun dun dun",
 * the sad trombone, the freeze-frame riff), not specific works.
 */
import type { SfxId } from "./api";
import { boom, rand, shaped, sparkles, type SfxDef } from "./sfx-kit";
import { mtof as M, semis as st, type Voice } from "./synth";

// ------------------------------------------------------------------ little instruments

/** brassy saw pair with an opening filter "blat" */
function brass(v: Voice, t: number, f: number, len: number, vol: number, out?: AudioNode): void {
  for (const det of [-7, 7]) {
    v.tone({ t, w: "sawtooth", f, det, a: 0.018, d: 0.2, s: 0.75, len, r: 0.16, v: vol, lp: 900, lp2: 4200, lpt: 0.05, q: 1.2, vib: 12, vr: 5.5, vd: 0.18, out });
  }
}

/** choir "aah" (one formant voice) */
function aah(v: Voice, t: number, f: number, len: number, vol: number): void {
  v.formant({ t, f, w: "sawtooth", a: 0.15, d: 0.3, s: 0.9, len, r: 0.4, v: vol, q: 5, vib: 14, vr: 5, vc: [[0, 760, 1150], [1, 720, 1100]] });
}

/** e-piano tine */
function epiano(v: Voice, t: number, f: number, d: number, vol: number, pan = 0): void {
  v.fm({ t, f, ratio: 1, idx: 1.7, idx2: 0.2, it: 0.5, a: 0.003, d, s: 0, v: vol, pan });
  v.fm({ t, f, ratio: 7, idx: 0.5, idx2: 0.02, it: 0.1, a: 0.002, d: 0.15, s: 0, v: vol * 0.25 });
}

/** timpani hit */
function timp(v: Voice, t: number, f: number, vol: number): void {
  v.tone({ t, w: "sine", f: f * 1.04, f2: f, gt: 0.08, a: 0.002, d: 0.6, s: 0, v: vol });
  v.noise({ t, a: 0.002, d: 0.12, v: vol * 0.3, lp: 700, pink: true });
}

/** the narrator losing it: "AAAAAAAAAAA" (two slightly detuned formant voices on 'a') */
function scream(v: Voice, t: number, len: number, p: number): void {
  for (const det of [-0.12, 0.12]) {
    v.formant({
      t, f: 420 * p, w: "sawtooth", a: 0.04, d: 0.1, s: 0.9, len, r: 0.25, v: 0.1, q: 6, vib: 45, vr: 7.5,
      pc: [[0, -3 + det], [0.15, 1 + det], [0.6, 2.5 + det], [0.85, 4 + det], [1, det]],
      vc: [[0, 805, 1380], [0.3, 980, 1500], [1, 920, 1440]],
    });
  }
  v.noise({ t, a: 0.05, d: 0.2, s: 0.6, len, r: 0.2, v: 0.03, bp: 2500, q: 1.5 });
}

// ------------------------------------------------------------------ the library

export const S2_SFX = {
  // ================================================================ hub / meta progression
  hubOpen: {
    // "welcome home~": a soft whoosh and a rolled e-piano A add9, a bell on top
    vol: 1.03, gap: 0.3, max: 1, pri: 2, rev: 0.4,
    play(v, p) {
      v.noise({ a: 0.12, d: 0.18, v: 0.05, bp: 700, bp2: 3200, bpt: 0.25, q: 1 });
      [69, 73, 76, 83].forEach((m, i) => epiano(v, 0.04 + i * 0.035, M(m) * p, 0.9, 0.09, (i - 1.5) * 0.25));
      v.fm({ t: 0.2, f: M(88) * p, ratio: 3.5, idx: 1.1, idx2: 0.05, d: 0.9, v: 0.06 });
      v.tone({ t: 0.04, w: "sine", f: 110 * p, a: 0.004, d: 0.5, v: 0.2 });
    },
  },
  tabSwitch: {
    // a page "fwip" and a two-tone tick (higher and brighter than uiMove)
    vol: 0.8, gap: 0.04, max: 2, pri: 1, free: true,
    play(v, p) {
      v.noise({ a: 0.003, d: 0.05, v: 0.16, bp: 2200 * p, bp2: 6500 * p, bpt: 0.045, q: 1.6 });
      v.tone({ w: "triangle", f: M(85) * p, a: 0.001, d: 0.035, v: 0.16 });
      v.tone({ t: 0.028, w: "triangle", f: M(88) * p, a: 0.001, d: 0.05, v: 0.13 });
    },
  },
  nodeBuy: {
    // a Training Arc star locks in: click, thump, a climbing arp and a shimmering chord
    vol: 1.07, gap: 0.08, max: 2, pri: 2, rev: 0.35,
    play(v, p) {
      v.noise({ a: 0.0008, d: 0.012, v: 0.2, bp: 3200, q: 2.5 });
      v.tone({ w: "sine", f: 240, f2: 100, gt: 0.08, a: 0.001, d: 0.16, v: 0.3 });
      v.fm({ t: 0.015, f: M(93) * p, ratio: 3.5, idx: 1.4, idx2: 0.05, d: 0.5, v: 0.1 });
      [81, 85, 88, 93].forEach((m, i) => v.tone({ t: 0.03 + i * 0.04, w: "p25", f: M(m) * p, a: 0.002, d: 0.14, v: 0.1, lp: 7500, pan: (i - 1.5) * 0.2 }));
      for (const m of [81, 88, 97]) v.tone({ t: 0.2, w: "p25", f: M(m) * p, a: 0.004, d: 0.2, s: 0.5, len: 0.15, r: 0.3, v: 0.04, lp: 6500, vib: 15, vr: 6, vd: 0.1 });
      sparkles(v, 0.2, 6, M(93) * p, 7, 0.045, 0.05);
    },
  },
  nodeDeny: {
    // "bwomp-bwoomp": a deflating two-note buzzer with a sulky wobble (not enough coins)
    vol: 0.87, gap: 0.12, max: 1, pri: 2,
    play(v, p) {
      v.tone({ w: "square", f: 330 * p, f2: 311 * p, gt: 0.1, a: 0.002, d: 0.06, s: 0.6, len: 0.08, r: 0.04, v: 0.12, lp: 1300 });
      v.tone({ t: 0.13, w: "square", f: 262 * p, f2: 220 * p, gt: 0.22, a: 0.002, d: 0.06, s: 0.7, len: 0.16, r: 0.08, v: 0.12, lp: 1100, vib: 45, vr: 10, vd: 0.03 });
      v.tone({ w: "sine", f: 110, a: 0.002, d: 0.12, v: 0.18 });
      v.tone({ t: 0.13, w: "sine", f: 98, a: 0.002, d: 0.2, v: 0.18 });
    },
  },
  talentUp: {
    // "plink-SHING": FM pluck, a pulse fifth and a little power chord (pitch rises with the rank)
    vol: 1.61, gap: 0.08, max: 2, pri: 2, rev: 0.35,
    play(v, p) {
      v.fm({ f: M(81) * p, ratio: 2, idx: 1.6, idx2: 0.1, d: 0.35, v: 0.12 });
      v.tone({ t: 0.05, w: "p25", f: M(88) * p, a: 0.002, d: 0.22, v: 0.1, lp: 7000 });
      for (const m of [57, 64, 69]) v.tone({ t: 0.05, w: "sawtooth", f: M(m) * p, a: 0.004, d: 0.3, s: 0, v: 0.045, lp: 4200, lp2: 1200, lpt: 0.25 });
      v.noise({ a: 0.001, d: 0.06, v: 0.06, hp: 7000 });
      sparkles(v, 0.08, 4, M(93) * p, 6, 0.04, 0.05);
    },
  },
  heroLevelUp: {
    // "ta-ta-TAAA!": a brass pickup into a held A major chord, rising arp, sparkles
    vol: 1.16, gap: 0.4, max: 1, pri: 3, rev: 0.45,
    play(v, p) {
      [73, 76].forEach((m, i) => brass(v, i * 0.1, M(m) * p, 0.07, 0.07));
      const t0 = 0.2;
      for (const m of [69, 73, 76, 81]) brass(v, t0, M(m) * p, 0.6, 0.05);
      v.tone({ t: t0, w: "sawtooth", f: M(45) * p, a: 0.01, d: 0.4, s: 0.6, len: 0.5, r: 0.3, v: 0.07, lp: 900 });
      boom(v, t0, 55, 0.6, 0.45);
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => v.tone({ t: t0 + 0.05 + i * 0.04, w: "p12", f: M(81) * st(s) * p, a: 0.002, d: 0.12, v: 0.06, lp: 9000, pan: (i / 6 - 0.5) * 0.6 }));
      sparkles(v, t0 + 0.3, 10, M(93) * p, 7, 0.05, 0.06);
      v.noise({ t: t0, a: 0.002, d: 1.2, v: 0.12, hp: 4500 });
    },
  },
  masteryUp: {
    // weapon mastery rank: a blade "shing", a two-note rank call and a stamp
    vol: 1.06, gap: 0.3, max: 1, pri: 3, rev: 0.4,
    play(v, p) {
      v.noise({ a: 0.08, d: 0.05, v: 0.12, bp: 1500, bp2: 7000, bpt: 0.1, q: 1.5 });
      for (const [f, d, g] of [[2650, 0.8, 0.05], [3970, 0.6, 0.035], [1770, 0.7, 0.03]] as const) {
        v.fm({ t: 0.08, f: f * p, ratio: 1.41, idx: 1.5, idx2: 0.1, it: 0.3, a: 0.001, d, v: g, vib: 8, vr: 9 });
      }
      v.tone({ t: 0.1, w: "p25", f: M(88) * p, a: 0.002, d: 0.1, v: 0.1, lp: 7000 });
      v.tone({ t: 0.18, w: "p25", f: M(93) * p, a: 0.002, d: 0.15, s: 0.5, len: 0.2, r: 0.3, v: 0.1, lp: 7000, vib: 20, vr: 7, vd: 0.08 });
      boom(v, 0.08, 70, 0.3, 0.4);
      sparkles(v, 0.2, 6, M(93) * p, 7, 0.04, 0.05);
    },
  },
  unlockFanfare: {
    // "NEW WEAPON UNLOCKED!": snare roll, "da-da DAAA", cymbal, climbing bells
    vol: 1.07, gap: 1, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      for (let i = 0; i < 14; i++) v.noise({ t: i * 0.032, a: 0.001, d: 0.05, v: 0.05 + i * 0.012, bp: 2300, q: 0.8 });
      brass(v, 0.46, M(71) * p, 0.08, 0.075);
      brass(v, 0.58, M(73) * p, 0.08, 0.075);
      const t0 = 0.7;
      for (const m of [57, 64, 69, 73, 76, 81]) brass(v, t0, M(m) * p, 0.85, 0.042);
      v.tone({ t: t0, w: "triangle", f: M(45) * p, a: 0.004, d: 0.5, s: 0.5, len: 0.7, r: 0.5, v: 0.3 });
      boom(v, t0, 50, 0.9, 0.6);
      v.noise({ t: t0, a: 0.002, d: 1.6, v: 0.16, hp: 4000 });
      [76, 81, 85, 88, 93].forEach((m, i) => v.fm({ t: t0 + 0.1 + i * 0.09, f: M(m) * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.6, v: 0.07, pan: Math.sin(i * 1.3) * 0.5 }));
      sparkles(v, t0 + 0.4, 12, M(93) * p, 7, 0.05, 0.06);
    },
  },
  achievement: {
    // "Plot Point get!": a paper stamp, a two-chime "ding-DING" and a little glitter
    vol: 1.27, gap: 0.4, max: 1, pri: 2, rev: 0.4,
    play(v, p) {
      v.noise({ a: 0.001, d: 0.04, v: 0.16, bp: 1600, q: 1 });
      v.tone({ w: "sine", f: 180, f2: 90, gt: 0.06, a: 0.001, d: 0.12, v: 0.25 });
      v.fm({ t: 0.02, f: M(88) * p, ratio: 3.5, idx: 1.4, idx2: 0.05, d: 0.5, v: 0.11, pan: -0.2 });
      v.fm({ t: 0.14, f: M(93) * p, ratio: 3.5, idx: 1.4, idx2: 0.05, d: 0.8, v: 0.12, pan: 0.2 });
      v.tone({ t: 0.02, w: "p25", f: M(88) * p, a: 0.002, d: 0.1, v: 0.08, lp: 7000 });
      v.tone({ t: 0.14, w: "p25", f: M(93) * p, a: 0.002, d: 0.25, v: 0.08, lp: 7000 });
      [97, 100, 105].forEach((m, i) => v.tone({ t: 0.3 + i * 0.04, w: "p12", f: M(m) * p, a: 0.001, d: 0.08, v: 0.035, lp: 9000 }));
    },
  },
  payoutTick: {
    // one line of the payout ticking up (the UI raises the pitch line by line)
    vol: 1.45, gap: 0.03, max: 3, pri: 1, free: true,
    play(v, p) {
      v.tone({ w: "square", f: 1568 * p, a: 0.001, d: 0.03, v: 0.09, lp: 6000 });
      v.tone({ t: 0.012, w: "triangle", f: 3136 * p, a: 0.001, d: 0.04, v: 0.06 });
      v.noise({ a: 0.0008, d: 0.008, v: 0.05, hp: 6000 });
    },
  },
  payoutTotal: {
    // cash register: lever "ka-", drawer CHUNK, bell CHING!, coins pouring in
    vol: 1.33, gap: 0.5, max: 1, pri: 3, rev: 0.4,
    play(v, p) {
      v.noise({ a: 0.001, d: 0.025, v: 0.25, bp: 2600, q: 2 });
      v.noise({ t: 0.06, a: 0.001, d: 0.07, v: 0.3, bp: 900, q: 1 });
      v.tone({ t: 0.06, w: "sine", f: 160, f2: 80, gt: 0.06, a: 0.001, d: 0.14, v: 0.35 });
      v.fm({ t: 0.08, f: 2637 * p, ratio: 1.41, idx: 1.3, idx2: 0.1, it: 0.4, a: 0.001, d: 1.0, v: 0.08 });
      v.fm({ t: 0.08, f: 3951 * p, ratio: 1.41, idx: 1, idx2: 0.05, a: 0.001, d: 0.7, v: 0.05 });
      v.tone({ t: 0.08, w: "sine", f: 2637 * p, a: 0.001, d: 0.9, v: 0.05, trem: 0.6, tr: 18 });
      for (let i = 0; i < 9; i++) {
        const f = rand(1900, 2700) * p;
        const t = 0.18 + i * rand(0.035, 0.06);
        v.tone({ t, w: "p25", f, a: 0.001, d: 0.06, v: 0.06, lp: 8000, pan: rand(-0.5, 0.5) });
        v.tone({ t: t + 0.03, w: "p25", f: f * st(5), a: 0.001, d: 0.1, v: 0.05, lp: 8000 });
      }
      sparkles(v, 0.3, 6, M(93) * p, 7, 0.04, 0.06);
    },
  },
  currencyGain: {
    // ♦ gems / Copium in: a crystal sweep up the A major pentatonic
    vol: 1.95, gap: 0.12, max: 2, pri: 2, rev: 0.35,
    play(v, p) {
      [76, 78, 81, 83, 85, 88].forEach((m, i) => v.fm({ t: i * 0.028, f: M(m) * p, ratio: 3.5, idx: 1.1, idx2: 0.04, d: 0.3, v: 0.06 - i * 0.004, pan: (i / 5 - 0.5) * 0.7 }));
      v.tone({ w: "sine", f: M(88) * p, f2: M(100) * p, gt: 0.16, a: 0.003, d: 0.2, v: 0.05 });
      v.noise({ a: 0.08, d: 0.25, v: 0.05, hp: 8000 });
    },
  },
  equip: {
    // "clack-shing": a latch snapping shut and a short sparkle fifth
    vol: 1.57, gap: 0.08, max: 2, pri: 2, rev: 0.25,
    play(v, p) {
      v.noise({ a: 0.0008, d: 0.015, v: 0.3, bp: 2000, q: 3 });
      v.tone({ w: "square", f: 900, f2: 600, gt: 0.02, a: 0.0008, d: 0.03, v: 0.08, lp: 4000 });
      v.fm({ t: 0.02, f: 2650 * p, ratio: 1.41, idx: 1.2, idx2: 0.05, d: 0.35, v: 0.05 });
      v.tone({ t: 0.03, w: "p25", f: M(81) * p, a: 0.002, d: 0.18, v: 0.08, lp: 7000 });
      v.tone({ t: 0.03, w: "p25", f: M(88) * p, a: 0.002, d: 0.18, v: 0.06, lp: 7000 });
    },
  },

  // ================================================================ the Merch Machine (gacha)
  gachaCharge: {
    // summoning: noise riser, sub swell, a tritone saw swell and an accelerating F# minor arp
    vol: 0.99, gap: 0.5, max: 1, pri: 3, rev: 0.4,
    play(v, p) {
      v.noise({ a: 1.05, d: 0.08, v: 0.2, bp: 300, bp2: 6500, bpt: 1.1, q: 1.4 });
      v.tone({ w: "sine", f: 46, f2: 98, gt: 1.1, a: 0.9, d: 0.2, v: 0.35 });
      for (const [m, det] of [[54, -8], [54, 8], [60, 0]] as const) {
        v.tone({ w: "sawtooth", f: M(m) * p, f2: M(m + 12) * p, gt: 1.15, det, a: 1.0, d: 0.1, v: 0.05, lp: 400, lp2: 4000, lpt: 1.1, q: 2 });
      }
      const arp = [66, 69, 73, 78, 81, 85, 90, 93, 97, 102];
      let t = 0;
      for (let i = 0; i < 18; i++) {
        const m = arp[i < arp.length ? i : arp.length - 4 + (i % 4)];
        v.tone({ t, w: "p25", f: M(m) * p, a: 0.002, d: 0.06, v: 0.05 + i * 0.003, lp: 7000, pan: i % 2 ? 0.3 : -0.3 });
        t += 0.11 * Math.pow(0.88, i) + 0.018;
      }
      v.noise({ t: 0.85, a: 0.32, d: 0.03, v: 0.1, hp: 5000 });
    },
  },
  gachaMeteor: {
    // a meteor falls (descending whoosh + doppler whistle + rumble) and lands
    vol: 0.93, gap: 0.3, max: 2, pri: 3, rev: 0.35,
    play(v, p) {
      v.noise({ a: 0.06, d: 0.45, v: 0.32, bp: 7000, bp2: 500, bpt: 0.48, q: 1.2 });
      v.tone({ w: "sine", f: 2600 * p, f2: 260 * p, gt: 0.5, a: 0.03, d: 0.48, v: 0.06 });
      v.tone({ w: "sawtooth", f: 900 * p, f2: 90 * p, gt: 0.5, a: 0.05, d: 0.45, v: 0.035, lp: 2500 });
      v.noise({ a: 0.3, d: 0.2, v: 0.15, lp: 700, pink: true, crackle: 29 });
      const t0 = 0.5;
      boom(v, t0, 52, 0.45, 0.6);
      v.noise({ t: t0, a: 0.001, d: 0.3, v: 0.25, lp: 3500, lp2: 300, lpt: 0.3 });
      sparkles(v, t0 + 0.03, 4, M(90) * p, 6, 0.04, 0.05);
    },
  },
  gachaReveal: {
    // N / R ("Normie"): a capsule "pomf" and a polite little "ding". That's it. That's the reveal.
    vol: 1.06, gap: 0.2, max: 1, pri: 2, rev: 0.3,
    play(v, p) {
      v.tone({ w: "sine", f: 280 * p, f2: 900 * p, gt: 0.05, a: 0.001, d: 0.09, v: 0.3 });
      v.noise({ a: 0.001, d: 0.04, v: 0.12, bp: 1500, q: 1 });
      v.tone({ t: 0.07, w: "triangle", f: M(81) * p, a: 0.002, d: 0.25, v: 0.16 });
      v.tone({ t: 0.15, w: "triangle", f: M(88) * p, a: 0.002, d: 0.35, v: 0.12 });
    },
  },
  gachaRevealSR: {
    // SR (purple): pop, a climbing arp and a warm e-piano chord
    vol: 1.23, gap: 0.3, max: 1, pri: 2, rev: 0.4,
    play(v, p) {
      v.tone({ w: "sine", f: 280 * p, f2: 1000 * p, gt: 0.05, a: 0.001, d: 0.1, v: 0.3 });
      v.noise({ a: 0.001, d: 0.12, v: 0.14, lp: 4000, lp2: 600, lpt: 0.1 });
      [81, 85, 88, 93, 97].forEach((m, i) => v.tone({ t: 0.06 + i * 0.05, w: "p25", f: M(m) * p, a: 0.002, d: 0.2, v: 0.08, lp: 7500, pan: (i - 2) * 0.15 }));
      for (const m of [69, 73, 76]) v.fm({ t: 0.3, f: M(m) * p, ratio: 1, idx: 1.5, idx2: 0.2, it: 0.4, a: 0.004, d: 0.6, v: 0.06 });
      v.fm({ t: 0.32, f: M(93) * p, ratio: 3.5, idx: 1.2, idx2: 0.05, d: 0.6, v: 0.07 });
      sparkles(v, 0.3, 5, M(93) * p, 7, 0.04, 0.05);
    },
  },
  gachaRevealSSR: {
    // SSR (gold): crack, whoosh, BOOM, brass + choir A major, a bell cascade
    vol: 1.01, gap: 0.5, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      v.noise({ a: 0.001, d: 0.06, v: 0.25, bp: 2500, q: 1.2 });
      v.noise({ a: 0.18, d: 0.08, v: 0.18, bp: 500, bp2: 7000, bpt: 0.22, q: 1.4 });
      const t0 = 0.22;
      boom(v, t0, 55, 0.8, 0.6);
      for (const m of [57, 64, 69, 73, 76]) brass(v, t0, M(m) * p, 0.7, 0.045);
      for (const m of [69, 73, 76]) aah(v, t0 + 0.05, M(m) * p, 0.8, 0.05);
      [93, 88, 85, 81, 76, 81, 85, 88, 93, 97].forEach((m, i) => v.fm({ t: t0 + 0.05 + i * 0.065, f: M(m) * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.5, v: 0.06, pan: Math.sin(i * 1.1) * 0.6 }));
      v.noise({ t: t0, a: 0.002, d: 1.4, v: 0.14, hp: 4000 });
      sparkles(v, t0 + 0.5, 10, M(93) * p, 7, 0.05, 0.06);
    },
  },
  gachaRevealUR: {
    // UR / LR (rainbow): angelic swell, then the epic bVI - bVII - I (F - G - A!!) and a rainbow of bells
    vol: 1.06, gap: 0.8, max: 1, pri: 3, rev: 0.55,
    play(v, p) {
      v.noise({ a: 0.35, d: 0.1, v: 0.14, bp: 800, bp2: 8000, bpt: 0.4, q: 1.2 });
      for (const m of [69, 76, 81]) aah(v, 0, M(m) * p, 1.6, 0.045);
      const chord = (t: number, root: number, len: number, g: number) => {
        for (const s of [0, 7, 12, 16, 19]) brass(v, t, M(root + s) * p, len, g);
        v.tone({ t, w: "triangle", f: M(root - 12) * p, a: 0.004, d: 0.3, s: 0.5, len, r: 0.3, v: 0.28 });
      };
      chord(0.36, 53, 0.12, 0.04);
      chord(0.54, 55, 0.12, 0.04);
      const t0 = 0.72;
      chord(t0, 57, 1.0, 0.05);
      boom(v, t0, 48, 1.0, 0.65);
      v.noise({ t: t0, a: 0.002, d: 1.7, v: 0.16, hp: 3800 });
      [81, 83, 85, 86, 88, 90, 92, 93, 95, 97, 98, 100].forEach((m, i) =>
        v.fm({ t: t0 + 0.04 + i * 0.05, f: M(m) * p, ratio: 3.5, idx: 1.2, idx2: 0.05, d: 0.55, v: 0.055, pan: Math.sin(i * 0.9) * 0.7 }),
      );
      sparkles(v, t0 + 0.6, 14, M(93) * p, 7, 0.05, 0.06);
    },
  },
  gachaMythicGlitch: {
    // MYTHIC, part 1: it starts like the pull of your life... then the audio driver chokes:
    // stuttering bitcrushed slices, a tape-stop dive into the floor, an error "bonk-bonk", dead air.
    vol: 1.14, gap: 1, max: 1, pri: 3, rev: 0.15,
    play(v, p) {
      for (const m of [69, 73, 76, 81]) aah(v, 0, M(m) * p, 0.1, 0.035);
      for (const m of [57, 64, 69, 73]) v.tone({ w: "sawtooth", f: M(m) * p, a: 0.04, d: 0.05, s: 0.9, len: 0.09, r: 0.006, v: 0.03, lp: 3000 });
      v.noise({ a: 0.08, d: 0.02, v: 0.08, bp: 1000, bp2: 6000, bpt: 0.1, q: 1.2 });
      const cb = shaped(v, "crush", 0.9);
      let t = 0.1;
      for (let i = 0; i < 9; i++) {
        const len = i < 5 ? 0.03 : 0.02;
        const jump = [0, 12, 0, -12, 7, 19, -5, 0, 24][i];
        for (const m of [57, 64, 69]) v.tone({ t, w: "sawtooth", f: M(m + jump) * p, a: 0.001, h: len - 0.004, d: 0.004, v: 0.035, out: cb });
        if (i % 3 === 2) v.noise({ t, a: 0.001, h: 0.012, d: 0.004, v: 0.08, hp: 2000, out: cb });
        t += len + (i === 4 ? 0.025 : 0.004);
      }
      const t1 = t + 0.01;
      for (const m of [57, 64, 69]) v.tone({ t: t1, w: "sawtooth", f: M(m) * p, f2: M(m - 36) * p, gt: 0.2, a: 0.002, d: 0.06, s: 0.9, len: 0.19, r: 0.006, v: 0.04, lp: 3500, lp2: 300, lpt: 0.2, out: cb });
      v.noise({ t: t1, a: 0.002, d: 0.06, s: 0.8, len: 0.19, r: 0.006, v: 0.06, lp: 5000, lp2: 200, lpt: 0.2, crackle: 47, out: cb });
      const t2 = t1 + 0.26;
      v.tone({ t: t2, w: "square", f: 330, a: 0.001, h: 0.08, d: 0.006, v: 0.06, lp: 2200 });
      v.tone({ t: t2 + 0.1, w: "square", f: 220, a: 0.001, h: 0.15, d: 0.006, v: 0.06, lp: 2200 });
    },
  },
  gachaMythicBoom: {
    // MYTHIC, part 2: everything explodes into a rainbow. One brass stab per rarity
    // (N R SR SSR UR LR MYTHIC) up the scale, the MYTHIC chord held, and the narrator screaming.
    vol: 1.0, gap: 1, max: 1, pri: 3, rev: 0.55,
    play(v, p) {
      boom(v, 0, 40, 1.6, 0.85);
      v.tone({ w: "sine", f: 80, f2: 30, gt: 1, a: 0.002, d: 1.6, v: 0.45 });
      v.noise({ a: 0.001, d: 1.4, v: 0.4, lp: 8000, lp2: 250, lpt: 1.2, crackle: 23 });
      v.noise({ a: 0.001, d: 2.4, v: 0.16, hp: 3800 });
      [57, 59, 61, 62, 64, 66, 68].forEach((r, i) => {
        for (const s of [0, 4, 7, 12]) brass(v, 0.05 + i * 0.075, M(r + s) * p, 0.06, 0.03);
      });
      const t0 = 0.6;
      for (const m of [57, 64, 69, 73, 76, 81, 85]) brass(v, t0, M(m) * p, 1.3, 0.04);
      for (const m of [69, 73, 76, 81]) aah(v, t0, M(m) * p, 1.4, 0.04);
      v.tone({ t: t0, w: "triangle", f: M(33) * p, a: 0.004, d: 0.6, s: 0.6, len: 1.2, r: 0.5, v: 0.3 });
      boom(v, t0, 45, 1.2, 0.6);
      scream(v, t0 + 0.1, 1.5, p);
      [81, 85, 88, 93, 97, 100, 93, 97, 100, 100].forEach((m, i) =>
        v.fm({ t: t0 + 0.05 + i * 0.06, f: M(m) * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.6, v: 0.05, pan: Math.sin(i * 1.7) * 0.7 }),
      );
      sparkles(v, t0 + 0.6, 16, M(93) * p, 7, 0.05, 0.06);
    },
  },
  gachaDupe: {
    // a dupe: "pffeww" (deflating)... "ding!" (consolation)
    vol: 1.68, gap: 0.15, max: 2, pri: 2, rev: 0.3,
    play(v, p) {
      v.tone({ w: "sine", f: 700 * p, f2: 300 * p, gt: 0.22, a: 0.01, d: 0.25, v: 0.16, vib: 60, vr: 18, vd: 0 });
      v.noise({ a: 0.02, d: 0.22, v: 0.08, bp: 1600, bp2: 500, bpt: 0.22, q: 2 });
      v.tone({ t: 0.26, w: "p25", f: M(88) * p, a: 0.002, d: 0.08, v: 0.1, lp: 7000 });
      v.tone({ t: 0.32, w: "p25", f: M(93) * p, a: 0.002, d: 0.2, v: 0.1, lp: 7000 });
      v.fm({ t: 0.32, f: M(93) * p, ratio: 3.5, idx: 1, idx2: 0.05, d: 0.3, v: 0.04 });
    },
  },
  gachaLost5050: {
    // LOST THE 50/50: the sad trombone. "wah... wah... wah... waaaaaaah" (muted, droopy, wobbling)
    vol: 1.6, gap: 1, max: 1, pri: 3, rev: 0.35,
    play(v, p) {
      const notes: [number, number, number][] = [[0, 62, 0.3], [0.36, 61, 0.3], [0.72, 60, 0.3], [1.08, 59, 1.0]];
      for (const [t, m, len] of notes) {
        const last = len > 0.5;
        const f = M(m) * p;
        v.formant({
          t, f, w: "sawtooth", a: 0.03, d: 0.1, s: 0.9, len, r: 0.12, v: 0.2, q: 4, vib: last ? 70 : 0, vr: last ? 4.5 : 6,
          pc: last ? [[0, -0.4], [0.1, 0], [0.8, -0.3], [1, -1.5]] : [[0, -0.5], [0.12, 0], [1, -0.15]],
          vc: [[0, 350, 800], [0.35, 650, 1100], [0.8, 600, 1000], [1, 380, 850]],
        });
        v.tone({ t, w: "sawtooth", f, a: 0.03, d: 0.1, s: 0.8, len, r: 0.12, v: 0.05, lp: 900, vib: last ? 70 : 0, vr: 4.5, vd: 0.12 });
      }
    },
  },
  starUp: {
    // "★ UP!": a quick twinkle (the UI raises the pitch card by card)
    vol: 1.64, gap: 0.06, max: 3, pri: 2, rev: 0.35,
    play(v, p) {
      v.tone({ w: "p12", f: M(88) * p, f2: M(95) * p, gt: 0.06, a: 0.002, d: 0.1, v: 0.08, lp: 9000 });
      v.fm({ t: 0.05, f: M(83) * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.4, v: 0.08 });
      v.tone({ t: 0.05, w: "p25", f: M(95) * p, a: 0.002, d: 0.15, v: 0.06, lp: 8000 });
      sparkles(v, 0.08, 3, M(83) * p, 5, 0.035, 0.04);
    },
  },

  // ================================================================ satire stingers
  narratorSting: {
    // "DUN... DUN... DUNNNN!": two orchestral D minor stabs, then a half step UP, held,
    // with tremolo strings, a timpani roll and a cymbal swell
    vol: 0.98, gap: 0.8, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      const stab = (t: number, root: number, len: number, g: number) => {
        for (const s of [0, 7, 12, 15]) brass(v, t, M(root + s) * p, len, g);
        for (const s of [-12, 0]) v.tone({ t, w: "sawtooth", f: M(root + s) * p, a: 0.01, d: 0.2, s: 0.6, len, r: 0.2, v: 0.06, lp: 1200 });
        timp(v, t, M(root - 12) * p, 0.5);
      };
      stab(0, 50, 0.14, 0.05);
      stab(0.3, 50, 0.14, 0.05);
      const t0 = 0.62;
      stab(t0, 51, 0.9, 0.055);
      for (const s of [12, 15, 19, 24]) v.tone({ t: t0, w: "sawtooth", f: M(51 + s) * p, det: rand(-8, 8), a: 0.03, d: 0.3, s: 0.8, len: 0.9, r: 0.4, v: 0.03, lp: 3500, trem: 0.8, tr: 14 });
      for (let i = 0; i < 16; i++) timp(v, t0 + 0.05 + i * 0.055, M(39) * p, 0.1 + i * 0.012);
      v.noise({ t: t0, a: 0.8, d: 0.4, v: 0.12, hp: 4000 });
      boom(v, t0, 42, 1.0, 0.45);
    },
  },
  nani: {
    // "NANI?!": a zoom-in whoosh, DUN!, a shocked tritone stab and a string screech
    vol: 0.95, gap: 0.5, max: 1, pri: 2, rev: 0.3,
    play(v, p) {
      v.noise({ a: 0.16, d: 0.03, v: 0.3, bp: 300, bp2: 6000, bpt: 0.18, q: 1.5 });
      v.tone({ w: "sine", f: 250 * p, f2: 2000 * p, gt: 0.18, a: 0.12, d: 0.06, v: 0.08 });
      const t0 = 0.18;
      boom(v, t0, 60, 0.45, 0.6);
      v.noise({ t: t0, a: 0.001, d: 0.2, v: 0.25, lp: 4000, lp2: 400, lpt: 0.2 });
      for (const m of [48, 54, 60, 66]) v.tone({ t: t0, w: "sawtooth", f: M(m) * p, det: rand(-10, 10), a: 0.002, d: 0.3, s: 0, v: 0.05, lp: 5000, lp2: 1200, lpt: 0.25 });
      v.tone({ t: t0 + 0.02, w: "sawtooth", f: M(90) * p, f2: M(91) * p, gt: 0.4, a: 0.01, d: 0.4, s: 0, v: 0.04, bp: 3000, q: 2, vib: 50, vr: 13, vd: 0 });
    },
  },
  baka: {
    // "BAKA!": a paper fan SMACK and a cartoon spring BOING
    vol: 0.94, gap: 0.12, max: 2, pri: 2,
    play(v, p) {
      v.noise({ a: 0.0005, d: 0.07, v: 0.5, bp: 1900, q: 0.7 });
      v.noise({ a: 0.0005, d: 0.03, v: 0.18, hp: 5500 });
      v.tone({ w: "square", f: 520, f2: 220, gt: 0.03, a: 0.0008, d: 0.035, v: 0.07, lp: 3000 });
      const t0 = 0.04;
      v.tone({ t: t0, w: "triangle", f: 200 * p, f2: 330 * p, gt: 0.35, a: 0.003, d: 0.5, s: 0, v: 0.3, vib: 160, vr: 15, vd: 0 });
      v.tone({ t: t0, w: "square", f: 200 * p, f2: 330 * p, gt: 0.35, a: 0.003, d: 0.35, s: 0, v: 0.04, lp: 1500, vib: 160, vr: 15, vd: 0 });
    },
  },
  recordScratch: {
    // vinyl scratch: forward fast, back slower ("wikka-wuuh"), needle bump, dust
    vol: 1.84, gap: 0.3, max: 1, pri: 2,
    play(v, p) {
      const strokes: [number, number, number, number][] = [[0, 0.1, 260, 1100], [0.11, 0.2, 1100, 160]];
      for (const [t, d, f1, f2] of strokes) {
        v.tone({ t, w: "sawtooth", f: f1 * p, f2: f2 * p, gt: d, a: 0.008, h: d * 0.6, d: d * 0.4, v: 0.12, bp: f1 * 2, bp2: f2 * 2, bpt: d, q: 1.3 });
        v.noise({ t, a: 0.008, h: d * 0.6, d: d * 0.4, v: 0.25, bp: f1 * 3, bp2: f2 * 3, bpt: d, q: 1.8 });
      }
      v.noise({ a: 0.001, d: 0.02, v: 0.2, lp: 2000 });
      v.noise({ t: 0.3, a: 0.002, d: 0.12, v: 0.03, hp: 3000, crackle: 41 });
    },
  },
  toBeContinued: {
    // TO BE CONTINUED ->: an original funky walking-bass riff in E dorian, Em9 comping,
    // a freeze-frame E7#9 with an organ shake, the arrow "zip", and sepia vinyl crackle
    vol: 0.98, gap: 2, max: 1, pri: 3, rev: 0.3,
    play(v, p) {
      const e = 0.2;
      const bass: [number, number, number][] = [[0, 40, 1], [1, 43, 1], [2, 45, 1], [3, 46, 1], [4, 47, 1], [5, 50, 1], [6, 52, 3]];
      for (const [k, m, n] of bass) {
        const len = n * e - 0.03;
        v.tone({ t: k * e, w: "sawtooth", f: M(m) * p, a: 0.003, d: 0.12, s: 0.6, len, r: 0.05, v: 0.11, lp: 1300, lp2: 500, lpt: 0.15, q: 2 });
        v.tone({ t: k * e, w: "sine", f: M(m) * p, a: 0.003, d: 0.2, s: 0.8, len, r: 0.05, v: 0.2 });
      }
      const ep = (t: number, ms: number[], len: number, g: number) =>
        ms.forEach((m) => v.fm({ t, f: M(m) * p, ratio: 1, idx: 1.8, idx2: 0.25, it: 0.4, a: 0.003, d: 0.3, s: 0.5, len, r: 0.2, v: g }));
      ep(0, [55, 59, 62, 66], 0.12, 0.05);
      ep(2.5 * e, [55, 59, 62, 66], 0.1, 0.05);
      const t0 = 6 * e;
      ep(t0, [52, 56, 62, 67], 1.1, 0.06);
      v.tone({ t: t0, w: "organ", f: M(76) * p, f2: M(79) * p, gt: 0.12, a: 0.02, d: 0.2, s: 0.8, len: 1.0, r: 0.25, v: 0.07, trem: 0.25, tr: 6, vib: 12, vr: 6, vd: 0.2 });
      for (let k = 0; k < 7; k++) v.noise({ t: k * e, a: 0.001, d: k % 2 ? 0.03 : 0.05, v: k % 2 ? 0.04 : 0.07, hp: 7000 });
      v.noise({ t: 2 * e, a: 0.001, d: 0.12, v: 0.16, bp: 2200, q: 0.8 });
      v.noise({ t: 5 * e, a: 0.001, d: 0.12, v: 0.16, bp: 2200, q: 0.8 });
      v.noise({ t: t0, a: 0.001, d: 1.1, v: 0.08, hp: 5000 });
      v.tone({ t: t0 + 0.05, w: "sawtooth", f: 300, f2: 1500, gt: 0.15, a: 0.01, d: 0.18, v: 0.04, lp: 3000 });
      v.noise({ t: t0 + 0.05, a: 0.05, d: 0.15, v: 0.1, bp: 800, bp2: 5000, bpt: 0.15, q: 1.5 });
      v.noise({ a: 0.05, d: 0.3, s: 0.9, len: 2.2, r: 0.4, v: 0.03, hp: 3000, crackle: 37 });
    },
  },
  cassetteEject: {
    // DROPPED AFTER EPISODE n: eject button "chk", door clunk + spring, plastic rattle, a tape winding down
    vol: 1.16, gap: 1, max: 1, pri: 2, rev: 0.15,
    play(v, p) {
      v.noise({ a: 0.0008, d: 0.012, v: 0.3, bp: 2600, q: 4 });
      v.tone({ w: "square", f: 1700, a: 0.0008, d: 0.008, v: 0.05, lp: 4000 });
      const t0 = 0.09;
      v.tone({ t: t0, w: "sine", f: 210, f2: 110, gt: 0.06, a: 0.001, d: 0.12, v: 0.3 });
      v.noise({ t: t0, a: 0.001, d: 0.05, v: 0.22, lp: 1500 });
      v.tone({ t: t0 + 0.02, w: "triangle", f: 620, a: 0.002, d: 0.2, v: 0.05, vib: 200, vr: 26, vd: 0 });
      for (let i = 0; i < 3; i++) v.noise({ t: t0 + 0.12 + i * 0.045, a: 0.0008, d: 0.015, v: 0.1, bp: 3400, q: 3 });
      v.tone({ t: 0.05, w: "triangle", f: 440 * p, f2: 110 * p, gt: 0.55, a: 0.01, d: 0.55, v: 0.06, lp: 2000, vib: 25, vr: 3 });
    },
  },

  // ================================================================ new weapons / heroes / stages
  honk: {
    // Truck-kun: a dissonant air-horn chord through a nasal band-pass. HONK. (gap allows "HONK-HONK")
    vol: 1.1, gap: 0.2, max: 2, pri: 2, budget: true, rev: 0.15, rnd: 0.3,
    play(v, p) {
      const g = v.filter("bandpass", 950, undefined, 0.2, 0.9);
      for (const [f, det] of [[196, -6], [247, 5], [294, 0], [311, 8]] as const) {
        v.tone({ w: "sawtooth", f: f * 0.96 * p, f2: f * p, gt: 0.05, det, a: 0.012, d: 0.06, s: 0.85, len: 0.36, r: 0.07, v: 0.09, drive: "soft", out: g });
      }
      v.tone({ w: "square", f: 98 * p, a: 0.01, d: 0.1, s: 0.8, len: 0.34, r: 0.06, v: 0.06, lp: 600 });
      v.noise({ a: 0.01, d: 0.1, s: 0.5, len: 0.34, r: 0.06, v: 0.05, bp: 1800, q: 1 });
    },
  },
  missile: {
    // a micro-missile salvo: little launches tumbling out, each with its own whistle
    vol: 0.76, gap: 0.08, max: 2, pri: 0, rnd: 1,
    play(v, p) {
      for (let i = 0; i < 5; i++) {
        const t = i * rand(0.022, 0.04);
        const pan = rand(-0.5, 0.5);
        v.noise({ t, a: 0.002, d: 0.07, v: 0.12, bp: rand(1800, 3200), q: 1.3, pan });
        v.tone({ t, w: "sine", f: rand(900, 1300) * p, f2: rand(2200, 3200) * p, gt: 0.12, a: 0.004, d: 0.12, v: 0.035, pan });
      }
      v.tone({ w: "sine", f: 150, f2: 80, gt: 0.05, a: 0.001, d: 0.07, v: 0.15 });
    },
  },
  fanSmack: {
    // Baka Harisen: a papery "PAH!" with a thud
    vol: 0.54, gap: 0.06, max: 3, pri: 1, rnd: 1,
    play(v, p) {
      v.noise({ a: 0.0004, d: 0.05, v: 0.45, bp: 2200 * p, q: 0.6 });
      v.noise({ t: 0.004, a: 0.002, d: 0.12, v: 0.1, bp: 5000, bp2: 1500, bpt: 0.1, q: 1.2 });
      v.tone({ w: "sine", f: 170 * p, f2: 70, gt: 0.06, a: 0.001, d: 0.09, v: 0.3 });
      v.tone({ w: "square", f: 650 * p, f2: 300 * p, gt: 0.02, a: 0.0008, d: 0.025, v: 0.05, lp: 3500 });
    },
  },
  teacup: {
    // Teapot Tempest: porcelain "tink" + a little tea "bloop"
    vol: 0.81, gap: 0.07, max: 3, pri: 0, rnd: 1,
    play(v, p) {
      v.fm({ f: 3100 * p, ratio: 1.41, idx: 1.1, idx2: 0.05, a: 0.001, d: 0.22, v: 0.05 });
      v.tone({ w: "sine", f: 4350 * p, a: 0.001, d: 0.06, v: 0.025 });
      v.tone({ t: 0.05, w: "sine", f: 480 * p, f2: 1150 * p, gt: 0.04, a: 0.001, d: 0.06, v: 0.15 });
      v.tone({ t: 0.1, w: "sine", f: 650 * p, f2: 1450 * p, gt: 0.03, a: 0.001, d: 0.045, v: 0.08 });
      v.noise({ t: 0.05, a: 0.002, d: 0.08, v: 0.05, bp: 1400, q: 1 });
    },
  },
  sparkleCharm: {
    // Notice-Me Sparkles: "kira-rin~" pentatonic glints over a shy "doki-doki"
    vol: 0.89, gap: 0.25, max: 2, pri: 1, rev: 0.4, rnd: 1,
    play(v, p) {
      [76, 78, 80, 83, 88].forEach((m, i) => v.fm({ t: i * 0.03, f: M(m) * p, ratio: 3.5, idx: 1, idx2: 0.04, d: 0.25, v: 0.045, pan: (i - 2) * 0.2 }));
      v.tone({ w: "p12", f: 1760 * p, f2: 3520 * p, gt: 0.14, a: 0.004, d: 0.16, v: 0.035, lp: 9000 });
      v.noise({ a: 0.05, d: 0.2, v: 0.04, hp: 8000 });
      v.tone({ t: 0.02, w: "sine", f: 95, f2: 60, gt: 0.05, a: 0.002, d: 0.09, v: 0.12 });
      v.tone({ t: 0.16, w: "sine", f: 95, f2: 60, gt: 0.05, a: 0.002, d: 0.09, v: 0.09 });
    },
  },
  transform: {
    // Henshin Burst: ribbons spin up (whoosh + climbing pentatonic), then a bright burst
    vol: 0.8, gap: 0.4, max: 1, pri: 2, budget: true, rev: 0.45,
    play(v, p) {
      v.noise({ a: 0.5, d: 0.06, v: 0.16, bp: 600, bp2: 7000, bpt: 0.55, q: 1.6 });
      const pent = [0, 2, 4, 7, 9];
      for (let i = 0; i < 14; i++) {
        v.tone({ t: i * 0.036, w: "p12", f: M(76 + pent[i % 5] + 12 * Math.floor(i / 5)) * p, a: 0.002, d: 0.06, v: 0.05 + i * 0.002, lp: 8500, pan: Math.sin(i * 1.4) * 0.5 });
      }
      v.tone({ w: "sine", f: 1200 * p, f2: 2400 * p, gt: 0.5, a: 0.4, d: 0.1, v: 0.04, trem: 0.8, tr: 22 });
      const t0 = 0.55;
      boom(v, t0, 70, 0.4, 0.45);
      for (const m of [64, 68, 71, 76]) v.tone({ t: t0, w: "sawtooth", f: M(m) * p, det: rand(-8, 8), a: 0.004, d: 0.45, s: 0, v: 0.04, lp: 6000, lp2: 1500, lpt: 0.4 });
      v.fm({ t: t0, f: M(88) * p, ratio: 3.5, idx: 1.3, idx2: 0.05, d: 0.6, v: 0.08 });
      sparkles(v, t0 + 0.05, 7, M(88) * p, 7, 0.045, 0.05);
    },
  },
  fireball: {
    // Dark Flame Dragon / Cheat Fireball: "FWOOM" with crackle
    vol: 0.6, gap: 0.08, max: 3, pri: 1, rnd: 1,
    play(v, p) {
      v.noise({ a: 0.025, d: 0.3, v: 0.35, lp: 4200 * p, lp2: 350, lpt: 0.3, crackle: 23 });
      v.noise({ a: 0.003, d: 0.08, v: 0.07, hp: 2500 });
      v.tone({ w: "sine", f: 150 * p, f2: 60, gt: 0.2, a: 0.01, d: 0.25, v: 0.22 });
      v.tone({ w: "sawtooth", f: 95 * p, f2: 50, gt: 0.2, a: 0.01, d: 0.2, v: 0.04, lp: 700 });
    },
  },
  boba: {
    // Bubble Tea Cannon: a rubbery "bwop" bounce
    vol: 0.42, gap: 0.05, max: 3, pri: 0, rnd: 2,
    play(v, p) {
      v.tone({ w: "sine", f: 720 * p, f2: 250 * p, gt: 0.05, a: 0.001, d: 0.08, v: 0.3 });
      v.tone({ t: 0.045, w: "sine", f: 300 * p, f2: 620 * p, gt: 0.035, a: 0.001, d: 0.05, v: 0.12 });
      v.noise({ a: 0.0008, d: 0.015, v: 0.05, lp: 1500 });
    },
  },
  paperCrane: {
    // Paper Crane Flock: a fluttering paper "fwip" (wing-flap gating) + a faint whistle
    vol: 1.29, gap: 0.12, max: 2, pri: 0, rnd: 1.5,
    play(v, p) {
      v.noise({ a: 0.006, d: 0.12, v: 0.16, bp: 3200 * p, bp2: 2200 * p, bpt: 0.12, q: 2, crackle: 28 });
      v.tone({ w: "sine", f: 2100 * p, f2: 2900 * p, gt: 0.1, a: 0.01, d: 0.1, v: 0.025 });
    },
  },
  lightstick: {
    // Idol Lightstick Wave (fires on the beat): a glowing swish over a soft, unpitched "whomp"
    vol: 0.85, gap: 0.1, max: 2, pri: 2, budget: true,
    play(v, p) {
      v.noise({ a: 0.012, d: 0.18, v: 0.2, bp: 700 * p, bp2: 4200 * p, bpt: 0.14, q: 1.4 });
      v.tone({ w: "sine", f: 120, f2: 60, gt: 0.07, a: 0.002, d: 0.1, v: 0.18 });
      v.tone({ w: "p12", f: 1500 * p, f2: 3000 * p, gt: 0.1, a: 0.006, d: 0.12, v: 0.03, lp: 9000 });
      v.noise({ t: 0.03, a: 0.02, d: 0.15, v: 0.05, hp: 7000 });
    },
  },
  snore: {
    // Kotatsu of Sloth: "hnnnnk..." (rattly inhale) "...shooo~" (whistled exhale). Pitch +5 = a yawn.
    vol: 1.72, gap: 1, max: 1, pri: 2, rev: 0.15,
    play(v, p) {
      v.formant({ f: 85 * p, w: "sawtooth", a: 0.25, d: 0.1, s: 0.9, len: 0.5, r: 0.1, v: 0.18, q: 4, pc: [[0, 0], [1, 2]], vc: [[0, 450, 900], [1, 520, 1000]] });
      v.noise({ a: 0.3, d: 0.1, s: 0.8, len: 0.5, r: 0.1, v: 0.08, bp: 700, q: 2, crackle: 31 });
      const t0 = 0.68;
      v.noise({ t: t0, a: 0.06, d: 0.5, v: 0.1, bp: 1800, bp2: 700, bpt: 0.5, q: 1.5 });
      v.tone({ t: t0, w: "sine", f: 1500 * p, f2: 950 * p, gt: 0.5, a: 0.05, d: 0.5, v: 0.05, vib: 20, vr: 5 });
    },
  },
  glitch: {
    // Animation Error / Plot Hole: crushed random-frequency blips, a crackle burst and a pitch snap
    vol: 0.48, gap: 0.1, max: 2, pri: 1, rnd: 2,
    play(v, p) {
      const cb = shaped(v, "crush", 0.8);
      let t = 0;
      for (let i = 0; i < 6; i++) {
        const len = rand(0.012, 0.03);
        v.tone({ t, w: i % 2 ? "square" : "sawtooth", f: rand(180, 2600) * p, a: 0.001, h: len, d: 0.004, v: 0.06, out: cb });
        t += len + rand(0.008, 0.03);
      }
      v.noise({ a: 0.001, d: 0.18, v: 0.12, hp: 1200, crackle: 61, out: cb });
      v.tone({ t: t * 0.5, w: "sawtooth", f: 1800 * p, f2: 90 * p, gt: 0.05, a: 0.001, d: 0.06, v: 0.05, lp: 6000 });
    },
  },
  splash: {
    // water: a splash body, spray, a plop and a few droplets
    vol: 0.59, gap: 0.08, max: 2, pri: 1, rnd: 1,
    play(v, p) {
      v.noise({ a: 0.003, d: 0.35, v: 0.3, lp: 6500 * p, lp2: 700, lpt: 0.3 });
      v.noise({ a: 0.002, d: 0.12, v: 0.1, bp: 3200, q: 1 });
      v.tone({ w: "sine", f: 180 * p, f2: 90, gt: 0.06, a: 0.002, d: 0.08, v: 0.15 });
      for (let i = 0; i < 5; i++) {
        const f = rand(700, 1800) * p;
        v.tone({ t: 0.05 + i * rand(0.03, 0.06), w: "sine", f, f2: f * 1.8, gt: 0.03, a: 0.001, d: 0.04, v: 0.06, pan: rand(-0.4, 0.4) });
      }
    },
  },
  crunch: {
    // candy crunch: a few crisp crackles over a bite thump
    vol: 1.11, gap: 0.05, max: 3, pri: 0, rnd: 1,
    play(v, p) {
      let t = 0;
      for (let i = 0; i < 5; i++) {
        v.noise({ t, a: 0.0006, d: rand(0.012, 0.03), v: 0.25 - i * 0.03, bp: rand(1500, 4200) * p, q: 3 });
        t += rand(0.008, 0.02);
      }
      v.tone({ w: "triangle", f: 320 * p, f2: 150, gt: 0.03, a: 0.001, d: 0.045, v: 0.12 });
    },
  },
  schoolChime: {
    // Shoujo Academy: an original 7-note campus chime in G major on tubular-ish FM bells
    vol: 2.07, gap: 2, max: 1, pri: 3, rev: 0.5,
    play(v, p) {
      const notes = [79, 83, 86, 84, 81, 78, 79];
      notes.forEach((m, i) => {
        const t = i * 0.27;
        const last = i === notes.length - 1;
        v.fm({ t, f: M(m) * p, ratio: 2, idx: 1.4, idx2: 0.1, it: 0.5, a: 0.002, d: last ? 1.6 : 1.1, v: 0.09, pan: i % 2 ? 0.2 : -0.2 });
        v.fm({ t, f: M(m) * p, ratio: 3.5, idx: 0.6, idx2: 0.02, it: 0.2, a: 0.002, d: 0.4, v: 0.03 });
        v.tone({ t, w: "sine", f: M(m - 12) * p, a: 0.003, d: last ? 1.5 : 0.9, v: 0.05 });
      });
    },
  },
  whistle: {
    // Hall Monitor: a pea whistle, "fwit-FWEEEET" (the pea rattles the pitch at ~40 Hz)
    vol: 2.37, gap: 0.4, max: 1, pri: 2,
    play(v, p) {
      for (const [t, len, g] of [[0, 0.07, 0.7], [0.12, 0.34, 1]] as const) {
        v.fm({ t, f: 2900 * p, ratio: 40 / 2900, idx: 3, idx2: 3, a: 0.012, d: 0.04, s: 0.9, len, r: 0.04, v: 0.09 * g });
        v.noise({ t, a: 0.01, d: 0.04, s: 0.8, len, r: 0.04, v: 0.05 * g, bp: 3000, q: 2 });
      }
    },
  },
} satisfies Record<Exclude<SfxId, BaseIds>, SfxDef>;

/** ids implemented in sfx.ts (the base game) */
type BaseIds =
  | "uiMove" | "uiConfirm" | "uiBack" | "uiDeny" | "cardFlip" | "cardPick" | "reroll" | "countTick"
  | "dash" | "playerHurt" | "playerDie" | "heal" | "levelUp" | "evolve" | "revive" | "ultReady" | "ultCutin" | "ultBlast" | "voiceBlip"
  | "gem" | "coin" | "magnet" | "chestDrop" | "chestOpen" | "chestReel" | "chestJackpot" | "food" | "powerup"
  | "hit" | "hitCrit" | "enemyDie" | "eliteDie" | "bossHit" | "bossDie" | "explosion" | "explosionBig" | "thunder" | "enemyShoot" | "telegraph" | "freeze" | "propBreak"
  | "starShot" | "slash" | "boomerang" | "bell" | "candyThrow" | "bubblePop" | "beam" | "beamBig" | "meow" | "orbitHit"
  | "warning" | "bossRoar" | "comboUp" | "comboBreak" | "rankUp" | "waveIncoming" | "victory" | "gameOver";
