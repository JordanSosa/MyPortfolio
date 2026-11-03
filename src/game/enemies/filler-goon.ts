/**
 * FILLER EPISODE GOON (The Final Arc, docs/content/enemies.md §4). Faceless
 * henchmen who seek the hero; the phase mix spawns them one by one, events
 * (floods, commercial breaks, Focus Groups) in groups.
 *
 * Twist - Recycled Animation: every goon on screen plays the SAME frame at the
 * same time (one global frame clock), and a goon that dies has a 25 % chance to
 * "reappear next episode": it respawns once at the spawn ring at full HP
 * ("Meanwhile..."). Elite "Filler Boss": goons within 80 px get +20 % speed
 * and match its facing direction.
 *
 * a = 1 when this goon is already a rerun, b = buffed until (World.t),
 * c = the Filler Boss's facing while buffed.
 */
import { C } from "../../art/palette";
import type { EnemyDef } from "../types";
import { BX_RERUN, Q_RERUN, cue, quip } from "./_s45";
import { toPlayer } from "./_steer";

export const GOON_FPS = 6;
export const RERUN_CHANCE = 0.25;
const BOSS_R = 80;

/** The shared animation clock (one frame for every goon). */
let clock = 0;
export function goonFrame(): number {
  return Math.floor(clock * GOON_FPS) & 3;
}

const dir = { x: 0, y: 0 };

export const fillerGoon: EnemyDef = {
  id: "filler_goon",
  name: "Filler Episode Goon",
  sprite: "en_filler_goon",
  fps: GOON_FPS,
  hp: 70,
  speed: 36,
  dmg: 11,
  radius: 6,
  height: 13,
  xp: 2,
  shadow: 11,
  knockResist: 0.1,
  colors: [0x7a6ea3, C.lavender, C.offWhite],
  init(e) {
    e.a = 0;
    e.b = -1;
    e.c = 1;
  },
  // art: f0-3 identical stiff walk - and every goon shows the same one
  frame() {
    return goonFrame();
  },
  update(e, w) {
    clock = w.t;
    toPlayer(e, w, dir);
    const buffed = w.t < e.b;
    const sp = e.speed * (buffed ? 1.2 : 1);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    if (e.elite && ((w.steps + e.uid) % 6) === 0) {
      // Filler Boss: the henchmen around it hurry up and turn the same way
      const buf = w.acquire();
      const n = w.grid.query(e.x, e.y - e.cy, BOSS_R, buf);
      const face = e.face;
      for (let k = 0; k < n; k++) {
        const o = w.enemies.items[buf[k]];
        if (!o || o === e || o.dead || o.def !== e.def || o.elite) continue;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        if (dx * dx + dy * dy > BOSS_R * BOSS_R) continue;
        o.b = w.t + 0.25;
        o.c = face;
      }
      w.release();
    }
  },
  onDeath(e, w) {
    if (e.a !== 0 || e.elite || w.rng.next() >= RERUN_CHANCE) return;
    // "reappears next episode": once, at the spawn ring, full HP
    w.edgePoint(16, w.tmp, true);
    const r = w.spawnEnemy(e.def, w.tmp.x, w.tmp.y);
    if (!r) return;
    r.a = 1;
    cue(w, BX_RERUN, r.x, r.y, 0, 0, 1, r);
    quip(w, r, "Meanwhile...", Q_RERUN, 3);
  },
};

export const enemies: EnemyDef[] = [fillerGoon];
