/**
 * Senpai's status effects (docs/content/weapons.md §2.5, §3 Shoujo Filter;
 * heroes.md §2.8 SENPAI NOTICED YOU, §3 Senpai talents). No `weapons` export:
 * the registry ignores this file.
 *
 *   Charmed      walks to the nearest non-charmed enemy within 120 px at 1.2x its speed and deals its
 *                own contact damage x2 (Shoujo Filter x3) every 0.5 s to the enemies it touches (credited
 *                to the charm's weapon); never hurts the hero (its contact damage is parked), still takes
 *                damage. Ends Heartbroken: slowed 30 % for 2 s (Lv5: explodes into hearts, r 16, 20 dmg).
 *   Swooned      (ult) stops moving (Enemy.stun), a beating heart, +50 % damage taken.
 *   Flustered    (ult, bosses) stunned 1.5 s, +25 % damage taken for 4 s.
 *
 * One record per affected enemy in a per-world book (pooled records, uid-checked: enemies are pooled).
 * Movement control: a charmed enemy runs in MODE_STRAIGHT (its behaviour is skipped, its velocity is set
 * here every step) and gets its mode / velocity / contact damage back when the charm ends. Everything runs
 * on `world.hooks` (never muted), so charm runs replay per seed.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import { MODE_STRAIGHT, type Enemy, type WeaponInstance } from "../types";
import type { World } from "../world";
import { HB, extraGem, hfx } from "./_hb";

/** One affected enemy. The view reads `charm`, `swoon`, `hb`, `vuln` (seconds left) and `e`. */
export interface CharmRec {
  e: Enemy;
  uid: number;
  /** Seconds left charmed (0 = not charmed). */
  charm: number;
  /** Seconds the charm lasted in total (heart pulse in the view). */
  charmLen: number;
  /** Counts toward the weapon's max admirers (chain / glance / kira charms do not). */
  counted: boolean;
  /** Love Triangle links left (a chained charm passes links - 1 on). */
  links: number;
  /** Seconds to the next contact attack. */
  atk: number;
  /** Contact attack multiplier (x2, Shoujo Filter x3). */
  mul: number;
  /** Heartbreak explodes (Lv5 twist). */
  boom: boolean;
  /** Seconds left of the heartbroken heart (view: the cracked heart falls). */
  hb: number;
  /** Seconds left swooned (ult). */
  swoon: number;
  /** Swoon ends in a rose-petal burst (Senpai Noticed Everyone). */
  burst: boolean;
  /** Burst damage (snapshot at swoon time). */
  burstDmg: number;
  /** Seconds left Flustered-vulnerable (+25 %, bosses). */
  vuln: number;
  /** Parked state while charmed. */
  held: boolean;
  dmg0: number;
  mode0: number;
  vx0: number;
  vy0: number;
}

interface Book {
  list: CharmRec[];
  map: Map<Enemy, CharmRec>;
  pool: CharmRec[];
  /** Counted charms alive. */
  counted: number;
  /** Boss uid -> run time of its last Kira distraction (once per 12 s per boss). */
  distracted: Map<number, number>;
  /** Shoujo Filter active: crits on charmed enemies get +critBonus multiplier. */
  critBonus: number;
  /** Charmed enemies drop double XP (Senpai C6). */
  doubleXp: boolean;
  /** Love Triangle (talent): chain charms on charmed kills. */
  triangle: boolean;
}

const books = new WeakMap<World, Book>();
/** The charmed attacker whose hit is landing (kill attribution for Love Triangle). */
let attacking: CharmRec | null = null;
/** Book whose acceptor is running (grid.nearest filter). */
let curBook: Book | null = null;
let curWorld: World | null = null;
let curSelf: Enemy | null = null;
const near: Enemy[] = [];

/** Live weapon credited with charm attacks (the evolution once Notice-Me Sparkles evolved). */
function charmOwner(w: World): WeaponInstance | null {
  return w.hasWeapon("shoujo_filter") ?? w.hasWeapon("notice_me_sparkles") ?? null;
}

/** grid.nearest acceptor: a live, non-prop enemy that is not charmed (and not the attacker itself). */
function acceptVictim(id: number): boolean {
  const w = curWorld as World;
  const e = w.enemies.items[id];
  if (!e || e.dead || e.def.prop || e === curSelf) return false;
  const r = (curBook as Book).map.get(e);
  return !r || r.uid !== e.uid || r.charm <= 0;
}

/** The per-world book (installed on first use: step + hit + kill hooks and the damage-taken rule). */
export function charmBook(w: World): Book {
  let b = books.get(w);
  if (b) return b;
  const book: Book = { list: [], map: new Map(), pool: [], counted: 0, distracted: new Map(), critBonus: 0, doubleXp: false, triangle: false };
  b = book;
  books.set(w, book);
  w.hooks.on("step", (h) => update(w, book, h.dt));
  // Swooned +50 %, Flustered +25 %, Shoujo Filter crit bonus on charmed enemies
  w.dmgTaken.push((e, _source, crit) => {
    const r = book.map.get(e);
    if (!r || r.uid !== e.uid) return 1;
    let k = 1;
    if (r.swoon > 0) k *= 1.5;
    if (r.vuln > 0) k *= 1.25;
    if (crit && r.charm > 0 && book.critBonus > 0) k *= 1 + book.critBonus / Math.max(1, w.stats.critMult);
    return k;
  });
  w.hooks.on("kill", (k) => {
    const r = book.map.get(k.enemy);
    // Senpai C6: charmed enemies drop double XP
    if (book.doubleXp && r && r.uid === k.enemy.uid && r.charm > 0 && !k.boss) extraGem(w, k.enemy, k.x, k.y);
    // Love Triangle: a charmed enemy's kill charms the nearest non-charmed enemy within 48 px (3 links)
    const a = attacking;
    if (book.triangle && a && a.links > 0 && !k.boss) {
      curBook = book;
      curWorld = w;
      curSelf = null;
      const id = w.grid.nearest(k.x, k.y - 6, 48, acceptVictim);
      curBook = null;
      if (id >= 0) {
        const v = w.enemies.items[id];
        if (charm(w, v, a.charmLen, { counted: false, links: a.links - 1, mul: a.mul, boom: a.boom })) hfx(w, HB.CHARM, v.x, v.y - v.cy * 2, v.x, v.y, 0, 1, v);
      }
    }
  });
  return book;
}

/** Records alive (the view draws hearts / tints from them; read-only). */
export function charmRecs(w: World): readonly CharmRec[] {
  return books.get(w)?.list ?? EMPTY;
}
const EMPTY: readonly CharmRec[] = [];

/** Counted charms alive (for the weapon's max). */
export function charmedCount(w: World): number {
  return books.get(w)?.counted ?? 0;
}

/** The live record of `e` (or null). */
export function recOf(w: World, e: Enemy): CharmRec | null {
  const r = books.get(w)?.map.get(e);
  return r && r.uid === e.uid ? r : null;
}

export function isCharmed(w: World, e: Enemy): boolean {
  const r = recOf(w, e);
  return !!r && r.charm > 0;
}

/** Set book-wide rules (Shoujo Filter crit bonus, Senpai C6, Love Triangle). */
export function charmRules(w: World, o: { critBonus?: number; doubleXp?: boolean; triangle?: boolean }): void {
  const b = charmBook(w);
  if (o.critBonus !== undefined) b.critBonus = Math.max(b.critBonus, o.critBonus);
  if (o.doubleXp) b.doubleXp = true;
  if (o.triangle) b.triangle = true;
}

function rec(b: Book, e: Enemy): CharmRec {
  const old = b.map.get(e);
  if (old && old.uid === e.uid) return old;
  if (old) release(b, old, false);
  const r =
    b.pool.pop() ??
    ({ e, uid: 0, charm: 0, charmLen: 0, counted: false, links: 0, atk: 0, mul: 2, boom: false, hb: 0, swoon: 0, burst: false, burstDmg: 0, vuln: 0, held: false, dmg0: 0, mode0: 0, vx0: 0, vy0: 0 } as CharmRec);
  r.e = e;
  r.uid = e.uid;
  r.charm = r.charmLen = r.hb = r.swoon = r.vuln = r.atk = r.burstDmg = 0;
  r.counted = r.boom = r.burst = r.held = false;
  r.links = 0;
  r.mul = 2;
  b.list.push(r);
  b.map.set(e, r);
  return r;
}

/** Drop a record (restore the enemy only while it is still the same live enemy). */
function release(b: Book, r: CharmRec, restore: boolean): void {
  if (restore && r.held && !r.e.dead && r.e.uid === r.uid) unpark(r);
  if (r.counted && r.charm > 0) b.counted--;
  r.counted = false;
  r.held = false;
  r.charm = 0;
  if (b.map.get(r.e) === r) b.map.delete(r.e);
  const i = b.list.indexOf(r);
  if (i >= 0) {
    b.list[i] = b.list[b.list.length - 1];
    b.list.pop();
  }
  b.pool.push(r);
}

function park(r: CharmRec): void {
  const e = r.e;
  if (r.held) return;
  r.held = true;
  r.dmg0 = e.dmg;
  r.mode0 = e.mode;
  r.vx0 = e.vx;
  r.vy0 = e.vy;
  e.dmg = 0;
  e.mode = MODE_STRAIGHT;
  e.vx = e.vy = 0;
}

function unpark(r: CharmRec): void {
  const e = r.e;
  r.held = false;
  e.dmg = r.dmg0;
  e.mode = r.mode0;
  if (r.mode0 === MODE_STRAIGHT) {
    e.vx = r.vx0;
    e.vy = r.vy0;
  } else e.vx = e.vy = 0;
}

export interface CharmOpts {
  /** Counts toward the weapon's max (default true). */
  counted?: boolean;
  /** Love Triangle links (default 0). */
  links?: number;
  /** Contact attack multiplier (default 2). */
  mul?: number;
  /** Heartbreak explodes (Lv5). */
  boom?: boolean;
  /** Max counted charms (default unlimited). */
  max?: number;
}

/**
 * Charm `e` for `seconds`. Bosses are immune; an already charmed enemy keeps the
 * longer of the two charms. Returns true when a new charm started (counts
 * RunStats.charmed).
 */
export function charm(w: World, e: Enemy, seconds: number, o: CharmOpts = {}): boolean {
  if (e.dead || e.def.prop || e.def.boss || seconds <= 0) return false;
  const b = charmBook(w);
  const old = b.map.get(e);
  if (old && old.uid === e.uid && old.charm > 0) {
    if (seconds > old.charm) {
      old.charm = seconds;
      old.charmLen = Math.max(old.charmLen, seconds);
    }
    return false;
  }
  const counted = o.counted ?? true;
  if (counted && o.max !== undefined && b.counted >= o.max) return false;
  const r = rec(b, e);
  r.charm = r.charmLen = seconds;
  r.counted = counted;
  if (counted) b.counted++;
  r.links = o.links ?? 0;
  r.mul = o.mul ?? 2;
  r.boom = !!o.boom;
  r.atk = 0.2;
  r.hb = 0;
  park(r);
  w.bumpStat("charmed");
  return true;
}

/** Swoon a non-boss enemy for `seconds` (ult): stops moving, +50 % damage taken; `burstDmg` > 0 = rose burst at the end. */
export function swoon(w: World, e: Enemy, seconds: number, burstDmg = 0): void {
  if (e.dead || e.def.prop || e.def.boss) return;
  const b = charmBook(w);
  const r = rec(b, e);
  const fresh = r.swoon <= 0;
  r.swoon = Math.max(r.swoon, seconds);
  r.burst = burstDmg > 0;
  r.burstDmg = burstDmg;
  e.stun = Math.max(e.stun, seconds);
  if (fresh) w.bumpStat("charmed");
}

/** Fluster a boss (ult): stunned `stun` s, +25 % damage taken for `vuln` s. */
export function fluster(w: World, e: Enemy, stun: number, vuln: number): void {
  if (e.dead || !e.def.boss) return;
  const r = rec(charmBook(w), e);
  r.vuln = Math.max(r.vuln, vuln);
  e.stun = Math.max(e.stun, stun);
}

/** Shoujo Filter KIRA KIRA MOMENT on a boss: its pattern pauses 1.0 s, at most once per 12 s per boss. */
export function distract(w: World, e: Enemy): boolean {
  const b = charmBook(w);
  const last = b.distracted.get(e.uid);
  if (last !== undefined && w.t - last < 12) return false;
  b.distracted.set(e.uid, w.t);
  e.stun = Math.max(e.stun, 1);
  return true;
}

function update(w: World, b: Book, dt: number): void {
  if (w.phase !== "play") return;
  const list = b.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    const e = r.e;
    if (e.dead || e.uid !== r.uid) {
      release(b, r, false);
      continue;
    }
    if (r.charm > 0) {
      r.charm -= dt;
      if (r.charm <= 0) endCharm(w, b, r);
      else drive(w, b, r, dt);
    }
    if (r.hb > 0) r.hb = Math.max(0, r.hb - dt);
    if (r.vuln > 0) r.vuln = Math.max(0, r.vuln - dt);
    if (r.swoon > 0) {
      r.swoon -= dt;
      if (r.swoon <= 0) {
        r.swoon = 0;
        if (r.burst) {
          r.burst = false;
          const y = e.y - e.cy;
          w.explode(e.x, y, 24, r.burstDmg, null, 80, "senpai_noticed_everyone", C.pink);
          hfx(w, HB.ROSE_BURST, e.x, y, e.x, y, 24);
          if (e.dead || e.uid !== r.uid) {
            if (list[i] === r) release(b, r, false);
            continue;
          }
        }
      }
    }
    if (r.charm <= 0 && r.hb <= 0 && r.swoon <= 0 && r.vuln <= 0 && list[i] === r) release(b, r, true);
  }
}

/** Charmed movement + contact attacks. */
function drive(w: World, b: Book, r: CharmRec, dt: number): void {
  const e = r.e;
  const ey = e.y - e.cy;
  curBook = b;
  curWorld = w;
  curSelf = e;
  const id = w.grid.nearest(e.x, ey, 120, acceptVictim);
  curBook = null;
  curSelf = null;
  if (id >= 0) {
    const t = w.enemies.items[id];
    const dx = t.x - e.x;
    const dy = t.y - t.cy - ey;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const sp = e.speed * 1.2;
    // (park() keeps the enemy in MODE_STRAIGHT: the world integrates this velocity next step)
    e.vx = (dx / d) * sp;
    e.vy = (dy / d) * sp;
  } else {
    e.vx *= 0.8;
    e.vy *= 0.8;
  }
  r.atk -= dt;
  if (r.atk > 0) return;
  // contact attack: everything non-charmed it touches
  const n = w.nearestEnemies(e.x, ey, e.r + 16, 6, near);
  let hits = 0;
  if (n > 0) {
    const owner = charmOwner(w);
    const dmg = Math.max(1, r.dmg0) * r.mul * w.stats.might * (owner?.dmgMul ?? 1);
    const src = owner ? owner.def.id : "notice_me_sparkles";
    for (let k = 0; k < n && !e.dead; k++) {
      const o = near[k];
      if (o === e || o.dead) continue;
      const orr = b.map.get(o);
      if (orr && orr.uid === o.uid && orr.charm > 0) continue;
      const dx = o.x - e.x;
      const dy = o.y - o.cy - ey;
      const rr = e.r + o.r + 2;
      if (dx * dx + dy * dy > rr * rr) continue;
      attacking = r;
      w.hitEnemy(o, dmg, owner, Math.atan2(dy, dx), 50, 0, src, C.pink);
      attacking = null;
      hits++;
    }
  }
  r.atk = hits > 0 ? 0.5 : 0.08;
}

function endCharm(w: World, b: Book, r: CharmRec): void {
  r.charm = 0;
  if (r.counted) {
    b.counted--;
    r.counted = false;
  }
  if (r.held) unpark(r);
  const e = r.e;
  // heartbroken: slowed 30 % for 2 s (the cracked heart falls in the view)
  e.slow = Math.min(e.slow, 0.7);
  e.slowT = Math.max(e.slowT, 2);
  r.hb = 0.6;
  const y = e.y - e.cy;
  if (r.boom) {
    const owner = charmOwner(w);
    hfx(w, HB.HEARTBREAK, e.x, y, e.x, y, 16, 1, e);
    w.explode(e.x, y, 16, 20 * w.stats.might * (owner?.dmgMul ?? 1), owner, 60, owner ? owner.def.id : "notice_me_sparkles", C.pink);
  } else hfx(w, HB.HEARTBREAK, e.x, y, e.x, y, 0, 0, e);
}

/** Senpai's trait: enemies within `r` px of the hero move `slow` x (they're staring). Installed once. */
export function installStaring(w: World, r: number, slow: number): void {
  const buf: number[] = [];
  w.hooks.on("step", () => {
    if (w.phase !== "play") return;
    const p = w.player;
    const cy = p.y - CFG.playerCy;
    const n = w.grid.query(p.x, cy, r, buf);
    const items = w.enemies.items;
    for (let k = 0; k < n; k++) {
      const e = items[buf[k]];
      if (!e || e.dead || e.def.prop || e.def.boss) continue;
      const dx = e.x - p.x;
      const dy = e.y - e.cy - cy;
      if (dx * dx + dy * dy > r * r) continue;
      if (slow < e.slow) e.slow = slow;
      if (e.slowT < 0.1) e.slowT = 0.1;
    }
  });
}
