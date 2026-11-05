/**
 * Music instruments (melodic) and the drum kit. Each instrument renders one note
 * into a Voice: (voice, midi, lengthSeconds, velocity 0..1).
 */
import { mtof, type Voice } from "../synth";
import type { DrumId } from "./song";

export type InstFn = (v: Voice, m: number, len: number, vel: number) => void;
export type DrumFn = (v: Voice, vel: number, len: number) => void;

export const INST: Record<string, InstFn> = {
  /** bright 25 % pulse lead with delayed vibrato + a detuned square for body */
  lead(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.04, len - 0.02);
    v.tone({ w: "p25", f, a: 0.004, d: 0.25, s: 0.62, len: l, r: 0.09, v: 0.26 * vel, vib: 16, vr: 5.6, vd: 0.2, lp: 7000 });
    v.tone({ w: "square", f, det: 9, a: 0.006, d: 0.25, s: 0.5, len: l, r: 0.09, v: 0.07 * vel, lp: 3000 });
  },
  /** dreamy soft lead (title): low-passed square + sine, slow vibrato */
  leadSoft(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.02);
    v.tone({ w: "soft", f, a: 0.012, d: 0.3, s: 0.7, len: l, r: 0.16, v: 0.3 * vel, vib: 14, vr: 5, vd: 0.22 });
    v.tone({ w: "sine", f: f * 2, a: 0.01, d: 0.25, s: 0.35, len: l, r: 0.14, v: 0.05 * vel });
  },
  /** aggressive detuned saw lead with a filter "bite" (boss / final) */
  leadSaw(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.015);
    for (const det of [-8, 8]) {
      v.tone({ w: "sawtooth", f, det, a: 0.006, d: 0.3, s: 0.7, len: l, r: 0.1, v: 0.09 * vel, lp: 5200, lp2: 2600, lpt: 0.25, q: 1.2, vib: 14, vr: 6, vd: 0.22 });
    }
    v.tone({ w: "p25", f: f / 2, a: 0.006, d: 0.2, s: 0.5, len: l, r: 0.08, v: 0.06 * vel, lp: 2000 });
  },
  /** 12.5 % pulse pluck - sparkly 16th arps */
  arp(v, m, len, vel) {
    v.tone({ w: "p12", f: mtof(m), a: 0.002, d: Math.min(0.16, len * 1.6 + 0.03), s: 0, v: 0.2 * vel, lp: 6500 });
  },
  /** square pluck with a little filter snap (boss arps) */
  arpSq(v, m, len, vel) {
    v.tone({ w: "square", f: mtof(m), a: 0.002, d: Math.min(0.14, len * 1.5 + 0.03), s: 0, v: 0.12 * vel, lp: 5000, lp2: 1400, lpt: 0.12, q: 2 });
  },
  /** soft triangle/sine pluck (title, shop) */
  arpTri(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "triangle", f, a: 0.003, d: 0.35, s: 0, v: 0.26 * vel });
    v.tone({ w: "sine", f: f * 2, a: 0.003, d: 0.18, s: 0, v: 0.06 * vel });
  },
  /** FM glockenspiel / star bell */
  bell(v, m, len, vel) {
    const f = mtof(m);
    v.fm({ f, ratio: 3.5, idx: 1.6, idx2: 0.08, it: 0.5, a: 0.002, d: 1.1, s: 0, v: 0.17 * vel });
    v.tone({ w: "sine", f: f * 2, a: 0.002, d: 0.5, s: 0, v: 0.05 * vel });
  },
  /** FM electric piano (shop / title chords) */
  ep(v, m, len, vel) {
    const f = mtof(m);
    v.fm({ f, ratio: 1, idx: 1.9, idx2: 0.25, it: 0.7, a: 0.003, d: 0.9, s: 0.35, len: Math.max(0.1, len - 0.03), r: 0.35, v: 0.13 * vel });
    v.fm({ f, ratio: 7, idx: 0.6, idx2: 0.02, it: 0.12, a: 0.002, d: 0.18, s: 0, v: 0.03 * vel });
  },
  /** music box: high, short, delicate */
  musicbox(v, m, len, vel) {
    const f = mtof(m);
    v.fm({ f, ratio: 5, idx: 0.9, idx2: 0.04, it: 0.3, a: 0.002, d: 1.3, s: 0, v: 0.15 * vel });
    v.tone({ w: "sine", f: f * 4, a: 0.001, d: 0.12, s: 0, v: 0.025 * vel });
  },
  /** chiptune bass: triangle body + quiet filtered pulse so phone speakers hear it */
  bass(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.04, len - 0.03);
    v.tone({ w: "triangle", f, a: 0.003, d: 0.12, s: 0.85, len: l, r: 0.04, v: 0.24 * vel });
    v.tone({ w: "p25", f, a: 0.003, d: 0.16, s: 0.55, len: l, r: 0.04, v: 0.15 * vel, lp: 2400, lp2: 900, lpt: 0.16 });
  },
  /** punchy saw bass (boss / final) */
  bassSaw(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.04, len - 0.02);
    v.tone({ w: "sawtooth", f, a: 0.003, d: 0.16, s: 0.55, len: l, r: 0.05, v: 0.2 * vel, lp: 2600, lp2: 700, lpt: 0.16, q: 3, drive: "soft" });
    v.tone({ w: "sine", f, a: 0.003, d: 0.1, s: 0.9, len: l, r: 0.04, v: 0.16 * vel });
  },
  /** round sine/triangle bass (shop, gameover) */
  bassSoft(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.04);
    v.tone({ w: "sine", f, a: 0.006, d: 0.3, s: 0.7, len: l, r: 0.08, v: 0.26 * vel });
    v.tone({ w: "triangle", f: f * 2, a: 0.004, d: 0.25, s: 0.35, len: l, r: 0.08, v: 0.09 * vel });
    v.tone({ w: "soft", f, a: 0.004, d: 0.2, s: 0.4, len: l, r: 0.06, v: 0.06 * vel, lp: 1400 });
  },
  /** warm detuned saw pad */
  pad(v, m, len, vel) {
    const f = mtof(m);
    for (const det of [-9, 9]) {
      v.tone({ w: "sawtooth", f, det, a: 0.08, d: 0.5, s: 0.8, len, r: 0.45, v: 0.045 * vel, lp: 1500 });
    }
  },
  /** slow, airy pad (title / gameover / victory loop) */
  padSoft(v, m, len, vel) {
    const f = mtof(m);
    for (const det of [-6, 7]) {
      v.tone({ w: "soft", f, det, a: 0.35, d: 0.6, s: 0.85, len, r: 0.8, v: 0.07 * vel, vib: 6, vr: 4.2, vd: 0.3 });
    }
  },
  /** detuned saw strings with slow attack (final) */
  strings(v, m, len, vel) {
    const f = mtof(m);
    for (const det of [-12, 0, 12]) {
      v.tone({ w: "sawtooth", f, det, a: 0.22, d: 0.5, s: 0.85, len, r: 0.5, v: 0.034 * vel, lp: 2800, vib: 9, vr: 4.8, vd: 0.25 });
    }
  },
  /** "aah" choir (final / boss) */
  choir(v, m, len, vel) {
    const f = mtof(m);
    for (const det of [-10, 10]) {
      v.formant({
        f,
        w: "sawtooth",
        a: 0.3,
        d: 0.4,
        s: 0.9,
        len,
        r: 0.6,
        v: 0.09 * vel,
        q: 5,
        vib: 12 + det * 0.2,
        vr: 5,
        pc: [[0, det / 100]],
        vc: [
          [0, 760, 1150],
          [1, 700, 1100],
        ],
      });
    }
  },
  /** plucky chord stabs (battle "pad" layer: keeps rhythm alive at intensity 0) */
  stab(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "sawtooth", f, a: 0.003, d: 0.32, s: 0.0, v: 0.07 * vel, lp: 4200, lp2: 800, lpt: 0.22, q: 1.5 });
    v.tone({ w: "p25", f, det: 7, a: 0.003, d: 0.22, s: 0.0, v: 0.04 * vel, lp: 3000 });
  },
  /** fanfare brass: saw with an opening filter swell */
  brass(v, m, len, vel) {
    const f = mtof(m);
    for (const det of [-6, 6]) {
      v.tone({ w: "sawtooth", f, det, a: 0.025, d: 0.35, s: 0.75, len, r: 0.18, v: 0.08 * vel, lp: 700, lp2: 3400, lpt: 0.07, q: 1.4, vib: 10, vr: 5.5, vd: 0.25 });
    }
  },
  /** breathy organ flute (counter-melodies) */
  flute(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "organ", f, a: 0.03, d: 0.2, s: 0.8, len: Math.max(0.05, len - 0.02), r: 0.12, v: 0.16 * vel, vib: 12, vr: 5.2, vd: 0.18 });
    v.noise({ a: 0.02, d: 0.08, s: 0, v: 0.02 * vel, bp: f * 2, q: 4 });
  },
  /** pizzicato pluck (shop) */
  pizz(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "triangle", f, a: 0.002, d: 0.22, s: 0, v: 0.3 * vel, lp: 2500 });
    v.noise({ a: 0.001, d: 0.012, s: 0, v: 0.05 * vel, bp: f * 3, q: 2 });
  },

  // ---------------------------------------------------------------- Season 2
  /** glockenspiel: bright bar partials (1, 2.76) + mallet tick (candy lead) */
  glock(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "sine", f, a: 0.001, d: 0.75, s: 0, v: 0.2 * vel });
    v.fm({ f, ratio: 2.76, idx: 1.4, idx2: 0.04, it: 0.1, a: 0.001, d: 0.35, s: 0, v: 0.09 * vel });
    v.noise({ a: 0.0008, d: 0.008, s: 0, v: 0.04 * vel, bp: 5000, q: 1.5 });
  },
  /** kazoo: buzzy square through a nasal "oo-ah" formant, scooped attack, wide vibrato */
  kazoo(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.02);
    v.formant({
      f, w: "square", a: 0.012, d: 0.06, s: 0.85, len: l, r: 0.05, v: 0.13 * vel, q: 3.2, vib: 24, vr: 6.4,
      pc: [[0, -0.6], [0.06, 0], [1, -0.1]],
      vc: [[0, 520, 1350], [1, 620, 1500]],
    });
    v.tone({ w: "soft", f, a: 0.01, d: 0.1, s: 0.7, len: l, r: 0.05, v: 0.05 * vel });
  },
  /** tuba: round low brass, the filter opens on the "blat" (candy boss oom-pah) */
  tuba(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.03);
    v.tone({ w: "sawtooth", f, a: 0.02, d: 0.18, s: 0.6, len: l, r: 0.07, v: 0.16 * vel, lp: 350, lp2: 1300, lpt: 0.05, q: 1.6 });
    v.tone({ w: "sine", f, a: 0.012, d: 0.2, s: 0.8, len: l, r: 0.07, v: 0.22 * vel });
  },
  /** acoustic-ish piano: hammer, FM brightness that fades, pitch-dependent decay (academy) */
  piano(v, m, len, vel) {
    const f = mtof(m);
    const d = Math.max(0.5, Math.min(2.4, 2.4 - (m - 48) * 0.045));
    v.tone({ w: "triangle", f, a: 0.002, d, s: 0, v: 0.17 * vel, lp: 5000, lp2: 1600, lpt: d * 0.5 });
    v.fm({ f, ratio: 1, idx: 1.5, idx2: 0.1, it: 0.3, a: 0.002, d: d * 0.6, s: 0, v: 0.07 * vel });
    v.tone({ w: "sine", f: f * 2, det: 3, a: 0.002, d: d * 0.4, s: 0, v: 0.04 * vel });
    v.noise({ a: 0.0008, d: 0.02, s: 0, v: 0.03 * vel, bp: Math.min(6000, f * 5), q: 1.5 });
  },
  /** steel pan: FM with a sweet inharmonic shimmer and a quick pitch settle (beach) */
  steel(v, m, len, vel) {
    const f = mtof(m);
    v.fm({ f: f * 1.006, f2: f, gt: 0.04, ratio: 2, idx: 1.4, idx2: 0.15, it: 0.25, a: 0.002, d: 0.7, s: 0, v: 0.14 * vel });
    v.fm({ f: f * 2, ratio: 1.5, idx: 0.5, idx2: 0.02, it: 0.1, a: 0.002, d: 0.25, s: 0, v: 0.035 * vel });
    v.tone({ w: "sine", f, a: 0.003, d: 0.9, s: 0, v: 0.08 * vel });
  },
  /** clean electric guitar pluck: saw through a fast-closing low-pass + body (beach arps) */
  guitar(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "sawtooth", f, a: 0.002, d: 0.5, s: 0, v: 0.1 * vel, lp: 4200, lp2: 700, lpt: 0.22, q: 1.2 });
    v.tone({ w: "triangle", f, a: 0.002, d: 0.6, s: 0, v: 0.08 * vel });
    v.noise({ a: 0.0008, d: 0.01, s: 0, v: 0.03 * vel, bp: Math.min(7000, f * 6), q: 2 });
  },
  /** chiptune flute: triangle + thin pulse, breath, strong delayed vibrato (beach boss festival) */
  chipFlute(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.02);
    v.tone({ w: "triangle", f, a: 0.015, d: 0.15, s: 0.85, len: l, r: 0.08, v: 0.26 * vel, vib: 26, vr: 5.8, vd: 0.16 });
    v.tone({ w: "p12", f, a: 0.015, d: 0.15, s: 0.6, len: l, r: 0.08, v: 0.035 * vel, lp: 5000, vib: 26, vr: 5.8, vd: 0.16 });
    v.noise({ a: 0.01, d: 0.07, s: 0, v: 0.025 * vel, bp: f * 2, q: 3 });
  },
  /** koto-ish pluck: bright triangle with a tiny upward pitch flick (beach boss) */
  koto(v, m, len, vel) {
    const f = mtof(m);
    v.tone({ w: "triangle", f: f * 0.985, f2: f, gt: 0.03, a: 0.001, d: 0.9, s: 0, v: 0.2 * vel, lp: 6000, lp2: 1800, lpt: 0.4 });
    v.tone({ w: "p25", f, a: 0.001, d: 0.18, s: 0, v: 0.05 * vel, lp: 4000 });
  },
  /** hold-music organ: drawbars + slow "leslie" tremolo, cheesy and mid-heavy (cancel) */
  holdOrgan(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.02);
    v.tone({ w: "organ", f, a: 0.008, d: 0.05, s: 0.95, len: l, r: 0.06, v: 0.2 * vel, trem: 0.3, tr: 5.8, vib: 5, vr: 5.8, vd: 0 });
    v.tone({ w: "sine", f: f * 3, a: 0.008, d: 0.05, s: 0.9, len: l, r: 0.05, v: 0.03 * vel });
    v.tone({ w: "square", f, a: 0.001, d: 0.012, s: 0, v: 0.03 * vel, lp: 3000 });
  },
  /** distorted "guitar" lead: driven detuned saws, low-passed (rival battle) */
  leadDist(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.015);
    for (const det of [-7, 7]) {
      v.tone({ w: "sawtooth", f, det, a: 0.004, d: 0.3, s: 0.75, len: l, r: 0.08, v: 0.07 * vel, drive: "drive", lp: 3600, q: 1.1, vib: 22, vr: 6.2, vd: 0.25 });
    }
    v.tone({ w: "square", f: f / 2, a: 0.004, d: 0.2, s: 0.5, len: l, r: 0.06, v: 0.04 * vel, lp: 1400 });
  },
  /** tremolo strings: tense bowed tremolo (gacha build-up, academy twist) */
  tremStr(v, m, len, vel) {
    const f = mtof(m);
    for (const det of [-8, 8]) {
      v.tone({ w: "sawtooth", f, det, a: 0.06, d: 0.3, s: 0.85, len, r: 0.25, v: 0.04 * vel, lp: 3200, trem: 0.75, tr: 13 });
    }
  },
  /** round plucked bass with a little finger "thump" (hub city-pop) */
  bassPluck(v, m, len, vel) {
    const f = mtof(m);
    const l = Math.max(0.05, len - 0.03);
    v.tone({ w: "sine", f, a: 0.003, d: 0.35, s: 0.55, len: l, r: 0.07, v: 0.27 * vel });
    v.tone({ w: "sawtooth", f, a: 0.002, d: 0.14, s: 0.25, len: l, r: 0.05, v: 0.06 * vel, lp: 1800, lp2: 500, lpt: 0.12 });
  },
  /** "synth bell": bright two-op FM bell with a long shimmer (academy) */
  synthBell(v, m, len, vel) {
    const f = mtof(m);
    v.fm({ f, ratio: 4, idx: 2, idx2: 0.1, it: 0.6, a: 0.002, d: 1.2, s: 0, v: 0.12 * vel });
    v.fm({ f: f * 2, ratio: 1.5, idx: 0.6, idx2: 0.02, it: 0.2, a: 0.002, d: 0.3, s: 0, v: 0.03 * vel });
  },
};

export const DRUM: Record<DrumId, DrumFn> = {
  k(v, vel) {
    v.tone({ w: "sine", f: 170, f2: 50, gt: 0.07, a: 0.0015, d: 0.3, s: 0, v: 0.7 * vel });
    v.tone({ w: "triangle", f: 380, f2: 110, gt: 0.03, a: 0.001, d: 0.06, s: 0, v: 0.36 * vel });
    v.noise({ a: 0.0008, d: 0.016, s: 0, v: 0.2 * vel, hp: 2500 });
  },
  s(v, vel) {
    v.noise({ a: 0.001, d: 0.17, s: 0, v: 0.42 * vel, bp: 2300, q: 0.8 });
    v.noise({ a: 0.001, d: 0.06, s: 0, v: 0.16 * vel, hp: 6000 });
    v.tone({ w: "triangle", f: 240, f2: 170, gt: 0.05, a: 0.001, d: 0.09, s: 0, v: 0.34 * vel });
  },
  cl(v, vel) {
    for (let i = 0; i < 3; i++) v.noise({ t: i * 0.009, a: 0.0008, d: 0.011, s: 0, v: 0.32 * vel, bp: 1400, q: 1.2 });
    v.noise({ t: 0.027, a: 0.001, d: 0.15, s: 0, v: 0.28 * vel, bp: 1300, q: 1 });
  },
  h(v, vel) {
    v.noise({ a: 0.0008, d: 0.032, s: 0, v: 0.15 * vel, hp: 8000 });
  },
  o(v, vel) {
    v.noise({ a: 0.001, d: 0.26, s: 0, v: 0.12 * vel, hp: 7000 });
  },
  c(v, vel) {
    v.noise({ a: 0.001, d: 1.7, s: 0, v: 0.2 * vel, hp: 3500 });
    v.noise({ a: 0.001, d: 0.9, s: 0, v: 0.12 * vel, bp: 7000, q: 1.5 });
  },
  rim(v, vel) {
    v.tone({ w: "triangle", f: 1650, a: 0.0008, d: 0.03, s: 0, v: 0.2 * vel });
    v.noise({ a: 0.0008, d: 0.02, s: 0, v: 0.1 * vel, bp: 3000, q: 2 });
  },
  shk(v, vel) {
    v.noise({ a: 0.008, d: 0.055, s: 0, v: 0.08 * vel, bp: 7500, q: 1.2 });
  },
  tl(v, vel) {
    tom(v, vel, 130);
  },
  tm(v, vel) {
    tom(v, vel, 175);
  },
  th(v, vel) {
    tom(v, vel, 235);
  },
  up(v, vel, len) {
    // noise riser over the whole tied length
    v.noise({ a: Math.max(0.05, len * 0.92), d: 0.05, s: 0, v: 0.16 * vel, bp: 500, bp2: 7000, bpt: len, q: 1.3 });
  },
  sn(v, vel) {
    v.noise({ a: 0.006, d: 0.13, s: 0, v: 0.14 * vel, bp: 3600, q: 0.6 });
  },
  sub(v, vel) {
    v.tone({ w: "sine", f: 72, f2: 36, gt: 0.6, a: 0.002, d: 1.3, s: 0, v: 0.75 * vel });
    v.noise({ a: 0.001, d: 0.3, s: 0, v: 0.12 * vel, lp: 600 });
  },
  tamb(v, vel) {
    v.noise({ a: 0.002, d: 0.08, s: 0, v: 0.09 * vel, hp: 9000 });
    v.tone({ w: "square", f: 5400, a: 0.001, d: 0.05, s: 0, v: 0.012 * vel, hp: 4000 });
  },
  zap(v, vel) {
    v.tone({ w: "square", f: 2400, f2: 300, gt: 0.08, a: 0.001, d: 0.09, s: 0, v: 0.08 * vel, lp: 6000 });
  },
  // ---- Season 2
  /** taiko "don": big low drum, skin slap + long body */
  tk(v, vel) {
    v.tone({ w: "sine", f: 118, f2: 72, gt: 0.12, a: 0.002, d: 0.55, s: 0, v: 0.62 * vel });
    v.tone({ w: "triangle", f: 240, f2: 120, gt: 0.05, a: 0.001, d: 0.09, s: 0, v: 0.22 * vel });
    v.noise({ a: 0.001, d: 0.06, s: 0, v: 0.16 * vel, lp: 1400 });
  },
  /** woodblock / taiko rim "ka" */
  wb(v, vel) {
    v.tone({ w: "sine", f: 1180, f2: 1050, gt: 0.03, a: 0.0008, d: 0.05, s: 0, v: 0.2 * vel });
    v.noise({ a: 0.0008, d: 0.012, s: 0, v: 0.08 * vel, bp: 2400, q: 3 });
  },
  /** cheap preset-organ kick: boxy, no click (hold music) */
  bk(v, vel) {
    v.tone({ w: "sine", f: 130, f2: 75, gt: 0.04, a: 0.002, d: 0.14, s: 0, v: 0.5 * vel });
  },
  /** vinyl crackle for one beat */
  vin(v, vel, len) {
    v.noise({ a: 0.002, d: Math.max(0.05, len), s: 0, v: 0.05 * vel, hp: 2500, crackle: 37 });
  },
  /** cowbell: two detuned squares through a band-pass */
  cow(v, vel) {
    v.tone({ w: "square", f: 562, a: 0.0008, d: 0.12, s: 0, v: 0.05 * vel, bp: 900, q: 2 });
    v.tone({ w: "square", f: 845, a: 0.0008, d: 0.1, s: 0, v: 0.04 * vel, bp: 1300, q: 2 });
  },
  /** timpani: tuned low boom with a rumble tail */
  tim(v, vel) {
    v.tone({ w: "sine", f: 98, f2: 92, gt: 0.3, a: 0.003, d: 0.9, s: 0, v: 0.5 * vel });
    v.tone({ w: "sine", f: 147, f2: 140, gt: 0.3, a: 0.003, d: 0.45, s: 0, v: 0.14 * vel });
    v.noise({ a: 0.002, d: 0.25, s: 0, v: 0.12 * vel, lp: 600, pink: true });
  },
};

function tom(v: Voice, vel: number, f: number): void {
  v.tone({ w: "sine", f: f * 1.5, f2: f * 0.75, gt: 0.15, a: 0.0015, d: 0.3, s: 0, v: 0.55 * vel });
  v.noise({ a: 0.001, d: 0.04, s: 0, v: 0.1 * vel, lp: 2000 });
}
