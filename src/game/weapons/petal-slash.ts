/**
 * Petal Slash (Rin): a crescent sword arc in the facing direction (Lv2: also
 * behind; extra Amount adds up / down / diagonal arcs).
 * Evolution: Sakura Tempest (+ Big Ribbon) - a 360 degree whirlwind every 0.8 s
 * that also flings petal blades.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_ATTACHED, PK_FREE, ROT_SPIN, SHAPE_CIRCLE, SHAPE_ELLIPSE, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, wstats, type WStats } from "./_shared";

/** Direction offsets for slash #k: front, back, up, down, then diagonals. */
const DIRS = [0, Math.PI, -Math.PI / 2, Math.PI / 2, -Math.PI / 4, (Math.PI * 3) / 4, Math.PI / 4, (-Math.PI * 3) / 4];

/** Aim: the nearest enemy close by (auto-aim keeps melee fun on a phone), else the horizontal facing. */
function aimAngle(w: World): number {
  const pl = w.player;
  const e = w.nearestEnemy(pl.x, pl.y - 8, 64);
  if (e) return Math.atan2(e.y - e.cy - (pl.y - 8), e.x - pl.x);
  return pl.face > 0 ? 0 : Math.PI;
}

function slash(w: World, inst: WeaponInstance, S: WStats, k: number): void {
  const pl = w.player;
  if (k === 0) inst.data.aim = aimAngle(w);
  const a = (inst.data.aim ?? 0) + DIRS[k % DIRS.length];
  const reach = 19 * S.area;
  const p = w.spawnProjectile(inst);
  p.kind = PK_ATTACHED;
  p.ox = Math.cos(a) * reach;
  p.oy = Math.sin(a) * reach - 8;
  p.x = pl.x + p.ox;
  p.y = pl.y + p.oy;
  p.shape = SHAPE_ELLIPSE;
  p.ang = a;
  p.r = 1;
  p.hw = 24 * S.area;
  p.hh = 16 * S.area;
  p.dmg = S.dmg;
  p.knock = S.knock;
  p.pierce = Infinity;
  p.hitEvery = 0.3;
  p.life = 0.26;
  p.sprite = "w_slash";
  p.anim = 1;
  p.rot = a;
  p.scale = S.area;
  p.glow = true;
  p.trail = "slash";
}

export const petalSlash: WeaponDef = {
  id: "petal_slash",
  name: "Petal Slash",
  icon: "icon_petal_slash",
  color: C.pinkLight,
  sfx: "slash",
  desc: "A sweeping sakura sword arc in the direction you face.",
  levels: [
    { dmg: 16, cd: 1.1, amount: 1, area: 1, knock: 70 },
    { dmg: 16, cd: 1.1, amount: 2, area: 1, knock: 70 },
    { dmg: 22, cd: 1.1, amount: 2, area: 1.15, knock: 75 },
    { dmg: 22, cd: 0.9, amount: 2, area: 1.15, knock: 75 },
    { dmg: 30, cd: 0.9, amount: 2, area: 1.3, knock: 85 },
  ],
  upgrades: ["Also slashes behind you", "Damage +6, area +15%", "Cooldown -18%", "Damage +8, area +15%"],
  evolution: { into: "sakura_tempest", with: "big_ribbon" },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    if ((d.queue ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      while (d.qt <= 0 && d.queue > 0) {
        slash(w, inst, S, d.k ?? 0);
        d.k = (d.k ?? 0) + 1;
        d.queue--;
        d.qt += 0.09;
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = S.cd;
    d.queue = Math.min(DIRS.length, S.amount);
    d.qt = 0;
    d.k = 0;
    fired(w, inst, w.player.x, w.player.y);
  },
};

export const sakuraTempest: WeaponDef = {
  id: "sakura_tempest",
  name: "Sakura Tempest",
  icon: "icon_sakura_tempest",
  color: C.pink,
  sfx: "slash",
  evolved: true,
  desc: "EVOLUTION! A 360° petal whirlwind every 0.8 s that flings petal blades.",
  levels: [{ dmg: 28, cd: 0.8, amount: 6, area: 1, knock: 95, petalDmg: 14 }],
  upgrades: [],
  update(w, inst, dt) {
    const S = wstats(w, inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    inst.timer = S.cd;
    const pl = w.player;
    const r = 36 * S.area;
    const p = w.spawnProjectile(inst);
    p.kind = PK_ATTACHED;
    p.ox = 0;
    p.oy = -8;
    p.x = pl.x;
    p.y = pl.y - 8;
    p.shape = SHAPE_CIRCLE;
    p.r = r;
    p.dmg = S.dmg;
    p.knock = S.knock;
    p.pierce = Infinity;
    p.hitEvery = 0.5;
    p.life = 0.46;
    p.sprite = "w_tempest";
    p.anim = 0;
    p.fps = 16;
    p.rotMode = ROT_SPIN;
    p.spin = 10;
    p.scale = (r * 2) / 44;
    p.pop = true;
    p.alpha = 0.92;
    // petal blades: the fan is centred on the nearest enemy (a boss in range wins) and the blades curve in
    const n = Math.min(14, S.amount + 2);
    const b = w.boss;
    const tgt = b && !b.dead && Math.abs(b.x - pl.x) < 150 && Math.abs(b.y - b.cy - pl.y) < 150 ? b : w.nearestEnemy(pl.x, pl.y - 8, 150);
    const a0 = tgt ? Math.atan2(tgt.y - tgt.cy - (pl.y - 8), tgt.x - pl.x) : w.rng.angle();
    const pdmg = (S.L.petalDmg ?? 14) * w.stats.might;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * TAU;
      const q = w.spawnProjectile(inst);
      q.kind = PK_FREE;
      q.x = pl.x + Math.cos(a) * 10;
      q.y = pl.y - 8 + Math.sin(a) * 10;
      q.speed = 150 * w.stats.projSpeed;
      q.vx = Math.cos(a) * q.speed;
      q.vy = Math.sin(a) * q.speed;
      q.r = 4;
      q.homing = 3.2;
      q.target = k === 0 ? tgt : null;
      q.dmg = pdmg;
      q.pierce = 3;
      q.knock = 30;
      q.life = 0.75;
      q.sprite = "ult_petal";
      q.rotMode = ROT_SPIN;
      q.spin = 14;
      q.trail = "petal";
    }
    fired(w, inst, pl.x, pl.y);
  },
};

export const weapons: WeaponDef[] = [petalSlash, sakuraTempest];
