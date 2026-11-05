/**
 * Note / chord parsing for the tracker notation.
 *   notes:  C4  F#5  Bb3  (C4 = MIDI 60)
 *   chords: C  Am  F#m7  Bbmaj7  Gsus4  E7  Ddim  Caug  Cadd9  Am9  C/E  G6
 */

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseNote(tok: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  let pc = PC[m[1]];
  if (m[2] === "#") pc++;
  else if (m[2] === "b") pc--;
  return (Number(m[3]) + 1) * 12 + pc;
}

export interface Chord {
  /** root pitch class 0..11 */
  root: number;
  /** intervals above the root (semitones), ascending, root (0) included */
  iv: number[];
  /** bass pitch class (slash chord) */
  bass: number;
  sym: string;
}

const QUAL: [RegExp, number[]][] = [
  [/^(maj7|M7|Δ7?)$/, [0, 4, 7, 11]],
  [/^(maj9|M9)$/, [0, 4, 7, 11, 14]],
  [/^(m7b5|ø)$/, [0, 3, 6, 10]],
  [/^(m7|min7|-7)$/, [0, 3, 7, 10]],
  [/^(m9)$/, [0, 3, 7, 10, 14]],
  [/^(m6)$/, [0, 3, 7, 9]],
  [/^(madd9)$/, [0, 3, 7, 14]],
  [/^(mM7)$/, [0, 3, 7, 11]],
  [/^(m|min|-)$/, [0, 3, 7]],
  [/^(7sus4)$/, [0, 5, 7, 10]],
  [/^(sus4|sus)$/, [0, 5, 7]],
  [/^(sus2)$/, [0, 2, 7]],
  [/^(dim7)$/, [0, 3, 6, 9]],
  [/^(dim|o)$/, [0, 3, 6]],
  [/^(aug|\+)$/, [0, 4, 8]],
  [/^(add9|2)$/, [0, 4, 7, 14]],
  [/^(9)$/, [0, 4, 7, 10, 14]],
  [/^(7)$/, [0, 4, 7, 10]],
  [/^(6)$/, [0, 4, 7, 9]],
  [/^(5)$/, [0, 7]],
  [/^$/, [0, 4, 7]],
];

const chordCache = new Map<string, Chord>();

export function parseChord(sym: string): Chord {
  const hit = chordCache.get(sym);
  if (hit) return hit;
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  if (!m) throw new Error(`bad chord "${sym}"`);
  const acc = (s: string) => (s === "#" ? 1 : s === "b" ? -1 : 0);
  const root = (PC[m[1]] + acc(m[2]) + 12) % 12;
  let iv: number[] | null = null;
  for (const [re, ints] of QUAL) {
    if (re.test(m[3])) {
      iv = ints;
      break;
    }
  }
  if (!iv) throw new Error(`bad chord quality "${sym}"`);
  const bass = m[4] ? (PC[m[4]] + acc(m[5]) + 12) % 12 : root;
  const c: Chord = { root, iv, bass, sym };
  chordCache.set(sym, c);
  return c;
}

/**
 * Close voicing of a chord around `center` (MIDI): every chord tone is placed in
 * [center - 6, center + 6), then sorted. This gives automatic smooth voice leading
 * between consecutive chords.
 */
export function voice(c: Chord, center: number): number[] {
  const out: number[] = [];
  for (const i of c.iv) {
    const pc = (c.root + i) % 12;
    let m = center - 6 + ((pc - (center - 6)) % 12 + 12) % 12;
    if (out.includes(m)) m += 12;
    out.push(m);
  }
  return out.sort((a, b) => a - b);
}

/** Bass note of the chord in the register around `center` (prefers the slash bass). */
export function bassNote(c: Chord, center: number): number {
  return center - 6 + ((c.bass - (center - 6)) % 12 + 12) % 12;
}
