/**
 * "Cherry Blossom Homeroom" - Shoujo Academy battle theme. 136 bpm (StageDef.bpm),
 * G major school-life pop: piano comping, a bright synth bell, the campus chime
 * motif (G B D C | A F# G, same as the `schoolChime` sfx) in the intro, a
 * J-pop pulse lead over a canon-style chorus... and THE TWIST: the music suddenly
 * turns into a tragic E minor confession scene (tremolo strings, timpani,
 * F#m7b5 - B7) for eight bars, then snaps back to the chorus like nothing happened.
 * Original composition. The boss theme (boss-academy.ts) puts dramatic strings over the chime.
 * intro(4) A(8) B(8) C(8) A(8) B(8) T(8, twist) C(8) -> loop to A
 * Intensity layers: 0 piano + bass + pad (+ twist strings) | 0.3 drums | 0.6 bell arps | 0.8 lead | 0.9 string counter
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

export const CHIME = "G5 - B5 - D6 - C6 - | A5 - F#5 - G5 - - -";

const POP: DrumPat = {
  k: "x.....x...x.....",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const POP_FILL: DrumPat = { k: "x.....x...x.....", s: "....x...x.x.x.xx", th: "........x.......", tm: "..........x.x..." };
const CHORUS: DrumPat = {
  k: "x...x...x...x...",
  s: "....x.......x...",
  cl: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  o: "..............x.",
  c: "!x",
};
const DRAMA: DrumPat = {
  tim: "x.......x.......",
  tl: "......x.......x.",
  k: "x...............",
  c: "!x",
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "G | D G | Em | C D",
    parts: {
      chime: CHIME + " | . | .",
      piano: "@x - - - - - - - | x - - - x - - - | x - - - - - - - | x - - - x - - -",
      bass: "@. | . | r - - - - - - - | r - - - r - - -",
      drums: { shk: ". | . | x.x.x.x.x.x.x.x. | x.x.x.x.x.x.x.x.", s: ". | . | . | ........x.x.xxxx", up: ". | . | . | x---------------" },
    },
  },
  A: {
    bars: 8,
    chords: "G | Em | C | D | G | Em | Am7 | D7",
    parts: {
      bass: "@r - r r' - r 2 -",
      piano: "@x . x . x . x x",
      pad: "@x - - - - - - -",
      bell: "@0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3",
      lead:
        "D5 - G5 - B5 - A5 G5 | G5 - - E5 - - B4 - | C5 - E5 - G5 - F#5 E5 | F#5 - - - A5 - - - |" +
        "D5 - G5 - B5 - D6 - | B5 - - G5 - - E5 - | E5 - - C5 - - A4 C5 | D5 - - - F#5 - A5 - |",
      drums: POP,
    },
    fill: POP_FILL,
  },
  B: {
    bars: 8,
    chords: "Cmaj7 | Bm7 | Am7 | G | Cmaj7 | Bm7 | Am7 | D7sus4 D7",
    parts: {
      bass: "@r - - r - - r -",
      piano: "@x - - x - - x -",
      pad: "@x - - - - - - -",
      bell: "@3 2 1 0 3 2 1 0 3 2 1 0 3 2 1 0",
      lead:
        "E5 - G5 - B5 - - A5 | A5 - - F#5 - - D5 - | C5 - E5 - G5 - - F#5 | G5 - - - - - . . |" +
        "E5 - G5 - C6 - B5 C6 | D6 - - B5 - - F#5 - | E6 - D6 C6 - - A5 - | D6 - - - C6 - A5 - |",
      drums: POP,
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
  },
  C: {
    bars: 8,
    chords: "G | D/F# | Em | Bm | C | G/B | Am D | G",
    parts: {
      bass: "@r - r - r - r r'",
      piano: "@x . x x . x . x",
      pad: "@x - - - - - - -",
      bell: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead:
        "B5 - - A5 G5 - D6 - | A5 - - F#5 - - D5 E5 | G5 - - F#5 E5 - B5 - | D6 - - - F#5 - - - |" +
        "E6 - - D6 C6 - G5 - | D6 - - C6 B5 - G5 - | C6 - B5 A5 - - F#5 - | G5 - - - - - . . |",
      str: "@. | . | . | . | x - - - - - - - | x - - - - - - - | x - - - x - - - | x - - - - - - -",
      drums: CHORUS,
    },
    fill: POP_FILL,
  },
  T: {
    // THE TWIST: a tragic confession scene in E minor (harmonic minor), then "...anyway!"
    bars: 8,
    chords: "Em | C | Am | B7 | Em | C | F#m7b5 | B7",
    parts: {
      bass: "@r - - - - - - - | r - - - - - - - | r - - - - - - - | r - - - r - - -",
      piano: "@x - - - x - - -",
      drama: "@x - - - - - - -",
      lead:
        "B5 - - - E6 - - - | E6 - - D6 C6 - - - | C6 - - B5 A5 - - - | D#6 - - - F#6 - - - |" +
        "G6 - - F#6 E6 - - B5 | G6 - - E6 C6 - - - | A5 - C6 - E6 - - - | D#6 - - - - - B5 - |",
      drums: DRAMA,
    },
    fill: { tim: "x.x.x.x.xxxxxxxx", s: "........x.x.xxxx", up: "x---------------" },
  },
};

export const academy: SongDef = {
  bpm: 136,
  layered: true,
  vol: 1.15,
  key: "G major",
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bass", vol: 0.6, center: 40, voicing: "root" },
    { id: "piano", inst: "piano", vol: 1.5, center: 62, rev: 0.25, pan: -0.1 },
    { id: "pad", inst: "padSoft", vol: 0.35, center: 60, rev: 0.5 },
    { id: "drama", inst: "tremStr", vol: 1.7, center: 62, rev: 0.45 },
    { id: "chime", inst: "synthBell", vol: 1.4, rev: 0.45, dly: 0.2, pan: 0.15 },
    { id: "drums", inst: "drums", vol: 0.78, layer: 0.3 },
    { id: "bell", inst: "synthBell", vol: 1.0, center: 84, layer: 0.6, dly: 0.25, rev: 0.25, pan: 0.3 },
    { id: "lead", inst: "lead", vol: 0.95, layer: 0.8, rev: 0.22, dly: 0.18 },
    { id: "str", inst: "strings", vol: 1.2, center: 67, layer: 0.9, rev: 0.4, pan: -0.25 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "A", "B", "T", "C"],
  loopTo: 1,
};
