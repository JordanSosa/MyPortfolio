/**
 * Gameplay hook toolkit for relics, talents, constellations, Plot Twists,
 * stages and the run-stats collector (docs/EXPANSION.md §6, §8, §10).
 *
 * `world.hooks` is a second typed EventBus that is NEVER muted: `world.bus`
 * carries presentation events and goes silent during fast-forwards
 * (`world.muted`, ?skip=, attract warm-up), but gameplay effects must behave
 * the same muted or not (runs stay reproducible per seed). Every payload is
 * one reused object per hook type: listeners read it immediately and keep
 * nothing (no per-event allocation anywhere).
 *
 *   install(w, stars) {
 *     w.hooks.on("kill", (k) => { if (k.elite && w.rng.chance(0.3)) w.heal(5); });
 *     w.every(10, () => w.explode(w.player.x, w.player.y - 8, 40, 30 * w.stats.might, null, 60, "my_relic", C.pink));
 *     const rush = new Buff(w);                         // timed stat buff
 *     w.statMods.push((s) => { if (rush.on) s.might += 0.2; });
 *     w.hooks.on("ult", () => rush.start(8));
 *   }
 *
 * Content modules import values from here (and types from world.ts) - never a
 * value from world.ts (see ARCHITECTURE.md, import rule).
 */
import { CFG, CH_RELIC } from "./config";
import type { PickupKind, Enemy, WeaponInstance } from "./types";
import type { World } from "./world";

/** An enemy died (props excluded). */
export interface KillHook {
  enemy: Enemy;
  x: number;
  y: number;
  elite: boolean;
  boss: boolean;
  /** Damage source id of the killing blow (weapon id, ult id, relic id...). */
  source: string;
  owner: WeaponInstance | null;
}

/** An enemy took damage (fires on every hit: keep listeners cheap). */
export interface HitHook {
  enemy: Enemy;
  dmg: number;
  crit: boolean;
  source: string;
  owner: WeaponInstance | null;
}

/** The player took damage (after armor / reduction; shield blocks fire `block` instead). */
export interface HurtHook {
  dmg: number;
  /** Source position. */
  sx: number;
  sy: number;
  hp: number;
}

/** The player is about to die from a hit: set `saved = true` to survive at 1 HP (Plot Armor). */
export interface LethalHook {
  dmg: number;
  saved: boolean;
  /** Who saved it (relic / talent id), for the view's banner. */
  by: string;
}

export interface DashHook {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface PickupHook {
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
}

export interface SimHooks {
  kill: KillHook;
  hit: HitHook;
  hurt: HurtHook;
  lethal: LethalHook;
  /** A shield charge absorbed a hit (`left` charges remain). */
  block: { x: number; y: number; left: number };
  /** A level was gained (fires once per level). */
  levelUp: { level: number };
  dash: DashHook;
  /** Overdrive became active (end of the cut-in, or an encore). */
  ult: { id: string; power: number };
  ultEnd: { id: string };
  /** Any pickup collected (coins too; `value` = coins gained / heal / 1). */
  pickup: PickupHook;
  /** XP from a gem (after multipliers). */
  gem: { value: number };
  chest: { golden: boolean; jackpot: boolean };
  eliteSpawn: { enemy: Enemy };
  bossSpawn: { enemy: Enemy };
  bossKill: { enemy: Enemy; final: boolean };
  /** A destructible prop broke. */
  prop: { x: number; y: number };
  heal: { amount: number };
  revive: { x: number; y: number };
  reroll: { left: number };
  banish: { id: string };
  skip: { level: number };
  /** The Filler Arc (endless) started. */
  endless: { t: number };
  /** Every simulation step, after everything moved (cheap listeners only). */
  step: { dt: number };
}

/**
 * A timed stat buff. Read `on` inside a World.statMods modifier; start() /
 * expiry recompute the stats automatically (World steps every Buff).
 */
export class Buff {
  /** Seconds left (0 = off). */
  t = 0;
  constructor(private readonly w: World) {
    w.buffs.push(this);
  }
  get on(): boolean {
    return this.t > 0;
  }
  /** Turn on for `seconds` (refreshes, never shortens). */
  start(seconds: number): void {
    const was = this.t > 0;
    this.t = Math.max(this.t, seconds);
    if (!was) this.w.statsDirty = true;
  }
}

/** Per-world "dashed through an enemy" listeners (one shared step listener per world). */
const dashThrough = new WeakMap<World, ((e: Enemy) => void)[]>();

/**
 * Call `fn` once per dash for every enemy the dashing hero passes through
 * (talents / relics such as Hunter Instinct or the Rubber Duck). All effects
 * share one sweep, so each sees every enemy (the enemy's CH_RELIC re-hit stamp
 * holds the dash's start time).
 */
export function onDashThrough(w: World, fn: (e: Enemy) => void): void {
  let list = dashThrough.get(w);
  if (list) {
    list.push(fn);
    return;
  }
  list = [fn];
  dashThrough.set(w, list);
  const fns = list;
  let dashAt = -1;
  w.hooks.on("dash", () => {
    dashAt = w.t;
  });
  w.hooks.on("step", () => {
    const p = w.player;
    if (p.dashT <= 0 || dashAt < 0 || w.phase !== "play") return;
    const y = p.y - CFG.playerCy;
    const buf = w.acquire();
    const n = w.grid.query(p.x, y, 30, buf);
    for (let k = 0; k < n; k++) {
      const e = w.enemies.items[buf[k]];
      if (!e || e.dead || e.def.prop || e.lastHit[CH_RELIC] === dashAt) continue;
      const dx = e.x - p.x;
      const dy = e.y - e.cy - y;
      const rr = e.r + CFG.playerRadius + 4;
      if (dx * dx + dy * dy > rr * rr) continue;
      e.lastHit[CH_RELIC] = dashAt;
      for (let i = 0; i < fns.length && !e.dead; i++) fns[i](e);
    }
    w.release();
  });
}

/** Stars as a 0..1 fraction of the max (6): handy for linear relic scaling. */
export function starK(stars: number): number {
  return Math.max(0, Math.min(6, stars)) / 6;
}

/** "+3% / +4% / ..." helper for desc(): base + per x stars, rounded to 1 decimal. */
export function scaled(base: number, per: number, stars: number): number {
  return Math.round((base + per * Math.max(0, Math.min(6, stars))) * 10) / 10;
}
