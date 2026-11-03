/**
 * Thunder Bell: golden bells ring above random on-screen enemies, then a
 * jagged bolt drops from the sky through the bell onto the target and chains
 * to nearby enemies for 60% damage per hop; every strike also sparks a small
 * area (bigger at Lv3 / Lv5).
 * Evolution: Raijin Drum (+ Power Bow) - a drum beat at the hero calls 8 huge
 * branching bolts that each blast an area and still chain.
 *
 * Sim side: a bell projectile (no hit shape) follows its target and calls
 * strike() when its fuse runs out. Lightning, blasts and flashes are
 * `weaponFx` events drawn by src/view/weapon-fx.ts.
 */
import { C } from "../../art/palette";
import { PK_MANAGED, type Enemy, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { wstats } from "./_shared";
import { WFX_BOLT, WFX_BOLT_BIG, WFX_CHAIN, WFX_DRUM, alive, fireSfx, randomTargetsInView, sfxAt, wfx } from "./_fx";

const targets: Enemy[] = [];
/** uids hit by the current strike (chain never revisits). */
const struck = new Int32Array(32);
let nStruck = 0;
let accW: World | null = null;
/** Grid filter for the next chain hop (module scope: no per-call closures). */
const acceptChain = (id: number): boolean => {
  const e = (accW as World).enemies.items[id];
  if (!e || e.dead || e.def.prop) return false;
  for (let i = 0; i < nStruck; i++) if (struck[i] === e.uid) return false;
  return true;
};

const DOWN = Math.PI / 2;

/** Damage everything in a circle around (x, y) except uids already struck. */
function blast(w: World, inst: WeaponInstance, x: number, y: number, r: number, dmg: number, knock: number): void {
  const buf = w.acquire();
  const n = w.grid.query(x, y, r + 20, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - e.cy - y;
    const rr = r + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    let seen = false;
    for (let i = 0; i < nStruck; i++)
      if (struck[i] === e.uid) {
        seen = true;
        break;
      }
    if (seen) continue;
    if (nStruck < struck.length) struck[nStruck++] = e.uid;
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, inst.def.id, inst.def.color);
  }
  w.release();
}

/** One lightning strike at ground target (x, y = body centre) + chain hops. */
function strike(w: World, inst: WeaponInstance, x: number, y: number, target: Enemy | null, big: boolean): void {
  const S = wstats(w, inst);
  const L = S.L;
  const id = inst.def.id;
  const color = inst.def.color;
  nStruck = 0;
  const skew = (w.rng.next() - 0.5) * 30;
  if (big) wfx(w, WFX_BOLT_BIG, x + skew, y - 190, x, y, (L.splash ?? 0) * S.area);
  else wfx(w, WFX_BOLT, x + skew, y - 160, x, y, (L.splash ?? 0) * S.area);
  sfxAt(w, id, "thunder", x, y);
  if (target && !target.dead) {
    struck[nStruck++] = target.uid;
    w.hitEnemy(target, S.dmg, inst, DOWN, S.knock, 0.05, id, color);
  }
  const splash = (L.splash ?? 0) * S.area;
  if (splash > 0) blast(w, inst, x, y, splash, S.dmg * (big ? 0.9 : 0.5), S.knock * 1.6);
  // chain hops: 60% damage each, never the same enemy twice
  const hops = Math.round(L.chain ?? 0);
  const reach = (L.reach ?? 52) * S.area;
  let cx = x;
  let cy = y;
  accW = w;
  for (let h = 0; h < hops; h++) {
    const nid = w.grid.nearest(cx, cy, reach, acceptChain);
    if (nid < 0) break;
    const e = w.enemies.items[nid];
    const ey = e.y - e.cy;
    if (nStruck < struck.length) struck[nStruck++] = e.uid;
    wfx(w, WFX_CHAIN, cx, cy, e.x, ey, 0, h + (big ? 8 : 0));
    w.hitEnemy(e, S.dmg * 0.6, inst, Math.atan2(ey - cy, e.x - cx), S.knock * 0.6, 0, id, color);
    cx = e.x;
    cy = ey;
  }
  accW = null;
}

/**
 * Bell marker: follows its target, strikes when the fuse runs out, then
 * lingers a moment (pop-out). Scratch: a = target uid, ox = fuse (s),
 * oy = 1 once struck, b = 1 for Raijin bolts, hh = strike y (body centre).
 */
const bellHook: ProjHook = (p, w) => {
  if (p.oy !== 0) return;
  const t = p.target;
  if (alive(t, p.a)) {
    p.x = t.x;
    p.hh = t.y - t.cy;
    p.y = t.y - t.cy * 2 - (p.b ? 14 : 10);
  }
  if (p.age >= p.ox) {
    p.oy = 1;
    if (p.owner) strike(w, p.owner, p.x, p.hh, alive(t, p.a) ? t : null, p.b !== 0);
  }
};

function ringBell(w: World, inst: WeaponInstance, e: Enemy | null, x: number, y: number, fuse: number, big: boolean): void {
  const p = w.spawnProjectile(inst);
  p.kind = PK_MANAGED;
  p.r = 0;
  p.target = e;
  p.a = e ? e.uid : -1;
  p.x = e ? e.x : x;
  p.hh = e ? e.y - e.cy : y;
  p.y = e ? e.y - e.cy * 2 - (big ? 14 : 10) : y - 16;
  p.ox = fuse;
  p.oy = 0;
  p.b = big ? 1 : 0;
  p.life = fuse + 0.32;
  p.sprite = "w_bell";
  p.fps = big ? 14 : 10;
  p.scale = big ? 1.5 : 1;
  p.tint = big ? C.paleYellow : 0xffffff;
  p.glow = true;
  p.pop = true;
  p.update = bellHook;
}

export const thunderBell: WeaponDef = {
  id: "thunder_bell",
  name: "Thunder Bell",
  icon: "icon_thunder_bell",
  color: C.yellow,
  sfx: "bell",
  desc: "Bells ring over random enemies and call down chaining lightning.",
  levels: [
    { dmg: 24, cd: 1.4, amount: 2, chain: 3, reach: 56, splash: 10, knock: 30 },
    { dmg: 24, cd: 1.4, amount: 3, chain: 3, reach: 56, splash: 10, knock: 30 },
    { dmg: 32, cd: 1.4, amount: 3, chain: 4, reach: 60, splash: 12, knock: 32 },
    { dmg: 32, cd: 1.2, amount: 4, chain: 4, reach: 60, splash: 12, knock: 32 },
    { dmg: 42, cd: 1.2, amount: 4, chain: 5, reach: 66, splash: 18, knock: 36 },
  ],
  upgrades: ["+1 strike", "Damage +8, chains to 1 more enemy", "+1 strike, cooldown -14%", "Damage +10, +1 chain, bigger strike blasts"],
  evolution: { into: "raijin_drum", with: "power_bow" },
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.15, text: "LIMIT BREAK — Extra Bell: +1 strike, +15% damage" },
    { dmg: 0.25, cd: 0.88, text: "MASTERED — Shrine Festival: +25% damage, −12% cooldown" },
  ],
  update(w, inst, dt) {
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const n = randomTargetsInView(w, Math.min(12, S.amount), targets);
    if (n === 0) {
      inst.timer = 0.2;
      return;
    }
    inst.timer = S.cd;
    for (let i = 0; i < n; i++) ringBell(w, inst, targets[i], 0, 0, 0.2 + i * 0.09, false);
    fireSfx(w, inst, w.player.x, w.player.y);
  },
};

export const raijinDrum: WeaponDef = {
  id: "raijin_drum",
  name: "Raijin Drum",
  icon: "icon_raijin_drum",
  color: C.paleYellow,
  sfx: "thunder",
  evolved: true,
  desc: "EVOLUTION! A thunder-drum beat calls 8 huge branching bolts that blast and chain.",
  levels: [{ dmg: 55, cd: 2.3, amount: 8, chain: 2, reach: 66, splash: 28, knock: 70 }],
  upgrades: [],
  update(w, inst, dt) {
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const want = Math.min(14, S.amount + 1);
    const n = randomTargetsInView(w, want, targets);
    if (n === 0) {
      inst.timer = 0.25;
      return;
    }
    inst.timer = S.cd;
    const pl = w.player;
    wfx(w, WFX_DRUM, pl.x, pl.y - 8, pl.x, pl.y, 0, want);
    fireSfx(w, inst, pl.x, pl.y);
    // a rolling volley: targets first, then repeats / open ground near the hero
    for (let i = 0; i < want; i++) {
      const fuse = 0.22 + i * 0.065;
      if (i < n) ringBell(w, inst, targets[i], 0, 0, fuse, true);
      else {
        const e = targets[i % n];
        if (!e.dead && w.rng.next() < 0.5) ringBell(w, inst, e, 0, 0, fuse, true);
        else ringBell(w, inst, null, pl.x + (w.rng.next() - 0.5) * w.viewW * 0.8, pl.y + (w.rng.next() - 0.5) * w.viewH * 0.6, fuse, true);
      }
    }
  },
};

export const weapons: WeaponDef[] = [thunderBell, raijinDrum];
