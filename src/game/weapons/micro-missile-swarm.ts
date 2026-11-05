/**
 * Micro Missile Swarm (Aoi's signature, docs/content/weapons.md §2.3): every
 * `cd` s a salvo of `amount` micro missiles (each extra Amount = +2 missiles)
 * launches from the mech's back at random angles within ±70° of straight up
 * at 0.6 x `speed`, reaching `speed` over 0.3 s. Each homes on a random enemy
 * in view (distinct while possible) with turn rate `turn` rad/s plus a sine
 * wobble (±30° at 6 Hz) - the spaghetti. On contact or after 2.5 s it
 * explodes (r `blast` x area, `dmg`, `knock`). A missile whose target dies
 * re-acquires the nearest enemy once ("they're stubborn"); the second loss
 * makes it explode on the spot.
 * Evolution: Al Dente Armageddon (+ Speed Lines) - 24-missile salvos, the
 * trails are actual spaghetti, and every missile drops 3 sauce splats along
 * its flight that burn whatever walks through them.
 *
 * Aoi's talents read here (both forms): Extended Magazine (+1 missile per
 * rank), Cluster Warheads (+15 % blast per rank), FULL BURST (every 5th salvo
 * fires twice the missiles in a figure-eight). Aoi C6's support drone fires
 * with `droneVolley`.
 *
 * Missile scratch: target / targetUid, a = targets lost, b = wobble phase,
 * ang = base heading (the wobble rides on top), ox = turn rate, hw = blast
 * radius, oy = flight-time estimate and angV = sauce splats dropped (Al Dente).
 */
import { C } from "../../art/palette";
import { TAU, approachAngle } from "../../core/math";
import { CH_MISC } from "../config";
import { PK_FREE, PK_MANAGED, ROT_VELOCITY, type Enemy, type ProjHook, type WeaponDef, type WeaponInstance } from "../types";
import type { World } from "../world";
import { fired, wstats, type WStats } from "./_shared";
import { randomTargetsInView } from "./_fx";
import { HERO_TEXTS, HFX_AOI_SALVO, HFX_TEXT, heroesA, hfx } from "./_heroes-a";

const DEG = Math.PI / 180;
const LIFE = 2.5;
const WOBBLE = 30 * DEG;
const WOBBLE_HZ = 6;
/** Source ids (the evolution's missiles and sauce credit the evolution). */
const AL_DENTE = "al_dente_armageddon";
/** p.a marker for sauce splats (the view draws them as ground decals). */
export const SAUCE = 7;

const targets: Enemy[] = [];

/** Missile count for a salvo: each Amount past the level's own = +2 missiles, + Extended Magazine. */
function missileCount(w: World, S: WStats): number {
  const extra = S.amount - S.L.amount;
  return Math.max(1, Math.round(S.L.amount + 2 * extra + w.talentRank("aoi_magazine")));
}

/** A sauce splat on the ground (Al Dente): r 8 x area, damage every 0.3 s for `life` s. */
function sauce(w: World, owner: WeaponInstance | null, x: number, y: number, dmg: number, life: number): void {
  const p = w.spawnProjectile(owner, AL_DENTE);
  p.kind = PK_MANAGED;
  p.ch = CH_MISC;
  p.x = x;
  p.y = y;
  p.r = 8 * w.stats.area;
  p.dmg = dmg;
  p.knock = 0;
  p.pierce = Infinity;
  p.hitEvery = 0.3;
  p.life = life;
  p.a = SAUCE;
}

/** Explode where it is (expiry, contact, second lost target). */
const boom: ProjHook = (p, w) => {
  w.explode(p.x, p.y, p.hw, p.dmg, p.owner, p.knock, p.source, p.source === AL_DENTE ? C.red : C.blue);
};

const missileHook: ProjHook = (p, w, dt) => {
  const sp = p.speed * (0.6 + 0.4 * Math.min(1, p.age / 0.3));
  let t = p.target;
  if (!t || t.dead || t.uid !== p.targetUid) {
    // stubborn: one re-acquire, then it blows up on the spot
    t = null;
    if (p.a < 1) {
      p.a = 1;
      t = w.nearestEnemy(p.x, p.y, 220);
    }
    p.target = t;
    p.targetUid = t ? t.uid : 0;
    if (!t) {
      w.endProjectile(p);
      return;
    }
  }
  // fly out of the launch fan first, then home (harder the longer it flies: it always gets there)
  if (p.age > 0.1) p.ang = approachAngle(p.ang, Math.atan2(t.y - t.cy - p.y, t.x - p.x), p.ox * (1 + p.age * 1.5) * dt);
  const h = p.ang + WOBBLE * Math.sin(p.age * TAU * WOBBLE_HZ + p.b);
  p.vx = Math.cos(h) * sp;
  p.vy = Math.sin(h) * sp;
  // contact with anything in the way
  const e = w.nearestEnemy(p.x, p.y, 12);
  if (e) {
    const dx = e.x - p.x;
    const dy = e.y - e.cy - p.y;
    const rr = e.r + 3;
    if (dx * dx + dy * dy <= rr * rr) {
      w.endProjectile(p);
      return;
    }
  }
  // Al Dente: three sauce splats at 25 / 50 / 75 % of the flight
  if (p.oy > 0 && p.angV < 3 && p.age >= p.oy * 0.25 * (p.angV + 1)) {
    p.angV++;
    const L = p.owner?.def.levels[0];
    sauce(w, p.owner, p.x, p.y + 6, (L?.sauceDmg ?? 6) * w.stats.might * (p.owner?.dmgMul ?? 1), (L?.sauceLife ?? 1.2) * w.stats.duration);
  }
};

/**
 * Launch one missile from (x, y) along `a` at target `t`. `evo` = Al Dente (meatball missile,
 * spaghetti trail on fire, sauce).
 */
export function launchMissile(w: World, owner: WeaponInstance | null, source: string, x: number, y: number, a: number, t: Enemy | null, dmg: number, blast: number, speed: number, turn: number, knock: number, evo: boolean): void {
  const p = w.spawnProjectile(owner, source);
  p.kind = PK_FREE;
  p.x = x;
  p.y = y;
  p.speed = speed;
  p.ang = a;
  p.vx = Math.cos(a) * speed * 0.6;
  p.vy = Math.sin(a) * speed * 0.6;
  p.target = t;
  p.targetUid = t ? t.uid : 0;
  p.r = 0;
  p.dmg = dmg;
  p.knock = knock;
  p.hw = blast;
  p.ox = turn;
  p.b = w.rng.next() * TAU;
  p.a = 0;
  p.life = LIFE;
  p.sprite = evo ? "w_missile_evo" : "w_missile";
  p.rotMode = ROT_VELOCITY;
  p.trail = evo ? "spaghetti_evo" : "spaghetti";
  p.update = missileHook;
  p.onEnd = boom;
  if (evo && t) {
    const dx = t.x - x;
    const dy = t.y - t.cy - y;
    p.oy = Math.min(LIFE, Math.sqrt(dx * dx + dy * dy) / Math.max(1, speed) + 0.35);
    p.angV = 0;
  }
}

/** One salvo: `n` missiles from the mech's back (figure-eight launch for FULL BURST). */
function salvo(w: World, inst: WeaponInstance, S: WStats, n: number, figure8: boolean, evo: boolean): void {
  const pl = w.player;
  const x = pl.x - pl.face * 4;
  const y = pl.y - 15;
  const m = randomTargetsInView(w, n, targets);
  const L = S.L;
  const blast = (L.blast ?? 12) * S.area * (1 + 0.15 * w.talentRank("aoi_cluster"));
  for (let i = 0; i < n; i++) {
    let a: number;
    if (figure8) {
      // a lemniscate of launch headings: the trails draw an infinity sign before they home in
      const s = (i / n) * TAU;
      a = Math.atan2(Math.sin(s) * Math.cos(s) * 1.6 - 0.4, Math.sin(s));
    } else a = -Math.PI / 2 + w.rng.spread(70 * DEG);
    launchMissile(w, inst, inst.def.id, x, y, a, m > 0 ? targets[i % m] : null, S.dmg, blast, S.speed, L.turn ?? 4, S.knock, evo);
  }
  hfx(w, HFX_AOI_SALVO, x, y, x, y, figure8 ? 1 : 0, n);
  fired(w, inst, x, y);
}

function update(w: World, inst: WeaponInstance, dt: number, evo: boolean): void {
  inst.timer -= dt;
  if (inst.timer > 0) return;
  // only fires with something on screen to chase
  if (!w.randomEnemyInView(-6)) {
    inst.timer = 0.2;
    return;
  }
  const S = wstats(w, inst);
  inst.timer = S.cd;
  const d = inst.data;
  d.n = (d.n ?? 0) + 1;
  const full = w.talentRank("aoi_full_burst") > 0 && d.n % 5 === 0;
  const n = missileCount(w, S) * (full ? 2 : 1);
  salvo(w, inst, S, Math.min(64, n), full, evo);
  if (full) {
    const pl = w.player;
    hfx(w, HFX_TEXT, pl.x, pl.y - 30, pl.x, pl.y, 2, HERO_TEXTS.indexOf("FULL BURST!"));
  }
}

export const microMissileSwarm: WeaponDef = {
  id: "micro_missile_swarm",
  name: "Micro Missile Swarm",
  icon: "icon_micro_missile_swarm",
  color: C.blue,
  sfx: "missile",
  desc: "A salvo of micro missiles with gloriously tangled trails.",
  levels: [
    { dmg: 7, cd: 1.6, amount: 4, speed: 140, turn: 4, blast: 12, knock: 30 },
    { dmg: 7, cd: 1.6, amount: 6, speed: 140, turn: 4, blast: 12, knock: 30 },
    { dmg: 9, cd: 1.6, amount: 6, speed: 140, turn: 4, blast: 14, knock: 30 },
    { dmg: 9, cd: 1.4, amount: 8, speed: 150, turn: 4, blast: 14, knock: 32 },
    { dmg: 12, cd: 1.4, amount: 10, speed: 150, turn: 5, blast: 16, knock: 34 },
  ],
  upgrades: ["+2 missiles", "Damage +2, bigger blasts", "+2 missiles, cooldown −12%", "Damage +3, +2 missiles, sharper homing"],
  evolution: { into: "al_dente_armageddon", with: "speed_lines" },
  // mastery Limit Breaks (docs/content/weapons.md §4): a Limit Break amount = +2 missiles
  limitBreak: [
    { amount: 1, dmg: 0.1, text: "LIMIT BREAK — More Pasta: +2 missiles, +10% damage" },
    { dmg: 0.25, area: 0.15, text: "MASTERED — Extra Sauce: +25% damage, +15% blast" },
  ],
  update(w, inst, dt) {
    update(w, inst, dt, false);
  },
};

export const alDenteArmageddon: WeaponDef = {
  id: AL_DENTE,
  name: "Al Dente Armageddon",
  icon: "icon_al_dente_armageddon",
  color: C.red,
  sfx: "missile",
  evolved: true,
  desc: "EVOLUTION! 24-missile salvos. The trails are now actual spaghetti. The spaghetti is on fire.",
  levels: [{ dmg: 14, cd: 1.8, amount: 24, speed: 190, turn: 6, blast: 18, knock: 40, sauceDmg: 6, sauceLife: 1.2 }],
  upgrades: [],
  update(w, inst, dt) {
    update(w, inst, dt, true);
  },
};

/**
 * Aoi C6 support drone volley: 3 micro missiles from (x, y) with Aoi's current missile stats at 60 %
 * damage (Lv1 numbers when the swarm isn't held).
 */
export function droneVolley(w: World, x: number, y: number): void {
  const inst = w.hasWeapon("micro_missile_swarm") ?? w.hasWeapon(AL_DENTE) ?? null;
  const evo = !!inst && inst.def.id === AL_DENTE;
  let dmg: number;
  let blast: number;
  let speed: number;
  let turn: number;
  let knock: number;
  if (inst) {
    const S = wstats(w, inst);
    dmg = S.dmg;
    blast = (S.L.blast ?? 12) * S.area;
    speed = S.speed;
    turn = S.L.turn ?? 4;
    knock = S.knock;
  } else {
    const L = microMissileSwarm.levels[0];
    dmg = L.dmg * w.stats.might;
    blast = (L.blast ?? 12) * w.stats.area;
    speed = (L.speed ?? 140) * w.stats.projSpeed;
    turn = L.turn ?? 4;
    knock = L.knock ?? 30;
  }
  const m = randomTargetsInView(w, 3, targets);
  if (m === 0) return;
  for (let i = 0; i < 3; i++) {
    launchMissile(w, inst, inst ? inst.def.id : "aoi_drone", x, y, -Math.PI / 2 + (i - 1) * 0.5, targets[i % m], dmg * 0.6, blast, speed, turn, knock, evo);
  }
}

/** Aoi C6: a support drone orbits Aoi and fires 3 micro missiles every 2 s. */
export function aoiDrone(w: World): void {
  const st = heroesA(w);
  st.drone = true;
  let a = 0;
  let cd = 1;
  const place = (): void => {
    const p = w.player;
    st.droneX = p.x + Math.cos(a) * 20;
    st.droneY = p.y - 22 + Math.sin(a) * 7;
  };
  place();
  w.hooks.on("step", (h) => {
    if (w.phase !== "play") return;
    a = (a + 2.2 * h.dt) % TAU;
    place();
    st.droneShot += h.dt;
    cd -= h.dt;
    if (cd > 0) return;
    if (!w.randomEnemyInView(-6)) {
      cd = 0.2;
      return;
    }
    cd = 2;
    st.droneShot = 0;
    droneVolley(w, st.droneX, st.droneY);
  });
}

export const weapons: WeaponDef[] = [microMissileSwarm, alDenteArmageddon];
