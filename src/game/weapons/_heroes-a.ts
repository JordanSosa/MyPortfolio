/**
 * Season 2 heroes, group A (Kuro, Pudding, Aoi, Akane): sim helpers shared by
 * their signature weapons, ultimates, talents and constellations (no
 * `weapons` export: the registry ignores this file).
 *
 *   - `hfx()`        heroFx cue for the view (src/view/heroes-a-fx.ts), one reused payload
 *   - `daze()`       Enemy.stun (bosses / props are never dazed)
 *   - `dropSnack()`  a "snack" food pickup with its own sprite (puddings, petit fours, Moe hearts)
 *   - `heroesA(w)`   per-world state, created on first use, with ONE kill hook and ONE step hook:
 *        burns      Dark Flame Dragon Burn (ticks every 0.5 s, refreshes, never stacks; Wildfire spread,
 *                   the Unsealed Abyss Dragon's death bursts, Seal Broken's +15 % damage taken)
 *        mark       Abyssal Gaze: the next hit on the Marked enemy is a guaranteed crit
 *        flyers     Baka Harisen ricochet / Dere Dere Harisen human missiles
 *        pops       BAKA! pop rules (docs/content/satire.md §5), counted in RunStats.bakas
 *
 * Everything is allocation-free per step: records are pooled, payloads reused.
 * Content-module import rule: types only from world.ts.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { HeroFxEvent } from "../events";
import type { Enemy, Pickup, WeaponInstance } from "../types";
import type { World } from "../world";

// ---------------------------------------------------------------- heroFx cues (namespaced kinds)
/** Kuro: a familiar breathes (x, y = mouth, x2 = angle, y2 = cone half-angle, r = length, n = 1 black flames). */
export const HFX_KURO_BREATH = "kuro_breath";
/** Kuro: the Crimson Eye Beam (x, y origin, x2 angle, r length, y2 duration). */
export const HFX_KURO_EYE_BEAM = "kuro_eye_beam";
/** Kuro: an enemy got Marked by the Abyssal Gaze (enemy). */
export const HFX_KURO_MARK = "kuro_mark";
/** Kuro: ABYSSAL LORD'S JUDGEMENT jet (x, y origin, x2 angle, r length, y2 duration). */
export const HFX_KURO_JET = "kuro_jet";
/** Kuro: a burning enemy died and burst (x, y, r). */
export const HFX_KURO_BURST = "kuro_burst";
/** Kuro ult: the shadow sweep starts (n = pass index, x2 = direction +1 / -1, r = pass seconds). */
export const HFX_KURO_SHADOW = "kuro_shadow";
/** Kuro ult: the reveal (n = 1 stadium floodlight). */
export const HFX_KURO_REVEAL = "kuro_reveal";
/** Pudding: a teacup tips and spills (x, y). */
export const HFX_PUD_SPILL = "pud_spill";
/** Pudding: the hero is healed by a puddle / the moat (x, y, n = HP). */
export const HFX_PUD_SIP = "pud_sip";
/** Pudding: a thrown teacup shatters (x, y, r). */
export const HFX_PUD_SHATTER = "pud_shatter";
/** Pudding ult: the omurice plops (x, y). */
export const HFX_PUD_OMURICE = "pud_omurice";
/** Pudding ult: the ketchup heart is drawn (x, y). */
export const HFX_PUD_KETCHUP = "pud_ketchup";
/** Pudding ult: a MOE / KYUN pulse (x, y, r, n = pulse index, y2 = 1 last pulse). */
export const HFX_PUD_PULSE = "pud_pulse";
/** Aoi: a salvo launches (x, y, n = missiles, r = 1 FULL BURST). */
export const HFX_AOI_SALVO = "aoi_salvo";
/** Aoi ult: a fist starts falling (x, y = landing point). */
export const HFX_AOI_FIST = "aoi_fist";
/** Aoi ult: a fist lands (x, y, r). */
export const HFX_AOI_IMPACT = "aoi_impact";
/** Aoi ult: ROCKET PUNCH (x, y = start, x2 = direction +1 / -1, r = lane half height, n = 1 return leg). */
export const HFX_AOI_ROCKET = "aoi_rocket";
/** Aoi: Jet Dash flame trail puff (x, y). */
export const HFX_AOI_JET = "aoi_jet";
/** Akane: a smack (x, y = centre, x2 = angle, r = reach scale, n = 1 MEGA, 2 drill spin, 3 360 heart fan). */
export const HFX_AKANE_SMACK = "akane_smack";
/** Akane: a BAKA! pop (x, y, r = scale, n = 1 "...baka" f1 pink). */
export const HFX_AKANE_BAKA = "akane_baka";
/** Akane: MEGA BAKA / final-smack shockwave ring (x, y, r). */
export const HFX_AKANE_RING = "akane_ring";
/** Akane ult: one barrage smack (x, y, x2 = rotation). */
export const HFX_AKANE_BARRAGE = "akane_barrage";
/** Akane ult: "...h-hmph." portrait slide. */
export const HFX_AKANE_HMPH = "akane_hmph";
/** Akane ult (Dere Mode): heart explosion (x, y, r). */
export const HFX_AKANE_HEART = "akane_heart";
/** Akane: a ricochet / human-missile collision (x, y). */
export const HFX_AKANE_BONK = "akane_bonk";
/** Generic hero text pop over a point (n = text id from HERO_TEXTS, r = scale). */
export const HFX_TEXT = "ha_text";

/** Text pops sent with HFX_TEXT (index = n). */
export const HERO_TEXTS = ["FULL BURST!", "COMBINED!", "MOE", "MOE", "KYUN♡", "KYUN KYUN♡", "...it's a large shadow.", "...h-hmph.", "WELCOME HOME!", "MARKED"] as const;

const ev: HeroFxEvent = { kind: "", x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0, enemy: null };

/** Emit a heroFx cue (no-op while muted; reused payload). */
export function hfx(w: World, kind: string, x: number, y: number, x2 = x, y2 = y, r = 0, n = 0, enemy: Enemy | null = null): void {
  if (w.muted) return;
  ev.kind = kind;
  ev.x = x;
  ev.y = y;
  ev.x2 = x2;
  ev.y2 = y2;
  ev.r = r;
  ev.n = n;
  ev.enemy = enemy;
  w.emit("heroFx", ev);
  ev.enemy = null;
}

/** Daze an enemy for `t` s (Enemy.stun; bosses and props never). */
export function daze(e: Enemy, t: number): void {
  if (e.dead || e.def.boss || e.def.prop) return;
  if (t > e.stun) e.stun = t;
}

/** Slow an enemy to `k` (0..1 speed) for `t` s, the shared convention (min slow, max time; bosses immune). */
export function slowEnemy(e: Enemy, k: number, t: number): void {
  if (e.dead || e.def.boss || e.def.prop) return;
  if (k < e.slow || e.slowT <= 0) e.slow = e.slowT > 0 ? Math.min(e.slow, k) : k;
  if (t > e.slowT) e.slowT = t;
}

/** A food pickup with its own sprite (collected on touch, heals `heal` x healMul, counts as food). */
export function dropSnack(w: World, sprite: string, x: number, y: number, heal: number, tint = 0xffffff): Pickup {
  const k = w.dropPickup("snack", x, y, heal);
  k.sprite = sprite;
  k.tint = tint;
  return k;
}

/** Is the enemy inside the current view (with a margin)? */
export function inView(w: World, e: Enemy, margin = 8): boolean {
  const p = w.player;
  return Math.abs(e.x - p.x) <= w.viewW * 0.5 + margin && Math.abs(e.y - e.cy - (p.y - CFG.playerCy)) <= w.viewH * 0.5 + margin;
}

/** Highest-HP live enemy in view (bosses first by HP), or null. */
export function strongestInView(w: World): Enemy | null {
  let best: Enemy | null = null;
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop || !inView(w, e, -4)) continue;
    if (!best || e.hp > best.hp) best = e;
  }
  return best;
}

/**
 * Damage every enemy along a capsule from (ox, oy) at angle `a`, length `len`,
 * half width `hw`, on channel `ch` with a per-enemy re-hit of `every` s.
 * Returns the number of enemies hit.
 */
export function segmentHits(
  w: World,
  ox: number,
  oy: number,
  a: number,
  len: number,
  hw: number,
  dmg: number,
  owner: WeaponInstance | null,
  ch: number,
  every: number,
  knock: number,
  source: string,
  color: number,
): number {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const buf = w.acquire();
  const n = w.grid.query(ox + ca * len * 0.5, oy + sa * len * 0.5, len * 0.5 + hw + 16, buf);
  const items = w.enemies.items;
  const now = w.t;
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead) continue;
    const ex = e.x - ox;
    const ey = e.y - e.cy - oy;
    const along = ex * ca + ey * sa;
    if (along < -e.r || along > len + e.r) continue;
    const side = -ex * sa + ey * ca;
    const lim = hw + e.r;
    if (side > lim || side < -lim) continue;
    if (every > 0) {
      if (now - e.lastHit[ch] < every) continue;
      e.lastHit[ch] = now;
    }
    w.hitEnemy(e, dmg, owner, a, knock, 0, source, color);
    hits++;
  }
  w.release();
  return hits;
}

// ---------------------------------------------------------------- per-world state
export interface Burn {
  e: Enemy;
  uid: number;
  /** Damage per second (already x might x burn talents). */
  dps: number;
  /** Seconds left. */
  t: number;
  /** Seconds to the next tick. */
  tick: number;
}

/** An enemy smacked into flight (Baka Harisen ricochet / Dere Dere human missile). */
export interface Flyer {
  e: Enemy;
  uid: number;
  /** Damage dealt to whatever it bonks. */
  dmg: number;
  /** Seconds of flight left. */
  t: number;
  /** Victims it may still bonk. */
  left: number;
  owner: WeaponInstance | null;
  source: string;
  /** uids already bonked (a missile never bonks the same enemy twice). */
  hit0: number;
  hit1: number;
  hit2: number;
}

export class HeroesAState {
  // ---- burns (Kuro)
  readonly burns: Burn[] = [];
  burnCount = 0;
  readonly burnByUid = new Map<number, Burn>();
  /** Weapon instance credited with burn damage (the current Dark Flame Dragon / Unsealed Abyss Dragon). */
  burnOwner: WeaponInstance | null = null;
  burnSource = "dark_flame_dragon";
  /** Wildfire spread radius (0 = off) and the Unsealed Abyss Dragon's death burst damage (0 = off). */
  wildfireR = 0;
  burstDmg = 0;
  private burstLeft = 0;
  private burstAt = -1;
  // ---- Abyssal Gaze mark
  markUid = 0;
  mark: Enemy | null = null;
  // ---- Akane flyers + pops
  readonly flyers: Flyer[] = [];
  flyerCount = 0;
  /** Sim time of the last BAKA! pop (weapon rule: 1.2 s) and of the last ult pop (1 / 0.25 s). */
  bakaAt = -1e9;
  bakaUltAt = -1e9;
  // ---- Aoi C6 support drone (position for the view)
  drone = false;
  droneX = 0;
  droneY = 0;
  /** Seconds since the drone last fired (muzzle flash). */
  droneShot = 9;
  /** Kill listeners added by content (called from the one kill hook). */
  readonly onKill: ((e: Enemy, x: number, y: number, source: string) => void)[] = [];

  constructor(private readonly w: World) {
    w.hooks.on("step", (h) => this.step(h.dt));
    w.hooks.on("kill", (k) => {
      this.killed(k.enemy, k.x, k.y);
      const ls = this.onKill;
      for (let i = 0; i < ls.length; i++) ls[i](k.enemy, k.x, k.y, k.source);
    });
  }

  // ------------------------------------------------------------ burns
  /** Is this enemy burning right now? */
  burning(e: Enemy): boolean {
    const b = this.burnByUid.get(e.uid);
    return !!b && b.e === e && b.t > 0 && !e.dead;
  }

  /** Set an enemy on fire (refreshes, keeps the higher dps, never stacks). */
  burn(e: Enemy, dps: number, seconds: number): void {
    if (e.dead || e.def.prop || dps <= 0 || seconds <= 0) return;
    let b = this.burnByUid.get(e.uid);
    if (b && b.e === e) {
      if (b.t <= 0) b.tick = 0.5;
      b.t = Math.max(b.t, seconds);
      b.dps = Math.max(b.dps, dps);
      return;
    }
    if (this.burnCount < this.burns.length) b = this.burns[this.burnCount];
    else {
      b = { e, uid: 0, dps: 0, t: 0, tick: 0 };
      this.burns.push(b);
    }
    this.burnCount++;
    b.e = e;
    b.uid = e.uid;
    b.dps = dps;
    b.t = seconds;
    b.tick = 0.5;
    this.burnByUid.set(e.uid, b);
  }

  private dropBurn(i: number): void {
    const b = this.burns[i];
    if (this.burnByUid.get(b.uid) === b) this.burnByUid.delete(b.uid);
    const last = this.burnCount - 1;
    this.burns[i] = this.burns[last];
    this.burns[last] = b;
    this.burnCount--;
  }

  // ------------------------------------------------------------ flyers
  /** Send an enemy flying: it bonks up to `victims` others for `dmg` within `seconds`. */
  fly(e: Enemy, dmg: number, seconds: number, victims: number, owner: WeaponInstance | null, source: string): void {
    if (e.dead || e.def.prop || e.def.boss || dmg <= 0) return;
    for (let i = 0; i < this.flyerCount; i++) {
      const f = this.flyers[i];
      if (f.e === e && f.uid === e.uid) {
        f.dmg = Math.max(f.dmg, dmg);
        f.t = Math.max(f.t, seconds);
        f.left = Math.max(f.left, victims);
        return;
      }
    }
    let f: Flyer;
    if (this.flyerCount < this.flyers.length) f = this.flyers[this.flyerCount];
    else {
      f = { e, uid: 0, dmg: 0, t: 0, left: 0, owner: null, source: "", hit0: 0, hit1: 0, hit2: 0 };
      this.flyers.push(f);
    }
    this.flyerCount++;
    f.e = e;
    f.uid = e.uid;
    f.dmg = dmg;
    f.t = seconds;
    f.left = victims;
    f.owner = owner;
    f.source = source;
    f.hit0 = f.hit1 = f.hit2 = 0;
  }

  private dropFlyer(i: number): void {
    const f = this.flyers[i];
    const last = this.flyerCount - 1;
    this.flyers[i] = this.flyers[last];
    this.flyers[last] = f;
    this.flyerCount--;
  }

  // ------------------------------------------------------------ per step
  private step(dt: number): void {
    const w = this.w;
    if (w.phase !== "play") return;
    // burns: tick every 0.5 s (iterating backwards: kills inside a tick may add new burns at the end)
    for (let i = this.burnCount - 1; i >= 0; i--) {
      if (i >= this.burnCount) continue;
      const b = this.burns[i];
      const e = b.e;
      if (e.dead || e.uid !== b.uid || b.t <= 0) {
        this.dropBurn(i);
        continue;
      }
      b.t -= dt;
      b.tick -= dt;
      if (b.tick <= 0) {
        b.tick += 0.5;
        w.hitEnemy(e, b.dps * 0.5, this.burnOwner, 0, 0, 0, this.burnSource, C.orange);
      }
    }
    // the mark falls off a dead / recycled enemy
    if (this.mark && (this.mark.dead || this.mark.uid !== this.markUid)) {
      this.mark = null;
      this.markUid = 0;
    }
    // flyers: an enemy smacked into flight bonks the first enemies it touches
    for (let i = this.flyerCount - 1; i >= 0; i--) {
      if (i >= this.flyerCount) continue;
      const f = this.flyers[i];
      const e = f.e;
      f.t -= dt;
      if (e.dead || e.uid !== f.uid || f.t <= 0 || f.left <= 0) {
        this.dropFlyer(i);
        continue;
      }
      // only while it still really flies
      if (e.kx * e.kx + e.ky * e.ky < 900) continue;
      const cy = e.y - e.cy;
      const buf = w.acquire();
      const n = w.grid.query(e.x, cy, e.r + 14, buf);
      for (let k = 0; k < n && f.left > 0; k++) {
        const o = w.enemies.items[buf[k]];
        if (!o || o === e || o.dead || o.def.prop || o.uid === f.hit0 || o.uid === f.hit1 || o.uid === f.hit2) continue;
        const dx = o.x - e.x;
        const dy = o.y - o.cy - cy;
        const rr = o.r + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (f.hit0 === 0) f.hit0 = o.uid;
        else if (f.hit1 === 0) f.hit1 = o.uid;
        else f.hit2 = o.uid;
        f.left--;
        const a = Math.atan2(e.ky, e.kx);
        hfx(w, HFX_AKANE_BONK, (o.x + e.x) * 0.5, (o.y - o.cy + cy) * 0.5);
        w.hitEnemy(o, f.dmg, f.owner, a, 120, 0, f.source, C.red);
      }
      w.release();
    }
  }

  // ------------------------------------------------------------ kills
  private killed(e: Enemy, x: number, y: number): void {
    if (this.burnCount === 0) return;
    const b = this.burnByUid.get(e.uid);
    if (!b || b.e !== e || b.t <= 0) return;
    const w = this.w;
    const cy = y - e.cy;
    // Wildfire: the fire jumps to the neighbours
    if (this.wildfireR > 0) {
      const R = this.wildfireR;
      const buf = w.acquire();
      const n = w.grid.query(x, cy, R + 16, buf);
      for (let k = 0; k < n; k++) {
        const o = w.enemies.items[buf[k]];
        if (!o || o === e || o.dead || o.def.prop) continue;
        const dx = o.x - x;
        const dy = o.y - o.cy - cy;
        const rr = R + o.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        this.burn(o, b.dps, Math.max(1, b.t));
      }
      w.release();
    }
    // Unsealed Abyss Dragon: burning enemies that die explode (budgeted: a burning crowd can't chain forever)
    if (this.burstDmg > 0) {
      if (w.t - this.burstAt >= 1) {
        this.burstAt = w.t;
        this.burstLeft = 24;
      }
      if (this.burstLeft > 0) {
        this.burstLeft--;
        hfx(w, HFX_KURO_BURST, x, cy, x, cy, 18);
        const buf = w.acquire();
        const n = w.grid.query(x, cy, 18 + 16, buf);
        for (let k = 0; k < n; k++) {
          const o = w.enemies.items[buf[k]];
          if (!o || o === e || o.dead) continue;
          const dx = o.x - x;
          const dy = o.y - o.cy - cy;
          const rr = 18 + o.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          w.hitEnemy(o, this.burstDmg, this.burnOwner, Math.atan2(dy, dx), 60, 0, this.burnSource, C.violet);
        }
        w.release();
      }
    }
    b.t = 0;
  }

  // ------------------------------------------------------------ BAKA! pops
  /**
   * A Baka Harisen smack hit something: maybe pop "BAKA!" (35 %, global 1.2 s cooldown; `always` for
   * MEGA BAKA). Returns true when it popped (RunStats.bakas counts each pop).
   */
  bakaPop(x: number, y: number, always: boolean, scale = 1, soft = false): boolean {
    const w = this.w;
    if (!always && (w.t - this.bakaAt < 1.2 || w.rng.next() >= 0.35)) return false;
    this.bakaAt = w.t;
    this.popped(x, y, scale, soft ? 1 : 0);
    return true;
  }

  /** The ult's pops: every smack wants one, at most one per 0.25 s. */
  bakaUltPop(x: number, y: number, scale = 1): boolean {
    const w = this.w;
    if (w.t - this.bakaUltAt < 0.25) return false;
    this.bakaUltAt = w.t;
    this.popped(x, y, scale, 0);
    return true;
  }

  private popped(x: number, y: number, scale: number, soft: number): void {
    const w = this.w;
    w.bumpStat("bakas", 1);
    hfx(w, HFX_AKANE_BAKA, x, y, x, y, scale, soft);
    // Akane C6: the shout itself hurts - every BAKA! pop stuns enemies within 40 px for 1 s
    if (w.hero.id === "akane" && w.cons >= 6) {
      const buf = w.acquire();
      const n = w.grid.query(x, y, 40 + 16, buf);
      for (let k = 0; k < n; k++) {
        const o = w.enemies.items[buf[k]];
        if (!o || o.dead) continue;
        const dx = o.x - x;
        const dy = o.y - o.cy - y;
        const rr = 40 + o.r;
        if (dx * dx + dy * dy <= rr * rr) daze(o, 1);
      }
      w.release();
    }
  }
}

const STATES = new WeakMap<World, HeroesAState>();

/** The per-world state (created, with its hooks, on first use). */
export function heroesA(w: World): HeroesAState {
  let s = STATES.get(w);
  if (!s) {
    s = new HeroesAState(w);
    STATES.set(w, s);
  }
  return s;
}

/** The state if any group-A content has used it in this world (the view reads burns / the mark). */
export function heroesAIf(w: World): HeroesAState | undefined {
  return STATES.get(w);
}

// ---------------------------------------------------------------- food talents
/** Base heal of a food pickup from the pickup hook (onigiri 20, cake 50, snacks their value). */
function foodHeal(kind: string, value: number): number {
  return kind === "onigiri" ? 20 : kind === "cake" ? 50 : kind === "snack" ? value : 0;
}

/**
 * "Food heals +X%" talents (Pudding's Regulars' Discount, Akane's Bento (Not For You)): every food
 * pickup heals `frac` of its base again (x healMul, folded into the same moment), and with
 * `ultChance` also adds `ult` Overdrive.
 */
export function foodBonus(w: World, frac: number, ultChance = 0, ult = 0): void {
  w.hooks.on("pickup", (p) => {
    const base = foodHeal(p.kind, p.value);
    if (base <= 0) return;
    if (frac > 0) w.heal(base * frac, true);
    if (ultChance > 0 && w.rng.next() < ultChance) w.addUlt(ult);
  });
}

/** Caramel-tinted petit four standing in for Pudding's pudding (food). */
export const PUDDING_TINT = 0xffe08a;

/** Drop a pudding (food, heals 8) at (x, y). */
export function dropPudding(w: World, x: number, y: number): void {
  dropSnack(w, "w_petit_four", x, y, 8, PUDDING_TINT);
}
