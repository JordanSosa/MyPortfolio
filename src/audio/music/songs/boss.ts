/**
 * "Nightmare Parade" - boss theme. 168 bpm, E minor with harmonic-minor and
 * phrygian (F) colour, galloping bass, choir. Original composition.
 * intro(4) A(8) B(8) A2(8) C(8) B(8) -> loop to A
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const GALLOP = "@r . r r r . r r r . r r r . r r";

const DRIVE: DrumPat = {
  k: "x.x...x.x.x...x.",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const DRIVE_FILL: DrumPat = { k: "x.......x.......", s: "....x...x.x.xxxx", th: "x.x.....", tm: ".x.x...." };
const DOUBLE: DrumPat = {
  k: "x.x.x.x.x.x.x.x.",
  s: "....x.......x...",
  o: "..x...x...x...x.",
  h: "x...x...x...x...",
  c: "!x",
};

const B_PARTS = {
  bass: GALLOP,
  stab: "@x . . x . . x .",
  pad: "@x - - - - - - -",
  arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
  lead:
    "C6 - B5 A5 - E5 - A5 | B5 - - G5 - - E5 - | F5 - A5 - C6 - A5 - | F#5 - - - D#5 - B4 - |" +
    "E5 - A5 - C6 - B5 A5 | G5 - - - E5 - G5 B5 | C6 - - - B5 - A5 - | B5 - - - - - - - |",
  drums: DOUBLE,
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Em | Em | C | B",
    parts: {
      bass: GALLOP,
      pad: "@x - - - - - - -",
      arp: "@. | . | 0 1 2 3 2 1 0 1 2 3 4 3 2 1 0 1 | 0 1 2 3 2 1 0 1 2 3 4 3 2 1 0 1",
      drums: { tl: "x...x...x...x...", k: "x.......x.......", c: "!x" },
    },
    fill: { th: "x.x.x.x.", tm: ".x.x.x.x", s: "........xxxxXXXX", up: "x---------------" },
  },
  A: {
    bars: 8,
    chords: "Em | C | Am | B | Em | C | D | B7",
    parts: {
      bass: GALLOP,
      stab: "@x . x x . x x .",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3",
      lead:
        "B4 - E5 - G5 - F#5 E5 | G5 - - E5 - - C5 - | A4 - C5 - E5 - D5 C5 | D#5 - - - F#5 - B5 - |" +
        "B5 - - G5 - E5 - G5 | C6 - - B5 - G5 - E5 | F#5 - A5 - D6 - C6 - | B5 - - - A5 - F#5 D#5 |",
      drums: DRIVE,
    },
    fill: DRIVE_FILL,
  },
  A2: {
    bars: 8,
    chords: "Em | C | Am | B | Em | C | D | B7",
    parts: {
      bass: GALLOP,
      stab: "@x . . x . . x x",
      pad: "@x - - - - - - -",
      arp: "@3 2 1 0 3 2 1 0 4 3 2 1 4 3 2 1",
      lead:
        "E5 . E5 . G5 . E5 . B5 - - - A5 - G5 - | G5 - - E5 - - C6 - | A5 . A5 . C6 . A5 . E6 - - - D6 - C6 - | B5 - - - D#6 - F#6 - |" +
        "E6 - - - B5 - - - | C6 - - - G5 - E5 - | F#5 - A5 - D6 - F#6 - | F#6 - - - D#6 - B5 - |",
      drums: DRIVE,
    },
    fill: { k: "x...x...x...x...", s: "xxxxxxxxXXXXXXXX", up: "x---------------" },
  },
  B: { bars: 8, chords: "Am | Em | F | B | Am | Em | C | B7", parts: B_PARTS, fill: DRIVE_FILL },
  C: {
    bars: 8,
    chords: "Em | F | Em | F | C | D | B | B7",
    parts: {
      bass: "@r - - r - - r - r - - r - - r r",
      pad: "@x - - - - - - -",
      arp: "@0 1 2 3 4 5 4 3 2 3 4 5 4 3 2 1",
      lead:
        "B5 - - - - - - - | C6 - - - - - - - | B5 - - - G5 - E5 - | F5 - - - A5 - C6 - |" +
        "E6 - - - - - - - | F#6 - - - D6 - A5 - | B5 - - - - - - - | D#6 - - - B5 - F#5 - |",
      drums: {
        k: "x.........x.....",
        s: "........x.......",
        h: "xxxxxxxxxxxxxxxx",
        tl: "......x.......x.",
        c: "!x",
      },
    },
    fill: { k: "x.x.x.x.x.x.x.x.", s: "x.x.x.x.xxxxXXXX", th: "x...", up: "x---------------" },
  },
};

export const boss: SongDef = {
  bpm: 168,
  vol: 0.9,
  delayBeats: 0.5,
  channels: [
    { id: "bass", inst: "bassSaw", vol: 0.58, center: 40, voicing: "root" },
    { id: "pad", inst: "choir", vol: 1.08, center: 60, rev: 0.4 },
    { id: "stab", inst: "stab", vol: 2.5, center: 64, rev: 0.15, pan: -0.2 },
    { id: "arp", inst: "arpSq", vol: 1.9, center: 76, dly: 0.25, pan: 0.25 },
    { id: "lead", inst: "leadSaw", vol: 2.2, rev: 0.2, dly: 0.15 },
    { id: "drums", inst: "drums", vol: 0.73 },
  ],
  sections,
  order: ["intro", "A", "B", "A2", "C", "B"],
  loopTo: 1,
};
