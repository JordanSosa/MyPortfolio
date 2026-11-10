/**
 * THE BISHOUNEN WHO NEVER NOTICES YOU (Shoujo Academy FINAL 13:00, enemies.md §5.4).
 * Name card: THE BISHOUNEN WHO NEVER NOTICES YOU - Fan Club: 9,999 Members (You Are Not One).
 * Killing him = victory ("CLASS DISMISSED!").
 *
 * Gimmick: in phases 1-2 he never aims at you - his attacks go to random points / directions
 * and his sprite always faces away from the player (the view). You get hit by collateral
 * sparkle. His fan club, however, notices you.
 * P1 (100-60 %) "Rooftop Brooding"
 *   Hair Flip       a fan of 9 eb_rose in a random direction (never toward the player +-30 deg), 70 px/s
 *   Rose Rain       24 eb_rose fall from above over 3 s at random x (ground shadow 0.6 s each)
 *   Fan Club        two lines of 12 Love Letters that DO target you ("competition")
 *   Dramatic Wind   a wind lane (telegraphed 0.6 s, petals) pushes the player 60 px over 1 s
 * P2 (< 60 %) "LOOKING AT HIS PHONE" - he's busy: phone glare sweeps a 120 deg arc over 1.2 s
 *   (telegraphed 1.0 s; 22 dmg inside), 2-arm rose spirals, love-letter storms.
 * P3 (< 25 %) "...HE NOTICED YOU?!" - everything sparkles: the shoujo filter (view), he turns to
 *   face you (frame 5) and finally aims: heart formations (16 roses in a heart flying at you,
 *   60 px/s), aimed 7-fans, sparkle rings of 20.
 * Enrage 14:30 (director). Death line (view): "...Who are you again?"
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, fan, ring, shoot } from "../enemies/_bullets";
import { EFX_CAST, efx, shock } from "../enemies/_fx";
import { cue } from "../enemies/_cue";
import { say } from "../enemies/_say";
import { minBossFeetY } from "./_entrance";
import { bossVisible, dawnOut, glide, hoverAnchor, lineAcross, OFF_WARP, offClock, Rain, segDist, TAU, warpTo } from "./_s23";

export const BS_ENTER = 0;
export const BS_DRIFT = 1;
export const BS_FLIP = 2;
export const BS_RAIN = 3;
export const BS_FANCLUB = 4;
export const BS_WIND_TELE = 5;
export const BS_WIND = 6;
export const BS_PHONE_TELE = 7;
export const BS_PHONE = 8;
export const BS_SPIRAL = 9;
export const BS_STORM = 10;
export const BS_HEART = 11;
export const BS_FAN7 = 12;
export const BS_RING = 13;
export const BS_FLOURISH = 14;

const P_FLIP = 0;
const P_RAIN = 1;
const P_FANCLUB = 2;
const P_WIND = 3;
const P_PHONE = 4;
const P_SPIRAL = 5;
const P_STORM = 6;
const P_HEART = 7;
const P_FAN7 = 8;
const P_RING = 9;
const CYCLES: readonly (readonly number[])[] = [
  [],
  [P_FLIP, P_RAIN, P_FLIP, P_FANCLUB, P_WIND],
  [P_PHONE, P_SPIRAL, P_STORM, P_FLIP, P_PHONE, P_RAIN, P_WIND, P_SPIRAL],
  [P_HEART, P_FAN7, P_RING, P_HEART, P_RING, P_FAN7, P_RAIN],
];

export const BS_P2 = 0.6;
export const BS_P3 = 0.25;
const ROSE = 15;
const BODY = 32;
/** Sprite height (the head must clear the top HUD). */
const SPRITE_H = 64;
const FLOURISH = 2.0;
const SAFE_ANGLE = (30 * Math.PI) / 180;
export const WIND_TELE = 0.6;
export const WIND_T = 1;
export const WIND_HALF = 22;
const WIND_PUSH = 60;
export const PHONE_TELE = 1.0;
export const PHONE_T = 1.2;
export const PHONE_ARC = (120 * Math.PI) / 180;
export const PHONE_LEN = 210;
const PHONE_DMG = 22;
const PHONE_W = 7;

/** Shoujo Academy cue kinds of the Bishounen (src/view/academy-fx.ts). */
export const SA_FLIP = "academy_flip";
export const SA_WIND = "academy_wind";
export const SA_PHONE = "academy_phone";
export const SA_NOTICED = "academy_noticed";
export const SA_HEART = "academy_heart";

export interface BishState {
  phase: number;
  pat: number;
  n: number;
  spin: number;
  dir: number;
  /** Phone glare: origin, start angle, sweep direction. Wind: lane y + push direction. */
  ox: number;
  oy: number;
  a0: number;
  laneY: number;
  push: number;
  drift: number;
  /** Seconds off screen (warp back between patterns). */
  off: number;
  readonly rain: Rain;
}

const STATE = new WeakMap<Enemy, BishState>();

export function bishState(e: Enemy): BishState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): BishState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, n: 0, spin: 0, dir: 1, ox: 0, oy: 0, a0: 0, laneY: 0, push: 1, drift: 0.6, off: 0, rain: new Rain(32) };
    STATE.set(e, s);
  }
  return s;
}

function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

export function bishBodyY(e: Enemy): number {
  return e.y - e.z - BODY;
}

/** Current phone-glare beam angle (view + hit test). */
export function phoneAngle(s: BishState, t: number): number {
  return s.a0 + s.dir * PHONE_ARC * Math.min(1, Math.max(0, t / PHONE_T));
}

const tmp = { x: 0, y: 0 };

function tempo(w: World): number {
  return w.director.enraged ? 0.8 : 1;
}
function speedMul(w: World): number {
  return w.director.enraged ? 1.15 : 1;
}

function post(e: Enemy, w: World, k: number): void {
  hoverAnchor(e, w, 96, 34, SPRITE_H, tmp);
  glide(e, tmp.x, tmp.y, e.speed * k);
}

function drift(e: Enemy, s: BishState, sec: number): void {
  go(e, BS_DRIFT);
  s.drift = sec;
}

/** A random direction at least `min` rad away from the player's direction (he never aims at you). */
function notAtYou(e: Enemy, w: World, min: number): number {
  const at = aimAt(w, e.x, bishBodyY(e));
  return at + (w.rng.next() < 0.5 ? 1 : -1) * w.rng.range(min, Math.PI);
}

/** A heart of 16 roses (parametric heart, ~46 px wide) flying at the player at 60 px/s. */
function heart(e: Enemy, w: World): void {
  const x0 = e.x;
  const y0 = bishBodyY(e) - 4;
  const a = aimAt(w, x0, y0);
  const sp = 60 * speedMul(w);
  const vx = Math.cos(a) * sp;
  const vy = Math.sin(a) * sp;
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * TAU;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const b = shoot(w, x0 + hx * 1.45, y0 + hy * 1.45, a, sp, ROSE, "eb_rose", 7);
    if (b) {
      b.vx = vx;
      b.vy = vy;
    }
  }
  cue(w, SA_HEART, x0, y0, vx, vy, 1, 0, e);
}

function nextPattern(e: Enemy, w: World, s: BishState): void {
  const cyc = CYCLES[s.phase];
  const p = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  const pl = w.player;
  const by = bishBodyY(e);
  switch (p) {
    case P_FLIP:
      go(e, BS_FLIP);
      s.a0 = notAtYou(e, w, SAFE_ANGLE);
      break;
    case P_RAIN:
      go(e, BS_RAIN);
      s.rain.start(24, 3, "eb_rose", ROSE, 2.5, 60 * speedMul(w), 80 * speedMul(w));
      efx(w, EFX_CAST, e.x, by - 10, 0, 0, 1.2, e);
      break;
    case P_FANCLUB:
      go(e, BS_FANCLUB);
      break;
    case P_WIND:
      go(e, BS_WIND_TELE);
      s.laneY = pl.y;
      s.push = w.rng.next() < 0.5 ? 1 : -1;
      w.telegraphLine(pl.x - w.viewW * 0.5 - 10, s.laneY, pl.x + w.viewW * 0.5 + 10, s.laneY, WIND_HALF, WIND_TELE, 0xffb8dc);
      cue(w, SA_WIND, pl.x, s.laneY, s.push, 0, WIND_TELE + WIND_T, 0, e);
      break;
    case P_PHONE: {
      go(e, BS_PHONE_TELE);
      s.ox = e.x;
      s.oy = e.y;
      // a 120 deg arc centred 35-90 deg off the player's direction: you are only "in the way" sometimes
      const at = Math.atan2(pl.y - e.y, pl.x - e.x);
      const side = w.rng.next() < 0.5 ? 1 : -1;
      const centre = at + side * w.rng.range((35 * Math.PI) / 180, Math.PI / 2);
      s.dir = w.rng.next() < 0.5 ? 1 : -1;
      s.a0 = centre - s.dir * PHONE_ARC * 0.5;
      const a1 = s.a0 + s.dir * PHONE_ARC;
      w.telegraphLine(s.ox, s.oy, s.ox + Math.cos(s.a0) * PHONE_LEN, s.oy + Math.sin(s.a0) * PHONE_LEN, PHONE_W, PHONE_TELE, 0xbafff6);
      w.telegraphLine(s.ox, s.oy, s.ox + Math.cos(a1) * PHONE_LEN, s.oy + Math.sin(a1) * PHONE_LEN, PHONE_W, PHONE_TELE, 0xbafff6);
      cue(w, SA_PHONE, s.ox, s.oy, s.a0, a1, PHONE_TELE, 0, e);
      break;
    }
    case P_SPIRAL:
      go(e, BS_SPIRAL);
      s.spin = w.rng.angle();
      s.dir = w.rng.next() < 0.5 ? 1 : -1;
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.4, e);
      break;
    case P_STORM:
      go(e, BS_STORM);
      s.spin = w.rng.angle();
      break;
    case P_HEART:
      go(e, BS_HEART);
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.6, e);
      break;
    case P_FAN7:
      go(e, BS_FAN7);
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.2, e);
      break;
    default:
      go(e, BS_RING);
      s.spin = w.rng.angle();
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.4, e);
  }
}

function startFlourish(e: Enemy, w: World, s: BishState, phase: number): void {
  s.phase = phase;
  s.pat = 0;
  s.rain.stop();
  go(e, BS_FLOURISH);
  e.inv = FLOURISH + 0.3;
  w.clearBullets();
  const title = phase === 2 ? "LOOKING AT HIS PHONE" : "...HE NOTICED YOU?!";
  const sub = phase === 2 ? "he's busy" : "everything sparkles";
  w.emit("bossPhase", { id: e.def.id, phase, x: e.x, y: e.y, title, subtitle: sub });
  say(w, e, phase === 2 ? "One moment." : "...Oh. Hello.");
  if (phase === 3) cue(w, SA_NOTICED, e.x, bishBodyY(e), 0, 0, 1, 0, e);
}

export const bishounen: EnemyDef = {
  id: "bishounen",
  name: "The Bishounen Who Never Notices You",
  sprite: "boss_bishounen",
  fps: 4,
  hp: 230000,
  speed: 36,
  dmg: 18,
  radius: 13,
  height: 46,
  xp: 0,
  shadow: 28,
  knockResist: 0.97,
  noSeparation: true,
  colors: [C.lavender, C.pinkLight, C.white, C.red, C.violet],
  boss: {
    title: "THE BISHOUNEN WHO NEVER NOTICES YOU",
    subtitle: "Fan Club: 9,999 Members (You Are Not One)",
    music: "final",
    final: true,
    level: 70,
  },
  // art: f0-1 hair sway (back turned), f2 hair flip, f3 phone, f4 wind pose, f5 FACING you (phase 3 only)
  frame(e) {
    const s = STATE.get(e);
    if ((s?.phase ?? 1) >= 3 && e.state !== BS_FLOURISH) return 5;
    switch (e.state) {
      case BS_FLIP:
        return e.timer >= 0.3 ? 2 : Math.floor(e.t * 2) & 1;
      case BS_PHONE_TELE:
      case BS_PHONE:
      case BS_FANCLUB:
      case BS_STORM:
        return 3;
      case BS_WIND_TELE:
      case BS_WIND:
      case BS_RAIN:
      case BS_SPIRAL:
        return 4;
      case BS_FLOURISH:
        return (s?.phase ?? 1) >= 3 && e.timer > 0.9 ? 5 : 3;
      default:
        return Math.floor(e.t * 2) & 1;
    }
  },
  init(e) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.rain.stop();
    go(e, BS_ENTER);
    e.inv = 3;
  },
  update(e, w, dt) {
    const s = st(e);
    const k = tempo(w);
    const sm = speedMul(w);
    e.timer += dt;
    s.rain.update(w, dt, 0.6, 0x2d1b45);
    if (e.state !== BS_ENTER && e.state !== BS_FLOURISH && e.state !== BS_PHONE) {
      const want = e.hp < e.maxHp * BS_P3 ? 3 : e.hp < e.maxHp * BS_P2 ? 2 : 1;
      if (want > s.phase) {
        startFlourish(e, w, s, s.phase + 1);
        return;
      }
    }
    const p = w.player;
    const by = bishBodyY(e);
    switch (e.state) {
      case BS_ENTER: {
        post(e, w, 1.5);
        const minY = minBossFeetY(w, SPRITE_H);
        if (e.y < minY + 2) e.vy = Math.max(e.vy, (minY + 2 - e.y) * 4);
        if (e.timer >= 1.3 && e.timer - dt < 1.3) say(w, e, "Nice weather.");
        const settled = Math.abs(e.vx) + Math.abs(e.vy) < 18 && bossVisible(e, w, -20);
        if ((settled && e.timer > 1.8) || e.timer > 3.2) {
          e.inv = 0;
          drift(e, s, 0.4);
        }
        break;
      }
      case BS_DRIFT:
        post(e, w, 1);
        s.off = offClock(e, w, s.off, dt);
        if (s.off > OFF_WARP) {
          // a dramatic entrance (with petals) back into view - he still hasn't noticed you
          s.off = 0;
          hoverAnchor(e, w, 96, 0, SPRITE_H, tmp);
          warpTo(e, w, tmp.x, tmp.y);
          cue(w, SA_FLIP, e.x, bishBodyY(e) - 14, 0, -1, 1, 0, e);
        }
        if (e.timer >= s.drift * k && bossVisible(e, w)) nextPattern(e, w, s);
        break;
      case BS_FLIP:
        post(e, w, 0.2);
        if (s.n === 0 && e.timer >= 0.4 * k) {
          s.n = 1;
          fan(w, e.x, by - 6, 9, s.a0, 0.16, 70 * sm, ROSE, "eb_rose", 10);
          cue(w, SA_FLIP, e.x, by - 14, Math.cos(s.a0), Math.sin(s.a0), 1, 0, e);
          e.sqV -= 6;
        }
        if (e.timer >= 0.9 * k) drift(e, s, 0.4);
        break;
      case BS_RAIN:
        post(e, w, 0.2);
        if (e.timer >= 3.4 && !s.rain.busy) drift(e, s, 0.4);
        else if (e.timer >= 5) drift(e, s, 0.4);
        break;
      case BS_FANCLUB:
        post(e, w, 0.3);
        if (s.n === 0 && e.timer >= 0.4) {
          s.n = 1;
          // two lines of 12 Love Letters straight through you ("they see you as competition")
          const a = w.rng.angle();
          lineAcross(w, "love_letter", 12, 85 * sm, a, p.x, p.y - 6);
          lineAcross(w, "love_letter", 12, 85 * sm, a + Math.PI * 0.5 + w.rng.spread(0.4), p.x, p.y - 6);
        }
        if (e.timer >= 1.4 * k) drift(e, s, 0.5);
        break;
      case BS_WIND_TELE:
        post(e, w, 0.2);
        if (e.timer >= WIND_TELE) go(e, BS_WIND);
        break;
      case BS_WIND:
        post(e, w, 0.2);
        // dramatic wind: shoves you along the lane (60 px over 1 s)
        if (Math.abs(p.y - s.laneY) < WIND_HALF + 4 && w.phase === "play") p.x += s.push * WIND_PUSH * dt;
        if (e.timer >= WIND_T) drift(e, s, 0.4);
        break;
      case BS_PHONE_TELE:
        e.vx = e.vy = 0;
        if (e.timer >= PHONE_TELE * Math.min(1, k + 0.1)) {
          go(e, BS_PHONE);
          shock(w, s.ox, s.oy - 30, 24, 0.3);
        }
        break;
      case BS_PHONE: {
        e.vx = e.vy = 0;
        const a = phoneAngle(s, e.timer);
        const reach = PHONE_W + CFG.playerRadius * w.stats.hitbox - 2;
        if (segDist(p.x, p.y, s.ox, s.oy, s.ox + Math.cos(a) * PHONE_LEN, s.oy + Math.sin(a) * PHONE_LEN) < reach) {
          w.hurtPlayer(PHONE_DMG, s.ox, s.oy, e.def.id);
        }
        if (e.timer >= PHONE_T) drift(e, s, 0.5);
        break;
      }
      case BS_SPIRAL: {
        post(e, w, 0.2);
        const every = 0.13 * k;
        s.spin += 1.7 * s.dir * dt;
        if (e.timer >= 0.3 && e.timer < 3.3 && e.timer >= 0.3 + s.n * every) {
          s.n++;
          for (let i = 0; i < 2; i++) {
            const a = s.spin + i * Math.PI;
            shoot(w, e.x + Math.cos(a) * 10, by + Math.sin(a) * 10, a, 62 * sm, ROSE, "eb_rose");
          }
        }
        if (e.timer >= 3.6) drift(e, s, 0.5);
        break;
      }
      case BS_STORM: {
        // the fan club storms in: 4 lines of 10 letters over 4 s, each from a new direction
        post(e, w, 0.2);
        if (s.n < 4 && e.timer >= s.n * 1.0) {
          s.spin += 1.9 + w.rng.spread(0.35);
          lineAcross(w, "love_letter", 10, 90 * sm, s.spin, p.x, p.y - 6, w.rng.spread(20));
          s.n++;
        }
        if (e.timer >= 4.4) drift(e, s, 0.5);
        break;
      }
      case BS_HEART:
        post(e, w, 0.2);
        if (s.n < 2 && e.timer >= 0.45 + s.n * 0.9 * k) {
          heart(e, w);
          s.n++;
          e.sqV -= 6;
        }
        if (s.n >= 2 && e.timer >= 0.45 + 1.8 * k) drift(e, s, 0.5);
        break;
      case BS_FAN7: {
        post(e, w, 0.3);
        const every = 0.45 * k;
        if (s.n < 3 && e.timer >= 0.35 + s.n * every) {
          fan(w, e.x, by, 7, aimAt(w, e.x, by), 0.2, 78 * sm, ROSE, "eb_rose", 10);
          s.n++;
          e.sqV -= 4;
        }
        if (s.n >= 3 && e.timer >= 0.35 + 3 * every + 0.3) drift(e, s, 0.5);
        break;
      }
      case BS_RING: {
        post(e, w, 0.3);
        const every = 0.6 * k;
        if (s.n < 3 && e.timer >= 0.4 + s.n * every) {
          ring(w, e.x, by, 20, s.spin + (s.n & 1) * (Math.PI / 20), 64 * sm, ROSE, "eb_rose", 10);
          s.n++;
          e.sqV -= 4;
        }
        if (s.n >= 3 && e.timer >= 0.4 + 3 * every + 0.3) drift(e, s, 0.5);
        break;
      }
      case BS_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer >= 1.0 && e.timer - dt < 1.0) {
          e.sqV += 12;
          shock(w, e.x, e.y, 90, 1);
        }
        if (e.timer >= FLOURISH) drift(e, s, 0.3);
        break;
      default:
        drift(e, s, 0.5);
    }
    // he glides by position (World would turn him to face his velocity): phases 1-2 he never
    // faces you, phase 3 he finally looks
    const mv = e.slow;
    e.x += e.vx * mv * dt;
    e.y += e.vy * mv * dt;
    e.vx = e.vy = 0;
    e.face = (p.x >= e.x ? 1 : -1) * (s.phase >= 3 ? 1 : -1);
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) s.rain.stop();
    dawnOut(e, w);
  },
};

export const bosses: EnemyDef[] = [bishounen];
