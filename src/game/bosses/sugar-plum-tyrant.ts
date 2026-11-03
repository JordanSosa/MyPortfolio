/**
 * SUGAR PLUM TYRANT (Candy Kingdom FINAL 11:00, enemies.md §5.2). Killing her = victory.
 * Name card: SUGAR PLUM TYRANT - Her Royal Hyperactivity. Floats like Lady Lunatic.
 *
 * P1 (100-60 %) "Royal Recital", cycle: Pirouette Spiral -> Royal Decree -> Sugar Coat -> Pirouette Teleport
 *   Pirouette Spiral    spins 3 s: a 4-arm spiral of eb_plum (62 px/s, turn 0.6, 15 dmg, 12 bullets/s)
 *   Royal Decree        scepter up, "BY ROYAL DECREE!": two lines of 8 Candy Corn Soldiers from
 *                       opposite sides
 *   Sugar Coat          3 aimed fans of 5 eb_plum (75 px/s), 0.5 s apart
 *   Pirouette Teleport  a 0.6 s destination circle, then a sparkle burst there
 * P2 (< 60 %) "SUGAR RUSH" - she's had nine desserts: the view runs hotter (+0.15 saturation), she
 *   moves 30 % faster, spirals become 6-arm, and Grand Jete: a leap across the screen on an arc
 *   (lane telegraphed 0.8 s) leaving 14 sugar crystals (static eb_plum, life 3 s).
 * P3 (< 25 %) "SUGAR CRASH" - what goes up...: SUGAR HIGH (5.5 s: rings of 20 eb_plum every 0.7 s,
 *   alternate offsets, 70 px/s) alternates with SUGAR CRASH (2.5 s: she slumps to the floor, Zzz,
 *   no attacks, +50 % damage taken). The crash is the reward for surviving the high.
 * Enrage 12:30 (director): everything 25 % faster (red tint in the view).
 * Death line (view): "My kingdom... for a glass of water..." - victory "SUGAR CRASH!".
 */
import { C } from "../../art/palette";
import { clamp } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, fan, ring, shoot } from "../enemies/_bullets";
import { EFX_CAST, EFX_TELE_IN, EFX_TELE_OUT, efx, shock } from "../enemies/_fx";
import { cue } from "../enemies/_cue";
import { say } from "../enemies/_say";
import { minBossFeetY } from "./_entrance";
import { bossVisible, dawnOut, glide, hoverAnchor, lineAcross, OFF_WARP, offClock, TAU, warpTo, wide } from "./_s23";

export const SP_ENTER = 0;
export const SP_DRIFT = 1;
export const SP_SPIRAL = 2;
export const SP_DECREE = 3;
export const SP_COAT = 4;
export const SP_TELE = 5;
export const SP_JETE_TELE = 6;
export const SP_JETE = 7;
export const SP_HIGH = 8;
export const SP_CRASH = 9;
export const SP_FLOURISH = 10;

const P_SPIRAL = 0;
const P_DECREE = 1;
const P_COAT = 2;
const P_TELE = 3;
const P_JETE = 4;
const CYCLES: readonly (readonly number[])[] = [
  [],
  [P_SPIRAL, P_DECREE, P_COAT, P_TELE],
  [P_SPIRAL, P_COAT, P_JETE, P_TELE, P_DECREE, P_SPIRAL, P_JETE, P_TELE],
];

export const SP_P2 = 0.6;
export const SP_P3 = 0.25;
/** Damage of the Tyrant's plums. */
const SHOT = 15;
const BODY = 30;
/** Sprite height (the head must clear the top HUD). */
const SPRITE_H = 64;
const HOVER = 80;
const FLOURISH = 1.9;
const SPIRAL_T = 3;
const TELE_T = 0.6;
export const JETE_TELE = 0.8;
const JETE_T = 0.95;
const CRYSTALS = 14;
export const HIGH_T = 5.5;
export const CRASH_T = 2.5;
/** Damage taken while crashed. */
export const CRASH_TAKEN = 1.5;

/** Candy Kingdom cue kinds of the Tyrant (src/view/candy-fx.ts). */
export const CK_PIROUETTE = "candy_pirouette";
export const CK_DECREE = "candy_decree";
export const CK_JETE = "candy_jete";
export const CK_CRASH = "candy_crash";
export const CK_HIGH = "candy_high";

export interface TyrantState {
  phase: number;
  pat: number;
  n: number;
  spin: number;
  dir: number;
  /** Teleport / jete destination. */
  tx: number;
  ty: number;
  /** Jete start (for the arc). */
  sx: number;
  sy: number;
  drift: number;
  /** P3: highs completed. */
  highs: number;
  /** Seconds off screen (warp back between patterns). */
  off: number;
}

const STATE = new WeakMap<Enemy, TyrantState>();
const installed = new WeakSet<World>();

export function tyrantState(e: Enemy): TyrantState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): TyrantState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, n: 0, spin: 0, dir: 1, tx: 0, ty: 0, sx: 0, sy: 0, drift: 0.5, highs: 0, off: 0 };
    STATE.set(e, s);
  }
  return s;
}

function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

/** Pattern pace (x duration): 25 % faster enraged, a little quicker in the rush. */
function tempo(w: World, s: TyrantState): number {
  return (w.director.enraged ? 0.8 : 1) * (s.phase >= 2 ? 0.92 : 1);
}
function speedMul(w: World): number {
  return w.director.enraged ? 1.15 : 1;
}

export function tyrantBodyY(e: Enemy): number {
  return e.y - e.z - BODY;
}

const tmp = { x: 0, y: 0 };

function hover(e: Enemy, w: World, s: TyrantState, k: number): void {
  hoverAnchor(e, w, HOVER, 40, SPRITE_H + e.z, tmp);
  glide(e, tmp.x, tmp.y, e.speed * k * (s.phase >= 2 ? 1.3 : 1));
}

function drift(e: Enemy, s: TyrantState, sec: number): void {
  go(e, SP_DRIFT);
  s.drift = sec;
}

/** A teleport spot around the player: upper arc on portrait, beside on landscape; on screen, not too close. */
function teleSpot(e: Enemy, w: World, out: { x: number; y: number }): void {
  const p = w.player;
  const hw = w.viewW * 0.5 - 26;
  const top = minBossFeetY(w, SPRITE_H + 10);
  for (let tries = 0; tries < 8; tries++) {
    if (wide(w)) {
      const side = w.rng.next() < 0.75 ? -1 : 1;
      out.x = clamp(p.x + side * w.rng.range(80, 120), p.x - hw, p.x + hw);
      out.y = Math.max(top, p.y + w.rng.range(-30, 6));
    } else {
      const a = -Math.PI / 2 + w.rng.range(-1.1, 1.1);
      const d = w.rng.range(76, 96);
      out.x = clamp(p.x + Math.cos(a) * d, p.x - hw, p.x + hw);
      out.y = Math.max(top, p.y + Math.sin(a) * d);
    }
    const mx = out.x - e.x;
    const my = out.y - e.y;
    const px = out.x - p.x;
    const py = out.y - p.y;
    if (mx * mx + my * my > 50 * 50 && px * px + py * py > 60 * 60) return;
  }
}

function nextPattern(e: Enemy, w: World, s: TyrantState): void {
  if (s.phase >= 3) {
    // P3: SUGAR HIGH, then the crash
    go(e, SP_HIGH);
    s.n = 0;
    s.spin = w.rng.angle();
    cue(w, CK_HIGH, e.x, tyrantBodyY(e), 0, 0, HIGH_T, 0, e);
    return;
  }
  const cyc = CYCLES[s.phase];
  const p = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  const by = tyrantBodyY(e);
  switch (p) {
    case P_SPIRAL:
      go(e, SP_SPIRAL);
      s.spin = w.rng.angle();
      s.dir = -s.dir;
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.6, e);
      cue(w, CK_PIROUETTE, e.x, by, 0, 0, SPIRAL_T, s.phase >= 2 ? 6 : 4, e);
      break;
    case P_DECREE:
      go(e, SP_DECREE);
      efx(w, EFX_CAST, e.x, by - 12, 0, 0, 1.2, e);
      break;
    case P_COAT:
      go(e, SP_COAT);
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.2, e);
      break;
    case P_TELE:
      go(e, SP_TELE);
      teleSpot(e, w, tmp);
      s.tx = tmp.x;
      s.ty = tmp.y;
      w.telegraphCircle(s.tx, s.ty, 16, TELE_T, 0xb47cff);
      e.inv = TELE_T + 0.3;
      break;
    default: {
      // Grand Jete: across the player to the mirrored spot (on screen), a lane on the ground first
      go(e, SP_JETE_TELE);
      const pl = w.player;
      const hw = w.viewW * 0.5 - 24;
      const top = minBossFeetY(w, SPRITE_H + 10);
      s.sx = e.x;
      s.sy = e.y;
      s.tx = clamp(pl.x - (e.x - pl.x), pl.x - hw, pl.x + hw);
      s.ty = Math.max(top, Math.min(pl.y + w.viewH * 0.5 - 30, pl.y - (e.y - pl.y) * 0.4 + 20));
      if (Math.abs(s.tx - e.x) < 70) s.tx = clamp(e.x + (e.x < pl.x ? 1 : -1) * 110, pl.x - hw, pl.x + hw);
      w.telegraphLine(s.sx, s.sy, s.tx, s.ty, 9, JETE_TELE, 0xb47cff);
      efx(w, EFX_CAST, e.x, by, 0, 0, 1.4, e);
    }
  }
}

function startFlourish(e: Enemy, w: World, s: TyrantState, phase: number): void {
  s.phase = phase;
  s.pat = 0;
  s.highs = 0;
  go(e, SP_FLOURISH);
  e.inv = FLOURISH + 0.3;
  e.alpha = 1;
  w.clearBullets();
  const title = phase === 2 ? "SUGAR RUSH" : "SUGAR CRASH";
  const sub = phase === 2 ? "she's had nine desserts" : "what goes up...";
  w.emit("bossPhase", { id: e.def.id, phase, x: e.x, y: e.y, title, subtitle: sub });
  say(w, e, phase === 2 ? "MORE DESSERT!" : "...so... sleepy...");
}

export const sugarPlumTyrant: EnemyDef = {
  id: "sugar_plum_tyrant",
  name: "Sugar Plum Tyrant",
  sprite: "boss_sugarplum",
  fps: 5,
  hp: 90000,
  speed: 44,
  dmg: 18,
  radius: 14,
  height: 46,
  xp: 0,
  shadow: 30,
  knockResist: 0.95,
  noSeparation: true,
  colors: [C.violet, C.pink, C.pinkLight, C.paleYellow, C.white],
  boss: { title: "SUGAR PLUM TYRANT", subtitle: "Her Royal Hyperactivity", music: "final", final: true, level: 60 },
  // art: f0-1 float, f2 cast (scepter up), f3 pirouette (blurred skirt), f4 laugh, f5 crashed
  frame(e) {
    switch (e.state) {
      case SP_SPIRAL:
      case SP_TELE:
      case SP_JETE:
        return 3;
      case SP_DECREE:
      case SP_COAT:
      case SP_JETE_TELE:
        return 2;
      case SP_HIGH:
        return Math.floor(e.t * 8) & 1 ? 3 : 4;
      case SP_CRASH:
        return 5;
      case SP_FLOURISH:
      case SP_ENTER:
        return 4;
      default:
        return Math.floor(e.t * 3) & 1;
    }
  },
  init(e, w) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.dir = 1;
    s.highs = 0;
    go(e, SP_ENTER);
    e.inv = 3;
    e.z = 40;
    if (!installed.has(w)) {
      installed.add(w);
      // SUGAR CRASH: +50 % damage taken while she naps
      w.dmgTaken.push((o) => (o.def.id === "sugar_plum_tyrant" && o.state === SP_CRASH ? CRASH_TAKEN : 1));
    }
  },
  update(e, w, dt) {
    const s = st(e);
    const k = tempo(w, s);
    const sm = speedMul(w);
    e.timer += dt;
    if (e.state !== SP_ENTER && e.state !== SP_FLOURISH && e.state !== SP_CRASH) e.z = 8 + Math.sin(e.t * 2.2) * 3;

    // phase changes (never skipped)
    if (e.state !== SP_ENTER && e.state !== SP_FLOURISH && e.state !== SP_JETE && e.state !== SP_TELE) {
      const want = e.hp < e.maxHp * SP_P3 ? 3 : e.hp < e.maxHp * SP_P2 ? 2 : 1;
      if (want > s.phase) {
        startFlourish(e, w, s, s.phase + 1);
        return;
      }
    }
    const by = tyrantBodyY(e);
    switch (e.state) {
      case SP_ENTER: {
        hover(e, w, s, 1.6);
        e.z = Math.max(8, e.z - dt * 40);
        const minY = minBossFeetY(w, SPRITE_H + e.z);
        if (e.y < minY + 2) e.vy = Math.max(e.vy, (minY + 2 - e.y) * 4);
        if (e.timer >= 1.2 && e.timer - dt < 1.2) say(w, e, "Bow to the sugar!");
        const settled = Math.abs(e.vx) + Math.abs(e.vy) < 18 && bossVisible(e, w, -20);
        if ((settled && e.timer > 1.6) || e.timer > 3) {
          e.inv = 0;
          drift(e, s, 0.4);
        }
        break;
      }
      case SP_DRIFT:
        hover(e, w, s, 1);
        s.off = offClock(e, w, s.off, dt);
        if (s.off > OFF_WARP) {
          // left behind: a pirouette back into view
          s.off = 0;
          hoverAnchor(e, w, HOVER, 0, SPRITE_H + e.z, tmp);
          warpTo(e, w, tmp.x, tmp.y);
        }
        if (e.timer >= s.drift * k && bossVisible(e, w)) nextPattern(e, w, s);
        break;
      case SP_SPIRAL: {
        // a pirouette: 3 shots per arm per second, curving arms (turn 0.6)
        hover(e, w, s, 0.25);
        const arms = s.phase >= 2 ? 6 : 4;
        const every = (1 / 3) * k;
        s.spin += 1.5 * s.dir * dt;
        if (e.timer >= 0.35 && e.timer >= 0.35 + s.n * every && e.timer < 0.35 + SPIRAL_T * k) {
          s.n++;
          for (let i = 0; i < arms; i++) {
            const a = s.spin + (i / arms) * TAU;
            const b = shoot(w, e.x + Math.cos(a) * 10, by + Math.sin(a) * 10, a, 62 * sm, SHOT, "eb_plum");
            if (b) b.turn = 0.6 * s.dir;
          }
        }
        if (e.timer >= 0.35 + SPIRAL_T * k + 0.4) drift(e, s, 0.6);
        break;
      }
      case SP_DECREE: {
        hover(e, w, s, 0.3);
        if (s.n === 0 && e.timer >= 0.45) {
          s.n = 1;
          const pl = w.player;
          // two walls of 8 marching in from the left and the right, either side of the player
          const a = (w.rng.next() < 0.5 ? 0 : Math.PI) + w.rng.spread(0.25);
          lineAcross(w, "candy_corn", 8, 60, a, pl.x, pl.y, -18);
          lineAcross(w, "candy_corn", 8, 60, a + Math.PI, pl.x, pl.y, -18);
          w.emit("waveIncoming", { kind: "swarm", x: e.x, y: by, label: "BY ROYAL DECREE!" });
          cue(w, CK_DECREE, e.x, by - 16, 0, 0, 1, 0, e);
          e.sqV += 8;
        }
        if (e.timer >= 1.4 * k) drift(e, s, 0.5);
        break;
      }
      case SP_COAT: {
        hover(e, w, s, 0.3);
        const every = 0.5 * k;
        if (s.n < 3 && e.timer >= 0.35 + s.n * every) {
          fan(w, e.x, by, 5, aimAt(w, e.x, by), 0.24, 75 * sm, SHOT, "eb_plum", 10);
          s.n++;
          e.sqV -= 4;
        }
        if (s.n >= 3 && e.timer >= 0.35 + 3 * every + 0.3) drift(e, s, 0.5);
        break;
      }
      case SP_TELE: {
        // pirouette in place, vanish, reappear in a sparkle burst
        e.vx = e.vy = 0;
        if (s.n === 0 && e.timer >= TELE_T - 0.2) {
          s.n = 1;
          efx(w, EFX_TELE_OUT, e.x, by, 0, 0, 1, e);
        }
        e.alpha = e.timer < TELE_T - 0.2 ? 1 : Math.max(0, 1 - (e.timer - (TELE_T - 0.2)) / 0.2);
        if (e.timer >= TELE_T) {
          e.x = s.tx;
          e.y = s.ty;
          e.alpha = 1;
          e.inv = 0.2;
          efx(w, EFX_TELE_IN, e.x, tyrantBodyY(e), 0, 0, 1.2, e);
          shock(w, e.x, e.y, 40, 0.3);
          drift(e, s, 0.45);
        }
        break;
      }
      case SP_JETE_TELE:
        e.vx = e.vy = 0;
        if (e.timer >= JETE_TELE * Math.min(1, k + 0.1)) {
          go(e, SP_JETE);
          s.n = 0;
          e.inv = 0;
          cue(w, CK_JETE, s.sx, s.sy, s.tx, s.ty, JETE_T, 0, e);
        }
        break;
      case SP_JETE: {
        // the leap: an arc over the lane, crystals left along it
        const t = Math.min(1, e.timer / JETE_T);
        const x = s.sx + (s.tx - s.sx) * t;
        const y = s.sy + (s.ty - s.sy) * t;
        e.vx = (x - e.x) / Math.max(dt, 1e-4);
        e.vy = (y - e.y) / Math.max(dt, 1e-4);
        e.z = 8 + Math.sin(t * Math.PI) * 46;
        while (s.n < CRYSTALS && t >= (s.n + 0.5) / CRYSTALS) {
          const u = (s.n + 0.5) / CRYSTALS;
          const b = shoot(w, s.sx + (s.tx - s.sx) * u, s.sy + (s.ty - s.sy) * u - 8, 0, 0, SHOT, "eb_plum", 3);
          if (b) b.r = 3;
          s.n++;
        }
        if (t >= 1) {
          e.vx = e.vy = 0;
          e.x = s.tx;
          e.y = s.ty;
          e.sqV -= 10;
          shock(w, e.x, e.y, 46, 0.5);
          drift(e, s, 0.5);
        }
        break;
      }
      case SP_HIGH: {
        // SUGAR HIGH: rings of 20 every 0.7 s, alternate offsets
        hover(e, w, s, 0.4);
        const every = 0.7 * k;
        if (e.timer >= 0.3 + s.n * every && e.timer < HIGH_T) {
          const off = (s.n & 1) * (Math.PI / 20);
          ring(w, e.x, by, 20, s.spin + off, 70 * sm, SHOT, "eb_plum", 10);
          s.n++;
          e.sqV -= 4;
        }
        if (e.timer >= HIGH_T) {
          // ...and the crash
          go(e, SP_CRASH);
          s.highs++;
          e.vx = e.vy = 0;
          cue(w, CK_CRASH, e.x, by, 0, 0, CRASH_T, 0, e);
          shock(w, e.x, e.y, 40, 0.4);
          say(w, e, "...zzz...", false);
        }
        break;
      }
      case SP_CRASH: {
        e.vx = e.vy = 0;
        e.z = Math.max(0, e.z - dt * 60);
        if (e.timer >= CRASH_T * (w.director.enraged ? 0.85 : 1)) {
          e.sqV += 10;
          // back up (and back into view) before the next high
          drift(e, s, 0.3);
        }
        break;
      }
      case SP_FLOURISH: {
        e.vx = e.vy = 0;
        const t = e.timer / FLOURISH;
        e.z = 8 + Math.sin(Math.min(1, t) * Math.PI) * 16;
        if (e.timer >= 1.0 && e.timer - dt < 1.0) {
          e.sqV += 12;
          shock(w, e.x, e.y, 90, 1);
        }
        if (e.timer >= FLOURISH) drift(e, s, 0.3);
        break;
      }
      default:
        drift(e, s, 0.5);
    }
    // she faces the player while hovering in place (World turns her with her velocity otherwise)
    if (e.state !== SP_SPIRAL && e.state !== SP_JETE && Math.abs(e.vx) < 1.5) e.face = w.player.x >= e.x ? 1 : -1;
  },
  onDeath(e, w) {
    dawnOut(e, w);
  },
};

export const bosses: EnemyDef[] = [sugarPlumTyrant];
