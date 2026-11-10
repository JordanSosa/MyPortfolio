/**
 * Bestiary visuals: everything about Eyepuff, Pumpkin Dasher, Teddy Brute,
 * Candle Wisp, Nightmare Teddy and Lady Lunatic that the generic enemy drawer
 * can't express, plus the boss phase / enrage / victory celebrations.
 *
 *   - `decorate` (called by WorldView.drawEnemies per enemy): telegraph looks
 *     (eye charge glow, pumpkin shiver + red flash, wisp fuse blink + blast
 *     ring), dash afterimages, boss auras, claw sweeps, Lady Lunatic's moon
 *     ring (drawn on the bullet layer). Returns true when it drew the sprite.
 *   - `draw` (called from WorldView.draw): boss death throes, dawn pops, god
 *     rays + sun, and the colour grade overrides (LUNATIC MOON dim, enrage red,
 *     the victory sunrise sweep) applied on top of the stage's current grade
 *     (Dream Meadow: full night by then). The victory texts come from the
 *     StageDef (`victory`).
 *   - `bind` (called from Feedback.bind): enemyFx cues, bossPhase, bossEnrage,
 *     bulletsCleared, final boss death and the extended VICTORY sequence.
 *
 * Reads the world, never mutates it. No allocations per frame (event-time
 * closures only).
 */
import { C } from "../art/palette";
import { audio, type SfxId } from "../audio";
import { lerpColor } from "../core/color";
import { TAU, clamp, ease } from "../core/math";
import { CONFETTI_COLORS, fxEnemyDeath, fxFirework, P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import { GRADES, lerpGrade, cloneGrade, type Grade, type RGB } from "../render/post";
import type { Renderer } from "../render/renderer";
import type { EnemyFxEvent } from "../game/events";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import {
  EFX_CAST,
  EFX_CLAW,
  EFX_DASH,
  EFX_DAWN_POP,
  EFX_DUSTWALL,
  EFX_EYE_CHARGE,
  EFX_FUSE,
  EFX_IMPACT,
  EFX_ROAR,
  EFX_SKID,
  EFX_STOMP,
  EFX_SUMMON,
  EFX_TELE_IN,
  EFX_TELE_OUT,
  EFX_WISP_BOOM,
} from "../game/enemies/_fx";
import { WISP_FUSE, wispRadius } from "../game/enemies/wisp";
import { NT_CHARGE, NT_SWEEP, NT_SWEEP_R, NT_SWEEP_TELE, NT_WINDUP, teddyState } from "../game/bosses/nightmare-teddy";
import { LL_FLOURISH, LL_ENTER, LUNA_RING_N, lunaRing, lunaState } from "../game/bosses/lady-lunatic";
import type { Anims } from "./anims";
import type { FeedbackHooks } from "./feedback";
import type { WorldTexts } from "./texts";

const PI = Math.PI;

// ---------------------------------------------------------------- emitters
/** Sparkles drawn INTO a point (eye charge, teleport-out). */
const gather: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  radius: 12,
  ring: true,
  outward: true,
  speed: [-46, -30],
  life: [0.22, 0.3],
  size: [0.7, 0.35],
  colors: [C.pinkLight, C.white, C.pink],
  additive: true,
  glow: true,
  alphaCurve: "none",
  layer: Layer.FxAdd,
};
/** Low dust ring pushed outward along the ground (stomps). */
const stompDust: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  radius: 5,
  ring: true,
  outward: true,
  speed: [26, 46],
  life: [0.35, 0.55],
  size: [0.45, 0.85],
  sizeJitter: 0.25,
  colors: [C.offWhite, C.lavender],
  alpha: 0.7,
  drag: 5,
  gravity: -6,
  alphaCurve: "late",
  layer: Layer.FxBelow,
};
/** Tall rolling dust plumes (Nightmare Teddy's charge "wall of dust"). */
const dustPlume: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  speed: [10, 34],
  life: [0.55, 0.9],
  size: [0.8, 1.6],
  sizeJitter: 0.3,
  colors: [C.offWhite, C.lavender, 0xc9b8e8],
  alpha: 0.6,
  drag: 2.2,
  gravity: -10,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Blue candle flames (wisp blasts). */
const wispFlame: EmitterDef = {
  sprite: "fx_glow_s",
  frames: "fixed",
  speed: [30, 80],
  life: [0.25, 0.45],
  size: [0.7, 0.1],
  sizeJitter: 0.3,
  colors: [C.lightBlue, C.violet, C.white, C.blue],
  drag: 3,
  gravity: -60,
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};
/** Golden motes rising from a dissolving nightmare at dawn. */
const dawnMote: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  speed: [10, 36],
  angle: -PI / 2,
  spread: 1.6,
  life: [0.5, 0.9],
  size: [0.9, 0.4],
  colors: [C.paleYellow, C.white, C.yellow, C.pinkLight],
  gravity: -30,
  drag: 1.5,
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};

/**
 * fxExplosion without the ground scorch decal: the final boss blows up in the
 * air, and a dozen stacked scorch marks would leave a brown smudge under the
 * sunrise grade.
 */
function airBurst(fx: Fx, x: number, y: number, radius: number, juice: boolean): void {
  const ps = fx.ps;
  const s = radius / 16;
  ps.emit(P.explosion, x, y, 1, NaN, -1, s);
  ps.emit(P.flare, x, y, 1, NaN, C.paleYellow, s * 0.9);
  ps.emit(P.ring, x, y, 1, NaN, C.paleYellow, s * 1.15);
  ps.emit(P.rays, x, y, 8 + Math.round(radius / 6), NaN, -1, 0.8 + s * 0.2, 0.6 + s * 0.35);
  ps.emit(P.ember, x, y, 6 + Math.round(radius / 5), NaN, -1, 1, 0.7 + s * 0.3);
  ps.emit(P.smoke, x, y, 2, NaN, -1, 0.6 + s * 0.3, 1.5);
  if (juice) {
    fx.juice.shake(0.35);
    fx.juice.shockwave(x, y, 1, radius * 2.4);
    fx.juice.flash(C.paleYellow, 0.15, 0.15);
    fx.juice.aberration(2);
  }
}

// ---------------------------------------------------------------- grades
const G_LUNATIC: Grade = { tint: [0.6, 0.5, 0.95], lift: [0.05, 0.0, 0.11], saturation: 0.74, contrast: 1.16, brightness: 0.7, hue: 0 };
// (moderate: pink / violet bullets must stay readable on the tinted ground - the red vignette carries the rage)
const G_ENRAGE: Grade = { tint: [1.08, 0.7, 0.74], lift: [0.07, 0.0, 0.02], saturation: 0.92, contrast: 1.1, brightness: 0.86, hue: 0 };
const G_SUNRISE: Grade = { tint: [1.24, 0.9, 0.7], lift: [0.12, 0.04, 0.03], saturation: 1.14, contrast: 1.02, brightness: 1.06, hue: 0 };
const G_MORNING: Grade = { tint: [1.07, 1.02, 0.95], lift: [0.06, 0.04, 0.04], saturation: 1.04, contrast: 1.0, brightness: 1.06, hue: 0 };
const ENRAGE_VIG: RGB = [0.36, 0.02, 0.07];
/** PostFx defaults (render/post.ts) restored when the overrides end - never read back from the live post state. */
const BASE_VIGNETTE = 0.32;
const BASE_VIG_COLOR: RGB = [0.1, 0.04, 0.16];

// ---------------------------------------------------------------- kinds
const K_EYEPUFF = 1;
const K_PUMPKIN = 2;
const K_WISP = 3;
const K_NTEDDY = 4;
const K_LUNA = 5;
const KIND = new Map<string, number>([
  ["eyepuff", K_EYEPUFF],
  ["pumpkin", K_PUMPKIN],
  ["wisp", K_WISP],
  ["nightmare_teddy", K_NTEDDY],
  ["lady_lunatic", K_LUNA],
]);

/** Ambient particle mix during the dawn celebration (read-only: set every frame without allocating). */
const DAWN_AMBIENT = { petals: 26, motes: 24, fireflies: 0 } as const;

/** Seconds from the final killing blow to the dawn flash. */
export const DAWN_AT = 1.7;
const MAX_POPS = 160;

interface Pop {
  on: boolean;
  t: number;
  h: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  scale: number;
  colors: readonly number[];
}

export interface BestiaryBindOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  sound: boolean;
  calm: boolean;
  hooks?: FeedbackHooks;
}

export class BestiaryFx {
  private w: World | null = null;
  private o: BestiaryBindOpts | null = null;
  private frameN = 0;
  private now = 0;
  /** Sim time advanced last frame: particle / afterimage emission from `decorate` only then (no piles while paused). */
  private live = true;
  private later: { t: number; fn: () => void }[] = [];
  private readonly tmp = { x: 0, y: 0 };
  private readonly hStreak: number;
  private readonly hBeam: number;
  private readonly hGlow: number;
  private readonly hMoon: number;
  private readonly moonN: number;
  private readonly pops: Pop[] = [];
  /** Hero idle sprite handle for the behind-the-boss marker (looked up once per hero, not per frame). */
  private heroIdle = 0;
  private heroIdleFor = "";
  // per-frame budgets
  private stompShake = 0;
  private fxBudget = 0;
  private popBudget = 0;
  // death throes (any boss) + victory
  private throeT = -1;
  private throeDur = 0.9;
  private throeH = 0;
  private throeX = 0;
  private throeY = 0;
  private throeSx = 1;
  private throeSy = 1;
  private throeFinal = false;
  private vicT = -1;
  // grade blends
  private kLuna = 0;
  private kEnrage = 0;
  private readonly g = cloneGrade(GRADES.night);
  /** The stage grade this frame (Feedback set it before the view draws), the base of every override. */
  private readonly base = cloneGrade(GRADES.night);
  private gradeOwned = false;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly anims: Anims,
    private readonly texts: WorldTexts,
    private readonly pose: (seconds: number) => void,
  ) {
    this.hStreak = r.atlas.handle("fx_streak");
    this.hBeam = r.atlas.handle("fx_beam");
    this.hGlow = r.atlas.handle("fx_glow");
    const moon = anims.get("eb_moon");
    this.hMoon = moon.first;
    this.moonN = moon.count;
    for (let i = 0; i < MAX_POPS; i++) this.pops.push({ on: false, t: 0, h: 0, x: 0, y: 0, sx: 1, sy: 1, scale: 1, colors: CONFETTI_COLORS });
  }

  /** New world (run start / attract restart): forget transient state. */
  setWorld(w: World): void {
    this.w = w;
    this.reset();
  }

  private reset(): void {
    this.later.length = 0;
    for (const p of this.pops) p.on = false;
    this.throeT = -1;
    this.vicT = -1;
    this.kLuna = this.kEnrage = 0;
    this.restorePost();
  }

  /** Give the vignette back (end of a dim / enrage / sunrise override, run end). */
  private restorePost(): void {
    if (!this.gradeOwned) return;
    const post = this.r.post;
    post.vignette = BASE_VIGNETTE;
    for (let i = 0; i < 3; i++) post.vignetteColor[i] = BASE_VIG_COLOR[i];
    this.gradeOwned = false;
  }

  private after(sec: number, fn: () => void): void {
    this.later.push({ t: this.now + sec, fn });
  }

  private sfx(id: SfxId, vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  // ================================================================ per enemy
  /**
   * Extra visuals for one enemy (called by WorldView.drawEnemies right before
   * the sprite). Returns true when it drew the sprite itself.
   * `y` = feet y minus hop height; `tint`/`flash` = what the default draw would use.
   */
  decorate(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number): boolean {
    const k = KIND.get(e.def.id);
    if (k === undefined) return false;
    const r = this.r;
    const fx = this.fx;
    // frozen (clock pickup / time stop): the default light-blue frozen look wins for the small fry
    const frozen = tint !== 0xffffff;
    const live = this.live && !frozen;
    if (frozen && k !== K_LUNA && k !== K_NTEDDY) return false;
    switch (k) {
      case K_EYEPUFF: {
        if (e.state !== 1) return false;
        const t = clamp(e.timer / 0.4, 0, 1);
        const ex = e.x + e.face * e.scale;
        const ey = y - 8 * e.scale;
        r.glow(ex, ey, (5 + 9 * t) * e.scale, C.hotPink, 0.3 + 0.5 * t);
        r.glow(ex, ey, (2 + 3 * t) * e.scale, C.white, 0.5 + 0.4 * t);
        if (live && (this.frameN + e.uid) % 3 === 0) fx.ps.emit(gather, ex, ey, 1, NaN, -1, e.scale);
        return false;
      }
      case K_PUMPKIN: {
        if (e.state === 1) {
          // shiver + pulsing red flash (unless a hit flash is showing)
          const t = clamp(e.timer / 0.5, 0, 1);
          const jit = ((time * 45) | 0) & 1 ? 1 : -1;
          const pulse = 0.5 + 0.5 * Math.sin(e.timer * TAU * 7);
          const red = (0.35 + 0.5 * t) * pulse;
          r.glow(e.x, y - 6 * e.scale, 10 * e.scale, C.red, 0.15 + 0.35 * red);
          if (flash > 0) r.spr(Layer.Entity, h, e.x + jit, y, sx, sy, 0, 0xffffff, e.alpha, 1, 0);
          else r.spr(Layer.Entity, h, e.x + jit, y, sx, sy, 0, lerpColor(0xffffff, C.red, red * 0.7), e.alpha, red * 0.55, 0);
          return true;
        }
        if (e.state === 2) {
          const rot = (e.face > 0 ? 1 : -1) * 0.2;
          if (live && (this.frameN + e.uid) % 3 === 0) fx.ghosts.spawn(h, e.x, y, sx, sy, rot, C.orange, 0.18, 0.5, Layer.FxBelow);
          if (live && (this.frameN + e.uid) % 2 === 0) fx.ps.emit(P.dust, e.x, e.y, 1, Math.atan2(-e.d, -e.c), -1, e.scale);
          r.spr(Layer.Entity, h, e.x, y, sx, sy, rot, tint, e.alpha, flash, 0);
          return true;
        }
        if (live && e.state === 3 && (this.frameN + e.uid) % 3 === 0) fx.ps.emit(P.dust, e.x + e.c * 4, e.y, 1, NaN, -1, e.scale);
        return false;
      }
      case K_WISP: {
        r.glow(e.x, y - 5 * e.scale, 8 * e.scale, C.lightBlue, (0.22 + 0.1 * Math.sin(time * 21 + e.uid)) * e.alpha);
        if (e.state !== 1) return false;
        const fuse = WISP_FUSE * (e.elite ? 1.25 : 1);
        const t = clamp(e.timer / fuse, 0, 1);
        const on = ((e.timer * (12 + 34 * t)) | 0) & 1;
        const R = wispRadius(e) + 4;
        // honest blast zone on the ground under it
        r.circle(Layer.Decal, e.x, e.y, R, C.red, 0.1 + 0.16 * t);
        r.ring(Layer.Decal, e.x, e.y, R, on ? C.white : C.red, 0.55 + 0.4 * on, 0, true);
        r.glow(e.x, y - 5 * e.scale, (8 + 10 * t) * e.scale, on ? C.white : C.red, 0.35 + 0.4 * t);
        const s = 1 + 0.3 * t;
        r.spr(Layer.Entity, h, e.x, y, sx * s, sy * s, 0, on ? 0xffffff : C.red, 1, on ? 1 : 0.4, Flag.Glow);
        return true;
      }
      case K_NTEDDY: {
        const s = teddyState(e);
        const rage = !!s?.rage;
        const pulse = 0.6 + 0.4 * Math.sin(time * (rage ? 14 : 7));
        // glowing red stitched eyes
        const ey = y - 41 * e.scale;
        const eg = (rage ? 5 : 3.5) * e.scale;
        r.glow(e.x + (-6 + 0.5) * e.face, ey, eg, C.red, 0.55 * pulse * e.alpha);
        r.glow(e.x + 8 * e.face, ey, eg, C.red, 0.55 * pulse * e.alpha);
        if (rage) r.glow(e.x, y - 26, 34, C.red, 0.1 + 0.06 * pulse);
        if (e.state === NT_WINDUP) {
          const t = clamp(e.timer / 0.6, 0, 1);
          r.glow(e.x, y - 26, 26 + 10 * t, C.red, 0.12 + 0.25 * t);
          if (live && (this.frameN & 3) === 0) fx.ps.emit(P.dust, e.x + (Math.random() - 0.5) * 30, e.y, 1, NaN, -1, 1.4);
        } else if (e.state === NT_CHARGE) {
          if (live && this.frameN % 3 === 0) fx.ghosts.spawn(h, e.x, y, sx, sy, 0, rage ? C.red : C.violet, 0.18, 0.3, Layer.FxBelow);
        } else if (e.state === NT_SWEEP_TELE) {
          // claws glint before the spin
          if (live && (this.frameN & 3) === 0) fx.ps.emit(P.sparkle, e.x + (Math.random() < 0.5 ? -22 : 22), y - 18, 1, NaN, C.white, 1.2);
        } else if (e.state === NT_SWEEP) {
          this.drawClaws(e, y, time, live);
        }
        return false;
      }
      case K_LUNA: {
        this.decorateLuna(e, y, time, live);
        return false;
      }
    }
    return false;
  }

  private drawClaws(e: Enemy, y: number, time: number, live: boolean): void {
    const r = this.r;
    const cx = e.x;
    const cy = y - 18;
    const R = NT_SWEEP_R * 0.82;
    const a0 = e.timer * 26;
    const k = clamp(1 - e.timer / 0.55, 0, 1);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        const a = a0 + (i / 3) * TAU - j * 0.28;
        const px = cx + Math.cos(a) * R;
        const py = cy + Math.sin(a) * R * 0.62;
        const al = (1 - j * 0.24) * (0.4 + 0.6 * k);
        this.r.batch.drawP(Layer.FxAdd, this.hStreak, px, py, 2.6 - j * 0.4, 1.4, a + PI / 2, j === 0 ? C.white : C.pinkLight, al, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 16, 2);
      }
    }
    r.ring(Layer.FxAdd, cx, e.y, NT_SWEEP_R * (0.9 + 0.1 * Math.sin(time * 30)), C.red, 0.35 * k + 0.15, Flag.Add | Flag.Glow, true);
    if (live && (this.frameN & 1) === 0) this.fx.ps.emit(P.sparkle, cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * 0.62, 2, NaN, C.white, 1.1, 1.4);
  }

  private decorateLuna(e: Enemy, y: number, time: number, live: boolean): void {
    const r = this.r;
    const w = this.w;
    const s = lunaState(e);
    const by = y - 30;
    const enr = !!w?.director.enraged;
    const p3 = (s?.phase ?? 1) >= 3;
    const a = e.alpha;
    // soft halo BEHIND her (additive, no bloom so the sprite stays crisp)
    r.batch.sortKey = e.y - 0.02;
    r.spr(Layer.Entity, this.hGlow, e.x, by, 2.3, 2.6, 0, enr ? C.red : p3 ? C.violet : C.lavender, (0.28 + 0.06 * Math.sin(time * 3)) * a, 0, Flag.Add);
    r.batch.sortKey = NaN;
    // her crescent glows
    r.glow(e.x - 9 * e.face, y - 52, 9, enr ? C.red : C.paleYellow, (0.3 + 0.1 * Math.sin(time * 2)) * a);
    // invulnerable flourish / entrance: shimmering barrier
    if (e.inv > 0 && a > 0.9 && s && (e.state === LL_FLOURISH || e.state === LL_ENTER)) {
      const q = 0.5 + 0.5 * Math.sin(time * 18);
      r.ring(Layer.FxAdd, e.x, by, 26 + 2 * q, C.lavender, 0.25 + 0.25 * q, Flag.Add | Flag.Glow, true);
      r.ring(Layer.FxAdd, e.x, by, 31 + 3 * q, C.white, 0.12 + 0.12 * q, Flag.Add | Flag.Glow);
      if (live && (this.frameN & 3) === 0) this.fx.ps.emit(P.sparkle, e.x + (Math.random() - 0.5) * 50, by + (Math.random() - 0.5) * 50, 1, NaN, C.lavender);
    }
    if (live && enr && (this.frameN & 3) === 0) this.fx.ps.emit(P.ember, e.x + (Math.random() - 0.5) * 30, by + 10, 1, NaN, C.red);
    // P2 orbiting moon ring (hazard, so it lives on the always-on-top bullet layer)
    const t = this.tmp;
    const hm = this.hMoon + (Math.floor(time * 6) % this.moonN);
    for (let i = 0; i < LUNA_RING_N; i++) {
      if (!lunaRing(e, i, t)) break;
      const rot = Math.atan2(t.y - by, t.x - e.x) + PI / 2;
      r.glow(t.x, t.y, 11, C.paleYellow, 0.5 * a, Layer.Bullets);
      r.spr(Layer.Bullets, hm, t.x, t.y, 1, 1, rot, 0xffffff, a, 0, Flag.Glow | Flag.NoSnap);
    }
  }

  // ================================================================ per frame
  /** Called from WorldView.draw (between beginFrame and endFrame). */
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.frameN++;
    this.live = dt > 0;
    this.now += realDt;
    this.stompShake = Math.max(0, this.stompShake - realDt);
    this.fxBudget = 14;
    this.popBudget = 10;
    if (this.later.length) {
      for (let i = this.later.length - 1; i >= 0; i--) {
        const l = this.later[i];
        if (this.now >= l.t) {
          this.later.splice(i, 1);
          l.fn();
        }
      }
    }
    this.drawPops(time, realDt);
    this.drawThroes(time, realDt);
    this.drawHeroMarker(time);
    if (this.vicT >= 0) this.drawDawn(time, realDt);
    this.applyGrade(realDt, time);
  }

  /** The hero stands behind a big boss sprite: draw a pulsing outline marker on top so they are never lost. */
  private drawHeroMarker(time: number): void {
    const w = this.w;
    const b = w?.boss;
    if (!w || !b || b.dead || w.phase !== "play") return;
    const p = w.player;
    const info = this.r.atlas.info(b.def.sprite);
    const hw = info.w * 0.5 * b.scale - 4;
    const top = b.y - b.z - info.h * b.scale + 6;
    const behind = p.y < b.y && p.y > top && Math.abs(p.x - b.x) < hw;
    if (!behind) return;
    // a translucent see-through silhouette of the hero drawn over the boss + a soft ring
    const q = 0.5 + 0.5 * Math.sin(time * 8);
    if (this.heroIdleFor !== w.hero.sprite) {
      this.heroIdleFor = w.hero.sprite;
      this.heroIdle = this.anims.get(`${w.hero.sprite}_idle`).first;
    }
    const h = this.heroIdle;
    this.r.spr(Layer.Text, h, p.x, p.y, p.face, 1, 0, C.aqua, 0.38 + 0.12 * q, 0.85, 0);
    this.r.ring(Layer.Text, p.x, p.y - 8, 12 + q, C.aqua, 0.45 + 0.25 * q, 0, true);
  }

  private drawPops(time: number, realDt: number): void {
    const r = this.r;
    for (let i = 0; i < MAX_POPS; i++) {
      const p = this.pops[i];
      if (!p.on) continue;
      p.t -= realDt;
      if (p.t <= 0) {
        p.on = false;
        if (this.popBudget-- > 0) {
          fxEnemyDeath(this.fx, p.x, p.y, p.colors, p.scale);
          this.fx.ps.emit(dawnMote, p.x, p.y - 6, 5, NaN, -1, p.scale);
          this.fx.ps.emit(P.ring, p.x, p.y - 6, 1, NaN, C.paleYellow, p.scale);
          this.sfx("enemyDie", 0.45, ((Math.random() * 5) | 0) + 3, p.x);
        } else this.fx.ps.emit(dawnMote, p.x, p.y - 6, 3);
        continue;
      }
      // turned to light: golden silhouette that brightens and blinks faster before popping
      const blink = p.t < 0.5 ? (((p.t * 30) | 0) & 1 ? 1 : 0.55) : 0.55 + 0.15 * Math.sin(time * 9 + i);
      r.spr(Layer.Entity, p.h, p.x, p.y, p.sx, p.sy, 0, C.paleYellow, 1, blink, 0);
      r.glow(p.x, p.y - 6 * p.scale, 9 * p.scale, C.paleYellow, 0.25 + 0.2 * blink);
    }
  }

  private drawThroes(time: number, realDt: number): void {
    if (this.throeT < 0) return;
    this.throeT += realDt;
    const t = this.throeT / this.throeDur;
    if (t >= 1) {
      this.throeT = -1;
      return;
    }
    const r = this.r;
    const jx = (Math.random() - 0.5) * (2 + 5 * t);
    const jy = (Math.random() - 0.5) * (2 + 3 * t);
    const sc = 1 + 0.18 * ease.quadIn(t);
    const fl = ((time * (14 + 30 * t)) | 0) & 1 ? 1 : 0.35 + 0.5 * t;
    r.spr(Layer.Entity, this.throeH, this.throeX + jx, this.throeY + jy, this.throeSx * sc, this.throeSy * sc, 0, 0xffffff, 1 - ease.quadIn(Math.max(0, t - 0.85) / 0.15), fl, 0);
    r.glow(this.throeX, this.throeY - 26, 30 + 30 * t, this.throeFinal ? C.paleYellow : C.white, 0.2 + 0.4 * t);
  }

  /** Victory: god rays + rising sun + continuous celebration. */
  private drawDawn(time: number, realDt: number): void {
    this.vicT += realDt;
    const t = this.vicT - DAWN_AT;
    if (t < 0) return;
    const r = this.r;
    const v = r.camera.view;
    const k = clamp(t / 2.5, 0, 1);
    // the sun rises behind the top edge
    const sx = v.x + v.w * 0.28;
    const sy = v.y + 18 - 26 * ease.cubicOut(k);
    r.glow(sx, sy, 70 + 30 * k, C.paleYellow, 0.32 * k, Layer.Overlay);
    r.glow(sx, sy, 30 + 10 * k, C.white, 0.35 * k, Layer.Overlay);
    // slanted god rays from the sun (fx_beam is bright at the bottom: rotate it ~180 deg)
    for (let i = 0; i < 6; i++) {
      const ang = PI - 0.55 + i * 0.22 + Math.sin(time * 0.4 + i) * 0.03;
      const len = v.h * 1.2;
      const cx = sx - Math.sin(ang) * (len * 0.5);
      const cy = sy + Math.cos(ang) * -(len * 0.5);
      const al = (0.07 + 0.05 * Math.sin(time * 1.3 + i * 1.7)) * k;
      r.batch.drawP(Layer.Overlay, this.hBeam, cx, cy, 2.5 + (i % 3), len / 32, ang, C.paleYellow, al, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 4, 16);
    }
    // celebration ambience
    this.fx.ambient.set(DAWN_AMBIENT);
  }

  /** Colour grade overrides on top of the stage's grade this frame (Dream Meadow: full night by then). */
  private applyGrade(realDt: number, time: number): void {
    const w = this.w;
    if (!w) return;
    const post = this.r.post;
    const base = this.base;
    lerpGrade(post.grade, post.grade, 0, base);
    if (this.vicT >= DAWN_AT) {
      const t = this.vicT - DAWN_AT;
      const k1 = ease.sineInOut(clamp(t / 1.6, 0, 1));
      const k2 = ease.sineInOut(clamp((t - 1.6) / 2.4, 0, 1));
      lerpGrade(base, G_SUNRISE, k1, this.g);
      lerpGrade(this.g, G_MORNING, k2, post.grade);
      post.vignette = BASE_VIGNETTE * (1 - 0.4 * k1);
      for (let i = 0; i < 3; i++) post.vignetteColor[i] = BASE_VIG_COLOR[i];
      this.gradeOwned = true;
      return;
    }
    const b = w.boss;
    const luna = b && !b.dead && b.def.id === "lady_lunatic" ? lunaState(b) : undefined;
    const wantL = luna && luna.phase >= 3 ? 1 : 0;
    const wantE = b && !b.dead && w.director.enraged ? 1 : 0;
    this.kLuna += clamp(wantL - this.kLuna, -realDt * 0.8, realDt * 0.8);
    this.kEnrage += clamp(wantE - this.kEnrage, -realDt * 0.8, realDt * 0.8);
    if (this.kLuna <= 0 && this.kEnrage <= 0) {
      this.restorePost();
      return;
    }
    this.gradeOwned = true;
    const pulse = 0.92 + 0.08 * Math.sin(time * 2.4);
    lerpGrade(base, G_LUNATIC, this.kLuna, this.g);
    lerpGrade(this.g, G_ENRAGE, this.kEnrage * pulse, post.grade);
    post.vignette = BASE_VIGNETTE + 0.2 * this.kLuna + 0.26 * this.kEnrage * pulse;
    const c = post.vignetteColor;
    for (let i = 0; i < 3; i++) c[i] = BASE_VIG_COLOR[i] + (ENRAGE_VIG[i] - BASE_VIG_COLOR[i]) * this.kEnrage;
  }

  // ================================================================ events
  /** Subscribe to the world's events (called from Feedback.bind). Returns the unsubscribers. */
  bind(w: World, o: BestiaryBindOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    this.reset();
    const bus = w.bus;
    const fx = this.fx;
    const juice = fx.juice;
    const calm = o.calm;
    return [
      () => {
        // run over (session disposed): drop scheduled effects, give the post state back
        this.later.length = 0;
        this.vicT = -1;
        this.restorePost();
      },
      bus.on("enemyFx", (e) => this.onFx(e)),
      bus.on("bulletsCleared", () => {
        // every bullet bursts into a sparkle (the list is still intact here)
        const n = Math.min(w.bullets.count, 140);
        for (let i = 0; i < n; i++) {
          const b = w.bullets.items[i];
          const c = b.sprite === "eb_moon" ? C.paleYellow : b.sprite === "eb_star" ? C.violet : C.pink;
          fx.ps.emit(P.sparkle, b.x, b.y, 1, NaN, c, 1.1);
          if ((i & 3) === 0) fx.ps.emit(P.ringThin, b.x, b.y, 1, NaN, c, 0.4);
        }
        this.sfx("bubblePop", 0.8, 2);
      }),
      bus.on("bossPhase", (e) => {
        const luna = e.id === "lady_lunatic";
        o.hooks?.banner?.("boss", e.title, e.subtitle);
        if (o.sound) audio.duck(0.65, 1.9);
        this.sfx(luna ? "warning" : "bossRoar", 0.9);
        if (luna) this.after(0.25, () => this.sfx("ultCutin", 0.6, -5));
        if (calm) return;
        juice.flash(e.phase >= 3 ? C.violet : C.white, 0.55, 0.5);
        juice.shockwave(e.x, e.y - 26, 2, 210, 1);
        juice.shake(0.6);
        juice.zoomPunch(0.08);
        juice.aberration(3);
        juice.hitstop(110);
        juice.bloomSurge(1, 1.2);
        fx.speed.radial(1.1, { color: e.phase >= 3 ? C.violet : C.lavender, intensity: 0.9 });
        fx.ps.emit(P.rays, e.x, e.y - 30, 28, NaN, luna ? C.lavender : C.red, 1.3, 1.6);
        fx.ps.emit(P.ring, e.x, e.y - 30, 1, NaN, C.white, 4);
        o.haptic(60);
      }),
      bus.on("bossEnrage", () => {
        o.hooks?.banner?.("warning", "ENRAGED!", "the moon turns blood red");
        this.sfx("warning");
        this.after(0.4, () => this.sfx("bossRoar"));
        if (o.sound) audio.duck(0.5, 1.2);
        if (calm) return;
        juice.flash(C.red, 0.5, 0.6);
        juice.shake(0.6);
        juice.aberration(3);
        fx.speed.radial(1, { color: C.red, intensity: 0.9 });
        o.haptic(60);
      }),
      bus.on("enemyKilled", (e) => {
        if (!e.boss) return;
        // remember the boss pose for its death throes (it leaves the list this step)
        const en = e.enemy;
        const def = en.def;
        const a = this.anims.fps(def.sprite, def.fps ?? 0);
        const f = def.frame ? def.frame(en) : 0;
        this.throeH = a.first + ((f >= 0 ? f : 0) % a.count);
        this.throeX = en.x;
        this.throeY = en.y - en.z;
        this.throeSx = en.face * en.scale;
        this.throeSy = en.scale;
        this.throeFinal = w.isFinalBoss(en);
        this.throeDur = this.throeFinal ? DAWN_AT : 0.95;
        this.throeT = 0;
        if (this.throeFinal) this.finalDeath(en.x, en.y - en.z);
      }),
      bus.on("victory", () => this.victory()),
    ];
  }

  private onFx(e: EnemyFxEvent): void {
    const fx = this.fx;
    const juice = fx.juice;
    const o = this.o;
    const calm = !!o?.calm;
    const ps = fx.ps;
    switch (e.kind) {
      case EFX_STOMP: {
        const big = e.power >= 2;
        ps.emit(stompDust, e.x, e.y, big ? 9 : 4, NaN, -1, e.power * 0.8, 0.8 + e.power * 0.3);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.offWhite, 0.45 * e.power);
        if (!calm && this.stompShake <= 0) {
          const p = this.w?.player;
          const dx = p ? p.x - e.x : 999;
          const dy = p ? p.y - e.y : 999;
          if (big || dx * dx + dy * dy < 90 * 90) {
            juice.shake(big ? 0.13 : 0.06);
            this.stompShake = big ? 0.36 : 0.22; // (boss: a thud on every other footfall)
            if (big) this.sfx("bossHit", 0.35, -12, e.x);
          }
        }
        break;
      }
      case EFX_SKID: {
        const back = Math.atan2(-e.dy, -e.dx);
        ps.emit(P.dust, e.x, e.y, Math.round(5 * e.power), back, -1, 0.8 + 0.3 * e.power, 1.6);
        ps.emit(P.dust, e.x + e.dx * 5, e.y + e.dy * 5, Math.round(3 * e.power), Math.atan2(e.dy, e.dx), -1, 0.7 + 0.2 * e.power, 1.2);
        ps.emit(P.debris, e.x, e.y, Math.round(2 * e.power));
        break;
      }
      case EFX_DASH: {
        const back = Math.atan2(-e.dy, -e.dx);
        ps.emit(P.dust, e.x, e.y, Math.round(4 * e.power), back, -1, 0.8 + 0.2 * e.power, 1.4);
        ps.emit(P.rays, e.x, e.y - 6 * e.power, Math.round(3 * e.power), back, C.white, 0.6 * e.power, 0.7);
        this.sfx("dash", e.power >= 2 ? 0.9 : 0.4, e.power >= 2 ? -8 : -4, e.x);
        break;
      }
      case EFX_DUSTWALL: {
        // plumes thrown out to both sides of the charge path
        // (behind the boss and under the entity layer, so the charging silhouette stays readable)
        const nx = -e.dy;
        const ny = e.dx;
        const bx = e.x - e.dx * 14;
        const by = e.y - e.dy * 10;
        for (let s = -1; s <= 1; s += 2) {
          ps.emit(dustPlume, bx + nx * 15 * s, by + ny * 8 * s, 1, Math.atan2(ny * s, nx * s), -1, 0.9, 1, Layer.FxBelow);
        }
        ps.emit(P.debris, bx, by, 1);
        break;
      }
      case EFX_IMPACT: {
        ps.emit(P.debris, e.x, e.y, 14);
        ps.emit(dustPlume, e.x, e.y, 6, NaN, -1, 1.2, 1.4);
        if (!calm) {
          juice.shake(0.5 * e.power + 0.15);
          juice.zoomPunch(0.04);
        }
        this.sfx("explosion", 0.8, -7, e.x);
        o?.haptic(25);
        break;
      }
      case EFX_ROAR: {
        this.sfx("bossRoar", 1, 0, e.x);
        this.texts.add("ROOOAR!", e.x, e.y - 30, { color: C.red, scale: 2, life: 1, wobble: 3, rise: 14 });
        for (let i = 0; i < 3; i++) this.after(i * 0.14, () => ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.red, 3 + i * 1.5));
        ps.emit(P.rays, e.x, e.y, 16, NaN, C.red, 1.2, 1.3);
        if (!calm) {
          juice.shake(0.7 * e.power);
          juice.aberration(2.5);
          fx.speed.radial(0.7, { color: C.red, intensity: 0.75 });
        }
        if (o?.sound) audio.duck(0.4, 0.9);
        o?.haptic(50);
        break;
      }
      case EFX_SUMMON: {
        ps.emit(P.ring, e.x, e.y - 4, 1, NaN, C.violet, 1.2 * e.power);
        ps.emit(P.smoke, e.x, e.y - 4, 3, NaN, -1, 0.9 * e.power);
        ps.emit(P.sparkle, e.x, e.y - 6, 5, NaN, C.lavender);
        break;
      }
      case EFX_TELE_OUT: {
        ps.emit(gather, e.x, e.y, 14, NaN, C.lavender, 1.6, 1.6);
        ps.emit(P.sparkle, e.x, e.y, 14, NaN, -1, 1.3, 1.8);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.lavender, 2.2);
        this.sfx("reroll", 0.7, 4, e.x);
        break;
      }
      case EFX_TELE_IN: {
        ps.emit(P.sparkle, e.x, e.y, 22, NaN, -1, 1.4, 2.4);
        ps.emit(P.ring, e.x, e.y, 1, NaN, C.lavender, 2.4);
        ps.emit(P.flare, e.x, e.y, 1, NaN, C.white, 1.6);
        if (!calm) fx.juice.shockwave(e.x, e.y, 0.5, 60, 0.4);
        this.sfx("reroll", 0.7, 9, e.x);
        break;
      }
      case EFX_FUSE: {
        ps.emit(P.flare, e.x, e.y, 1, NaN, C.red, 0.7);
        this.sfx("telegraph", 0.45, 7, e.x);
        break;
      }
      case EFX_WISP_BOOM: {
        if (this.fxBudget-- <= 0) break;
        ps.emit(wispFlame, e.x, e.y, 10, NaN, -1, e.power / 16);
        if (e.dx > 0) ps.emit(P.ring, e.x, e.y, 1, NaN, C.red, e.power / 14);
        break;
      }
      case EFX_EYE_CHARGE: {
        this.sfx("telegraph", 0.3, 12, e.x);
        break;
      }
      case EFX_CLAW: {
        this.sfx("slash", 1, -6, e.x);
        this.after(0.16, () => this.sfx("slash", 0.9, -3, e.x));
        this.after(0.32, () => this.sfx("slash", 0.8, 0, e.x));
        ps.emit(P.rays, e.x, e.y - 18, 18, NaN, C.white, 1.2, 1.5);
        if (!calm) {
          juice.shake(0.35);
          juice.shockwave(e.x, e.y, 0.7, NT_SWEEP_R * 2, 0.5);
        }
        o?.haptic(30);
        break;
      }
      case EFX_CAST: {
        ps.emit(P.sparkle, e.x, e.y, Math.round(6 * e.power), NaN, -1, 1.1, 1.5);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.lavender, 1.2 * e.power);
        this.sfx("telegraph", 0.6, 0, e.x);
        break;
      }
      case EFX_DAWN_POP: {
        const en = e.enemy;
        if (!en) break;
        let p: Pop | null = null;
        for (let i = 0; i < MAX_POPS && !p; i++) if (!this.pops[i].on) p = this.pops[i];
        if (!p) break;
        const def = en.def;
        const a = this.anims.fps(def.sprite, def.fps ?? 0);
        const f = def.frame ? def.frame(en) : 0;
        p.on = true;
        p.t = DAWN_AT + e.power;
        p.h = a.first + ((f >= 0 ? f : 0) % a.count);
        p.x = en.x;
        p.y = en.y - en.z;
        p.sx = en.face * en.scale;
        p.sy = en.scale;
        p.scale = en.scale;
        p.colors = def.colors;
        break;
      }
    }
  }

  /** The final boss is down: chained explosions up her body until the dawn flash. */
  private finalDeath(x: number, y: number): void {
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!this.o?.calm;
    const n = 14;
    for (let i = 0; i < n; i++) {
      this.after(0.15 + i * (DAWN_AT - 0.3) / n, () => {
        const a = i * 2.4;
        const rr = 8 + (i % 4) * 5;
        airBurst(fx, x + Math.cos(a) * rr, y - 24 - Math.sin(a) * rr * 0.8 - i, 12 + i * 1.2, !calm && i % 3 === 0);
        this.sfx(i % 4 === 3 ? "explosionBig" : "explosion", 0.7, i % 5, x);
      });
    }
    if (!calm) juice.slowmo(0.25, DAWN_AT + 0.3);
  }

  /** VICTORY: the dawn flash, "DAWN BREAKS!", sunrise sweep, fireworks, victory music. */
  private victory(): void {
    const o = this.o;
    const w = this.w;
    if (!w) return;
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!o?.calm;
    this.vicT = 0;
    if (o?.sound) audio.duck(0.75, DAWN_AT);
    this.after(DAWN_AT, () => {
      const p = w.player;
      const bx = this.throeX || p.x;
      const by = (this.throeY || p.y) - 26;
      juice.flash(C.white, 1, 1.1);
      if (!calm) {
        juice.hitstop(140);
        juice.shake(0.9);
        juice.shockwave(bx, by, 2.6, 280, 1.3);
        juice.bloomSurge(1.5, 2.2);
        juice.aberration(4);
      }
      fx.ps.emit(P.rays, bx, by, 40, NaN, C.paleYellow, 1.6, 2);
      fx.ps.emit(P.pillar, bx, by - 10, 1, NaN, C.paleYellow, 4);
      fx.ps.emit(P.pillar, bx, by - 10, 1, NaN, C.white, 2.8);
      fx.ps.emit(P.ring, bx, by, 1, NaN, C.white, 6);
      fx.ps.emit(P.ringThin, bx, by, 1, NaN, C.paleYellow, 9);
      fx.ps.emit(P.confetti, bx, by, 60, NaN, -1, 1.4, 2);
      this.sfx("explosionBig");
      this.sfx("victory");
      if (o?.sound) audio.music("victory", 0.5);
      o?.haptic(140);
      this.r.camera.zoomTo(1, 2.5);
    });
    this.after(DAWN_AT + 0.35, () => {
      const vt = w.stage.victory;
      // (every stage's texts fit a portrait phone: the title steps down to the largest whole pixel scale that
      // fits, a long line - "the network has approved another season" - wraps onto two rows)
      const vw = this.r.camera.view.w;
      const tw = this.r.text.measure(vt.title, 1);
      // ("DAWN BREAKS!" keeps its x3 on a 217 px portrait view: 213 px)
      const ts = Math.max(1, Math.min(3, Math.floor((vw - 2) / Math.max(1, tw))));
      const room = vw - 8;
      this.texts.add(vt.title, 0, -46, { anchor: 2, scale: ts, rainbow: true, life: 4.8, wobble: 2, rise: 4 });
      const rows = this.r.text.measure(vt.line, 1) > room ? splitMiddle(vt.line) : [vt.line];
      for (let i = 0; i < rows.length; i++) this.texts.add(rows[i], 0, -22 + i * 9, { anchor: 2, scale: 1, color: C.paleYellow, life: 4.4, delay: 0.5, rise: 2 });
      this.pose(4);
      o?.hooks?.victory?.();
    });
    // fireworks until the results modal
    for (let i = 0; i < 18; i++) {
      this.after(DAWN_AT + 0.5 + i * 0.27, () => {
        const v = this.r.camera.view;
        fxFirework(fx, v.x + 20 + Math.random() * (v.w - 40), v.y + 24 + Math.random() * v.h * 0.45);
        if (i % 3 === 0) this.sfx("explosion", 0.4, 7 + (i % 5));
      });
    }
  }
}

/** Split a line at the space nearest its middle (victory lines too wide for a portrait view). */
function splitMiddle(s: string): string[] {
  const mid = s.length / 2;
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
}
