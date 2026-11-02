/**
 * Weapon visual-event helpers (no `weapons` export, so the registry ignores
 * this file). Weapons whose look can't be expressed by the projectile list
 * (lightning, dome bursts, heals...) emit `weaponFx` events; the view turns
 * them into juice in src/view/weapon-fx.ts. Payloads are reused module
 * objects: emitting never allocates.
 */
import type { WeaponFxEvent } from "../events";
import type { Enemy, WeaponInstance } from "../types";
import type { World } from "../world";

/** Thunder Bell: bolt from the sky (x, y top) to the target (x2, y2). n = 0 normal. */
export const WFX_BOLT = 1;
/** Chain lightning hop from (x, y) to (x2, y2). n = hop index. */
export const WFX_CHAIN = 2;
/** Raijin Drum: huge bolt from the sky onto (x2, y2) with an AoE blast of radius r. */
export const WFX_BOLT_BIG = 3;
/** Raijin Drum volley start at the player (x, y). */
export const WFX_DRUM = 4;
/** Sugar Nuke detonation at (x, y), radius r. */
export const WFX_NUKE = 5;
/** Ocean Dome tidal burst at (x, y), dome radius r. */
export const WFX_DOME_BURST = 6;
/** Ocean Dome heal tick at the player (n = HP healed). */
export const WFX_DOME_HEAL = 7;
/** Heart Boomerang caught by the player at (x, y). */
export const WFX_CATCH = 8;
/** Candy bomblets scatter from (x, y). */
export const WFX_CLUSTER = 9;
/** Rainbow Cannon / Prism Beam opening flash at (x, y), angle in r. */
export const WFX_BEAM_START = 10;

const ev: WeaponFxEvent = { kind: 0, x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0 };

/** Emit a weapon visual (no-op while the world is muted). */
export function wfx(w: World, kind: number, x: number, y: number, x2 = x, y2 = y, r = 0, n = 0): void {
  if (w.muted) return;
  ev.kind = kind;
  ev.x = x;
  ev.y = y;
  ev.x2 = x2;
  ev.y2 = y2;
  ev.r = r;
  ev.n = n;
  w.emit("weaponFx", ev);
}

const fireEv = { id: "", sfx: "", x: 0, y: 0 };

/** weaponFire with a reused payload (an explicit sfx, e.g. "thunder" for each strike). */
export function sfxAt(w: World, id: string, sfx: string, x: number, y: number): void {
  if (w.muted) return;
  fireEv.id = id;
  fireEv.sfx = sfx;
  fireEv.x = x;
  fireEv.y = y;
  w.emit("weaponFire", fireEv);
}

/** The weapon's own fire sfx (def.sfx) with a reused payload. */
export function fireSfx(w: World, inst: WeaponInstance, x: number, y: number): void {
  if (inst.def.sfx) sfxAt(w, inst.def.id, inst.def.sfx, x, y);
}

/** Is a pooled enemy reference still the same live enemy? */
export function alive(e: Enemy | null, uid: number): e is Enemy {
  return !!e && !e.dead && e.uid === uid;
}

/**
 * Pick up to `max` distinct random on-screen targets (props excluded) into `out`.
 * Visits the enemy list from a random start with a random odd stride so picks
 * are spread out; O(n), no allocation.
 */
export function randomTargetsInView(w: World, max: number, out: Enemy[], margin = -6): number {
  const cnt = w.enemies.count;
  if (cnt === 0 || max <= 0) return 0;
  const p = w.player;
  const hw = w.viewW * 0.5 + margin;
  const hh = w.viewH * 0.5 + margin;
  const start = w.rng.int(0, cnt - 1);
  // a stride co-prime with cnt visits every index exactly once
  let stride = 1 + 2 * w.rng.int(0, 7);
  while (gcd(stride, cnt) !== 1) stride += 2;
  let n = 0;
  const items = w.enemies.items;
  for (let k = 0; k < cnt && n < max; k++) {
    const e = items[(start + k * stride) % cnt];
    if (e.dead || e.def.prop) continue;
    if (Math.abs(e.x - p.x) > hw || Math.abs(e.y - e.cy - (p.y - 8)) > hh) continue;
    out[n++] = e;
  }
  return n;
}

function gcd(a: number, b: number): number {
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
