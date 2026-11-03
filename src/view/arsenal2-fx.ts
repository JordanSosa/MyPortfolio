/**
 * Arsenal 2 - the four general Season 2 weapons and their evolutions
 * (docs/content/weapons.md §2.9-2.12, §3): visuals the generic projectile
 * drawer can't express. Reads the world, never mutates it.
 *
 *   per frame (`draw`, from WorldView.draw):
 *     Paper Crane Flock / Thousand Crane Wish   the cranes (lazy flap in the flock, fast flap + facing while
 *         darting, crumpled after the hero is hurt, a glow that grows with every fold, the paper trail)
 *     Idol Lightstick Wave / Sold-Out Dome Tour  w_lightstick_wave crescents scaled to the expanding front +
 *         the crisp front arc, the Chorus ring, the ENCORE! crowd of lightsticks along the bottom edge
 *     Kotatsu of Sloth / Eternal Winter Break    the aura on the floor, w_kotatsu (folded bundle on the
 *         hero's back / deployed with steam / Too Comfy heater glow), Zzz over the dozing hero and
 *         over sleeping enemies
 *     Thousand Crane Wish                        the golden sparkle rain of the WISH GRANTED! storm
 *   events (`bind`, from Feedback.bind): the `heroFx` "a2_*" cues -> particles, shakes, banners, sfx
 *   (paper crane darts rate-limited 1 / 0.15 s), boba hit puffs (`enemyHit`)
 *   trails: "boba", "boba_big", "craneGold" (merged into TRAILS)
 *
 * No per-frame allocations: module-scope emitter defs, reused sprite options.
 */
import { C } from "../art/palette";
import type { SfxId } from "../audio";
import { TAU } from "../core/math";
import { P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer, SpriteOpts } from "../render/renderer";
import type { HeroFxEvent, HitEvent } from "../game/events";
import type { Projectile, WeaponInstance } from "../game/types";
import {
  A2_BOBA_POP,
  A2_BOBA_SHED,
  A2_BOBA_SPLIT,
  A2_CRANE_CRUMPLE,
  A2_CRANE_DART,
  A2_CRANE_FOLD,
  A2_ENCORE,
  A2_KOTATSU_COMFY,
  A2_KOTATSU_DEPLOY,
  A2_KOTATSU_FOLD,
  A2_KOTATSU_SNORE,
  A2_KOTATSU_WAKE,
  A2_MIKAN,
  A2_SLEEP,
  A2_WAVE,
  A2_WISH,
} from "../game/weapons/_arsenal2";
import { BOBA_COLOR } from "../game/weapons/bubble-tea-cannon";
import { CR_DART, CR_IDLE, FOLD_MAX, STORM_TIME, flockOf } from "../game/weapons/paper-crane-flock";
import { WAVE_CHORUS, WAVE_EXPAND } from "../game/weapons/idol-lightstick-wave";
import { asleepIn, kotatsuOf } from "../game/weapons/kotatsu-of-sloth";
import type { World } from "../game/world";
import type { Anims } from "./anims";
import type { FeedbackHooks } from "./feedback";
import type { WorldTexts } from "./texts";
import { TRAILS, type TrailDef } from "./trails";

const PI = Math.PI;
const BOBA = "bubble_tea_cannon";
const TAPIOCA = "tapioca_tsunami";
const CRANE = "paper_crane_flock";
const WISH = "thousand_crane_wish";
const STICK = "idol_lightstick_wave";
const DOME = "sold_out_dome_tour";
const KOTATSU = "kotatsu_of_sloth";
const WINTER = "eternal_winter_break";
/** Tea brown tones (boba, tea splashes). */
const TEA = [0x6b3f24, 0x8a5634, 0xb07a4f, BOBA_COLOR] as const;
/** The lightstick wave cycle: pink -> cyan -> yellow -> violet. */
const STICK_TINTS = [C.pink, C.cyan, C.yellow, C.violet] as const;
const CROWD_TINTS = [C.pink, C.cyan, C.yellow, C.violet, C.mint, C.hotPink] as const;
/** Seconds the ENCORE! crowd waves along the bottom edge. */
const ENCORE_T = 1.1;
const ENCORE_STICKS = 20;

// ---------------------------------------------------------------- emitters
const bobaPuff: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  speed: [10, 26],
  spread: TAU,
  life: [0.22, 0.36],
  size: [0.3, 0.55],
  sizeJitter: 0.2,
  colors: [TEA[0], TEA[1], TEA[2]],
  alpha: 0.75,
  drag: 3,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const teaDrop: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [24, 60],
  angle: -PI / 2,
  spread: 2.4,
  life: [0.3, 0.5],
  size: [1, 0.6],
  colors: [TEA[1], TEA[2], TEA[3], 0xf2d3a8],
  bounce: { vz: [26, 60], gravity: 380, restitution: 0.2, friction: 6 },
  alphaCurve: "late",
  layer: Layer.Fx,
};
const teaTrail: EmitterDef = { ...teaDrop, bounce: undefined, speed: [0, 5], life: [0.14, 0.24], size: [0.8, 0.5], gravity: 30 };
const paperBit: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [2, 10],
  spread: TAU,
  life: [0.3, 0.45],
  size: [1, 0.6],
  colors: [C.white, C.offWhite],
  gravity: 16,
  drag: 2,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const goldBit: EmitterDef = { ...P.sparkle, speed: [4, 16], life: [0.28, 0.45], size: [0.6, 0.6], colors: [C.gold, C.yellow, C.paleYellow, C.white] };
const paperScrap: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [20, 55],
  spread: TAU,
  life: [0.5, 0.8],
  size: [1.6, 0.9],
  aspect: 1.8,
  colors: [C.white, C.offWhite, 0xd8d0c8],
  gravity: 60,
  drag: 2.4,
  rot: "random",
  spin: [4, 9],
  alphaCurve: "late",
  layer: Layer.Fx,
};
const foldStar: EmitterDef = { ...P.sparkle, speed: [14, 40], life: [0.25, 0.4], colors: [C.white, C.pinkLight, C.paleYellow] };
const stickSpark: EmitterDef = { ...P.sparkle, speed: [6, 22], life: [0.25, 0.42], size: [0.8, 0.8] };
const goldRain: EmitterDef = {
  ...P.sparkle,
  speed: [20, 50],
  angle: PI / 2,
  spread: 0.5,
  life: [0.7, 1.1],
  size: [0.9, 0.5],
  colors: [C.gold, C.yellow, C.paleYellow, C.white],
  gravity: 40,
};
const steam: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  speed: [4, 10],
  angle: -PI / 2,
  spread: 0.5,
  life: [0.8, 1.2],
  size: [0.35, 0.75],
  colors: C.white,
  alpha: 0.38,
  gravity: -12,
  drag: 1,
  sway: 6,
  alphaCurve: "inout",
  layer: Layer.Fx,
};
const quiltDust: EmitterDef = { ...P.dust, colors: [0xf3d6c0, 0xe9b9a0, C.offWhite], size: [0.45, 0.9], speed: [10, 28], layer: Layer.Fx };
const mikanDrop: EmitterDef = { ...teaDrop, colors: [C.orange, 0xffb347, C.yellow, C.white], speed: [30, 80] };
const mikanPuff: EmitterDef = { ...bobaPuff, colors: [C.orange, 0xffb347, C.paleYellow], size: [0.45, 0.85], life: [0.25, 0.4] };
const sleepSpark: EmitterDef = { ...P.sparkle, speed: [4, 14], life: [0.35, 0.55], colors: [C.lavender, C.white, C.violet] };

/** Projectile trails for the generic drawer (pearls, storm cranes). */
const ARSENAL2_TRAILS: Record<string, TrailDef> = {
  boba: { def: teaTrail, every: 2, n: 1, color: BOBA_COLOR, halo: 0, haloAlpha: 0 },
  boba_big: { def: teaTrail, every: 2, n: 1, color: BOBA_COLOR, halo: 0, haloAlpha: 0 },
  craneGold: { def: goldBit, every: 2, n: 1, color: C.gold, halo: 7, haloAlpha: 0.3 },
};
Object.assign(TRAILS, ARSENAL2_TRAILS);

export interface Arsenal2BindOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  calm: boolean;
  hooks?: FeedbackHooks;
}

export class Arsenal2Fx {
  private w: World | null = null;
  private o: Arsenal2BindOpts | null = null;
  private now = 0;
  private frameN = 0;
  /** Sfx rate limits (real seconds of the last play). */
  private dartAt = -1;
  private popAt = -1;
  /** ENCORE! crowd clock (-1 = off). */
  private encoreT = -1;
  /** WISH GRANTED! golden storm clock (-1 = off). */
  private wishT = -1;
  /** Hero-facing memory per crane slot (no flip-flop while hovering). */
  private readonly craneLeft = new Uint8Array(32);
  private readonly so: SpriteOpts = { x: 0, y: 0 };

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly anims: Anims,
    private readonly texts: WorldTexts,
  ) {}

  setWorld(w: World): void {
    this.w = w;
    this.reset();
  }

  private reset(): void {
    this.encoreT = this.wishT = -1;
    this.dartAt = this.popAt = -1;
    this.craneLeft.fill(0);
  }

  private sfx(id: SfxId, vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  // ================================================================ per frame
  /** Called from WorldView.draw. `dt` = scaled sim dt, `realDt` = real dt. */
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.now += realDt;
    this.frameN++;
    for (let i = 0; i < w.weapons.length; i++) {
      const inst = w.weapons[i];
      const id = inst.def.id;
      if (id === CRANE || id === WISH) this.drawFlock(inst, time);
      else if (id === KOTATSU || id === WINTER) this.drawKotatsu(inst, time, dt);
    }
    this.scanWaves();
    this.drawSleepers(time);
    this.drawEncore(time, realDt);
    this.drawWish(realDt);
  }

  // ---------------------------------------------------------------- cranes
  private drawFlock(inst: WeaponInstance, time: number): void {
    const F = flockOf(inst);
    if (!F) return;
    const r = this.r;
    const cam = r.camera;
    const gold = F.gold;
    const a = this.anims.get(gold ? "w_crane_gold" : "w_crane");
    const ps = this.fx.ps;
    const busy = ps.count > ps.capacity * 0.75;
    for (let k = 0; k < inst.projs.length; k++) {
      const p = inst.projs[k];
      if (p.dead || p.uid !== inst.uids[k]) continue;
      const i = p.a;
      if (!cam.inView(p.x, p.y, 24)) continue;
      const st = F.st[i];
      const folds = F.folds[i];
      const crumpled = F.crumple[i] > 0;
      const fps = crumpled ? 0 : st === CR_DART ? 18 : st === CR_IDLE ? 7 : 13;
      const h = a.first + (fps > 0 ? Math.floor((time + i * 0.37) * fps) % a.count : 2);
      // the bigger the fold count, the tighter (smaller, crisper) the crane and the brighter its glow
      const s = 1 + (gold ? 0.12 : 0) - folds * 0.012;
      let sx = s;
      let sy = s;
      let rot = 0;
      let tint = 0xffffff;
      if (crumpled) {
        // crumpled paper: squashed, tilted, greyed, sinking a little
        sy *= 0.55;
        sx *= 0.85;
        rot = 0.5 * Math.sin(time * 9 + i);
        tint = gold ? 0xc9a24a : 0xd2cbc4;
      } else if (st === CR_IDLE) {
        if (p.vx < -6) this.craneLeft[i] = 1;
        else if (p.vx > 6) this.craneLeft[i] = 0;
        if (this.craneLeft[i]) sx = -sx;
        rot = Math.sin(time * 2.2 + i) * 0.12;
      } else {
        const ang = Math.atan2(p.vy, p.vx);
        if (p.vx < 0) {
          sx = -sx;
          rot = ang - PI;
        } else rot = ang;
      }
      const y = crumpled ? p.y + 3 : p.y;
      // floating above the ground: a faint shadow below
      r.shadow(p.x, p.y + 14, 5 * s, crumpled ? 0.15 : 0.22);
      if (folds > 0 && !crumpled) r.glow(p.x, y, 4 + folds * 0.7, gold ? C.gold : C.pinkLight, 0.07 + folds * 0.022);
      r.spr(Layer.Fx, h, p.x, y, sx, sy, rot, tint, 1, 0, Flag.NoSnap | (gold ? Flag.Glow : 0));
      // the paper trail: 2 bits per 0.1 s while flying
      if (st !== CR_IDLE && !crumpled && !busy && (this.frameN + i * 2) % 6 === 0) ps.emit(gold ? goldBit : paperBit, p.x, p.y, 2);
      if (folds >= FOLD_MAX && !crumpled && (this.frameN + i * 5) % 20 === 0) ps.emit(foldStar, p.x, p.y, 1);
    }
  }

  // ---------------------------------------------------------------- lightstick waves
  private scanWaves(): void {
    const w = this.w as World;
    const items = w.projectiles.items;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = items[i];
      if (p.dead) continue;
      if (p.source === STICK || p.source === DOME) this.drawWave(p);
    }
  }

  private drawWave(p: Projectile): void {
    const r = this.r;
    if (!r.camera.inView(p.x, p.y, p.b + 20)) return;
    const k = Math.min(1, p.age / WAVE_EXPAND);
    const R = Math.max(2, p.b * (1 - (1 - k) * (1 - k)));
    const fade = p.age > WAVE_EXPAND ? Math.max(0, 1 - (p.age - WAVE_EXPAND) / Math.max(0.01, p.life - WAVE_EXPAND)) : 1;
    const al = fade * (0.55 + 0.45 * (1 - k * 0.7));
    const ci = (p.ox + Math.floor(p.age * 8)) & 3;
    const col = STICK_TINTS[ci];
    const col2 = STICK_TINTS[(ci + 1) & 3];
    const dome = p.source === DOME;
    const ps = this.fx.ps;
    if (p.a >= PI) {
      // the Chorus: a crisp ring of light (polyline: a scaled ring texture would go blocky) + a soft floor wash
      const n = 36;
      const th = 3 * (1 - k * 0.4);
      let x0 = p.x + R;
      let y0 = p.y;
      for (let j = 1; j <= n; j++) {
        const a = (TAU * j) / n;
        const x1 = p.x + Math.cos(a) * R;
        const y1 = p.y + Math.sin(a) * R;
        r.line(Layer.FxAdd, x0, y0, x1, y1, th * 2.6, j & 1 ? col : col2, al * 0.16, Flag.Add);
        r.line(Layer.FxAdd, x0, y0, x1, y1, th, j & 1 ? C.white : col, al * 0.85, Flag.Add | Flag.Glow);
        x0 = x1;
        y0 = y1;
      }
      r.circle(Layer.Decal, p.x, p.y, R, col, al * 0.05);
      if (this.frameN % 2 === 0) {
        const a = ps.rng.angle();
        ps.emit(stickSpark, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 1, NaN, col2);
      }
      return;
    }
    // the crescent: a tapered band along the front (thick in the middle, fine at the tips) with a soft
    // under-glow and a trailing echo, colours cycling pink -> cyan -> yellow -> violet
    const half = p.a;
    const n = 14;
    const thick = (dome ? 4.2 : 3.4) * (1 - k * 0.35);
    let x0 = p.x + Math.cos(p.ang - half) * R;
    let y0 = p.y + Math.sin(p.ang - half) * R;
    let ex0 = p.x + Math.cos(p.ang - half) * (R - 5);
    let ey0 = p.y + Math.sin(p.ang - half) * (R - 5);
    for (let j = 1; j <= n; j++) {
      const u = j / n;
      const a = p.ang - half + 2 * half * u;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x1 = p.x + ca * R;
      const y1 = p.y + sa * R;
      const ex1 = p.x + ca * (R - 5);
      const ey1 = p.y + sa * (R - 5);
      const taper = Math.sin(PI * (u - 0.5 / n));
      r.line(Layer.FxAdd, x0, y0, x1, y1, 1 + thick * 2.4 * taper, col, al * 0.18, Flag.Add);
      r.line(Layer.FxAdd, ex0, ey0, ex1, ey1, 1 + thick * 0.5 * taper, col2, al * 0.35, Flag.Add);
      r.line(Layer.FxAdd, x0, y0, x1, y1, 0.8 + thick * taper, j & 1 ? C.white : col, al * 0.9, Flag.Add | Flag.Glow);
      x0 = x1;
      y0 = y1;
      ex0 = ex1;
      ey0 = ey1;
    }
    // the crest: the w_lightstick_wave crescent riding the middle of the front, undistorted
    // (it fades in once the front has left the hero, so it never flashes over her)
    const cs = dome ? 1.15 : 0.95;
    const crest = al * Math.min(1, Math.max(0, (R - 18) / 22));
    if (crest > 0.01) {
      const h = this.anims.frame("w_lightstick_wave", ci);
      r.spr(Layer.FxAdd, h, p.x + Math.cos(p.ang) * (R - 13 * cs), p.y + Math.sin(p.ang) * (R - 13 * cs), cs, cs, p.ang, 0xffffff, crest, 0, Flag.Add | Flag.Glow | Flag.NoSnap);
    }
    if (dome) {
      // a spotlight cone from the hero to the front
      r.line(Layer.FxAdd, p.x, p.y, p.x + Math.cos(p.ang) * R, p.y + Math.sin(p.ang) * R, 4 + R * 0.1, C.paleYellow, al * 0.1, Flag.Add);
    }
    if ((this.frameN + p.uid) % 3 === 0) {
      const a = p.ang + (ps.rng.next() * 2 - 1) * half;
      ps.emit(stickSpark, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 1, NaN, STICK_TINTS[(ci + 2) & 3]);
    }
  }

  // ---------------------------------------------------------------- kotatsu
  private drawKotatsu(inst: WeaponInstance, time: number, dt: number): void {
    const K = kotatsuOf(inst);
    const w = this.w as World;
    if (!K) return;
    const r = this.r;
    const pl = w.player;
    const evo = K.evo;
    const ax = K.x;
    const ay = K.y - 6;
    // the aura on the floor
    if (K.deployed) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
      const col = K.comfy ? C.lavender : C.orange;
      r.circle(Layer.Decal, ax, ay, K.r, col, (K.comfy ? 0.1 : 0.07) + 0.02 * pulse);
      this.ringLine(ax, ay, K.r, K.comfy ? C.lavender : C.paleYellow, 0.5 + 0.2 * pulse, 1.3, time * 0.4);
      if (K.comfy) this.ringLine(ax, ay, K.r * (0.6 + 0.1 * pulse), C.white, 0.12, 1, -time * 0.3);
    } else this.ringLine(pl.x, pl.y - 6, K.r, C.paleYellow, 0.16, 1, time);
    // the kotatsu itself (sorted just behind the hero)
    const so = this.so;
    so.id = evo ? "w_kotatsu_evo" : "w_kotatsu";
    so.layer = Layer.Entity;
    so.color = 0xffffff;
    so.alpha = 1;
    so.rot = 0;
    so.flipX = false;
    so.glow = false;
    so.noSnap = true;
    if (!K.deployed) {
      // folded: a quilt bundle on the hero's back
      so.frame = 0;
      so.x = pl.x - pl.face * 5;
      so.y = pl.y - 3 + Math.abs(Math.sin(time * 9)) * -1;
      so.scale = 0.5;
      so.sortY = pl.y - 0.6;
      r.sprite(so);
      return;
    }
    const moving = evo && pl.moving;
    so.frame = K.comfy ? 3 : 1 + (Math.floor(time * 2) & 1);
    so.x = K.x;
    so.y = K.y + 3 + (moving ? -Math.abs(Math.sin(time * 10)) * 1.5 : 0);
    so.scale = 1;
    so.sortY = K.y - 0.5;
    r.sprite(so);
    if (K.comfy) r.glow(K.x, K.y - 4, 16, C.orange, 0.22 + 0.06 * Math.sin(time * 5));
    // steam from the quilt top
    if (dt > 0 && this.frameN % (K.comfy ? 18 : 26) === 0) this.fx.ps.emit(steam, K.x + (this.fx.ps.rng.next() - 0.5) * 16, K.y - 14, 1);
    // Zzz over the dozing hero (base: weapons are off; evolution: mikan time)
    if (K.comfy) this.drawZ(pl.x + 5, pl.y - 26, time, 3, 1);
  }

  /**
   * A crisp floor ring (a polyline: the 1-px ring texture scaled up turns into a chunky staircase).
   * Dashed every other segment, slowly turning by `phase` so a deployed aura feels alive.
   */
  private ringLine(x: number, y: number, R: number, color: number, alpha: number, th: number, phase: number): void {
    const r = this.r;
    const n = Math.max(16, Math.min(48, Math.round(R * 0.6)));
    let x0 = x + Math.cos(phase) * R;
    let y0 = y + Math.sin(phase) * R;
    for (let j = 1; j <= n; j++) {
      const a = phase + (TAU * j) / n;
      const x1 = x + Math.cos(a) * R;
      const y1 = y + Math.sin(a) * R;
      r.line(Layer.Decal, x0, y0, x1, y1, th, color, j & 1 ? alpha : alpha * 0.45);
      x0 = x1;
      y0 = y1;
    }
  }

  /** `n` rising, swaying Zs over a point (the hero, a sleeping enemy). */
  private drawZ(x: number, y: number, time: number, n: number, scale: number): void {
    const r = this.r;
    for (let j = 0; j < n; j++) {
      const k = (time * 0.6 + j / n) % 1;
      const h = this.anims.frame("fx_zzz", Math.min(2, Math.floor(k * 3)));
      const zx = x + k * 7 + Math.sin(time * 3 + j * 2) * 1.5;
      const zy = y - k * 14;
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      r.spr(Layer.Fx, h, zx, zy, scale, scale, 0, 0xffffff, Math.max(0, a), 0, Flag.NoSnap);
    }
  }

  private drawSleepers(time: number): void {
    const w = this.w as World;
    const set = asleepIn(w);
    if (!set || set.size === 0) return;
    const items = w.enemies.items;
    const cam = this.r.camera;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (e.dead || !set.has(e.uid)) continue;
      if (!cam.inView(e.x, e.y, 20)) continue;
      this.drawZ(e.x + 3, e.y - e.cy * 2 - 3, time + (e.uid % 7) * 0.13, 2, 0.75);
    }
  }

  // ---------------------------------------------------------------- ENCORE! / WISH
  private drawEncore(time: number, realDt: number): void {
    if (this.encoreT < 0) return;
    this.encoreT += realDt;
    if (this.encoreT >= ENCORE_T) {
      this.encoreT = -1;
      return;
    }
    const r = this.r;
    const v = r.camera.view;
    const k = this.encoreT / ENCORE_T;
    const al = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
    const rise = (k < 0.15 ? k / 0.15 : 1) * 12;
    for (let i = 0; i < ENCORE_STICKS; i++) {
      const x = v.x + ((i + 0.5) / ENCORE_STICKS) * v.w;
      const y = v.y + v.h + 6 - rise - Math.abs(Math.sin(time * 9 + i * 0.8)) * 3;
      const sway = Math.sin(time * 8 + i * 0.6) * 0.45;
      const h = this.anims.frame("w_lightstick", (Math.floor(time * 6) + i) & 1);
      const col = CROWD_TINTS[i % CROWD_TINTS.length];
      r.spr(Layer.Overlay, h, x, y, 1, 1, sway, col, al, 0, Flag.Glow | Flag.NoSnap);
      r.glow(x + Math.sin(sway) * 5, y - 6, 6, col, al * 0.35, Layer.Overlay);
    }
  }

  private drawWish(realDt: number): void {
    if (this.wishT < 0) return;
    this.wishT += realDt;
    if (this.wishT >= STORM_TIME) {
      this.wishT = -1;
      return;
    }
    const v = this.r.camera.view;
    const ps = this.fx.ps;
    if (ps.count < ps.capacity * 0.7) ps.emit(goldRain, v.x + ps.rng.next() * v.w, v.y + ps.rng.next() * 20, 2);
  }

  // ================================================================ events
  bind(w: World, o: Arsenal2BindOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    this.reset();
    return [
      () => {
        this.reset();
        this.o = null;
      },
      w.bus.on("heroFx", (e) => this.cue(e)),
      w.bus.on("enemyHit", (e) => this.hit(e)),
    ];
  }

  /** Boba hits: a little brown puff (budgeted under load). */
  private hit(e: HitEvent): void {
    if (e.source !== BOBA && e.source !== TAPIOCA) return;
    const ps = this.fx.ps;
    if (ps.count > ps.capacity * 0.7) return;
    ps.emit(bobaPuff, e.x, e.y, e.source === TAPIOCA ? 2 : 1);
  }

  private cue(e: HeroFxEvent): void {
    const k = e.kind;
    if (k.charCodeAt(0) !== 97 || k.charCodeAt(1) !== 50) return; // "a2"
    const fx = this.fx;
    const ps = fx.ps;
    const juice = fx.juice;
    const calm = !!this.o?.calm;
    switch (k) {
      // ---------------------------------------------------------- Bubble Tea
      case A2_BOBA_POP: {
        const big = e.n === 2;
        ps.emit(bobaPuff, e.x, e.y, big ? 4 : 2, NaN, -1, big ? 1.6 : 1);
        ps.emit(teaDrop, e.x, e.y, big ? 6 : 3);
        if (this.now - this.popAt > 0.08) {
          this.popAt = this.now;
          this.sfx("bubblePop", big ? 0.45 : 0.25, big ? -3 : 4, e.x);
        }
        break;
      }
      case A2_BOBA_SPLIT:
        ps.emit(P.sparkle, e.x, e.y, 3, NaN, C.paleYellow);
        break;
      case A2_BOBA_SHED:
        ps.emit(teaDrop, e.x, e.y, 2 + e.n);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, BOBA_COLOR, 0.5);
        break;
      // ---------------------------------------------------------- cranes
      case A2_CRANE_DART:
        if (this.now - this.dartAt >= 0.15) {
          this.dartAt = this.now;
          this.sfx("paperCrane", 0.5, 0, e.x);
        }
        ps.emit(paperBit, e.x, e.y, 2);
        break;
      case A2_CRANE_FOLD:
        ps.emit(foldStar, e.x, e.y, e.n >= FOLD_MAX ? 6 : 2);
        if (e.n >= FOLD_MAX) ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.paleYellow, 0.6);
        break;
      case A2_CRANE_CRUMPLE:
        if (e.n > 0) {
          ps.emit(paperScrap, e.x, e.y - 4, 8);
          this.sfx("crunch", 0.35, 3, e.x);
        }
        break;
      case A2_WISH: {
        this.wishT = 0;
        this.o?.hooks?.banner?.("info", "WISH GRANTED!", "a thousand cranes later: full heal");
        this.texts.add("WISH GRANTED!", 0, -100, { anchor: 2, rainbow: true, scale: 2, life: 1.6, glow: true });
        ps.emit(goldBit, e.x, e.y, 24, NaN, -1, 1.6, 2.5);
        ps.emit(P.ring, e.x, e.y, 1, NaN, C.gold, 2.5);
        this.sfx("evolve", 0.8, 3);
        this.sfx("paperCrane", 0.9, -2);
        if (!calm) {
          juice.flash(C.gold, 0.25, 0.3);
          juice.shake(0.2);
        }
        this.o?.haptic(30);
        break;
      }
      // ---------------------------------------------------------- lightsticks
      case A2_WAVE:
        if (e.n === 1) {
          // the Chorus
          this.sfx("lightstick", 0.75, 0, e.x);
          ps.emit(stickSpark, e.x, e.y, 10, NaN, C.pinkLight, 1.2, 2.5);
          if (!calm) juice.shake(0.06);
        } else this.sfx("lightstick", e.n === 2 ? 0.38 : 0.5, 0, e.x);
        break;
      case A2_ENCORE:
        this.encoreT = 0;
        this.texts.add("ENCORE!", 0, -100, { anchor: 2, rainbow: true, scale: 2.5, life: 1, glow: true });
        this.sfx("lightstick", 0.9, 0);
        this.sfx("comboUp", 0.45, 5);
        if (!calm) {
          juice.shake(0.12);
          juice.bloomSurge(0.25, 0.4);
        }
        this.o?.haptic(15);
        break;
      // ---------------------------------------------------------- kotatsu
      case A2_KOTATSU_DEPLOY:
        // the yawn
        this.sfx("snore", 0.3, 5, e.x);
        ps.emit(quiltDust, e.x, e.y, 5);
        ps.emit(steam, e.x, e.y - 12, 2);
        break;
      case A2_KOTATSU_FOLD:
        ps.emit(quiltDust, e.x, e.y, 3);
        break;
      case A2_KOTATSU_COMFY:
        this.sfx("snore", 0.8, 0, e.x);
        this.texts.add(e.n === 1 ? "Too Comfy... (mikan time)" : "Too Comfy...", 0, -40, { anchor: 1, color: C.lavender, scale: 1, life: 1.4, rise: 6 });
        ps.emit(sleepSpark, e.x, e.y, 4);
        break;
      case A2_KOTATSU_SNORE:
        this.sfx("snore", 0.5, 0, e.x);
        break;
      case A2_KOTATSU_WAKE:
        if (e.r > 1.5) this.texts.add("!", 0, -36, { anchor: 1, color: C.yellow, scale: 1.5, life: 0.5, rise: 4 });
        break;
      case A2_SLEEP:
        ps.emit(sleepSpark, e.x, e.y, 2);
        break;
      case A2_MIKAN:
        ps.emit(mikanDrop, e.x, e.y, 6);
        ps.emit(mikanPuff, e.x, e.y, 2, NaN, -1, Math.max(0.8, e.r / 12));
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.orange, e.r / 16);
        if (this.now - this.popAt > 0.06) {
          this.popAt = this.now;
          this.sfx("splash", 0.3, 4, e.x);
        }
        break;
    }
  }
}
