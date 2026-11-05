/**
 * Prism Beam: a 0.5 s piercing light beam from the hero toward the nearest
 * enemies (Amount = more beams at the next targets). The beam tracks its
 * target a little and ticks damage on everything along it (per-enemy re-hit
 * cooldown), pushing enemies away from the hero.
 * Evolution: Rainbow Cannon (+ Swift Shoes) - 3 wide rainbow beams sweeping a
 * full 360 degrees around the hero.
 *
 * Beams are owned PK_MANAGED projectiles with r = 0 (the generic hit test is
 * off): the hook runs an exact segment-vs-circle test. Scratch for the view:
 * ox/oy = origin, ang = angle, a = length, hh = current half width
 * (pulsing), vz = base half width, angV = sweep speed (0 = tracking),
 * b = target uid. Drawn by src/view/weapon-fx.ts (w_beam_seg tiles + tip).
 */
import { C } from "../../art/palette";
import { TAU, approachAngle } from "../../core/math";
import { PK_MANAGED, type Enemy, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { killOwned, own, prune, wstats, type WStats } from "./_shared";
import { WFX_BEAM_START, alive, fireSfx, wfx } from "./_fx";

const targets: Enemy[] = [];

/** Segment hits along the beam (exact capsule test, per-enemy cooldown on the slot channel). */
function beamHits(p: Projectile, w: World): void {
  const L = p.a;
  const ca = Math.cos(p.ang);
  const sa = Math.sin(p.ang);
  const mx = p.ox + ca * L * 0.5;
  const my = p.oy + sa * L * 0.5;
  const buf = w.acquire();
  const n = w.grid.query(mx, my, L * 0.5 + p.hh + 14, buf);
  const items = w.enemies.items;
  const now = w.t;
  const color = p.owner ? p.owner.def.color : C.white;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const ex = e.x - p.ox;
    const ey = e.y - e.cy - p.oy;
    const along = ex * ca + ey * sa;
    if (along < -e.r || along > L + e.r) continue;
    const side = -ex * sa + ey * ca;
    const lim = p.hh + e.r;
    if (side > lim || side < -lim) continue;
    if (now - e.lastHit[p.ch] < p.hitEvery) continue;
    e.lastHit[p.ch] = now;
    w.hitEnemy(e, p.dmg, p.owner, p.ang, p.knock, 0, p.source, color);
  }
  w.release();
}

const beamHook: ProjHook = (p, w, dt) => {
  const pl = w.player;
  p.ox = pl.x + pl.face * 3;
  p.oy = pl.y - 11;
  if (p.angV !== 0) p.ang += p.angV * dt;
  else {
    const t = p.target;
    if (alive(t, p.b)) p.ang = approachAngle(p.ang, Math.atan2(t.y - t.cy - p.oy, t.x - p.ox), 1.8 * dt);
  }
  // width: snap open, a lively pulse, pinch closed at the end
  const k = p.age / p.life;
  const open = Math.min(1, p.age / 0.06) * Math.min(1, (1 - k) / 0.18);
  p.hh = p.vz * open * (1 + 0.14 * Math.sin(p.age * 38 + p.uid));
  p.x = p.ox + Math.cos(p.ang) * p.a * 0.5;
  p.y = p.oy + Math.sin(p.ang) * p.a * 0.5;
  if (open > 0.3) beamHits(p, w);
};

function fireBeam(w: World, inst: WeaponInstance, S: WStats, ang: number, target: Enemy | null, sweep: number): void {
  const pl = w.player;
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.r = 0;
  p.ox = pl.x + pl.face * 3;
  p.oy = pl.y - 11;
  p.ang = ang;
  p.angV = sweep;
  p.target = target;
  p.b = target ? target.uid : -1;
  p.a = (S.L.len ?? 140) * S.area;
  p.vz = (S.L.width ?? 5) * Math.sqrt(S.area);
  p.hh = 0;
  p.x = p.ox;
  p.y = p.oy;
  p.dmg = S.dmg;
  p.knock = S.knock;
  p.hitEvery = S.L.tick ?? 0.1;
  p.pierce = Infinity;
  p.life = S.duration;
  p.glow = true;
  p.update = beamHook;
  own(inst, p);
}

export const prismBeam: WeaponDef = {
  id: "prism_beam",
  name: "Prism Beam",
  icon: "icon_prism_beam",
  color: C.aqua,
  sfx: "beam",
  desc: "Fires a piercing prism beam at the nearest enemy, burning through the whole line.",
  levels: [
    { dmg: 7, cd: 2.0, amount: 1, duration: 0.55, area: 1, len: 140, width: 3.5, tick: 0.1, knock: 10 },
    { dmg: 9, cd: 2.0, amount: 1, duration: 0.55, area: 1, len: 140, width: 3.5, tick: 0.1, knock: 10 },
    { dmg: 9, cd: 2.0, amount: 2, duration: 0.55, area: 1, len: 140, width: 3.5, tick: 0.1, knock: 10 },
    { dmg: 11, cd: 2.0, amount: 2, duration: 0.75, area: 1, len: 160, width: 4, tick: 0.1, knock: 12 },
    { dmg: 14, cd: 1.7, amount: 3, duration: 0.75, area: 1, len: 160, width: 4.5, tick: 0.1, knock: 12 },
  ],
  upgrades: ["Damage +2", "+1 beam", "Damage +2, a longer beam that lasts 35% longer", "Damage +3, +1 beam, cooldown -15%"],
  evolution: { into: "rainbow_cannon", with: "swift_shoes" },
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.1, text: "LIMIT BREAK — Spare Prism: +1 beam, +10% damage" },
    { dmg: 0.3, area: 0.15, text: "MASTERED — Full Spectrum: +30% damage, +15% beam size" },
  ],
  update(w, inst, dt) {
    prune(inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const pl = w.player;
    const range = (S.L.len ?? 140) * S.area;
    const ox = pl.x + pl.face * 3;
    const oy = pl.y - 11;
    const want = Math.min(8, S.amount);
    const n = w.nearestEnemies(ox, oy, range * 0.9, want, targets);
    if (n === 0) {
      inst.timer = 0.12;
      return;
    }
    inst.timer = Math.max(S.cd, S.duration + 0.2);
    for (let i = 0; i < want; i++) {
      const t = targets[i % n];
      let a = Math.atan2(t.y - t.cy - oy, t.x - ox);
      // more beams than targets: fan out around them
      if (i >= n) a += (i & 1 ? 1 : -1) * 0.32 * Math.ceil((i - n + 1) / 2);
      fireBeam(w, inst, S, a, i < n ? t : null, 0);
    }
    wfx(w, WFX_BEAM_START, ox, oy, ox, oy, Math.atan2(targets[0].y - targets[0].cy - oy, targets[0].x - ox), 0);
    fireSfx(w, inst, ox, oy);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const rainbowCannon: WeaponDef = {
  id: "rainbow_cannon",
  name: "Rainbow Cannon",
  icon: "icon_rainbow_cannon",
  color: C.pinkLight,
  sfx: "beamBig",
  evolved: true,
  desc: "EVOLUTION! 3 wide rainbow beams sweep a full 360° around you.",
  levels: [{ dmg: 15, cd: 3.1, amount: 3, duration: 2.4, area: 1, len: 172, width: 7, tick: 0.07, sweep: 2.62, knock: 26 }],
  upgrades: [],
  update(w, inst, dt) {
    prune(inst);
    const d = inst.data;
    d.spin = ((d.spin ?? 0) + 0.9 * dt) % TAU;
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - 8, 190)) {
      inst.timer = 0.15;
      return;
    }
    inst.timer = Math.max(S.cd, S.duration + 0.45);
    const n = Math.min(6, S.amount);
    d.dir = d.dir === 1 ? -1 : 1;
    // start aimed at the nearest enemy so the first frame already burns something
    const e = w.nearestEnemy(pl.x, pl.y - 8, 190) as Enemy;
    const a0 = Math.atan2(e.y - e.cy - (pl.y - 11), e.x - pl.x);
    const sweep = (S.L.sweep ?? 2.62) * d.dir;
    for (let i = 0; i < n; i++) fireBeam(w, inst, S, a0 + (i / n) * TAU, null, sweep);
    wfx(w, WFX_BEAM_START, pl.x, pl.y - 11, pl.x, pl.y, a0, 1);
    fireSfx(w, inst, pl.x, pl.y);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const weapons: WeaponDef[] = [prismBeam, rainbowCannon];
