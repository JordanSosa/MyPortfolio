/**
 * "Dreamland Sparkle" - title theme. 100 bpm, D major, dreamy and catchy.
 * Original composition. intro(4) A(8) B(8) A2(8) B(8) C(4) -> loop to A
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const GROOVE: DrumPat = {
  k: "x.......x.x.....",
  rim: "....x.......x...",
  shk: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const GROOVE_FILL: DrumPat = { k: "x.......x.......", rim: "....x.......x...", sn: "........x.x.x.xx", up: "........x-------" };
const CHORUS_DRUMS: DrumPat = {
  k: "x...x...x...x...",
  rim: "....x.......x...",
  sn: "....x.......x...",
  h: "..x...x...x...x.",
  shk: "xxxxxxxxxxxxxxxx",
  c: "!x",
};

const B_PARTS = {
  bass: "@r - - r - - r -",
  keys: "@x - x - x - x -",
  pad: "@x - - - - - - -",
  bell: "@0 1 2 3 4 3 2 1",
  lead:
    "B5 - - A5 B5 - D6 - | C#6 - - B5 A5 - E5 - | A5 - - F#5 A5 - C#6 - | B5 - - - - - A5 B5 |" +
    "D6 - - B5 - G5 B5 - | C#6 - - A5 - E5 F#5 G5 | F#5 - - - - - - - | . . . . . . . . |",
  drums: CHORUS_DRUMS,
};

const VERSE_A = "F#5 - A5 - C#6 - A5 - | B5 - - - A5 - F#5 - |";

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Dmaj7 | Gmaj7 | Dmaj7 | Gmaj7 A",
    parts: {
      pad: "@x - - - - - - -",
      bell: "@0 1 2 3 4 3 2 1",
      bass: "@. | . | r - - - - - - - | r - - - r - - -",
      drums: { shk: ". | . | . | x.x.x.x.x.x.x.x.", up: ". | . | . | ........x-------" },
    },
  },
  A: {
    bars: 8,
    chords: "Dmaj7 | Bm7 | Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 A7",
    parts: {
      bass: "@r - - . r - r' -",
      keys: "@x - - x - - x -",
      pad: "@x - - - - - - -",
      bell: "@. . 3 . . . 4 .",
      lead:
        VERSE_A +
        "G5 - B5 - D6 - B5 A5 | A5 - - - - - E5 F#5 |" +
        "A5 - C#6 - E6 - C#6 A5 | F#5 - - - D5 - E5 F#5 | G5 - F#5 - E5 - D5 - | E5 - - - - - . . |",
      drums: GROOVE,
    },
    fill: GROOVE_FILL,
  },
  A2: {
    bars: 8,
    chords: "Dmaj7 | Bm7 | Gmaj7 | A | F#m7 | Bm7 | Em7 | A7sus4 A7",
    parts: {
      bass: "@r - - . r - r' -",
      keys: "@x - - x - - x -",
      pad: "@x - - - - - - -",
      bell: "@. . . . 4 . 3 . | . . . . 5 . 4 .",
      lead:
        VERSE_A +
        "G5 - B5 - D6 - E6 D6 | C#6 - - - - - A5 B5 |" +
        "C#6 - - B5 A5 - E5 - | F#5 - - - A5 - B5 - | G5 - - - B5 - D6 - | E6 - - - C#6 - - - |",
      drums: GROOVE,
    },
    fill: GROOVE_FILL,
  },
  B: { bars: 8, chords: "Gmaj7 | A | F#m7 | Bm7 | Em7 | A | Dmaj7 | D6", parts: B_PARTS, fill: { ...CHORUS_DRUMS, c: undefined, sn: "....x.......x.xx" } },
  C: {
    bars: 4,
    chords: "Gmaj7 | F#m7 | Em7 | A7sus4 A7",
    parts: {
      pad: "@x - - - - - - -",
      keys: "@x - - - x - - -",
      bell: "@4 3 2 1 2 3 4 5",
      bass: "@r - - - - - - -",
      drums: { k: "x.......x.......", shk: "x.x.x.x.x.x.x.x.", up: ". | . | . | x---------------" },
    },
  },
};

export const title: SongDef = {
  bpm: 100,
  swing: 0.05,
  vol: 1.1,
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bassSoft", vol: 0.52, center: 43, voicing: "root" },
    { id: "pad", inst: "padSoft", vol: 0.4, center: 62, rev: 0.5 },
    { id: "keys", inst: "ep", vol: 0.95, center: 64, rev: 0.3, dly: 0.15, pan: -0.15 },
    { id: "bell", inst: "bell", vol: 1.13, center: 84, rev: 0.4, dly: 0.35, pan: 0.3 },
    { id: "lead", inst: "leadSoft", vol: 0.56, rev: 0.35, dly: 0.25 },
    { id: "drums", inst: "drums", vol: 0.75 },
  ],
  sections,
  order: ["intro", "A", "B", "A2", "B", "C"],
  loopTo: 1,
};
