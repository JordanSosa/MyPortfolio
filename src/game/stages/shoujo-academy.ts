/**
 * Stage 3: SHOUJO ACADEMY (docs/content/stages.md §2). 14:00, Student
 * Council President 7:00, The Bishounen Who Never Notices You 13:00 (final;
 * enrages at 14:30). Morning Assembly -> Golden After-School -> Confession
 * Sunset -> Rooftop Twilight; cherry blossoms fall forever, sunlit hallway
 * dust drifts. The victory is "CLASS DISMISSED!".
 *
 * Roster (src/game/enemies/): exam_paper, love_letter, tsundere_slime,
 * hall_monitor, council_ninja, transfer_student (teleports in by its own rule);
 * props prop_school_desk / prop_vending (the vending machine also drops a
 * chilled can that counts as food: onStart's prop hook). New event kinds:
 * teleportIn, schoolBell (director/events-s2.ts).
 */
import type { SpawnPhase, StageDef, TimelineEvent } from "../stage";
import type { World } from "../world";
import { dropSnack } from "../weapons/_heroes-a";

const EARLY = { exam_paper: 3, love_letter: 2, council_ninja: 0.4 };
const MID = { exam_paper: 2, love_letter: 2, tsundere_slime: 2, council_ninja: 0.8, hall_monitor: 0.6 };
const L1 = { exam_paper: 2, love_letter: 2, tsundere_slime: 2, hall_monitor: 1.2 };
const L2 = { exam_paper: 2, love_letter: 2, tsundere_slime: 2, hall_monitor: 1.4, council_ninja: 0.8 };
const L3 = { ...L2, transfer_student: 0.6 };
const ALL = { exam_paper: 1.8, love_letter: 2, tsundere_slime: 1.8, hall_monitor: 1.4, council_ninja: 1.2, transfer_student: 1 };

export const ACADEMY_PHASES: SpawnPhase[] = [
  { from: 0, to: 60, mix: EARLY, rate: [1.8, 3.2], max: 65 },
  { from: 60, to: 150, mix: MID, rate: [3.4, 5], max: 120 },
  { from: 150, to: 240, mix: L1, rate: [5, 7], max: 160 },
  { from: 240, to: 360, mix: L2, rate: [7.5, 11], max: 190 },
  { from: 360, to: 420, mix: L3, rate: [12, 15], max: 220 },
  { from: 420, to: 450, mix: L3, rate: [15, 15], max: 220 },
  { from: 450, to: 600, mix: ALL, rate: [17, 24], max: 250 },
  { from: 600, to: 780, mix: ALL, rate: [24, 32], max: 270 },
  { from: 780, to: 1e9, mix: ALL, rate: [32, 32], max: 270 },
];

export const ACADEMY_EVENTS: TimelineEvent[] = [
  { at: 50, kind: "swarmLine", enemy: "love_letter", count: 14, speed: 80 },
  { at: 100, kind: "encircle", enemy: "exam_paper", count: 24, label: "POP QUIZ!" },
  { at: 150, kind: "elite" },
  { at: 200, kind: "teleportIn", enemy: "transfer_student", count: 3, label: "TRANSFER STUDENTS?!" },
  { at: 240, kind: "schoolBell", count: 8, label: "THE BELL RINGS!" },
  { at: 270, kind: "elite" },
  { at: 300, kind: "batStorm", enemy: "love_letter", count: 12, lines: 6, duration: 6, speed: 90, label: "CONFESSION SEASON!" },
  { at: 345, kind: "elite" },
  { at: 380, kind: "encircle", enemy: "exam_paper", count: 36, label: "POP QUIZ!" },
  { at: 420, kind: "boss", enemy: "council_president", spawnMul: 0.45 },
  { at: 465, kind: "elite" },
  { at: 495, kind: "teleportIn", enemy: "transfer_student", count: 6, label: "TRANSFER STUDENTS?!" },
  { at: 525, kind: "elite" },
  { at: 555, kind: "schoolBell", count: 12, label: "THE BELL RINGS!" },
  { at: 585, kind: "elite" },
  { at: 615, kind: "batStorm", enemy: "love_letter", count: 14, lines: 7, duration: 7, speed: 95, label: "CONFESSION SEASON!" },
  { at: 645, kind: "elite" },
  { at: 675, kind: "encircle", enemy: "tsundere_slime", count: 32, label: "I-IT'S NOT LIKE WE SURROUNDED YOU!" },
  { at: 705, kind: "elite" },
  { at: 735, kind: "flood", enemy: "exam_paper", count: 60, duration: 6, label: "FINALS WEEK!" },
  { at: 765, kind: "elite" },
  { at: 780, kind: "boss", enemy: "bishounen", spawnMul: 0.4 },
];

/** The vending machine's chilled can (counts as food; censored by the Censored twist). */
function vendingLoot(w: World, x: number, y: number): void {
  if (w.difficulty.food) dropSnack(w, "icon_relic_expired_energy_drink", x, y, 12, 0xb0d8ff);
}

export const shoujoAcademy: StageDef = {
  id: "shoujo_academy",
  name: "Shoujo Academy",
  subtitle: "Episode 3: The Transfer Student Is Suspiciously Powerful",
  blurb: "cherry blossoms, hall passes, unspoken feelings",
  order: 3,
  duration: 840,
  rewardMul: 2,
  requires: "candy_kingdom",
  bpm: 136,

  phases: ACADEMY_PHASES,
  events: ACADEMY_EVENTS,
  // intended clear power P4 (~15 h, ARCHITECTURE section 6): front-loaded (x5.0 HP at 1:00, x9.3 at 3:00, x28 at 7:00,
  // x106 at 13:00), x1.4 spawns, +15 % enemy speed, contact x1.8 (+4 %/min); council ninjas throw shurikens from 0:30
  // (verification pass: tier 2.5 -> 3.4, pace 0.62 -> 0.68, President 125k, Bishounen 230k: first clear 5 h -> ~11 h)
  scaling: { hp: 3.4, curve: [0.65, 0.03, 0.032], pace: 0.68, dmg: 1.8, dmgPerMinute: 0.04, dmgFrom: 1, spawn: 1.4, speed: 1.15 },
  opening: { enemy: "exam_paper", count: 12 },
  finalBoss: "bishounen",
  enrageAt: 870,
  props: { ids: ["prop_school_desk", "prop_vending"], interval: 16, max: 4 },
  endless: {
    hpPerMinute: 0.38,
    spawnPerMinute: 0.08,
    eliteEvery: 45,
    elites: 2,
    bossEvery: 120,
    rematches: ["council_president", "bishounen"],
    bossHpPerLoop: 0.5,
    bossSpawnMul: 0.5,
  },

  music: { battle: "academy", boss: "boss_academy", final: "boss_academy" },
  clearColor: 0xe9e3f7,
  tiles: {
    sprite: "tile_academy",
    rules: [
      // running track
      { noise: { freq: 0.07, seed: 17, above: 0.55 }, frames: [7] },
      // fallen sakura petals
      { noise: { freq: 0.18, ox: -12, oy: 44, seed: 9, above: 0.4 }, hash: { below: 0.7 }, frames: [4] },
      { hash: { above: 0.985 }, frames: [5] },
      { hash: { above: 0.955 }, frames: [6] },
    ],
    base: { frames: [0, 1, 2, 3], mul: 1000 },
  },
  deco: [
    {
      kind: "scatter",
      cell: 24,
      base: 0.16,
      noise: 0.45,
      freq: 0.15,
      seed: 29,
      salt: 3,
      items: [
        { sprite: "deco_petal_pile", upTo: 0.38 },
        { sprite: "deco_hedge", upTo: 0.6, shadow: 10 },
        { sprite: "deco_shoe_locker", upTo: 0.75, shadow: 10 },
        { sprite: "deco_school_sign", upTo: 0.88, shadow: 6 },
        { sprite: "deco_school_lamp", upTo: 1, shadow: 5, glow: { r: 9, color: 0xfff7b0 } },
      ],
    },
    {
      kind: "tall",
      sprite: "deco_sakura_tree",
      cell: 88,
      chance: 0.45,
      salt: 3,
      shadow: 26,
      sway: { speed: 1.2, above: 0.3 },
      canopy: { r: 17, h: 24 },
      flipAbove: 0.25,
    },
  ],
  // Morning Assembly -> Golden After-School -> Confession Sunset -> Rooftop Twilight
  grade: [
    { at: 0, grade: { tint: [1.0, 1.0, 1.03], lift: [0.01, 0.01, 0.03], saturation: 1.04, contrast: 1.02, brightness: 1.03, hue: 0 } },
    { at: 0.45, grade: { tint: [1.06, 0.98, 0.9], lift: [0.05, 0.02, 0.0], saturation: 1.06, contrast: 1.03, brightness: 1.0, hue: 0 } },
    { at: 0.8, grade: { tint: [1.08, 0.9, 0.92], lift: [0.07, 0.0, 0.04], saturation: 1.08, contrast: 1.05, brightness: 0.97, hue: 0 } },
    { at: 1, grade: { tint: [0.92, 0.88, 1.02], lift: [0.04, 0.0, 0.08], saturation: 1.06, contrast: 1.06, brightness: 0.96, hue: 0 } },
  ],
  ambient: {
    base: [
      { at: 0, petals: 18, motes: 8, fireflies: 0 },
      { at: 0.8, petals: 22, motes: 12, fireflies: 0 },
      { at: 1, petals: 14, motes: 14, fireflies: 10 },
    ],
    layers: [
      {
        // sunlit hallway dust
        sprite: "fx_px",
        motion: "drift",
        colors: [0xfff7b0, 0xffffff],
        density: [
          { at: 0, n: 10 },
          { at: 1, n: 6 },
        ],
        speed: [3, 8],
        alpha: 0.5,
        glow: true,
      },
    ],
  },
  victory: { fx: "dawn", title: "CLASS DISMISSED!", line: "graduation was a bit dramatic this year" },

  onStart(w) {
    // the vending machine drops a chilled can (find the prop that just broke at the hook position)
    w.hooks.on("prop", (h) => {
      const items = w.enemies.items;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = items[i];
        if (!e.dead || e.x !== h.x || e.y !== h.y || !e.def.prop) continue;
        if (e.def.id === "prop_vending") vendingLoot(w, e.x, e.y);
        return;
      }
    });
  },
};

export const stages: StageDef[] = [shoujoAcademy];
