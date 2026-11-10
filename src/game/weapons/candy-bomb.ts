/**
 * Candy Bomb: candy bombs lobbed in a 0.6 s parabolic arc onto (where enemies
 * are about to be), exploding in an area: fx_explosion scaled to the radius,
 * glow flash, shockwave, shake, debris and a fading scorch (the `explosion`
 * event; candy confetti on top from src/view/weapon-fx.ts).
 * Evolution: Sugar Nuke (+ Lucky Clover) - a giant swirl-lollipop bomb lobbed
 * at the thickest crowd: radius ~80 blast plus a ring of cluster bomblets.
 * Second evolution: Konpeito Minefield (+ Chibi Charm) - tosses tiny star-candy mines to random spots around
 *   the hero (`max` alive, `duration` s each); a mine is armed when it lands and pops when an enemy touches it
 *   (a small blast + a slow); the hero kicks the ones she walks over ahead of her. Area denial and kiting:
 *   strong while moving through lanes, weak against a boss that never walks into them.
 *
 * Bombs are PK_FALL projectiles: the hook drives the height along a parabola
 * (world integrates z and calls onEnd on landing). PK_FALL never uses its hit
 * shape, so `r` is the blast radius. Scratch: a = kind (0 bomb, 1 nuke,
 * 2 bomblet, 3 konpeito toss), ox/oy = landing point, b = flight time, ang = apex height.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { PK_FALL, PK_MANAGED, ROT_SPIN, type Enemy, type ProjHook, type Projectile, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { killOwned, own, prune, wstats } from "./_shared";
import { WFX_CLUSTER, WFX_NUKE, fireSfx, heroFx, randomTargetsInView, sfxAt, wfx } from "./_fx";

const targets: Enemy[] = [];
const K_BOMB = 0;
const K_NUKE = 1;
const K_MINI = 2;
const K_KONPEITO = 3;
const HAND_Z = 8;

/** Parabolic height: the world integrates z += vz * dt right after this hook. */
const arc: ProjHook = (p, _w, dt) => {
  const k = p.age / p.b;
  const z = k >= 1 ? -1 : HAND_Z * (1 - k) + 4 * p.ang * k * (1 - k);
  p.vz = (z - p.z) / Math.max(dt, 1e-4);
  // a little perspective swell at the top of the arc
  const base = p.a === K_NUKE ? 1.5 : p.a === K_MINI ? 0.9 : p.a === K_KONPEITO ? 1.1 : 1.2;
  p.scale = base * (1 + 0.22 * Math.sin(Math.PI * Math.min(1, k)));
};

const boomEv = { x: 0, y: 0, r: 0, source: "", big: false };

/**
 * Area damage with a smaller fireball than the damage radius: a radius-80 nuke
 * drawn as an 80 px fx_explosion (+ bloom) would white out the screen, so the
 * fireball is capped and the true reach is shown by candy-pink rings instead.
 */
function blast(w: World, p: Projectile, color: number, visualR: number, big: boolean): void {
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y, p.r + 24, buf);
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - p.y;
    const rr = p.r + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    w.hitEnemy(e, p.dmg, p.owner, Math.atan2(dy, dx), p.knock, 0, p.source, color);
  }
  w.release();
  boomEv.x = p.x;
  boomEv.y = p.y;
  boomEv.r = visualR;
  boomEv.source = p.source;
  boomEv.big = big;
  w.emit("explosion", boomEv);
}

const land: ProjHook = (p, w) => {
  const inst = p.owner;
  if (p.a === K_NUKE) {
    blast(w, p, C.pink, Math.min(p.r, 38), true);
    wfx(w, WFX_NUKE, p.x, p.y, p.x, p.y, p.r);
    if (inst) scatter(w, inst, p.x, p.y);
  } else if (p.a === K_MINI) blast(w, p, C.pinkLight, p.r * 0.7, false);
  else blast(w, p, C.pink, Math.min(p.r, 34), false);
};

function lob(w: World, inst: WeaponInstance, kind: number, sx: number, sy: number, tx: number, ty: number, T: number, apex: number, r: number, dmg: number, knock: number): void {
  const p = w.spawnProjectile(inst);
  p.kind = PK_FALL;
  p.a = kind;
  p.x = sx;
  p.y = sy;
  p.ox = tx;
  p.oy = ty;
  p.vx = (tx - sx) / T;
  p.vy = (ty - sy) / T;
  p.z = HAND_Z;
  p.vz = 0;
  p.b = T;
  p.ang = apex;
  p.life = T + 0.6;
  p.r = r;
  p.dmg = dmg;
  p.knock = knock;
  p.sprite = kind === K_NUKE ? "w_candy_evo" : "w_candy";
  p.fps = 8;
  p.rotMode = ROT_SPIN;
  p.spin = (w.rng.next() < 0.5 ? -1 : 1) * (kind === K_NUKE ? 5 : 9);
  p.trail = kind === K_NUKE ? "nukeFuse" : "fuse";
  p.update = arc;
  p.onEnd = land;
  own(inst, p);
}

/** Sugar Nuke cluster: bomblets fan out from the crater. */
function scatter(w: World, inst: WeaponInstance, x: number, y: number): void {
  const S = wstats(w, inst);
  const n = Math.min(12, S.amount);
  const a0 = w.rng.angle();
  const mr = (S.L.miniR ?? 28) * S.area;
  const reach = (S.L.radius ?? 80) * S.area;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU + w.rng.spread(0.2);
    const d = reach * (0.55 + w.rng.next() * 0.45);
    lob(w, inst, K_MINI, x, y, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, 0.42 + w.rng.next() * 0.12, 22, mr, (S.L.mini ?? 30) * w.stats.might, 70);
  }
  wfx(w, WFX_CLUSTER, x, y, x, y, reach, n);
}

/** Landing points of the current volley (bomb i), so the next bomb picks a different spot. */
const LAND_X = new Float64Array(10);
const LAND_Y = new Float64Array(10);

/**
 * Among the `n` nearest targets, the one farthest from this volley's earlier
 * landing points (bombs spread over the crowd instead of stacking into one
 * white blob), preferring enemies that aren't hugging the hero.
 */
function pickSpread(w: World, n: number, shot: number, r: number): Enemy {
  const pl = w.player;
  let best = targets[0];
  let bs = -1e9;
  const cap = r * 2.4;
  for (let k = 0; k < n; k++) {
    const e = targets[k];
    let near = cap * cap;
    for (let j = 0; j < Math.min(shot, LAND_X.length); j++) {
      const dx = e.x - LAND_X[j];
      const dy = e.y - LAND_Y[j];
      near = Math.min(near, dx * dx + dy * dy);
    }
    const px = e.x - pl.x;
    const py = e.y - pl.y;
    // (a fireball on the hero's head hides the hero: point-blank targets only when there is nothing else)
    const hug = px * px + py * py < 40 * 40 && n > 2 ? -cap * cap : 0;
    const s = near + hug - k * 4 + w.rng.next() * 30;
    if (s > bs) {
      bs = s;
      best = e;
    }
  }
  return best;
}

/** The enemy (of a few random on-screen ones) with the most neighbours within `r` (point-blank crowds count half). */
function densest(w: World, r: number): Enemy | null {
  const n = randomTargetsInView(w, 7, targets, -20);
  let best: Enemy | null = null;
  let bc = -1;
  const buf = w.acquire();
  const pl = w.player;
  for (let i = 0; i < n; i++) {
    const e = targets[i];
    let c = w.grid.query(e.x, e.y - e.cy, r, buf);
    // a nuke on the hero's head hides the hero: prefer crowds a little way off
    const dx = e.x - pl.x;
    const dy = e.y - pl.y;
    if (dx * dx + dy * dy < 56 * 56) c *= 0.4;
    if (c > bc) {
      bc = c;
      best = e;
    }
  }
  w.release();
  return best;
}

export const candyBomb: WeaponDef = {
  id: "candy_bomb",
  name: "Candy Bomb",
  icon: "icon_candy_bomb",
  color: C.pink,
  sfx: "candyThrow",
  desc: "Lobs candy bombs onto enemies. Sweet, sweet area damage.",
  levels: [
    { dmg: 25, cd: 2.0, amount: 1, area: 1, radius: 28, knock: 110 },
    { dmg: 25, cd: 2.0, amount: 2, area: 1, radius: 28, knock: 110 },
    { dmg: 32, cd: 2.0, amount: 2, area: 1.15, radius: 28, knock: 120 },
    { dmg: 32, cd: 1.7, amount: 3, area: 1.15, radius: 28, knock: 120 },
    { dmg: 42, cd: 1.7, amount: 3, area: 1.3, radius: 28, knock: 130 },
  ],
  upgrades: ["+1 bomb", "Damage +7, blast radius +15%", "+1 bomb, cooldown -15%", "Damage +10, blast radius +15%"],
  evolutions: [
    { into: "sugar_nuke", with: "lucky_clover" },
    { into: "konpeito_minefield", with: "chibi_charm" },
  ],
  // mastery Limit Breaks (docs/content/weapons.md §4): Lv6 at rank 5, Lv7 at rank 10
  limitBreak: [
    { area: 0.2, dmg: 0.15, text: "LIMIT BREAK — Family Size: +20% blast, +15% damage" },
    { amount: 1, dmg: 0.2, text: "MASTERED — Trick AND Treat: +1 bomb, +20% damage" },
  ],
  update(w, inst, dt) {
    prune(inst);
    const d = inst.data;
    const S = wstats(w, inst);
    if ((d.queue ?? 0) > 0) {
      d.qt = (d.qt ?? 0) - dt;
      while (d.qt <= 0 && d.queue > 0) {
        const i = d.shot ?? 0;
        const pl = w.player;
        const sx = pl.x + pl.face * 4;
        const sy = pl.y - 2;
        const n = w.nearestEnemies(sx, sy - 8, 150, 16, targets);
        let tx: number;
        let ty: number;
        if (n > 0) {
          const e = pickSpread(w, n, i, (S.L.radius ?? 28) * S.area);
          // lead the target so the bomb lands where it is going
          const T = 0.6;
          tx = e.x + e.vx * e.slow * T * 0.8 + w.rng.spread(4);
          ty = e.y + e.vy * e.slow * T * 0.8 + w.rng.spread(3);
        } else {
          const a = w.rng.angle();
          tx = pl.x + Math.cos(a) * 60;
          ty = pl.y + Math.sin(a) * 50;
        }
        const dist = Math.hypot(tx - sx, ty - sy);
        lob(w, inst, K_BOMB, sx, sy, tx, ty, 0.6, 26 + dist * 0.12, (S.L.radius ?? 28) * S.area, S.dmg, S.knock);
        if (i < LAND_X.length) {
          LAND_X[i] = tx;
          LAND_Y[i] = ty;
        }
        sfxAt(w, inst.def.id, "candyThrow", sx, sy);
        d.shot = i + 1;
        d.queue--;
        d.qt += 0.12;
      }
    }
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const pl = w.player;
    if (!w.nearestEnemy(pl.x, pl.y - 8, 150)) {
      inst.timer = 0.15;
      return;
    }
    inst.timer = S.cd;
    d.queue = Math.min(10, S.amount);
    d.qt = 0;
    d.shot = 0;
  },
};

export const sugarNuke: WeaponDef = {
  id: "sugar_nuke",
  name: "Sugar Nuke",
  icon: "icon_sugar_nuke",
  color: C.pinkLight,
  sfx: "candyThrow",
  evolved: true,
  desc: "EVOLUTION! A giant lollipop nuke (huge blast) that bursts into cluster bomblets.",
  levels: [{ dmg: 85, cd: 3.0, amount: 6, area: 1, radius: 80, mini: 32, miniR: 28, knock: 220 }],
  upgrades: [],
  update(w, inst, dt) {
    prune(inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const e = densest(w, 40);
    if (!e) {
      inst.timer = 0.2;
      return;
    }
    inst.timer = S.cd;
    const pl = w.player;
    const sx = pl.x + pl.face * 4;
    const sy = pl.y - 2;
    const T = 0.85;
    const tx = e.x + e.vx * e.slow * T * 0.7;
    const ty = e.y + e.vy * e.slow * T * 0.7;
    lob(w, inst, K_NUKE, sx, sy, tx, ty, T, 70, (S.L.radius ?? 80) * S.area, S.dmg, S.knock);
    fireSfx(w, inst, sx, sy);
  },
};

// ---------------------------------------------------------------- Konpeito Minefield

/** View cues (heroFx). A mine landed and armed at (x, y); n = its tint index. */
export const FX_MINE_ARM = "e2a_arm";
/** A mine popped at (x, y): blast radius r, n = its tint index. */
export const FX_MINE_POP = "e2a_pop";
/** The hero kicked a mine at (x, y) toward (x2, y2). */
export const FX_MINE_KICK = "e2a_kick";
/** The four candy tints (pink / mint / yellow / lavender), by tint index. */
export const KONPEITO_TINTS: readonly number[] = [C.pink, 0x8cf0b4, C.yellow, C.violet];
/** A mine's touch radius (px, on top of the enemy's own). */
const TOUCH = 5;
const KICK_SPEED = 220;

/** The pop: everything in `r` takes the blast and is slowed. */
function pop(w: World, p: Projectile, inst: WeaponInstance): void {
  const S = wstats(w, inst);
  const L = S.L;
  const r = (L.radius ?? 20) * S.area;
  const dmg = S.dmg;
  const knock = S.knock;
  const slow = L.slow ?? 0.75;
  const slowT = L.slowT ?? 1;
  const x = p.x;
  const y = p.y - 5;
  p.dead = true;
  heroFx(w, FX_MINE_POP, x, p.y, x, p.y, r, p.a);
  const buf = w.acquire();
  const n = w.grid.query(x, y, r + 24, buf);
  for (let k = 0; k < n; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - e.cy - y;
    const rr = r + e.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    if (!e.def.boss && !e.def.prop) {
      e.slow = e.slowT > 0 ? Math.min(e.slow, slow) : slow;
      if (slowT > e.slowT) e.slowT = slowT;
    }
    w.hitEnemy(e, dmg, inst, Math.atan2(dy, dx), knock, 0, inst.def.id, inst.def.color);
  }
  w.release();
}

/**
 * An armed mine on the ground (managed, no hit shape of its own). Scratch: a = tint index, b = kick distance
 * left (px), vx / vy = the kick's direction.
 */
const mine: ProjHook = (p, w, dt) => {
  const inst = p.owner;
  if (!inst) return;
  const pl = w.player;
  if (p.b > 0) {
    const step = Math.min(p.b, KICK_SPEED * dt);
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.b -= step;
  } else if (pl.moving) {
    const dx = p.x - pl.x;
    const dy = p.y - pl.y;
    if (dx * dx + dy * dy < 49) {
      // she walks over it: kicked on ahead of her
      p.vx = pl.aimX;
      p.vy = pl.aimY;
      p.b = inst.def.levels[0].kick ?? 40;
      heroFx(w, FX_MINE_KICK, p.x, p.y, p.x + p.vx * p.b, p.y + p.vy * p.b, 0, p.a);
    }
  }
  const buf = w.acquire();
  const n = w.grid.query(p.x, p.y, TOUCH + 22, buf);
  let touched = false;
  for (let k = 0; k < n && !touched; k++) {
    const e = w.enemies.items[buf[k]];
    if (!e || e.dead || e.def.prop || e.untargetable) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const rr = TOUCH + e.r;
    touched = dx * dx + dy * dy <= rr * rr;
  }
  w.release();
  if (touched) pop(w, p, inst);
};

/** The toss landed: the mine is armed. */
const plant: ProjHook = (p, w) => {
  const inst = p.owner;
  if (!inst) return;
  const S = wstats(w, inst);
  const m = w.spawnProjectile(inst);
  m.kind = PK_MANAGED;
  m.a = Math.max(0, KONPEITO_TINTS.indexOf(p.tint));
  m.b = 0;
  // (exactly where it was thrown: the arc lands a step late)
  m.x = p.ox;
  m.y = p.oy;
  m.r = 0;
  m.life = S.duration;
  m.sprite = "w_konpeito";
  m.fps = 3;
  m.tint = p.tint;
  m.scale = 1.25;
  m.pop = true;
  m.shadow = 5;
  m.update = mine;
  own(inst, m);
  heroFx(w, FX_MINE_ARM, m.x, m.y, m.x, m.y, 0, m.a);
};

export const konpeitoMinefield: WeaponDef = {
  id: "konpeito_minefield",
  name: "Konpeito Minefield",
  icon: "icon_konpeito_minefield",
  color: C.pinkLight,
  sfx: "candyThrow",
  evolved: true,
  desc: "EVOLUTION! Scatters tiny star candies everywhere. They are small. They are armed.",
  levels: [{ dmg: 54, cd: 0.5, amount: 2, area: 1, radius: 23, knock: 60, duration: 12, max: 28, arm: 0.4, slow: 0.75, slowT: 1, kick: 40, near: 30, far: 90 }],
  upgrades: [],
  update(w, inst, dt) {
    const live = prune(inst);
    inst.timer -= dt;
    if (inst.timer > 0) return;
    const S = wstats(w, inst);
    const L = S.L;
    inst.timer = Math.max(0.1, S.cd);
    const n = Math.min(S.amount, Math.round(L.max ?? 28) - live);
    if (n <= 0) return;
    const pl = w.player;
    const sx = pl.x + pl.face * 4;
    const sy = pl.y - 2;
    const T = L.arm ?? 0.4;
    const d = inst.data;
    for (let i = 0; i < n; i++) {
      const a = w.rng.angle();
      const dist = (L.near ?? 30) + w.rng.next() * ((L.far ?? 90) - (L.near ?? 30));
      const tx = pl.x + Math.cos(a) * dist;
      const ty = pl.y + Math.sin(a) * dist * 0.85;
      const p = w.spawnProjectile(inst);
      p.kind = PK_FALL;
      p.a = K_KONPEITO;
      p.x = sx;
      p.y = sy;
      p.ox = tx;
      p.oy = ty;
      p.vx = (tx - sx) / T;
      p.vy = (ty - sy) / T;
      p.z = HAND_Z;
      p.vz = 0;
      p.b = T;
      p.ang = 16 + dist * 0.12;
      p.life = T + 0.6;
      p.sprite = "w_konpeito";
      d.tint = ((d.tint ?? 0) + 1) % KONPEITO_TINTS.length;
      p.tint = KONPEITO_TINTS[d.tint];
      p.rotMode = ROT_SPIN;
      p.spin = (i & 1 ? -1 : 1) * 12;
      p.shadow = 4;
      p.update = arc;
      p.onEnd = plant;
      own(inst, p);
    }
    // (two tosses a second: the throw is heard on every other one)
    d.vol = (d.vol ?? 0) + 1;
    if (d.vol & 1) fireSfx(w, inst, sx, sy);
  },
  dispose(_w, inst) {
    killOwned(inst);
  },
};

export const weapons: WeaponDef[] = [candyBomb, sugarNuke, konpeitoMinefield];
