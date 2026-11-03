/**
 * Stage 5: THE FINAL ARC (docs/content/stages.md §4) - "The Final Arc
 * (Final) (Real) (v2)". 20:00, Truck-kun 8:00, Rival-chan 14:00,
 * CANCEL-SAMA the Network Executive 19:00 (final; enrages at 20:30). The show
 * running out of money in real time: a storyboard-paper void, film reels,
 * pencil-sketch trees, glitch crystals - the further you go, the more of the
 * world is literally unfinished.
 *
 * Dramatic Sunset -> Climax Red -> Void -> Final Void (Cancel-sama's phases
 * override it while he lives: stageFx directives, src/view/stage-view.ts).
 * Commercial breaks, flashbacks ("PREVIOUSLY ON..."), Plot Holes (at most 3).
 */
import type { SpawnPhase, StageDef, TimelineEvent } from "../stage";
import { renewed } from "../bosses/cancel-sama";
import { truckTitles } from "../bosses/truck-kun";

const EARLY = { filler_goon: 3, animation_error: 1 };
const MID = { filler_goon: 3, animation_error: 2, mini_truck: 0.5 };
const L1 = { filler_goon: 2.5, animation_error: 2, mini_truck: 0.8, shadow_clone: 0.6 };
const L2 = { ...L1, plot_hole: 0.15 };
const ALL = { filler_goon: 2.2, animation_error: 2, mini_truck: 1, shadow_clone: 1, plot_hole: 0.2 };
const LATE = { filler_goon: 2, animation_error: 2.2, mini_truck: 1.2, shadow_clone: 1.3, plot_hole: 0.25 };

export const FINALE_PHASES: SpawnPhase[] = [
  { from: 0, to: 60, mix: EARLY, rate: [2, 3.5], max: 70 },
  { from: 60, to: 180, mix: MID, rate: [3.5, 6], max: 130 },
  { from: 180, to: 330, mix: L1, rate: [6, 10], max: 180 },
  { from: 330, to: 480, mix: L2, rate: [10, 15], max: 220 },
  { from: 480, to: 510, mix: L2, rate: [15, 15], max: 220 },
  { from: 510, to: 840, mix: ALL, rate: [17, 26], max: 250 },
  { from: 840, to: 870, mix: ALL, rate: [24, 24], max: 250 },
  { from: 870, to: 1140, mix: LATE, rate: [26, 34], max: 280 },
  { from: 1140, to: 1e9, mix: LATE, rate: [30, 30], max: 280 },
];

export const FINALE_EVENTS: TimelineEvent[] = [
  { at: 60, kind: "swarmLine", enemy: "filler_goon", count: 14, speed: 60, label: "FILLER!" },
  { at: 120, kind: "laneCharge", enemy: "mini_truck", count: 3, lines: 3, speed: 200, label: "TRUCKS?!" },
  { at: 150, kind: "elite" },
  { at: 210, kind: "commercialBreak", duration: 4, enemy: "filler_goon", count: 40, label: "WE'LL BE RIGHT BACK!" },
  { at: 270, kind: "elite" },
  { at: 300, kind: "teleportIn", enemy: "plot_hole", count: 2, label: "PLOT HOLES!" },
  { at: 345, kind: "elite" },
  { at: 390, kind: "flashback", count: 40, label: "PREVIOUSLY ON..." },
  { at: 435, kind: "elite" },
  { at: 480, kind: "boss", enemy: "truck_kun_boss", spawnMul: 0.45 },
  { at: 540, kind: "elite" },
  { at: 570, kind: "laneCharge", enemy: "mini_truck", count: 5, lines: 5, speed: 200, label: "RUSH HOUR!" },
  { at: 600, kind: "elite" },
  { at: 630, kind: "commercialBreak", duration: 4, enemy: "animation_error", count: 40, label: "WE'LL BE RIGHT BACK!" },
  { at: 660, kind: "elite" },
  { at: 690, kind: "encircle", enemy: "shadow_clone", count: 10, label: "THEY'RE ALL YOU?!" },
  { at: 720, kind: "elite" },
  { at: 750, kind: "flashback", count: 50, label: "PREVIOUSLY ON..." },
  { at: 780, kind: "elite" },
  { at: 810, kind: "teleportIn", enemy: "plot_hole", count: 3, label: "PLOT HOLES!" },
  { at: 840, kind: "boss", enemy: "rival_chan", spawnMul: 0.45 },
  { at: 900, kind: "elite" },
  { at: 930, kind: "laneCharge", enemy: "mini_truck", count: 6, lines: 6, speed: 210, label: "RUSH HOUR!" },
  { at: 960, kind: "elite" },
  { at: 990, kind: "commercialBreak", duration: 4, enemy: "filler_goon", count: 60, label: "WE'LL BE RIGHT BACK!" },
  { at: 1020, kind: "elite" },
  { at: 1050, kind: "flashback", count: 60, label: "PREVIOUSLY ON..." },
  { at: 1080, kind: "elite" },
  { at: 1110, kind: "encircle", enemy: "shadow_clone", count: 14, label: "THEY'RE ALL YOU?!" },
  { at: 1140, kind: "boss", enemy: "cancel_sama", spawnMul: 0.35 },
];

export const finalArc: StageDef = {
  id: "final_arc",
  name: "The Final Arc",
  subtitle: "Episode 5: The Final Arc (Final) (Real) (v2)",
  blurb: "plot holes, rushed animation, and the network is watching",
  order: 5,
  duration: 1200,
  rewardMul: 2.2,
  requires: "beach_episode",
  bpm: 160,

  phases: FINALE_PHASES,
  events: FINALE_EVENTS,
  opening: { enemy: "filler_goon", count: 12 },
  finalBoss: "cancel_sama",
  enrageAt: 1230,
  props: { ids: ["prop_clapboard", "prop_crt_tv"], interval: 16, max: 4 },
  endless: {
    hpPerMinute: 0.45,
    spawnPerMinute: 0.1,
    eliteEvery: 40,
    elites: 3,
    bossEvery: 120,
    rematches: ["truck_kun_boss", "rival_chan", "cancel_sama"],
    bossHpPerLoop: 0.5,
    bossSpawnMul: 0.45,
  },

  music: { battle: "finale", boss: "boss_finale", final: "cancel" },
  clearColor: 0x2d1b45,
  tiles: {
    sprite: "tile_finale",
    rules: [
      // unfinished patches: the world the budget never coloured
      { noise: { freq: 0.08, seed: 53, above: 0.56 }, frames: [7] },
      { hash: { above: 0.975 }, frames: [5] },
      { hash: { above: 0.94 }, frames: [4] },
      { hash: { above: 0.9 }, frames: [6] },
    ],
    base: { frames: [0, 1, 2, 3], mul: 1000 },
  },
  deco: [
    {
      kind: "scatter",
      cell: 24,
      base: 0.14,
      noise: 0.5,
      freq: 0.15,
      seed: 61,
      salt: 5,
      items: [
        { sprite: "deco_film_reel", upTo: 0.25, shadow: 7 },
        { sprite: "deco_sketch_bush", upTo: 0.5 },
        { sprite: "deco_storyboard", upTo: 0.68, shadow: 8 },
        { sprite: "deco_broken_pillar", upTo: 0.84, shadow: 9 },
        { sprite: "deco_glitch_crystal", upTo: 1, shadow: 6, glow: { r: 10, color: 0x4fe6df } },
      ],
    },
    { kind: "tall", sprite: "deco_sketch_tree", cell: 100, chance: 0.38, salt: 5, shadow: 22, sway: { speed: 0.8, above: 0.4 }, canopy: { r: 17, h: 24 }, flipAbove: 0.5 },
  ],
  // Dramatic Sunset -> Climax Red -> Void -> Final Void
  grade: [
    { at: 0, grade: { tint: [1.08, 0.92, 0.88], lift: [0.06, 0.01, 0.03], saturation: 1.08, contrast: 1.06, brightness: 0.98, hue: 0 } },
    { at: 0.4, grade: { tint: [1.1, 0.86, 0.9], lift: [0.08, 0.0, 0.05], saturation: 1.1, contrast: 1.08, brightness: 0.96, hue: 0 } },
    { at: 0.75, grade: { tint: [0.9, 0.84, 1.04], lift: [0.05, 0.0, 0.1], saturation: 1.04, contrast: 1.08, brightness: 0.94, hue: 0 } },
    { at: 1, grade: { tint: [0.84, 0.82, 1.04], lift: [0.04, 0.0, 0.12], saturation: 1.0, contrast: 1.1, brightness: 0.92, hue: 0 } },
  ],
  ambient: {
    base: [
      { at: 0, petals: 0, motes: 14, fireflies: 0 },
      { at: 1, petals: 0, motes: 18, fireflies: 0 },
    ],
    layers: [
      {
        sprite: "fx_glitch",
        motion: "glitch",
        colors: [0xff7ab8, 0x4fe6df, 0x94e85e, 0xffffff],
        density: [{ at: 0, n: 6 }, { at: 1, n: 20 }],
        speed: [0, 0],
        alpha: 0.8,
        glow: true,
      },
    ],
  },
  victory: { fx: "dawn", title: "RENEWED FOR SEASON 2!!", line: "the network has approved another season" },

  onStart(w) {
    // Truck-kun meets its evil alternate-universe self when the hero IS Truck-kun (name card before the warning)
    truckTitles(w);
  },
  onFinalBossKilled(w) {
    // Cancel-sama's restoration: colour floods back, the resolution snaps back, the frame rate returns - then the default victory
    renewed(w);
    return false;
  },
};

export const stages: StageDef[] = [finalArc];
