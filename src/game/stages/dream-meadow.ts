/**
 * Stage 1: DREAM MEADOW (the original slice, DESIGN §3.6). 10:00, King Puff
 * 3:00, Nightmare Teddy 6:00, Lady Lunatic 9:00 (final; enrages at 10:30).
 * Day -> dusk -> night over the 9 minutes to the final boss, petals giving
 * way to fireflies; the victory is the sunrise ("DAWN BREAKS!").
 *
 * Times in seconds of run time. PHASES drive the continuous spawning: the
 * enemy mix (weights), the spawn rate (per second, lerped from rate[0] to
 * rate[1] across the phase) and the max-alive cap (also limited by the device
 * quality tier). EVENTS fire once at `at`; `kind` selects a handler in
 * director/events.ts (swarmLine, batStorm, encircle, flood, wispRush, elite,
 * boss). Unregistered enemy / boss ids are skipped.
 */
import type { SpawnPhase, StageDef, TimelineEvent } from "../stage";

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

export const dreamMeadow: StageDef = {
  id: "dream_meadow",
  name: "Dream Meadow",
  subtitle: "Episode 1: The Puffs Are Plotting Something",
  blurb: "petals, puffs and a very long night",
  order: 1,
  duration: 600,
  rewardMul: 1,

  phases: PHASES,
  events: EVENTS,
  opening: { enemy: "puff", count: 10 },
  finalBoss: "lady_lunatic",
  enrageAt: 630,
  props: { interval: 16, max: 4 },
  endless: {
    hpPerMinute: 0.35,
    spawnPerMinute: 0.08,
    eliteEvery: 45,
    elites: 2,
    bossEvery: 120,
    rematches: ["king_puff", "nightmare_teddy", "lady_lunatic"],
    bossHpPerLoop: 0.5,
    bossSpawnMul: 0.5,
  },

  music: { battle: "battle", boss: "boss", final: "final" },
  clearColor: 0x6fbf73,
  tiles: {
    sprite: "tile_ground",
    rules: [
      // worn paths along a low-frequency noise ridge
      { noise: { freq: 0.09, seed: 7, above: 0.5 }, frames: [7] },
      // flower / clover patches
      { noise: { freq: 0.21, ox: 40, oy: -13, seed: 3, above: 0.42 }, hash: { below: 0.55 }, frames: [4, 5], cuts: [0.3] },
      // rare sparkle grass, then scattered flower / clover accents
      { hash: { above: 0.965 }, frames: [6] },
      { hash: { above: 0.93 }, frames: [4, 5], mul: 997 },
    ],
    base: { frames: [0, 1, 2, 3], mul: 1000 },
  },
  deco: [
    {
      kind: "scatter",
      cell: 24,
      base: 0.18,
      noise: 0.5,
      freq: 0.16,
      seed: 21,
      items: [
        { sprite: "deco_grass", upTo: 0.42 },
        { sprite: "deco_flower", upTo: 0.78 },
        { sprite: "deco_rock", upTo: 0.88, shadow: 9 },
        { sprite: "deco_mush", upTo: 0.95, glow: { r: 7, color: 0x4fe6df } },
        { sprite: "deco_crystal", upTo: 1, shadow: 7, glow: { r: 10, color: 0xb47cff } },
      ],
    },
    // cotton-candy trees
    { kind: "tall", sprite: "deco_tree", cell: 96, chance: 0.42, shadow: 26, sway: { speed: 1.3, above: 0.35 }, canopy: { r: 17, h: 24 }, flipAbove: 0.21 },
  ],
  grade: [
    { at: 0, grade: "day" },
    { at: 0.5, grade: "dusk" },
    { at: 1, grade: "night" },
  ],
  ambient: {
    // petals drift through the day, fireflies come out after dusk
    base: [
      { at: 0, petals: 12, motes: 10, fireflies: 0 },
      { at: 0.55, petals: 12, motes: 10, fireflies: 0 },
      { at: 0.95, petals: 0, motes: 16, fireflies: 22 },
    ],
  },
  victory: { fx: "dawn", title: "DAWN BREAKS!", line: "the nightmares fade with the sun" },
};

export const stages: StageDef[] = [dreamMeadow];
