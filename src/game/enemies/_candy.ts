/**
 * Candy Kingdom shared sim state (helper - no `enemies` export): installed
 * once per World by the first candy enemy that spawns (WeakMap, no globals).
 *
 *   - Candy Corn "Shield Wall": a `dmgTaken` rule - a projectile hitting the
 *     FRONT half of a soldier with >= 2 other soldiers within 20 px deals 40 %
 *     less (auras, explosions and the ultimate are unaffected).
 *   - Marshmallow "Toasty": a `hit` hook - fire weapons or any explode() toast
 *     a brute for the rest of its life (+30 % speed, +50 % damage taken).
 *   - S'more Supreme chocolate puddles (r 24, 4 s): a `step` hook slows the
 *     enemies inside (never the player); the view draws them (candyState).
 *
 * Every listener is allocation-free; the state lives as long as its World.
 */
import { CH_ULT } from "../config";
import type { Enemy } from "../types";
import type { World } from "../world";
import { say } from "./_say";
import { cue } from "./_cue";

/** Candy roster (Lollipop Mage heals, Sugar Plum Tyrant decrees). */
export const CANDY_IDS: ReadonlySet<string> = new Set(["gummy_bear", "candy_corn", "donut_roller", "marshmallow_brute", "lollipop_mage"]);

/** Fire weapons that toast a Marshmallow Brute (enemies.md: Dark Flame Dragon, Cheat Fireball + evolutions). */
export const FIRE_SOURCES: ReadonlySet<string> = new Set(["dark_flame_dragon", "unsealed_abyss_dragon", "unbandaged_right_arm", "cheat_fireball", "cheat_meteor", "holding_back"]);

/** Shield Wall: damage factor, neighbour radius / count. */
export const SHIELD_MUL = 0.6;
const SHIELD_R = 20;
const SHIELD_N = 2;
/** Toasty: speed / damage-taken multipliers. */
export const TOAST_SPEED = 1.3;
export const TOAST_TAKEN = 1.5;
/** S'more puddle radius / life / enemy slow. */
export const PUDDLE_R = 24;
export const PUDDLE_LIFE = 4;
const PUDDLE_SLOW = 0.45;
export const MAX_PUDDLES = 8;

/** Cue kinds of the Candy Kingdom (src/view/candy-fx.ts). */
export const CK_BOING = "candy_boing";
export const CK_BLOCK = "candy_block";
export const CK_TOAST = "candy_toast";
export const CK_HEAL = "candy_heal";
export const CK_HEALED = "candy_healed";
export const CK_SPIN = "candy_spin";
export const CK_BOUNCE = "candy_bounce";
export const CK_SPLIT = "candy_split";
export const CK_PUDDLE = "candy_puddle";
export const CK_CAST = "candy_cast";

export interface CandyState {
  /** Puddles: x, y, time left (s) per slot (t <= 0 = free). */
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly pt: Float64Array;
}

const STATES = new WeakMap<World, CandyState>();

/** The candy state if any candy enemy has spawned in this world (the view reads the puddles). */
export function candyState(w: World): CandyState | undefined {
  return STATES.get(w);
}

/** Is `e` a toasted Marshmallow Brute? (scratch e.c = 1) */
export function toasted(e: Enemy): boolean {
  return e.def.id === "marshmallow_brute" && e.c === 1;
}

/** Install the candy rules on this world once (called from the candy enemies' init). */
export function candyInstall(w: World): CandyState {
  let s = STATES.get(w);
  if (s) return s;
  s = { px: new Float64Array(MAX_PUDDLES), py: new Float64Array(MAX_PUDDLES), pt: new Float64Array(MAX_PUDDLES) };
  STATES.set(w, s);
  const st = s;

  // Shield Wall (front-half projectile hits) + Toasty (+50 % damage taken)
  w.dmgTaken.push((e) => {
    const id = e.def.id;
    if (id === "marshmallow_brute") return e.c === 1 ? TOAST_TAKEN : 1;
    if (id !== "candy_corn") return 1;
    const p = w.hitProj;
    if (!p || p.ch === CH_ULT) return 1;
    // front = the way it marches (toward the player when standing)
    let fx = e.vx;
    let fy = e.vy;
    if (fx * fx + fy * fy < 1) {
      fx = w.player.x - e.x;
      fy = w.player.y - e.y;
    }
    const cy = e.y - e.cy;
    if ((p.x - e.x) * fx + (p.y - cy) * fy <= 0) return 1;
    if (countCorn(w, e) < SHIELD_N) return 1;
    // (the view flashes the wrapper shield on a block: e.b = time of the last block)
    if (w.t - e.b > 0.12) cue(w, CK_BLOCK, e.x, cy, p.x, p.y, 0, 0, e);
    e.b = w.t;
    return SHIELD_MUL;
  });

  // Toasty: fire weapons or any explode() toast a brute for life
  w.hooks.on("hit", (h) => {
    const e = h.enemy;
    if (e.def.id !== "marshmallow_brute" || e.c === 1 || e.dead || e.hp <= 0) return;
    if (!FIRE_SOURCES.has(h.source) && w.blastDepth <= 0) return;
    e.c = 1;
    e.speed *= TOAST_SPEED;
    say(w, e, "Toasty!", false);
    cue(w, CK_TOAST, e.x, e.y - e.cy, 0, 0, e.scale, 0, e);
  });

  // S'more puddles: slow enemies inside (the player is never slowed)
  w.hooks.on("step", (h) => {
    let any = false;
    for (let i = 0; i < MAX_PUDDLES; i++) {
      if (st.pt[i] <= 0) continue;
      st.pt[i] -= h.dt;
      any = true;
    }
    if (!any) return;
    const items = w.enemies.items;
    const buf = w.acquire();
    for (let i = 0; i < MAX_PUDDLES; i++) {
      if (st.pt[i] <= 0) continue;
      const x = st.px[i];
      const y = st.py[i];
      const n = w.grid.query(x, y, PUDDLE_R + 12, buf);
      for (let k = 0; k < n; k++) {
        const o = items[buf[k]];
        if (!o || o.dead || o.def.boss || o.def.prop) continue;
        const dx = o.x - x;
        const dy = o.y - y;
        if (dx * dx + dy * dy > PUDDLE_R * PUDDLE_R) continue;
        if (o.slow > PUDDLE_SLOW) o.slow = PUDDLE_SLOW;
        o.slowT = Math.max(o.slowT, 0.15);
      }
    }
    w.release();
  });
  return s;
}

/** Leave a chocolate puddle (S'more Supreme death). */
export function addPuddle(w: World, x: number, y: number): void {
  const s = candyInstall(w);
  let slot = 0;
  for (let i = 0; i < MAX_PUDDLES; i++) {
    if (s.pt[i] <= 0) {
      slot = i;
      break;
    }
    if (s.pt[i] < s.pt[slot]) slot = i;
  }
  s.px[slot] = x;
  s.py[slot] = y;
  s.pt[slot] = PUDDLE_LIFE;
  cue(w, CK_PUDDLE, x, y, 0, 0, PUDDLE_R);
}

/** Other Candy Corn Soldiers within SHIELD_R px of `e` (body centres). */
export function countCorn(w: World, e: Enemy): number {
  const buf = w.acquire();
  const cy = e.y - e.cy;
  const n = w.grid.query(e.x, cy, SHIELD_R + 8, buf);
  const items = w.enemies.items;
  let c = 0;
  for (let k = 0; k < n; k++) {
    const o = items[buf[k]];
    if (!o || o === e || o.dead || o.def.id !== "candy_corn") continue;
    const dx = o.x - e.x;
    const dy = o.y - o.cy - cy;
    if (dx * dx + dy * dy <= SHIELD_R * SHIELD_R) c++;
  }
  w.release();
  return c;
}
