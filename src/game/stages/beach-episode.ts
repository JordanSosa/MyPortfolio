/**
 * Stage 4: BEACH EPISODE (docs/content/stages.md §3) - "The Obligatory Beach
 * Episode (Crabs Only)". 16:00, Kraken-chan 8:00, Summer Festival Firework
 * Dragon 15:00 (final; enrages at 16:30). Kept wholesome: the most revealing
 * thing on screen is a crab's opinion - no people, only crabs, gulls, melons
 * and a very friendly octopus.
 *
 * Noon Sun -> Golden Hour -> Dusk -> Festival Night over the 15 minutes to the
 * final boss; sea spray all day, festival sparks after dusk. Beach balls pop
 * into confetti, coolers always hold something chilled.
 */
import type { SpawnPhase, StageDef, TimelineEvent } from "../stage";

const EARLY = { crab_kun: 3, seagull: 2, watermelon: 0.6 };
const MID = { crab_kun: 2.5, seagull: 2, tiny_shark: 1.5, watermelon: 1 };
const L1 = { crab_kun: 2, seagull: 2, tiny_shark: 1.5, jellyfish: 1.5 };
const L2 = { ...L1, watermelon: 1 };
const L3 = { ...L2, sandcastle_golem: 0.5 };
const ALL = { crab_kun: 2, seagull: 1.8, tiny_shark: 1.6, jellyfish: 1.5, watermelon: 1.2, sandcastle_golem: 0.9 };

export const BEACH_PHASES: SpawnPhase[] = [
  { from: 0, to: 60, mix: EARLY, rate: [1.8, 3.2], max: 65 },
  { from: 60, to: 150, mix: MID, rate: [3.4, 5], max: 120 },
  { from: 150, to: 270, mix: L1, rate: [5, 7.5], max: 160 },
  { from: 270, to: 390, mix: L2, rate: [8, 11], max: 190 },
  { from: 390, to: 480, mix: L3, rate: [12, 15], max: 220 },
  { from: 480, to: 510, mix: L3, rate: [15, 15], max: 225 },
  { from: 510, to: 720, mix: ALL, rate: [17, 25], max: 250 },
  { from: 720, to: 900, mix: ALL, rate: [25, 32], max: 270 },
  { from: 900, to: 1e9, mix: ALL, rate: [32, 32], max: 270 },
];

export const BEACH_EVENTS: TimelineEvent[] = [
  { at: 45, kind: "swarmLine", enemy: "seagull", count: 12, speed: 85, label: "SEAGULLS!" },
  { at: 100, kind: "encircle", enemy: "crab_kun", count: 22, label: "CRAB CIRCLE!" },
  { at: 150, kind: "elite" },
  { at: 200, kind: "laneCharge", enemy: "watermelon", count: 6, lines: 3, speed: 140, label: "WATERMELON ROLL!" },
  { at: 240, kind: "tideSweep", duration: 6, speed: 40, label: "HIGH TIDE!" },
  { at: 270, kind: "elite" },
  { at: 330, kind: "batStorm", enemy: "seagull", count: 12, lines: 6, duration: 6, speed: 110, label: "SEAGULL DIVE!" },
  { at: 375, kind: "elite" },
  { at: 420, kind: "encircle", enemy: "tiny_shark", count: 24, label: "...fin." },
  { at: 450, kind: "elite" },
  { at: 480, kind: "boss", enemy: "kraken_chan", spawnMul: 0.45 },
  { at: 525, kind: "elite" },
  { at: 555, kind: "laneCharge", enemy: "watermelon", count: 10, lines: 4, speed: 140, label: "WATERMELON ROLL!" },
  { at: 585, kind: "elite" },
  { at: 615, kind: "tideSweep", duration: 8, speed: 40, label: "HIGH TIDE!" },
  { at: 645, kind: "elite" },
  { at: 675, kind: "encircle", enemy: "jellyfish", count: 26, label: "JELLY RING!" },
  { at: 705, kind: "elite" },
  { at: 735, kind: "batStorm", enemy: "seagull", count: 14, lines: 7, duration: 7, speed: 115, label: "SEAGULL DIVE!" },
  { at: 765, kind: "elite" },
  { at: 795, kind: "flood", enemy: "crab_kun", count: 60, duration: 6, label: "CRAB MIGRATION!" },
  { at: 825, kind: "elite" },
  { at: 855, kind: "encircle", enemy: "sandcastle_golem", count: 8, label: "SANDCASTLE SIEGE!" },
  { at: 870, kind: "elite" },
  { at: 900, kind: "boss", enemy: "firework_dragon", spawnMul: 0.4 },
];

export const beachEpisode: StageDef = {
  id: "beach_episode",
  name: "Beach Episode",
  subtitle: "Episode 4: The Obligatory Beach Episode (Crabs Only)",
  blurb: "sand, sun, sidestepping crabs, fireworks after dark",
  order: 4,
  duration: 960,
  rewardMul: 5,
  requires: "shoujo_academy",
  bpm: 128,

  phases: BEACH_PHASES,
  events: BEACH_EVENTS,
  // intended clear power P5 (~30 h, ARCHITECTURE section 6): a x7.5 toughness tier, front-loaded (x11 HP at 1:00,
  // x18 at 3:00, x63 at 8:00, x245 at 15:00: x23 growth across the stage), x1.4 spawns, +15 % enemy speed, contact x1.8
  // ramping +16 %/min (x5.8 at 15:00: armour and HP decide the late game); watermelons spit seeds from 0:30
  // (verification pass: tier 5.5 -> 7.5, pace 0.55 -> 0.6, Kraken-chan 270k, Firework Dragon 430k: first clear
  // ~11 h -> ~20 h for the average player, EXPANSION section 2: 15-25 h)
  scaling: { hp: 7.5, curve: [0.65, 0.03, 0.032], pace: 0.6, dmg: 1.8, dmgPerMinute: 0.16, dmgFrom: 1, spawn: 1.4, speed: 1.15 },
  opening: { enemy: "crab_kun", count: 12 },
  finalBoss: "firework_dragon",
  enrageAt: 990,
  props: { ids: ["prop_beachball", "prop_cooler"], interval: 16, max: 4 },
  endless: {
    hpPerMinute: 0.4,
    spawnPerMinute: 0.09,
    eliteEvery: 45,
    elites: 2,
    bossEvery: 120,
    rematches: ["kraken_chan", "firework_dragon"],
    bossHpPerLoop: 0.5,
    bossSpawnMul: 0.5,
  },

  music: { battle: "beach", boss: "boss_beach", final: "boss_beach" },
  clearColor: 0xfff0c9,
  tiles: {
    sprite: "tile_beach",
    rules: [
      // wet tide-pool patches
      { noise: { freq: 0.05, seed: 41, above: 0.58 }, frames: [6] },
      // footprints / raked sand trails
      { noise: { freq: 0.1, ox: 9, oy: 27, seed: 13, above: 0.52 }, hash: { below: 0.5 }, frames: [7] },
      { hash: { above: 0.975 }, frames: [5] },
      { hash: { above: 0.94 }, frames: [4] },
    ],
    base: { frames: [0, 1, 2, 3], mul: 1000 },
  },
  deco: [
    {
      kind: "scatter",
      cell: 24,
      base: 0.14,
      noise: 0.45,
      freq: 0.14,
      seed: 37,
      salt: 4,
      items: [
        { sprite: "deco_shell", upTo: 0.35 },
        { sprite: "deco_beach_grass", upTo: 0.55 },
        { sprite: "deco_sand_bucket", upTo: 0.68, shadow: 6 },
        { sprite: "deco_beach_rock", upTo: 0.84, shadow: 9 },
        { sprite: "deco_parasol", upTo: 0.92, shadow: 18 },
        { sprite: "deco_mini_sandcastle", upTo: 1, shadow: 10 },
      ],
    },
    { kind: "tall", sprite: "deco_palm", cell: 104, chance: 0.35, salt: 4, shadow: 22, sway: { speed: 0.9, above: 0.3 }, canopy: { r: 18, h: 30 }, flipAbove: 0.5 },
  ],
  // Noon Sun -> Golden Hour -> Dusk -> Festival Night
  grade: [
    { at: 0, grade: { tint: [1.04, 1.0, 0.95], lift: [0.02, 0.01, 0.0], saturation: 1.1, contrast: 1.04, brightness: 1.04, hue: 0 } },
    { at: 0.5, grade: { tint: [1.08, 0.95, 0.86], lift: [0.06, 0.02, 0.0], saturation: 1.08, contrast: 1.05, brightness: 1.0, hue: 0 } },
    { at: 0.85, grade: "dusk" },
    { at: 1, grade: { tint: [0.86, 0.86, 1.02], lift: [0.04, 0.01, 0.09], saturation: 1.1, contrast: 1.06, brightness: 0.95, hue: 0 } },
  ],
  ambient: {
    base: [
      { at: 0, petals: 0, motes: 12, fireflies: 0 },
      { at: 0.8, petals: 0, motes: 12, fireflies: 0 },
      { at: 1, petals: 0, motes: 10, fireflies: 16 },
    ],
    layers: [
      // sea spray
      { sprite: "fx_px", motion: "rise", colors: [0xffffff, 0xbafff6, 0xb0d8ff], density: [{ at: 0, n: 8 }, { at: 1, n: 12 }], speed: [6, 14], sway: 10, alpha: 0.6 },
      // festival sparks after dusk
      {
        sprite: "fx_spark",
        motion: "rise",
        colors: [0xffe14d, 0xff9a3d, 0xff7ab8],
        density: [{ at: 0, n: 0 }, { at: 0.85, n: 0 }, { at: 1, n: 10 }],
        speed: [8, 16],
        sway: 6,
        glow: true,
      },
    ],
  },
  victory: { fx: "dawn", title: "SUMMER'S OVER!", line: "see you at the next festival" },

  onStart(w) {
    // coolers always hold something chilled: an extra onigiri when one breaks (unless food is censored)
    w.hooks.on("prop", (h) => {
      if (!w.difficulty.food) return;
      const items = w.enemies.items;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = items[i];
        if (!e.dead || e.def.id !== "prop_cooler") continue;
        if (Math.abs(e.x - h.x) > 0.5 || Math.abs(e.y - h.y) > 0.5) continue;
        if (w.player.hp < w.player.maxHp) w.dropPickup("onigiri", h.x, h.y - 2, 1);
        else w.dropPickup("coin", h.x, h.y - 2, 2);
        return;
      }
    });
  },
};

export const stages: StageDef[] = [beachEpisode];
