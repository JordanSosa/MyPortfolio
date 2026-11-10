/**
 * "Lunatic Moon Overture" - final boss (Lady Lunatic). 180 bpm, C minor,
 * strings + choir + saw lead, double-time drums, a descending "moon" bell motif
 * in the breakdown. Original composition.
 * intro(4) A(8) B(8) C(8) D(8) B(8) C(8) -> loop to A
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const BLAST: DrumPat = {
  k: "x.x.x.x.x.x.x.x.",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const ANTHEM: DrumPat = {
  k: "x...x...x...x.x.",
  s: "....x.......x...",
  cl: "....x.......x...",
  o: "..x...x...x...x.",
  h: "x...x...x...x...",
  c: "!x",
};
const FILL: DrumPat = { k: "x.......x.......", s: "....x...xxxxXXXX", th: "x.x.", tm: "..x.x..." };

const B_PARTS = {
  bass: "@r r r r r r r r",
  str: "@x - - - - - - -",
  choir: "@x - - - - - - -",
  arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
  lead:
    "Eb6 - - C6 - Ab5 - C6 | D6 - - Bb5 - F5 - Bb5 | D6 - - Bb5 - G5 - Bb5 | C6 - - - - - G5 C6 |" +
    "F6 - - Eb6 - C6 - Ab5 | D6 - - C6 - Bb5 - D6 | Eb6 - - - G6 - F6 Eb6 | D6 - - - B5 - - - |",
  drums: ANTHEM,
};
const C_PARTS = {
  bass: "@r r r' r r r r' r",
  str: "@x - - - x - - -",
  choir: "@x - - - - - - -",
  arp: "@0 1 2 3 4 5 4 3 2 3 4 5 4 3 2 1",
  bell: "@. 3 . 4 . 5 . 4",
  lead:
    "C6 - Eb6 - Ab6 - G6 F6 | F6 - - - D6 - Bb5 - | G6 - - - Eb6 - C6 - | Eb6 - D6 - C6 - G5 - |" +
    "Ab5 - C6 - Eb6 - Ab6 - | F6 - G6 - F6 - D6 Bb5 | B5 - - - D6 - F6 - | G6 - - - - - - - |",
  drums: BLAST,
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Cm | Ab | Bb | G",
    parts: {
      bass: "@r - - - - - - -",
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      lead: "G5 - - - | Ab5 - - - | Bb5 - - - | B5 - - - ",
      drums: { tl: "x..x..x.x..x..x.", k: "x.......x.......", c: "!x" },
    },
    fill: { tl: "x.x.x.x.", tm: ".x.x.x.x", s: "........xxxxXXXX", up: "x---------------" },
  },
  A: {
    bars: 8,
    chords: "Cm | Ab | Eb | Bb | Fm | G | Cm | G",
    parts: {
      bass: "@r r r r r r r r",
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead:
        "G5 - C6 - Eb6 - D6 C6 | C6 - - - Ab5 - C6 Eb6 | Bb5 - - - G5 - Eb5 G5 | F5 - - - D5 - F5 Bb5 |" +
        "Ab5 - - G5 F5 - C5 F5 | B5 - - - D6 - G5 B5 | C6 - - - Eb6 - D6 C6 | B5 - - - - - G5 - |",
      drums: BLAST,
    },
    fill: FILL,
  },
  B: { bars: 8, chords: "Ab | Bb | Gm | Cm | Fm | Bb | Eb | G", parts: B_PARTS, fill: FILL },
  C: { bars: 8, chords: "Ab | Bb | Cm | Cm | Ab | Bb | G | G", parts: C_PARTS, fill: { ...FILL, up: "x---------------" } },
  D: {
    bars: 8,
    chords: "Cm | Db | Cm | Db | Ab | G | Ab | G",
    parts: {
      bass: "@r - - - - - r' - | r - - - - - r - ",
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      arp: "@0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      bell: "G6 | Ab6 | G6 | F6 | Eb6 | D6 | C6 | B5",
      drums: { k: "x.........x.....", s: "........x.......", h: "x.x.x.x.x.x.x.x.", tl: "..............x.", c: "!x" },
    },
    fill: { k: "x.x.x.x.x.x.x.x.", s: "x.x.x.x.xxxxXXXX", th: "x.x.", up: "x---------------" },
  },
};

export const final: SongDef = {
  bpm: 180,
  vol: 0.85,
  delayBeats: 0.5,
  channels: [
    { id: "bass", inst: "bassSaw", vol: 0.53, center: 41, voicing: "root" },
    { id: "str", inst: "strings", vol: 1.5, center: 62, rev: 0.4 },
    { id: "choir", inst: "choir", vol: 1.45, center: 67, rev: 0.5, pan: 0.1 },
    { id: "arp", inst: "arp", vol: 2.35, center: 79, dly: 0.25, pan: 0.3 },
    { id: "lead", inst: "leadSaw", vol: 2.4, rev: 0.25, dly: 0.15 },
    { id: "bell", inst: "bell", vol: 1.1, center: 88, rev: 0.4, dly: 0.3, pan: -0.3 },
    { id: "drums", inst: "drums", vol: 0.75 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "D", "B", "C"],
  loopTo: 1,
};
