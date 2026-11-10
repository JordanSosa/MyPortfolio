/**
 * "The Final Arc (Final) (Real) (v2)" - The Final Arc battle theme. 160 bpm
 * (StageDef.bpm), D minor rock-chiptune: driving saw bass 8ths, choir and string
 * pads, a saw lead, a Neapolitan (Eb) bridge. True to the genre it modulates up
 * a half step every 64 bars - D minor, Eb minor, E minor - each time through a
 * one-bar dominant "gear change", then sighs back down to D minor (the budget for
 * key changes ran out). ~5 minutes before it repeats exactly: the stage is 20.
 * Original composition.
 * intro(4) [A B C A2 B C D E(7) shift(1)] x3 keys -> loop to A
 * Intensity layers: 0 bass + strings + choir | 0.3 drums | 0.6 arps | 0.8 lead | 0.9 bells
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const DRIVE: DrumPat = {
  k: "x...x...x...x...",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  c: "!x",
};
const DRIVE_FILL: DrumPat = { k: "x...x...x...x...", s: "....x...x.x.xxxx", th: "........x.x.....", tm: "............x.x." };
const BLAST: DrumPat = {
  k: "x.x.x.x.x.x.x.x.",
  s: "....x.......x...",
  o: "..x...x...x...x.",
  h: "x...x...x...x...",
  c: "!x",
};

const PADS = { str: "@x - - - - - - -", choir: "@x - - - - - - -" };

const base: Record<string, SectionDef> = {
  A: {
    bars: 8,
    chords: "Dm | Bb | F | C | Dm | Bb | Gm | A",
    parts: {
      ...PADS,
      bass: "@r r r r r r r r",
      arp: "@0 1 2 3 1 2 3 4 0 1 2 3 1 2 3 4",
      lead:
        "A5 - D6 - F6 - E6 D6 | D6 - - - Bb5 - F5 - | C6 - - A5 - - F5 A5 | G5 - - - E5 - G5 - |" +
        "A5 - D6 - F6 - G6 F6 | F6 - - D6 - - Bb5 - | G5 - Bb5 - D6 - C6 Bb5 | C#6 - - - E6 - - - |",
      drums: DRIVE,
    },
    fill: DRIVE_FILL,
  },
  A2: {
    bars: 8,
    chords: "Dm | Bb | F | C | Dm | Bb | Gm | A",
    parts: {
      ...PADS,
      bass: "@r r r r' r r r r'",
      arp: "@3 2 1 0 3 2 1 0 4 3 2 1 4 3 2 1",
      bell: "@. . 3 . . . 4 .",
      lead:
        "D6 - F6 - A6 - G6 F6 | F6 - - D6 - - Bb5 - | A5 - C6 - F6 - E6 C6 | E6 - - - C6 - - - |" +
        "D6 - F6 - A6 - G6 F6 | Bb6 - - F6 - - D6 - | D6 - G6 - Bb6 - A6 G6 | A6 - - - - - . . |",
      drums: DRIVE,
    },
    fill: DRIVE_FILL,
  },
  B: {
    bars: 8,
    chords: "Bb | C | Am | Dm | Bb | C | Gm | A7",
    parts: {
      ...PADS,
      bass: "@r r r r r r r r",
      arp: "@0 1 2 0 1 2 0 1 2 3 2 3 4 3 4 5",
      lead:
        "D6 . D6 C6 . Bb5 C6 D6 | E6 . E6 D6 . C6 D6 E6 | C6 - - A5 - - E6 - | F6 - - - D6 - - - |" +
        "D6 . D6 C6 . Bb5 C6 D6 | G6 . G6 F6 . E6 F6 G6 | Bb6 - - G6 - - D6 - | A6 - - - E6 - C#6 - |",
      drums: { k: "x...x...x...x...", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
    },
    fill: { k: "x...x...x...x...", s: "xxxxxxxxXXXXXXXX", up: "x---------------" },
  },
  C: {
    bars: 8,
    chords: "Dm | F | C | Gm | Bb | F | Gm A | Dm",
    parts: {
      ...PADS,
      bass: "@r r r' r r r r' r",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      bell: "@. 3 . 4 . 5 . 4",
      lead:
        "F6 - - - - - E6 D6 | C6 - - - A5 - C6 - | E6 - - - G6 - - - | D6 - - - Bb5 - - - |" +
        "D6 - - - F6 - - - | A6 - - - F6 - E6 F6 | G6 - F6 E6 - - C#6 - | D6 - - - - - - - |",
      drums: BLAST,
    },
    fill: DRIVE_FILL,
  },
  D: {
    bars: 8,
    chords: "Gm | Dm | Bb | A | Gm | Dm | Eb | A",
    parts: {
      ...PADS,
      bass: "@r - - r - - r - | r - - r - - r r",
      arp: "@0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      lead:
        "G6 - - - - - - - | F6 - - - D6 - - - | D6 - - - F6 - - - | E6 - - - C#6 - - - |" +
        "Bb6 - - - G6 - - - | A6 - - - F6 - - - | G6 - - - Bb6 - - - | A6 - - - - - - - |",
      drums: { k: "x.........x.....", s: "........x.......", h: "x.x.x.x.x.x.x.x.", c: "!x" },
    },
    fill: { k: "x.x.x.x.x.x.x.x.", s: "x.x.x.x.xxxxXXXX", th: "x.x.", up: "x---------------" },
  },
  E: {
    // breakdown: choir + bells carry the hook, the band drops to a heartbeat
    bars: 7,
    chords: "Dm | Bb | Gm | A | Dm | Bb | C",
    parts: {
      ...PADS,
      bass: "@r - - - - - - -",
      hook: "A5 - D6 - F6 - E6 D6 | D6 - - - Bb5 - F5 - | G5 - Bb5 - D6 - C6 Bb5 | C#6 - - - E6 - - - | A5 - D6 - F6 - G6 F6 | F6 - - D6 - - Bb5 - | E6 - - - G6 - - - |",
      drums: { k: "x.......x.......", tl: "............x...", c: "!x" },
    },
  },
  shift: {
    // the gear change: the dominant of the next key, a snare roll, a riser
    bars: 1,
    chords: "Bb7",
    parts: {
      ...PADS,
      bass: "@r r r r r r r r",
      arp: "@0 1 2 3 4 5 6 7 4 5 6 7 8 9 10 11",
      lead: "F6 - - - Ab6 - - -",
      drums: { k: "x...x...x...x...", s: "x.x.x.x.xxxxXXXX", up: "x---------------" },
    },
  },
  reset: {
    // ...and back down to D minor
    bars: 1,
    chords: "A7",
    parts: {
      ...PADS,
      bass: "@r - - - r - - -",
      lead: "E6 - - - C#6 - - -",
      drums: { k: "x.......x.......", s: "........x.x.x.x.", up: "x---------------" },
    },
  },
};

const ROUND = ["A", "B", "C", "A2", "B", "C", "D", "E"];
const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Dm | Bb | C | A",
    parts: {
      ...PADS,
      bass: "@r - - - - - - - | r - - - - - - - | r - - - - - - - | r r r r r r r r",
      lead: "A5 - - - - - - - | Bb5 - - - - - - - | C6 - - - - - - - | C#6 - - - - - - -",
      drums: { tl: "x..x..x.x..x..x.", k: "x.......x.......", c: "!x" },
    },
    fill: { tl: "x.x.x.x.", tm: ".x.x.x.x", s: "........xxxxXXXX", up: "x---------------" },
  },
};
const order: string[] = ["intro"];
for (const [k, tr] of [[0, 0], [1, 1], [2, 2]] as const) {
  for (const name of [...ROUND, k < 2 ? "shift" : "reset"]) {
    const id = tr ? `${name}_${tr}` : name;
    if (!sections[id]) sections[id] = { ...base[name], tr: name === "reset" ? 0 : tr };
    order.push(id);
  }
}

export const finale: SongDef = {
  bpm: 160,
  layered: true,
  vol: 0.9,
  key: "D minor",
  delayBeats: 0.5,
  channels: [
    { id: "bass", inst: "bassSaw", vol: 0.55, center: 43, voicing: "root" },
    { id: "str", inst: "strings", vol: 1.4, center: 62, rev: 0.4 },
    { id: "choir", inst: "choir", vol: 1.35, center: 67, rev: 0.5, pan: 0.1 },
    { id: "hook", inst: "bell", vol: 1.5, rev: 0.45, dly: 0.3, pan: 0.15 },
    { id: "drums", inst: "drums", vol: 0.75, layer: 0.3 },
    { id: "arp", inst: "arp", vol: 3.0, center: 79, layer: 0.6, dly: 0.25, pan: 0.3 },
    { id: "lead", inst: "leadSaw", vol: 2.3, layer: 0.8, rev: 0.25, dly: 0.15 },
    { id: "bell", inst: "bell", vol: 1.2, center: 86, layer: 0.9, rev: 0.4, dly: 0.3, pan: -0.3 },
  ],
  sections,
  order,
  loopTo: 1,
};
