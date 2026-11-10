/**
 * "Summoning Circle (Terms Apply)" - the Merch Machine. 120 bpm, F# minor.
 * A heartbeat kick and a ticking clock under a line-cliché pedal
 * (F#m - F#mM7 - F#m7 - F#m6) on a music box, then the bass climbs B - C# - D - E
 * with tremolo strings and 16th arps into "the pull" (choir, full kit, C#7).
 * Original composition. intro(2) A(8) B(8) C(4) -> loop to A
 *
 * `gacha_mythic` (gacha.md MYTHIC beat 6): a 4-bar rainbow fanfare in the relative
 * major (F - G - A, the bVI - bVII - I "this is the best day of your life" cadence),
 * then straight back into the same tense loop. The cycle continues.
 * Not layered (menu music).
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const CLOCK: DrumPat = {
  k: "x..x............",
  wb: "x...x...x...x...",
  rim: "..x...x...x...x.",
  c: "!x",
};
const BUILD: DrumPat = {
  k: "x..x....x..x....",
  wb: "x...x...x...x...",
  rim: "..x...x...x...x.",
  sn: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const PULL: DrumPat = {
  k: "x...x...x...x...",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  o: "..............x.",
  c: "!x",
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 2,
    chords: "F#m | C#7",
    parts: {
      bass: "@r - - - - - - - | r - - - - - - -",
      str: "@x - - - - - - -",
      box: ". | . . . . G#5 - B5 C#6",
      drums: { k: "x..x............", wb: "x...x...x...x...", rim: ". | ..x...x...x.xxx" },
    },
  },
  A: {
    bars: 8,
    chords: "F#m | F#mM7 | F#m7 | F#m6 | Dmaj7 | Bm7 | C#7sus4 | C#7",
    parts: {
      bass: "@r . r . r . r .",
      str: "@x - - - - - - -",
      box:
        "F#6 - - - C#6 - A5 - | F6 - - - C#6 - A5 - | E6 - - - C#6 - A5 - | D#6 - - - C#6 - A5 - |" +
        "F#6 - - - D6 - A5 - | D6 - - - B5 - F#5 - | G#5 - - - B5 - F#5 - | F6 - - - G#5 - B5 C#6 |",
      drums: CLOCK,
    },
    fill: { k: "x..x............", wb: "x...x...x...x...", rim: "..x...x...xxxxxx" },
  },
  B: {
    bars: 8,
    chords: "Bm | C#m | D | E | Bm | C#m | D E | C#7",
    parts: {
      bass: "@r r r r r r r r",
      str: "@x - - - - - - -",
      arp: "@0 1 2 3 0 1 2 3 0 1 2 3 0 1 2 3",
      lead:
        "B5 - C#6 D6 - - F#6 - | C#6 - D#6 E6 - - G#6 - | D6 - E6 F#6 - - A6 - | E6 - F#6 G#6 - - B6 - |" +
        "F#6 - - - D6 - B5 - | G#6 - - - E6 - C#6 - | A6 - F#6 - B6 - G#6 - | G#6 - - - F6 - - - |",
      drums: BUILD,
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
  },
  C: {
    bars: 4,
    chords: "F#m | D | E | C#7",
    parts: {
      bass: "@r r r' r r r r' r",
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead: "F#6 - - - - - E6 F#6 | A6 - - - F#6 - - - | G#6 - - - B6 - - - | F6 - - - G#6 - - - |",
      drums: PULL,
    },
    fill: { k: "x...x...x...x...", s: "....x...x.x.xxxx", th: "........x.x.....", tm: "............x.x." },
  },
  mythic: {
    bars: 4,
    chords: "F | G | A | A",
    parts: {
      bass: "@r - - - r' - - - | r - - - r' - - - | r - - - - - - - | r - - - - - - -",
      str: "@x - - - - - - -",
      choir: "@x - - - - - - -",
      brass: "A5 - C6 - F6 - - - | B5 - D6 - G6 - - - | C#6 - - - E6 - - - | A6 - - - - - - -",
      lead: ". | . | A5 C#6 E6 A6 C#7 - - - | . ",
      drums: {
        k: "x...x...x...x... | x...x...x...x... | x | .",
        s: "x.x.x.x.x.x.xxxx | x.x.x.x.xxxxXXXX | . | .",
        tim: "x...x... | x...x... | x | x",
        c: ". | . | x | .",
      },
    },
  },
};

const channels: SongDef["channels"] = [
  { id: "bass", inst: "bass", vol: 0.6, center: 42, voicing: "root" },
  { id: "str", inst: "tremStr", vol: 1.5, center: 60, rev: 0.4 },
  { id: "choir", inst: "choir", vol: 1.2, center: 66, rev: 0.5, pan: 0.1 },
  { id: "arp", inst: "arpSq", vol: 1.6, center: 78, dly: 0.25, pan: 0.25 },
  { id: "box", inst: "musicbox", vol: 2.0, rev: 0.45, dly: 0.3, pan: -0.15 },
  { id: "lead", inst: "bell", vol: 1.5, rev: 0.4, dly: 0.25, pan: -0.1 },
  { id: "brass", inst: "brass", vol: 2.0, rev: 0.35 },
  { id: "drums", inst: "drums", vol: 0.68 },
];

export const gacha: SongDef = {
  bpm: 120,
  vol: 1.1,
  key: "F# minor",
  delayBeats: 0.75,
  channels,
  sections,
  order: ["intro", "A", "B", "C"],
  loopTo: 1,
};

export const gachaMythic: SongDef = {
  ...gacha,
  key: "A major -> F# minor",
  order: ["mythic", "A", "B", "C"],
  loopTo: 1,
};
