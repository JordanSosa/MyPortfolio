/**
 * GINGERBREAD GOLEM (Candy Kingdom 6:00 mid boss, enemies.md §5.1).
 * Name card: GINGERBREAD GOLEM - Baked With Malice (and Cinnamon).
 *
 * P1 (100-50 %), cycle: Stomp -> Icing Slam -> Gumdrop Buttons -> Stomp -> Cookie Cutter
 *   Stomp           walks at the player for 2.5 s, crumb dust + a tiny shake per step
 *   Icing Slam      crouch, jump (z up to 26) onto a 1.0 s landing circle (r 44) at the
 *                   player's spot: a ring of 14 eb_gumdrop (70 px/s, 13) + shockwave,
 *                   x1.4 contact damage within 36 px
 *   Gumdrop Buttons its 3 coat buttons glow 0.5 s, then fly at the player (big gumdrops,
 *                   90 px/s, 15) and bounce once off the view edge
 *   Cookie Cutter   a gingerbread-man outline (6 circles: head, body, arms, legs) is
 *                   telegraphed around the player for 1.2 s, then stamped: 40 damage
 *                   inside any circle, "CUT!"
 * P2 (< 50 %) "HALF-BAKED!" - one leg crumbles (frame 4): King Puff hops x3 instead of
 *   the stomp (each landing spits 8 gumdrops), the slam fires 2 rings 0.25 s apart, the
 *   Cookie Cutter telegraph shortens to 0.9 s and is followed by 8 Gummy Bears (r 70).
 *
 * Death line (view): "...I was supposed to be... a house..." - cookie crumbs.
 * Per-boss state in a WeakMap (golemState: view / tests); e.state / e.timer = step.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { Bullet, Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { aimAt, ring, shoot } from "../enemies/_bullets";
import { EFX_ROAR, EFX_STOMP, EFX_SUMMON, efx, shock } from "../enemies/_fx";
import { cue } from "../enemies/_cue";
import { say } from "../enemies/_say";
import { bossVisible, OFF_WARP, offClock, TAU } from "./_s23";

export const GG_ENTER = 0;
export const GG_STOMP = 1;
export const GG_CROUCH = 2;
export const GG_JUMP = 3;
export const GG_LAND = 4;
export const GG_BUTTONS = 5;
export const GG_CUTTER = 6;
export const GG_CUT = 7;
export const GG_HOP = 8;
export const GG_FLOURISH = 9;

const P_STOMP = 0;
const P_SLAM = 1;
const P_BUTTONS = 2;
const P_CUTTER = 3;
const CYCLE = [P_STOMP, P_SLAM, P_BUTTONS, P_STOMP, P_CUTTER];

export const GG_P2 = 0.5;
const STOMP_T = 2.5;
const STEP_EVERY = 0.45;
const CROUCH_T = 0.35;
const JUMP_T = 1.0;
const JUMP_Z = 26;
export const SLAM_R = 44;
const SLAM_HURT_R = 36;
const LAND_T = 0.75;
const BTN_GLOW = 0.5;
const BTN_SPEED = 90;
const BTN_DMG = 15;
/** Button bullets are drawn 1.5x (the view scales eb_gumdrop by radius). */
export const BTN_R = 3.75;
const GUM_DMG = 13;
const HOP_T = 0.55;
const FLOURISH = 1.7;
export const CUTTER_T = 1.2;
export const CUTTER_T2 = 0.9;
const CUT_DMG = 40;
const CUT_COLOR = 0xff9a3d;
/** Cookie Cutter circles relative to the stamp centre (player feet): head, body, arms, legs. */
export const CUT_X: readonly number[] = [0, 0, -30, 30, -13, 13];
export const CUT_Y: readonly number[] = [-34, 0, -8, -8, 28, 28];
export const CUT_R: readonly number[] = [14, 20, 10, 10, 10, 10];
/** Button positions on the coat (x per facing, y above the feet). */
export const BTN_OY: readonly number[] = [-31, -24, -17];

/** Candy Kingdom cue kinds of the golem (src/view/candy-fx.ts). */
export const CK_CUT = "candy_cut";
export const CK_CRUMBLE = "candy_crumble";
export const CK_BUTTONS = "candy_buttons";

export interface GolemState {
  phase: number;
  pat: number;
  /** Hops / rings / footfalls in the current step. */
  n: number;
  stepAt: number;
  /** Jump target. */
  tx: number;
  ty: number;
  /** Cookie Cutter stamp centre + telegraph length. */
  cutX: number;
  cutY: number;
  cutDur: number;
  /** Flying buttons (pooled bullets: re-checked every step) and whether each has bounced. */
  readonly btn: (Bullet | null)[];
  readonly bounced: boolean[];
  /** Seconds off screen (left behind: it leaps back in with an Icing Slam). */
  off: number;
}

const STATE = new WeakMap<Enemy, GolemState>();

export function golemState(e: Enemy): GolemState | undefined {
  return STATE.get(e);
}

function st(e: Enemy): GolemState {
  let s = STATE.get(e);
  if (!s) {
    s = { phase: 1, pat: 0, n: 0, stepAt: 0, tx: 0, ty: 0, cutX: 0, cutY: 0, cutDur: CUTTER_T, btn: [null, null, null], bounced: [false, false, false], off: 0 };
    STATE.set(e, s);
  }
  return s;
}

function go(e: Enemy, state: number): void {
  e.state = state;
  e.timer = 0;
}

function next(e: Enemy, w: World, s: GolemState): void {
  const p = CYCLE[s.pat % CYCLE.length];
  s.pat++;
  s.n = 0;
  const pl = w.player;
  switch (p) {
    case P_STOMP:
      go(e, s.phase >= 2 ? GG_HOP : GG_STOMP);
      s.stepAt = 0;
      break;
    case P_SLAM:
      go(e, GG_CROUCH);
      break;
    case P_BUTTONS:
      go(e, GG_BUTTONS);
      cue(w, CK_BUTTONS, e.x, e.y, 0, 0, BTN_GLOW, 0, e);
      break;
    default:
      go(e, GG_CUTTER);
      s.cutX = pl.x;
      s.cutY = pl.y;
      s.cutDur = s.phase >= 2 ? CUTTER_T2 : CUTTER_T;
      for (let i = 0; i < CUT_X.length; i++) w.telegraphCircle(s.cutX + CUT_X[i], s.cutY + CUT_Y[i], CUT_R[i], s.cutDur, CUT_COLOR);
      efx(w, EFX_ROAR, e.x, e.y - 30, 0, 0, 0.6, e);
  }
}

/** Walk at the player (gait surge), a footfall every STEP_EVERY s. */
function stomp(e: Enemy, w: World, s: GolemState, dt: number, k: number): void {
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const ph = (e.timer % STEP_EVERY) / STEP_EVERY;
  const sp = d > 30 ? e.speed * k * (0.55 + 0.9 * Math.sin(ph * Math.PI)) : 0;
  e.vx = (dx / d) * sp;
  e.vy = (dy / d) * sp;
  s.stepAt += dt;
  if (s.stepAt >= STEP_EVERY) {
    s.stepAt -= STEP_EVERY;
    s.n++;
    e.sqV += 4;
    efx(w, EFX_STOMP, e.x + (s.n & 1 ? -9 : 9), e.y, 0, 0, 1.4, e);
    shock(w, e.x, e.y, 20, 0.1);
  }
}

function slamLand(e: Enemy, w: World, s: GolemState): void {
  e.sqV -= 14;
  ring(w, e.x, e.y - 12, 14, w.rng.angle(), 70, GUM_DMG, "eb_gumdrop", 12);
  shock(w, e.x, e.y, 70, 1);
  efx(w, EFX_STOMP, e.x, e.y, 0, 0, 2.6, e);
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  if (dx * dx + dy * dy < SLAM_HURT_R * SLAM_HURT_R) w.hurtPlayer(e.dmg * 1.4, e.x, e.y, e.def.id);
  s.n = 1;
}

function fireButtons(e: Enemy, w: World, s: GolemState): void {
  for (let i = 0; i < 3; i++) {
    const x = e.x + e.face * 2;
    const y = e.y - e.z + BTN_OY[i];
    const a = aimAt(w, x, y) + (i - 1) * 0.14;
    const b = shoot(w, x, y, a, BTN_SPEED, BTN_DMG, "eb_gumdrop", 6);
    s.btn[i] = b;
    s.bounced[i] = false;
    if (b) b.r = BTN_R;
  }
  e.sqV -= 8;
}

/** Buttons bounce once off the view edge (pooled bullets: drop any that died or were reused). */
function bounceButtons(w: World, s: GolemState): void {
  const p = w.player;
  const hw = w.viewW * 0.5 - 4;
  const hh = w.viewH * 0.5 - 4;
  for (let i = 0; i < 3; i++) {
    const b = s.btn[i];
    if (!b) continue;
    if (b.dead || b.sprite !== "eb_gumdrop" || b.r !== BTN_R || s.bounced[i]) {
      s.btn[i] = null;
      continue;
    }
    let hit = false;
    if ((b.x < p.x - hw && b.vx < 0) || (b.x > p.x + hw && b.vx > 0)) {
      b.vx = -b.vx;
      hit = true;
    }
    if ((b.y < p.y - CFG.playerCy - hh && b.vy < 0) || (b.y > p.y - CFG.playerCy + hh && b.vy > 0)) {
      b.vy = -b.vy;
      hit = true;
    }
    if (hit) {
      s.bounced[i] = true;
      b.life = Math.max(b.life, b.age + 3.5);
      cue(w, "candy_bounce", b.x, b.y, b.vx, b.vy, 1.2);
    }
  }
}

function startFlourish(e: Enemy, w: World, s: GolemState): void {
  s.phase = 2;
  s.pat = 0;
  go(e, GG_FLOURISH);
  e.z = 0;
  e.inv = FLOURISH + 0.2;
  w.clearBullets();
  for (let i = 0; i < 3; i++) s.btn[i] = null;
  w.emit("bossPhase", { id: e.def.id, phase: 2, x: e.x, y: e.y, title: "HALF-BAKED!", subtitle: "it's still gooey in the middle" });
  cue(w, CK_CRUMBLE, e.x - 8 * e.face, e.y - 8, 0, 0, 1, 0, e);
  efx(w, EFX_ROAR, e.x, e.y - 34, 0, 0, 1, e);
  say(w, e, "STILL GOOEY!");
}

export const gingerbreadGolem: EnemyDef = {
  id: "gingerbread_golem",
  name: "Gingerbread Golem",
  sprite: "boss_gingerbread",
  fps: 5,
  hp: 30000,
  speed: 30,
  dmg: 18,
  radius: 18,
  height: 40,
  xp: 0,
  shadow: 42,
  knockResist: 0.95,
  colors: [C.orange, C.gold, C.white, C.pink],
  boss: { title: "GINGERBREAD GOLEM", subtitle: "Baked With Malice (and Cinnamon)", music: "boss", level: 34 },
  // art: f0-1 stomp, f2 jump crouch, f3 slam, f4 half-baked (missing leg, crumbs), f5 roar
  frame(e) {
    const s = STATE.get(e);
    const p2 = (s?.phase ?? 1) >= 2;
    switch (e.state) {
      case GG_ENTER:
      case GG_FLOURISH:
      case GG_CUTTER:
        return 5;
      case GG_CROUCH:
        return 2;
      case GG_JUMP:
        return e.z > 8 ? 3 : 2;
      case GG_LAND:
        return e.timer < 0.3 ? 3 : p2 ? 4 : 0;
      case GG_HOP:
        return e.z > 4 ? 2 : 4;
      case GG_CUT:
        return e.timer < 0.25 ? 3 : p2 ? 4 : 0;
      case GG_BUTTONS:
        return p2 ? 4 : 0;
      default:
        return p2 ? 4 : (s?.n ?? 0) & 1;
    }
  },
  init(e) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.stepAt = 0;
    for (let i = 0; i < 3; i++) s.btn[i] = null;
    go(e, GG_ENTER);
  },
  update(e, w, dt) {
    const s = st(e);
    e.timer += dt;
    bounceButtons(w, s);
    if (e.state !== GG_ENTER && e.state !== GG_FLOURISH && e.state !== GG_JUMP && s.phase === 1 && e.hp < e.maxHp * GG_P2) {
      startFlourish(e, w, s);
      return;
    }
    const p = w.player;
    switch (e.state) {
      case GG_ENTER:
        e.vx = e.vy = 0;
        if (e.timer >= 0.5 && e.timer - dt < 0.5) {
          say(w, e, "I AM... BAKED.");
          efx(w, EFX_ROAR, e.x, e.y - 34, 0, 0, 0.8, e);
          e.sqV -= 6;
        }
        if (e.timer >= 1.5) next(e, w, s);
        break;
      case GG_STOMP:
        stomp(e, w, s, dt, 1);
        s.off = offClock(e, w, s.off, dt);
        if (s.off > OFF_WARP) {
          // left behind: it leaps back in with a (telegraphed) Icing Slam onto the hero
          s.off = 0;
          go(e, GG_CROUCH);
          break;
        }
        if (e.timer >= STOMP_T && bossVisible(e, w)) next(e, w, s);
        break;
      case GG_HOP: {
        // P2: King Puff hops on its one good leg; each landing spits 8 gumdrops
        const k = Math.min(1, e.timer / HOP_T);
        e.z = Math.sin(k * Math.PI) * 14;
        if (k < 1) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const sp = d > 24 ? e.speed * 2.4 : 0;
          e.vx = (dx / d) * sp;
          e.vy = (dy / d) * sp;
        } else e.vx = e.vy = 0;
        if (e.timer >= HOP_T + 0.18) {
          e.timer = 0;
          s.n++;
          e.sqV -= 8;
          ring(w, e.x, e.y - 10, 8, w.rng.angle(), 60, GUM_DMG, "eb_gumdrop", 12);
          efx(w, EFX_STOMP, e.x, e.y, 0, 0, 2, e);
          shock(w, e.x, e.y, 34, 0.35);
          s.off = offClock(e, w, s.off, HOP_T + 0.18);
          if (s.off > OFF_WARP) {
            s.off = 0;
            go(e, GG_CROUCH);
          } else if (s.n >= 3 && bossVisible(e, w)) next(e, w, s);
        }
        break;
      }
      case GG_CROUCH:
        e.vx = e.vy = 0;
        if (e.timer < dt) e.sqV -= 6;
        if (e.timer >= CROUCH_T) {
          go(e, GG_JUMP);
          s.tx = p.x;
          s.ty = p.y;
          w.telegraphCircle(p.x, p.y, SLAM_R, JUMP_T, 0xff4d6d);
          e.sqV += 12;
        }
        break;
      case GG_JUMP: {
        const t = Math.min(1, e.timer / JUMP_T);
        e.z = Math.sin(t * Math.PI) * JUMP_Z + (1 - t) * 4;
        const rem = Math.max(0.05, JUMP_T - e.timer);
        e.vx = (s.tx - e.x) / rem;
        e.vy = (s.ty - e.y) / rem;
        if (t >= 1) {
          e.x = s.tx;
          e.y = s.ty;
          e.z = 0;
          e.vx = e.vy = 0;
          go(e, GG_LAND);
          slamLand(e, w, s);
        }
        break;
      }
      case GG_LAND:
        e.vx = e.vy = 0;
        // P2: a second ring, offset half a step
        if (s.phase >= 2 && s.n === 1 && e.timer >= 0.25) {
          s.n = 2;
          ring(w, e.x, e.y - 12, 14, w.rng.angle() + Math.PI / 14, 70, GUM_DMG, "eb_gumdrop", 12);
          shock(w, e.x, e.y, 50, 0.5);
        }
        if (e.timer >= LAND_T) next(e, w, s);
        break;
      case GG_BUTTONS:
        e.vx = e.vy = 0;
        if (s.n === 0 && e.timer >= BTN_GLOW) {
          s.n = 1;
          fireButtons(e, w, s);
        }
        if (e.timer >= BTN_GLOW + 0.7) next(e, w, s);
        break;
      case GG_CUTTER:
        // the golem raises its club and bellows while the outline settles
        e.vx = e.vy = 0;
        if (e.timer >= s.cutDur) {
          go(e, GG_CUT);
          const dx = p.x - s.cutX;
          const dy = p.y - s.cutY;
          for (let i = 0; i < CUT_X.length; i++) {
            const cx = dx - CUT_X[i];
            const cy = dy - CUT_Y[i];
            if (cx * cx + cy * cy < CUT_R[i] * CUT_R[i]) {
              w.hurtPlayer(CUT_DMG, s.cutX + CUT_X[i], s.cutY + CUT_Y[i], e.def.id);
              break;
            }
          }
          cue(w, CK_CUT, s.cutX, s.cutY, 0, 0, 1, 0, e);
          shock(w, s.cutX, s.cutY, 60, 0.6);
          e.sqV -= 10;
          if (s.phase >= 2) {
            // ...and 8 Gummy Bears to keep you company
            const a0 = w.rng.angle();
            for (let i = 0; i < 8; i++) {
              const a = a0 + (i / 8) * TAU;
              const x = p.x + Math.cos(a) * 70;
              const y = p.y + Math.sin(a) * 70 * 0.85;
              const g = w.spawnEnemy("gummy_bear", x, y);
              if (g) efx(w, EFX_SUMMON, x, y, 0, 0, 0.8, g);
            }
          }
        }
        break;
      case GG_CUT:
        e.vx = e.vy = 0;
        if (e.timer >= 0.6) next(e, w, s);
        break;
      case GG_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer >= 0.9 && e.timer - dt < 0.9) {
          shock(w, e.x, e.y, 90, 1);
          e.sqV += 12;
          cue(w, CK_CRUMBLE, e.x - 10 * e.face, e.y - 6, 0, 0, 1.6, 1, e);
        }
        if (e.timer >= FLOURISH) next(e, w, s);
        break;
      default:
        next(e, w, s);
    }
  },
  onDeath(e) {
    const s = STATE.get(e);
    if (s) for (let i = 0; i < 3; i++) s.btn[i] = null;
  },
};

export const bosses: EnemyDef[] = [gingerbreadGolem];
