/**
 * The Final Arc visuals (stage 5): what the generic drawer can't express for
 * Shadow Clones, Filler Goons, Plot Holes, Animation Errors, Mini Truck-kun,
 * Truck-kun, Rival-chan and CANCEL-SAMA, plus the commercial breaks and the
 * "PREVIOUSLY ON..." flashbacks.
 *
 *   decorate  per enemy (through s45-fx.ts): sepia flashback re-runs, the clones' red
 *             eyes + violet afterimages, goons copying the Filler Boss's facing, plot-hole
 *             gravity streaks, Animation Errors going off-model (RGB split, x2 / squashed
 *             frames, the Key Animation Missing sketch outline), headlight tells and
 *             Semi-Trucks, the evil moustached Truck-kun, Rival-chan's headband tails,
 *             flame aura and push-ups, Cancel-sama's off-model jitter
 *   draw      letterbox + eyecatch cards, Cancel stamps + CANCELLED decals, the ratings
 *             chart, Rival-chan's beams, still-frame borders, the EPISODE ENDS IN 60 /
 *             OVERTIME countdown, the "Reduce flashing" degradation badge, death scenes
 *             (Truck-kun's light pillar, the smoke bomb, colour flooding back), captions
 *   bind      the 450-499 `enemyFx` cues (enemies/_s45.ts), boss deaths, the `cancel`
 *             theme's degrade level (AudioAPI.setDegrade)
 *
 * Reads the world, never mutates it. No per-frame allocation (fixed tick rings).
 */
import { C } from "../art/palette";
import { audio } from "../audio";
import { rainbow } from "../core/color";
import { TAU, clamp, ease } from "../core/math";
import { P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { SpriteInfo } from "../render/atlas";
import type { Renderer } from "../render/renderer";
import type { TextOpts } from "../render/text";
import type { EnemyFxEvent } from "../game/events";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import {
  BX_BEAM_CHARGE,
  BX_BEEP,
  BX_CALL,
  BX_COMMERCIAL,
  BX_CONE,
  BX_CUT,
  BX_DEGRADE,
  BX_FILLED,
  BX_FLASHBACK,
  BX_HONK,
  BX_HORN,
  BX_ISEKAI,
  BX_MIRROR,
  BX_MONTAGE,
  BX_RERUN,
  BX_SKIP,
  BX_SLASH,
  BX_STAMP,
  BX_STILL,
  BX_SWALLOW,
  BX_TRUCK_LANE,
} from "../game/enemies/_s45";
import { HOLE_PULL_R } from "../game/enemies/plot-hole";
import { MODE_STRAIGHT } from "../game/types";
import { TK_GONE, TK_HORN_TELE, TK_LANE_TELE, truckState } from "../game/bosses/truck-kun";
import { BEAM_LEN, FINAL_HALF, RV_BEAM, RV_BEAM_TELE, RV_FINAL, RV_FINAL_TELE, RV_MONTAGE, rivalState } from "../game/bosses/rival-chan";
import { DECAL_LIFE, DEGRADE, GRAPH_N, STAMP_N, STAMP_R, cancelState } from "../game/bosses/cancel-sama";
import { FLASHBACK_TINT, commercialOf, isFlashback } from "../game/director/events-s45";
import type { Anims } from "./anims";
import { bulletLook } from "./bullet-looks";
import { Captions, popText, step, tick, ticks, type S45BindOpts } from "./s45-common";
import type { Speech } from "./speech";
import type { WorldTexts } from "./texts";

const PI = Math.PI;

bulletLook("eb_cone", { glow: C.orange, glowR: 8.5, velRot: false });
const RIVAL_RIM = 0xff3d6e;
/**
 * boss_truck's cargo-box lettering block (logo, "REINCAR- / NATION",
 * "SERVICES" on the stripe) in rest-pose sprite pixels, and the per-frame body
 * offset / tilt it was drawn with (src/art/sprites/s2-bosses-truck.ts POSES).
 */
const LIV_X0 = 5;
const LIV_X1 = 43;
const LIV_Y0 = 7;
const LIV_H = 23;
const LIVERY_POSE: ({ dy: number; tilt: number } | undefined)[] = [
  { dy: 0, tilt: 0 },
  { dy: 1, tilt: 0 },
  { dy: 0, tilt: 0 },
  { dy: 0, tilt: 3 },
  undefined,
  { dy: 0, tilt: 0 },
];
bulletLook("eb_rival", { glow: C.orange, glowR: 9.5, spin: 6 });
bulletLook("eb_memo", { glow: C.red, glowR: 9.5, spin: 1.6 });

const PHASE_NAMES = ["", "PITCH MEETING", "RATINGS DROP", "BUDGET CUTS", "RUSHED ENDING"];
/** "EPISODE ENDS IN n" for n = 0..60 (built once: no per-frame string building). */
const COUNTDOWN: readonly string[] = Array.from({ length: 61 }, (_, i) => `EPISODE ENDS IN ${i}`);
/** Reused text options (mutated per draw, never allocated per frame). */
const DECAL_TXT: TextOpts = { layer: Layer.Decal, align: "center", valign: "middle", scale: 2, color: C.red, alpha: 1, rotation: -0.18 };
const STAMP_TXT: TextOpts = { layer: Layer.Text, align: "center", valign: "middle", scale: 1, color: C.white, alpha: 1 };
const COUNT_TXT: TextOpts = { layer: Layer.Text, align: "center", scale: 1, color: C.white, alpha: 0.95, wobble: 0 };

// ---------------------------------------------------------------- emitters
const pull: EmitterDef = { ...P.sparkle, colors: [C.violet, C.lavender, C.white], speed: [36, 56], life: [0.9, 1.3], drag: 0, size: [0.6, 0.2] };
const paper: EmitterDef = { ...P.confetti, colors: [C.white, C.offWhite, C.lavender, C.violet], speed: [30, 90] };
const glitchBits: EmitterDef = { sprite: "fx_glitch", frames: "random", speed: [4, 24], life: [0.12, 0.3], size: [0.8, 0.8], colors: [C.pink, C.cyan, C.lime, C.white], additive: true, glow: true, alphaCurve: "none", layer: Layer.FxAdd };
const flame: EmitterDef = { ...P.ember, colors: [C.red, C.orange, C.yellow], speed: [12, 36], gravity: -60, life: [0.3, 0.55] };
const smoke: EmitterDef = { ...P.smoke, speed: [20, 70], life: [0.6, 1.1], size: [1.2, 2.2], colors: [C.offWhite, C.lavender, 0x9a8fb8] };
const pillarSpark: EmitterDef = { ...P.sparkle, speed: [6, 26], angle: -PI / 2, spread: 0.5, life: [0.5, 0.9], colors: [C.paleYellow, C.white, C.aqua] };
const exhaust: EmitterDef = { ...P.ember, colors: [C.orange, C.yellow, C.red], speed: [10, 30], life: [0.15, 0.3] };

/** Eye pixel offset (from the sprite's top-left) of the hero sprites: Truck-kun's are elsewhere. */
function eyeAt(hero: string, out: { x: number; y: number }): void {
  if (hero === "truck_kun") {
    out.x = 25;
    out.y = 9;
  } else {
    out.x = 14;
    out.y = 8;
  }
}

export class FinaleFx {
  private w: World | null = null;
  private o: S45BindOpts | null = null;
  private now = 0;
  private frameN = 0;
  private live = true;
  private readonly hPillar: number;
  private readonly nPillar: number;
  private readonly hHonk: number;
  private readonly hMoustache: number;
  private readonly truckArt: SpriteInfo;
  private readonly hCone: number;
  private readonly hGlitch: number;
  private readonly hBeam: number;
  private readonly eye = { x: 0, y: 0 };
  // timed visuals
  private readonly pillars = ticks(12);
  private readonly honks = ticks(3);
  private readonly cones = ticks(10);
  private readonly slashes = ticks(6);
  private readonly waves = ticks(6);
  private readonly stills = ticks(1);
  private readonly backs = ticks(1);
  private readonly flashbacks = ticks(1);
  private readonly smokes = ticks(1);
  private readonly cuts = ticks(2);
  private readonly captions: Captions;
  private honkAt = -1;
  private degrade = 0;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly anims: Anims,
    private readonly texts: WorldTexts,
    speech: Speech,
  ) {
    const pl = anims.get("fx_light_pillar");
    this.hPillar = pl.first;
    this.nPillar = pl.count;
    this.hHonk = anims.get("fx_honk").first;
    this.hMoustache = anims.get("boss_truck_moustache").first;
    this.truckArt = r.atlas.info("boss_truck");
    this.hCone = anims.get("eb_cone").first;
    this.hGlitch = anims.get("fx_glitch").first;
    this.hBeam = r.atlas.handle("fx_beam");
    this.captions = new Captions(speech);
  }

  setWorld(w: World): void {
    this.w = w;
    for (const l of [this.pillars, this.honks, this.cones, this.slashes, this.waves, this.stills, this.backs, this.flashbacks, this.smokes, this.cuts]) for (const t of l) t.life = 0;
    this.degrade = 0;
    this.captions.clear();
  }

  dispose(): void {
    this.laters.length = 0;
    this.captions.clear();
    if (this.degrade !== 0 && this.o?.sound) audio.setDegrade?.(0);
    this.degrade = 0;
  }

  private sfx(id: Parameters<S45BindOpts["sfx"]>[0], vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  private get reduced(): boolean {
    return !!this.fx.juice?.settings?.reduceFlashing;
  }

  // ================================================================ per enemy
  /** A "PREVIOUSLY ON..." re-run: drawn in sepia whatever it is. */
  flashback(e: Enemy, h: number, sx: number, sy: number, y: number, flash: number, alpha: number): boolean {
    const w = this.w;
    if (!w || !isFlashback(w, e.uid)) return false;
    this.r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, FLASHBACK_TINT, alpha * 0.92, flash, 0);
    return true;
  }

  decorate(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number, alpha: number): boolean {
    const w = this.w;
    if (!w) return false;
    const r = this.r;
    const live = this.live;
    switch (e.def.id) {
      case "shadow_clone": {
        if (live && (this.frameN + e.uid) % 4 === 0) this.fx.ghosts.spawn(h, e.x, y, sx, sy, 0, C.darkViolet, 0.22, 0.45, Layer.FxBelow, true);
        // a thin violet rim so the near-black clone reads on the dark storyboard
        r.batch.sortKey = e.y - 0.01;
        for (let k = 0; k < 4; k++) r.spr(Layer.Entity, h, e.x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0), sx, sy, 0, C.violet, 0.75 * alpha, 1, 0);
        r.batch.sortKey = NaN;
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, tint, alpha, flash, 0);
        // two red eye pixels where the hero's eyes are
        const info = r.atlas.info(e.skin || e.def.sprite);
        eyeAt(w.hero.id, this.eye);
        const ex = e.x + (this.eye.x - info.w / 2) * sx;
        const ey = y - (info.h - this.eye.y) * Math.abs(sy);
        r.rect(Layer.Text, Math.round(ex), Math.round(ey), 1, 1, C.red, alpha);
        r.rect(Layer.Text, Math.round(ex - 2 * Math.sign(sx)), Math.round(ey), 1, 1, C.red, alpha);
        r.glow(ex, ey, 3, C.red, 0.5 * alpha, Layer.FxAdd);
        if (e.elite) r.glow(e.x, y - 8, 12, C.darkViolet, 0.3);
        // Truck-kun's clone honks. Silently.
        if (w.hero.id === "truck_kun" && Math.floor(e.t * 0.4 + e.uid * 0.13) % 5 === 0 && (e.t * 0.4 + e.uid * 0.13) % 1 < 0.02) tick(this.honks, e.x, y - 22, 0, 0, 0.7, 1, 0.6);
        return true;
      }
      case "filler_goon": {
        // a Filler Boss nearby: everyone faces the way it faces
        if (w.t >= e.b || e.elite) return false;
        r.spr(Layer.Entity, h, e.x, y, Math.abs(sx) * (e.c >= 0 ? 1 : -1), sy, 0, tint, alpha, flash, 0);
        return true;
      }
      case "plot_hole": {
        const q = (time * 0.6 + e.uid * 0.1) % 1;
        r.ring(Layer.Decal, e.x, e.y - e.cy, HOLE_PULL_R * (1 - q), C.violet, 0.22 * q, 0, false);
        r.circle(Layer.Decal, e.x, e.y - e.cy, 15, C.deep, 0.5);
        if (live && (this.frameN + e.uid) % 3 === 0) {
          const a = Math.random() * TAU;
          this.fx.ps.emit(pull, e.x + Math.cos(a) * 78, e.y - e.cy + Math.sin(a) * 60, 1, a + PI);
        }
        r.spr(Layer.Entity, h, e.x, y, sx, sy, Math.sin(time * 1.3) * 0.08, tint, alpha, flash, 0);
        return true;
      }
      case "animation_error": {
        // off-model: now and then one frame at x2 or squashed; RGB-split edges always
        const ph = (e.t + e.a) % 1.5;
        let ksx = 1;
        let ksy = 1;
        if (ph < 0.07) {
          if (Math.floor((e.t + e.a) / 1.5) & 1) {
            ksx = 2;
            ksy = 2;
          } else {
            ksx = 1.5;
            ksy = 0.5;
          }
          if (live && ph < 0.02) this.fx.ps.emit(glitchBits, e.x, y - 8, 2);
        }
        if (e.elite) {
          // Key Animation Missing: a sketch outline
          for (let k = 0; k < 4; k++) r.spr(Layer.Entity, h, e.x + (k === 0 ? 1 : k === 1 ? -1 : 0), y + (k === 2 ? 1 : k === 3 ? -1 : 0), sx * ksx, sy * ksy, 0, C.lavender, 0.8 * alpha, 1, 0);
          r.spr(Layer.Entity, h, e.x, y, sx * ksx, sy * ksy, 0, C.offWhite, 0.25 * alpha, 0, 0);
          return true;
        }
        // RGB-split edges: a red and a cyan copy a pixel either side, under the sprite (not on the glitch frame itself)
        if (ksx === 1) {
          r.batch.sortKey = e.y - 0.01;
          r.spr(Layer.Entity, h, e.x - 1, y, sx, sy, 0, C.red, 0.55 * alpha, 1, 0);
          r.spr(Layer.Entity, h, e.x + 1, y, sx, sy, 0, C.cyan, 0.55 * alpha, 1, 0);
          r.batch.sortKey = NaN;
        }
        r.spr(Layer.Entity, h, e.x, y, sx * ksx, sy * ksy, 0, tint, alpha, flash, 0);
        return true;
      }
      case "dropped_frame": {
        const flick = ((time * 20 + e.uid) | 0) & 1 ? 0.5 : 0.32;
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, C.lavender, flick * (1 - e.t / 1.5), 0.6, 0);
        return true;
      }
      case "mini_truck": {
        const semi = e.elite ? 2 : 1;
        const straight = e.mode === MODE_STRAIGHT;
        if (!straight && e.state === 0) this.headlights(e.x + e.face * 10 * e.scale * semi, y - 6 * e.scale, e.c, e.d, time, 0.8);
        if ((straight || e.state === 1) && live && (this.frameN + e.uid) % 2 === 0) this.fx.ps.emit(exhaust, e.x - e.face * 12 * e.scale * semi, y - 3, 1, e.face > 0 ? PI : 0);
        r.spr(Layer.Entity, h, e.x, y, sx * semi, sy, 0, tint, alpha, flash, 0);
        return true;
      }
      case "truck_kun_boss": {
        const s = truckState(e);
        if (s && e.state === TK_GONE) return true;
        if (s && (e.state === TK_LANE_TELE || e.state === TK_HORN_TELE)) this.headlights(e.x + e.face * 30, y - 16, s.dx, s.dy, time, 1.6);
        const col = s?.evil ? 0xff9a3d : tint;
        if (!s?.evil && sx >= 0) return false;
        r.batch.sortKey = e.y;
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, col, alpha, flash, 0);
        r.batch.sortKey = e.y + 0.01;
        // driving left: the art faces right, so re-draw the "REINCARNATION SERVICES" livery un-mirrored
        if (sx < 0) this.livery(h - this.truckArt.first, h, e.x, y, -sx, sy, col, alpha, flash);
        // the evil alternate-universe one: orange, moustached
        if (s?.evil) r.spr(Layer.Entity, this.hMoustache, e.x + e.face * 27, y - 11, Math.sign(sx), 1, 0, 0xffffff, alpha, 0, 0);
        r.batch.sortKey = NaN;
        return true;
      }
      case "rival_chan": {
        const s = rivalState(e);
        if (!s) return false;
        const S = e.scale;
        const head = y - 19 * S;
        // the headband's long tails stream behind her
        for (let k = 0; k < 2; k++) {
          let px = e.x - e.face * 4;
          let py = head + k * 2;
          for (let j = 1; j <= 5; j++) {
            const nx = e.x - e.face * (4 + j * 4) + Math.sin(time * 8 + j * 0.8 + k) * 0.6;
            const ny = head + k * 2 + Math.sin(time * 7 + j * 1.1 + k * 2) * (1 + j * 0.5);
            r.line(Layer.Entity, px, py, nx, ny, 2, C.red, alpha);
            px = nx;
            py = ny;
          }
        }
        if (s.phase >= 2) {
          r.glow(e.x, y - 20, 28, C.orange, 0.22 + 0.08 * Math.sin(time * 9), Layer.FxAdd);
          if (live && this.frameN % 2 === 0) this.fx.ps.emit(flame, e.x + (Math.random() - 0.5) * 20, y - 4, 1);
        }
        if (e.state === RV_MONTAGE) {
          // push-ups: lying down, bobbing
          const bob = Math.abs(Math.sin(time * 6)) * 4;
          this.rim(e, h, e.x, y - 4 - bob, sy, sx * 0.9, e.face * (PI / 2), RIVAL_RIM, alpha);
          r.spr(Layer.Entity, h, e.x, y - 4 - bob, sy, sx * 0.9, e.face * (PI / 2), tint, alpha, flash, 0);
          if (live && this.frameN % 12 === 0) this.fx.ps.emit(P.sparkle, e.x + e.face * 14, y - 14, 1, NaN, C.lightBlue);
          return true;
        }
        if (e.state === RV_BEAM_TELE || e.state === RV_FINAL_TELE) {
          const k = clamp(e.timer / (e.state === RV_FINAL_TELE ? 2 : 0.8), 0, 1);
          r.glow(e.x + Math.cos(s.beam) * 10, y - 20 + Math.sin(s.beam) * 10, 6 + 12 * k, e.state === RV_FINAL_TELE ? C.red : C.orange, 0.4 + 0.4 * k, Layer.FxAdd);
        }
        // a hot rim so the dark recolour reads on the night storyboard (and never looks like the hero)
        this.rim(e, h, e.x, y, sx, sy, 0, RIVAL_RIM, alpha);
        return false;
      }
      case "cancel_sama": {
        const s = cancelState(e);
        if (!s || s.phase < 3) return false;
        // BUDGET CUTS: he flickers off-model
        const j = Math.sin(time * 23 + Math.sin(time * 7) * 3) * 0.1;
        r.spr(Layer.Entity, h, e.x, y, sx * (1 + j), sy * (1 - j * 0.6), 0, tint, alpha, flash, 0);
        if (((time * 3) | 0) % 4 === 0) {
          r.spr(Layer.FxAdd, h, e.x - 2, y, sx * (1 + j), sy * (1 - j * 0.6), 0, C.pink, 0.3 * alpha, 0, Flag.Add);
          r.spr(Layer.FxAdd, h, e.x + 2, y, sx * (1 + j), sy * (1 - j * 0.6), 0, C.cyan, 0.3 * alpha, 0, Flag.Add);
        }
        return true;
      }
      default:
        return false;
    }
  }

  /**
   * Boss Truck-kun's cargo-box lettering, copied un-flipped over the flipped
   * sprite (frame f; s = |scale x|). Rest poses copy one rectangle; the tilted
   * charge frame goes column by column so the racing stripe stays registered.
   * The drift frame (sheared) keeps the plain flip.
   */
  private livery(f: number, h: number, x: number, y: number, s: number, sy: number, col: number, a: number, flash: number): void {
    const P = LIVERY_POSE[f];
    if (P === undefined) return;
    const art = this.truckArt;
    const b = this.r.batch;
    const top = LIV_Y0 + P.dy;
    const tilt = P.tilt;
    if (!tilt) {
      b.drawSub(Layer.Entity, h, LIV_X0, top, LIV_X1 - LIV_X0 + 1, LIV_H, x, y, s, sy, col, a, flash, 0, LIV_X1 + 1 - art.ox, art.oy - top);
      return;
    }
    for (let c = LIV_X0; c <= LIV_X1; c++) {
      const m = LIV_X0 + LIV_X1 - c; // the flipped column drawn where this one goes
      const oc = Math.round(((c - 10) / 60) * tilt);
      const om = Math.round(((m - 10) / 60) * tilt);
      b.drawSub(Layer.Entity, h, c, top + oc, 1, LIV_H, x, y, s, sy, col, a, flash, 0, m + 1 - art.ox, art.oy - top - om);
    }
  }

  /** A 1 px silhouette outline under the sprite (4 offset flat-tinted copies). */
  private rim(e: Enemy, h: number, x: number, y: number, sx: number, sy: number, rot: number, col: number, a: number): void {
    const r = this.r;
    const o = Math.max(1, Math.round(e.scale * 0.75));
    r.batch.sortKey = e.y - 0.01;
    r.spr(Layer.Entity, h, x + o, y, sx, sy, rot, col, 0.85 * a, 1, 0);
    r.spr(Layer.Entity, h, x - o, y, sx, sy, rot, col, 0.85 * a, 1, 0);
    r.spr(Layer.Entity, h, x, y + o, sx, sy, rot, col, 0.85 * a, 1, 0);
    r.spr(Layer.Entity, h, x, y - o, sx, sy, rot, col, 0.85 * a, 1, 0);
    r.batch.sortKey = NaN;
  }

  /** Headlight flash + a beam cone along the lane (Mini Truck-kun / Truck-kun tells). */
  private headlights(x: number, y: number, dx: number, dy: number, time: number, s: number): void {
    const r = this.r;
    const on = ((time * 8) | 0) & 1;
    r.glow(x, y, 6 * s, C.paleYellow, on ? 0.85 : 0.35, Layer.FxAdd);
    const ang = Math.atan2(dy, dx);
    r.batch.drawP(Layer.FxAdd, this.hBeam, x + dx * 28 * s, y + dy * 28 * s, 2.2 * s, (28 * s) / 16, ang - PI / 2, C.paleYellow, on ? 0.3 : 0.14, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 4, 16);
  }

  // ================================================================ per frame
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.frameN++;
    this.now += realDt;
    this.live = dt > 0;
    this.flushLater();
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (e.dead) continue;
      if (e.def.id === "cancel_sama") this.drawCancel(e, time);
      else if (e.def.id === "rival_chan") this.drawBeams(e, time);
    }
    this.drawTicks(time, realDt);
    this.drawOverlays(time, realDt);
  }

  private drawCancel(e: Enemy, time: number): void {
    const s = cancelState(e);
    if (!s) return;
    const r = this.r;
    // stamps on their way down + CANCELLED decals
    for (let i = 0; i < STAMP_N; i++) {
      if (s.st[i] >= 0) {
        const k = clamp(s.st[i] / 0.35, 0, 1);
        const hgt = 14 + 70 * ease.quadIn(k);
        r.shadow(s.sx[i], s.sy[i], 30 * (1.2 - 0.6 * k), 0.6);
        this.stampShape(s.sx[i], s.sy[i] - hgt, 1 - 0.25 * k, 1);
      } else if (s.decal[i] >= 0) {
        const a = s.decal[i];
        const fade = a > DECAL_LIFE - 0.7 ? (DECAL_LIFE - a) / 0.7 : 1;
        const pop = a < 0.12 ? 1.3 - (a / 0.12) * 0.3 : 1;
        DECAL_TXT.scale = 2 * pop;
        DECAL_TXT.alpha = 0.8 * fade;
        r.text.draw("CANCELLED", s.sx[i], s.sy[i], DECAL_TXT);
        r.ring(Layer.Decal, s.sx[i], s.sy[i], STAMP_R * 0.8, C.red, 0.5 * fade, 0, true);
      }
    }
    // the ratings chart during its hold
    if (s.graphT >= 0) {
      const k = clamp(s.graphT / 0.3, 0, 1);
      for (let i = 0; i < GRAPH_N - 1; i++) {
        if (i === s.gap || i === s.gap - 1 || i === s.gap + 1) continue;
        const a = (i + 1) / GRAPH_N;
        if (a > k) break;
        r.line(Layer.Decal, s.px[i], s.py[i], s.px[i + 1], s.py[i + 1], 1, C.red, 0.8);
      }
      r.text.drawFast(Layer.Text, "RATINGS", Math.round(s.px[0]), Math.round(s.py[0] - 12), 1, C.red, 0.9 * (0.75 + 0.25 * Math.sin(time * 12)), 0, 0, 0);
    }
  }

  /** A giant red rubber stamp ("CANCEL" on its face). */
  private stampShape(x: number, y: number, sc: number, a: number): void {
    const r = this.r;
    const w = 34 * sc;
    const h = 12 * sc;
    r.rect(Layer.Text, Math.round(x - 5 * sc), Math.round(y - h - 12 * sc), Math.round(10 * sc), Math.round(12 * sc), 0x8a3a2a, a);
    r.rect(Layer.Text, Math.round(x - w / 2 - 1), Math.round(y - h - 1), Math.round(w + 2), Math.round(h + 2), C.outline, a);
    r.rect(Layer.Text, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h), C.red, a);
    STAMP_TXT.scale = sc;
    STAMP_TXT.alpha = a;
    r.text.draw("CANCEL", x, y - h / 2, STAMP_TXT);
  }

  private drawBeams(e: Enemy, time: number): void {
    const s = rivalState(e);
    if (!s || (e.state !== RV_BEAM && e.state !== RV_FINAL)) return;
    const r = this.r;
    const x0 = e.x + Math.cos(s.beam) * 8;
    const y0 = e.y - 20 + Math.sin(s.beam) * 8;
    const x1 = e.x + Math.cos(s.beam) * BEAM_LEN;
    const y1 = e.y - 20 + Math.sin(s.beam) * BEAM_LEN;
    const fin = e.state === RV_FINAL;
    const wob = 1 + 0.15 * Math.sin(time * 40);
    const half = fin ? FINAL_HALF : 6;
    r.line(Layer.FxAdd, x0, y0, x1, y1, half * 2 * wob, fin ? C.red : C.orange, 0.5, Flag.Add | Flag.Glow);
    r.line(Layer.FxAdd, x0, y0, x1, y1, half * 0.9 * wob, C.yellow, 0.7, Flag.Add | Flag.Glow);
    r.line(Layer.FxAdd, x0, y0, x1, y1, Math.max(2, half * 0.35), C.white, 0.95, Flag.Add | Flag.Glow);
    r.glow(x0, y0, half + 8, C.white, 0.6, Layer.FxAdd);
    if (this.live && this.frameN % 2 === 0) {
      const t = Math.random();
      this.fx.ps.emit(flame, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1);
    }
  }

  // ---------------------------------------------------------------- timed visuals
  private drawTicks(time: number, realDt: number): void {
    const r = this.r;
    for (const t of this.pillars) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const f = Math.min(this.nPillar - 1, Math.floor(k * this.nPillar));
      r.spr(Layer.FxAdd, this.hPillar + f, t.x, t.y, t.r, t.r * (0.8 + 0.4 * k), 0, 0xffffff, 1 - k * k, 0, Flag.Add | Flag.Glow);
      if (t.r > 2 && this.live && this.frameN % 2 === 0) this.fx.ps.emit(pillarSpark, t.x + (Math.random() - 0.5) * 20 * t.r, t.y - 10, 1);
    }
    for (const t of this.honks) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const pop = k < 0.2 ? 0.6 + 2 * k : 1;
      r.spr(Layer.Text, this.hHonk + (((time * 20) | 0) & 1), t.x, t.y - 6 * k, pop * t.r, pop * t.r, Math.sin(time * 30) * 0.08, t.n ? C.lavender : 0xffffff, 1 - k * k, 0, 0);
    }
    for (const t of this.cones) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const x = t.x + (t.x2 - t.x) * k;
      const y = t.y + (t.y2 - t.y) * k - Math.sin(k * PI) * 46;
      r.spr(Layer.Bullets, this.hCone, x, y, 1, 1, k * TAU * 1.5, 0xffffff, 1, 0, Flag.NoSnap);
    }
    for (const t of this.slashes) {
      const k = step(t, realDt);
      if (k < 0) continue;
      r.line(Layer.FxAdd, t.x, t.y, t.x2, t.y2, 5 * (1 - k), C.red, 0.7 * (1 - k), Flag.Add | Flag.Glow);
      r.line(Layer.FxAdd, t.x, t.y, t.x2, t.y2, 2 * (1 - k), C.white, 0.9 * (1 - k), Flag.Add | Flag.Glow);
    }
    for (const t of this.waves) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const col = t.n === 1 ? rainbow(time * 0.8 + k, 0.7) : t.n || C.yellow;
      r.ring(Layer.Overlay, t.x, t.y, t.r * ease.cubicOut(k), col, 0.7 * (1 - k), Flag.Add | Flag.Glow, true);
    }
    for (const t of this.smokes) {
      const k = step(t, realDt);
      if (k < 0) continue;
      if (k < 0.1 && this.live) this.fx.ps.emit(smoke, t.x, t.y - 16, 3);
    }
    // CUT TO: a burst of TV static where he lands, rolling bars fading out
    for (const t of this.cuts) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const a = (1 - k) * (this.reduced ? 0.4 : 1);
      const bw = 74;
      const bh = 84;
      const x0 = Math.round(t.x - bw / 2);
      const y0 = Math.round(t.y - bh + 6);
      for (let row = 0; row < bh; row += 3) {
        const g = 0.35 + Math.random() * 0.65;
        const c = g > 0.85 ? C.white : g > 0.6 ? C.lavender : 0x5a5370;
        const jx = ((Math.random() - 0.5) * 6 * a) | 0;
        r.rect(Layer.Overlay, x0 + jx, y0 + row, bw, 2, c, 0.55 * a * (0.6 + 0.4 * g));
      }
      if (this.reduced) continue;
      const roll = y0 + ((k * 3 * bh) % bh);
      r.rect(Layer.Overlay, x0, Math.round(roll), bw, 4, C.white, 0.5 * a);
    }
  }

  /** Screen-space overlays: letterbox + eyecatch, still frames, the countdown, the reduce-flashing badge. */
  private drawOverlays(time: number, realDt: number): void {
    const w = this.w!;
    const r = this.r;
    const v = r.camera.view;
    const cb = commercialOf(w);
    const back = this.backs[0];
    const kb = step(back, realDt);
    const inBreak = !!cb && cb.left > 0;
    if (inBreak || kb >= 0) {
      // letterbox bars slide in / out
      let k = 1;
      if (inBreak && cb) k = clamp((cb.dur - cb.left) / 0.35, 0, 1);
      else if (kb >= 0) k = 1 - clamp(kb / 0.5, 0, 1);
      const bh = Math.round(v.h * 0.11 * ease.cubicOut(k));
      if (bh > 0) {
        r.rect(Layer.Overlay, v.x - 2, v.y - 2, v.w + 4, bh + 2, C.deep, 0.92);
        r.rect(Layer.Overlay, v.x - 2, v.y + v.h - bh, v.w + 4, bh + 2, C.deep, 0.92);
      }
      // the eyecatch card (top, never over the hero)
      const label = inBreak ? "WE'LL BE RIGHT BACK!" : "AND WE'RE BACK!";
      const tw = r.text.measure(label, 1);
      const cw = tw + 26;
      const cx = Math.round(v.x + v.w / 2 - cw / 2);
      const cy = Math.round(v.y + v.h * 0.2 + (1 - k) * -10);
      r.rect(Layer.Overlay, cx - 1, cy - 1, cw + 2, 17, C.outline, k);
      r.rect(Layer.Overlay, cx, cy, cw, 15, inBreak ? C.yellow : C.pink, k);
      r.rect(Layer.Overlay, cx + 2, cy + 2, cw - 4, 11, C.white, k);
      r.text.drawFast(Layer.Overlay, label, cx + 13, cy + 4, 1, C.outline, k, 0, 0, 0);
      // a spinning star logo on both sides
      for (let s = -1; s <= 1; s += 2) r.spr(Layer.Overlay, this.hGlitch, cx + (s < 0 ? 6 : cw - 6), cy + 7, 0.7, 0.7, time * 3 * s, s < 0 ? C.pink : C.cyan, k, 0, 0);
    }
    // PREVIOUSLY ON...: sepia film flicker at the edges
    const kf = step(this.flashbacks[0], realDt);
    if (kf >= 0) {
      const a = (1 - kf) * (0.5 + 0.3 * (((time * 18) | 0) & 1));
      r.rect(Layer.Overlay, v.x - 2, v.y - 2, 8, v.h + 4, 0x4a3420, a);
      r.rect(Layer.Overlay, v.x + v.w - 6, v.y - 2, 8, v.h + 4, 0x4a3420, a);
      for (let y = v.y + ((time * 60) % 12); y < v.y + v.h; y += 12) {
        r.rect(Layer.Overlay, v.x, Math.round(y), 4, 6, FLASHBACK_TINT, a);
        r.rect(Layer.Overlay, v.x + v.w - 4, Math.round(y), 4, 6, FLASHBACK_TINT, a);
      }
      r.fillView(Layer.Overlay, FLASHBACK_TINT, 0.08 * (1 - kf));
    }
    // still frame: a held, framed panel
    const ks = step(this.stills[0], realDt);
    if (ks >= 0 && !this.reduced) {
      const a = 0.85 * (1 - ks * 0.5);
      r.rect(Layer.Overlay, v.x, v.y, v.w, 3, C.white, a);
      r.rect(Layer.Overlay, v.x, v.y + v.h - 3, v.w, 3, C.white, a);
      r.rect(Layer.Overlay, v.x, v.y, 3, v.h, C.white, a);
      r.rect(Layer.Overlay, v.x + v.w - 3, v.y, 3, v.h, C.white, a);
    }
    // CANCEL-SAMA alive: countdown + reduce-flashing badge
    const b = w.boss;
    const s = b && !b.dead && b.def.id === "cancel_sama" ? cancelState(b) : undefined;
    if (s) {
      const ty = Math.round(v.y + Math.max(36, v.h * 0.17) + 18);
      if (s.phase >= 4) {
        const label = s.overtime ? "OVERTIME" : COUNTDOWN[clamp(Math.ceil(s.episode), 0, 60)];
        COUNT_TXT.color = s.overtime ? C.red : s.episode < 10 ? C.yellow : C.white;
        COUNT_TXT.wobble = s.overtime ? 1 : 0;
        r.text.draw(label, v.x + v.w / 2, ty, COUNT_TXT);
      }
      if (this.reduced && s.phase >= 2) {
        const label = PHASE_NAMES[s.phase];
        const tw = r.text.measure(label, 1);
        const bx = Math.round(v.x + 6);
        const by = Math.round(ty + 12);
        r.rect(Layer.Text, bx - 1, by - 1, tw + 8, 11, C.outline, 0.9);
        r.rect(Layer.Text, bx, by, tw + 6, 9, s.phase === 2 ? 0x8a8a9a : s.phase === 3 ? C.orange : C.red, 0.9);
        r.text.drawFast(Layer.Text, label, bx + 3, by + 1, 1, C.white, 1, 0, 0, 0);
      }
    }
  }

  // ================================================================ events
  bind(w: World, o: S45BindOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    const bus = w.bus;
    return [
      bus.on("enemyFx", (e) => this.onFx(e)),
      bus.on("bossSpawn", (e) => {
        if (e.enemy.def.id === "cancel_sama") this.setDegrade(0);
      }),
      bus.on("enemyKilled", (e) => {
        if (!e.boss) return;
        const en = e.enemy;
        switch (en.def.id) {
          case "truck_kun_boss":
            tick(this.pillars, en.x, en.y, 0, 0, 3.2, 0, 2.6);
            this.captions.show("...HONK. (Translation: See you in the next world.)", en.x, en.y - 40, 3.6);
            this.later(0.3, () => this.sfx("honk", 0.8, -5, en.x));
            break;
          case "rival_chan":
            tick(this.smokes, en.x, en.y, 0, 0, 1, 0, 0.6);
            this.fx.ps.emit(smoke, en.x, en.y - 18, 14);
            popText(w, this.texts, "POOF!", en.x, en.y - 40, C.white, 1.8);
            this.captions.show("Hmph... you've gotten stronger. I'll be back next season!!", en.x, en.y - 50, 3.8);
            this.sfx("bubblePop", 1, -8, en.x);
            break;
          case "cancel_sama":
            // colour floods back in a wave from where he fell
            tick(this.waves, en.x, en.y - 30, 0, 0, Math.max(w.viewW, w.viewH) * 1.2, 1, 1.4);
            tick(this.waves, en.x, en.y - 30, 0, 0, Math.max(w.viewW, w.viewH) * 0.8, C.white, 1.1);
            this.captions.show("Fine. FINE. ...Renewed. Don't make me regret this.", en.x, en.y - 70, 3.6);
            this.setDegrade(0);
            break;
        }
      }),
    ];
  }

  private setDegrade(x: number): void {
    this.degrade = x;
    if (this.o?.sound) audio.setDegrade?.(x);
  }

  private readonly laters: { t: number; fn: () => void }[] = [];
  private later(sec: number, fn: () => void): void {
    this.laters.push({ t: this.now + sec, fn });
  }
  private flushLater(): void {
    const l = this.laters;
    for (let i = l.length - 1; i >= 0; i--) {
      if (this.now >= l[i].t) {
        const fn = l[i].fn;
        l.splice(i, 1);
        fn();
      }
    }
  }

  private onFx(e: EnemyFxEvent): void {
    const w = this.w;
    if (!w || e.kind < 450 || e.kind >= 500) return;
    const fx = this.fx;
    const ps = fx.ps;
    const o = this.o;
    const calm = !!o?.calm;
    switch (e.kind) {
      case BX_HONK: {
        // HONK pops: always on a lane start, at most one per second (satire.md §5)
        if (this.now - this.honkAt >= 1 || e.power >= 2) {
          this.honkAt = this.now;
          const p = w.player;
          let x = e.x;
          let y = e.y - 16;
          const dx = x - p.x;
          const dy = y - (p.y - 10);
          if (dx * dx + dy * dy < 32 * 32) {
            x = p.x + (dx >= 0 ? 34 : -34);
            y = p.y - 40;
          }
          const v = this.r.camera.view;
          x = clamp(x, v.x + 16, v.x + v.w - 16);
          y = clamp(y, v.y + 30, v.y + v.h - 16);
          tick(this.honks, x, y, 0, 0, e.power >= 3 ? 1.4 : 1, 0, 0.8);
          this.sfx("honk", e.power >= 2 ? 0.9 : 0.6, e.power >= 2 ? -3 : 2, e.x);
        }
        break;
      }
      case BX_ISEKAI:
        tick(this.pillars, e.x, e.y, 0, 0, e.power, 0, 0.6);
        ps.emit(pillarSpark, e.x, e.y - 10, 3);
        break;
      case BX_SWALLOW:
        ps.emit(pull, e.x, e.y, e.power > 1 ? 2 : 1, NaN, C.violet, 0.6, 0.3);
        break;
      case BX_FILLED:
        ps.emit(paper, e.x, e.y, 16);
        if (e.dx === 1) {
          popText(w, this.texts, "PLOT HOLE FILLED!", e.x, e.y - 18, C.lime, 1.3, 1.1);
          this.sfx("unlockFanfare", 0.25, 6, e.x);
        } else this.sfx("bubblePop", 0.5, -6, e.x);
        break;
      case BX_SKIP:
        // a dropped in-between frame lingers where it was (one skip in three: readable crowds)
        if (e.enemy && (e.enemy.uid + this.frameN) % 3 === 0) {
          const def = e.enemy.def;
          const a = this.anims.fps(def.sprite, def.fps ?? 0);
          fx.ghosts.spawn(a.first, e.dx, e.dy - e.enemy.z, e.enemy.face, 1, 0, this.frameN & 1 ? C.pink : C.cyan, 0.1, 0.28, Layer.FxBelow, false);
        }
        break;
      case BX_RERUN:
        ps.emit(P.sparkle, e.x, e.y - 8, 4, NaN, C.lavender);
        break;
      case BX_MIRROR:
        ps.emit(P.dust, e.x, e.y, 3, Math.atan2(-e.dy, -e.dx), -1, 0.8);
        break;
      case BX_TRUCK_LANE:
        ps.emit(P.dust, e.x, e.y, 6, NaN, -1, 1.4);
        break;
      case BX_BEEP:
        popText(w, this.texts, "BEEP", e.x + (Math.random() - 0.5) * 20, e.y - 14, C.paleYellow, 1, 0.5);
        this.sfx("uiMove", 0.5, 7, e.x);
        break;
      case BX_HORN:
        tick(this.waves, e.x, e.y, 0, 0, e.power, C.yellow, 0.5);
        if (!calm) fx.juice.shake(0.5);
        this.sfx("honk", 1, -7, e.x);
        o?.haptic(40);
        break;
      case BX_CONE:
        tick(this.cones, e.x, e.y, e.dx, e.dy, 0, 0, Math.max(0.2, e.power));
        break;
      case BX_SLASH:
        tick(this.slashes, e.x, e.y, e.dx, e.dy, 0, 0, 0.35);
        this.sfx("slash", 0.6, -2, e.x);
        break;
      case BX_BEAM_CHARGE:
        ps.emit(P.sparkle, e.x, e.y, 6, NaN, C.orange);
        this.sfx("beam", 0.5, e.power > 1.5 ? -6 : 0, e.x);
        break;
      case BX_MONTAGE:
        this.texts.add("~ TRAINING MONTAGE ~", 0, -this.r.camera.view.h * 0.3, { anchor: 2, color: C.paleYellow, scale: 1.4, life: e.power, rise: 0, wobble: 0.4 });
        this.sfx("narratorSting", 0.8);
        break;
      case BX_STAMP:
        ps.emit(paper, e.x, e.y - 4, 12);
        if (!calm) {
          fx.juice.shake(0.6);
          fx.juice.flash(C.red, 0.15, 0.2);
        }
        this.sfx("explosionBig", 0.6, 3, e.x);
        o?.haptic(50);
        break;
      case BX_DEGRADE: {
        const ph = e.power | 0;
        this.setDegrade(DEGRADE[ph] ?? 0);
        ps.emit(glitchBits, e.x, e.y, 14);
        this.sfx("glitch", 0.9);
        if (ph === 3 && !this.reduced) popText(w, this.texts, "(BUDGET CUTS)", e.x, e.y - 30, C.orange, 1.2, 1.2);
        break;
      }
      case BX_STILL:
        tick(this.stills, 0, 0, 0, 0, 0, 0, e.power + 0.05);
        if (!this.reduced) fx.speed.radial(e.power, { color: C.white, intensity: 1 });
        this.sfx("cardFlip", 0.5, -4);
        break;
      case BX_CALL:
        this.sfx("uiConfirm", 0.5, 9, e.x);
        break;
      case BX_COMMERCIAL:
        if (e.power > 0) {
          this.backs[0].life = 0;
          this.sfx("recordScratch", 0.7);
        } else {
          tick(this.backs, 0, 0, 0, 0, 0, 0, 1.4);
          this.sfx("narratorSting", 0.6);
        }
        break;
      case BX_FLASHBACK:
        tick(this.flashbacks, 0, 0, 0, 0, 0, 0, 2.2);
        this.sfx("narratorSting", 0.5, -2);
        break;
      case BX_CUT:
        ps.emit(glitchBits, e.dx, e.dy - 30, 12);
        ps.emit(glitchBits, e.x, e.y - 30, 18);
        tick(this.cuts, e.x, e.y, 0, 0, 0, 0, calm ? 0.25 : 0.4);
        popText(w, this.texts, "CUT TO:", e.x, e.y - 92, C.white, 1.1, 0.9);
        this.sfx("glitch", 0.8, -3, e.x);
        break;
    }
  }
}
