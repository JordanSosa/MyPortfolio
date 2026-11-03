/**
 * "Rival Battle: Shout Louder" - The Final Arc mid-boss theme (Truck-kun, Rival-chan).
 * 160 bpm (the stage tempo), B minor shounen-rival rock: a distorted "guitar"
 * lead, double-kick drums, galloping saw bass, string pads, and two-chord brass
 * "HONK-HONK" stabs (a truck-horn motif for Truck-kun) on the section downbeats;
 * the B section shouts over a bII (C) before the dominant. Original composition.
 * intro(4) A(8) B(8) C(8) A(8) C(8) -> loop to A
 * Intensity layers (boss >= 0.4): 0 bass + strings + lead + horns + drums | 0.6 arps | 0.8 choir
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const GALLOP = "@r . r r r . r r r . r r r . r r";
const DOUBLE: DrumPat = {
  k: "x.x.x.x.x.x.x.x.",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const DOUBLE_FILL: DrumPat = { k: "x.x.x.x.x.x.x.x.", s: "....x...x.x.xxxx", th: "x.x.....", tm: "....x.x.", tl: "........x.x.x.x." };
const SHOUT: DrumPat = {
  k: "x...x...x...x...",
  s: "x...x...x...x...",
  o: "..x...x...x...x.",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};

/** intensity >= 0.8: crash-ride 8ths, china-ish open hats, tom pickups */
const PERC: DrumPat = { o: "..x...x...x...x.", tamb: "x.x.x.x.x.x.x.x.", th: "............x...", tm: "..............x." };

const HONK = "@x x . . . . . . | . | . | . | x x . . . . . . | . | . | .";

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Bm | Bm | G | F#",
    parts: {
      bass: GALLOP,
      str: "@x - - - - - - -",
      horn: "@x x . . . . . . | x x . . . . . . | x x . . . . . . | x x . x x . x x",
      drums: { k: "x...x...x...x...", tl: "..x...x...x...x.", c: "!x" },
    },
    fill: { k: "x.x.x.x.x.x.x.x.", s: "....x...xxxxXXXX", th: "x.x.", up: "x---------------" },
  },
  A: {
    bars: 8,
    chords: "Bm | G | A | F# | Bm | G | Em | F#",
    parts: {
      bass: GALLOP,
      str: "@x - - - - - - -",
      horn: HONK,
      arp: "@0 1 2 3 1 2 3 4 0 1 2 3 1 2 3 4",
      lead:
        "F#5 F#5 B5 F#5 D6 - C#6 B5 | B5 - - G5 - - D5 G5 | C#6 - E6 - A6 - G6 F#6 | A#5 - - - C#6 - - - |" +
        "F#5 F#5 B5 F#5 D6 - E6 F#6 | G6 - - F#6 D6 - B5 - | E6 - - D6 B5 - G5 - | F#6 - - - - - . . |",
      drums: DOUBLE,
      perc: PERC,
    },
    fill: DOUBLE_FILL,
  },
  B: {
    bars: 8,
    chords: "G | A | F#m | Bm | G | A | C | F#",
    parts: {
      bass: "@r r r r r r r r",
      str: "@x - - - - - - -",
      horn: "@. | . | . | . | . | . | x - - - - - - - | x x . x x . x x",
      arp: "@0 1 2 0 1 2 0 1 2 3 2 3 4 3 4 5",
      lead:
        "D6 . D6 . B5 . D6 E6 | E6 . E6 . C#6 . E6 F#6 | F#6 - - E6 C#6 - - A5 | B5 - - - - - . . |" +
        "G6 . G6 . D6 . G6 A6 | A6 . A6 . E6 . A6 B6 | G6 - - - E6 - - C6 | F#6 - - - C#6 - A#5 - |",
      drums: SHOUT,
      perc: PERC,
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
  },
  C: {
    bars: 8,
    chords: "Bm | G | D | A | Bm | G | Em F# | Bm",
    parts: {
      bass: "@r r r' r r r r' r",
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      horn: HONK,
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead:
        "B5 - - - D6 - - - | D6 - - - G6 - - - | F#6 - - - D6 - E6 F#6 | E6 - - - C#6 - - - |" +
        "B5 - - - F#6 - - - | G6 - - - B6 - A6 G6 | G6 - F#6 E6 F#6 - C#6 - | B5 - - - - - - - |",
      drums: DOUBLE,
      perc: PERC,
    },
    fill: DOUBLE_FILL,
  },
};

export const bossFinale: SongDef = {
  bpm: 160,
  layered: true,
  vol: 0.9,
  key: "B minor",
  delayBeats: 0.5,
  channels: [
    { id: "bass", inst: "bassSaw", vol: 0.55, center: 41, voicing: "root" },
    { id: "str", inst: "strings", vol: 1.4, center: 62, rev: 0.4 },
    { id: "horn", inst: "brass", vol: 1.8, center: 64, rev: 0.2, pan: -0.15 },
    { id: "lead", inst: "leadDist", vol: 2.0, rev: 0.2, dly: 0.12 },
    { id: "drums", inst: "drums", vol: 0.75 },
    { id: "arp", inst: "arpSq", vol: 3.6, center: 76, layer: 0.6, dly: 0.25, pan: 0.25 },
    { id: "choir", inst: "choir", vol: 1.6, center: 66, layer: 0.8, rev: 0.5, pan: 0.1 },
    { id: "perc", inst: "drums", vol: 1.5, layer: 0.8 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "A", "C"],
  loopTo: 1,
};
