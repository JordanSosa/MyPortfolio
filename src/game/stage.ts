/**
 * Stage definitions (docs/EXPANSION.md §10). PURE data + optional sim hooks:
 * one file per stage in src/game/stages/ (`export const stages: StageDef[]`),
 * auto-registered in registry.ts (STAGES). Everything a stage changes lives
 * here, so a new stage never edits shared code:
 *
 *   sim   timeline (spawn phases + one-shot events), opening ring, props,
 *         bosses / final boss / enrage, endless ("Filler Arc") tuning, hooks
 *   view  ground tiles + region rules, deco layers, clear colour, colour-grade
 *         keyframes, ambient particles, music, victory sequence texts
 *
 * The view reads the visual parts (src/view/stage-view.ts); the sim never
 * interprets them. Grade keyframes may name a render preset ("day" / "dusk" /
 * "night", resolved by the view) or give inline values.
 */
import type { StageInfo } from "./defs";
import type { Enemy } from "./types";
import type { World } from "./world";

// ---------------------------------------------------------------- timeline
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
  /** Banner text for the event's `waveIncoming` (e.g. "POP QUIZ!"); default: the kind's banner. */
  label?: string;
  /** Bullet sprite (bulletRain-style events). */
  sprite?: string;
}

// ---------------------------------------------------------------- visuals (read by the view)
export type GradeTriple = readonly [number, number, number];

/** Colour grade values (same fields as render/post Grade; duplicated so src/game stays render-free). */
export interface StageGrade {
  tint: GradeTriple;
  lift: GradeTriple;
  saturation: number;
  contrast: number;
  brightness: number;
  hue: number;
}

/** A grade keyframe at normalized run time `at` (0..1 of StageDef.gradeSpan). */
export interface GradeKey {
  at: number;
  /** A render preset name ("day" | "dusk" | "night" | "neutral" | "dim") or inline values. */
  grade: string | StageGrade;
}

/** Densities of the engine's ambient layer (fx/ambient.ts) at normalized time `at`. */
export interface AmbientKey {
  at: number;
  petals: number;
  motes: number;
  fireflies: number;
}

/**
 * An extra screen-space ambient particle layer drawn by the view (sprinkles,
 * snow, bubbles, glitch motes...). Densities follow `density` keyframes.
 */
export interface AmbientLayer {
  /** Atlas sprite id (all its frames are used for a twinkle / tumble). */
  sprite: string;
  /** "fall" (petals, snow, sprinkles), "rise" (bubbles, embers), "drift" (dust), "glitch" (jittery blinking motes). */
  motion: "fall" | "rise" | "drift" | "glitch";
  colors: readonly number[];
  /** Particle count at normalized time (piecewise linear). */
  density: readonly { at: number; n: number }[];
  /** Speed range along the motion axis (px/s). */
  speed: readonly [number, number];
  /** Sideways sway amplitude (px/s). */
  sway?: number;
  scale?: readonly [number, number];
  alpha?: number;
  /** Additive + glow (sparkles, glitch motes). */
  glow?: boolean;
  /** Tumble / spin speed (rad/s). */
  spin?: number;
}

/** Selects a frame from a per-cell hash h in [0, 1). */
export interface FramePick {
  /** Frames, chosen by one of the modes below (default: uniform by h). */
  frames: readonly number[];
  /** Threshold mode: frames[i] for the first cut with h < cuts[i], else the last frame. */
  cuts?: readonly number[];
  /** Hash-scramble mode: frames[floor(h * mul) % frames.length]. */
  mul?: number;
  /** Weighted mode: frames[i] with probability weights[i]. */
  weights?: readonly number[];
}

/** Low-frequency value noise condition (core/math noise2). */
export interface NoiseCond {
  freq: number;
  ox?: number;
  oy?: number;
  seed: number;
  /** Matches when noise > above. */
  above?: number;
  /** Matches when noise < below. */
  below?: number;
}

/** A ground region rule: first matching rule picks the tile frame. */
export interface TileRule extends FramePick {
  noise?: NoiseCond;
  /** Per-tile hash window: above < h < below. */
  hash?: { above?: number; below?: number };
}

export interface StageTiles {
  /** Atlas sprite id of the 16 px ground tile sheet (8 variants). */
  sprite: string;
  /** Region rules in priority order (paths, patches, sparkles...). */
  rules: readonly TileRule[];
  /** Fill when no rule matched. */
  base: FramePick;
}

export interface DecoItem {
  sprite: string;
  /** Cumulative upper bound of the item roll (items sorted, the last one should be 1). */
  upTo: number;
  /** Shadow width (0 = none). */
  shadow?: number;
  /** Pulsing glow under the sprite (glowing mushrooms / crystals). */
  glow?: { r: number; color: number };
}

/** Small scattered deco on a `cell` grid; density = (base + noise(cx, cy) x noise) x view density. */
export interface DecoScatter {
  kind: "scatter";
  cell: number;
  base: number;
  noise: number;
  freq: number;
  seed: number;
  /** Decorrelates this layer's hashes from other stages (0 = the original meadow hashes). */
  salt?: number;
  items: readonly DecoItem[];
}

/** Big rare deco (trees): one candidate per `cell`, 2-frame sway, canopy fades when the hero walks behind. */
export interface DecoTall {
  kind: "tall";
  sprite: string;
  cell: number;
  /** Candidate kept when its hash < chance x view density. */
  chance: number;
  salt?: number;
  shadow: number;
  /** Sway: frame 1 while sin(time x speed + h x 40) > above. */
  sway: { speed: number; above: number };
  /** Canopy fade around the hero (sprite px radius, canopy centre height). */
  canopy?: { r: number; h: number };
  /** Mirrored when its hash > flipAbove. */
  flipAbove: number;
}

export type DecoLayer = DecoScatter | DecoTall;

/** Music tracks (audio MusicTrack ids; kept as strings so src/game stays audio-free). */
export interface StageMusic {
  battle: string;
  boss: string;
  final: string;
}

// ---------------------------------------------------------------- endless
/** "Filler Arc" tuning after the final boss (RunConfig.endless). */
export interface EndlessDef {
  /** Enemy HP x (1 + hpPerMinute x endless minutes), on top of the normal time scaling. */
  hpPerMinute: number;
  /** Spawn rate x (1 + spawnPerMinute x endless minutes). */
  spawnPerMinute: number;
  /** Spawning phase (mix / base rate / cap); default: the last timeline phase. */
  phase?: SpawnPhase;
  /** Seconds between elite waves; each wave brings `elites` + 1 per wave elites. */
  eliteEvery: number;
  elites: number;
  /** Seconds between boss rematches (cycling through `rematches`). */
  bossEvery: number;
  /** Boss ids to rematch (default: every boss of the stage timeline, final included). */
  rematches?: readonly string[];
  /** Rematch boss HP x (1 + bossHpPerLoop x rematch number). */
  bossHpPerLoop: number;
  /** Spawn-rate multiplier while a rematch boss lives. */
  bossSpawnMul: number;
}

// ---------------------------------------------------------------- toughness
/**
 * Per-stage enemy toughness (docs/ARCHITECTURE.md §6): each stage tunes its own
 * horde against the account power it is meant to be cleared at, instead of one
 * global time curve (a 20-minute stage on the 10-minute curve ends at x100+ HP).
 * Missing fields take the CFG defaults (`stageScaling`).
 */
export interface StageScaling {
  /** Regular-enemy (and elite) HP x this, on top of each enemy's own base HP. */
  hp: number;
  /** HP time curve x (1 + a m + b m^2 + c m^3), m = run minutes x `pace`. */
  curve: readonly [number, number, number];
  /** Run minutes are multiplied by this for the HP curve (a long stage at < 1 stretches the same curve). */
  pace: number;
  /** Enemy contact / shot damage x this (bosses keep their own numbers). */
  dmg: number;
  /** Damage ramp x (1 + dmgPerMinute x max(0, m - dmgFrom)), real minutes. */
  dmgPerMinute: number;
  dmgFrom: number;
  /** Boss HP x this. */
  bossHp: number;
  /** Adaptive toughness ceiling (Director.adapt, extra HP fraction for new spawns on an empty screen). */
  adaptMax: number;
  /** Continuous spawn rate x this (every phase). */
  spawn: number;
  /** Phase max-alive caps x this (the device cap still applies). */
  cap: number;
  /** Regular-enemy move speed x this (a strong account outruns slow melee: later stages close in faster). */
  speed: number;
}

// ---------------------------------------------------------------- the stage
export interface StageDef {
  id: string;
  name: string;
  /** Episode-style subtitle. */
  subtitle: string;
  blurb?: string;
  /** 1-based order on the stage map. */
  order: number;
  /** Run length in seconds (the final boss arrives before this; without a registered final boss, surviving it wins). */
  duration: number;
  /** Coin / gem reward multiplier (meta). */
  rewardMul: number;
  /** Stage id that must be cleared first (meta gating); undefined = available from the start. */
  requires?: string;
  /** Battle theme tempo (beat-synced weapons such as Idol Lightstick Wave); default 140. */
  bpm?: number;

  // ---- sim
  /** Continuous spawning phases (sorted, contiguous; the last one runs forever). */
  phases: readonly SpawnPhase[];
  /** One-shot events (bosses included: kind "boss"). */
  events: readonly TimelineEvent[];
  /** Enemy toughness for this stage (defaults: CFG, see StageScaling). */
  scaling?: Partial<StageScaling>;
  /** Run-start ring of easy enemies so the first level-up lands fast. */
  opening: { enemy: string; count: number };
  /** Final boss id: its death clears the stage (victory, or the Filler Arc when endless). */
  finalBoss: string;
  /** The final boss enrages at this run time (s) while alive. */
  enrageAt: number;
  /** Destructible props: ids (undefined = every registered prop), spawn interval (s), max alive. */
  props: { ids?: readonly string[]; interval: number; max: number };
  endless: EndlessDef;

  // ---- view
  music: StageMusic;
  /** Scene clear colour (shows only where no ground is drawn). */
  clearColor: number;
  tiles: StageTiles;
  deco: readonly DecoLayer[];
  /** Seconds that normalized time 0..1 spans for grade / ambient keyframes (default: the final boss's arrival). */
  gradeSpan?: number;
  grade: readonly GradeKey[];
  ambient: { base: readonly AmbientKey[]; layers?: readonly AmbientLayer[] };
  /** Victory sequence (view): "dawn" = sunrise sweep + fireworks; texts stamped at the flash. */
  victory: { fx: "dawn"; title: string; line: string };

  // ---- optional sim hooks
  /** Run start (after relics / talents / twists are installed). */
  onStart?(w: World): void;
  /**
   * The final boss died (before the default victory / Filler Arc). Return true
   * when the stage takes over the ending (a custom victory sequence then calls
   * w.win() / w.startEndless() itself).
   */
  onFinalBossKilled?(w: World, boss: Enemy): boolean | void;
}

/** Ids of the timeline's bosses in order of appearance (mid bosses, then the final boss). */
export function stageBosses(def: StageDef): string[] {
  const out: string[] = [];
  const evs = [...def.events].sort((a, b) => a.at - b.at);
  for (const e of evs) if (e.kind === "boss" && e.enemy && !out.includes(e.enemy)) out.push(e.enemy);
  if (def.finalBoss && !out.includes(def.finalBoss)) out.push(def.finalBoss);
  else if (def.finalBoss) {
    // the final boss is always last
    out.splice(out.indexOf(def.finalBoss), 1);
    out.push(def.finalBoss);
  }
  return out;
}

/** Run time (s) the final boss's warning starts (its timeline event), or the stage duration. */
export function finalBossAt(def: StageDef): number {
  for (const e of def.events) if (e.kind === "boss" && e.enemy === def.finalBoss) return e.at;
  return def.duration;
}

/** Enemy ids the stage spawns (phase mixes + events), bosses / props excluded. */
export function stageEnemies(def: StageDef): string[] {
  const out: string[] = [];
  const add = (id: string | undefined): void => {
    if (id && !out.includes(id)) out.push(id);
  };
  for (const p of def.phases) for (const id of Object.keys(p.mix)) if (p.mix[id] > 0) add(id);
  if (def.endless.phase) for (const id of Object.keys(def.endless.phase.mix)) add(id);
  add(def.opening.enemy);
  for (const e of def.events) if (e.kind !== "boss" && e.kind !== "elite") add(e.enemy);
  return out;
}

/** Spawning phase for run time t. */
export function stagePhaseAt(def: StageDef, t: number): SpawnPhase {
  const ph = def.phases;
  for (let i = 0; i < ph.length; i++) if (t >= ph[i].from && t < ph[i].to) return ph[i];
  return ph[ph.length - 1];
}

/** Seconds that grade / ambient normalized time spans. */
export function stageGradeSpan(def: StageDef): number {
  return def.gradeSpan ?? finalBossAt(def);
}

/** The metadata the account layer (src/meta) needs. */
export function stageInfo(def: StageDef): StageInfo {
  return {
    id: def.id,
    name: def.name,
    subtitle: def.subtitle,
    order: def.order,
    duration: def.duration,
    bosses: stageBosses(def),
    rewardMul: def.rewardMul,
    finalBoss: def.finalBoss,
    enemies: stageEnemies(def),
    endless: true,
    blurb: def.blurb,
    requires: def.requires,
  };
}
