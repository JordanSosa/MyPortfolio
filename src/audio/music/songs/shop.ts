/**
 * "Dream Shop" - cosy shop theme. 92 bpm swung, F major, e-piano comping,
 * pizzicato and flute melodies, brushes. Original composition.
 * A(8) B(8) A(8) C(8) -> loop
 */
import type { DrumPat, SectionDef, SongDef } from "../song";

const BRUSH: DrumPat = {
  k: "x.......x.......",
  rim: "....x.......x...",
  shk: "x.x.x.x.x.x.x.x.",
  sn: "..x...x...x...x.",
};

const sections: Record<string, SectionDef> = {
  A: {
    bars: 8,
    chords: "Fmaj7 | Am7 | Bbmaj7 | C7 | Fmaj7 | Am7 | Gm7 | C7",
    parts: {
      bass: "@r - - - 2 - 1 -",
      keys: "@. x - - . x - -",
      bell: "@. . . . . . 4 . | . . . . . . 3 .",
      pizz:
        ". C5 F5 A5 - G5 - E5 | G5 - - - E5 - C5 - | D5 - F5 - A5 - G5 F5 | G5 - - - - - . . |" +
        ". C5 F5 A5 - C6 - A5 | G5 - - E5 - - C5 - | Bb4 - D5 - F5 - E5 D5 | C5 - - - - - . . |",
      drums: BRUSH,
    },
  },
  B: {
    bars: 8,
    chords: "Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | Am7 | Gm7 | C7sus4 C7",
    parts: {
      bass: "@r - - - 2 - 1 -",
      keys: "@x - - x - - x -",
      flute:
        "D6 - - C6 - A5 - F5 | E5 - G5 - C6 - - - | Bb5 - - A5 - G5 - F5 | A5 - - - - - . . |" +
        "D6 - - C6 - A5 - Bb5 | C6 - - - G5 - E5 - | F5 - - G5 - A5 - Bb5 | C6 - - - - - . . |",
      drums: BRUSH,
    },
  },
  C: {
    bars: 8,
    chords: "Dm7 | Gm7 | C7 | Fmaj7 | Bbmaj7 | Em7b5 A7 | Dm7 | Gm7 C7",
    parts: {
      bass: "@r - - - 2 - - -",
      keys: "@x - - - x - - -",
      bell: "@2 . 3 . 4 . 3 . | 1 . 2 . 3 . . .",
      pizz: "@. . . . . . . . | . . 0 . . 1 . . ",
      drums: { k: "x.......x.......", rim: "....x.......x...", shk: "x.x.x.x.x.x.x.x." },
    },
  },
};

export const shop: SongDef = {
  bpm: 92,
  swing: 0.14,
  vol: 1.45,
  delayBeats: 0.75,
  channels: [
    { id: "bass", inst: "bassSoft", vol: 0.44, center: 41, voicing: "root" },
    { id: "keys", inst: "ep", vol: 1.1, center: 62, rev: 0.3, dly: 0.1, pan: -0.15 },
    { id: "bell", inst: "musicbox", vol: 1.3, center: 84, rev: 0.4, dly: 0.3, pan: 0.3 },
    { id: "pizz", inst: "pizz", vol: 3.1, center: 72, rev: 0.25, pan: 0.1 },
    { id: "flute", inst: "flute", vol: 1.1, rev: 0.35, dly: 0.15 },
    { id: "drums", inst: "drums", vol: 0.6 },
  ],
  sections,
  order: ["A", "B", "A", "C"],
  loopTo: 0,
};
