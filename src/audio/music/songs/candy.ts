/**
 * "Sugar Rush Parade" - Candy Kingdom battle theme. 150 bpm (StageDef.bpm), C major,
 * a bouncy sugar-pop march: oom-pah bass, off-beat "pah" stabs, clap snares, a
 * glockenspiel hook ("C . C D E . C .") and a kazoo counter-melody. The bridge
 * crashes into F minor ("sugar crash"), the last chorus goes up a whole step.
 * Original composition. The boss theme (boss-candy.ts) is this melody in C minor.
 * intro(4) A(8) B(8) C(8) D(8) A(8) B(8) C2(8, +2) turn(2) -> loop to A
 * Intensity layers: 0 bass + stabs + pad | 0.3 drums | 0.6 glock lead | 0.8 16th glock arps | 0.9 kazoo
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

/** The candy hook (also in C minor for the Sugar Plum Tyrant). */
export const CANDY_LEAD_A =
  "C6 . C6 D6 E6 . C6 . | F6 . E6 D6 C6 . A5 . | B5 . B5 C6 D6 . G5 . | C6 - E6 - G6 - - . |" +
  "A5 . A5 B5 C6 . A5 . | F5 . A5 C6 F6 . E6 D6 | D6 . C6 . A5 . F#5 . | G5 - - - . G5 A5 B5 |";

const MARCH: DrumPat = {
  k: "x...x...x...x...",
  cl: "....x.......x...",
  s: "o.o...o.o.o...oo",
  h: "..x...x...x...x.",
  c: "!x",
};
const MARCH_FILL: DrumPat = { k: "x...x...x...x...", cl: "....x.......x...", s: "x.xxx.xxx.x.xxxx", th: "............x...", tm: "..............x." };
const CHORUS: DrumPat = {
  k: "x...x...x...x...",
  cl: "....x.......x...",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  tamb: "..x...x...x...x.",
  c: "!x",
};

const BASE = {
  bass: "@r . 2 . r . 2 .",
  stab: "@. x . x . x . x",
  pad: "@x - - - - - - -",
  arp: "@0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 1",
};

const CHORUS_PARTS = {
  ...BASE,
  bass: "@r . 2 . r' . 2 .",
  arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
  lead:
    "G6 - E6 - C6 - E6 G6 | G6 - D6 - B5 - D6 G6 | A6 - E6 - C6 - E6 A6 | G6 - - E6 - - B5 - |" +
    "A6 - F6 - C6 - F6 A6 | G6 - E6 - C6 - - - | F6 - E6 D6 - - B5 - | C6 - - - - - . . |",
  kazoo:
    "E5 - - - G5 - - - | D5 - - - G5 - - - | E5 - - - A5 - - - | B4 - - - E5 - - - |" +
    "C5 - - - F5 - - - | E5 - - - G5 - - - | F5 - - - D5 - - - | E5 - - - - - - - |",
  drums: CHORUS,
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "C | Am | F | G",
    parts: {
      bass: "@r . 2 . r . 2 .",
      stab: "@. x . x . x . x",
      pad: "@x - - - - - - -",
      lead: ". | . | A5 . A5 B5 C6 . A5 . | B5 - - - . G5 A5 B5",
      drums: { s: "x.x.x.x.x.x.x.x. | x.x.x.x.x.x.x.x. | x.x.x.x.xxxxxxxx | x.x.x.x.XXXXXXXX", k: "x.......x.......", c: "!x" },
    },
  },
  A: {
    bars: 8,
    chords: "C | F | G | C | Am | F | D7 | G",
    parts: { ...BASE, lead: CANDY_LEAD_A, drums: MARCH },
    fill: MARCH_FILL,
  },
  B: {
    bars: 8,
    chords: "F | G | Em | Am | F | G | C/E F | G7",
    parts: {
      ...BASE,
      bass: "@r . r . r . r .",
      lead:
        "A5 - - G5 F5 - G5 A5 | B5 - - A5 G5 - A5 B5 | G5 - - F#5 E5 - F#5 G5 | A5 - - - C6 - - - |" +
        "C6 - - B5 A5 - B5 C6 | D6 - - C6 B5 - C6 D6 | E6 - D6 C6 - - A5 - | B5 - - - D6 - F6 - |",
      kazoo: "C5 - - - - - - - | D5 - - - - - - - | B4 - - - - - - - | C5 - - - E5 - - - | A4 - - - - - - - | B4 - - - - - - - | C5 - - - A4 - - - | B4 - - - - - - - |",
      drums: MARCH,
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
  },
  C: { bars: 8, chords: "C | G | Am | Em | F | C | Dm G | C", parts: CHORUS_PARTS, fill: MARCH_FILL },
  C2: { bars: 8, chords: "C | G | Am | Em | F | C | Dm G | C", tr: 2, parts: CHORUS_PARTS, fill: MARCH_FILL },
  D: {
    bars: 8,
    chords: "Fm | C | Fm | C | Ab | Bb | G | G7",
    parts: {
      bass: "@r - - - r - - - | r - - - r - - -",
      stab: "@x - - . x - - .",
      pad: "@x - - - - - - -",
      lead:
        "Ab5 - - G5 F5 - - - | G5 - - - E5 - - - | C6 - - Bb5 Ab5 - - - | G5 - - - - - . . |" +
        "C6 - Eb6 - Ab6 - G6 F6 | F6 - D6 - Bb5 - C6 D6 | D6 - - - B5 - - - | F6 - - - D6 - B5 - |",
      drums: { k: "x.......x.......", cl: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", th: "x.x.....", up: "x---------------" },
  },
  turn: {
    bars: 2,
    chords: "F | G",
    parts: {
      bass: "@r r r r r r r r",
      stab: "@x . x . x . x x",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 3 4 5 4 3 2 1 0 1 2 3 4 5",
      lead: "A6 - - - - - - - | B6 - - - - - - -",
      drums: { k: "x...x...x...x...", cl: "....x.......x..." },
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", th: "....x...", up: "x---------------" },
  },
};

export const candy: SongDef = {
  bpm: 150,
  layered: true,
  vol: 1.15,
  key: "C major",
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bass", vol: 0.62, center: 41, voicing: "root" },
    { id: "pad", inst: "pad", vol: 0.8, center: 62, rev: 0.35 },
    { id: "stab", inst: "stab", vol: 2.3, center: 67, rev: 0.2, dly: 0.1, pan: -0.15 },
    { id: "drums", inst: "drums", vol: 0.8, layer: 0.3 },
    { id: "lead", inst: "glock", vol: 1.5, layer: 0.6, rev: 0.25, dly: 0.18, pan: 0.05 },
    { id: "arp", inst: "glock", vol: 0.9, center: 84, layer: 0.8, dly: 0.25, rev: 0.12, pan: 0.3 },
    { id: "kazoo", inst: "kazoo", vol: 1.5, layer: 0.9, rev: 0.2, pan: -0.25 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "D", "A", "B", "C2", "turn"],
  loopTo: 1,
};
