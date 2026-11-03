/**
 * KRAKEN-CHAN (Beach Episode 8:00 mid boss, docs/content/enemies.md §5.5).
 * "She Just Wants a Hug (Lethally)". A round bath-toy octopus in a sailor hat:
 * her tentacles only slam the sand and wave - they never grab the hero.
 *
 *   P1 (100-50 %)  Tentacle Slam -> Ink Spray -> Hug Attempt (loop)
 *     Tentacle Slam  3 tentacles rise at telegraphed circles (r 20, 0.9 s) near the
 *                    hero; each slam deals 16 + a ring of 6 eb_ink; they stay 1.5 s
 *                    (touching one: 10), then sink
 *     Ink Spray      cheeks puffed (f2): two aimed fans of 7 eb_ink (70 px/s, 14) and
 *                    3 ink puddles at telegraphed spots (r 18, 4 s, -30 % speed)
 *     Hug Attempt    a lunge down a 0.7 s lane at 220 px/s: 22 on contact, "HUG!"
 *   P2 (< 50 %) "HIGH TIDE" (the tide's coming in - it's her): water creeps in from
 *     the edges of the arena (the view at the phase change, slowly following the
 *     hero) 40 px deep for the rest of the fight (-30 % speed in it); adds
 *     Whirlpool (a 3-arm eb_ink spiral for 2.5 s) and Tentacle Ring (6 tentacles in a
 *     ring of r 64 around the hero with one telegraphed gap).
 *
 * Death: "Nobody... ever wants... to hug the kraken..." - the view walks a
 * Crab-kun up to hug her during the death slow-mo; she blushes (f5).
 * Tentacles / puddles / the tide are sim state the view reads (krakenState).
 */
import { C } from "../../art/palette";
import { TAU, clamp } from "../../core/math";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt } from "../enemies/_bullets";
import { onScreen, shock } from "../enemies/_fx";
import { say } from "../enemies/_say";
import { BX_HUG, BX_INK, BX_INK_CANNON, BX_TENTACLE, BX_TIDE, cue, slowZone } from "../enemies/_s45";
import { anchor, fanOf, go, heroInLane, phaseFlourish, readable, ringOf, steerTo } from "./_s45boss";

export const KR_ENTER = 0;
export const KR_DRIFT = 1;
export const KR_SLAM = 2;
export const KR_INK = 3;
export const KR_HUG_TELE = 4;
export const KR_HUG = 5;
export const KR_HUG_REC = 6;
export const KR_WHIRL = 7;
export const KR_RING = 8;
export const KR_FLOURISH = 9;

const P_SLAM = 0;
const P_INK = 1;
const P_HUG = 2;
const P_WHIRL = 3;
const P_RING = 4;
const CYCLES: readonly (readonly number[])[] = [[], [P_SLAM, P_INK, P_HUG], [P_WHIRL, P_RING, P_INK, P_HUG, P_SLAM, P_RING]];

/** Sprite height above the feet (head top) for the readability check. */
const TOP = 54;
const BODY_Y = 26;
export const TENT_N = 8;
export const TENT_TELE = 0.9;
export const TENT_STAY = 1.5;
export const TENT_SINK = 0.4;
export const TENT_R = 20;
export const PUDDLE_N = 6;
export const PUDDLE_TELE = 0.7;
export const PUDDLE_LIFE = 4;
export const PUDDLE_R = 18;
export const HUG_TELE = 0.7;
export const HUG_SPEED = 220;
export const TIDE_DEPTH = 40;
const INK = 14;
const SLAM = 16;
const TOUCH = 10;
const HUG = 22;

export interface KrakenState {
  phase: number;
  pat: number;
  n: number;
  spin: number;
  drift: number;
  hugged: boolean;
  /** Hug lunge direction. */
  dx: number;
  dy: number;
  /** Tentacles: position, age (s since the telegraph started; < 0 = free), and which pattern raised it. */
  tx: Float32Array;
  ty: Float32Array;
  tAge: Float32Array;
  /** Ink puddles: position + age (< 0 = free). */
  px: Float32Array;
  py: Float32Array;
  pAge: Float32Array;
  /** HIGH TIDE: on, arena centre, current depth (0..TIDE_DEPTH). */
  tide: boolean;
  tideX: number;
  tideY: number;
  tideD: number;
  /** Tentacle Ring gap marker (a slot index of RING_SLOTS). */
  gapX: number;
  gapY: number;
}

const STATE = new WeakMap<Enemy, KrakenState>();

export function krakenState(e: Enemy): KrakenState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): KrakenState {
  let s = STATE.get(e);
  if (!s) {
    s = {
      phase: 1,
      pat: 0,
      n: 0,
      spin: 0,
      drift: 2,
      hugged: false,
      dx: 0,
      dy: 1,
      tx: new Float32Array(TENT_N),
      ty: new Float32Array(TENT_N),
      tAge: new Float32Array(TENT_N).fill(-1),
      px: new Float32Array(PUDDLE_N),
      py: new Float32Array(PUDDLE_N),
      pAge: new Float32Array(PUDDLE_N).fill(-1),
      tide: false,
      tideX: 0,
      tideY: 0,
      tideD: 0,
      gapX: 0,
      gapY: 0,
    };
    STATE.set(e, s);
  }
  return s;
}

const tmp = { x: 0, y: 0 };

function raiseTentacle(w: World, s: KrakenState, x: number, y: number): void {
  for (let i = 0; i < TENT_N; i++) {
    if (s.tAge[i] >= 0) continue;
    s.tx[i] = x;
    s.ty[i] = y;
    s.tAge[i] = 0;
    w.telegraphCircle(x, y, TENT_R, TENT_TELE, C.pink);
    return;
  }
}

function dropPuddle(w: World, s: KrakenState, x: number, y: number): void {
  for (let i = 0; i < PUDDLE_N; i++) {
    if (s.pAge[i] >= 0) continue;
    s.px[i] = x;
    s.py[i] = y;
    s.pAge[i] = 0;
    w.telegraphCircle(x, y, PUDDLE_R, PUDDLE_TELE, C.violet);
    return;
  }
}

/** Tentacles + puddles + the tide tick on their own clocks (also during flourishes). */
function tickHazards(e: Enemy, w: World, s: KrakenState, dt: number): void {
  const p = w.player;
  for (let i = 0; i < TENT_N; i++) {
    let a = s.tAge[i];
    if (a < 0) continue;
    const before = a;
    a += dt;
    s.tAge[i] = a;
    if (before < TENT_TELE && a >= TENT_TELE) {
      // SLAM: the sand under the circle + a ring of ink
      const dx = p.x - s.tx[i];
      const dy = p.y - s.ty[i];
      if (dx * dx + dy * dy < TENT_R * TENT_R) w.hurtPlayer(SLAM, s.tx[i], s.ty[i], e.def.id);
      ringOf(w, s.tx[i], s.ty[i] - 6, 6, w.rng.angle(), 52, INK, "eb_ink", 0xffffff, 10);
      shock(w, s.tx[i], s.ty[i], 26, 0.35);
      cue(w, BX_TENTACLE, s.tx[i], s.ty[i], 0, 0, TENT_R, e);
    } else if (a > TENT_TELE + 0.05 && a < TENT_TELE + TENT_STAY) {
      // the tentacle stands there waving: touching it stings
      const dx = p.x - s.tx[i];
      const dy = p.y - CFG.playerCy - (s.ty[i] - 14);
      if (Math.abs(dx) < 6 + CFG.playerRadius && Math.abs(dy) < 16) w.hurtPlayer(TOUCH, s.tx[i], s.ty[i], e.def.id);
    }
    if (a >= TENT_TELE + TENT_STAY + TENT_SINK) s.tAge[i] = -1;
  }
  for (let i = 0; i < PUDDLE_N; i++) {
    let a = s.pAge[i];
    if (a < 0) continue;
    a += dt;
    s.pAge[i] = a;
    if (a >= PUDDLE_TELE && a < PUDDLE_TELE + PUDDLE_LIFE) {
      if (a - dt < PUDDLE_TELE) cue(w, BX_INK, s.px[i], s.py[i], 0, 0, PUDDLE_R, e);
      const dx = p.x - s.px[i];
      const dy = p.y - s.py[i];
      if (dx * dx + dy * dy < PUDDLE_R * PUDDLE_R) slowZone(w, 0.7);
    }
    if (a >= PUDDLE_TELE + PUDDLE_LIFE) s.pAge[i] = -1;
  }
  if (s.tide) {
    s.tideD = Math.min(TIDE_DEPTH, s.tideD + dt * (TIDE_DEPTH / 3));
    // the arena drifts slowly after the hero (it's a tide, not a wall)
    s.tideX += clamp(p.x - s.tideX, -6 * dt, 6 * dt);
    s.tideY += clamp(p.y - s.tideY, -6 * dt, 6 * dt);
    const ix = w.viewW * 0.5 - s.tideD;
    const iy = w.viewH * 0.5 - s.tideD;
    if (Math.abs(p.x - s.tideX) > ix || Math.abs(p.y - s.tideY) > iy) slowZone(w, 0.7);
  }
}

function nextPattern(e: Enemy, w: World, s: KrakenState): void {
  const cyc = CYCLES[s.phase];
  const pat = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  const p = w.player;
  switch (pat) {
    case P_SLAM: {
      go(e, KR_SLAM);
      // one on the hero's spot, two beside it
      raiseTentacle(w, s, p.x, p.y);
      const a = w.rng.angle();
      for (let k = 1; k <= 2; k++) {
        const aa = a + k * 2.4;
        raiseTentacle(w, s, p.x + Math.cos(aa) * 40, p.y + Math.sin(aa) * 30);
      }
      break;
    }
    case P_INK: {
      go(e, KR_INK);
      cue(w, BX_INK_CANNON, e.x, e.y - BODY_Y, 0, 0, 1, e);
      for (let k = 0; k < 3; k++) {
        const a = w.rng.angle();
        const d = w.rng.range(18, 58);
        dropPuddle(w, s, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.7);
      }
      break;
    }
    case P_HUG: {
      go(e, KR_HUG_TELE);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      s.dx = dx / d;
      s.dy = dy / d;
      s.hugged = false;
      const len = d + 50;
      w.telegraphLine(e.x, e.y - 8, e.x + s.dx * len, e.y - 8 + s.dy * len, e.r - 4, HUG_TELE, C.pink);
      e.sqV -= 6;
      break;
    }
    case P_WHIRL:
      go(e, KR_WHIRL);
      s.spin = w.rng.angle();
      cue(w, BX_INK_CANNON, e.x, e.y - BODY_Y, 0, 0, 2, e);
      break;
    default: {
      go(e, KR_RING);
      // 7 slots around the hero, one left open (the telegraphed gap)
      const slots = 7;
      const gap = w.rng.int(0, slots - 1);
      const a0 = w.rng.angle();
      for (let k = 0; k < slots; k++) {
        const a = a0 + (k / slots) * TAU;
        const x = p.x + Math.cos(a) * 64;
        const y = p.y + Math.sin(a) * 64 * 0.8;
        if (k === gap) {
          s.gapX = x;
          s.gapY = y;
          w.telegraphCircle(x, y, 12, TENT_TELE + 0.3, C.lime);
        } else raiseTentacle(w, s, x, y);
      }
    }
  }
}

function drift(e: Enemy, s: KrakenState, sec: number): void {
  go(e, KR_DRIFT);
  s.drift = sec;
}

export const krakenChan: EnemyDef = {
  id: "kraken_chan",
  name: "Kraken-chan",
  sprite: "boss_kraken",
  fps: 5,
  hp: 160000,
  speed: 28,
  dmg: 18,
  radius: 22,
  height: 36,
  xp: 0,
  shadow: 52,
  knockResist: 0.98,
  noSeparation: true,
  colors: [C.pink, C.pinkLight, C.white, C.navy, C.violet],
  boss: { title: "KRAKEN-CHAN", subtitle: "She Just Wants a Hug (Lethally)", music: "boss", level: 45 },
  // art: f0-1 bob/wiggle, f2 ink cannon (cheeks puffed), f3 submerge, f4 rise (splash), f5 blush
  frame(e) {
    const s = STATE.get(e);
    switch (e.state) {
      case KR_INK:
      case KR_WHIRL:
        return 2;
      case KR_SLAM:
      case KR_RING:
        return e.timer < TENT_TELE ? 3 : 4;
      case KR_HUG_TELE:
        return 2;
      case KR_HUG:
        return 0;
      case KR_HUG_REC:
        return s?.hugged ? 5 : 1;
      case KR_FLOURISH:
        return 4;
      default:
        return Math.floor(e.t * 3) & 1;
    }
  },
  init(e) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.tide = false;
    s.tideD = 0;
    s.tAge.fill(-1);
    s.pAge.fill(-1);
    go(e, KR_ENTER);
    e.inv = 2.2;
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    e.timer += dt;
    tickHazards(e, w, s, dt);
    if (e.state !== KR_HUG) e.z = 4 + Math.sin(e.t * 1.7) * 2;

    // phase 2 at 50 %: HIGH TIDE (never skipped)
    if (s.phase === 1 && e.state !== KR_ENTER && e.state !== KR_FLOURISH && e.hp < e.maxHp * 0.5) {
      s.phase = 2;
      s.pat = 0;
      go(e, KR_FLOURISH);
      phaseFlourish(e, w, 2, "HIGH TIDE", "the tide's coming in (it's her)", "Tide's in!");
      s.tide = true;
      s.tideX = p.x;
      s.tideY = p.y;
      s.tideD = 0;
      cue(w, BX_TIDE, p.x, p.y, 0, 0, TIDE_DEPTH, e);
    }

    switch (e.state) {
      case KR_ENTER: {
        anchor(e, w, 78, TOP, tmp);
        steerTo(e, tmp.x, tmp.y, e.speed * 2);
        if (e.timer > 1.8 && s.n === 0) {
          s.n = 1;
          say(w, e, "Hug time~!");
        }
        if (e.timer > 2.4) drift(e, s, 0.6);
        break;
      }
      case KR_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer > 1.6) drift(e, s, 0.8);
        break;
      case KR_DRIFT: {
        anchor(e, w, 78, TOP, tmp);
        const far = Math.abs(e.x - p.x) > w.viewW * 0.45 || Math.abs(e.y - p.y) > w.viewH * 0.45;
        steerTo(e, tmp.x, tmp.y, e.speed * (far ? 3 : 1));
        if (e.timer >= s.drift && (readable(e, w, TOP, 30) || e.timer > s.drift + 3)) nextPattern(e, w, s);
        break;
      }
      case KR_SLAM:
      case KR_RING:
        // half under the sand while the tentacles come up
        e.vx = e.vy = 0;
        if (e.timer >= TENT_TELE + 0.6) drift(e, s, s.phase >= 2 ? 0.8 : 1.1);
        break;
      case KR_INK: {
        e.vx = e.vy = 0;
        const y = e.y - BODY_Y;
        if (s.n === 0 && e.timer >= 0.4) {
          s.n = 1;
          fanOf(w, e.x, y, 7, aimAt(w, e.x, y), 0.19, 70, INK, "eb_ink", 0xffffff, 14);
          e.sqV -= 6;
        } else if (s.n === 1 && e.timer >= 0.85) {
          s.n = 2;
          fanOf(w, e.x, y, 7, aimAt(w, e.x, y) + 0.095, 0.19, 70, INK, "eb_ink", 0xffffff, 14);
          e.sqV -= 6;
        }
        if (e.timer >= 1.5) drift(e, s, 1);
        break;
      }
      case KR_HUG_TELE:
        e.vx = -s.dx * 6;
        e.vy = -s.dy * 6;
        if (e.timer >= HUG_TELE) {
          go(e, KR_HUG);
          e.sqV += 10;
        }
        break;
      case KR_HUG: {
        e.vx = s.dx * HUG_SPEED;
        e.vy = s.dy * HUG_SPEED;
        e.z = 2;
        if (!s.hugged) {
          const x0 = e.x - s.dx * 10;
          const y0 = e.y - 14 - s.dy * 10;
          if (heroInLane(w, x0, y0, e.x + s.dx * 10, e.y - 14 + s.dy * 10, e.r + CFG.playerRadius - 6)) {
            s.hugged = true;
            if (w.hurtPlayer(HUG, e.x, e.y, e.def.id)) cue(w, BX_HUG, p.x, p.y - 20, s.dx, s.dy, 1, e);
          }
        }
        if (e.timer >= 0.75) {
          go(e, KR_HUG_REC);
          e.sqV -= 10;
          shock(w, e.x, e.y, 30, 0.4);
        }
        break;
      }
      case KR_HUG_REC:
        e.vx = e.vy = 0;
        if (e.timer >= 0.7) drift(e, s, 0.9);
        break;
      case KR_WHIRL: {
        e.vx = e.vy = 0;
        const every = 0.11;
        const y = e.y - BODY_Y;
        while (s.n * every <= e.timer && e.timer < 2.5) {
          for (let k = 0; k < 3; k++) {
            const a = s.spin + (k / 3) * TAU;
            fanOf(w, e.x, y, 1, a, 0, 56, INK, "eb_ink", 0xffffff, 18);
          }
          s.spin += 0.27;
          s.n++;
        }
        if (e.timer >= 2.9) drift(e, s, 0.9);
        break;
      }
      default:
        drift(e, s, 1);
    }
    if (!onScreen(w, e.x, e.y, 120) && e.state === KR_DRIFT) {
      // lost far behind (a dashing hero): wade back fast
      e.vx *= 2;
      e.vy *= 2;
    }
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) {
      s.tide = false;
      s.tAge.fill(-1);
      s.pAge.fill(-1);
    }
    w.clearBullets();
  },
};

export const bosses: EnemyDef[] = [krakenChan];
