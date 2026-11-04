/**
 * CANCEL-SAMA, the Network Executive (The Final Arc FINAL 19:00,
 * docs/content/enemies.md §5.9). "The Network Executive. Your Ratings Are
 * Concerning." A giant suit with an old CRT TV for a head and a huge red
 * rubber stamp. Not modelled on any real person or company.
 *
 * The show degrades through his phases (sim -> view `stageFx` directives;
 * the hero, enemy bullets, gems, the HUD and text are protected; "Reduce
 * flashing" swaps every degradation for a corner badge - view):
 *
 *   P1 (100-75 %) "PITCH MEETING"
 *     Cancel Stamp  stamp raised (f2), r 48 circle telegraphed on the hero 1.0 s, slam
 *                   (f3): 30 + a ring of 16 eb_memo + a CANCELLED decal for 3 s
 *     Spreadsheet   5 rows of eb_memo slide in from the left, then 5 columns from the
 *                   top; the grid's safe cells are telegraphed
 *     Focus Group   12 Filler Goons encircle
 *   P2 (75-50 %) "RATINGS DROP" (viewers are leaving): saturation 1.0 -> 0.25 over the
 *     phase; Ratings Graph (a jagged descending line of 20 eb_memo, held 0.6 s, then
 *     drifting down at 40 px/s); 2 Plot Holes at telegraphed spots; Cancel Stamp x2
 *   P3 (50-25 %) "BUDGET CUTS" (we couldn't afford the frames): the scene renders at
 *     half resolution, enemies / boss / deco animate at 6 fps, particles at 50 %;
 *     Reused Animation (phase-1 patterns, mirrored); Outsourcing (8 Animation Errors);
 *     he flickers off-model
 *   P4 (25-0 %) "RUSHED ENDING" (we have 60 seconds left): permanent speed lines; every
 *     2.5 s a 0.3 s still frame (enemies + bullets freeze, the hero can still move);
 *     patterns x1.3 speed, stamp + grid + graph combined; "EPISODE ENDS IN 60", then
 *     OVERTIME: bullets +25 % speed (no instant kill)
 *
 * Left out of the shot for 1.2 s while drifting, he smash-cuts back in ("CUT TO:",
 * BX_CUT) so the final boss is never fought off-screen. After a muted fast-forward
 * the current degradations are re-sent (directives on the muted bus never arrive).
 *
 * Death: "Fine. FINE. ...Renewed. Don't make me regret this." - colour floods
 * back from where he fell, the resolution snaps back, the frame rate returns
 * (the stage's onFinalBossKilled), then RENEWED FOR SEASON 2!!
 */
import { C } from "../../art/palette";
import { TAU, clamp } from "../../core/math";
import type { Enemy, EnemyDef } from "../types";
import type { World } from "../world";
import { EFX_SUMMON, efx, shock } from "../enemies/_fx";
import { say } from "../enemies/_say";
import { BX_CALL, BX_CUT, BX_DEGRADE, BX_STAMP, BX_STILL, cue, countAlive } from "../enemies/_s45";
import { FLOURISH, anchor, finalDawn, go, phaseFlourish, readable, ringOf, shot, stageFx, steerTo } from "./_s45boss";

export const CS_ENTER = 0;
export const CS_DRIFT = 1;
export const CS_STAMP = 2;
export const CS_SHEET = 3;
export const CS_FOCUS = 4;
export const CS_GRAPH = 5;
export const CS_HOLES = 6;
export const CS_OUTSOURCE = 7;
export const CS_COMBO = 8;
export const CS_FLOURISH = 9;

const P_STAMP = 0;
const P_SHEET = 1;
const P_FOCUS = 2;
const P_GRAPH = 3;
const P_STAMP2 = 4;
const P_HOLES = 5;
const P_SHEET_M = 6;
const P_OUTSOURCE = 7;
const P_COMBO = 8;
const CYCLES: readonly (readonly number[])[] = [
  [],
  [P_STAMP, P_SHEET, P_FOCUS, P_STAMP],
  [P_GRAPH, P_STAMP2, P_HOLES, P_GRAPH, P_STAMP2, P_SHEET],
  [P_SHEET_M, P_OUTSOURCE, P_STAMP, P_FOCUS, P_SHEET_M, P_STAMP2],
  [P_COMBO, P_STAMP2, P_COMBO, P_FOCUS],
];

export const CS_P2 = 0.75;
export const CS_P3 = 0.5;
export const CS_P4 = 0.25;
const TOP = 70;
/** Seconds out of view (drifting) before he smash-cuts back into the shot. */
export const CUT_AFTER = 1.2;
const BODY_Y = 30;
export const STAMP_R = 48;
export const STAMP_TELE = 1;
const STAMP_DMG = 30;
const MEMO = 15;
export const DECAL_LIFE = 3;
export const STAMP_N = 3;
export const ROWS = 5;
export const ROW_GAP = 40;
const TRAIN_GAP = 30;
const TRAIN_SPEED = 70;
export const SHEET_TELE = 0.9;
export const GRAPH_N = 20;
export const GRAPH_HOLD = 0.6;
const GRAPH_SPEED = 40;
export const STILL_EVERY = 2.5;
export const STILL_T = 0.3;
export const EPISODE_LEFT = 60;
/** Audio degrade per phase (AudioAPI.setDegrade, the `cancel` theme). */
export const DEGRADE: readonly number[] = [0, 0, 0.34, 0.67, 1];

export interface CancelState {
  phase: number;
  pat: number;
  n: number;
  /** Stamps: target, seconds to the slam (< 0 = free), decal age after it (< 0 = none). */
  sx: Float32Array;
  sy: Float32Array;
  st: Float32Array;
  decal: Float32Array;
  /** Spreadsheet: running, its clock, mirrored, the grid origin (hero at the start). */
  sheet: boolean;
  sheetT: number;
  mirror: boolean;
  gx: number;
  gy: number;
  /** Ratings Graph points (pending until GRAPH_HOLD, then they become bullets). */
  graphT: number;
  px: Float32Array;
  py: Float32Array;
  gap: number;
  /** RATINGS DROP progress sent to the view (0..1). */
  ratings: number;
  /** World.muted last update: directives sent while muted (fast-forward) never reached the view. */
  muted: boolean;
  /** Seconds spent out of view while drifting (CUT TO: him past CUT_AFTER). */
  away: number;
  /**
   * RUSHED ENDING: the next still frame and the episode's end (World.t: still frames freeze his own
   * update, the show's clock keeps running), seconds left, overtime.
   */
  stillAt: number;
  endAt: number;
  episode: number;
  overtime: boolean;
  /** Pending summons (Plot Holes / Outsourcing): positions + seconds left. */
  qx: Float32Array;
  qy: Float32Array;
  qt: Float32Array;
  qKind: Uint8Array;
}

const STATE = new WeakMap<Enemy, CancelState>();

export function cancelState(e: Enemy): CancelState | undefined {
  return STATE.get(e);
}

const Q_N = 12;
const Q_HOLE = 1;
const Q_ERROR = 2;

function st(e: Enemy): CancelState {
  let s = STATE.get(e);
  if (!s) {
    s = {
      phase: 1,
      pat: 0,
      n: 0,
      sx: new Float32Array(STAMP_N),
      sy: new Float32Array(STAMP_N),
      st: new Float32Array(STAMP_N).fill(-1),
      decal: new Float32Array(STAMP_N).fill(-1),
      sheet: false,
      sheetT: 0,
      mirror: false,
      gx: 0,
      gy: 0,
      graphT: -1,
      px: new Float32Array(GRAPH_N),
      py: new Float32Array(GRAPH_N),
      gap: -1,
      ratings: 0,
      muted: false,
      away: 0,
      stillAt: 0,
      endAt: 0,
      episode: EPISODE_LEFT,
      overtime: false,
      qx: new Float32Array(Q_N),
      qy: new Float32Array(Q_N),
      qt: new Float32Array(Q_N).fill(-1),
      qKind: new Uint8Array(Q_N),
    };
    STATE.set(e, s);
  }
  return s;
}

/** Pattern speed: x1.3 in the RUSHED ENDING, faster when enraged. */
function rush(w: World, s: CancelState): number {
  return (s.phase >= 4 ? 1.3 : 1) * (w.director.enraged ? 1.15 : 1);
}
/** Bullet speed multiplier (OVERTIME: +25 %). */
function bulletK(w: World, s: CancelState): number {
  return rush(w, s) * (s.overtime ? 1.25 : 1);
}

function stamp(e: Enemy, w: World, s: CancelState, x: number, y: number, delay = 0): void {
  for (let i = 0; i < STAMP_N; i++) {
    if (s.st[i] >= 0) continue;
    const t = STAMP_TELE / rush(w, s) + delay;
    s.sx[i] = x;
    s.sy[i] = y;
    s.st[i] = t;
    w.telegraphCircle(x, y, STAMP_R, t, C.red);
    return;
  }
}

function startSheet(w: World, s: CancelState, mirror: boolean): void {
  const p = w.player;
  s.sheet = true;
  s.sheetT = 0;
  s.mirror = mirror;
  s.gx = p.x;
  s.gy = p.y - 8;
  const hw = w.viewW * 0.5 + 20;
  const tele = SHEET_TELE / rush(w, s);
  for (let k = 0; k < ROWS; k++) {
    const o = (k - 2) * ROW_GAP;
    w.telegraphLine(p.x - hw, s.gy + o, p.x + hw, s.gy + o, 4, tele, C.red);
  }
  // the safe cells around the hero (between rows AND columns)
  for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) w.telegraphCircle(s.gx + a * 20, s.gy + b * 20 + 8, 6, tele * 2 + 1.2, C.lime);
}

/** Spreadsheet trains: rows at sheetT = tele, columns at tele x 2 (+ their telegraph in between). */
function tickSheet(w: World, s: CancelState, dt: number): void {
  if (!s.sheet) return;
  const before = s.sheetT;
  s.sheetT += dt;
  const tele = SHEET_TELE / rush(w, s);
  const p = w.player;
  const hw = w.viewW * 0.5 + 20;
  const hh = w.viewH * 0.5 + 20;
  const sp = TRAIN_SPEED * bulletK(w, s);
  if (before < tele && s.sheetT >= tele) {
    // rows slide in from the left (mirrored: the right)
    const dir = s.mirror ? -1 : 1;
    const n = Math.ceil((w.viewW + 60) / TRAIN_GAP);
    for (let k = 0; k < ROWS; k++) {
      const y = s.gy + (k - 2) * ROW_GAP;
      for (let i = 0; i < n; i++) {
        const x = s.gx - dir * (hw + i * TRAIN_GAP);
        const b = w.spawnBullet(x, y, dir * sp, 0, MEMO, "eb_memo", 3, (w.viewW + 60 + n * TRAIN_GAP) / sp);
        b.tint = 0xffffff;
      }
    }
    // the columns' telegraph
    for (let k = 0; k < ROWS; k++) {
      const x = s.gx + (k - 2) * ROW_GAP;
      w.telegraphLine(x, p.y - hh, x, p.y + hh, 4, tele, C.red);
    }
  }
  if (before < tele * 2 && s.sheetT >= tele * 2) {
    const dir = s.mirror ? -1 : 1;
    const n = Math.ceil((w.viewH + 60) / TRAIN_GAP);
    for (let k = 0; k < ROWS; k++) {
      const x = s.gx + (k - 2) * ROW_GAP;
      for (let i = 0; i < n; i++) {
        const y = s.gy - dir * (hh + i * TRAIN_GAP);
        w.spawnBullet(x, y, 0, dir * sp, MEMO, "eb_memo", 3, (w.viewH + 60 + n * TRAIN_GAP) / sp);
      }
    }
    s.sheet = false;
  }
}

function startGraph(w: World, s: CancelState): void {
  const p = w.player;
  const left = p.x - w.viewW * 0.5 + 6;
  const span = w.viewW - 12;
  const y0 = p.y - Math.min(110, w.viewH * 0.36);
  const y1 = p.y - 34;
  // a market dip: two missing points somewhere in the middle (the way through)
  s.gap = w.rng.int(4, GRAPH_N - 6);
  for (let i = 0; i < GRAPH_N; i++) {
    const f = i / (GRAPH_N - 1);
    s.px[i] = left + span * f;
    s.py[i] = y0 + (y1 - y0) * f + (i & 1 ? 9 : -9) + w.rng.spread(5);
    if (i === s.gap || i === s.gap + 1) continue;
    w.telegraphCircle(s.px[i], s.py[i], 5, GRAPH_HOLD, C.red);
  }
  s.graphT = 0;
}

function tickGraph(w: World, s: CancelState, dt: number): void {
  if (s.graphT < 0) return;
  s.graphT += dt;
  if (s.graphT < GRAPH_HOLD) return;
  s.graphT = -1;
  const sp = GRAPH_SPEED * bulletK(w, s);
  for (let i = 0; i < GRAPH_N; i++) {
    if (i === s.gap || i === s.gap + 1) continue;
    shot(w, s.px[i], s.py[i], Math.PI / 2, sp, MEMO, "eb_memo", 0xffffff, 8);
  }
}

function queue(w: World, s: CancelState, kind: number, x: number, y: number, t: number): void {
  for (let i = 0; i < Q_N; i++) {
    if (s.qt[i] >= 0) continue;
    s.qx[i] = x;
    s.qy[i] = y;
    s.qt[i] = t;
    s.qKind[i] = kind;
    w.telegraphCircle(x, y, 10, t, kind === Q_HOLE ? C.violet : C.cyan);
    return;
  }
}

function tickHazards(e: Enemy, w: World, s: CancelState, dt: number): void {
  const p = w.player;
  for (let i = 0; i < STAMP_N; i++) {
    if (s.st[i] >= 0) {
      s.st[i] -= dt;
      if (s.st[i] <= 0) {
        s.st[i] = -1;
        s.decal[i] = 0;
        const dx = p.x - s.sx[i];
        const dy = p.y - s.sy[i];
        if (dx * dx + dy * dy < STAMP_R * STAMP_R) w.hurtPlayer(STAMP_DMG, s.sx[i], s.sy[i], e.def.id);
        ringOf(w, s.sx[i], s.sy[i] - 6, 16, w.rng.angle(), 55 * bulletK(w, s), MEMO, "eb_memo", 0xffffff, 10);
        shock(w, s.sx[i], s.sy[i], STAMP_R + 10, 1);
        cue(w, BX_STAMP, s.sx[i], s.sy[i], 0, 0, STAMP_R, e);
      }
    } else if (s.decal[i] >= 0) {
      s.decal[i] += dt;
      if (s.decal[i] >= DECAL_LIFE) s.decal[i] = -1;
    }
  }
  for (let i = 0; i < Q_N; i++) {
    if (s.qt[i] < 0) continue;
    s.qt[i] -= dt;
    if (s.qt[i] > 0) continue;
    s.qt[i] = -1;
    const id = s.qKind[i] === Q_HOLE ? "plot_hole" : "animation_error";
    if (id === "plot_hole" && countAlive(w, id) >= 3) continue;
    const m = w.spawnEnemy(id, s.qx[i], s.qy[i]);
    if (m && !m.dead) efx(w, EFX_SUMMON, s.qx[i], s.qy[i], 0, 0, 1, m);
  }
  tickSheet(w, s, dt);
  tickGraph(w, s, dt);
}

/** The degradation for the current phase (and the ratings slide inside RATINGS DROP). */
function degrade(e: Enemy, w: World, s: CancelState): void {
  if (s.phase === 2) {
    const k = clamp((CS_P2 - e.hp / e.maxHp) / (CS_P2 - CS_P3), 0, 1);
    if (k - s.ratings >= 0.04 || (k >= 1 && s.ratings < 1)) {
      s.ratings = k;
      stageFx(w, "grade", k, 0.6, "ratings");
    }
  }
}

/** Back from a muted fast-forward: re-send the degradations the view missed (instant, no easing). */
function reassert(w: World, s: CancelState): void {
  if (s.phase >= 2) stageFx(w, "grade", s.phase >= 3 ? 1 : s.ratings, 0, "ratings");
  if (s.phase >= 3) {
    stageFx(w, "renderScale", 0.5, 0);
    stageFx(w, "animFps", 6);
    stageFx(w, "particles", 0.5);
  }
  if (s.phase >= 4) stageFx(w, "speedLines", 0.6);
}

function enterPhase(e: Enemy, w: World, s: CancelState): void {
  s.phase++;
  s.pat = 0;
  go(e, CS_FLOURISH);
  cue(w, BX_DEGRADE, e.x, e.y - BODY_Y, 0, 0, s.phase, e);
  switch (s.phase) {
    case 2:
      phaseFlourish(e, w, 2, "RATINGS DROP", "viewers are leaving", "Let's look at the numbers.");
      s.ratings = 0;
      stageFx(w, "grade", 0.02, 0.4, "ratings");
      break;
    case 3:
      phaseFlourish(e, w, 3, "BUDGET CUTS", "we couldn't afford the frames", "We're cutting costs.");
      stageFx(w, "grade", 1, 0.3, "ratings");
      stageFx(w, "renderScale", 0.5, 0.6);
      stageFx(w, "animFps", 6);
      stageFx(w, "particles", 0.5);
      break;
    default:
      phaseFlourish(e, w, 4, "RUSHED ENDING", "we have 60 seconds left", "Wrap it up.");
      stageFx(w, "speedLines", 0.6);
      s.stillAt = w.t + FLOURISH + STILL_EVERY;
      s.endAt = w.t + FLOURISH + EPISODE_LEFT;
      s.episode = EPISODE_LEFT;
      s.overtime = false;
  }
}

function nextPattern(e: Enemy, w: World, s: CancelState): void {
  const cyc = CYCLES[s.phase];
  const pat = cyc[s.pat % cyc.length];
  s.pat++;
  s.n = 0;
  const p = w.player;
  switch (pat) {
    case P_STAMP:
      go(e, CS_STAMP);
      stamp(e, w, s, p.x, p.y);
      break;
    case P_STAMP2:
      go(e, CS_STAMP);
      stamp(e, w, s, p.x, p.y);
      s.n = 1;
      break;
    case P_SHEET:
    case P_SHEET_M:
      go(e, CS_SHEET);
      startSheet(w, s, pat === P_SHEET_M);
      cue(w, BX_CALL, e.x, e.y - BODY_Y, 0, 0, 0, e);
      break;
    case P_FOCUS: {
      go(e, CS_FOCUS);
      const n = 12;
      const R = Math.max(w.viewW, w.viewH) * 0.5 + 16;
      const a0 = w.rng.angle();
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * TAU;
        w.spawnEnemy("filler_goon", p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * 0.8);
      }
      w.emit("waveIncoming", { kind: "encircle", x: p.x, y: p.y, label: "FOCUS GROUP!" });
      cue(w, BX_CALL, e.x, e.y - BODY_Y, 0, 0, n, e);
      break;
    }
    case P_GRAPH:
      go(e, CS_GRAPH);
      startGraph(w, s);
      break;
    case P_HOLES: {
      go(e, CS_HOLES);
      for (let k = 0; k < 2; k++) {
        const a = w.rng.angle();
        const d = w.rng.range(92, 118);
        queue(w, s, Q_HOLE, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8, 0.6);
      }
      break;
    }
    case P_OUTSOURCE: {
      go(e, CS_OUTSOURCE);
      const a0 = w.rng.angle();
      for (let k = 0; k < 8; k++) {
        const a = a0 + (k / 8) * TAU;
        const d = w.rng.range(60, 104);
        queue(w, s, Q_ERROR, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.8, 0.6 + k * 0.05);
      }
      cue(w, BX_CALL, e.x, e.y - BODY_Y, 0, 0, 8, e);
      w.emit("waveIncoming", { kind: "teleport", x: p.x, y: p.y, label: "OUTSOURCING!" });
      break;
    }
    default:
      // RUSHED ENDING: everything at once
      go(e, CS_COMBO);
      startSheet(w, s, w.rng.next() < 0.5);
  }
}

function drift(e: Enemy): void {
  go(e, CS_DRIFT);
}

const tmp = { x: 0, y: 0 };

export const cancelSama: EnemyDef = {
  id: "cancel_sama",
  name: "CANCEL-SAMA",
  sprite: "boss_cancel",
  fps: 4,
  hp: 1900000,
  speed: 30,
  dmg: 22,
  radius: 18,
  height: 52,
  xp: 0,
  shadow: 44,
  knockResist: 1,
  noSeparation: true,
  colors: [C.outline, C.red, C.cyan, C.white, C.lavender],
  boss: { title: "CANCEL-SAMA", subtitle: "The Network Executive. Your Ratings Are Concerning.", music: "final", final: true, level: 90 },
  // art: f0-1 idle, f2 stamp raised, f3 stamp slam, f4 phone call, f5 laugh, f6 glitched, f7 defeated
  frame(e) {
    const s = STATE.get(e);
    switch (e.state) {
      case CS_STAMP:
        return e.timer < STAMP_TELE * 0.85 ? 2 : 3;
      case CS_SHEET:
      case CS_FOCUS:
      case CS_OUTSOURCE:
      case CS_HOLES:
        return 4;
      case CS_GRAPH:
        return 5;
      case CS_COMBO:
        return e.timer < 1.2 ? 2 : 5;
      case CS_FLOURISH:
        return 6;
      default:
        // budget cuts: now and then the TV shows static
        if (s && s.phase >= 3 && Math.floor(e.t * 1.7) % 5 === 0) return 6;
        return Math.floor(e.t * 2) & 1;
    }
  },
  init(e, w) {
    const s = st(e);
    s.phase = 1;
    s.pat = 0;
    s.n = 0;
    s.st.fill(-1);
    s.decal.fill(-1);
    s.qt.fill(-1);
    s.sheet = false;
    s.graphT = -1;
    s.ratings = 0;
    s.muted = w.muted;
    s.away = 0;
    s.overtime = false;
    s.episode = EPISODE_LEFT;
    go(e, CS_ENTER);
    e.inv = 2.4;
  },
  update(e, w, dt) {
    const s = st(e);
    const p = w.player;
    e.timer += dt;
    if (s.muted && !w.muted) reassert(w, s);
    s.muted = w.muted;
    tickHazards(e, w, s, dt);
    degrade(e, w, s);

    // phase changes (never skipped: each degradation plays)
    if (e.state !== CS_ENTER && e.state !== CS_FLOURISH && s.phase < 4) {
      const f = e.hp / e.maxHp;
      const want = f < CS_P4 ? 4 : f < CS_P3 ? 3 : f < CS_P2 ? 2 : 1;
      if (want > s.phase) enterPhase(e, w, s);
    }

    // RUSHED ENDING: still frames + the episode countdown
    if (s.phase >= 4 && e.state !== CS_FLOURISH) {
      if (w.t >= s.stillAt) {
        s.stillAt = w.t + STILL_EVERY;
        w.freezeT = Math.max(w.freezeT, STILL_T);
        stageFx(w, "still", 0, STILL_T);
        cue(w, BX_STILL, e.x, e.y, 0, 0, STILL_T, e);
      }
      if (!s.overtime) {
        s.episode = Math.max(0, s.endAt - w.t);
        if (s.episode <= 0) {
          s.overtime = true;
          w.emit("bossPhase", { id: e.def.id, phase: 5, x: e.x, y: e.y, title: "OVERTIME", subtitle: "the network is paying extra for this" });
        }
      }
    }

    switch (e.state) {
      case CS_ENTER: {
        anchor(e, w, 96, TOP, tmp);
        steerTo(e, tmp.x, tmp.y, e.speed * 2.5);
        if (e.timer > 1.8 && s.n === 0) {
          s.n = 1;
          say(w, e, "Let's look at the numbers.");
        }
        if (e.timer > 2.5) drift(e);
        break;
      }
      case CS_FLOURISH:
        e.vx = e.vy = 0;
        if (e.timer > 1.6) drift(e);
        break;
      case CS_DRIFT: {
        anchor(e, w, 96, TOP, tmp);
        const far = Math.abs(e.x - p.x) > w.viewW * 0.45 || Math.abs(e.y - p.y) > w.viewH * 0.45;
        // left behind by a kiting hero: a smash cut puts him back in the shot (the network edits the show)
        s.away = readable(e, w, TOP, 0) ? 0 : s.away + dt;
        if (s.away >= CUT_AFTER) {
          s.away = 0;
          const ox = e.x;
          const oy = e.y;
          e.x = tmp.x;
          e.y = tmp.y;
          e.vx = e.vy = e.kx = e.ky = 0;
          cue(w, BX_CUT, e.x, e.y, ox, oy, 1, e);
          if (e.timer > 1 / rush(w, s)) e.timer = 1 / rush(w, s) - 0.35;
        }
        steerTo(e, tmp.x, tmp.y, e.speed * (far ? 4 : 1.4));
        if (e.timer >= 1 / rush(w, s) && (readable(e, w, TOP, 34) || e.timer > 4)) nextPattern(e, w, s);
        break;
      }
      case CS_STAMP: {
        e.vx = e.vy = 0;
        // (x2: the second stamp re-aims when the first one lands)
        const tele = STAMP_TELE / rush(w, s);
        if (s.n === 1 && e.timer >= tele) {
          s.n = 2;
          stamp(e, w, s, p.x, p.y);
          e.timer = 0;
        }
        if (s.n !== 1 && e.timer >= tele + 0.5) drift(e);
        break;
      }
      case CS_SHEET:
        e.vx = e.vy = 0;
        if (!s.sheet && e.timer >= 0.6) drift(e);
        break;
      case CS_FOCUS:
      case CS_HOLES:
      case CS_OUTSOURCE:
        e.vx = e.vy = 0;
        if (e.timer >= 1.2) drift(e);
        break;
      case CS_GRAPH:
        e.vx = e.vy = 0;
        if (s.graphT < 0 && e.timer >= GRAPH_HOLD + 0.8) drift(e);
        break;
      case CS_COMBO: {
        e.vx = e.vy = 0;
        // stamp + grid + graph, rushed
        if (s.n === 0 && e.timer >= 0.4) {
          s.n = 1;
          stamp(e, w, s, p.x, p.y);
        } else if (s.n === 1 && e.timer >= 1.2) {
          s.n = 2;
          startGraph(w, s);
        } else if (s.n === 2 && e.timer >= 2.4) {
          s.n = 3;
          stamp(e, w, s, p.x, p.y);
        }
        if (s.n >= 3 && !s.sheet && s.graphT < 0 && e.timer >= 3.2) drift(e);
        break;
      }
      default:
        drift(e);
    }
  },
  onDeath(e, w) {
    const s = STATE.get(e);
    if (s) {
      s.st.fill(-1);
      s.qt.fill(-1);
      s.sheet = false;
      s.graphT = -1;
    }
    // the show is restored whenever he falls (a Filler Arc rematch too, where no stage ending runs)
    renewed(w);
    if (w.isFinalBoss(e)) finalDawn(e, w);
    else w.clearBullets();
  },
};

/** The restoration (the stage's onFinalBossKilled): colour floods back, the resolution snaps back, the frame rate returns. */
export function renewed(w: World): void {
  stageFx(w, "grade", 0, 1.2, "ratings");
  stageFx(w, "renderScale", 1, 0);
  stageFx(w, "animFps", 0);
  stageFx(w, "particles", 1);
  stageFx(w, "speedLines", 0);
}

export const bosses: EnemyDef[] = [cancelSama];
