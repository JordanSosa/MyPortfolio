/**
 * "NANI?!" pops (docs/content/satire.md §5). A crit that deals >= 25 % of the
 * target's max HP, >= 500 damage, or kills an elite pops NANI?! with a 30 %
 * chance (the Sparkle Screentone Sheet doubles it), at most once per 6 s
 * (global). The sim decides, so `RunStats.nanis` counts exactly the pops the
 * view shows (`relicProc` id "nani"); the Oversized Sword Keychain forces one.
 *
 * The roll is a hash of the step counter and the enemy uid - never
 * `world.rng` - so runs play exactly as they did before the pops existed
 * (Dream Meadow parity fingerprints, tests/stages.test.ts).
 *
 * Installed for every World by the RunStats collector (one hit listener).
 */
import { proc } from "./relics/_util";
import type { World } from "./world";

export interface NaniState {
  /** Chance per qualifying crit (0.3; Sparkle Screentone Sheet: 0.6). */
  chance: number;
  /** Global cooldown (s). */
  cd: number;
  /** Run time of the last pop. */
  at: number;
}

const states = new WeakMap<World, NaniState>();

/** The world's NANI?! rules (created on first use: relics may change the chance in install()). */
export function naniState(w: World): NaniState {
  let st = states.get(w);
  if (!st) {
    st = { chance: 0.3, cd: 6, at: -1e9 };
    states.set(w, st);
  }
  return st;
}

/** Deterministic 0..1 roll from two integers (no RNG stream consumed). */
function roll(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Pop NANI?! at (x, y) now (counts into RunStats.nanis). */
export function popNani(w: World, x: number, y: number): void {
  naniState(w).at = w.t;
  w.bumpStat("nanis", 1);
  proc(w, "nani", x, y);
}

/** Listen for qualifying crits (once per world). */
export function installNani(w: World): void {
  const st = naniState(w);
  w.hooks.on("hit", (h) => {
    if (!h.crit) return;
    const e = h.enemy;
    if (e.def.prop) return;
    if (!(h.dmg >= 500 || h.dmg >= e.maxHp * 0.25 || (e.elite && e.hp <= 0))) return;
    if (w.t - st.at < st.cd) return;
    if (roll(w.steps, e.uid) >= st.chance) return;
    popNani(w, e.x, e.y - e.cy);
  });
}
