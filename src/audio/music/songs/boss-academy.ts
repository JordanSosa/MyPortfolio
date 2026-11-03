/**
 * "Student Council Showdown" - Shoujo Academy boss theme (Student Council
 * President, The Bishounen Who Never Notices You). 136 bpm (the stage tempo),
 * G minor: dramatic tremolo strings over the campus chime motif - which fits G
 * harmonic minor note for note (G Bb D C | A F# G) - driving piano 8ths, a
 * soaring saw "violin" lead, choir, and in the B section the bishounen's sparkle
 * arps (he still doesn't notice you). Original composition.
 * intro(4) A(8) B(8) C(8) brk(4) A(8) C(8) -> loop to A
 * Intensity layers (boss >= 0.4): 0 bass + strings + piano + chime + lead + drums | 0.6 sparkle arps | 0.8 choir
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const MARCH: DrumPat = {
  k: "x.....x...x.....",
  s: "....x.......x...",
  tim: "x.......x.......",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const MARCH_FILL: DrumPat = { k: "x.....x...x.....", s: "....x...x.x.xxxx", th: "........x.x.....", tm: "............x.x.", tim: "x..............." };
const DRIVE: DrumPat = {
  k: "x...x...x...x...",
  s: "....x.......x...",
  tl: "..x...x...x...x.",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Gm | D Gm | Cm | D",
    parts: {
      str: "@x - - - - - - -",
      chime: "G5 - Bb5 - D6 - C6 - | A5 - F#5 - G5 - - - | . | .",
      bass: "@r - - - - - - - | r - - - r - - - | r - - - - - - - | r r r r r r r r",
      drums: { tim: "x.......x....... | x.......x....... | x.......x....... | x.x.x.x.xxxxxxxx", s: ". | . | . | ........xxxxXXXX", c: "!x" },
    },
  },
  A: {
    bars: 8,
    chords: "Gm | Eb | Cm | D | Gm | Eb | Am7b5 | D7",
    parts: {
      bass: "@r r r r r r r r",
      str: "@x - - - - - - -",
      piano: "@x . x . x . x .",
      lead:
        "D6 - - - G6 - - - | G6 - - F6 Eb6 - - - | Eb6 - - D6 C6 - - G5 | F#6 - - - D6 - - - |" +
        "Bb6 - - A6 G6 - - D6 | G6 - - - Bb6 - - - | A6 - - G6 Eb6 - - C6 | F#6 - - - - - D6 - |",
      drums: MARCH,
    },
    fill: MARCH_FILL,
  },
  B: {
    bars: 8,
    chords: "Eb | F | Dm | Gm | Cm | F | Bb | D7",
    parts: {
      bass: "@r - r r - r r -",
      str: "@x - - - - - - -",
      piano: "@x . x . x . x .",
      arp: "@0 1 2 3 4 5 4 3 0 1 2 3 4 5 4 3",
      lead:
        "G5 . Bb5 . Eb6 - D6 Eb6 | F6 - - Eb6 - - C6 - | D6 . F6 . A6 - G6 F6 | G6 - - - D6 - - - |" +
        "C6 . Eb6 . G6 - F6 Eb6 | F6 - - Eb6 - - C6 A5 | D6 - - C6 Bb5 - - - | A5 - - - C6 - F#6 - |",
      drums: DRIVE,
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", tim: "x...x...", up: "x---------------" },
  },
  C: {
    bars: 8,
    chords: "Gm | F | Eb | D | Gm | F | Eb D | Gm",
    parts: {
      bass: "@r r r' r r r r' r",
      str: "@x - - - - - - -",
      piano: "@x . x x . x . x",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead:
        "G6 - - - Bb6 - A6 G6 | F6 - - - C6 - - - | Eb6 - - - G6 - F6 Eb6 | D6 - - - F#6 - - - |" +
        "Bb6 - - - G6 - A6 Bb6 | C7 - - - A6 - - - | G6 - F6 Eb6 D6 - F#6 - | G6 - - - - - - - |",
      drums: { ...DRIVE, k: "x.x.x.x.x.x.x.x.", tim: "x.......x......." },
    },
    fill: MARCH_FILL,
  },
  brk: {
    // the chime alone over the strings: the student council has called an emergency meeting
    bars: 4,
    chords: "Gm | D Gm | Eb | D7",
    parts: {
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      chime: "G5 - Bb5 - D6 - C6 - | A5 - F#5 - G5 - - - | G5 - Bb5 - Eb6 - D6 - | C6 - A5 - F#5 - D5 -",
      bass: "@r - - - - - - - | r - - - r - - - | r - - - - - - - | r - - - r - - -",
      drums: { tim: "x.......x.......", c: "!x" },
    },
    fill: { tim: "x.x.x.x.xxxxxxxx", s: "........xxxxXXXX", up: "x---------------" },
  },
};

export const bossAcademy: SongDef = {
  bpm: 136,
  layered: true,
  vol: 0.95,
  key: "G minor",
  delayBeats: 0.5,
  channels: [
    { id: "bass", inst: "bassSaw", vol: 0.55, center: 38, voicing: "root" },
    { id: "str", inst: "tremStr", vol: 1.7, center: 62, rev: 0.45 },
    { id: "piano", inst: "piano", vol: 1.3, center: 56, rev: 0.2, pan: -0.15 },
    { id: "chime", inst: "synthBell", vol: 1.5, rev: 0.45, dly: 0.25, pan: 0.15 },
    { id: "lead", inst: "leadSaw", vol: 2.1, rev: 0.25, dly: 0.15 },
    { id: "drums", inst: "drums", vol: 0.75 },
    { id: "arp", inst: "synthBell", vol: 0.8, center: 86, layer: 0.6, dly: 0.25, rev: 0.25, pan: 0.3 },
    { id: "choir", inst: "choir", vol: 1.2, center: 66, layer: 0.8, rev: 0.5, pan: -0.1 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "brk", "A", "C"],
  loopTo: 1,
};
