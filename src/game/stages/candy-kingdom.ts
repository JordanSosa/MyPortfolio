/**
 * Stage 2: CANDY KINGDOM (docs/content/stages.md §1). 12:00, Gingerbread
 * Golem 6:00, Sugar Plum Tyrant 11:00 (final; enrages at 12:30).
 * Sugar Morning -> Caramel Afternoon -> Sugar Crash Dusk over the 11 minutes
 * to the final boss; rainbow sprinkles fall all run long. The victory is the
 * "SUGAR CRASH!" sunrise.
 *
 * Roster (src/game/enemies/): gummy_bear, candy_corn, donut_roller,
 * lollipop_mage, marshmallow_brute; props prop_candy_jar / prop_pinata
 * (the pinata also bursts into coins + a gumdrop snack: onStart's prop hook).
 */
import type { SpawnPhase, StageDef, TimelineEvent } from "../stage";
import type { World } from "../world";
import { dropSnack } from "../weapons/_heroes-a";

const EARLY = { gummy_bear: 3, candy_corn: 1 };
const MID = { gummy_bear: 3, candy_corn: 2 };
const L1 = { gummy_bear: 2, candy_corn: 2, donut_roller: 1, lollipop_mage: 1 };
const L2 = { ...L1, marshmallow_brute: 0.6 };
const ALL = { gummy_bear: 2, candy_corn: 2, donut_roller: 1.2, lollipop_mage: 1, marshmallow_brute: 0.8 };
const LATE = { gummy_bear: 1.6, candy_corn: 2, donut_roller: 1.4, lollipop_mage: 1.2, marshmallow_brute: 1.1 };

export const CANDY_PHASES: SpawnPhase[] = [
  { from: 0, to: 60, mix: EARLY, rate: [1.6, 3.0], max: 60 },
  { from: 60, to: 120, mix: MID, rate: [3.2, 4.5], max: 110 },
  { from: 120, to: 210, mix: L1, rate: [4.5, 6.5], max: 150 },
  { from: 210, to: 300, mix: L2, rate: [7, 10], max: 180 },
  { from: 300, to: 360, mix: ALL, rate: [12, 15], max: 220 },
  { from: 360, to: 390, mix: ALL, rate: [15, 16], max: 230 },
  { from: 390, to: 540, mix: ALL, rate: [18, 26], max: 250 },
  { from: 540, to: 660, mix: LATE, rate: [26, 32], max: 270 },
  { from: 660, to: 1e9, mix: LATE, rate: [32, 32], max: 270 },
];

export const CANDY_EVENTS: TimelineEvent[] = [
  { at: 45, kind: "swarmLine", enemy: "gummy_bear", count: 10, speed: 70 },
  { at: 90, kind: "swarmLine", enemy: "candy_corn", count: 12, lines: 3, speed: 60, label: "PHALANX!" },
  { at: 150, kind: "elite" },
  { at: 180, kind: "laneCharge", enemy: "donut_roller", count: 6, lines: 3, speed: 165, label: "ROLLING DONUTS!" },
  { at: 240, kind: "encircle", enemy: "gummy_bear", count: 28 },
  { at: 270, kind: "elite" },
  { at: 330, kind: "flood", enemy: "gummy_bear", count: 46, duration: 6, label: "GUMMY AVALANCHE!" },
  { at: 360, kind: "boss", enemy: "gingerbread_golem", spawnMul: 0.45 },
  { at: 405, kind: "elite" },
  { at: 435, kind: "bulletRain", sprite: "eb_candy", count: 40, duration: 8, label: "SPRINKLE STORM!" },
  { at: 465, kind: "elite" },
  { at: 480, kind: "swarmLine", enemy: "candy_corn", count: 18, lines: 4, speed: 64, label: "PHALANX!" },
  { at: 510, kind: "elite" },
  { at: 525, kind: "laneCharge", enemy: "donut_roller", count: 10, lines: 4, speed: 165, label: "ROLLING DONUTS!" },
  { at: 555, kind: "encircle", enemy: "marshmallow_brute", count: 8, label: "MARSHMALLOW WALL!" },
  { at: 570, kind: "elite" },
  { at: 600, kind: "bulletRain", sprite: "eb_candy", count: 60, duration: 10, label: "SPRINKLE STORM!" },
  { at: 615, kind: "elite" },
  { at: 630, kind: "flood", enemy: "candy_corn", count: 50, duration: 6, label: "THE WHOLE ARMY?!" },
  { at: 660, kind: "boss", enemy: "sugar_plum_tyrant", spawnMul: 0.4 },
];

/** Pinata extras: coins + a wrapped sweet (a gumdrop snack) on top of the regular prop loot. */
function pinataLoot(w: World, x: number, y: number): void {
  for (let i = 0; i < 4; i++) w.dropPickup("coin", x, y, 1);
  if (w.difficulty.food) dropSnack(w, "deco_gumdrop", x, y, 8);
}

export const candyKingdom: StageDef = {
  id: "candy_kingdom",
  name: "Candy Kingdom",
  subtitle: "Episode 2: Everything Here Is Edible (Please Don't)",
  blurb: "sugar rush, sprinkle storms, a very sticky tyrant",
  order: 2,
  duration: 720,
  rewardMul: 1.25,
  requires: "dream_meadow",
  bpm: 150,

  phases: CANDY_PHASES,
  events: CANDY_EVENTS,
  opening: { enemy: "gummy_bear", count: 12 },
  finalBoss: "sugar_plum_tyrant",
  enrageAt: 750,
  props: { ids: ["prop_candy_jar", "prop_pinata"], interval: 16, max: 4 },
  endless: {
    hpPerMinute: 0.35,
    spawnPerMinute: 0.08,
    eliteEvery: 45,
    elites: 2,
    bossEvery: 120,
    rematches: ["gingerbread_golem", "sugar_plum_tyrant"],
    bossHpPerLoop: 0.5,
    bossSpawnMul: 0.5,
  },

  music: { battle: "candy", boss: "boss_candy", final: "boss_candy" },
  clearColor: 0xffb8dc,
  tiles: {
    sprite: "tile_candy",
    rules: [
      // cookie-crumb paths
      { noise: { freq: 0.09, seed: 11, above: 0.5 }, frames: [7] },
      // sprinkle / chocolate drizzle patches
      { noise: { freq: 0.2, ox: 31, oy: 7, seed: 5, above: 0.44 }, hash: { below: 0.6 }, frames: [4, 5], cuts: [0.55] },
      { hash: { above: 0.965 }, frames: [6] },
      { hash: { above: 0.93 }, frames: [4, 5], mul: 991 },
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
      seed: 23,
      salt: 2,
      items: [
        { sprite: "deco_gumdrop", upTo: 0.35 },
        { sprite: "deco_candy_lolli", upTo: 0.62 },
        { sprite: "deco_candy_cane", upTo: 0.8, shadow: 6 },
        { sprite: "deco_sugar_cube", upTo: 0.92, shadow: 9 },
        { sprite: "deco_cupcake", upTo: 1, shadow: 7, glow: { r: 8, color: 0xff7ab8 } },
      ],
    },
    {
      kind: "tall",
      sprite: "deco_lollipop_tree",
      cell: 96,
      chance: 0.4,
      salt: 2,
      shadow: 24,
      sway: { speed: 1.1, above: 0.35 },
      canopy: { r: 16, h: 26 },
      flipAbove: 0.3,
    },
  ],
  // Sugar Morning -> Caramel Afternoon -> Sugar Crash Dusk
  grade: [
    { at: 0, grade: { tint: [1.04, 0.99, 1.0], lift: [0.02, 0.0, 0.02], saturation: 1.12, contrast: 1.03, brightness: 1.02, hue: 0 } },
    { at: 0.5, grade: { tint: [1.06, 0.96, 0.9], lift: [0.05, 0.02, 0.0], saturation: 1.1, contrast: 1.04, brightness: 1.0, hue: 0 } },
    { at: 1, grade: { tint: [0.98, 0.88, 1.0], lift: [0.06, 0.0, 0.07], saturation: 1.08, contrast: 1.06, brightness: 0.96, hue: 0 } },
  ],
  ambient: {
    base: [
      { at: 0, petals: 0, motes: 10, fireflies: 0 },
      { at: 1, petals: 0, motes: 14, fireflies: 6 },
    ],
    layers: [
      {
        sprite: "fx_sprinkle",
        motion: "fall",
        colors: [0xff7ab8, 0xffe14d, 0x4fe6df, 0x94e85e, 0xffffff],
        density: [
          { at: 0, n: 14 },
          { at: 1, n: 24 },
        ],
        speed: [14, 26],
        sway: 8,
        spin: 3,
        alpha: 0.9,
      },
    ],
  },
  victory: { fx: "dawn", title: "SUGAR CRASH!", line: "the Candy Kingdom is free, and slightly sticky" },

  onStart(w) {
    // the pinata bursts into coins and wrapped sweets (find the prop that just broke at the hook position)
    w.hooks.on("prop", (h) => {
      const items = w.enemies.items;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = items[i];
        if (!e.dead || e.x !== h.x || e.y !== h.y || !e.def.prop) continue;
        if (e.def.id === "prop_pinata") pinataLoot(w, e.x, e.y);
        return;
      }
    });
  },
};

export const stages: StageDef[] = [candyKingdom];
