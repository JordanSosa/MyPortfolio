/**
 * Arsenal visuals: everything about Heart Boomerang, Thunder Bell, Candy Bomb,
 * Bubble Aura, Prism Beam (and their evolutions) that the generic projectile
 * drawer can't express.
 *
 *   - per frame (`draw`, called from WorldView.draw): bubble fields / ocean
 *     dome, prism + rainbow beams (w_beam_seg tiles, tip, hue shimmer, sparks),
 *     candy-bomb landing markers + growing ground shadows, the love-tornado swirl
 *   - one-shot `weaponFx` events (`bind`, called from Feedback.bind): lightning
 *     bolts + chains, Raijin blasts and drum beats, Sugar Nuke shockwave,
 *     dome bursts / heals, boomerang catches, beam flashes
 *   - extra flourishes on `explosion` (candy confetti) and `enemyHit` (bubble pops)
 *   - trail looks for the arsenal projectiles (merged into view/trails.ts TRAILS)
 *
 * Reads the world, never mutates it. No allocations per frame.
 */
import { C } from "../art/palette";
import type { SfxId } from "../audio";
import { rainbow } from "../core/color";
import { TAU } from "../core/math";
import { P, emitScorch, type BoltOpts, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { WeaponFxEvent } from "../game/events";
import type { Projectile, WeaponInstance } from "../game/types";
import {
  WFX_BEAM_START,
  WFX_BOLT,
  WFX_BOLT_BIG,
  WFX_CATCH,
  WFX_CHAIN,
  WFX_CLUSTER,
  WFX_DOME_BURST,
  WFX_DOME_HEAL,
  WFX_DRUM,
  WFX_NUKE,
} from "../game/weapons/_fx";
import type { World } from "../game/world";
import type { Anims } from "./anims";
import type { WorldTexts } from "./texts";
import { TRAILS, type TrailDef } from "./trails";

const PI = Math.PI;

// ---------------------------------------------------------------- emitters
const heartTrail: EmitterDef = {
  sprite: "fx_heart",
  frames: "fixed",
  speed: [2, 10],
  life: [0.28, 0.46],
  size: [0.85, 0.3],
  colors: [C.red, C.pink, C.pinkLight],
  gravity: -14,
  drag: 2,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const tornadoTrail: EmitterDef = {
  sprite: "fx_heart",
  frames: "fixed",
  speed: [4, 16],
  life: [0.4, 0.7],
  size: [1.15, 0.4],
  sizeJitter: 0.3,
  colors: [C.pink, C.hotPink, C.pinkLight, C.white],
  gravity: -22,
  drag: 1.6,
  sway: 10,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const fuseSpark: EmitterDef = {
  sprite: "fx_glow_s",
  frames: "fixed",
  speed: [12, 34],
  angle: -PI / 2,
  spread: 1.6,
  life: [0.14, 0.28],
  size: [0.32, 0.06],
  colors: [C.yellow, C.orange, C.paleYellow, C.white],
  gravity: 90,
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};
const nukeSpark: EmitterDef = { ...fuseSpark, speed: [16, 50], size: [0.5, 0.08], colors: [C.pink, C.pinkLight, C.white, C.yellow] };
const bubbleTrail: EmitterDef = {
  sprite: "w_bubble",
  frames: "fixed",
  speed: [0, 6],
  life: [0.25, 0.45],
  size: [0.55, 0.2],
  colors: C.white,
  gravity: -20,
  alpha: 0.8,
  alphaCurve: "linear",
  layer: Layer.Fx,
};
const bellSpark: EmitterDef = { ...P.sparkle, speed: [4, 18], life: [0.2, 0.35], size: [0.6, 0.6], colors: [C.yellow, C.paleYellow, C.white] };
/** Bubbles rising inside the aura (wobbling, fading near the top). */
const bubbleRise: EmitterDef = {
  sprite: "w_bubble",
  frames: "loop",
  fps: 3,
  speed: [2, 9],
  angle: -PI / 2,
  spread: 1.3,
  life: [0.7, 1.3],
  size: [0.7, 1.15],
  sizeJitter: 0.35,
  colors: C.white,
  gravity: -24,
  drag: 1.4,
  sway: 7,
  alpha: 0.9,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Bubble pop on hit: a tiny ring + droplets. */
const popRing: EmitterDef = {
  sprite: "fx_ring",
  frames: "fixed",
  speed: [0, 0],
  life: [0.2, 0.2],
  size: [0.12, 0.36],
  sizeCurve: "out",
  colors: [C.aqua, C.white],
  alphaCurve: "linear",
  additive: true,
  glow: true,
  layer: Layer.FxAdd,
};
const droplet: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [25, 75],
  life: [0.3, 0.6],
  size: [0.8, 0.4],
  colors: [C.aqua, C.cyan, C.white, C.lightBlue],
  bounce: { vz: [40, 90], gravity: 380, restitution: 0.3, friction: 6 },
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Ocean caustic shimmer specks floating in the dome. */
const glint: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  speed: [0, 4],
  life: [0.35, 0.6],
  size: [0.7, 0.7],
  colors: [C.white, C.aqua],
  additive: true,
  alphaCurve: "none",
  layer: Layer.FxAdd,
};
const candyBits: EmitterDef = { ...P.confetti, speed: [40, 120], colors: [C.pink, C.pinkLight, C.mint, C.paleYellow, C.white, C.aqua, C.hotPink] };
const sugarSparkle: EmitterDef = { ...P.sparkle, speed: [40, 150], life: [0.45, 0.9], size: [1.2, 1.2], colors: [C.white, C.pinkLight, C.aqua, C.paleYellow, C.pink] };
const elecSpark: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [60, 160],
  life: [0.1, 0.24],
  size: [0.7, 0.3],
  colors: [C.white, C.aqua, C.paleYellow],
  rot: "velocity",
  stretch: 0.03,
  drag: 7,
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};
/** Sugar Nuke reach: a big soft pink ring sweeping out to the blast radius (sizeMul = radius / 32). */
const nukeRing: EmitterDef = {
  sprite: "fx_ring_soft",
  frames: "fixed",
  speed: [0, 0],
  life: [0.45, 0.45],
  size: [0.25, 1],
  sizeCurve: "out",
  colors: C.pink,
  alpha: 0.9,
  alphaCurve: "linear",
  additive: true,
  layer: Layer.FxAdd,
};
/** Ocean Dome burst: a soft ring sweeping out past the dome (sizeMul = radius / 32). */
const tideRing: EmitterDef = { ...nukeRing, life: [0.5, 0.5], size: [0.55, 1], alpha: 0.4, colors: C.cyan };
const beamSpark: EmitterDef = { ...P.sparkle, speed: [18, 60], life: [0.16, 0.32], size: [0.75, 0.75] };
const floatHeart: EmitterDef = { ...P.hearts, speed: [10, 26], life: [0.7, 1.1], size: [1, 0.7] };

/** Trail looks keyed by Projectile.trail (merged into TRAILS below). */
const ARSENAL_TRAILS: Record<string, TrailDef> = {
  heart: { def: heartTrail, every: 2, n: 1, color: C.red, halo: 6, haloAlpha: 0.12 },
  loveTornado: { def: tornadoTrail, every: 2, n: 1, color: C.hotPink, halo: 9, haloAlpha: 0.14 },
  fuse: { def: fuseSpark, every: 1, n: 1, color: C.orange, halo: 0, haloAlpha: 0, yOff: -4 },
  nukeFuse: { def: nukeSpark, every: 1, n: 2, color: C.pink, halo: 0, haloAlpha: 0, yOff: -7 },
  bubble: { def: bubbleTrail, every: 3, n: 1, color: C.aqua, halo: 8, haloAlpha: 0.25 },
  bell: { def: bellSpark, every: 5, n: 1, color: C.yellow, halo: 10, haloAlpha: 0.35 },
};
Object.assign(TRAILS, ARSENAL_TRAILS);

/** Lightning looks (read-only option objects: striking never allocates). */
const BOLT: BoltOpts = { color: C.cyan, thickness: 2, life: 0.17, branches: 2, jag: 0.16, detail: 5 };
const CHAIN: BoltOpts = { color: C.cyan, thickness: 1, life: 0.15, branches: 0, jag: 0.24, detail: 4 };
const CHAIN_BIG: BoltOpts = { color: C.yellow, thickness: 2, life: 0.15, branches: 1, jag: 0.24, detail: 4 };
const BOLT_BIG: BoltOpts = { color: C.yellow, thickness: 3, life: 0.2, branches: 2, jag: 0.14, detail: 5 };
const BOLT_WHIP: BoltOpts = { color: C.cyan, thickness: 1, life: 0.14, branches: 0, jag: 0.24, detail: 4, impact: false };

type SfxFn = (id: SfxId, vol: number, pitch: number, x: number) => void;

/** Beams start this far from the wand (~ the hero's centre) and fade in over BEAM_FADE px. */
const BEAM_CLEAR = 14;
const BEAM_FADE = 20;
const POP_BUDGET = 8;
const BOLT_FX_BUDGET = 10;
const ID_BUBBLE = "bubble_aura";
const ID_DOME = "ocean_dome";

export class WeaponFx {
  private w: World | null = null;
  private hSeg: number;
  private nSeg: number;
  private hTip: number;
  private nTip: number;
  private hRingSoft: number;
  private hSoft: number;
  private hFlare: number;
  private hStreak: number;
  private hGlowS: number;
  private pops = 0;
  private bolts = 0;
  private candy = 0;
  private riseAcc = 0;
  private sparkAcc = 0;
  private heartAcc = 0;
  private calm = false;
  private nukes = 0;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    anims: Anims,
    private readonly texts: WorldTexts,
    /** WorldView.coverHero: a blast landed on the hero (forces the hero beacon on for a moment). */
    private readonly coverHero: (sec: number) => void = () => {},
  ) {
    const seg = anims.get("w_beam_seg");
    this.hSeg = seg.first;
    this.nSeg = seg.count;
    const tip = anims.get("w_beam_tip");
    this.hTip = tip.first;
    this.nTip = tip.count;
    this.hRingSoft = r.atlas.handle("fx_ring_soft");
    this.hSoft = r.atlas.handle("fx_soft_circle");
    this.hFlare = r.atlas.handle("fx_flare");
    this.hStreak = r.atlas.handle("fx_streak");
    this.hGlowS = r.atlas.handle("fx_glow_s");
  }

  setWorld(w: World): void {
    this.w = w;
    this.riseAcc = this.sparkAcc = this.heartAcc = 0;
  }

  /** Subscribe to the world's weapon events. Returns the unsubscribe functions. */
  bind(w: World, sfx: SfxFn, calm: boolean): (() => void)[] {
    this.calm = calm;
    const bus = w.bus;
    return [
      bus.on("weaponFx", (e) => this.onFx(e, sfx)),
      bus.on("explosion", (e) => {
        if (e.source !== "candy_bomb" && e.source !== "sugar_nuke") return;
        if (this.candy >= 4) return;
        this.candy++;
        const s = e.r / 28;
        this.fx.ps.emit(candyBits, e.x, e.y - 4, Math.round(8 + 6 * s), NaN, -1, 1, 0.8 + 0.4 * s);
        this.fx.ps.emit(sugarSparkle, e.x, e.y - 6, Math.round(3 + 4 * s), NaN, -1, 0.9, 0.6 + 0.5 * s);
      }),
      bus.on("enemyHit", (e) => {
        if (this.pops >= POP_BUDGET) return;
        if (e.source !== ID_BUBBLE && e.source !== ID_DOME) return;
        this.pops++;
        const ps = this.fx.ps;
        ps.emit(popRing, e.x, e.y, 1);
        ps.emit(droplet, e.x, e.y, 3);
        ps.emit(bubbleRise, e.x, e.y - 2, 1, NaN, -1, 0.8);
      }),
    ];
  }

  private onFx(e: WeaponFxEvent, sfx: SfxFn): void {
    const fx = this.fx;
    const ps = fx.ps;
    const juice = fx.juice;
    const calm = this.calm;
    switch (e.kind) {
      case WFX_BOLT: {
        fx.bolts.strike(e.x, e.y, e.x2, e.y2, BOLT);
        if (this.bolts++ < BOLT_FX_BUDGET) {
          ps.emit(P.flare, e.x2, e.y2, 1, NaN, C.aqua, 1.1);
          ps.emit(elecSpark, e.x2, e.y2, 6);
          ps.emit(P.ringThin, e.x2, e.y2, 1, NaN, C.cyan, e.r > 0 ? e.r / 16 : 0.9);
          // (no scorch for ordinary bell strikes: dozens of decals a second piled into grey discs)
          if (e.r > 0) ps.emit(P.ring, e.x2, e.y2, 1, NaN, C.paleYellow, e.r / 16);
        }
        if (!calm) juice.shake(0.07);
        break;
      }
      case WFX_CHAIN: {
        const big = e.n >= 8;
        fx.bolts.strike(e.x, e.y, e.x2, e.y2, big ? CHAIN_BIG : CHAIN);
        if (this.bolts++ < BOLT_FX_BUDGET) ps.emit(elecSpark, e.x2, e.y2, 3);
        break;
      }
      case WFX_BOLT_BIG: {
        // twin bolt: thick golden body + a thin cyan whip around it
        fx.bolts.strike(e.x, e.y, e.x2, e.y2, BOLT_BIG);
        if (this.nearHero(e.x2, e.y2, e.r + 10)) this.coverHero(0.5);
        fx.bolts.strike(e.x + 8, e.y, e.x2, e.y2, BOLT_WHIP);
        if (this.bolts++ < BOLT_FX_BUDGET) {
          const s = e.r / 16;
          ps.emit(P.flare, e.x2, e.y2, 1, NaN, C.yellow, s * 0.6);
          ps.emit(P.ring, e.x2, e.y2, 1, NaN, C.yellow, s * 0.9);
          ps.emit(P.ringThin, e.x2, e.y2, 1, NaN, C.cyan, s * 1.25);
          ps.emit(P.rays, e.x2, e.y2, 6, NaN, C.yellow, 0.8, 0.8);
          ps.emit(elecSpark, e.x2, e.y2, 10, NaN, -1, 1.2, 1.3);
          ps.emit(P.debris, e.x2, e.y2, 4);
          emitScorch(ps, e.x2, e.y2 + 4, s * 0.7);
          if (!calm) juice.shockwave(e.x2, e.y2, 0.55, e.r * 2.2, 0.45);
        }
        if (!calm) juice.shake(0.11);
        sfx("explosion", 0.35, 5, e.x2);
        break;
      }
      case WFX_DRUM: {
        ps.emit(P.ring, e.x, e.y, 1, NaN, C.yellow, 3.4);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.cyan, 4.6);
        ps.emit(P.rays, e.x, e.y, 16, NaN, C.paleYellow, 1.1, 1.3);
        ps.emit(elecSpark, e.x, e.y, 12, NaN, -1, 1, 1.4);
        this.texts.add("DON!", 0, -30, { anchor: 1, color: C.yellow, scale: 2, life: 0.55, rise: 12, wobble: 2 });
        if (!calm) {
          // "reduce flashing" is applied inside juice.flash
          juice.flash(C.paleYellow, 0.22, 0.28);
          juice.shake(0.22);
          juice.zoomPunch(0.035);
          juice.shockwave(e.x, e.y, 0.9, 90, 0.5);
        }
        sfx("bell", 0.7, -7, e.x);
        break;
      }
      case WFX_NUKE: {
        // the fireball is capped (candy-bomb.ts); these rings show the real blast reach
        const s = e.r / 16;
        ps.emit(nukeRing, e.x, e.y, 1, NaN, C.pink, s * 0.5);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.pinkLight, s * 1.2);
        ps.emit(P.ring, e.x, e.y, 1, NaN, C.hotPink, s * 0.95);
        ps.emit(sugarSparkle, e.x, e.y - 8, 26, NaN, -1, 1.1, 1.6);
        ps.emit(candyBits, e.x, e.y - 6, 26, NaN, -1, 1.3, 1.7);
        if (this.nukes++ % 3 === 0) this.texts.add("SUGAR RUSH!", e.x, e.y - 30, { anchor: 0, rainbow: true, scale: 2, life: 0.9, rise: 14, wobble: 1.5 });
        if (!calm) {
          juice.shockwave(e.x, e.y, 2.2, e.r * 2.8, 0.85);
          juice.shake(0.5);
          juice.hitstop(45);
          juice.zoomPunch(0.05);
          juice.flash(C.pinkLight, 0.2, 0.3);
          juice.aberration(2.5);
        }
        break;
      }
      case WFX_CLUSTER:
        ps.emit(sugarSparkle, e.x, e.y - 8, 6, NaN, -1, 1, 1.2);
        break;
      case WFX_DOME_BURST: {
        // soft (non-bloom) tidal ring sweeping past the dome edge
        ps.emit(tideRing, e.x, e.y, 1, NaN, C.cyan, (e.r / 32) * 1.5);
        ps.emit(droplet, e.x, e.y, 18, NaN, -1, 1.2, 1.8);
        ps.emit(bubbleRise, e.x, e.y, 10, NaN, -1, 1.2, 3);
        if (!calm) {
          juice.shockwave(e.x, e.y, 1.3, e.r * 2.3, 0.6);
          juice.shake(0.16);
        }
        sfx("bubblePop", 0.8, -5, e.x);
        break;
      }
      case WFX_DOME_HEAL:
        fx.dmg.spawn(e.x, e.y - 24, e.n, "heal");
        ps.emit(P.hearts, e.x, e.y - 12, 3);
        ps.emit(P.ringThin, e.x, e.y - 8, 1, NaN, C.lime, 1.2);
        break;
      case WFX_CATCH:
        ps.emit(floatHeart, e.x, e.y, 2);
        ps.emit(P.sparkle, e.x, e.y, 2, NaN, C.pinkLight, 0.8);
        break;
      case WFX_BEAM_START: {
        const big = e.n === 1;
        ps.emit(P.flare, e.x, e.y, 1, NaN, big ? C.white : C.aqua, big ? 2.2 : 1.1);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, big ? rainbow(Math.random()) : C.aqua, big ? 3 : 1.4);
        if (big) {
          ps.emit(P.rays, e.x, e.y, 14, NaN, -1, 1, 1.1);
          if (!calm) {
            juice.bloomSurge(0.35, 0.5);
            juice.shake(0.18);
            juice.zoomPunch(0.03);
          }
        } else if (!calm) juice.shake(0.05);
        break;
      }
    }
  }

  /** Is (x, y) within `r` of the hero's body centre? */
  private nearHero(x: number, y: number, r: number): boolean {
    const p = this.w?.player;
    if (!p) return false;
    const dx = x - p.x;
    const dy = y - (p.y - 8);
    return dx * dx + dy * dy < r * r;
  }

  // ================================================================ per frame
  draw(time: number, dt: number): void {
    const w = this.w;
    if (!w) return;
    this.pops = this.bolts = this.candy = 0;
    for (let i = 0; i < w.weapons.length; i++) {
      const inst = w.weapons[i];
      switch (inst.def.id) {
        case "bubble_aura":
          this.drawField(inst, time, dt, false);
          break;
        case "ocean_dome":
          this.drawField(inst, time, dt, true);
          break;
        case "prism_beam":
          this.drawBeams(inst, time, dt, false);
          break;
        case "rainbow_cannon":
          this.drawBeams(inst, time, dt, true);
          break;
        case "candy_bomb":
        case "sugar_nuke":
          this.drawBombs(inst, time);
          break;
        case "love_tornado":
          this.drawVortex(time, dt);
          break;
      }
    }
  }

  // ---------------------------------------------------------------- bubble field / ocean dome
  private drawField(inst: WeaponInstance, time: number, dt: number, dome: boolean): void {
    const r = this.r;
    const w = this.w as World;
    const p = w.player;
    const R = inst.data.r ?? 0;
    if (R < 2) return;
    const cx = p.x;
    const cy = p.y - 8;
    const b = r.batch;
    const breathe = 1 + 0.018 * Math.sin(time * 4.2);
    const RR = R * breathe;
    // water on the ground under everyone inside + a faint watery sheen over them
    b.drawP(Layer.Decal, this.hSoft, cx, cy, RR / 16, RR / 16, 0, C.cyan, dome ? 0.17 : 0.2, 0, Flag.NoSnap, 16, 16);
    b.drawP(Layer.FxBelow, this.hSoft, cx, cy, RR / 16, RR / 16, 0, C.aqua, dome ? 0.07 : 0.09, 0, Flag.NoSnap, 16, 16);
    if (dome) {
      // caustic shimmer: soft light patches drifting through the dome
      for (let k = 0; k < 7; k++) {
        const a = time * (0.35 + k * 0.07) + k * 2.1;
        const rr = R * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time * 0.6 + k * 1.7)));
        const gx = cx + Math.cos(a) * rr;
        const gy = cy + Math.sin(a * 1.3) * rr * 0.8;
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.3 + k * 1.9);
        const sz = (R / 64) * (0.7 + 0.4 * pulse);
        b.drawP(Layer.Decal, this.hSoft, gx, gy, sz * 1.1, sz * 0.6, a, C.white, 0.1 + 0.1 * pulse, 0, Flag.NoSnap, 16, 16);
      }
    }
    // rim: soft glowing ring + crisp highlight ring
    const rimA = (dome ? 0.42 : 0.45) + 0.1 * Math.sin(time * 6);
    b.drawP(Layer.FxAdd, this.hRingSoft, cx, cy, RR / 32, RR / 32, 0, dome ? C.cyan : C.aqua, rimA, 0, Flag.Add | Flag.NoSnap, 32, 32);
    r.ring(Layer.FxAdd, cx, cy, RR, dome ? C.aqua : C.white, (dome ? 0.14 : 0.22) + 0.1 * Math.sin(time * 9), Flag.Add);
    if (dome) r.ring(Layer.FxAdd, cx, cy, RR * 0.93, C.aqua, 0.12, Flag.Add);
    // bubble shine (top-left highlight sells the sphere)
    b.drawP(Layer.FxAdd, this.hGlowS, cx - RR * 0.48, cy - RR * 0.5, RR / 28, RR / 64, -0.75, C.white, 0.35, 0, Flag.Add | Flag.NoSnap, 8, 8);
    b.drawP(Layer.FxAdd, this.hGlowS, cx - RR * 0.62, cy - RR * 0.22, RR / 90, RR / 90, 0, C.white, 0.45, 0, Flag.Add | Flag.NoSnap, 8, 8);
    // glints sliding along the rim
    const glints = dome ? 7 : 4;
    for (let k = 0; k < glints; k++) {
      const a = time * (0.9 + 0.23 * k) * (k & 1 ? -1 : 1) + k * 1.7;
      const tw = Math.sin(time * 7 + k * 2.3);
      if (tw < 0) continue;
      const s = (dome ? 0.55 : 0.4) * tw;
      b.drawP(Layer.FxAdd, this.hFlare, cx + Math.cos(a) * RR, cy + Math.sin(a) * RR, s, s, 0, C.white, 0.85, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 8, 8);
    }
    // burst pulse: the rim kicks outward and fades
    const bt = inst.data.burst ?? 9;
    if (dome && bt < 0.45) {
      const k = bt / 0.45;
      const s = (RR * (1 + k * 0.6)) / 32;
      b.drawP(Layer.FxAdd, this.hRingSoft, cx, cy, s, s, 0, C.cyan, 0.35 * (1 - k), 0, Flag.Add | Flag.NoSnap, 32, 32);
    }
    if (dt <= 0) return;
    // rising bubbles (rate grows with the field's area) + dome glints
    const ps = this.fx.ps;
    if (ps.count > ps.capacity * 0.8) return;
    this.riseAcc += dt * (R * (dome ? 0.36 : 0.5));
    while (this.riseAcc >= 1) {
      this.riseAcc -= 1;
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * R * 0.92;
      ps.emit(bubbleRise, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1);
      if (dome && Math.random() < 0.45) ps.emit(glint, cx + Math.cos(a + 2) * d, cy + Math.sin(a + 2) * d, 1);
    }
  }

  // ---------------------------------------------------------------- beams
  private drawBeams(inst: WeaponInstance, time: number, dt: number, cannon: boolean): void {
    const projs = inst.projs;
    let any: Projectile | null = null;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (p.dead || p.uid !== inst.uids[i]) continue;
      this.drawBeam(p, time, dt, cannon, i);
      if (p.hh > 0.25) any = p;
    }
    if (!any) return;
    // one muzzle for all beams: a prism spark where the visible beam starts (not on the hero's body)
    const r = this.r;
    const pulse = 1 + 0.2 * Math.sin(time * 40);
    const k = Math.min(1, any.hh / Math.max(0.5, any.vz));
    const mx = any.ox + Math.cos(any.ang) * BEAM_CLEAR;
    const my = any.oy + Math.sin(any.ang) * BEAM_CLEAR;
    r.glow(mx, my, (cannon ? 9 : 6) * pulse * k, cannon ? rainbow(time * 0.9, 0.5) : C.aqua, 0.3);
    r.batch.drawP(Layer.FxAdd, this.hFlare, mx, my, 0.5 * pulse * k, 0.5 * pulse * k, time * 6, C.white, 0.7, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 8, 8);
  }

  private drawBeam(p: Projectile, time: number, dt: number, cannon: boolean, idx: number): void {
    const hh = p.hh;
    if (hh <= 0.25) return;
    const r = this.r;
    const b = r.batch;
    const L = p.a;
    const ca = Math.cos(p.ang);
    const sa = Math.sin(p.ang);
    // the body starts BEAM_CLEAR px off the hero's centre and fades in over BEAM_FADE px: with
    // several evolved beams converging on her, the hero must stay the clearest spot on screen
    const off = BEAM_CLEAR;
    const ox = p.ox + ca * off;
    const oy = p.oy + sa * off;
    const ex = p.ox + ca * L;
    const ey = p.oy + sa * L;
    const len = L - off;
    if (len <= 4) return;
    const fade = Math.min(BEAM_FADE, len * 0.5);
    const fx0 = ox + ca * fade;
    const fy0 = oy + sa * fade;
    const hue = time * (cannon ? 0.9 : 0.5) + idx * 0.33;
    // hue-shimmering outer haze (additive, under the body) + a soft bloom-only halo: the body
    // itself stays out of the bloom buffer so the rainbow stripes never wash out to white
    const haze = rainbow(hue, 0.75);
    const hzA = cannon ? 0.2 : 0.14;
    const hlA = cannon ? 0.24 : 0.16;
    r.line(Layer.FxAdd, fx0, fy0, ex, ey, hh * 2 + (cannon ? 5 : 3), haze, hzA, Flag.Add);
    r.line(Layer.FxAdd, fx0, fy0, ex, ey, hh * 1.5, haze, hlA, Flag.GlowOnly);
    r.line(Layer.FxAdd, ox, oy, fx0, fy0, hh * 2 + (cannon ? 5 : 3), haze, hzA * 0.35, Flag.Add);
    // body: w_beam_seg tiles along the beam, width waves travelling outward
    const n = Math.ceil(len / 8);
    const fr = this.hSeg + (Math.floor(time * 18) % this.nSeg);
    const baseSy = (hh * 2) / 12;
    for (let k = 0; k < n; k++) {
      const d = k * 8 + 4;
      const wave = 1 + 0.16 * Math.sin(k * 0.9 - time * 34);
      const tint = cannon ? rainbow(hue + k * 0.035, 0.38) : 0xffffff;
      const a = d < fade ? 0.2 + (0.8 * d) / fade : 1;
      b.drawP(Layer.Fx, fr, ox + ca * d, oy + sa * d, 1.08, baseSy * wave, p.ang, tint, a, 0, Flag.NoSnap, 4, 6);
    }
    // white-hot core
    r.line(Layer.FxAdd, fx0, fy0, ex, ey, Math.max(1, hh * 0.3), C.white, 0.4, Flag.Add);
    // impact tip
    const pulse = 1 + 0.2 * Math.sin(time * 40 + idx);
    const tip = this.hTip + (Math.floor(time * 16 + idx) % this.nTip);
    const ts = (cannon ? 1.35 : 1) * pulse * Math.min(1, hh / Math.max(0.5, p.vz));
    b.drawP(Layer.Fx, tip, ex, ey, ts, ts, time * 9, cannon ? rainbow(hue + 0.5, 0.3) : 0xffffff, 1, 0, Flag.Glow | Flag.NoSnap, 6, 6);
    r.glow(ex, ey, (cannon ? 13 : 8) * pulse, cannon ? rainbow(hue + 0.5, 0.6) : C.aqua, 0.3);
    // sparks shed along the beam
    if (dt <= 0) return;
    const ps = this.fx.ps;
    if (ps.count > ps.capacity * 0.75) return;
    this.sparkAcc += dt * (cannon ? 20 : 12);
    while (this.sparkAcc >= 1) {
      this.sparkAcc -= 1;
      const d = Math.random() * len;
      const side = (Math.random() < 0.5 ? -1 : 1) * PI * 0.5;
      ps.emit(beamSpark, ox + ca * d, oy + sa * d, 1, p.ang + side, cannon ? rainbow(Math.random(), 0.5) : Math.random() < 0.5 ? C.aqua : C.pinkLight);
    }
  }

  // ---------------------------------------------------------------- candy bombs
  private drawBombs(inst: WeaponInstance, time: number): void {
    const r = this.r;
    const projs = inst.projs;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (p.dead || p.uid !== inst.uids[i]) continue;
      const k = Math.min(1, p.age / Math.max(0.01, p.b));
      const kind = p.a;
      // landing marker: a soft candy-pink target that tightens as the bomb comes down
      const R = p.r * (1.2 - 0.2 * k);
      const pulse = 0.5 + 0.5 * Math.sin(time * 20 + i);
      const nuke = kind === 1;
      const col = nuke ? C.hotPink : C.pink;
      const b = r.batch;
      b.drawP(Layer.Decal, this.hSoft, p.ox, p.oy, R / 16, R / 16, 0, col, (kind === 2 ? 0.05 : 0.07) + 0.08 * k, 0, Flag.NoSnap, 16, 16);
      b.drawP(Layer.Decal, this.hRingSoft, p.ox, p.oy, R / 32, R / 32, 0, nuke ? C.pinkLight : C.pink, 0.2 + 0.35 * k * (0.6 + 0.4 * pulse), 0, Flag.NoSnap, 32, 32);
      if (nuke) b.drawP(Layer.Decal, this.hRingSoft, p.ox, p.oy, R / 70, R / 70, 0, C.white, 0.25 + 0.35 * k * pulse, 0, Flag.NoSnap, 32, 32);
      // ground shadow grows as it falls
      const base = kind === 1 ? 18 : kind === 2 ? 6 : 9;
      const h = Math.max(0, p.z) / (p.ang + 8);
      r.shadow(p.x, p.y, base * (0.45 + 0.55 * (1 - h)), 0.35 + 0.45 * (1 - h));
    }
  }

  // ---------------------------------------------------------------- love tornado swirl
  private drawVortex(time: number, dt: number): void {
    const w = this.w as World;
    const p = w.player;
    const b = this.r.batch;
    const cx = p.x;
    const cy = p.y - 9;
    for (let k = 0; k < 9; k++) {
      const ring = k % 3;
      const rad = 12 + ring * 8;
      const a = time * (5.5 - ring * 1.2) + (k / 9) * TAU;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad * 0.85;
      const al = 0.34 + 0.14 * Math.sin(time * 5 + k);
      b.drawP(Layer.FxAdd, this.hStreak, x, y, 0.7 + ring * 0.25, 0.75, a + PI / 2, ring === 1 ? C.pinkLight : C.pink, al, 0, Flag.Add | Flag.NoSnap, 8, 2);
    }
    if (dt <= 0) return;
    this.heartAcc += dt * 7;
    const ps = this.fx.ps;
    while (this.heartAcc >= 1) {
      this.heartAcc -= 1;
      if (ps.count > ps.capacity * 0.8) continue;
      const a = Math.random() * TAU;
      const d = 14 + Math.random() * 60;
      ps.emit(floatHeart, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 1);
    }
  }
}
