/**
 * LADY LUNATIC (9:00 final boss, DESIGN §3.5). Killing her = VICTORY.
 *
 * She floats above the player (portrait screens have the most room there)
 * and teleports between patterns in a burst of sparkles.
 *   P1 (100-60 %)  rotating eb_moon spirals, aimed fan volleys
 *   P2 (< 60 %)    + an orbiting ring of moons that breathes in and out
 *                  around her, starfall rows (falling stars with a lane),
 *                  summons bats
 *   P3 (< 25 %)    "LUNATIC MOON": the screen dims (view), radial bullet
 *                  flowers, faster teleports
 * Each phase change is an invulnerable flourish (bullets cleared, banner,
 * shockwave, music duck). At 10:30 the director enrages her: everything is
 * faster and a little denser (red tint in the view).
 *
 * Fairness rules (phone portrait): bullets 60-90 px/s, never spawned within
 * SAFE_SPAWN of the player (see _bullets.ts), every pattern keeps >= 15 px
 * lanes at the distances she fights from, and she always telegraphs with a
 * cast pose (frame 2) before a volley.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import { minBossFeetY } from "./_entrance";
import { TAU, clamp } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, B_MOON, B_ORB, B_STAR, fan, ring, shoot } from "../enemies/_bullets";
import { EFX_CAST, EFX_SUMMON, EFX_TELE_IN, EFX_TELE_OUT, efx, onScreen, shock } from "../enemies/_fx";
import { dawnOut } from "./_dawn";
import { LL_BODY, LUNA_RING_N, lunaBodyY, lunaRing, lunaState, lunaStateOf as st, type LunaState } from "./_luna";

// (ring geometry + per-boss state live in ./_luna so the bot / view can read them without import cycles)
export { LL_BODY, LUNA_RING_N, lunaBodyY, lunaRing, lunaState, type LunaState };

export const LL_ENTER = 0;
export const LL_DRIFT = 1;
export const LL_TELE_OUT = 2;
export const LL_TELE_IN = 3;
export const LL_SPIRAL = 4;
export const LL_FANS = 5;
export const LL_BATS = 6;
export const LL_FLOWER = 7;
export const LL_STARFALL = 8;
export const LL_FLOURISH = 9;

const P_TELE = 0;
const P_SPIRAL = 1;
const P_FANS = 2;
const P_BATS = 3;
const P_FLOWER = 4;
const P_STARFALL = 5;
/** Pattern cycle per phase (index = phase). */
const CYCLES: readonly (readonly number[])[] = [
  [],
  [P_SPIRAL, P_FANS, P_TELE, P_FANS, P_SPIRAL, P_TELE],
  [P_FANS, P_SPIRAL, P_TELE, P_BATS, P_STARFALL, P_TELE, P_FANS, P_TELE],
  [P_FLOWER, P_TELE, P_FANS, P_FLOWER, P_TELE, P_STARFALL, P_TELE, P_FLOWER, P_SPIRAL, P_TELE],
];

export const LL_P2 = 0.6;
export const LL_P3 = 0.25;
const FLOURISH = 1.9;
/** Damage of every Lady Lunatic bullet (the final exam: each hit really costs). */
const SHOT = 15;
const HOVER = 76;

function tempo(w: World, s: LunaState): number {
  return (w.director.enraged ? 0.78 : 1) * (s.phase >= 3 ? 0.9 : 1);
}
function speedMul(w: World): number {
  return w.director.enraged ? 1.1 : 1;
}
function extra(w: World): number {
  return w.director.enraged ? 1 : 0;
}

function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

const tmp = { x: 0, y: 0 };

/**
 * Float toward the hover anchor at `k` x her speed: above the player on
 * portrait screens, off to the side (swapping slowly) on wide landscape ones
 * where there is little room above.
 */
function hover(e: Enemy, w: World, k: number): void {
  const p = w.player;
  let tx: number;
  let ty: number;
  if (w.viewW > w.viewH * 1.2) {
    // stays on her current side (she only switches sides by teleporting, never by gliding through the player);
    // teleports favour the left: the DASH / OVERDRIVE buttons cover the bottom-right of a landscape phone
    // (entering straight down from above the player counts as the left side)
    const side = e.x > p.x + 2 ? 1 : -1;
    tx = p.x + side * Math.min(96, w.viewW * 0.24);
    // (never so high that the top HUD covers her head)
    ty = Math.max(minBossFeetY(w, e.cy * 2 + 6), p.y - 18 + Math.sin(e.t * 0.6) * 14);
  } else {
    tx = p.x + Math.sin(e.t * 0.6) * 36;
    ty = p.y - Math.min(HOVER, w.viewH * 0.5 - 70);
  }
  const dx = tx - e.x;
  const dy = ty - e.y;
  const max = e.speed * k;
  e.vx = clamp(dx * 2, -max, max);
  e.vy = clamp(dy * 2, -max, max);
}

/** Pick a teleport destination around the player: upper arc (any side in P3), on screen, not too close. */
function teleTarget(e: Enemy, w: World, s: LunaState, out: { x: number; y: number }): void {
  const p = w.player;
  const spread = s.phase >= 3 ? 1.7 : 1.05;
  const hw = w.viewW * 0.5 - 28;
  // feet low enough that her whole 64 px sprite (+ flourish rise) clears the top HUD
  const top = p.y - w.viewH * 0.5 + 104;
  const wide = w.viewW > w.viewH * 1.2;
  for (let tries = 0; tries < 8; tries++) {
    if (wide) {
      // landscape: little room above - appear beside the player (mostly left, away from the touch buttons)
      const side = w.rng.next() < 0.8 ? -1 : 1;
      out.x = clamp(p.x + side * w.rng.range(80, 120), p.x - hw, p.x + hw);
      out.y = Math.max(top, p.y + w.rng.range(-34, 6));
    } else {
      const a = -Math.PI / 2 + w.rng.range(-spread, spread);
      const d = w.rng.range(78, 94);
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

function nextPattern(e: Enemy, w: World, s: LunaState): void {
  const cyc = CYCLES[s.phase];
  const p = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  switch (p) {
    case P_TELE:
      go(e, LL_TELE_OUT);
      e.inv = 0.6;
      efx(w, EFX_TELE_OUT, e.x, lunaBodyY(e), 0, 0, 1, e);
      break;
    case P_SPIRAL:
      go(e, LL_SPIRAL);
      s.spin = w.rng.angle();
      s.dir = -s.dir;
      efx(w, EFX_CAST, e.x, lunaBodyY(e), 0, 0, 1.6, e);
      break;
    case P_FANS:
      go(e, LL_FANS);
      efx(w, EFX_CAST, e.x, lunaBodyY(e), 0, 0, 1.2, e);
      break;
    case P_BATS:
      go(e, LL_BATS);
      break;
    case P_FLOWER:
      go(e, LL_FLOWER);
      s.spin = w.rng.angle();
      efx(w, EFX_CAST, e.x, lunaBodyY(e), 0, 0, 2.2, e);
      break;
    default: {
      go(e, LL_STARFALL);
      const cols = starCols(w);
      // the first lane opens right above the player
      s.gap = clamp(Math.round((cols - 2) / 2), 1, cols - 3);
      efx(w, EFX_CAST, e.x, lunaBodyY(e), 0, 0, 1.6, e);
    }
  }
}

function drift(e: Enemy, s: LunaState, sec: number): void {
  go(e, LL_DRIFT);
  s.drift = sec;
}

const STAR_GAP = 22;
function starCols(w: World): number {
  return Math.ceil((w.viewW + 30) / STAR_GAP) | 0;
}

function startFlourish(e: Enemy, w: World, s: LunaState, phase: number): void {
  s.phase = phase;
  s.pat = 0;
  go(e, LL_FLOURISH);
  e.inv = FLOURISH + 0.3;
  e.alpha = 1;
  w.clearBullets();
  if (phase === 3 && s.ringT >= 0) s.ringOut = 0.6;
  const title = phase === 2 ? "MOONLIT WALTZ" : "LUNATIC MOON";
  const sub = phase === 2 ? "the moons begin to dance" : "the night bares its fangs";
  w.emit("bossPhase", { id: e.def.id, phase, x: e.x, y: e.y, title, subtitle: sub });
}

export const ladyLunatic: EnemyDef = {
  id: "lady_lunatic",
  name: "Lady Lunatic",
  sprite: "boss_lunatic",
  fps: 5,
  hp: 82000,
  speed: 42,
  dmg: 15,
  radius: 13,
  height: 60,
  xp: 0,
  shadow: 26,
  knockResist: 1,
  noSeparation: true,
  colors: [C.lavender, C.paleYellow, C.navy, C.violet, C.white],
  boss: { title: "LADY LUNATIC", subtitle: "Queen of the Endless Night", music: "final", final: true, level: 52 },
  // art: f0-1 float, f2 cast (arms out), f3 laugh
  frame(e) {
    switch (e.state) {
      case LL_SPIRAL:
      case LL_FANS:
      case LL_FLOWER:
      case LL_STARFALL:
        return 2;
      case LL_BATS:
      case LL_FLOURISH:
        return 3;
      default:
        return Math.floor(e.t * 3) & 1;
    }
  },
  init(e) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.dir = 1;
    s.ringT = -1;
    s.ringOut = 0;
    go(e, LL_ENTER);
    e.inv = 3;
    e.z = 40;
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    const k = tempo(w, s);
    const sm = speedMul(w);
    e.timer += dt;
    if (e.state !== LL_ENTER && e.state !== LL_FLOURISH) e.z = 6 + Math.sin(e.t * 1.8) * 3;

    // phase changes (never skipped: a huge hit from P1 still plays P2's flourish first)
    if (e.state !== LL_ENTER && e.state !== LL_FLOURISH) {
      const want = e.hp < e.maxHp * LL_P3 ? 3 : e.hp < e.maxHp * LL_P2 ? 2 : 1;
      if (want > s.phase) startFlourish(e, w, s, s.phase + 1);
    }

    // P2 orbiting moon ring: grows, breathes, fades out when P3 starts
    if (s.ringT >= 0) {
      s.ringT += dt;
      if (s.ringOut > 0) {
        s.ringOut -= dt;
        if (s.ringOut <= 0) s.ringT = -1;
      }
      if (e.alpha > 0.5 && !w.invulnerable) {
        const pcy = p.y - CFG.playerCy;
        const rr = 3 + CFG.playerRadius - 2;
        for (let i = 0; i < LUNA_RING_N; i++) {
          if (!lunaRing(e, i, tmp)) break;
          const dx = tmp.x - p.x;
          const dy = tmp.y - pcy;
          if (dx * dx + dy * dy < rr * rr) {
            w.hurtPlayer(12, tmp.x, tmp.y);
            break;
          }
        }
      }
    }

    switch (e.state) {
      case LL_ENTER: {
        // glide down from the top of the screen (spawned just under the HUD: Director.spawnBoss),
        // her head kept clear of the HUD while she settles
        hover(e, w, 1.6);
        e.z = Math.max(6, e.z - dt * 40);
        const minY = minBossFeetY(w, e.cy * 2 + e.z);
        if (e.y < minY + 2) e.vy = Math.max(e.vy, (minY + 2 - e.y) * 4);
        // arrived once she is on screen and has (nearly) stopped gliding
        const settled = Math.abs(e.vx) + Math.abs(e.vy) < 18 && onScreen(w, e.x, lunaBodyY(e), -20);
        if ((settled && e.timer > 1.2) || e.timer > 2.8) {
          e.inv = 0;
          drift(e, s, 0.4);
        }
        break;
      }
      case LL_DRIFT:
        hover(e, w, 1);
        e.alpha = Math.min(1, e.alpha + dt * 4);
        if (e.timer >= s.drift * k) nextPattern(e, w, s);
        break;
      case LL_TELE_OUT: {
        e.vx = e.vy = 0;
        const T = s.phase >= 3 ? 0.2 : 0.32;
        e.alpha = Math.max(0, 1 - e.timer / T);
        if (e.timer >= T) {
          teleTarget(e, w, s, tmp);
          e.x = tmp.x;
          e.y = tmp.y;
          go(e, LL_TELE_IN);
          e.inv = 0.25;
          efx(w, EFX_TELE_IN, e.x, lunaBodyY(e), 0, 0, 1, e);
        }
        break;
      }
      case LL_TELE_IN: {
        e.vx = e.vy = 0;
        const T = s.phase >= 3 ? 0.18 : 0.28;
        e.alpha = Math.min(1, e.timer / T);
        if (e.timer >= T) {
          e.alpha = 1;
          drift(e, s, s.phase >= 3 ? 0.25 : 0.45);
        }
        break;
      }
      case LL_SPIRAL: {
        hover(e, w, 0.3);
        const arms = (s.phase >= 2 ? 5 : 4) + extra(w);
        const every = 0.26 * k;
        s.spin += 0.8 * s.dir * dt;
        if (e.timer >= 0.4 && e.timer >= 0.4 + s.n * every && e.timer < 0.4 + 3 * k) {
          s.n++;
          const by = lunaBodyY(e);
          for (let i = 0; i < arms; i++) shoot(w, e.x + Math.cos(s.spin + (i / arms) * TAU) * 10, by + Math.sin(s.spin + (i / arms) * TAU) * 10, s.spin + (i / arms) * TAU, 66 * sm, SHOT, B_MOON);
        }
        if (e.timer >= 0.4 + 3 * k + 0.4) drift(e, s, 0.7);
        break;
      }
      case LL_FANS: {
        hover(e, w, 0.35);
        const volleys = 2 + s.phase + extra(w);
        const every = 0.5 * k;
        if (e.timer >= 0.35 + s.n * every && s.n < volleys) {
          const by = lunaBodyY(e);
          const n = s.phase >= 2 && (s.n & 1) === 1 ? 6 : 5;
          fan(w, e.x, by, n, aimAt(w, e.x, by), 0.26, 80 * sm, SHOT, B_MOON, 10);
          s.n++;
          e.sqV -= 3;
        }
        if (s.n >= volleys && e.timer >= 0.35 + volleys * every + 0.3) drift(e, s, 0.6);
        break;
      }
      case LL_BATS: {
        hover(e, w, 0.3);
        if (e.timer >= 0.4 && e.timer - dt < 0.4) {
          const n = 6 + extra(w) * 2;
          const a0 = w.rng.angle();
          for (let i = 0; i < n; i++) {
            const a = a0 + (i / n) * TAU;
            const x = p.x + Math.cos(a) * 104;
            const y = p.y + Math.sin(a) * 104;
            const b = w.spawnEnemy("batbun", x, y);
            if (b) efx(w, EFX_SUMMON, x, y, 0, 0, 1, b);
          }
          ring(w, e.x, lunaBodyY(e), 10, w.rng.angle(), 56 * sm, SHOT, B_ORB, 12);
          e.sqV += 6;
        }
        if (e.timer >= 1.3 * k) drift(e, s, 0.5);
        break;
      }
      case LL_STARFALL: {
        hover(e, w, 0.3);
        const rows = (s.phase >= 3 ? 7 : 6) + extra(w);
        const every = 0.42 * k;
        if (e.timer >= 0.4 + s.n * every && s.n < rows) {
          const cols = starCols(w);
          const x0 = p.x - ((cols - 1) * STAR_GAP) / 2;
          const y = p.y - w.viewH * 0.5 - 6;
          for (let c = 0; c < cols; c++) {
            if (c === s.gap || c === s.gap + 1) continue;
            w.spawnBullet(x0 + c * STAR_GAP, y, 0, 64 * sm, SHOT, B_STAR, 2.5, 9);
          }
          // the lane snakes sideways a little each row (never more than 2 columns)
          s.gap = clamp(s.gap + w.rng.int(-2, 2), 1, cols - 3);
          s.n++;
        }
        if (s.n >= rows && e.timer >= 0.4 + rows * every + 0.4) drift(e, s, 0.8);
        break;
      }
      case LL_FLOWER: {
        hover(e, w, 0.25);
        const flowers = 4 + extra(w);
        const every = 0.62 * k;
        if (e.timer >= 0.45 + s.n * every && s.n < flowers) {
          const petals = 7 + extra(w);
          const by = lunaBodyY(e);
          const sprite = (s.n & 1) === 0 ? B_MOON : B_STAR;
          // each flower is rotated half a petal: the lanes between petals move
          const base = s.spin + (s.n * Math.PI) / petals;
          for (let pI = 0; pI < petals; pI++) {
            const pc = base + (pI / petals) * TAU;
            for (let j = 0; j < 4; j++) {
              const off = j - 1.5;
              const a = pc + off * 0.11;
              const sp = (70 + 12 * (1 - Math.abs(off) / 1.5)) * sm;
              const b = shoot(w, e.x + Math.cos(a) * 12, by + Math.sin(a) * 12, a, sp, SHOT, sprite);
              // petals swirl gently, alternating direction per flower (curved lanes, same gaps)
              if (b) b.turn = (s.n & 1 ? -1 : 1) * 0.32;
            }
          }
          s.n++;
          e.sqV -= 5;
          shock(w, e.x, by + e.z, 30, 0.2);
        }
        if (s.n >= flowers && e.timer >= 0.45 + flowers * every + 0.5) drift(e, s, 0.6);
        break;
      }
      case LL_FLOURISH: {
        // rise, laugh, then a big shockwave; the next phase starts on her command
        e.vx = e.vy = 0;
        const t = e.timer / FLOURISH;
        e.z = 6 + Math.sin(Math.min(1, t) * Math.PI) * 18;
        if (e.timer >= 1.0 && e.timer - dt < 1.0) {
          e.sqV += 12;
          shock(w, e.x, e.y, 90, 1);
          if (s.phase === 2) {
            s.ringT = 0;
            s.ringOut = 0;
          }
        }
        if (e.timer >= FLOURISH) drift(e, s, 0.3);
        break;
      }
      default:
        drift(e, s, 0.5);
    }
  },
  onDeath(e, w) {
    const s = lunaState(e);
    if (s) s.ringT = -1;
    // final dawn: every other nightmare dissolves in light, outward from her
    dawnOut(e, w);
  },
};

export const bosses: EnemyDef[] = [ladyLunatic];
