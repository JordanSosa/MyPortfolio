/**
 * "The Sugar Plum Tyrant's Parade" - Candy Kingdom boss theme (Gingerbread Golem,
 * Sugar Plum Tyrant). 150 bpm (the stage tempo), C minor: the Candy Kingdom hook
 * re-cut in harmonic minor over a tuba oom-pah, timpani and clap snares, a
 * Neapolitan Db in the B section, a menacing kazoo underneath. Villain-circus
 * energy. Original composition (the melody is candy.ts's, in minor).
 * intro(4) A(8) B(8) C(8) A2(8) C(8) -> loop to A
 * Intensity layers (a boss fight sits at >= 0.4): 0 tuba + stabs + choir + glock lead + drums | 0.6 glock arps | 0.8 kazoo + brass
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const OOMPAH: DrumPat = {
  k: "x...x...x...x...",
  cl: "....x.......x...",
  s: "..o...o...o..oo.",
  tim: "x.......x.......",
  h: "..x...x...x...x.",
  c: "!x",
};
const OOMPAH_FILL: DrumPat = { k: "x...x...x...x...", s: "x.xxx.xxx.x.xxxx", tim: "x.......x.x.x.x.", c: "x" };

const LEAD_A =
  "C6 . C6 D6 Eb6 . C6 . | F6 . Eb6 D6 C6 . Ab5 . | B5 . B5 C6 D6 . G5 . | C6 - Eb6 - G6 - - . |" +
  "Ab5 . Ab5 Bb5 C6 . Ab5 . | F5 . Ab5 C6 F6 . Eb6 D6 | D6 . C6 . Ab5 . F5 . | G5 - - - . G5 Ab5 B5 |";

const A_CHORDS = "Cm | Fm | G | Cm | Ab | Fm | Dm7b5 | G7";

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Cm | Cm | Ab | G7",
    parts: {
      tuba: "@r - 2 - r - 2 - | r - 2 - r - 2 - | r - 2 - r - 2 - | r r r r r r r r",
      choir: "@x - - - - - - -",
      brass: "@x . . x . . x . | . | x . . x . . x . | x - - - - - - -",
      drums: { tim: "x.......x.......| x.......x.......| x.......x.......| x.x.x.x.xxxxxxxx", s: ". | . | . | ........xxxxXXXX", c: "!x" },
    },
  },
  A: {
    bars: 8,
    chords: A_CHORDS,
    parts: {
      tuba: "@r . 2 . r . 2 .",
      stab: "@. x . x . x . x",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 1",
      lead: LEAD_A,
      drums: OOMPAH,
    },
    fill: OOMPAH_FILL,
  },
  A2: {
    bars: 8,
    chords: A_CHORDS,
    parts: {
      tuba: "@r . 2 . r' . 2 .",
      stab: "@. x . x . x x x",
      choir: "@x - - - - - - -",
      arp: "@3 2 1 0 3 2 1 0 4 3 2 1 4 3 2 1",
      lead: LEAD_A,
      kazoo:
        "G4 - - - C5 - - - | Ab4 - - - C5 - - - | G4 - - - B4 - - - | G4 - - - C5 - - - |" +
        "Ab4 - - - Eb5 - - - | Ab4 - - - F4 - - - | F4 - - - Ab4 - - - | G4 - - - B4 - - - |",
      drums: OOMPAH,
    },
    fill: OOMPAH_FILL,
  },
  B: {
    bars: 8,
    chords: "Ab | Bb | G | Cm | Ab | Bb | Db | G7",
    parts: {
      tuba: "@r - r - r - r -",
      stab: "@x . . x . . x .",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 0 1 2 0 1 2 3 2 3 4 3 4 5",
      lead:
        "Eb6 - - - C6 - - - | D6 - - - F6 - - - | B5 - - - D6 - - - | C6 - - - G5 - - - |" +
        "Ab6 - - G6 Eb6 - - - | F6 - - Eb6 D6 - - - | F6 - - - Db6 - - - | B5 - - - D6 - F6 - |",
      brass: "@x - - - - - - . | x - - - - - - . | x - - - x - - - | x - - - - - - - |",
      drums: { k: "x...x...x...x...", s: "....x.......x...", tim: "x...............", h: "x.x.x.x.x.x.x.x." },
    },
    fill: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", tim: "x...x...x.x.x.x.", up: "x---------------" },
  },
  C: {
    bars: 8,
    chords: "Cm | Ab | Eb | Bb | Fm | Cm | Dm7b5 G7 | Cm",
    parts: {
      tuba: "@r . 2 . r' . 2 .",
      stab: "@. x . x . x . x",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      lead:
        "G6 - - - Eb6 - - - | Ab6 - - - Eb6 - - - | G6 - - - Bb6 - - - | F6 - - - D6 - - - |" +
        "Ab6 - - - F6 - - - | G6 - - - Eb6 - - - | F6 - Eb6 D6 - - B5 - | C6 - - - - - - - |",
      kazoo:
        "C5 - - - Eb5 - - - | C5 - - - Eb5 - - - | Bb4 - - - G4 - - - | Bb4 - - - D5 - - - |" +
        "C5 - - - Ab4 - - - | C5 - - - G4 - - - | Ab4 - - - B4 - - - | C5 - - - - - - - |",
      brass: "@x - - - x - - - | x - - - x - - - | x - - - x - - - | x - - - x - - - | x - - - x - - - | x - - - x - - - | x - - - x - - - | x - - - - - - -",
      drums: { ...OOMPAH, s: "....x.......x...", o: "..x...x...x...x." },
    },
    fill: OOMPAH_FILL,
  },
};

export const bossCandy: SongDef = {
  bpm: 150,
  layered: true,
  vol: 1.0,
  key: "C minor",
  delayBeats: 0.5,
  channels: [
    { id: "tuba", inst: "tuba", vol: 0.95, center: 38, voicing: "root" },
    { id: "stab", inst: "stab", vol: 2.3, center: 64, rev: 0.15, pan: -0.15 },
    { id: "choir", inst: "choir", vol: 1.05, center: 62, rev: 0.45 },
    { id: "lead", inst: "glock", vol: 1.6, rev: 0.25, dly: 0.15, pan: 0.05 },
    { id: "drums", inst: "drums", vol: 0.78 },
    { id: "arp", inst: "glock", vol: 0.85, center: 84, layer: 0.6, dly: 0.22, rev: 0.12, pan: 0.3 },
    { id: "kazoo", inst: "kazoo", vol: 1.6, layer: 0.8, rev: 0.2, pan: -0.25 },
    { id: "brass", inst: "brass", vol: 1.1, center: 60, layer: 0.8, rev: 0.3, pan: 0.15 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "A2", "C"],
  loopTo: 1,
};
