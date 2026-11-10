/**
 * Bestiary cosmetic cues (helper - no `enemies` export, so the registry
 * ignores this file). The sim emits `enemyFx` events with one of these kinds;
 * src/view/bestiary-fx.ts turns them into dust, rings, flashes and sounds.
 * One reused payload: emitting never allocates.
 */
import type { EnemyFxEvent } from "../events";
import type { Enemy } from "../types";
import type { World } from "../world";

/** Teddy footstep: dust ring at the feet, tiny local shake. power = scale. */
export const EFX_STOMP = 1;
/** Pumpkin / boss dash stops: skid dust along (dx, dy). power = scale. */
export const EFX_SKID = 2;
/** Dash starts: burst of dust behind, whoosh. (dx, dy) = direction. power = scale. */
export const EFX_DASH = 3;
/** Nightmare Teddy charge trail: dust plumes on both sides of the path. (dx, dy) = direction. */
export const EFX_DUSTWALL = 4;
/** Boss charge slams to a stop: shake + debris. power = strength. */
export const EFX_IMPACT = 5;
/** Boss roar: expanding sound rings, shake, roar sfx. */
export const EFX_ROAR = 6;
/** Something pops in (summons): magic circle + smoke. power = scale. */
export const EFX_SUMMON = 7;
/** Lady Lunatic vanishes: sparkle implosion. */
export const EFX_TELE_OUT = 8;
/** Lady Lunatic appears: sparkle burst + ring. */
export const EFX_TELE_IN = 9;
/** Candle Wisp ignites (pre-flash before exploding). power = blast radius. */
export const EFX_FUSE = 10;
/** Candle Wisp blast. power = radius, dx = 1 when it could hurt the player. */
export const EFX_WISP_BOOM = 11;
/** Eyepuff starts charging its shot (eye glow + gather sparkles). */
export const EFX_EYE_CHARGE = 12;
/** Claw sweep spin starts. power = radius. */
export const EFX_CLAW = 13;
/** Final dawn: a remaining enemy dissolves in light. power = delay (s), `enemy` set. */
export const EFX_DAWN_POP = 14;
/** Boss casts a big volley (sparkle flourish at the hands). power = scale. */
export const EFX_CAST = 15;

const ev: EnemyFxEvent = { kind: 0, x: 0, y: 0, dx: 0, dy: 0, power: 1, enemy: null };

/** Emit a cosmetic cue (no-op while the world is muted / fast-forwarding). */
export function efx(w: World, kind: number, x: number, y: number, dx = 0, dy = 0, power = 1, enemy: Enemy | null = null): void {
  if (w.muted) return;
  ev.kind = kind;
  ev.x = x;
  ev.y = y;
  ev.dx = dx;
  ev.dy = dy;
  ev.power = power;
  ev.enemy = enemy;
  w.bus.emit("enemyFx", ev);
  ev.enemy = null;
}

const shockEv = { x: 0, y: 0, r: 0, power: 0 };

/** Ground slam / stomp / flourish shockwave (`shockwave` event, one reused payload). */
export function shock(w: World, x: number, y: number, r: number, power: number): void {
  if (w.muted) return;
  shockEv.x = x;
  shockEv.y = y;
  shockEv.r = r;
  shockEv.power = power;
  w.bus.emit("shockwave", shockEv);
}

/** True when (x, y) is inside the current view rect (+ margin). Enemies only telegraph/shoot where they can be seen. */
export function onScreen(w: World, x: number, y: number, margin = 0): boolean {
  const p = w.player;
  return Math.abs(x - p.x) <= w.viewW * 0.5 + margin && Math.abs(y - p.y) <= w.viewH * 0.5 + margin;
}
