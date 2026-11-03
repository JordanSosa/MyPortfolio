/**
 * Hall Monitor (Shoujo Academy, enemies.md §2): seeks the player, ignoring
 * them... until they dash.
 *
 * Twist - NO RUNNING!: when the player dashes within 100 px, it blows its
 * whistle (0.3 s telegraph: whistle frame 3, a lane on the ground, "NO
 * RUNNING!") and dashes at the player at 150 px/s for 0.5 s; 3 s cooldown per
 * monitor. The schoolBell event (THE BELL RINGS!) makes every monitor on
 * screen whistle at once. Elite "Prefect": its whistle sets off every Hall
 * Monitor within 120 px.
 *
 * state 0 = walk, 1 = whistle, 2 = dash, 3 = skid. timer = state clock,
 * b = whistle cooldown until (World.t), c/d = dash direction, a = gait phase.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { EFX_DASH, EFX_SKID, efx, onScreen } from "./_fx";
import { toPlayer } from "./_steer";
import { academyInstall, SA_WHISTLE, shoutOk } from "./_academy";
import { cue } from "./_cue";
import { say } from "./_say";

export const MONITOR_TELL = 0.3;
export const MONITOR_DASH = 0.5;
export const MONITOR_SPEED = 150;
const SKID = 0.25;
const WATCH_R = 100;
const PREFECT_R = 120;
const COOLDOWN = 3;

export const MON_WALK = 0;
export const MON_WHISTLE = 1;
export const MON_DASH = 2;
export const MON_SKID = 3;

const dir = { x: 0, y: 0 };

/**
 * Blow the whistle: aim at the player, telegraph the lane, dash after MONITOR_TELL.
 * `force` (the school bell) skips the cooldown. Returns true when it whistled.
 */
export function monitorWhistle(e: Enemy, w: World, force: boolean): boolean {
  if (e.dead || e.def.id !== "hall_monitor") return false;
  if (e.state === MON_WHISTLE || e.state === MON_DASH) return false;
  if (!force && w.t < e.b) return false;
  if (!onScreen(w, e.x, e.y, -4)) return false;
  toPlayer(e, w, dir);
  e.c = dir.x;
  e.d = dir.y;
  e.face = dir.x >= 0 ? 1 : -1;
  e.state = MON_WHISTLE;
  e.timer = 0;
  e.b = w.t + COOLDOWN;
  e.sqV -= 5;
  const k = e.speed / 34;
  const len = MONITOR_SPEED * k * MONITOR_DASH + 8;
  w.telegraphLine(e.x, e.y, e.x + e.c * len, e.y + e.d * len, e.r + 2, MONITOR_TELL, 0xffe14d);
  cue(w, SA_WHISTLE, e.x + e.face * 4, e.y - e.cy - 3, e.c, e.d, e.scale, 0, e);
  if (shoutOk(w, 0.7)) say(w, e, "NO RUNNING!");
  if (e.elite) {
    // Prefect: the whole corridor joins in
    const buf = w.acquire();
    const n = w.grid.query(e.x, e.y - e.cy, PREFECT_R, buf);
    const items = w.enemies.items;
    for (let i = 0; i < n; i++) {
      const o = items[buf[i]];
      if (!o || o === e || o.dead || o.def.id !== "hall_monitor") continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy <= PREFECT_R * PREFECT_R) monitorWhistle(o, w, true);
    }
    w.release();
  }
  return true;
}

export const hallMonitor: EnemyDef = {
  id: "hall_monitor",
  name: "Hall Monitor",
  sprite: "en_hall_monitor",
  fps: 7,
  hp: 34,
  speed: 34,
  dmg: 9,
  radius: 6,
  height: 13,
  xp: 2,
  shadow: 10,
  knockResist: 0.2,
  colors: [C.navy, C.yellow, C.white],
  init(e, w) {
    academyInstall(w);
    e.a = w.rng.next() * TAU;
    e.b = w.t + w.rng.range(0, 1);
  },
  // art: f0-2 brisk walk, f3 whistle (cheeks puffed)
  frame(e) {
    if (e.state === MON_WHISTLE) return 3;
    if (e.state === MON_DASH) return Math.floor(e.timer * 14) % 3;
    if (e.state === MON_SKID) return 0;
    return Math.floor(e.t * 7 + e.a) % 3;
  },
  update(e, w, dt) {
    e.timer += dt;
    switch (e.state) {
      case MON_WALK: {
        const d = toPlayer(e, w, dir);
        const step = Math.abs(Math.sin(e.t * TAU * 1.8 + e.a));
        const sp = e.speed * (0.8 + 0.35 * step);
        e.vx = dir.x * sp;
        e.vy = dir.y * sp;
        // the player dashed this step (the dash hook fires before the enemies update) near this monitor
        const st = academyInstall(w);
        if (st.dashAt === w.t && d < WATCH_R + 30) {
          const dx = st.dashX - e.x;
          const dy = st.dashY - e.y;
          if (dx * dx + dy * dy < WATCH_R * WATCH_R) monitorWhistle(e, w, false);
        }
        break;
      }
      case MON_WHISTLE:
        e.vx = e.vy = 0;
        if (e.timer >= MONITOR_TELL) {
          e.state = MON_DASH;
          e.timer = 0;
          e.sqV += 6;
          efx(w, EFX_DASH, e.x, e.y, e.c, e.d, e.scale, e);
        }
        break;
      case MON_DASH: {
        const sp = MONITOR_SPEED * (e.speed / 34);
        e.vx = e.c * sp;
        e.vy = e.d * sp;
        e.face = e.c >= 0 ? 1 : -1;
        if (e.timer >= MONITOR_DASH) {
          e.state = MON_SKID;
          e.timer = 0;
          e.sqV -= 7;
          efx(w, EFX_SKID, e.x, e.y, e.c, e.d, e.scale, e);
        }
        break;
      }
      default: {
        const f = Math.max(0, 1 - e.timer / SKID);
        const sp = MONITOR_SPEED * 0.45 * f * f;
        e.vx = e.c * sp;
        e.vy = e.d * sp;
        if (e.timer >= SKID) {
          e.state = MON_WALK;
          e.timer = 0;
        }
      }
    }
  },
};

export const enemies: EnemyDef[] = [hallMonitor];
