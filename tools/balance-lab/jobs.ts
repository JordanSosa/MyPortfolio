/**
 * Balance lab jobs: short measurements on the REAL headless World + bot (run in the
 * worker processes, tools/balance-lab/worker.mjs; results cached by tools/balance-lab/main.ts).
 *
 *   gauge    damage / hits per second of a build (or one weapon) against a dense immortal crowd and a
 *            pinned boss (god mode, no director): the analytic model's calibration (like GAUGE=1)
 *   path     the bot's build at every level (level-ups + chests with the real offers, no combat)
 *   window   a run from 0:00 for a few minutes (level curve, kills, damage taken, early deaths)
 *   slice    a 60 s slice at minute N from a snapshot (build grown to the predicted level, timeline skipped)
 *   boss     a boss fight from a snapshot just before the boss's timeline event
 *   full     a whole run (the matrix's ground truth, for --full and validation)
 *   progression  a quick account progression sample (tools/progression.sim.ts under Vitest, with the overrides)
 */
import { stageDef } from "../../src/game/registry";
import { runGauge } from "./job-gauge";
import { runProgression } from "./job-prog";
import { playRun } from "./job-run";
import { runBoss, runCensus, runPath, runSlice } from "./job-snap";
import { applyOverrides, type Override } from "./overrides";
import type { CellSpec } from "./snapshot";

/** Sim step of every lab job (the matrix / probe default; within noise of the live 1/60 sub-step). */
export const DT = 1 / 30;

export interface GaugeJob {
  kind: "gauge";
  hero: string;
  /** Account checkpoint whose RunConfig the World gets (null = a default run: base stats). */
  cp: string | null;
  weapons: [string, number][];
  passives?: [string, number][];
  /** Stat multipliers / additions applied on top (cooldown x, area x, amount +, might x): elasticities. */
  stat?: { cooldown?: number; area?: number; amount?: number; might?: number };
  /** Seconds per mode (default 8). */
  T?: number;
  /**
   * Horde mode (kill throughput): mortal enemies of these HPs spawned at the screen edge like the director's,
   * walking in, `alive` of them kept on screen; kills / damage per second at each HP. Without it: the dense
   * immortal crowd + pinned boss (the weapon table's per-weapon numbers).
   */
  horde?: { hp: number[]; alive: number };
}

export interface GaugeResult {
  /** Damage / hits per second against the dense crowd, per weapon id and total. */
  dense: { dps: number; hps: number; by: Record<string, number> };
  boss: { dps: number; by: Record<string, number> };
  /** Horde mode: kills / damage per second at each enemy HP. */
  horde?: { hp: number; kps: number; dps: number }[];
}

export interface PathJob {
  kind: "path";
  hero: string;
  cp: string;
  seed: number;
  bot?: string;
  /** Levels to record (1..levels). */
  levels: number;
  /** An ordinary chest every N levels (a run's elites) and a golden one every M (its bosses). */
  chestEvery?: number;
}

export interface PathResult {
  /** builds[i] = the build at level i + 1 (after its picks), with the stats the model reads. */
  builds: { weapons: [string, number][]; passives: [string, number][]; stats: PathStats }[];
  startLevel: number;
  /** RunConfig.weaponDamage (mastery) of the cell. */
  weaponDamage: Record<string, number>;
}

/** The stats the analytic model reads (World.stats at that level + revives left). */
export interface PathStats {
  might: number;
  cooldown: number;
  area: number;
  amount: number;
  crit: number;
  critMult: number;
  bossDmg: number;
  maxHp: number;
  armor: number;
  regen: number;
  dmgReduction: number;
  growth: number;
  healMul: number;
  shield: number;
  shieldCd: number;
  revives: number;
  /** More enemies (spawn rate x (1 + curse)) that are a little tougher (HP x (1 + curse / 4)). */
  curse: number;
}

export interface WindowJob extends CellSpec {
  kind: "window";
  /** End time (s). */
  t1: number;
}

export interface Mark {
  t: number;
  level: number;
  hp: number;
  /** Cumulative damage taken / kills / damage dealt / XP earned by t. */
  dmg: number;
  kills: number;
  dealt: number;
  xp: number;
  /** Mean alive enemies over the last mark interval. */
  alive: number;
  adapt: number;
}

export interface RunRec {
  outcome: "clear" | "death" | "alive" | "timeout";
  end: number;
  level: number;
  kills: number;
  revives: number;
  marks: Mark[];
  bosses: { id: string; at: number; dur: number; left: number }[];
  killer: string;
  build: { weapons: [string, number][]; passives: [string, number][] };
  maxHp: number;
  steps: number;
}

export interface SliceJob extends CellSpec {
  kind: "slice";
  /** Slice start (s), length (s), god-mode warm-up before it (s). */
  at: number;
  len: number;
  warm: number;
  /** Snapshot build: level, ordinary / golden chests opened by then, adaptive toughness. */
  level: number;
  chests: number;
  golden: number;
  adapt: number;
}

export interface SliceRec {
  /** Damage taken over the slice, hits taken, time of death (-1 = survived; after revives), revives used. */
  dmg: number;
  hits: number;
  died: number;
  revives: number;
  minHp: number;
  kills: number;
  dealt: number;
  alive: number;
  cap: number;
  levelEnd: number;
  xp: number;
  maxHp: number;
  bossAlive: boolean;
}

export interface BossJob extends CellSpec {
  kind: "boss";
  boss: string;
  level: number;
  chests: number;
  golden: number;
  adapt: number;
  /** Give up after this many seconds of fight (default 360). */
  timeout?: number;
}

export interface BossRec {
  /** Fight length (s) to the kill, -1 = not killed. */
  ttk: number;
  /** The hero died during the fight (after revives) at this fight time, -1 = no. */
  died: number;
  left: number;
  dmg: number;
  hits: number;
  revives: number;
  maxHp: number;
  levelEnd: number;
  spawned: boolean;
}

export interface FullJob extends CellSpec {
  kind: "full";
  /** Stop at this run time (default: stage duration + 300 s). */
  tmax?: number;
}

/** Child spawns of a stage's enemies (splits, spores, dropped frames...) per director spawn, at a few run times. */
export interface CensusJob {
  kind: "census";
  stage: string;
  /** Run times to sample (s) and the seconds measured at each. */
  at: number[];
  len: number;
}

export interface CensusResult {
  points: { at: number; dir: number; other: number; by: Record<string, number> }[];
}

export interface ProgressionJob {
  kind: "progression";
  bot: string;
  seed: number;
  hours: number;
}

export type Job = GaugeJob | PathJob | WindowJob | SliceJob | BossJob | FullJob | CensusJob | ProgressionJob;

// ---------------------------------------------------------------- entry

/** Run one job with the overrides applied (and undone after). */
export function runJob(job: Job, set: Override[] = []): unknown {
  if (job.kind === "progression") return runProgression(job, set);
  const undo = applyOverrides(set);
  try {
    switch (job.kind) {
      case "gauge":
        return runGauge(job);
      case "path":
        return runPath(job);
      case "window":
        return playRun(job, job.t1);
      case "full":
        return playRun(job, job.tmax ?? stageDef(job.stage).duration + 300, 60);
      case "slice":
        return runSlice(job);
      case "boss":
        return runBoss(job);
      case "census":
        return runCensus(job);
    }
  } finally {
    undo();
  }
  throw new Error(`unknown job ${(job as { kind: string }).kind}`);
}
