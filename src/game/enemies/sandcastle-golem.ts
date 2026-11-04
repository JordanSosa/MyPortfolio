/**
 * SANDCASTLE GOLEM (Beach Episode, docs/content/enemies.md §3). A Teddy-style
 * tank (stomping gait, 80 % knockback resistance).
 *
 * Twist - Rebuild: the blow that would kill it collapses it into a sand pile
 * instead (f3: inert, invulnerable, ignored by auto-aim, no contact damage)
 * that rebuilds the golem at 50 % HP after 4 s - unless the hero walks over
 * the pile (a stomp: "MOAT!") or an explosion touches it (World.explode's
 * `blast` hook). Rebuilds once (elite: twice). Its XP (and an elite's chest)
 * drop only on the final death.
 *
 * state 0 walk, 1 pile (timer = seconds as a pile).
 * a = gait phase, b = last stride frame, c = rebuilds left.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { EFX_STOMP, efx, onScreen } from "./_fx";
import { BX_MOAT, BX_PILE, BX_REBUILD, Q_REBUILD, cue, quip } from "./_s45";
import { toPlayer } from "./_steer";

export const GOLEM_PILE = 1;
export const PILE_TIME = 4;
const STOMP_R = 12;
const CYCLE_HZ = 1;

const dir = { x: 0, y: 0 };

/** Walk frames f0-2 as a 4-step stomp (0 1 2 1). */
function stride(e: Enemy): number {
  return Math.floor((e.t * CYCLE_HZ + e.a) * 4) & 3;
}

interface GolemWorld {
  piles: Enemy[];
  uids: number[];
}
const WORLDS = new WeakMap<World, GolemWorld>();

function install(w: World): GolemWorld {
  let g = WORLDS.get(w);
  if (g) return g;
  const gw: GolemWorld = { piles: [], uids: [] };
  g = gw;
  WORLDS.set(w, gw);
  // the killing blow lands: collapse into a pile instead (hp is already <= 0 here, before the kill check)
  w.hooks.on("hit", (h) => {
    const e = h.enemy;
    if (e.def !== sandcastleGolem || e.hp > 0 || e.state === GOLEM_PILE || e.c <= 0) return;
    collapse(e, w, gw);
  });
  // explosions crumble piles in reach
  // (crumbling kills the pile, and a kill hook - Rin's talent, a relic - may set off another blast that
  // re-enters this hook and prunes the list: walk a snapshot, prune afterwards)
  w.hooks.on("blast", (b) => {
    if (!gw.piles.length) return;
    const piles = gw.piles.slice();
    const uids = gw.uids.slice();
    for (let i = 0; i < piles.length; i++) {
      const e = piles[i];
      if (e.dead || e.uid !== uids[i] || e.state !== GOLEM_PILE) continue;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const rr = b.r + e.r + 4;
      if (dx * dx + dy * dy <= rr * rr) crumble(e, w, 2);
    }
    for (let i = gw.piles.length - 1; i >= 0; i--) {
      const e = gw.piles[i];
      if (e.dead || e.uid !== gw.uids[i] || e.state !== GOLEM_PILE) {
        gw.piles.splice(i, 1);
        gw.uids.splice(i, 1);
      }
    }
  });
  return gw;
}

function collapse(e: Enemy, w: World, gw: GolemWorld): void {
  e.hp = 1;
  e.state = GOLEM_PILE;
  e.timer = 0;
  e.inv = 1e9;
  e.untargetable = true;
  e.dmg = 0;
  e.vx = e.vy = e.kx = e.ky = 0;
  e.sqV -= 10;
  gw.piles.push(e);
  gw.uids.push(e.uid);
  cue(w, BX_PILE, e.x, e.y, 0, 0, e.scale, e);
}

/** The pile is destroyed for good (stomp = 1, blast = 2): the real, final death (XP / elite loot now). */
function crumble(e: Enemy, w: World, how: number): void {
  cue(w, BX_MOAT, e.x, e.y, 0, 0, how, e);
  e.inv = 0;
  w.killEnemy(e, null, how === 1 ? "sandcastle_stomp" : "sandcastle_blast");
}

function rebuild(e: Enemy, w: World): void {
  e.state = 0;
  e.timer = 0;
  e.c--;
  e.hp = Math.max(1, Math.round(e.maxHp * 0.5));
  e.inv = 0.45;
  e.untargetable = false;
  e.dmg = e.def.dmg * (e.elite ? CFG.elite.dmg : 1) * w.enemyDmgMul() * w.difficulty.enemyDmg;
  e.sqV += 12;
  cue(w, BX_REBUILD, e.x, e.y, 0, 0, e.scale, e);
  quip(w, e, "Rebuild.", Q_REBUILD, 3);
}

export const sandcastleGolem: EnemyDef = {
  id: "sandcastle_golem",
  name: "Sandcastle Golem",
  sprite: "en_sandcastle",
  hp: 220,
  speed: 20,
  dmg: 15,
  radius: 10,
  height: 20,
  xp: 7,
  shadow: 21,
  knockResist: 0.8,
  colors: [C.gold, C.paleYellow, C.orange],
  init(e, w) {
    install(w);
    e.a = w.rng.next();
    e.b = stride(e);
    e.c = e.elite ? 2 : 1;
  },
  // art: f0-2 stomp walk (sand trickles), f3 collapsed sand pile
  frame(e) {
    if (e.state === GOLEM_PILE) return 3;
    const s = stride(e);
    return s === 3 ? 1 : s;
  },
  update(e, w, dt) {
    if (e.state === GOLEM_PILE) {
      e.vx = e.vy = 0;
      e.timer += dt;
      const p = w.player;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const rr = STOMP_R * e.scale;
      if (dx * dx + dy * dy < rr * rr && !p.dead) {
        crumble(e, w, 1);
        return;
      }
      if (e.timer >= PILE_TIME) rebuild(e, w);
      return;
    }
    toPlayer(e, w, dir);
    const f = stride(e);
    const sp = e.speed * (f === 0 || f === 2 ? 1.5 : 0.5);
    e.vx = dir.x * sp;
    e.vy = dir.y * sp;
    if (f !== e.b) {
      e.b = f;
      if (f === 1 || f === 3) {
        e.sqV += 4;
        if (f === 1 && onScreen(w, e.x, e.y, 24)) efx(w, EFX_STOMP, e.x, e.y, 0, 0, e.scale * 1.1, e);
      }
    }
  },
};

export const enemies: EnemyDef[] = [sandcastleGolem];
