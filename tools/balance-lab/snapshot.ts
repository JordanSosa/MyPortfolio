/**
 * Snapshots for the lab's short sims: a real World for a checkpoint x stage x hero cell
 * (the checkpoint's RunConfig through buildRunConfig), grown to a level by the real bot's
 * level-up picks (no combat: World.addXp + bot.resolve, chests interleaved), then moved
 * to a run time (the director skips the timeline before it). No game logic is copied:
 * every number comes from the live World / director / upgrade code.
 */
import { Bot, makeBot } from "../../src/debug/bot";
import { World } from "../../src/game/world";
import { checkpointRun } from "../checkpoints";
import { cpId } from "./overrides";

export interface CellSpec {
  cp: string;
  stage: string;
  hero: string;
  seed: number;
  bot?: string;
  /** HEAT_SETS name or {id: rank}. */
  twists?: string | Record<string, number>;
}

/** The bot of a job (seeded like tools/matrix.sim.ts). */
export function jobBot(kind: string | undefined, seed: number): Bot {
  return kind === "good" ? new Bot(seed * 31 + 7) : makeBot(kind ?? "mid", seed * 31 + 7);
}

/** A fresh World for a cell (same seeding as the matrix: seed * 7717 + 13). */
export function cellWorld(c: CellSpec, opts: { maxE?: number; director?: boolean; god?: boolean } = {}): World {
  const plan = checkpointRun(cpId(c.cp), { hero: c.hero, stage: c.stage, twists: c.twists });
  return new World({ hero: plan.hero, seed: c.seed * 7717 + 13, run: plan.config, maxEnemies: opts.maxE ?? 250, director: opts.director ?? true, god: opts.god ?? false });
}

/** Resolve pending level-ups / chests with the bot (as `simulate` does after a step). */
export function settle(w: World, bot: Bot): void {
  for (let g = 0; g < 500 && (w.pendingLevels > 0 || w.pendingChests.length > 0); g++) {
    while (w.pendingLevels > 0) bot.resolve(w);
    while (w.pendingChests.length > 0) w.openChest();
  }
}

/**
 * Level the build up to `level` with the bot's own picks, opening `chests` ordinary chests
 * spread evenly over the way (elite / boss chests of a real run). Returns the build.
 */
export function growBuild(w: World, bot: Bot, level: number, chests = 0, golden = 0): void {
  settle(w, bot);
  const from = w.level;
  const span = Math.max(1, level - from);
  let opened = 0;
  let gold = 0;
  for (let g = 0; g < 400 && w.level < level; g++) {
    w.addXp(w.xpNext - w.xp + 1e-6);
    settle(w, bot);
    const k = (w.level - from) / span;
    while (opened < Math.floor(chests * k + 1e-9)) {
      w.pendingChests.push({ golden: false });
      opened++;
      settle(w, bot);
    }
    while (gold < Math.floor(golden * k + 1e-9)) {
      w.pendingChests.push({ golden: true });
      gold++;
      settle(w, bot);
    }
  }
  while (opened++ < chests) w.pendingChests.push({ golden: false });
  while (gold++ < golden) w.pendingChests.push({ golden: true });
  settle(w, bot);
  w.player.hp = w.player.maxHp;
}

/** The build as data. */
export function buildOf(w: World): { weapons: [string, number][]; passives: [string, number][] } {
  return { weapons: w.weapons.map((x) => [x.def.id, x.level] as [string, number]), passives: w.passives.map((p) => [p.def.id, p.level] as [string, number]) };
}

interface DirectorInternals {
  nextEvent: number;
  opened: boolean;
  events: { at: number; kind: string; enemy?: string }[];
}

/**
 * Move a fresh run to time `t` (the timeline before it is skipped: no opening ring, no earlier
 * events or bosses) with adaptive toughness `adapt` (what a real run would have built up).
 */
export function jumpTo(w: World, t: number, adapt = 0): void {
  const d = w.director as unknown as DirectorInternals;
  d.opened = true;
  w.t = t;
  let i = 0;
  while (i < d.events.length && d.events[i].at < t) i++;
  d.nextEvent = i;
  w.director.adapt = adapt;
}

/** Index-free lookup of a boss's timeline event time. */
export function bossEventAt(w: World, boss: string): number {
  const d = w.director as unknown as DirectorInternals;
  const e = d.events.find((x) => x.kind === "boss" && x.enemy === boss);
  return e ? e.at : NaN;
}

/** God mode on / off (World.god is readonly for the game; the lab toggles it like __kk.god). */
export function setGod(w: World, on: boolean): void {
  (w as unknown as { god: boolean }).god = on;
}
