/**
 * "Cancel-sama's Quarterly Review" - the series-finale boss (CANCEL-SAMA, the
 * Network Executive). 160 bpm (the Final Arc tempo).
 *
 * The joke: the network executive plays YOUR MENU THEME (hub.ts) back at you, and
 * then the production runs out of money in real time (Engine.setDegrade):
 *
 *  degrade 0      EPIC. The hub melody re-cut in A minor for full orchestra: saw lead,
 *                 strings, choir, brass, bells, double-time drums, timpani.
 *  >= 0.34        "RATINGS DROP": the choir, brass and bells are laid off mid-phrase,
 *                 the saw lead and strings are replaced by cheaper patches, and the
 *                 lo-fi chain starts (narrower band, a little flat, less reverb).
 *  >= 0.6         "BUDGET CUTS": the arrangement is swapped for the hub theme in its
 *                 original A major as corporate hold music - drawbar organ, a preset
 *                 bossa beat, half-time - over a telephone band, bitcrush and tape wow.
 *  >= 0.9         "RUSHED ENDING": the same tune hurried at full speed with still-frame
 *                 chords, vinyl crackle, skipped notes and drop-outs.
 *
 * Without setDegrade calls it degrades on its own (auto: bars 20 / 36 / 54). The
 * arrangement tiers and the lo-fi processing live in player.ts. Original composition.
 * Intensity layers (boss >= 0.4): 0 everything | 0.6 arps | 0.8 bells
 */
import type { DrumPat, SectionDef, SongDef } from "../song";
import { HUB_CHORDS_A, HUB_CHORDS_B, HUB_LEAD_A, HUB_LEAD_B } from "./hub";

// ------------------------------------------------------------------ tier 0: epic (A minor)

const BLAST: DrumPat = {
  k: "x.x.x.x.x.x.x.x.",
  s: "....x.......x...",
  h: "x.x.x.x.x.x.x.x.",
  tim: "x...............",
  c: "!x",
};
const ANTHEM: DrumPat = {
  k: "x...x...x...x.x.",
  s: "....x.......x...",
  o: "..x...x...x...x.",
  tim: "x.......x.......",
  c: "!x",
};
const FILL: DrumPat = { k: "x.......x.......", s: "....x...xxxxXXXX", th: "x.x.", tm: "..x.x...", tim: "x...x...x.x.x.x." };

const CHORDS_A = "Dm7 | C | Bbmaj7 | E | Am | Fmaj7 | Dm7 | E7";
const LEAD_A =
  "A5 . F5 A5 C6 - Bb5 A5 | G5 - - E5 . . F5 G5 | F5 . D5 F5 A5 - G5 F5 | E5 - - - . E5 F5 G#5 |" +
  "A5 . E5 A5 C6 - B5 A5 | C6 - - A5 . . B5 C6 | D6 . C6 B5 A5 - F5 A5 | G#5 - - - E5 - - - |";
const LEAD_A2 =
  "A5 . F5 A5 C6 - Bb5 A5 | G5 - - E5 . . F5 G5 | F5 . D5 F5 A5 - G5 F5 | E5 - - - . E5 F5 G#5 |" +
  "A5 . C6 E6 A6 - G#6 E6 | F6 - - C6 . . E6 F6 | D6 . F6 . A6 - F6 D6 | E6 - - - D6 - B5 G#5 |";
const CHORDS_B = "Dm7 | E7 | Fmaj7 | G | E7 | Am | Dm7 E7 | Am";
const LEAD_B =
  "D6 - C6 D6 - - F6 - | E6 - D6 E6 - - G#6 - | F6 - E6 C6 - A5 - F5 | G5 - - - B5 - - - |" +
  "E6 - D6 E6 - - G#6 - | A6 - G#6 E6 - - C6 - | D6 - C6 B5 - - G#5 - | A5 - - - - - . . |";

/** the same melody on the expensive lead and (after the ratings drop) on the cheap one */
const both = (lead: string) => ({ lead, lead2: lead });
const STR = { str: "@x - - - - - - -", str2: "@x - - - - - - -" };

const epic: Record<string, SectionDef> = {
  intro: {
    // Cancel-sama enters, adjusts tie
    bars: 4,
    chords: "Am | F | Dm | E",
    parts: {
      ...STR,
      choir: "@x - - - - - - -",
      brass: "@x . . x . . . . | x . . x . . . . | x . . x . . . . | x - - - x - x x",
      bass: "@r - - - - - - - | r - - - - - - - | r - - - - - - - | r r r r r r r r",
      bell: "A5 . F5 A5 C6 - Bb5 A5 | . | . | G#5 - B5 - E6 - G#6 -",
      drums: { tim: "x.......x....... | x.......x....... | x.......x....... | x.x.x.x.xxxxxxxx", c: "!x", s: ". | . | . | ........xxxxXXXX" },
    },
  },
  A: {
    bars: 8,
    chords: CHORDS_A,
    parts: {
      ...STR,
      ...both(LEAD_A),
      bass: "@r r r r r r r r",
      choir: "@x - - - - - - -",
      arp: "@0 1 2 3 1 2 3 4 0 1 2 3 1 2 3 4",
      drums: BLAST,
    },
    fill: FILL,
  },
  A2: {
    bars: 8,
    chords: CHORDS_A,
    parts: {
      ...STR,
      ...both(LEAD_A2),
      bass: "@r r r r' r r r r'",
      choir: "@x - - - - - - -",
      brass: "@x - - - - - - - | x - - - - - - - | x - - - - - - - | x - - - x - - - |",
      arp: "@3 2 1 0 3 2 1 0 4 3 2 1 4 3 2 1",
      bell: "@. . 3 . . . 4 .",
      drums: BLAST,
    },
    fill: FILL,
  },
  B: {
    bars: 8,
    chords: CHORDS_B,
    parts: {
      ...STR,
      ...both(LEAD_B),
      bass: "@r r r' r r r r' r",
      choir: "@x - - - - - - -",
      brass: "@x - - x - - x -",
      arp: "@0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1",
      bell: "@. 3 . 4 . 5 . 4",
      drums: ANTHEM,
    },
    fill: { ...FILL, up: "x---------------" },
  },
  D: {
    // the quarterly review: a slow anthem of corporate doom
    bars: 8,
    chords: "F | G | Em | Am | Dm | E | F | E7",
    parts: {
      ...STR,
      ...both("C6 - - - F6 - - - | D6 - - - G6 - - - | B5 - - - E6 - - - | C6 - - - A5 - - - | F6 - - - D6 - - - | E6 - - - G#6 - - - | A6 - - - F6 - - - | G#6 - - - - - - - |"),
      bass: "@r - - r - - r - | r - - r - - r r",
      choir: "@x - - - - - - -",
      brass: "@x - - - x - - -",
      arp: "@0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      drums: { k: "x.........x.....", s: "........x.......", h: "x.x.x.x.x.x.x.x.", tim: "x.......x.......", c: "!x" },
    },
    fill: { k: "x.x.x.x.x.x.x.x.", s: "x.x.x.x.xxxxXXXX", tim: "x.x.x.x.xxxxxxxx", up: "x---------------" },
  },
};

// ------------------------------------------------------------------ tier 1: budget cuts (hold music, A major, half-time)

/** one bar of 8 eighths -> two bars of quarters (half-time hold music) */
function halfTime(lead: string): string {
  return lead
    .split("|")
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const t = b.split(/\s+/);
      return `${t.slice(0, 4).join(" ")} | ${t.slice(4).join(" ")}`;
    })
    .join(" | ");
}
/** each chord bar -> two bars ("X Y" splits, "X" repeats) */
function halfChords(chords: string): string {
  return chords
    .split("|")
    .map((c) => c.trim().split(/\s+/))
    .map((cs) => (cs.length === 2 ? `${cs[0]} | ${cs[1]}` : `${cs[0]} | ${cs[0]}`))
    .join(" | ");
}

const BOSSA: DrumPat = {
  bk: "x......xx.......",
  rim: "x..x..x...x..x..",
  shk: "x.x.x.x.x.x.x.x.",
};

const hold: Record<string, SectionDef> = {
  holdIntro: {
    // "Your call is important to us."
    bars: 2,
    chords: "Dmaj7 | E7",
    parts: {
      organ: "A5 - - - F#5 - - - | E5 - - - . . . .",
      ochord: "@x - - - - - - - | x - - - - - - -",
      obass: "@r - - - - - - - | r - - - - - - -",
    },
  },
  hold: {
    bars: 16,
    chords: halfChords(HUB_CHORDS_A),
    parts: {
      organ: halfTime(HUB_LEAD_A),
      ochord: "@x . . x . . x . | . . x . . x . .",
      obass: "@r - - - 2 - - -",
      cheap: BOSSA,
    },
  },
  holdB: {
    bars: 16,
    chords: halfChords(HUB_CHORDS_B),
    parts: {
      organ: halfTime(HUB_LEAD_B),
      ochord: "@x . . x . . x . | . . x . . x . .",
      obass: "@r - - - 2 - - -",
      cheap: BOSSA,
    },
  },
};

// ------------------------------------------------------------------ tier 2: rushed ending (full speed, still frames)

const STILL: DrumPat = { bk: "x.......x.......", rim: "....x.......x...", vin: "x---------------" };
const rushed: Record<string, SectionDef> = {
  rush: {
    bars: 8,
    chords: HUB_CHORDS_A,
    parts: { organ: HUB_LEAD_A, ochord: "@x - - - - - - -", obass: "@r - - - - - - -", cheap: STILL },
  },
  rushB: {
    bars: 8,
    chords: HUB_CHORDS_B,
    parts: { organ: HUB_LEAD_B, ochord: "@x - - - - - - -", obass: "@r - - - - - - -", cheap: STILL },
  },
};

const LAID_OFF: [number, number] = [0, 0.34];
const CHEAP: [number, number] = [0.34, 9];

export const cancel: SongDef = {
  bpm: 160,
  layered: true,
  vol: 0.9,
  key: "A minor -> A major (hold music)",
  delayBeats: 0.5,
  channels: [
    { id: "bass", inst: "bassSaw", vol: 0.55, center: 40, voicing: "root" },
    { id: "str", inst: "strings", vol: 1.45, center: 62, rev: 0.4, deg: LAID_OFF },
    { id: "str2", inst: "pad", vol: 1.0, center: 62, rev: 0.25, deg: CHEAP },
    { id: "choir", inst: "choir", vol: 1.35, center: 67, rev: 0.5, pan: 0.1, deg: LAID_OFF },
    { id: "brass", inst: "brass", vol: 1.2, center: 60, rev: 0.3, pan: -0.15, deg: LAID_OFF },
    { id: "lead", inst: "leadSaw", vol: 2.3, rev: 0.25, dly: 0.15, deg: LAID_OFF },
    { id: "lead2", inst: "lead", vol: 1.0, rev: 0.15, dly: 0.1, deg: CHEAP },
    { id: "drums", inst: "drums", vol: 0.75 },
    { id: "arp", inst: "arp", vol: 2.2, center: 79, layer: 0.6, dly: 0.25, pan: 0.3 },
    { id: "bell", inst: "bell", vol: 1.2, center: 86, layer: 0.8, rev: 0.4, dly: 0.3, pan: -0.3, deg: LAID_OFF },
    // the hold-music department
    { id: "organ", inst: "holdOrgan", vol: 1.5, rev: 0.2, pan: 0.05 },
    { id: "ochord", inst: "holdOrgan", vol: 0.75, center: 62, rev: 0.15, pan: -0.15 },
    { id: "obass", inst: "bassSoft", vol: 0.6, center: 40, voicing: "root" },
    { id: "cheap", inst: "drums", vol: 0.7 },
  ],
  sections: { ...epic, ...hold, ...rushed },
  order: ["intro", "A", "B", "A2", "B", "D"],
  loopTo: 1,
  degrade: {
    tiers: [
      { at: 0.6, order: ["holdIntro", "hold", "holdB"], loopTo: 1 },
      { at: 0.9, order: ["rush", "rushB"], loopTo: 0 },
    ],
    auto: [[20, 0.34], [36, 0.67], [54, 1]],
  },
};
