/**
 * Henshin Burst (Magical Girl #47's signature, docs/content/weapons.md §2.6):
 * a charge timer of `cd` s; when full, a henshin of `iframe` s (the hero is
 * invulnerable and moves at 50 % while ribbons spin), then a burst: circle r
 * `radius` x area, `dmg`, `knock`, plus `ribbons` ribbon projectiles fanned
 * evenly (160 px/s, pierce 2, `ribbonDmg`, life 0.8 s). +2 ribbons per extra
 * amount. Lv5: the burst heals 5 HP and clears enemy bullets inside it.
 *
 * Twist - Panic Henshin: if the hero would take damage while the charge is at
 * 80 % or more, the henshin triggers at once and the hit is negated (emits the
 * `block` hook; "PANIC HENSHIN!", rate-limited in the view). Implemented as a
 * World.hurtGuards entry.
 *
 * Evolution: Infinite Henshin Loop (+ Plot Armor) - never stops transforming:
 * every henshin leaves a Plot Armor shield charge (max 1 bonus, lasts until hit),
 * the burst heals 3 and always clears bullets; a narration pop at most once per
 * 30 s ("That's the 47th transformation this episode.").
 *
 * Second evolution: Skip Intro (+ Wish Charm) - no henshin at all: the burst fires every `cd` s with no
 * i-frames, no slow walk and no Panic Henshin; every `finEvery`-th burst is the stock-footage finisher
 * (radius x `finArea`, damage x `finDmg`). Quick Change and Double Henshin still apply; C6 fires a burst.
 *
 * Magical Girl #47's talents read here: Quick Change (-4 % cooldown per rank),
 * Panic Henshin+ (70 / 60 / 50 % threshold), Double Henshin (the burst repeats
 * 0.5 s later at 50 % with mirrored ribbons). C6: a henshin on every level-up
 * (forceHenshin). Counts RunStats.henshins. The view reads `inst.data.k`
 * (charge 0..1) and `inst.data.hen` (henshin seconds left).
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import { Buff } from "../hooks";
import { PK_FREE, ROT_SPIN, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { HB, hfx } from "./_hb";
import { fired, wstats, type WStats } from "./_shared";

const ID = "henshin_burst";
const EVO = "infinite_henshin_loop";
const SKIP = "skip_intro";
/**
 * Skip Intro's burst cue (src/view/evo2/d.ts draws it; same payload as HB.BURST): at twice the burst rate
 * the base weapon's glow ring + shockwave kept the screen white, so this route has its own, lighter one.
 */
export const SKIP_BURST = "evo2d_skip";
/** `n` bits of a Skip Intro burst: a skipped burst (always set), and its stock-footage finisher. */
export const BURST_SKIP = 8;
export const BURST_FINISHER = 16;
const RIBBON_SPEED = 160;

interface HenshinState {
  slow: Buff;
  /** Run time of the last evolution narration pop. */
  narrAt: number;
  /** Block hook payload (reused). */
  block: { x: number; y: number; left: number };
}
const states = new WeakMap<World, HenshinState>();

/** The live henshin weapon (the evolution first). */
function henshinInst(w: World): WeaponInstance | null {
  return w.hasWeapon(EVO) ?? w.hasWeapon(ID) ?? null;
}

/** Effective charge time (Quick Change -4 % per rank). */
function chargeTime(w: World, S: WStats): number {
  return Math.max(0.6, S.cd * (1 - 0.04 * w.talentRank("mg47_quick_change")));
}

/** Per-world state: the 50 % move-speed Buff and the Panic Henshin guard (installed once). */
function state(w: World): HenshinState {
  let st = states.get(w);
  if (st) return st;
  const slow = new Buff(w);
  w.statMods.push((s) => {
    if (slow.on) s.moveSpeed *= 0.5;
  });
  const s: HenshinState = { slow, narrAt: -99, block: { x: 0, y: 0, left: 0 } };
  st = s;
  states.set(w, s);
  // Panic Henshin: a hit while the charge is >= 80 % (Panic Henshin+: 70 / 60 / 50 %) is negated
  w.hurtGuards.push(() => {
    const inst = henshinInst(w);
    if (!inst || (inst.data.hen ?? 0) > 0) return false;
    const S = wstats(w, inst);
    const thresh = 0.8 - 0.1 * w.talentRank("mg47_panic_plus");
    if ((inst.data.charge ?? 0) < chargeTime(w, S) * thresh) return false;
    startHenshin(w, inst, S, 1);
    const p = w.player;
    s.block.x = p.x;
    s.block.y = p.y;
    s.block.left = p.shield;
    w.hooks.emit("block", s.block);
    hfx(w, HB.PANIC, p.x, p.y - 22);
    return true;
  });
  return s;
}

/** Begin a henshin: invulnerable + 50 % speed for `iframe` s, then the burst. `why`: 0 charge, 1 panic, 2 level-up. */
function startHenshin(w: World, inst: WeaponInstance, S: WStats, why: number): void {
  const d = inst.data;
  const t = S.L.iframe ?? 0.6;
  d.hen = t;
  d.charge = 0;
  const p = w.player;
  // (dash invulnerability: no hurt blink while she transforms)
  p.dashInv = Math.max(p.dashInv, t);
  state(w).slow.start(t);
  w.bumpStat("henshins");
  // Infinite Henshin Loop: every henshin leaves a Plot Armor shield charge (max 1 bonus)
  if (inst.def.id === EVO && p.shield < w.stats.shield + 1) p.shield++;
  hfx(w, HB.HENSHIN, p.x, p.y - CFG.playerCy, p.x, p.y, t, inst.def.id === EVO ? 3 : why);
  fired(w, inst, p.x, p.y);
}

/**
 * The burst: circle damage + ribbons. `mul` = damage share (Double Henshin echo 0.5), `mirror` = echo,
 * `rK` = radius factor and `bits` = extra HB.BURST bits (Skip Intro).
 */
function burst(w: World, inst: WeaponInstance, S: WStats, mul: number, mirror: boolean, rK = 1, bits = 0): void {
  const p = w.player;
  const cx = p.x;
  const cy = p.y - CFG.playerCy;
  const L = S.L;
  const evo = inst.def.id === EVO;
  const R = (L.radius ?? 56) * S.area * rK;
  const dmg = S.dmg * mul;
  const knock = S.knock;
  const buf = w.acquire();
  const n = w.grid.query(cx, cy, R + 12, buf);
  const items = w.enemies.items;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - cx;
    const dy = e.y - e.cy - cy;
    const rr = R + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, inst.def.id, inst.def.color);
  }
  w.release();
  // ribbons fanned evenly (+2 per extra amount); the echo is offset half a step and spins the other way
  const count = (L.ribbons ?? 0) + 2 * Math.max(0, S.amount - 1);
  if (count > 0) {
    const a0 = (d0(inst) + (mirror ? 0.5 : 0)) * (TAU / count);
    const sp = RIBBON_SPEED * w.stats.projSpeed;
    // (S.dmg / L.dmg = might x mastery x Limit Break: the ribbons scale like the burst)
    const rd = (L.ribbonDmg ?? 10) * (S.dmg / Math.max(1e-6, L.dmg)) * mul;
    for (let i = 0; i < count; i++) {
      const a = a0 + (i / count) * TAU;
      const q = w.spawnProjectile(inst);
      q.kind = PK_FREE;
      q.x = cx + Math.cos(a) * 6;
      q.y = cy + Math.sin(a) * 6;
      q.speed = sp;
      q.vx = Math.cos(a) * sp;
      q.vy = Math.sin(a) * sp;
      q.r = 5;
      q.dmg = rd;
      q.pierce = 2;
      q.knock = 40;
      q.life = 0.8 * w.stats.duration;
      q.sprite = evo ? "w_ribbon_evo" : "w_ribbon";
      q.fps = 8;
      q.rotMode = ROT_SPIN;
      q.spin = mirror ? -10 : 10;
      q.flipX = mirror;
      q.glow = true;
      q.trail = "hbRibbon";
      q.pop = true;
    }
  }
  // Lv5 / evolution: heal + clear the enemy bullets inside the burst
  let cleared = 0;
  if (evo || inst.level >= 5) {
    if (mul >= 1) w.heal(evo ? 3 : 5, true);
    const bl = w.bullets;
    const r2 = R * R;
    for (let i = 0; i < bl.count; i++) {
      const b = bl.items[i];
      if (b.dead) continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy <= r2) {
        b.dead = true;
        cleared++;
      }
    }
  }
  hfx(w, bits & BURST_SKIP ? SKIP_BURST : HB.BURST, cx, cy, p.x, p.y, R, (mirror ? 1 : 0) | (evo ? 2 : 0) | (cleared > 0 ? 4 : 0) | bits);
  // the evolution's narrator, at most once per 30 s
  if (evo && mul >= 1) {
    const st = state(w);
    if (w.t - st.narrAt >= 30) {
      st.narrAt = w.t;
      hfx(w, HB.NARRATE_47, cx, cy);
    }
  }
}

/** A different fan phase each burst (the ribbons don't fly out on the same rays every time). */
function d0(inst: WeaponInstance): number {
  const d = inst.data;
  d.fan = ((d.fan ?? 0) + 0.37) % 1;
  return d.fan;
}

function update(w: World, inst: WeaponInstance, dt: number): void {
  const S = wstats(w, inst);
  const d = inst.data;
  state(w);
  const cd = chargeTime(w, S);
  if ((d.echo ?? 0) > 0) {
    d.echo -= dt;
    if (d.echo <= 0) burst(w, inst, S, 0.5, true);
  }
  if ((d.hen ?? 0) > 0) {
    d.hen -= dt;
    if (d.hen <= 0) {
      d.hen = 0;
      burst(w, inst, S, 1, false);
      // Double Henshin: the burst repeats 0.5 s later at 50 % with mirrored ribbons
      if (w.talentRank("mg47_double_henshin") > 0) d.echo = 0.5;
    }
  } else {
    d.charge = (d.charge ?? 0) + dt;
    if (d.charge >= cd) startHenshin(w, inst, S, 0);
  }
  d.k = Math.min(1, (d.charge ?? 0) / cd);
}

/** Trigger a henshin now (Magical Girl #47 C6: on every level-up). No-op while one is running. */
export function forceHenshin(w: World): void {
  // (Skip Intro has no henshin to trigger: its next burst fires now)
  const skip = w.hasWeapon(SKIP);
  if (skip) skip.data.charge = 1e9;
  const inst = henshinInst(w);
  if (!inst || (inst.data.hen ?? 0) > 0 || w.phase !== "play") return;
  startHenshin(w, inst, wstats(w, inst), 2);
}

export const henshinBurst: WeaponDef = {
  id: ID,
  name: "Henshin Burst",
  icon: "icon_henshin_burst",
  color: C.mint,
  sfx: "transform",
  desc: "Periodically transform: invulnerable for a moment, then a radial burst. Transforms instantly if you're about to be hit.",
  levels: [
    { dmg: 45, cd: 5, amount: 1, radius: 56, iframe: 0.6, ribbons: 0, ribbonDmg: 0, knock: 160 },
    { dmg: 45, cd: 5, amount: 1, radius: 56, iframe: 0.6, ribbons: 6, ribbonDmg: 10, knock: 160 },
    { dmg: 60, cd: 5, amount: 1, radius: 64, iframe: 0.6, ribbons: 6, ribbonDmg: 10, knock: 170 },
    { dmg: 60, cd: 4.4, amount: 1, radius: 64, iframe: 0.6, ribbons: 8, ribbonDmg: 10, knock: 170 },
    { dmg: 80, cd: 4.4, amount: 1, radius: 72, iframe: 0.6, ribbons: 8, ribbonDmg: 14, knock: 180 },
  ],
  upgrades: ["+6 ribbons fly out of the burst", "Damage +15, bigger burst", "Cooldown −12%, +2 ribbons", "Damage +20, the burst heals 5 HP and clears enemy bullets inside it"],
  evolutions: [
    { into: EVO, with: "plot_armor" },
    { into: SKIP, with: "wish_charm" },
  ],
  limitBreak: [
    { dmg: 0.25, area: 0.1, text: "LIMIT BREAK — Season 2 Costume: +25% damage, +10% burst" },
    { cd: 0.85, amount: 1, text: "MASTERED — Stock Footage: −15% cooldown, +2 ribbons" },
  ],
  init(w, inst) {
    state(w);
    inst.data.charge = 0;
    inst.data.hen = 0;
  },
  update,
  dispose(w, inst) {
    // (evolving mid-henshin: the 50 % slow ends with the next stat recompute, the burst is skipped)
    if ((inst.data.hen ?? 0) > 0) state(w).slow.t = Math.min(state(w).slow.t, 0.01);
  },
};

export const infiniteHenshinLoop: WeaponDef = {
  id: EVO,
  name: "Infinite Henshin Loop",
  icon: "icon_infinite_henshin_loop",
  color: C.yellow,
  sfx: "transform",
  evolved: true,
  desc: "EVOLUTION! You never stop transforming. Every henshin leaves a Plot Armor shield.",
  levels: [{ dmg: 70, cd: 2.5, amount: 1, radius: 88, iframe: 0.9, ribbons: 12, ribbonDmg: 18, knock: 200 }],
  upgrades: [],
  init(w, inst) {
    state(w);
    inst.data.charge = 1.2;
    inst.data.hen = 0;
  },
  update,
};

export const skipIntro: WeaponDef = {
  id: SKIP,
  name: "Skip Intro",
  icon: "icon_skip_intro",
  color: C.mint,
  evolved: true,
  desc: "EVOLUTION! The transformation sequence has been skipped. So has the invulnerability.",
  levels: [{ dmg: 44, cd: 1.25, amount: 1, radius: 70, ribbons: 8, ribbonDmg: 14, knock: 160, finEvery: 5, finArea: 1.4, finDmg: 2 }],
  upgrades: [],
  init(_w, inst) {
    inst.data.charge = 0.6;
  },
  update(w, inst, dt) {
    const S = wstats(w, inst);
    const d = inst.data;
    if ((d.echo ?? 0) > 0) {
      d.echo -= dt;
      if (d.echo <= 0) burst(w, inst, S, 0.5, true, d.er ?? 1, BURST_SKIP);
    }
    d.charge = (d.charge ?? 0) + dt;
    if (d.charge < chargeTime(w, S)) return;
    d.charge = 0;
    d.n = (d.n ?? 0) + 1;
    // every `finEvery`-th burst is the stock-footage finisher: bigger, twice the damage
    const fin = d.n % Math.max(2, S.L.finEvery ?? 5) === 0;
    const rK = fin ? (S.L.finArea ?? 1.4) : 1;
    burst(w, inst, S, fin ? (S.L.finDmg ?? 2) : 1, false, rK, BURST_SKIP | (fin ? BURST_FINISHER : 0));
    // Double Henshin: the burst repeats 0.5 s later at 50 % with mirrored ribbons
    if (w.talentRank("mg47_double_henshin") > 0) {
      d.echo = 0.5;
      d.er = rK;
    }
  },
};

export const weapons: WeaponDef[] = [henshinBurst, infiniteHenshinLoop, skipIntro];
