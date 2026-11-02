/**
 * Tracker-style song format + compiler.
 *
 * A song is a list of channels (instrument, level, intensity layer, sends) and a
 * set of named sections arranged by `order`. Each section holds one pattern
 * string per channel.
 *
 * PATTERN NOTATION (bar-division): bars are separated by `|`; inside a bar the
 * tokens split the bar evenly - 4 tokens = quarters, 8 = eighths, 16 = sixteenths,
 * 12 = triplet eighths. Patterns shorter than the section loop (prefix `!` = play once).
 *   %        repeat the previous bar
 *   .        rest
 *   -        tie (extend the previous note)
 *   C5 F#4   notes (C4 = middle C);  C5+E5+G5 = several notes at once
 *   suffix ! accent, ? ghost (softer)
 * Chord-relative patterns start with `@` (they follow the section's `chords` line):
 *   0 1 2 3  chord tones by index (ascending voicing; 3 on a triad = root + octave)
 *   r        the chord's bass note (slash bass if any)
 *   x        the whole chord
 *   suffix ' = octave up, , = octave down (repeatable)
 * Drum lines (one per drum voice): x hit, X accent, o ghost, . rest. A bar without
 * spaces is split per character ("x...x...x...x...").
 * Chords line: chord symbols with the same bar division (`Am F | C G`), `-` ties.
 */
import { bassNote, parseChord, parseNote, voice, type Chord } from "./theory";

export type DrumId =
  | "k" | "s" | "cl" | "h" | "o" | "c" | "rim" | "shk" | "tl" | "tm" | "th" | "up" | "sn" | "sub" | "tamb" | "zap";

export type DrumPat = Partial<Record<DrumId, string>>;

export interface ChannelDef {
  id: string;
  /** instrument id (see inst.ts) or "drums" */
  inst: string;
  vol?: number;
  /** intensity threshold: the channel plays when intensity >= layer (0 = always) */
  layer?: number;
  rev?: number;
  dly?: number;
  pan?: number;
  /** register (MIDI) for chord-relative patterns */
  center?: number;
  /** "close" (default): voiced around `center` with smooth voice leading. "root": root position from the root near `center`. */
  voicing?: "close" | "root";
  /** transpose (semitones) for literal notes */
  tr?: number;
}

export interface SectionDef {
  bars: number;
  chords?: string;
  parts: Record<string, string | DrumPat | undefined>;
  /** drum pattern replacing the last bar of the `drums` channel */
  fill?: DrumPat;
  /** transpose every melodic channel (and the chords) by semitones - key changes */
  tr?: number;
}

export interface SongDef {
  bpm: number;
  /** beats per bar (default 4) */
  bpb?: number;
  /** 0 = straight, ~0.16 = triplet swing on the off-beat 8ths */
  swing?: number;
  /** overall song level */
  vol?: number;
  /** feedback-delay time in beats (default 0.75 = dotted 8th) */
  delayBeats?: number;
  /** whether channel `layer` thresholds follow setIntensity (battle) */
  layered?: boolean;
  channels: ChannelDef[];
  sections: Record<string, SectionDef>;
  order: string[];
  /** order index to loop back to; -1 = stop after the last section */
  loopTo?: number;
}

export interface NoteEv {
  /** start (beats, swung) */
  t: number;
  /** length (beats) */
  dur: number;
  ch: number;
  /** MIDI note (0 for drums) */
  m: number;
  v: number;
  d?: DrumId;
}

export interface CSection {
  name: string;
  beats: number;
  ev: NoteEv[];
  /** chord timeline (beats, unswung) with pitch classes - for analysis tools */
  chords: { t: number; end: number; sym: string; pcs: number[] }[];
}

export interface CSong {
  def: SongDef;
  bpb: number;
  order: CSection[];
  loopTo: number;
}

const HIT = /^[xXo.\-_]+$/;

function splitBars(src: string): { bars: string[][]; once: boolean } {
  let s = src.trim();
  let once = false;
  if (s.startsWith("!")) {
    once = true;
    s = s.slice(1);
  }
  const raw = s.split("|").map((b) => b.trim()).filter((b) => b.length > 0);
  const bars: string[][] = [];
  for (const b of raw) {
    if (b === "%") {
      bars.push(bars.length ? bars[bars.length - 1] : ["."]);
      continue;
    }
    if (!/\s/.test(b) && b.length > 1 && HIT.test(b)) bars.push(b.split(""));
    else bars.push(b.split(/\s+/));
  }
  return { bars, once };
}

interface Tok {
  t: number;
  dur: number;
  tok: string;
}

/** Expand a pattern string into timed tokens covering `nBars` (loops unless `!`). */
function tokens(src: string, nBars: number, bpb: number): Tok[] {
  const { bars, once } = splitBars(src);
  const out: Tok[] = [];
  if (!bars.length) return out;
  const total = once ? Math.min(bars.length, nBars) : nBars;
  for (let b = 0; b < total; b++) {
    const bar = bars[b % bars.length];
    const step = bpb / bar.length;
    for (let i = 0; i < bar.length; i++) out.push({ t: b * bpb + i * step, dur: step, tok: bar[i] });
  }
  return out;
}

function velOf(tok: string): [string, number] {
  if (tok.endsWith("!")) return [tok.slice(0, -1), 1];
  if (tok.endsWith("?")) return [tok.slice(0, -1), 0.5];
  return [tok, 0.8];
}

interface ChordSeg {
  t: number;
  end: number;
  c: Chord | null;
}

function chordLine(src: string | undefined, nBars: number, bpb: number): ChordSeg[] {
  if (!src) return [];
  const segs: ChordSeg[] = [];
  for (const tk of tokens(src, nBars, bpb)) {
    if (tk.tok === "-" && segs.length) segs[segs.length - 1].end = tk.t + tk.dur;
    else segs.push({ t: tk.t, end: tk.t + tk.dur, c: tk.tok === "." || tk.tok === "-" ? null : parseChord(tk.tok) });
  }
  return segs;
}

function chordAt(segs: ChordSeg[], t: number): Chord | null {
  for (const s of segs) if (t >= s.t - 1e-6 && t < s.end - 1e-6) return s.c;
  return null;
}

function octaves(tok: string): [string, number] {
  let o = 0;
  while (tok.endsWith("'") || tok.endsWith(",")) {
    o += tok.endsWith("'") ? 12 : -12;
    tok = tok.slice(0, -1);
  }
  return [tok, o];
}

function rootVoicing(c: Chord, center: number): number[] {
  const r = bassNote({ ...c, bass: c.root }, center);
  return c.iv.map((i) => r + i);
}

function resolveRel(tok: string, c: Chord, ch: ChannelDef): number[] {
  const center = ch.center ?? 60;
  const [base, oct] = octaves(tok);
  if (base === "r") return [bassNote(c, center) + oct];
  const vc = ch.voicing === "root" ? rootVoicing(c, center) : voice(c, center);
  if (base === "x") return vc.map((m) => m + oct);
  const n = Number(base);
  if (!Number.isInteger(n)) throw new Error(`bad chord-relative token "${tok}"`);
  const len = vc.length;
  const k = ((n % len) + len) % len;
  return [vc[k] + 12 * Math.floor(n / len) + oct];
}

function noteLine(src: string, nBars: number, bpb: number, ch: ChannelDef, chi: number, segs: ChordSeg[], out: NoteEv[]): void {
  let s = src.trim();
  let once = false;
  for (let i = 0; i < 2; i++) {
    if (s.startsWith("!")) {
      once = true;
      s = s.slice(1).trimStart();
    }
  }
  const rel = s.startsWith("@");
  if (rel) s = s.slice(1).trimStart();
  if (s.startsWith("!")) {
    once = true;
    s = s.slice(1);
  }
  const body = (once ? "!" : "") + s;
  let cur: NoteEv[] = [];
  for (const tk of tokens(body, nBars, bpb)) {
    const [tok, v] = velOf(tk.tok);
    if (tok === ".") {
      cur = [];
      continue;
    }
    if (tok === "-" || tok === "_") {
      for (const e of cur) e.dur += tk.dur;
      continue;
    }
    let ms: number[];
    if (rel) {
      const c = chordAt(segs, tk.t);
      if (!c) {
        cur = [];
        continue;
      }
      ms = resolveRel(tok, c, ch);
    } else {
      ms = tok.split("+").map((n) => {
        const m = parseNote(n);
        if (m === null) throw new Error(`bad note "${n}" in channel ${ch.id}`);
        return m + (ch.tr ?? 0);
      });
    }
    cur = ms.map((m) => ({ t: tk.t, dur: tk.dur, ch: chi, m, v }));
    out.push(...cur);
  }
}

function drumLines(p: DrumPat, nBars: number, bpb: number, chi: number, out: NoteEv[], offset = 0): void {
  for (const [id, line] of Object.entries(p) as [DrumId, string][]) {
    if (!line) continue;
    let last: NoteEv | null = null;
    for (const tk of tokens(line, nBars, bpb)) {
      const c = tk.tok;
      if (c === "-" && last) {
        last.dur += tk.dur;
        continue;
      }
      if (c !== "x" && c !== "X" && c !== "o") {
        last = null;
        continue;
      }
      last = { t: tk.t + offset, dur: tk.dur, ch: chi, m: 0, v: c === "X" ? 1 : c === "o" ? 0.45 : 0.78, d: id };
      out.push(last);
    }
  }
}

/** Piecewise-linear swing warp inside each beat (off-beat 8th moves later by `s` beats). */
function warp(t: number, s: number): number {
  if (!s) return t;
  const b = Math.floor(t + 1e-9);
  const x = t - b;
  return b + (x <= 0.5 ? x * ((0.5 + s) / 0.5) : 0.5 + s + (x - 0.5) * ((0.5 - s) / 0.5));
}

export function compileSong(def: SongDef): CSong {
  const bpb = def.bpb ?? 4;
  const cache = new Map<string, CSection>();
  const chIndex = new Map(def.channels.map((c, i) => [c.id, i]));
  const compileSection = (name: string): CSection => {
    const sec = def.sections[name];
    if (!sec) throw new Error(`unknown section ${name}`);
    const segs = chordLine(sec.chords, sec.bars, bpb);
    const ev: NoteEv[] = [];
    for (const [id, part] of Object.entries(sec.parts)) {
      if (!part) continue;
      const chi = chIndex.get(id);
      if (chi === undefined) throw new Error(`section ${name}: unknown channel ${id}`);
      const ch = def.channels[chi];
      if (typeof part === "string") noteLine(part, sec.bars, bpb, ch, chi, segs, ev);
      else {
        const fill = id === "drums" ? sec.fill : undefined;
        drumLines(part, fill ? sec.bars - 1 : sec.bars, bpb, chi, ev);
        if (fill) drumLines(fill, 1, bpb, chi, ev, (sec.bars - 1) * bpb);
      }
    }
    const s = def.swing ?? 0;
    const tr = sec.tr ?? 0;
    for (const e of ev) {
      if (tr && !e.d) e.m += tr;
      const a = warp(e.t, s);
      const b = warp(e.t + e.dur, s);
      e.t = a;
      e.dur = Math.max(0.01, b - a);
    }
    ev.sort((a, b) => a.t - b.t || a.ch - b.ch);
    const chords = segs
      .filter((g) => g.c)
      .map((g) => ({ t: g.t, end: g.end, sym: g.c!.sym, pcs: g.c!.iv.map((i) => (g.c!.root + i + tr + 120) % 12) }));
    return { name, beats: sec.bars * bpb, ev, chords };
  };
  const order = def.order.map((n) => {
    let c = cache.get(n);
    if (!c) {
      c = compileSection(n);
      cache.set(n, c);
    }
    return c;
  });
  return { def, bpb, order, loopTo: def.loopTo ?? 0 };
}
