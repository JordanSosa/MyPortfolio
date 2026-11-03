/**
 * "Home Base Hangout" - the Season 2 hub (main menu). 104 bpm swung, A major,
 * cosy city-pop slice-of-life: plucked bass, e-piano 3-3-2 comping, a brushed
 * groove and a whistly flute hook ("A . F# A C# - B A") that Cancel-sama steals
 * for the series finale (cancel.ts). Original composition.
 * intro(2) A(8) B(8) A2(8) B(8) C(8, bridge with borrowed bVI / iv6) -> loop to A
 * Not layered: menus never set the intensity, so a stale value must not strip it.
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

/** The hub verse / chorus (also played by Cancel-sama's hold-music organ). */
export const HUB_CHORDS_A = "Dmaj7 | C#m7 | Bm7 | E7sus4 E7 | Amaj7 | F#m7 | Bm7 | E7";
export const HUB_LEAD_A =
  "A5 . F#5 A5 C#6 - B5 A5 | G#5 - - E5 . . F#5 G#5 | F#5 . D5 F#5 A5 - G#5 F#5 | E5 - - - . E5 F#5 G#5 |" +
  "A5 . E5 A5 C#6 - B5 A5 | C#6 - - A5 . . B5 C#6 | D6 . C#6 B5 A5 - F#5 A5 | G#5 - - - E5 - - - |";
export const HUB_CHORDS_B = "Bm7 | C#m7 | Dmaj7 | E | C#m7 | F#m7 | Bm7 E7 | Amaj7";
export const HUB_LEAD_B =
  "D6 - C#6 D6 - - F#6 - | E6 - C#6 E6 - - G#6 - | F#6 - E6 C#6 - A5 - F#5 | G#5 - - - B5 - - - |" +
  "E6 - C#6 E6 - - G#6 - | A6 - G#6 F#6 - E6 - C#6 | D6 - C#6 B5 - - G#5 - | A5 - - - - - . . |";

const GROOVE: DrumPat = {
  k: "x.......x.x.....",
  rim: "....x.......x...",
  shk: "x.x.x.x.x.x.x.x.",
  sn: "..............o.",
  c: "!x",
};
const GROOVE_FILL: DrumPat = { k: "x.......x.......", rim: "....x.......x...", sn: "........x.x.xoxx", shk: "x.x.x.x.x.x.x.x." };
const LIFT: DrumPat = {
  k: "x...x...x...x...",
  rim: "....x.......x...",
  h: "..x...x...x...x.",
  shk: "xxxxxxxxxxxxxxxx",
  tamb: "....x.......x...",
  c: "!x",
};
const LIFT_FILL: DrumPat = { k: "x...x...x...x...", rim: "....x.......x...", sn: "........x.x.x.xx", tm: "............x...", tl: "..............x." };

const COMP = "@x - . x - . x -";
const BASS = "@r - . r' . r 2 .";

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 2,
    chords: "Dmaj7 | E7",
    parts: {
      keys: COMP,
      pad: "@x - - - - - - -",
      bell: "A5 . F#5 A5 C#6 - B5 A5 | G#5 - - - . . . .",
      bass: "@r - - - - - - - | r - - - r - - -",
      drums: { shk: "x.x.x.x.x.x.x.x.", rim: ". | ....x.......x.", sn: ". | ........x.x.xoxx" },
    },
  },
  A: {
    bars: 8,
    chords: HUB_CHORDS_A,
    parts: {
      bass: BASS,
      keys: COMP,
      pad: "@x - - - - - - -",
      bell: "@. . . . . . 3 . | . . . . . . 2 .",
      lead: HUB_LEAD_A,
      drums: GROOVE,
    },
    fill: GROOVE_FILL,
  },
  A2: {
    bars: 8,
    chords: HUB_CHORDS_A,
    parts: {
      bass: BASS,
      keys: COMP,
      pad: "@x - - - - - - -",
      bell: "@. 3 . . . 4 . . | . 2 . . . 3 . .",
      lead:
        "A5 . F#5 A5 C#6 - B5 A5 | G#5 - - E5 . . F#5 G#5 | F#5 . D5 F#5 A5 - G#5 F#5 | E5 - - - . E5 F#5 G#5 |" +
        "A5 . C#6 E6 A6 - G#6 E6 | F#6 - - C#6 . . E6 F#6 | D6 . F#6 . A6 - F#6 D6 | E6 - - - D6 - B5 G#5 |",
      drums: GROOVE,
    },
    fill: GROOVE_FILL,
  },
  B: {
    bars: 8,
    chords: HUB_CHORDS_B,
    parts: {
      bass: "@r - . r r' . r 2",
      keys: "@x - . x - . x x",
      pad: "@x - - - - - - -",
      bell: "@. 3 . 2 . 3 . 4",
      lead: HUB_LEAD_B,
      drums: LIFT,
    },
    fill: LIFT_FILL,
  },
  C: {
    bars: 8,
    chords: "Fmaj7 | E7sus4 E7 | Dmaj7 | C#7 | F#m7 | Bm7 | Dm6 | E7sus4 E7",
    parts: {
      bass: "@r - - - 2 - - - | r - - - r - - -",
      keys: "@x - - - x - - -",
      pad: "@x - - - - - - -",
      bell: "@2 . 3 . 4 . 3 . | 1 . 2 . 3 . . .",
      lead:
        "A5 - - C6 - - E6 - | D6 - - - B5 - G#5 - | F#5 - A5 - C#6 - E6 - | G#5 - - F5 - - C#5 - |" +
        "A5 - - C#6 - - E6 - | D6 - C#6 B5 - - A5 - | F5 - - A5 - - B5 - | E5 - - - G#5 - B5 - |",
      drums: { k: "x.......x.......", rim: "....x.......x...", shk: "x.x.x.x.x.x.x.x.", c: "!x" },
    },
    fill: { k: "x.......x.......", rim: "....x.......x...", sn: "........x.x.x.xx", up: "........x-------" },
  },
};

export const hub: SongDef = {
  bpm: 104,
  swing: 0.12,
  vol: 1.3,
  key: "A major",
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bassPluck", vol: 0.55, center: 42, voicing: "root" },
    { id: "keys", inst: "ep", vol: 1.05, center: 64, rev: 0.3, dly: 0.1, pan: -0.15 },
    { id: "pad", inst: "padSoft", vol: 0.3, center: 60, rev: 0.5 },
    { id: "bell", inst: "musicbox", vol: 1.1, center: 84, rev: 0.4, dly: 0.3, pan: 0.3 },
    { id: "lead", inst: "flute", vol: 1.25, rev: 0.35, dly: 0.18 },
    { id: "drums", inst: "drums", vol: 0.62 },
  ],
  sections,
  order: ["intro", "A", "B", "A2", "B", "C"],
  loopTo: 1,
};
