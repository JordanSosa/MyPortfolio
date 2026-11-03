/**
 * RIVAL-CHAN (The Final Arc 14:00 mid boss, docs/content/enemies.md §5.8).
 * "Your Rival Since Episode 1 (You Don't Remember Her)". She is drawn as a
 * dark recolour of the hero's OWN sprites at twice the size (the shounen
 * rival is always you, but cooler), with a headband whose long tails stream
 * behind her (the view): `e.skin` switches between the hero's idle / run /
 * cast / hurt animations per move.
 *
 *   P1 (100-60 %) "REMATCH!"
 *     Dash Slash   3 telegraphed dashes (0.5 s lanes, 360 px/s); each leaves a slash
 *                  line of 8 static eb_rival (1.2 s)
 *     Rival Beam   charge 0.8 s (the sweep's two edges telegraphed), then a beam
 *                  sweeping 60 deg over 1 s, 20 per 0.2 s
 *     Star Fans    3 aimed fans of 7 eb_rival (80 px/s)
 *   P2 (< 60 %) "I'VE BEEN TRAINING!" (she has a montage now): a flame aura, dashes x4,
 *     the beam sweeps 120 deg, 2-arm spiral rings. TRAINING MONTAGE (once, at the
 *     start): push-ups for 4 s - no attacks, x2 damage taken - then +20 % speed.
 *   P3 (< 25 %) "FINAL CLASH": Final Beam - a 2.0 s charge (x1.5 damage taken) behind a
 *     40 px lane that tracks the hero for 1.2 s, then locks; it fires for 1.5 s
 *     (40 per 0.2 s). Dash slashes between beams.
 *
 * Death: "Hmph... you've gotten stronger. I'll be back next season!!" - a smoke
 * bomb (view).
 */
import { C } from "../../art/palette";
import { TAU, clamp } from "../../core/math";
import { CFG } from "../config";
import type { Enemy, EnemyDef, Telegraph } from "../types";
import type { World } from "../world";
import { aimAt } from "../enemies/_bullets";
import { EFX_DASH, EFX_SKID, efx, shock } from "../enemies/_fx";
import { say } from "../enemies/_say";
import { BX_BEAM_CHARGE, BX_MONTAGE, BX_SLASH, cue } from "../enemies/_s45";
import { anchor, fanOf, go, heroInLane, phaseFlourish, readable, shot, steerTo } from "./_s45boss";

export const RV_ENTER = 0;
export const RV_DRIFT = 1;
export const RV_DASH_TELE = 2;
export const RV_DASH = 3;
export const RV_DASH_REC = 4;
export const RV_BEAM_TELE = 5;
export const RV_BEAM = 6;
export const RV_FANS = 7;
export const RV_SPIRAL = 8;
export const RV_MONTAGE = 9;
export const RV_FINAL_TELE = 10;
export const RV_FINAL = 11;
export const RV_FLOURISH = 12;

const P_DASH = 0;
const P_BEAM = 1;
const P_FANS = 2;
const P_SPIRAL = 3;
const P_FINAL = 4;
const CYCLES: readonly (readonly number[])[] = [[], [P_DASH, P_BEAM, P_FANS], [P_DASH, P_SPIRAL, P_BEAM, P_FANS], [P_FINAL, P_DASH, P_FINAL, P_FANS]];

export const RV_P2 = 0.6;
export const RV_P3 = 0.25;
/** Drawn at twice the hero's size. */
export const RIVAL_SCALE = 2;
export const RIVAL_TINT = 0x8a3d6e;
const TOP = 50;
const BODY_Y = 20;
export const DASH_TELE = 0.5;
export const DASH_SPEED = 360;
export const DASH_TIME = 0.38;
export const SLASH_LIFE = 1.2;
export const BEAM_LEN = 300;
export const BEAM_HALF = 7;
export const BEAM_TELE = 0.8;
export const BEAM_SWEEP = 1;
const BEAM_DMG = 20;
const BEAM_TICK = 0.2;
export const MONTAGE_T = 4;
export const FINAL_TELE = 2;
export const FINAL_TRACK = 1.2;
export const FINAL_FIRE = 1.5;
export const FINAL_HALF = 20;
const FINAL_DMG = 40;
const STAR = 15;

export interface RivalState {
  phase: number;
  pat: number;
  n: number;
  /** Dash / beam direction, beam sweep start angle + span. */
  dx: number;
  dy: number;
  ang: number;
  span: number;
  /** Current beam angle (view) and the next damage tick. */
  beam: number;
  tick: number;
  /** Dash start (slash line). */
  sx: number;
  sy: number;
  spin: number;
  montageDone: boolean;
  /** Trained: +20 % speed for the rest of the fight. */
  trained: boolean;
  /** The Final Beam's tracking telegraph (pooled: only touched while it is alive, within its life). */
  tg: Telegraph | null;
  /** Hero sprite prefix. */
  hero: string;
}

const STATE = new WeakMap<Enemy, RivalState>();

export function rivalState(e: Enemy): RivalState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): RivalState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, n: 0, dx: 1, dy: 0, ang: 0, span: 0, beam: 0, tick: 0, sx: 0, sy: 0, spin: 0, montageDone: false, trained: false, tg: null, hero: "hoshi" };
    STATE.set(e, s);
  }
  return s;
}

/** x2 damage during the montage, x1.5 while charging the Final Beam (one rule per world). */
const ruled = new WeakSet<World>();
function installRule(w: World): void {
  if (ruled.has(w)) return;
  ruled.add(w);
  w.dmgTaken.push((e) => {
    if (e.def !== rivalChan) return 1;
    if (e.state === RV_MONTAGE) return 2;
    if (e.state === RV_FINAL_TELE) return 1.5;
    return 1;
  });
}

function tempo(w: World, s: RivalState): number {
  return (s.trained ? 0.85 : 1) * (w.director.enraged ? 0.85 : 1);
}

/** Pick the animation (the hero's own) for her current move. */
function dress(e: Enemy, s: RivalState): void {
  let a = "idle";
  switch (e.state) {
    case RV_DASH:
    case RV_DASH_TELE:
    case RV_ENTER:
      a = "run";
      break;
    case RV_BEAM_TELE:
    case RV_BEAM:
    case RV_FANS:
    case RV_SPIRAL:
    case RV_FINAL_TELE:
    case RV_FINAL:
    case RV_FLOURISH:
      a = "cast";
      break;
    case RV_MONTAGE:
      a = "hurt";
      break;
    case RV_DASH_REC:
      a = "idle";
      break;
  }
  e.skin = `${s.hero}_${a}`;
}

function startDash(e: Enemy, w: World, s: RivalState): void {
  go(e, RV_DASH_TELE);
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  s.dx = dx / d;
  s.dy = dy / d;
  e.face = s.dx >= 0 ? 1 : -1;
  const len = DASH_SPEED * DASH_TIME + 10;
  w.telegraphLine(e.x, e.y - 8, e.x + s.dx * len, e.y - 8 + s.dy * len, e.r - 2, DASH_TELE * tempo(w, s), C.red);
}

function startBeam(e: Enemy, w: World, s: RivalState): void {
  go(e, RV_BEAM_TELE);
  const y = e.y - BODY_Y;
  const aim = aimAt(w, e.x, y);
  s.span = (s.phase >= 2 ? 120 : 60) * (Math.PI / 180);
  const dir = w.rng.next() < 0.5 ? -1 : 1;
  s.ang = aim - (s.span / 2) * dir;
  s.span *= dir;
  s.beam = s.ang;
  const t = BEAM_TELE * tempo(w, s);
  // both edges of the sweep
  w.telegraphLine(e.x, y, e.x + Math.cos(s.ang) * BEAM_LEN, y + Math.sin(s.ang) * BEAM_LEN, BEAM_HALF, t, C.orange);
  const a2 = s.ang + s.span;
  w.telegraphLine(e.x, y, e.x + Math.cos(a2) * BEAM_LEN, y + Math.sin(a2) * BEAM_LEN, BEAM_HALF, t, C.orange);
  cue(w, BX_BEAM_CHARGE, e.x, y, Math.cos(s.ang), Math.sin(s.ang), t, e);
}

function startFinal(e: Enemy, w: World, s: RivalState): void {
  go(e, RV_FINAL_TELE);
  const y = e.y - BODY_Y;
  s.beam = aimAt(w, e.x, y);
  s.tg = w.telegraphLine(e.x, y, e.x + Math.cos(s.beam) * BEAM_LEN, y + Math.sin(s.beam) * BEAM_LEN, FINAL_HALF, FINAL_TELE, C.red);
  cue(w, BX_BEAM_CHARGE, e.x, y, Math.cos(s.beam), Math.sin(s.beam), FINAL_TELE, e);
  say(w, e, "FINAL CLASH!");
}

function nextPattern(e: Enemy, w: World, s: RivalState): void {
  const cyc = CYCLES[s.phase];
  const pat = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  switch (pat) {
    case P_DASH:
      s.n = s.phase === 2 ? 4 : 3;
      startDash(e, w, s);
      break;
    case P_BEAM:
      startBeam(e, w, s);
      break;
    case P_FANS:
      go(e, RV_FANS);
      break;
    case P_SPIRAL:
      go(e, RV_SPIRAL);
      s.spin = w.rng.angle();
      break;
    default:
      startFinal(e, w, s);
  }
}

function drift(e: Enemy, _w: World, _s: RivalState): void {
  go(e, RV_DRIFT);
}

const tmp = { x: 0, y: 0 };

export const rivalChan: EnemyDef = {
  id: "rival_chan",
  name: "Rival-chan",
  // (re-skinned per move as the hero's own animations, see dress())
  sprite: "hoshi_idle",
  fps: 10,
  hp: 650000,
  speed: 70,
  dmg: 20,
  radius: 12,
  height: 40,
  xp: 0,
  shadow: 24,
  knockResist: 0.95,
  noSeparation: true,
  tint: RIVAL_TINT,
  colors: [C.red, C.orange, C.deep, C.yellow, C.white],
  boss: { title: "RIVAL-CHAN", subtitle: "Your Rival Since Episode 1 (You Don't Remember Her)", music: "boss", level: 68 },
  frame() {
    return -1;
  },
  init(e, w) {
    installRule(w);
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.montageDone = false;
    s.trained = false;
    s.tg = null;
    s.hero = w.hero.sprite;
    e.scale = RIVAL_SCALE;
    go(e, RV_ENTER);
    e.inv = 2.2;
    dress(e, s);
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    const k = tempo(w, s);
    e.timer += dt;

    // phase changes (never skipped)
    if (e.state === RV_DRIFT || e.state === RV_DASH_REC || e.state === RV_FANS || e.state === RV_SPIRAL) {
      const want = e.hp < e.maxHp * RV_P3 ? 3 : e.hp < e.maxHp * RV_P2 ? 2 : 1;
      if (want > s.phase) {
        s.phase++;
        s.pat = 0;
        go(e, RV_FLOURISH);
        if (s.phase === 2) phaseFlourish(e, w, 2, "I'VE BEEN TRAINING!", "she has a montage now", "MONTAGE TIME!");
        else phaseFlourish(e, w, 3, "FINAL CLASH", "the beams are about to meet", "FINAL CLASH!");
      }
    }

    switch (e.state) {
      case RV_ENTER: {
        anchor(e, w, 86, TOP, tmp);
        steerTo(e, tmp.x, tmp.y, e.speed * 2.2);
        if (e.timer > 1.8 && s.n === 0) {
          s.n = 1;
          say(w, e, "Remember me?!");
        }
        if (e.timer > 2.4) drift(e, w, s);
        break;
      }
      case RV_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer > 1.6) {
          if (s.phase === 2 && !s.montageDone) {
            s.montageDone = true;
            go(e, RV_MONTAGE);
            cue(w, BX_MONTAGE, e.x, e.y, 0, 0, MONTAGE_T, e);
          } else drift(e, w, s);
        }
        break;
      case RV_MONTAGE:
        // push-ups. No attacks. Hit her now.
        e.vx = e.vy = 0;
        if (e.timer >= MONTAGE_T) {
          s.trained = true;
          e.speed = e.def.speed * 1.2;
          shock(w, e.x, e.y - BODY_Y, 50, 0.6);
          drift(e, w, s);
        }
        break;
      case RV_DRIFT: {
        anchor(e, w, 86, TOP, tmp);
        const far = Math.abs(e.x - p.x) > w.viewW * 0.45 || Math.abs(e.y - p.y) > w.viewH * 0.45;
        steerTo(e, tmp.x, tmp.y, e.speed * (far ? 3 : 1.2));
        if (e.timer >= 0.9 * k && (readable(e, w, TOP, 24) || e.timer > 4)) nextPattern(e, w, s);
        break;
      }
      case RV_DASH_TELE:
        e.vx = -s.dx * 8;
        e.vy = -s.dy * 8;
        if (e.timer >= DASH_TELE * k) {
          go(e, RV_DASH);
          s.sx = e.x;
          s.sy = e.y;
          e.sqV += 8;
          efx(w, EFX_DASH, e.x, e.y, s.dx, s.dy, 2, e);
        }
        break;
      case RV_DASH:
        e.vx = s.dx * DASH_SPEED;
        e.vy = s.dy * DASH_SPEED;
        e.face = s.dx >= 0 ? 1 : -1;
        if (e.timer >= DASH_TIME) {
          go(e, RV_DASH_REC);
          efx(w, EFX_SKID, e.x, e.y, s.dx, s.dy, 2, e);
          // the slash line left behind: 8 static stars along the path
          for (let i = 0; i < 8; i++) {
            const f = (i + 0.5) / 8;
            const b = shot(w, s.sx + (e.x - s.sx) * f, s.sy - 10 + (e.y - s.sy) * f, 0, 0, STAR, "eb_rival", 0xffffff, SLASH_LIFE);
            if (b) b.vx = b.vy = 0;
          }
          cue(w, BX_SLASH, s.sx, s.sy - 10, e.x, e.y - 10, 1, e);
        }
        break;
      case RV_DASH_REC:
        e.vx = e.vy = 0;
        if (e.timer >= 0.32 * k) {
          s.n--;
          if (s.n > 0) startDash(e, w, s);
          else drift(e, w, s);
        }
        break;
      case RV_BEAM_TELE:
        e.vx = e.vy = 0;
        if (e.timer >= BEAM_TELE * k) {
          go(e, RV_BEAM);
          s.tick = 0;
          e.sqV += 6;
        }
        break;
      case RV_BEAM: {
        e.vx = e.vy = 0;
        const t = clamp(e.timer / BEAM_SWEEP, 0, 1);
        s.beam = s.ang + s.span * t;
        const y = e.y - BODY_Y;
        s.tick -= dt;
        if (s.tick <= 0 && heroInLane(w, e.x, y, e.x + Math.cos(s.beam) * BEAM_LEN, y + Math.sin(s.beam) * BEAM_LEN, BEAM_HALF + CFG.playerRadius - 2)) {
          s.tick = BEAM_TICK;
          w.hurtPlayer(BEAM_DMG, e.x, y, e.def.id);
        }
        if (e.timer >= BEAM_SWEEP + 0.15) drift(e, w, s);
        break;
      }
      case RV_FANS: {
        e.vx = e.vy = 0;
        const y = e.y - BODY_Y;
        if (s.n < 3 && e.timer >= (0.3 + s.n * 0.35) * k) {
          fanOf(w, e.x, y, 7, aimAt(w, e.x, y) + (s.n === 1 ? 0.1 : 0), 0.2, 80, STAR, "eb_rival", 0xffffff, 12);
          s.n++;
          e.sqV -= 4;
        }
        if (e.timer >= 1.6 * k) drift(e, w, s);
        break;
      }
      case RV_SPIRAL: {
        e.vx = e.vy = 0;
        const y = e.y - BODY_Y;
        const every = 0.1;
        while (s.n * every <= e.timer && e.timer < 2.5) {
          for (let a = 0; a < 2; a++) shot(w, e.x + Math.cos(s.spin + a * Math.PI) * 14, y + Math.sin(s.spin + a * Math.PI) * 14, s.spin + a * Math.PI, 62, STAR, "eb_rival");
          s.spin += 0.31;
          s.n++;
        }
        if (e.timer >= 2.9) drift(e, w, s);
        break;
      }
      case RV_FINAL_TELE: {
        e.vx = e.vy = 0;
        const y = e.y - BODY_Y;
        if (e.timer < FINAL_TRACK) {
          // the lane follows the hero, then locks
          const want = aimAt(w, e.x, y);
          let da = want - s.beam;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          s.beam += clamp(da, -1.6 * dt, 1.6 * dt);
        }
        const tg = s.tg;
        if (tg && !tg.dead && tg.age < tg.life) {
          tg.x = e.x;
          tg.y = y;
          tg.x2 = e.x + Math.cos(s.beam) * BEAM_LEN;
          tg.y2 = y + Math.sin(s.beam) * BEAM_LEN;
        }
        if (e.timer >= FINAL_TELE) {
          s.tg = null;
          go(e, RV_FINAL);
          s.tick = 0;
          e.sqV += 10;
          shock(w, e.x, y, 40, 0.8);
        }
        break;
      }
      case RV_FINAL: {
        e.vx = e.vy = 0;
        const y = e.y - BODY_Y;
        s.tick -= dt;
        if (s.tick <= 0 && heroInLane(w, e.x, y, e.x + Math.cos(s.beam) * BEAM_LEN, y + Math.sin(s.beam) * BEAM_LEN, FINAL_HALF)) {
          s.tick = BEAM_TICK;
          w.hurtPlayer(FINAL_DMG, e.x, y, e.def.id);
        }
        if (e.timer >= FINAL_FIRE) drift(e, w, s);
        break;
      }
      default:
        drift(e, w, s);
    }
    if (e.state === RV_BEAM_TELE || e.state === RV_BEAM || e.state === RV_FINAL_TELE || e.state === RV_FINAL) e.face = Math.cos(s.beam) >= 0 ? 1 : -1;
    dress(e, s);
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) s.tg = null;
    w.clearBullets();
  },
};

export const bosses: EnemyDef[] = [rivalChan];
