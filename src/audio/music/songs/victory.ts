/**
 * "Dawn Breaks" - victory. 140 bpm, C major: a triplet brass fanfare, then a
 * gentle, warm loop for the results screen. Original composition.
 * fanfare(4) loopA(8) loopB(8) -> loop to loopA
 */
import type { SectionDef, SongDef } from "../song";

const sections: Record<string, SectionDef> = {
  fanfare: {
    bars: 4,
    chords: "C | F G | C | C",
    parts: {
      brass: "!G4 C5 E5 G5 - - E5 - G5 C6 - - | A5 - - C6 - - B5 - - D6 - - | C6 - - - - - - - - - - - | .",
      brass2: "!@. x . x | x . x . | x - - - | .",
      bass: "!@r . r . | r . r . | r - - - | .",
      pad: "!@. | . | x - - - | x - - -",
      bell: "!@. | . | 0 1 2 3 4 5 6 7 | 6 - - - - - - -",
      drums: {
        k: "!x...x...x...x... | x...x...x...x... | x | .",
        s: "!x.x.x.x.x.x.xxxx | x.x.x.x.xxxxXXXX | . | .",
        tl: "!. | ........x.x.x.x. | . | .",
        c: "!. | . | x | .",
        sub: "!. | . | x | .",
      },
    },
  },
  loopA: {
    bars: 8,
    chords: "Fmaj7 | G | Em7 | Am7 | Dm7 | G | Cmaj7 | C",
    parts: {
      keys: "@x - - - x - - -",
      bass: "@r - - - r - - -",
      pad: "@x - - - - - - -",
      bell: "@0 . 1 . 2 . 3 .",
      lead: "A5 - G5 E5 | D5 - - - | G5 - E5 D5 | C5 - - - | F5 - D5 A4 | B4 - - - | E5 - C5 G4 | C5 - - - ",
      drums: { k: "x.......x.......", rim: "....x.......x...", shk: "x.x.x.x.x.x.x.x." },
    },
  },
  loopB: {
    bars: 8,
    chords: "Dm7 | Em7 | Fmaj7 | G | Am7 | Dm7 | G7sus4 | G7",
    parts: {
      keys: "@x - - - x - - -",
      bass: "@r - - - r - - -",
      pad: "@x - - - - - - -",
      bell: "@3 . 2 . 1 . 0 .",
      lead: "F5 - A5 C6 | B5 - G5 - | A5 - C6 E6 | D6 - - - | C6 - A5 E5 | F5 - D5 - | C5 - D5 - | B4 - - - ",
      drums: { k: "x.......x.......", rim: "....x.......x...", shk: "x.x.x.x.x.x.x.x." },
    },
  },
};

export const victory: SongDef = {
  bpm: 140,
  vol: 1,
  delayBeats: 0.75,
  channels: [
    { id: "brass", inst: "brass", vol: 2.2, rev: 0.35 },
    { id: "brass2", inst: "brass", vol: 0.95, center: 64, rev: 0.3 },
    { id: "bass", inst: "bassSoft", vol: 0.51, center: 43, voicing: "root" },
    { id: "pad", inst: "padSoft", vol: 0.38, center: 62, rev: 0.5 },
    { id: "keys", inst: "ep", vol: 0.62, center: 64, rev: 0.3, dly: 0.12 },
    { id: "bell", inst: "bell", vol: 1.12, center: 79, rev: 0.4, dly: 0.3, pan: 0.3 },
    { id: "lead", inst: "flute", vol: 1.2, rev: 0.4, dly: 0.2 },
    { id: "drums", inst: "drums", vol: 0.65 },
  ],
  sections,
  order: ["fanfare", "loopA", "loopB"],
  loopTo: 1,
};
