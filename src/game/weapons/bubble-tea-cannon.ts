/**
 * Bubble Tea Cannon (general weapon, docs/content/weapons.md §2.9): every `cd`
 * s, `amount` chewy boba pearls fly at the nearest enemies. On a hit a pearl
 * bounces to the nearest enemy within 80 px it has not hit yet (none: it
 * reflects back off its own path at a random ±60° and keeps flying); after
 * `bounce` bounces it pops with a tiny splash.
 * Twist - Sticky: every hit slows the enemy 20% for 1 s (x Duration).
 * Lv5: pearls split into 2 mini pearls on their last bounce (50% damage,
 * 2 bounces, 0.7 scale).
 * Evolution: Tapioca Tsunami (+ Big Ribbon) - giant pearls bounce 8 times and
 * shed 3 regular pearls on every bounce.
 * Second evolution: Brown Sugar Railgun (+ Power Bow) - ONE pearl in a straight line across the screen:
 *   it pierces everything (each enemy pierced costs it `falloff` of its damage, down to `floor`) and leaves
 *   a syrup streak on the ground (`syrup` s: a slow and `syrupDps`). Lanes instead of pinball.
 *
 * Pearls are PK_FREE projectiles with a light homing toward their current
 * target (the world re-targets a lost one) and pierce Infinity: the onHit hook
 * counts the bounces and ends them. Scratch: a = kind (K_*), b = bounces done,
 * angV = bounces allowed, ang = 1 to split on the last bounce.
 * Visuals: generic sprites (w_boba / w_boba_big) + the "boba" trails and the
 * pop / split / shed cues in src/view/arsenal2-fx.ts.
 */
import { TAU } from "../../core/math";
import { PK_FREE, PK_MANAGED, ROT_SPIN, ROT_VELOCITY, type Enemy, type ProjHitHook, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, killOwned, own, prune, wstats } from "./_shared";
import { heroFx } from "./_fx";
import { A2_BOBA_POP, A2_BOBA_SHED, A2_BOBA_SPLIT, a2fx, keyDmg } from "./_arsenal2";
import { slowEnemy } from "./_heroes-a";

/** Tan (the milk tea). */
export const BOBA_COLOR = 0xdda574;
const K_PEARL = 0;
const K_MINI = 1;
const K_GIANT = 2;
/** A regular pearl shed by a giant one (counted against SHED_CAP). */
const K_SHED = 3;
/** Bounce search radius (px). */
const BOUNCE_R = 80;
/** Live shed pearls per Tapioca Tsunami (a giant volley in a dense crowd stays bounded). */
const SHED_CAP = 96;
/** Draw scale of a regular pearl. */
const PEARL_DRAW = 1.25;
/** Sticky slow: speed x0.8 for 1 s (x Duration). */
const STICKY = 0.8;

const targets: Enemy[] = [];

function spawnPearl(w: World, inst: WeaponInstance, kind: number, x: number, y: number, a: number, speed: number, dmg: number, bounces: number, split: number, knock: number, area: number): Projectile {
  const p = w.spawnProjectile(inst);
  p.kind = PK_FREE;
  p.x = x;
  p.y = y;
  p.vx = Math.cos(a) * speed;
  p.vy = Math.sin(a) * speed;
  p.speed = speed;
  p.a = kind;
  p.b = 0;
  p.angV = bounces;
  p.ang = split;
  const giant = kind === K_GIANT;
  p.r = (giant ? 7 : kind === K_MINI ? 3 : 4) * area;
  p.dmg = dmg;
  p.knock = knock;
  p.pierce = Infinity;
  p.hitEvery = 0;
  p.homing = giant ? 2.6 : 3.4;
  p.life = giant ? 3.4 : kind === K_PEARL ? 2.4 : 1.6;
  p.sprite = giant ? "w_boba_big" : "w_boba";
  p.fps = 5;
  // area grows the hit circle fully, the sprite a bit less (big builds stay readable)
  // (drawn a touch larger than 1:1 so a dark pearl reads on any ground; minis are 0.7 of a pearl)
  p.scale = (kind === K_MINI ? 0.7 * PEARL_DRAW : giant ? 1.1 : PEARL_DRAW) * Math.min(area, 1 + (area - 1) * 0.6);
  p.rotMode = ROT_SPIN;
  p.spin = (w.rng.next() < 0.5 ? -1 : 1) * (giant ? 5 : 9);
  p.shadow = giant ? 9 : 5;
  p.trail = giant ? "boba_big" : "boba";
  p.onHit = pearlHit;
  p.onEnd = pearlEnd;
  if (kind === K_SHED) inst.data.shedLive = (inst.data.shedLive ?? 0) + 1;
  return p;
}

/** Give a child pearl the parent's last victim so it does not instantly re-hit the enemy it came from. */
function inherit(p: Projectile, uid: number): void {
  p.hits[0] = uid;
  p.nHits = 1;
}

/** Up to `n` child pearls from (x, y) toward the nearest enemies that `from` has not hit (else a fan). */
function children(w: World, inst: WeaponInstance, from: Projectile, e: Enemy, kind: number, n: number, dmg: number, bounces: number, speed: number, knock: number, area: number): void {
  const m = w.nearestEnemies(from.x, from.y, BOUNCE_R + 10, n + 2, targets);
  const a0 = w.rng.angle();
  let k = 0;
  for (let i = 0; i < m && k < n; i++) {
    const t = targets[i];
    if (t === e) continue;
    const c = spawnPearl(w, inst, kind, from.x, from.y, Math.atan2(t.y - t.cy - from.y, t.x - from.x), speed, dmg, bounces, 0, knock, area);
    c.target = t;
    c.targetUid = t.uid;
    inherit(c, e.uid);
    k++;
  }
  for (; k < n; k++) inherit(spawnPearl(w, inst, kind, from.x, from.y, a0 + (k / n) * TAU, speed, dmg, bounces, 0, knock, area), e.uid);
}

/** Pop (end) a pearl; a Lv5 pearl splits into two minis first. */
function pop(w: World, p: Projectile, e: Enemy): void {
  const inst = p.owner;
  if (p.ang === 1 && inst) {
    children(w, inst, p, e, K_MINI, 2, p.dmg * 0.5, 2, p.speed, p.knock * 0.6, p.r / 4);
    a2fx(w, A2_BOBA_SPLIT, p.x, p.y);
  }
  a2fx(w, A2_BOBA_POP, p.x, p.y, p.x, p.y, p.scale, p.a === K_GIANT ? 2 : p.a === K_MINI ? 1 : 0);
  w.endProjectile(p);
}

/** Tapioca Tsunami: every bounce of a giant pearl sheds `shed` regular pearls. */
function shed(w: World, inst: WeaponInstance, p: Projectile, e: Enemy): void {
  const S = wstats(w, inst);
  const L = S.L;
  const room = SHED_CAP - (inst.data.shedLive ?? 0);
  const n = Math.min(room, L.shed ?? 3);
  if (n <= 0) return;
  children(w, inst, p, e, K_SHED, n, keyDmg(S, L.shedDmg ?? 14), L.shedBounce ?? 2, S.speed * 1.05, (L.knock ?? 30) * 0.5, S.area);
  a2fx(w, A2_BOBA_SHED, p.x, p.y, p.x, p.y, 0, n);
}

const pearlHit: ProjHitHook = (p, w, e) => {
  // Sticky: every hit slows (bosses and props are immune, the shared convention)
  if (!e.dead) slowEnemy(e, STICKY, w.stats.duration);
  p.b++;
  const inst = p.owner;
  if (p.a === K_GIANT && inst) shed(w, inst, p, e);
  if (p.b > p.angV) {
    pop(w, p, e);
    return;
  }
  // bounce: the nearest enemy within 80 px it has not hit yet, else back off its own path (±60°)
  const t = w.homingTarget(p, BOUNCE_R);
  let a: number;
  if (t) {
    a = Math.atan2(t.y - t.cy - p.y, t.x - p.x);
    p.target = t;
    p.targetUid = t.uid;
  } else {
    a = Math.atan2(p.vy, p.vx) + Math.PI + (w.rng.next() * 2 - 1) * (Math.PI / 3);
    p.target = null;
    p.targetUid = 0;
  }
  p.vx = Math.cos(a) * p.speed;
  p.vy = Math.sin(a) * p.speed;
  // (a beat before the next hit or homing so the bounce reads; it keeps flying a while longer)
  p.delay = p.age + 0.04;
  p.life = Math.max(p.life, p.age + 1.2);
};

const pearlEnd: ProjHook = (p) => {
  const inst = p.owner;
  if (p.a === K_SHED && inst) inst.data.shedLive = Math.max(0, (inst.data.shedLive ?? 1) - 1);
};

/** One volley: `n` pearls at the nearest enemies (repeats fan out). Returns false with no target in range. */
function volley(w: World, inst: WeaponInstance, kind: number, n: number, dmg: number, speed: number, bounces: number, split: number, knock: number, area: number): boolean {
  const pl = w.player;
  const sx = pl.x + pl.face * 4;
  const sy = pl.y - 10;
  const m = w.nearestEnemies(sx, sy, 190, n, targets);
  if (m === 0) return false;
  for (let i = 0; i < n; i++) {
    const t = targets[i % m];
    let a = Math.atan2(t.y - t.cy - sy, t.x - sx);
    if (i >= m) a += (i & 1 ? 1 : -1) * 0.3 * Math.ceil((i - m + 1) / 2);
    const p = spawnPearl(w, inst, kind, sx, sy, a, speed * (1 + 0.04 * (i % 3)), dmg, bounces, split, knock, area);
    p.target = t;
    p.targetUid = t.uid;
  }
  fired(w, inst, sx, sy);
  return true;
}

export const bubbleTeaCannon: WeaponDef = {
  id: "bubble_tea_cannon",
  name: "Bubble Tea Cannon",
  icon: "icon_bubble_tea_cannon",
  color: BOBA_COLOR,
  sfx: "boba",
  desc: "Fires chewy boba pearls that bounce from enemy to enemy.",
  levels: [
    { dmg: 12, cd: 1.3, amount: 1, speed: 150, bounce: 3, knock: 30 },
    { dmg: 12, cd: 1.3, amount: 2, speed: 150, bounce: 3, knock: 30 },
    { dmg: 16, cd: 1.3, amount: 2, speed: 155, bounce: 4, knock: 32 },
    { dmg: 16, cd: 1.15, amount: 3, speed: 155, bounce: 4, knock: 32 },
    { dmg: 21, cd: 1.15, amount: 3, speed: 160, bounce: 6, knock: 36, split: 1 },
  ],
  upgrades: ["+1 pearl", "Damage +4, +1 bounce", "+1 pearl, cooldown −12%", "Damage +5, +2 bounces, pearls split into 2 mini pearls on their last bounce"],
  evolutions: [
    { into: "tapioca_tsunami", with: "big_ribbon" },
    { into: "brown_sugar_railgun", with: "power_bow" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { amount: 1, dmg: 0.1, text: "LIMIT BREAK — Extra Pearls: +1 pearl, +10% damage" },
    { dmg: 0.25, cd: 0.9, text: "MASTERED — Brown Sugar: +25% damage, −10% cooldown" },
  ],
  update(w, inst, dt) {
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const L = S.L;
    const n = Math.min(12, S.amount);
    if (!volley(w, inst, K_PEARL, n, S.dmg, S.speed, L.bounce ?? 3, L.split ?? 0, S.knock, S.area)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
  },
};

export const tapiocaTsunami: WeaponDef = {
  id: "tapioca_tsunami",
  name: "Tapioca Tsunami",
  icon: "icon_tapioca_tsunami",
  color: BOBA_COLOR,
  sfx: "boba",
  evolved: true,
  desc: "EVOLUTION! Giant boba pearls bounce 8 times and shed regular pearls on every bounce.",
  levels: [{ dmg: 30, cd: 1.6, amount: 2, speed: 160, bounce: 8, shed: 3, shedDmg: 14, shedBounce: 2, knock: 60 }],
  upgrades: [],
  update(w, inst, dt) {
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const n = Math.min(8, S.amount);
    if (!volley(w, inst, K_GIANT, n, S.dmg, S.speed, S.L.bounce ?? 8, 0, S.knock, S.area)) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
  },
};

// ---------------------------------------------------------------- Brown Sugar Railgun (second evolution)

/** heroFx cue (src/view/evo2/b.ts): a rail shot left the straw at (x, y); r = its angle. */
export const RAIL_FIRE = "e2_rail";
/** Seconds between a streak's ticks on one enemy. */
const SYRUP_TICK = 0.25;
/** Fan between the pearls of a multi-pearl shot (rad). */
const RAIL_FAN = (6 * Math.PI) / 180;

/** Each enemy pierced costs the pearl `falloff` of its damage (scratch: a = full damage, b = pierced, ox = falloff, oy = floor). */
const railHit: ProjHitHook = (p, _w, e) => {
  if (e.def.prop) return;
  p.b++;
  p.dmg = p.a * Math.max(p.oy, 1 - p.ox * p.b);
};

/**
 * The syrup streak (owned, PK_MANAGED, no hit circle): a line from (ox, oy) along `ang` that grows with
 * the pearl (a = full length, speed = the pearl's) and holds for the rest of its life: enemies on it
 * (half width hh) are slowed to vz and ticked for dmg every SYRUP_TICK on the weapon's channel. b = the
 * length so far (the view draws that much).
 */
const syrupHook: ProjHook = (p, w) => {
  const len = (p.b = Math.min(p.a, p.age * p.speed));
  const ca = Math.cos(p.ang);
  const sa = Math.sin(p.ang);
  const buf = w.acquire();
  const n = w.grid.query(p.ox + ca * len * 0.5, p.oy + sa * len * 0.5, len * 0.5 + p.hh + 14, buf);
  const items = w.enemies.items;
  const now = w.t;
  for (let k = 0; k < n; k++) {
    const e = items[buf[k]];
    if (!e || e.dead || e.def.prop) continue;
    const ex = e.x - p.ox;
    // (the streak lies on the ground: the enemy's feet)
    const ey = e.y - p.oy;
    const along = ex * ca + ey * sa;
    if (along < -e.r || along > len + e.r) continue;
    const side = -ex * sa + ey * ca;
    const lim = p.hh + e.r;
    if (side > lim || side < -lim) continue;
    slowEnemy(e, p.vz, 0.3);
    if (now - e.lastHit[p.ch] < SYRUP_TICK) continue;
    e.lastHit[p.ch] = now;
    w.hitEnemy(e, p.dmg, p.owner, p.ang, 0, 0, p.source, BOBA_COLOR);
  }
  w.release();
};

export const brownSugarRailgun: WeaponDef = {
  id: "brown_sugar_railgun",
  name: "Brown Sugar Railgun",
  icon: "icon_brown_sugar_railgun",
  color: BOBA_COLOR,
  sfx: "boba",
  evolved: true,
  desc: "EVOLUTION! One pearl through one very long straw. It does not bounce. It does not need to.",
  levels: [{ dmg: 540, cd: 1.05, amount: 1, speed: 520, knock: 70, reach: 440, falloff: 0.08, floor: 0.5, syrup: 2, syrupW: 8, syrupSlow: 0.65, syrupDps: 60 }],
  upgrades: [],
  update(w, inst, dt) {
    prune(inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const L = S.L;
    const pl = w.player;
    const sx = pl.x + pl.face * 4;
    const sy = pl.y - 10;
    const t = w.nearestEnemy(sx, sy, 190);
    if (!t) {
      inst.timer = 0.1;
      return;
    }
    inst.timer = S.cd;
    const a0 = Math.atan2(t.y - t.cy - sy, t.x - sx);
    // +1 pearl per 2 amount, fanned
    const n = Math.min(5, 1 + ((S.amount - 1) >> 1));
    const reach = (L.reach ?? 440) * Math.sqrt(S.area);
    const speed = S.speed;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * RAIL_FAN;
      const p = w.spawnProjectile(inst);
      p.kind = PK_FREE;
      p.x = sx;
      p.y = sy;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.speed = speed;
      p.r = 5 * S.area;
      p.dmg = p.a = S.dmg;
      p.b = 0;
      p.ox = L.falloff ?? 0.12;
      p.oy = L.floor ?? 0.4;
      p.knock = S.knock;
      p.pierce = Infinity;
      p.hitEvery = 0;
      p.life = reach / speed;
      p.sprite = "w_pearl_rail";
      p.fps = 12;
      p.scale = Math.min(S.area, 1 + (S.area - 1) * 0.6);
      p.rotMode = ROT_VELOCITY;
      p.rot = a;
      p.trail = "boba_big";
      p.onHit = railHit;
      // its syrup, on the ground under the line
      const s = w.spawnProjectile(inst);
      s.kind = PK_MANAGED;
      s.r = 0;
      s.ox = s.x = sx;
      s.oy = s.y = pl.y;
      s.ang = a;
      s.a = reach;
      s.b = 0;
      s.speed = speed;
      s.hh = (L.syrupW ?? 6) * S.area;
      s.vz = L.syrupSlow ?? 0.65;
      s.dmg = (((L.syrupDps ?? 10) * S.dmg) / Math.max(1e-6, L.dmg)) * SYRUP_TICK;
      s.pierce = Infinity;
      s.life = (L.syrup ?? 2) * S.duration;
      s.update = syrupHook;
      own(inst, s);
    }
    fired(w, inst, sx, sy);
    heroFx(w, RAIL_FIRE, sx, sy, sx, sy, a0, n);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const weapons: WeaponDef[] = [bubbleTeaCannon, tapiocaTsunami, brownSugarRailgun];
