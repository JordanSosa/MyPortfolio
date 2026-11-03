/**
 * "Seashell Summer (Crabs Only)" - Beach Episode battle theme. 128 bpm (StageDef.bpm),
 * E major sunny surf-pop: clean guitar picking, a steel-pan lead, shaker + tambourine
 * surf beat, a whistly flute counter-line, and the surf-rock bVII (D) in the
 * pre-chorus. Original composition.
 * intro(4) A(8) B(8) C(8) A(8) B(8) C(8) D(8) C(8) -> loop to A
 * Intensity layers: 0 bass + guitar + pad | 0.3 drums | 0.6 steel lead | 0.8 bell sparkles | 0.9 flute counter
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const SURF: DrumPat = {
  k: "x......x..x.....",
  s: "....x.......x...",
  shk: "x.x.x.x.x.x.x.x.",
  tamb: "....x.......x...",
  c: "!x",
};
const SURF_FILL: DrumPat = { k: "x......x..x.....", s: "....x.......x.x.", tm: "........x.x.....", tl: "............x.x.", shk: "x.x.x.x.x.x.x.x." };
const SUN: DrumPat = {
  k: "x...x...x...x...",
  s: "....x.......x...",
  cl: "....x.......x...",
  shk: "xxxxxxxxxxxxxxxx",
  o: "..x...x...x...x.",
  c: "!x",
};

const PICK = "@0 2 1 2 0 2 1 2";

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "E | E | A | B",
    parts: {
      gtr: PICK,
      bass: "@. | . | r - - r - - r - | r - - r - - r -",
      pad: "@x - - - - - - -",
      drums: { shk: "x.x.x.x.x.x.x.x.", tamb: ". | ....x.......x...", s: ". | . | . | ........x.x.x.xx" },
    },
  },
  A: {
    bars: 8,
    chords: "E | B | C#m | A | E | B | A | B",
    parts: {
      bass: "@r - - r - - r 2",
      gtr: PICK,
      pad: "@x - - - - - - -",
      bell: "@. . 3 . . . 4 . | . . 2 . . . 3 .",
      lead:
        "G#5 . B5 . E6 - D#6 B5 | B5 - - F#5 - - D#5 F#5 | E5 . G#5 . C#6 - B5 G#5 | A5 - - - E5 - - . |" +
        "G#5 . B5 . E6 - F#6 G#6 | F#6 - - D#6 - - B5 - | C#6 - - B5 A5 - E5 - | F#5 - - - B5 - - - |",
      drums: SURF,
    },
    fill: SURF_FILL,
  },
  B: {
    bars: 8,
    chords: "A | B | G#m | C#m | F#m | B | D | B7",
    parts: {
      bass: "@r - - r - - r -",
      gtr: "@0 1 2 1 0 1 2 1",
      pad: "@x - - - - - - -",
      bell: "@0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3",
      lead:
        "C#6 - - B5 A5 - - - | B5 - - A5 F#5 - - - | B5 - - - D#6 - - - | C#6 - - - E6 - - - |" +
        "A5 - - C#6 - - F#6 - | D#6 - - - B5 - - - | F#6 - - E6 D6 - - - | D#6 - - - B5 - - - |",
      flute: "E5 - - - - - - - | F#5 - - - - - - - | D#5 - - - - - - - | E5 - - - - - - - | C#5 - - - - - - - | D#5 - - - - - - - | D5 - - - - - - - | D#5 - - - - - - - |",
      drums: SURF,
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
  },
  C: {
    bars: 8,
    chords: "E | G#m | A | B | E | G#m | A B | E",
    parts: {
      bass: "@r - r r' - r 2 -",
      gtr: "@0 2 1 2 3 2 1 2",
      pad: "@x - - - - - - -",
      bell: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead:
        "E6 - - B5 - - G#5 B5 | D#6 - - B5 - - G#5 B5 | C#6 - - A5 - - E5 A5 | B5 - - - - - C#6 D#6 |" +
        "E6 - - B5 - - G#6 - | D#6 - - B5 - - G#5 - | C#6 - B5 A5 B5 - D#6 - | E6 - - - - - . . |",
      flute:
        "G#5 - - - B5 - - - | G#5 - - - D#5 - - - | A5 - - - E5 - - - | F#5 - - - D#5 - - - |" +
        "G#5 - - - B5 - - - | B5 - - - G#5 - - - | A5 - - - F#5 - - - | G#5 - - - - - - - |",
      drums: SUN,
    },
    fill: SURF_FILL,
  },
  D: {
    bars: 8,
    chords: "C#m | A | E | B | C#m | A | D | B",
    parts: {
      bass: "@r - - - r - - -",
      gtr: "@0 1 2 3 2 1 0 1",
      pad: "@x - - - - - - -",
      lead:
        "G#5 - - - C#6 - - - | E6 - - C#6 - - A5 - | G#5 - - - B5 - - - | F#5 - - - B5 - - - |" +
        "E6 - - - G#6 - - - | E6 - - - C#6 - - - | F#6 - - - D6 - - - | D#6 - - - F#6 - - - |",
      drums: { k: "x.......x.......", s: "....x.......x...", shk: "x.x.x.x.x.x.x.x.", c: "!x" },
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", th: "x...", up: "x---------------" },
  },
};

export const beach: SongDef = {
  bpm: 128,
  layered: true,
  vol: 1.2,
  key: "E major",
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bass", vol: 0.62, center: 40, voicing: "root" },
    { id: "gtr", inst: "guitar", vol: 1.9, center: 62, rev: 0.25, dly: 0.12, pan: -0.2 },
    { id: "pad", inst: "padSoft", vol: 0.35, center: 60, rev: 0.5 },
    { id: "drums", inst: "drums", vol: 0.78, layer: 0.3 },
    { id: "lead", inst: "steel", vol: 1.7, layer: 0.6, rev: 0.3, dly: 0.2, pan: 0.1 },
    { id: "bell", inst: "bell", vol: 0.9, center: 86, layer: 0.8, rev: 0.3, dly: 0.28, pan: 0.3 },
    { id: "flute", inst: "flute", vol: 1.0, layer: 0.9, rev: 0.35, pan: -0.25 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "A", "B", "C", "D", "C"],
  loopTo: 1,
};
