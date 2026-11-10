/**
 * "Summer Festival Showdown" - Beach Episode boss theme (Kraken-chan, the Summer
 * Festival Firework Dragon). 128 bpm (the stage tempo), E minor: festival taiko
 * ("don" / "ka" patterns), a small hand-bell (cowbell "kane"), koto plucks and a
 * chiptune flute melody in minor pentatonic, with firework risers and zaps
 * in the fills. Original composition.
 * intro(4) A(8) B(8) C(8) A(8) C(8) -> loop to A
 * Intensity layers (boss >= 0.4): 0 bass + koto + pad + flute + taiko | 0.6 koto 16ths | 0.8 firework bells
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const TAIKO: DrumPat = {
  tk: "x..x..x.x...x.x.",
  wb: "..x...x...x.x...",
  k: "x.......x.......",
  cow: "x...x...x...x...",
  c: "!x",
};
const TAIKO_FILL: DrumPat = { tk: "x.x.x.x.xxxxx.x.", wb: "..x...x.........", k: "x.......x.......", zap: "............x.x." };
/** intensity >= 0.8: the whole festival joins in (fast taiko rolls, shakers, kane) */
const PERC: DrumPat = { tk: "..x...x...x.x.xx", shk: "xxxxxxxxxxxxxxxx", cow: "..x...x...x...x.", wb: "x...x...x...x..." };
const MATSURI: DrumPat = {
  tk: "x.xx..x.x.xx..x.",
  wb: "..x...x...x...x.",
  k: "x...x...x...x...",
  s: "....x.......x...",
  cow: "x.x.x.x.x.x.x.x.",
  c: "!x",
};

const sections: Record<string, SectionDef> = {
  intro: {
    bars: 4,
    chords: "Em | Em | C | B7",
    parts: {
      pad: "@x - - - - - - -",
      bass: "@r - - - - - - - | r - - - - - - - | r - - - - - - - | r - - - r - - -",
      flute: ". | . | E6 - - D6 E6 - - G6 | F#6 - - - B5 - A5 -",
      drums: {
        tk: "x...x...x...x... | x.x.x.x.x.x.x.x. | x.x.x.x.xxxxxxxx | x.......x.x.x.xx",
        wb: ". | ..x...x...x...x. | . | .",
        up: ". | . | . | x---------------",
        c: "!x",
      },
    },
  },
  A: {
    bars: 8,
    chords: "Em | D | C | D | Em | Am | B7 | Em",
    parts: {
      bass: "@r - r - r - r r'",
      koto: "@0 1 2 1 0 1 2 1",
      arp: "@0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 1",
      pad: "@x - - - - - - -",
      flute:
        "E6 - - D6 B5 - - - | A5 - - B5 D6 - - - | G6 - - E6 - - D6 E6 | D6 - - - A5 - - - |" +
        "B5 - D6 - E6 - G6 - | A6 - - G6 E6 - - - | F#6 - - - B5 - A5 - | E6 - - - - - - - |",
      drums: TAIKO,
      perc: PERC,
    },
    fill: TAIKO_FILL,
  },
  B: {
    bars: 8,
    chords: "C | D | Bm | Em | C | D | B7 | B7",
    parts: {
      bass: "@r - - r - - r -",
      koto: "@0 2 1 2 0 2 1 2",
      arp: "@0 1 2 3 2 1 0 1 0 1 2 3 2 1 0 1",
      pad: "@x - - - - - - -",
      flute:
        "E6 - D6 E6 G6 - E6 D6 | D6 - - B5 A5 - - - | B5 - D6 - F#6 - E6 D6 | E6 - - - - - . . |" +
        "G6 - - E6 - - D6 E6 | F#6 - - D6 - - A5 - | D#6 - - - F#6 - - - | A6 - - - F#6 - D#6 - |",
      bell: "@. . 3 . . . 4 . | . . 2 . . . 5 .",
      drums: TAIKO,
      perc: PERC,
    },
    fill: { tk: "x.x.x.x.xxxxxxxx", s: "........xxxxXXXX", up: "x---------------", zap: "x...x...x...x..." },
  },
  C: {
    bars: 8,
    chords: "Em | C | D | Bm | Em | C | D B7 | Em",
    parts: {
      bass: "@r r r r r r r r",
      koto: "@0 1 2 3 2 1 0 1",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      pad: "@x - - - - - - -",
      flute:
        "G6 - E6 - B5 - E6 G6 | G6 - - - E6 - - - | F#6 - - E6 D6 - - - | F#6 - - - B5 - - - |" +
        "E6 - G6 - B6 - A6 G6 | G6 - - E6 - - D6 C6 | A6 - G6 F#6 - - D#6 - | E6 - - - - - - - |",
      bell: "@0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .",
      drums: MATSURI,
      perc: PERC,
    },
    fill: { ...TAIKO_FILL, up: "x---------------" },
  },
};

export const bossBeach: SongDef = {
  bpm: 128,
  layered: true,
  vol: 1.05,
  key: "E minor",
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bass", vol: 0.62, center: 40, voicing: "root" },
    { id: "koto", inst: "koto", vol: 2.4, center: 64, rev: 0.25, pan: -0.2 },
    { id: "pad", inst: "padSoft", vol: 0.32, center: 60, rev: 0.5 },
    { id: "flute", inst: "chipFlute", vol: 1.25, rev: 0.3, dly: 0.2, pan: 0.05 },
    { id: "drums", inst: "drums", vol: 0.72 },
    { id: "arp", inst: "koto", vol: 1.6, center: 76, layer: 0.6, dly: 0.2, pan: 0.3 },
    { id: "bell", inst: "bell", vol: 1.4, center: 88, layer: 0.8, rev: 0.45, dly: 0.3, pan: -0.3 },
    { id: "perc", inst: "drums", vol: 0.55, layer: 0.8 },
  ],
  sections,
  order: ["intro", "A", "B", "C", "A", "C"],
  loopTo: 1,
};
