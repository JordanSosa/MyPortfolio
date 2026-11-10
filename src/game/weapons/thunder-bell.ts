/**
 * Thunder Bell: golden bells ring above random on-screen enemies, then a
 * jagged bolt drops from the sky through the bell onto the target and chains
 * to nearby enemies for 60% damage per hop; every strike also sparks a small
 * area (bigger at Lv3 / Lv5).
 * Evolution: Raijin Drum (+ Power Bow) - a drum beat at the hero calls 8 huge
 * branching bolts that each blast an area and still chain.
 * Second evolution: Group Chat Lightning (+ Friendship Bracelet) - one bolt on a random enemy that is
 *   FORWARDED: it hops to the nearest enemy it has not hit yet (`hops` + `perWeapon` per other weapon held,
 *   one hop every `hopT` s, no damage falloff); the last enemy of a full chain takes a blast. No burst and no
 *   screen flash: steady chains that reward dense packs and a wide build.
 *
 * Sim side: a bell projectile (no hit shape) follows its target and calls
 * strike() when its fuse runs out. Lightning, blasts and flashes are
 * `weaponFx` events drawn by src/view/weapon-fx.ts.
 */
import { C } from "../../art/palette";
import { PK_MANAGED, type Enemy, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { wstats } from "./_shared";
import { WFX_BOLT, WFX_BOLT_BIG, WFX_CHAIN, WFX_DRUM, alive, fireSfx, heroFx, randomTargetsInView, sfxAt, wfx } from "./_fx";

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
  evolutions: [
    { into: "raijin_drum", with: "power_bow" },
    { into: "group_chat_lightning", with: "friendship_bracelet" },
  ],
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

// ---------------------------------------------------------------- Group Chat Lightning

/** View cues (heroFx). The first bolt: from the sky (x, y) onto (x2, y2). */
export const FX_CHAT_BOLT = "e2a_bolt";
/** A forward: hop n from (x, y) to (x2, y2). */
export const FX_CHAT_HOP = "e2a_hop";
/** "Seen by everyone": the blast on the last enemy of a full chain at (x, y), radius r, n = the chain's length. */
export const FX_CHAT_SEEN = "e2a_seen";

const CHAT_MAX = 48;
/** The chain in flight of one instance (it lives over many steps: its own struck list). */
interface Chat {
  struck: Int32Array;
  n: number;
  x: number;
  y: number;
  hop: number;
  hops: number;
  /** Seconds to the next forward. */
  t: number;
  live: boolean;
}
const chats = new WeakMap<WeaponInstance, Chat>();
function chatOf(inst: WeaponInstance): Chat {
  let c = chats.get(inst);
  if (!c) chats.set(inst, (c = { struck: new Int32Array(CHAT_MAX), n: 0, x: 0, y: 0, hop: 0, hops: 0, t: 0, live: false }));
  return c;
}

let accChat: Chat | null = null;
const acceptForward = (id: number): boolean => {
  const e = (accW as World).enemies.items[id];
  if (!e || e.dead || e.def.prop || e.untargetable) return false;
  const c = accChat as Chat;
  for (let i = 0; i < c.n; i++) if (c.struck[i] === e.uid) return false;
  return true;
};

/** Forward the bolt once (or end the chain: a full one ends on the "seen by everyone" blast). */
function forward(w: World, inst: WeaponInstance, c: Chat): void {
  const S = wstats(w, inst);
  const L = S.L;
  const dmg = S.dmg;
  const knock = S.knock;
  const area = S.area;
  let e: Enemy | null = null;
  if (c.hop < c.hops) {
    accW = w;
    accChat = c;
    const id = w.grid.nearest(c.x, c.y, (L.reach ?? 70) * area, acceptForward);
    accW = null;
    accChat = null;
    if (id >= 0) e = w.enemies.items[id];
  }
  if (!e) {
    c.live = false;
    if (c.hop < c.hops || c.hop === 0) return;
    const r = (L.seenR ?? 30) * area;
    heroFx(w, FX_CHAT_SEEN, c.x, c.y, c.x, c.y, r, c.hop);
    nStruck = 0;
    blast(w, inst, c.x, c.y, r, dmg * (L.seenMul ?? 2), knock * 2);
    return;
  }
  const ey = e.y - e.cy;
  if (c.n < CHAT_MAX) c.struck[c.n++] = e.uid;
  heroFx(w, FX_CHAT_HOP, c.x, c.y, e.x, ey, 0, c.hop);
  const a = Math.atan2(ey - c.y, e.x - c.x);
  c.x = e.x;
  c.y = ey;
  c.hop++;
  w.hitEnemy(e, dmg, inst, a, knock, 0, inst.def.id, inst.def.color);
}

export const groupChatLightning: WeaponDef = {
  id: "group_chat_lightning",
  name: "Group Chat Lightning",
  icon: "icon_group_chat_lightning",
  color: C.aqua,
  sfx: "thunder",
  evolved: true,
  desc: "EVOLUTION! One bolt, forwarded to everyone. Nobody asked to be added.",
  levels: [{ dmg: 66, cd: 0.9, amount: 1, hops: 10, perWeapon: 2, reach: 80, hopT: 0.04, seenR: 36, seenMul: 3, knock: 18 }],
  upgrades: [],
  update(w, inst, dt) {
    const c = chatOf(inst);
    const d = inst.data;
    if (c.live) {
      c.t -= dt;
      while (c.live && c.t <= 0) {
        forward(w, inst, c);
        c.t += inst.def.levels[0].hopT ?? 0.04;
      }
    }
    inst.timer -= dt;
    if (inst.timer <= 0 && !c.live && (d.queue ?? 0) <= 0) {
      const S = wstats(w, inst);
      inst.timer = S.cd;
      d.queue = Math.min(6, S.amount);
    }
    if (c.live || (d.queue ?? 0) <= 0) return;
    // the next bolt of the volley (extra Amount: one after the other, each its own chain)
    if (randomTargetsInView(w, 1, targets) === 0) {
      d.queue = 0;
      inst.timer = Math.min(inst.timer, 0.2);
      return;
    }
    d.queue--;
    const S = wstats(w, inst);
    const L = S.L;
    const dmg = S.dmg;
    const knock = S.knock;
    const e = targets[0];
    const x = e.x;
    const y = e.y - e.cy;
    c.n = 0;
    c.struck[c.n++] = e.uid;
    c.x = x;
    c.y = y;
    c.hop = 0;
    c.hops = Math.min(CHAT_MAX - 1, Math.round((L.hops ?? 10) + (L.perWeapon ?? 2) * Math.max(0, w.weapons.length - 1)));
    c.t = L.hopT ?? 0.04;
    c.live = true;
    heroFx(w, FX_CHAT_BOLT, x + (w.rng.next() - 0.5) * 24, y - 170, x, y);
    fireSfx(w, inst, x, y);
    w.hitEnemy(e, dmg, inst, DOWN, knock, 0, inst.def.id, inst.def.color);
  },
};

export const weapons: WeaponDef[] = [thunderBell, raijinDrum, groupChatLightning];
