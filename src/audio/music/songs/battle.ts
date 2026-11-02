/**
 * "Overdrive Starlight" - battle theme. 150 bpm, A major / F# minor, J-pop chiptune.
 * Original composition. Arrangement:
 *   intro(4) A(8) B(8) C(8) D(8) A2(8) B(8) C(8) E(8, key change +2) turn(2) -> loop to A
 * Intensity layers: 0 bass + pad + stabs | 0.35 + drums | 0.65 + arps | 0.9 + lead + bell
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const ROCK: DrumPat = {
  k: "x.....x.x.....x. | x.....x.x.x.....",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const ROCK_FILL: DrumPat = { k: "x.......x.......", s: "....x.x.x.x.....", th: "............x.x.", tm: ".............x.x" };

const FOUR: DrumPat = {
  k: "x...x...x...x...",
  cl: "....x.......x...",
  s: "....x.......x...",
  h: "x...x...x...x...",
  o: "..x...x...x...x.",
  shk: "xxxxxxxxxxxxxxxx",
  c: "!x",
};
const FOUR_FILL: DrumPat = { k: "x...x...x...x...", cl: "....x.......x...", s: "....x.......x.xx", o: "..x...x...x.....", th: "..............x." };

const CHORUS_PARTS = {
  bass: "@r r' r r' r r' r r'",
  stab: "@x . . x . . x .",
  pad: "@x - - - - - - -",
  arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
  bell: "@. 3 . 4 . 5 . 4",
  lead:
    "A5 - F#5 A5 - B5 A5 - | G#5 - E5 G#5 - B5 C#6 - | C#6 - - B5 - G#5 - E5 | F#5 - - - - - E5 F#5 |" +
    "A5 - F#5 A5 - B5 A5 - | G#5 - E5 G#5 - B5 E6 - | E6 - C#6 - - - A5 B5 | C#6 - - - - - . . |",
  drums: FOUR,
};

const VERSE_LEAD_1 = "C#5 - E5 F#5 - A5 F#5 E5 | F#5 - - E5 D5 - C#5 D5 | E5 - C#5 - A4 - B4 C#5 | B4 - - - - . G#4 B4 |";

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "D | E | D | E",
    parts: {
      bass: "@r r r r r r r r",
      stab: "@x . . x . . x .",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead: ". | . | A5 - F#5 A5 - B5 A5 - | G#5 - E5 G#5 - B5 C#6 - ",
      drums: { k: "x...x...x...x...", h: "..x...x...x...x.", c: "!x" },
    },
    fill: { k: "x...x...x.x.x.x.", s: "....x...x.x.xxxx", up: "x---------------" },
  },
  A: {
    bars: 8,
    chords: "F#m | D | A | E | F#m | D | Bm | E",
    parts: {
      bass: "@r r r r' r r r r'",
      stab: "@x . . x . . x .",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 3 1 2 3 4 0 1 2 3 1 2 3 4",
      lead: VERSE_LEAD_1 + "C#5 - E5 F#5 - A5 B5 A5 | F#5 - A5 - D6 - C#6 B5 | B5 - A5 F#5 - D5 E5 F#5 | E5 - - - G#5 - B5 - |",
      drums: ROCK,
    },
    fill: ROCK_FILL,
  },
  A2: {
    bars: 8,
    chords: "F#m | D | A | E | F#m | D | Bm | E",
    parts: {
      bass: "@r r r r' r r r r'",
      stab: "@. x . x . x . x",
      pad: "@x - - - - - - -",
      arp: "@3 2 1 0 2 1 0 1 3 2 1 0 2 1 0 1",
      lead: VERSE_LEAD_1 + "C#5 - E5 F#5 - A5 C#6 B5 | A5 - F#5 - D5 - E5 F#5 | D5 - F#5 B5 - A5 F#5 D5 | E5 - - - . . . . |",
      bell: ". | . | . | . . . . B5 C#6 E6 G#6 | . | . | . | . . . . G#5 B5 E6 G#6",
      drums: ROCK,
    },
    fill: ROCK_FILL,
  },
  B: {
    bars: 8,
    chords: "D | E | C#m | F#m | Bm | C#m | D | Esus4 E",
    parts: {
      bass: "@r r r r r r r r",
      stab: "@x . x . x . x .",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 0 1 2 0 1 2 3 2 3 4 3 4 5",
      lead:
        "F#5 . F#5 E5 . D5 E5 F#5 | G#5 . G#5 F#5 . E5 F#5 G#5 | E5 - - C#5 - - E5 G#5 | A5 - - - F#5 - E5 - |" +
        "D5 . D5 C#5 . B4 C#5 D5 | E5 . E5 F#5 . G#5 F#5 E5 | F#5 - A5 - D6 - C#6 - | B5 - - - - - - - |",
      drums: {
        k: "x...x...x...x...",
        s: "....x.......x... | % | % | % | % | % | x...x...x.x.x.x. | .",
        h: "x.x.x.x.x.x.x.x.",
      },
    },
    fill: { k: "x...x...x...x...", s: "xxxxxxxxXXXXXXXX", up: "x---------------" },
  },
  C: { bars: 8, chords: "D | E | C#m | F#m | Bm | E | A | A7", parts: CHORUS_PARTS, fill: FOUR_FILL },
  D: {
    bars: 8,
    chords: "Bm | C#m | D | E | Bm | C#m | Dmaj7 | E",
    parts: {
      bass: "@r - - r' - - r -",
      pad: "@x - - - - - - -",
      arp: "@0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      bell: "@. . 4 . . . 3 .",
      lead: "F#5 - - - | G#5 - E5 - | A5 - - F#5 | B5 - - - | D6 - C#6 B5 | C#6 - - G#5 | A5 - C#6 - | B5 - - - ",
      drums: { k: "x.........x.....", s: "........x.......", h: "x.x.x.x.x.x.x.x.", c: "!x" },
    },
    fill: { k: "x.......x.x.x.x.", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
  },
  // final chorus, a whole step up (J-pop key change)
  E: { bars: 8, chords: "D | E | C#m | F#m | Bm | E | A | A7", tr: 2, parts: CHORUS_PARTS, fill: FOUR_FILL },
  turn: {
    bars: 2,
    chords: "G | A",
    parts: {
      bass: "@r r r r r r r r",
      stab: "@x . x . x . x x",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 3 4 5 4 3 2 1 0 1 2 3 4 5",
      lead: "D6 - - - - - - - | E6 - - - - - - -",
      drums: { k: "x...x...x...x...", s: "....x.......x..." },
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", th: "....x...", up: "x---------------" },
  },
};

export const battle: SongDef = {
  bpm: 150,
  layered: true,
  vol: 1.2,
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bass", vol: 0.62, center: 43, voicing: "root" },
    { id: "pad", inst: "pad", vol: 1.07, center: 62, rev: 0.35 },
    { id: "stab", inst: "stab", vol: 2.4, center: 66, rev: 0.2, dly: 0.12, pan: -0.15 },
    { id: "drums", inst: "drums", vol: 0.8, layer: 0.35 },
    { id: "arp", inst: "arp", vol: 2.4, center: 76, layer: 0.65, dly: 0.28, rev: 0.12, pan: 0.25 },
    { id: "lead", inst: "lead", vol: 0.9, layer: 0.9, rev: 0.22, dly: 0.18 },
    { id: "bell", inst: "bell", vol: 1.2, center: 84, layer: 0.9, rev: 0.3, dly: 0.25, pan: -0.3 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "D", "A2", "B", "C", "E", "turn"],
  loopTo: 1,
};
