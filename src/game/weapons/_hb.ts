/**
 * Shared sim helpers for the "heroes B" group (Senpai, Magical Girl #47,
 * Isekai-kun, Truck-kun: docs/content/heroes.md §2.8-2.11, weapons.md §2.5-2.8).
 * No `weapons` export, so the registry ignores this file.
 *
 *   hfx(w, HB.HONK, x, y, dx, dy, len)     view cue (heroFx event, reused payload, muted-safe)
 *   densest(w, out)                        the densest 48 px cell of enemies in view (a boss counts 10)
 *   installIsekai(w)                       Truck-kun's "isekai'd" kills (light pillar, extra gem, RunStats.isekaid)
 *
 * Content modules import values from here, never from world.ts (ARCHITECTURE.md import rule).
 */
import { gemXpScale } from "../config";
import type { HeroFxEvent } from "../events";
import type { Stats } from "../stats";
import type { Enemy, ProjHook } from "../types";
import type { World } from "../world";

/** heroFx kinds owned by this hero group (src/view/heroes-b-fx.ts draws them; other groups ignore them). */
export const HB = {
  // ---- Senpai
  /** An enemy got charmed (x, y = its head; n = 1 for a chain / glance / kira charm). */
  CHARM: "hb_charm",
  /** A charm ended: the enemy is heartbroken (n = 1 when its heart explodes, r = blast radius). */
  HEARTBREAK: "hb_heartbreak",
  /** Shoujo Filter KIRA KIRA MOMENT at the hero (r = aura radius). */
  KIRA: "hb_kira",
  /** Meaningful Glance from the hero (x, y) to the target (x2, y2); n = 1 on a boss. */
  GLANCE: "hb_glance",
  /** SENPAI NOTICED YOU starts (the shoujo frame; r = swoon seconds). */
  NOTICED: "hb_noticed",
  /** Sparkle wave of the ult (n = wave index). */
  SPARKLE_WAVE: "hb_sparkle_wave",
  /** A boss got Flustered (x, y = its head). */
  FLUSTER: "hb_fluster",
  /** A swooned enemy burst into rose petals (Senpai Noticed Everyone; r = radius). */
  ROSE_BURST: "hb_rose_burst",
  /** Valentine's Day: chocolates rain around the hero. */
  VALENTINE: "hb_valentine",
  // ---- Magical Girl #47
  /** A henshin starts on the hero (r = henshin seconds, n: 1 = panic, 2 = level-up, 3 = evolution). */
  HENSHIN: "hb_henshin",
  /** PANIC HENSHIN! (the hit was negated). */
  PANIC: "hb_panic",
  /** Henshin burst (r = radius, n: bit 1 = mirrored echo, bit 2 = evolution, bit 4 = cleared bullets). */
  BURST: "hb_burst",
  /** "That's the 47th transformation this episode." */
  NARRATE_47: "hb_narrate47",
  /** Ult transformation stage (n = stage 0..4, r = burst radius, 0 = whole view). */
  STAGE: "hb_stage",
  /** Ult started (r = ult seconds, n = 1 for the "Finally Has a Name!" cut). */
  TRANSFORM: "hb_transform",
  /** "Who Are You Again?" granted a shield charge. */
  FORGOTTEN: "hb_forgotten",
  // ---- Isekai-kun
  /** Isekai-kun casts (one finger raised; n = 1 when this cast is overdone). */
  CAST: "hb_cast",
  /** An overdone fireball / meteor detonated (r = blast radius, n = 1 for the meteor). */
  OVERDO: "hb_overdo",
  /** Status Screen band telegraph (x, y = band centre, x2 = half width, y2 = half height, r = seconds). */
  SLAM_TELL: "hb_slam_tell",
  /** Status Screen window slams the band (same geometry; n = 1 for the expanded 99999999999 numbers). */
  SLAM: "hb_slam",
  /** "...did I overdo it again?" over the hero. */
  AGAIN: "hb_again",
  /** Guild Support arrow from (x, y) onto (x2, y2). */
  ARROW: "hb_arrow",
  // ---- Truck-kun
  /** HONK cone from (x, y) along (x2, y2) (unit), r = length, n = half-angle in degrees (0 = 360° ring). */
  HONK: "hb_honk",
  /** A ram connected at (x, y) (n = enemies hit). */
  RAM: "hb_ram",
  /** This enemy is about to die isekai'd (sent before its enemyKilled: the view skips the confetti). */
  ISEKAI_MARK: "hb_isekai_mark",
  /** Isekai'd: a light pillar at (x, y). */
  ISEKAI: "hb_isekai",
  /** A phantom truck lane is telegraphed from (x, y) to (x2, y2) (r = seconds until it drives). */
  LANE_TELL: "hb_lane_tell",
  /** A phantom truck enters the lane (x, y) -> (x2, y2) (n = 1 for the express lane). */
  LANE: "hb_lane",
  /** ISEKAI EXPRESS starts (the honk + flash). */
  EXPRESS: "hb_express",
} as const;

const ev: HeroFxEvent = { kind: "", x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0, enemy: null };

/** Emit a heroes-B view cue (no-op while muted). The payload is reused: listeners copy what they need. */
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

// ---------------------------------------------------------------- densest cluster
const CELL = 48;
const MAX_CELLS = 24;
const counts = new Float64Array(MAX_CELLS * MAX_CELLS);
const sumX = new Float64Array(MAX_CELLS * MAX_CELLS);
const sumY = new Float64Array(MAX_CELLS * MAX_CELLS);

/**
 * Centre of the densest 48 px cell of enemies in view (bosses count 10), the
 * average position of the enemies in it. Returns the weight found (0 = no
 * enemy in view: `out` is then the hero's position). No allocation.
 */
export function densest(w: World, out: { x: number; y: number }, margin = -6): number {
  const p = w.player;
  const hw = w.viewW * 0.5 + margin;
  const hh = w.viewH * 0.5 + margin;
  const x0 = p.x - hw;
  const y0 = p.y - 8 - hh;
  const nx = Math.min(MAX_CELLS, Math.max(1, Math.ceil((hw * 2) / CELL)));
  const ny = Math.min(MAX_CELLS, Math.max(1, Math.ceil((hh * 2) / CELL)));
  const n = nx * ny;
  counts.fill(0, 0, n);
  sumX.fill(0, 0, n);
  sumY.fill(0, 0, n);
  const items = w.enemies.items;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = items[i];
    if (e.dead || e.def.prop) continue;
    const ex = e.x;
    const ey = e.y - e.cy;
    if (ex < x0 || ey < y0 || ex >= x0 + hw * 2 || ey >= y0 + hh * 2) continue;
    const cx = Math.min(nx - 1, Math.floor((ex - x0) / CELL));
    const cy = Math.min(ny - 1, Math.floor((ey - y0) / CELL));
    const k = cy * nx + cx;
    const wt = e.def.boss ? 10 : 1;
    counts[k] += wt;
    sumX[k] += ex * wt;
    sumY[k] += ey * wt;
  }
  let best = -1;
  let bw = 0;
  for (let k = 0; k < n; k++)
    if (counts[k] > bw) {
      bw = counts[k];
      best = k;
    }
  if (best < 0) {
    out.x = p.x;
    out.y = p.y - 8;
    return 0;
  }
  out.x = sumX[best] / bw;
  out.y = sumY[best] / bw;
  return bw;
}

/** Is `e` (body centre) inside the view rect around the hero? */
export function inView(w: World, e: Enemy, margin = 0): boolean {
  const p = w.player;
  return Math.abs(e.x - p.x) <= w.viewW * 0.5 + margin && Math.abs(e.y - e.cy - (p.y - 8)) <= w.viewH * 0.5 + margin;
}

/** Drop one extra XP gem worth this enemy's own gem (later minutes are worth more, like the regular drop). */
export function extraGem(w: World, e: Enemy, x: number, y: number): void {
  const xp = e.def.xp;
  if (xp > 0) w.dropGem(x, y, xp * gemXpScale(w.t));
}

// ---------------------------------------------------------------- sprite-less actors the view draws
/**
 * Update hook that tags a phantom / ghost truck projectile (Isekai Rush Hour, ISEKAI EXPRESS): it has
 * no sprite (the generic drawer skips it) and src/view/heroes-b-fx.ts draws `truck_kun_run` centred on
 * its lane (p.scale, p.tint, p.alpha, p.flipX, velocity = direction).
 */
export const GHOST_TRUCK: ProjHook = () => {};
/** Tags a burning crater (Cheat Fireball / Meteor Lv.99999): a ground decal the view draws (p.r, age / life). */
export const CRATER: ProjHook = () => {};

// ---------------------------------------------------------------- isekai'd (Truck-kun)
/** Damage sources whose kills are "isekai'd", with their extra-gem chance (weapons.md §2.8, §3; heroes.md §2.11). */
const ISEKAI_CHANCE: Record<string, number> = {
  horn_of_reincarnation: 0.25,
  isekai_rush_hour: 0.4,
  isekai_express: 1,
};

interface IsekaiState {
  /** Next-Life Guarantee bonus chance (talent). */
  bonus: number;
  /** Isekai'd by the ult since it started (Unlimited Mileage pays +1 Overdrive each at its end). */
  byUlt: number;
}
const isekaiStates = new WeakMap<World, IsekaiState>();

/** Is a kill from `source` isekai'd? */
export function isekaiSource(source: string): boolean {
  return source in ISEKAI_CHANCE;
}

/**
 * Install the isekai'd rules once per world (the horn, its evolution and the
 * ult call this): non-boss enemies killed by them vanish in a light pillar
 * instead of confetti (the view gets ISEKAI_MARK before the kill), count
 * RunStats.isekaid and may drop an extra gem. `bonus` adds to the extra-gem
 * chance (Next-Life Guarantee).
 */
export function installIsekai(w: World, bonus = 0): IsekaiState {
  let st = isekaiStates.get(w);
  if (st) {
    st.bonus = Math.max(st.bonus, bonus);
    return st;
  }
  const s: IsekaiState = { bonus, byUlt: 0 };
  st = s;
  isekaiStates.set(w, s);
  w.hooks.on("hit", (h) => {
    const e = h.enemy;
    if (e.hp > 0 || e.def.boss || e.def.prop || !(h.source in ISEKAI_CHANCE)) return;
    hfx(w, HB.ISEKAI_MARK, e.x, e.y, e.x, e.y, 0, e.uid, e);
  });
  w.hooks.on("kill", (k) => {
    const chance = ISEKAI_CHANCE[k.source];
    if (chance === undefined || k.boss) return;
    w.bumpStat("isekaid");
    if (k.source === "isekai_express") s.byUlt++;
    let c = chance + s.bonus;
    while (c > 0) {
      if (c >= 1 || w.rng.next() < c) extraGem(w, k.enemy, k.x, k.y);
      c -= 1;
    }
    hfx(w, HB.ISEKAI, k.x, k.y, k.x, k.y, 0, 0, null);
  });
  return s;
}

// ---------------------------------------------------------------- Magical Girl #47's "every stat"
/**
 * "+k to EVERYTHING" (heroes.md §1.1, Perfectly Average): might, area, move speed, projectile speed,
 * duration, pickup, luck, growth, greed += k; cooldown -= k; max HP += 100 k (5 HP for +5 %).
 */
export function everyStat(s: Stats, k: number): void {
  s.might += k;
  s.area += k;
  s.moveSpeed += k;
  s.projSpeed += k;
  s.duration += k;
  s.pickup += k;
  s.luck += k;
  s.growth += k;
  s.greed += k;
  s.cooldown -= k;
  s.maxHp += 100 * k;
}
