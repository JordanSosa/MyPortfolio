/**
 * SEAGULL (Beach Episode, docs/content/enemies.md §3). Weaves in circles above
 * the hero (drawn 10 px up, small shadow), then dives: a 0.5 s tell (the
 * shadow grows, "!" over its head, the dive lane on the sand), a straight
 * 190 px/s dive through the spot the hero stood on, and a climb away.
 *
 * Twist - Thief: flying over a resting coin or food pickup it steals it
 * ("MINE!", carried in its beak) and flies off the screen with it. Shoot it
 * down before it leaves the view: the loot drops back + 1 coin. Elite: goes
 * for a chest on the ground (and drops it on death).
 *
 * state 0 circle (timer = dive cooldown), 1 tell, 2 dive, 3 climb, 4 flee with loot.
 * a = orbit angle, b = carried pickup (SG_*), c/d = dive direction
 * (state 4: c = carried value).
 */
import { C } from "../../art/palette";
import type { Enemy, EnemyDef, Pickup, PickupKind } from "../types";
import type { World } from "../world";
import { BX_DIVE, BX_STEAL, Q_MINE, cue, quip } from "./_s45";
import { onScreen } from "./_fx";

export const SG_NONE = 0;
export const SG_COIN = 1;
export const SG_ONIGIRI = 2;
export const SG_CAKE = 3;
export const SG_HEART = 4;
export const SG_CHEST = 5;
export const SG_GOLD_CHEST = 6;
/** Pickup kind per SG_* code (index). */
export const SG_KINDS: readonly PickupKind[] = ["coin", "coin", "onigiri", "cake", "heart", "chest", "chest"];

export const GULL_TELL = 0.5;
export const GULL_DIVE_SPEED = 190;
const ORBIT_R = 66;
const FLY_Z = 10;
const GRAB_R = 12;

function code(k: Pickup, elite: boolean): number {
  switch (k.kind) {
    case "coin":
      return SG_COIN;
    case "onigiri":
      return SG_ONIGIRI;
    case "cake":
      return SG_CAKE;
    case "heart":
      return SG_HEART;
    case "chest":
      return elite ? (k.golden ? SG_GOLD_CHEST : SG_CHEST) : SG_NONE;
    default:
      return SG_NONE;
  }
}

/** Grab a resting pickup it flies over (elites also hunt chests on screen). */
function thieve(e: Enemy, w: World): void {
  if (e.b !== SG_NONE || ((w.steps + e.uid) % 6) !== 0) return;
  const items = w.pickups.items;
  let chest: Pickup | null = null;
  for (let i = 0; i < w.pickups.count; i++) {
    const k = items[i];
    if (k.dead || k.state !== 0 || k.z > 2) continue;
    const c = code(k, e.elite);
    if (c === SG_NONE) continue;
    const dx = k.x - e.x;
    const dy = k.y - e.y;
    if (dx * dx + dy * dy < GRAB_R * GRAB_R * e.scale * e.scale) {
      e.b = c;
      e.c = k.value;
      k.dead = true;
      e.state = 4;
      e.timer = 0;
      quip(w, e, "MINE!", Q_MINE, 2.5);
      cue(w, BX_STEAL, e.x, e.y, 0, 0, c, e);
      return;
    }
    if (c >= SG_CHEST && onScreen(w, k.x, k.y, -8)) chest = k;
  }
  // an elite flies straight for a chest it can see
  if (chest && e.state === 0) {
    const dx = chest.x - e.x;
    const dy = chest.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.c = dx / d;
    e.d = dy / d;
    e.timer = Math.max(e.timer, 0.3);
    e.a = -99;
  }
}

export const seagull: EnemyDef = {
  id: "seagull",
  name: "Seagull",
  sprite: "en_seagull",
  fps: 8,
  hp: 12,
  speed: 70,
  dmg: 7,
  radius: 5,
  height: 16,
  xp: 1,
  shadow: 9,
  colors: [C.white, C.offWhite, C.yellow],
  init(e, w) {
    e.a = w.rng.angle();
    e.b = SG_NONE;
    e.timer = w.rng.range(1.5, 3.5);
    e.z = FLY_Z;
  },
  // art: f0-1 flap, f2 glide, f3 dive (wings tucked)
  frame(e) {
    if (e.state === 1) return 2;
    if (e.state === 2) return 3;
    if (e.state === 3 || e.state === 4) return Math.floor(e.t * 12) & 1;
    return Math.floor(e.t * 6 + e.uid) % 3 === 2 ? 2 : Math.floor(e.t * 8 + e.uid) & 1;
  },
  update(e, w, dt) {
    const p = w.player;
    e.timer += e.state === 0 ? -dt : dt;
    switch (e.state) {
      case 0: {
        thieve(e, w);
        if (e.state !== 0) break;
        if (e.a === -99) {
          // (elite) beelining for a chest
          e.vx = e.c * e.speed * 1.2;
          e.vy = e.d * e.speed * 1.2;
          if (e.timer <= 0) {
            e.a = w.rng.angle();
            e.timer = 1;
          }
        } else {
          // weave around a point above the hero
          e.a += dt * 1.1;
          const tx = p.x + Math.cos(e.a) * ORBIT_R;
          const ty = p.y - 18 + Math.sin(e.a) * ORBIT_R * 0.55;
          const dx = tx - e.x;
          const dy = ty - e.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const s = Math.sin(e.t * 5 + e.uid) * 0.35;
          e.vx = (dx / d - (dy / d) * s) * e.speed;
          e.vy = (dy / d + (dx / d) * s) * e.speed;
        }
        e.z = FLY_Z + Math.sin(e.t * 3 + e.uid) * 2;
        if (e.timer <= 0 && e.a !== -99 && onScreen(w, e.x, e.y, -10)) {
          // tell: lock the dive at the hero's spot now (a sidestep always dodges it)
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          e.c = dx / d;
          e.d = dy / d;
          e.state = 1;
          e.timer = 0;
          const len = d + 46;
          w.telegraphLine(e.x, e.y, e.x + e.c * len, e.y + e.d * len, e.r + 2, GULL_TELL, C.yellow);
        }
        break;
      }
      case 1: {
        e.vx = -e.c * 8;
        e.vy = -e.d * 8;
        e.z = FLY_Z + 3 * Math.min(1, e.timer / GULL_TELL);
        if (e.timer >= GULL_TELL) {
          e.state = 2;
          e.timer = 0;
          e.sqV += 5;
          cue(w, BX_DIVE, e.x, e.y, e.c, e.d, e.scale, e);
        }
        break;
      }
      case 2: {
        e.vx = e.c * GULL_DIVE_SPEED;
        e.vy = e.d * GULL_DIVE_SPEED;
        e.z = Math.max(1, e.z - dt * 90);
        if (e.timer >= 0.85) {
          e.state = 3;
          e.timer = 0;
        }
        break;
      }
      case 3: {
        // climb away along the dive line, back up to cruising height
        thieve(e, w);
        if (e.state !== 3) break;
        e.vx = e.c * 95;
        e.vy = e.d * 95 - 20;
        e.z = Math.min(FLY_Z, e.z + dt * 16);
        if (e.timer >= 0.8) {
          e.state = 0;
          e.timer = w.rng.range(2.4, 4);
          e.a = Math.atan2(e.y - p.y, e.x - p.x);
        }
        break;
      }
      default: {
        // flee with the loot: away from the hero and off the screen
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        e.vx = (dx / d) * e.speed * 1.35;
        e.vy = (dy / d) * e.speed * 1.35 - 10;
        e.z = Math.min(FLY_Z + 4, e.z + dt * 10);
        if (e.timer > 0.6 && !onScreen(w, e.x, e.y, 24)) w.despawn(e);
      }
    }
  },
  onDeath(e, w) {
    if (e.b === SG_NONE) return;
    const kind = SG_KINDS[e.b] ?? "coin";
    const k = w.dropPickup(kind, e.x, e.y, kind === "chest" ? 1 : Math.max(1, e.c), e.b === SG_GOLD_CHEST);
    if (kind === "chest") w.emit("chestDropped", { x: k.x, y: k.y, golden: k.golden });
    w.dropPickup("coin", e.x, e.y, 1);
  },
};

export const enemies: EnemyDef[] = [seagull];
