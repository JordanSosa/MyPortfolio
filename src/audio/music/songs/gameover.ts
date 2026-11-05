/**
 * "Dream Over" - game over. 72 bpm, A minor: a short music-box + strings jingle,
 * then a very soft, sparse loop. Original composition.
 * jingle(3) loop(8) -> loop to loop
 */
import type { SectionDef, SongDef } from "../song";

const sections: Record<string, SectionDef> = {
  jingle: {
    bars: 3,
    chords: "Am | F E | Am",
    parts: {
      box: "E6 - D6 C6 B5 - A5 - | A5 - - - G#5 - - - | A5 - - - - - - -",
      str: "@x - - - - - - - | x - - - x - - - | x - - - - - - -",
      bass: "@r - - - - - - - | r - - - r - - - | r - - - - - - -",
    },
  },
  loop: {
    bars: 8,
    chords: "Am | F | C | G | Am | F | Dm | E",
    parts: {
      box: "@0 . . 1 . . 2 . | 3 . . 2 . . 1 . ",
      pad: "@x - - - - - - -",
      bass: "@r - - - - - - -",
    },
  },
};

export const gameover: SongDef = {
  bpm: 72,
  vol: 1.25,
  delayBeats: 0.75,
  channels: [
    { id: "box", inst: "musicbox", vol: 2.1, center: 76, rev: 0.5, dly: 0.3 },
    { id: "str", inst: "strings", vol: 1.2, center: 60, rev: 0.5 },
    { id: "pad", inst: "padSoft", vol: 0.33, center: 60, rev: 0.6 },
    { id: "bass", inst: "bassSoft", vol: 0.34, center: 40, voicing: "root" },
  ],
  sections,
  order: ["jingle", "loop"],
  loopTo: 1,
};
