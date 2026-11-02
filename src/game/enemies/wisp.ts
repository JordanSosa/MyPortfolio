/**
 * Candle Wisp (DESIGN §3.4): fast flickering kamikaze. Within ~30 px of the
 * player it IGNITES: a 0.32 s pre-flash (blinking white, a red blast ring in
 * the view) while it keeps creeping closer, then explodes (r 16, scaled for
 * elites). Touching the player detonates it at once.
 *
 * Fairness: only an ignited (telegraphed) wisp can hurt the player. Killing
 * a calm wisp pops it harmlessly for the player - but every blast (ignited
 * or not) damages nearby enemies, so wisp packs chain-react.
 *
 * state 0 = chase, 1 = fuse, 9 = already exploded. d = stored blast damage
 * (contact damage is disabled: the blast is the attack).
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import { TAU } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { EFX_FUSE, EFX_WISP_BOOM, efx } from "./_fx";
import { toPlayer } from "./_steer";

export const WISP_RADIUS = 16;
export const WISP_FUSE = 0.32;
const IGNITE_DIST = 30;
const ST_EXPLODED = 9;

const dir = { x: 0, y: 0 };

/** Blast radius for this wisp (elites are bigger). */
export function wispRadius(e: Enemy): number {
  return WISP_RADIUS * e.scale;
}

function distToPlayer(e: Enemy, w: World): number {
  const dx = w.player.x - e.x;
  const dy = w.player.y - CFG.playerCy - (e.y - e.cy);
  return Math.sqrt(dx * dx + dy * dy);
}

/** Blow up at the current position. `armed` = it was telegraphed, so it may hurt the player. */
function explode(e: Enemy, w: World, armed: boolean): void {
  e.state = ST_EXPLODED;
  const R = wispRadius(e);
  const cx = e.x;
  const cy = e.y - e.cy;
  if (armed && distToPlayer(e, w) < R + CFG.playerRadius - 1) w.hurtPlayer(e.d, cx, cy);
  efx(w, EFX_WISP_BOOM, cx, cy, armed ? 1 : 0, 0, R, e);
  // chain reaction: scorch the neighbours (enough to pop other wisps, a scratch for the big ones)
  w.explode(cx, cy, R, Math.max(6, e.maxHp * 1.5), null, 50, "wisp", C.violet);
}

export const wisp: EnemyDef = {
  id: "wisp",
  name: "Candle Wisp",
  sprite: "en_wisp",
  fps: 10,
  hp: 6,
  speed: 70,
  dmg: 10,
  radius: 4,
  height: 10,
  xp: 1,
  shadow: 7,
  colors: [C.lightBlue, C.violet, C.lavender, C.blue, C.white],
  init(e, w) {
    e.a = w.rng.next() * TAU;
    e.d = e.dmg;
    e.dmg = 0;
  },
  update(e, w, dt) {
    if (e.state === ST_EXPLODED) return;
    const d = toPlayer(e, w, dir);
    e.z = 3 + Math.sin(e.t * 7 + e.a) * 1.5;
    // candle flicker
    e.alpha = 0.78 + 0.22 * Math.abs(Math.sin(e.t * 17 + e.a * 3));
    if (e.state === 0) {
      // darting chase with a nervous sideways jitter (fades out up close so it connects)
      const j = Math.sin(e.t * 9 + e.a) * Math.min(1, d / 60) * 0.6;
      e.vx = (dir.x - dir.y * j) * e.speed;
      e.vy = (dir.y + dir.x * j) * e.speed;
      if (distToPlayer(e, w) < IGNITE_DIST * e.scale && w.phase === "play") {
        e.state = 1;
        e.timer = 0;
        e.sqV -= 6;
        efx(w, EFX_FUSE, e.x, e.y - e.cy, 0, 0, wispRadius(e), e);
      }
      return;
    }
    // fuse: creep in, then blow
    e.timer += dt;
    e.vx = dir.x * e.speed * 0.35;
    e.vy = dir.y * e.speed * 0.35;
    const touching = distToPlayer(e, w) < e.r + CFG.playerRadius;
    if (touching || e.timer >= WISP_FUSE * (e.elite ? 1.25 : 1)) {
      w.despawn(e); // kamikaze: no drops, no credit (and its own blast must not hit it)
      explode(e, w, true);
    }
  },
  onDeath(e, w) {
    if (e.state !== ST_EXPLODED) explode(e, w, e.state === 1);
  },
};

export const enemies: EnemyDef[] = [wisp];
