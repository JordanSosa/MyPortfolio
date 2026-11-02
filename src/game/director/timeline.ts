/**
 * Director timeline as data (DESIGN §3.6). Times in seconds of run time.
 *
 * PHASES drive the continuous spawning: the enemy mix (weights), the spawn
 * rate (per second, lerped from rate[0] to rate[1] across the phase) and the
 * max-alive cap (also limited by the device quality tier).
 *
 * EVENTS fire once at `at`. `kind` selects a handler in ./events.ts
 * (swarmLine, batStorm, encircle, flood, wispRush, elite, boss); the other fields are its params.
 *
 * Enemy / boss ids that are not registered yet are skipped automatically, so
 * content can land in any order: add `src/game/enemies/eyepuff.ts` and the
 * 2:00 phase starts spawning Eyepuffs with no change here.
 */
export interface SpawnPhase {
  from: number;
  to: number;
  /** enemy id -> weight */
  mix: Record<string, number>;
  /** spawns per second at phase start / end */
  rate: [number, number];
  /** max alive enemies */
  max: number;
}

export interface TimelineEvent {
  at: number;
  kind: string;
  /** Enemy id for wave events / boss id for "boss". */
  enemy?: string;
  count?: number;
  /** Seconds (flood). */
  duration?: number;
  /** Speed for straight-line swarms (px/s). */
  speed?: number;
  /** Number of parallel lines (swarmLine), lines over time (batStorm) or rings (wispRush). */
  lines?: number;
  /** Spawn-rate multiplier while the boss lives (boss). */
  spawnMul?: number;
}

const EARLY = { puff: 3, batbun: 2 };
const MID = { puff: 3, batbun: 2, boo: 2 };
const LATE1 = { puff: 2, batbun: 2, boo: 2, shroomie: 2, eyepuff: 1 };
const LATE2 = { ...LATE1, pumpkin: 0.8, teddy: 0.45 };
const LATE3 = { ...LATE2, wisp: 1.2 };
const ALL = { puff: 2, batbun: 2, boo: 2, shroomie: 1.6, eyepuff: 1.2, pumpkin: 1.2, teddy: 1, wisp: 1.4 };

export const PHASES: SpawnPhase[] = [
  { from: 0, to: 60, mix: EARLY, rate: [1.3, 2.7], max: 55 },
  { from: 60, to: 120, mix: MID, rate: [3, 4], max: 100 },
  { from: 120, to: 180, mix: LATE1, rate: [4, 5.5], max: 140 },
  { from: 180, to: 210, mix: LATE1, rate: [4.5, 4.5], max: 140 },
  { from: 210, to: 300, mix: LATE2, rate: [6, 9.5], max: 175 },
  { from: 300, to: 360, mix: LATE3, rate: [12, 16], max: 220 },
  { from: 360, to: 390, mix: LATE3, rate: [16, 17], max: 240 },
  { from: 390, to: 540, mix: ALL, rate: [20, 30], max: 260 },
  { from: 540, to: 1e9, mix: ALL, rate: [30, 30], max: 260 },
];

export const EVENTS: TimelineEvent[] = [
  { at: 105, kind: "swarmLine", enemy: "batbun", count: 14, speed: 78 },
  { at: 150, kind: "elite" },
  { at: 180, kind: "boss", enemy: "king_puff", spawnMul: 0.55 },
  { at: 240, kind: "encircle", enemy: "puff", count: 26 },
  { at: 270, kind: "elite" },
  { at: 330, kind: "flood", enemy: "puff", count: 44, duration: 6 },
  { at: 360, kind: "boss", enemy: "nightmare_teddy", spawnMul: 0.4 },
  { at: 390, kind: "elite" },
  { at: 420, kind: "encircle", enemy: "boo", count: 30 },
  { at: 435, kind: "elite" },
  { at: 450, kind: "batStorm", enemy: "batbun", count: 12, lines: 6, duration: 6, speed: 90 },
  { at: 480, kind: "elite" },
  { at: 495, kind: "wispRush", enemy: "wisp", count: 36, lines: 3, duration: 5 },
  { at: 525, kind: "elite" },
  { at: 540, kind: "boss", enemy: "lady_lunatic", spawnMul: 0.4 },
];

/** Phase for run time t. */
export function phaseAt(t: number): SpawnPhase {
  for (const p of PHASES) if (t >= p.from && t < p.to) return p;
  return PHASES[PHASES.length - 1];
}
