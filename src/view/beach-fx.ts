/**
 * Beach Episode visuals (stage 4): what the generic drawer can't express for
 * Crab-kun, Seagull, Jellyfish, Watermelon, Sandcastle Golem, Tiny Shark,
 * Kraken-chan and the Summer Festival Firework Dragon, plus the tideSweep
 * water and the props' pops.
 *
 *   decorate  per enemy (WorldView.drawEnemies through s45-fx.ts): crabs always
 *             face the hero (King Crab wears a crown), seagull "!" tells + the loot
 *             in its beak, jelly glow + zap crackle, shark fin ripples, the sand
 *             pile's rebuild ring, rolling-melon dust, dragon head sparks
 *   draw      tide bands, Kraken-chan's tentacles / ink puddles / HIGH TIDE water,
 *             the dragon's lantern body + rockets in flight, death scenes (a crab
 *             hugs Kraken-chan), boss line captions
 *   bind      the 400-449 `enemyFx` cues (enemies/_s45.ts), boss deaths, prop pops
 *
 * Reads the world, never mutates it. No per-frame allocation (fixed tick rings).
 */
import { C } from "../art/palette";
import { rainbow } from "../core/color";
import { TAU, clamp, ease } from "../core/math";
import { CONFETTI_COLORS, fxFirework, P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { EnemyFxEvent } from "../game/events";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import {
  BX_BREATH,
  BX_BURST,
  BX_CHAIN,
  BX_DANCE,
  BX_DIVE,
  BX_HUG,
  BX_INK,
  BX_INK_CANNON,
  BX_LUNGE,
  BX_MOAT,
  BX_PILE,
  BX_REBUILD,
  BX_ROCKET,
  BX_SIDESTEP,
  BX_SPLIT,
  BX_STEAL,
  BX_SUBMERGE,
  BX_SURFACE,
  BX_TENTACLE,
  BX_TIDE,
  BX_ZAP,
  envOf,
} from "../game/enemies/_s45";
import { GOLEM_PILE, PILE_TIME } from "../game/enemies/sandcastle-golem";
import { SG_CAKE, SG_CHEST, SG_COIN, SG_GOLD_CHEST, SG_HEART, SG_ONIGIRI } from "../game/enemies/seagull";
import { jellyRadius } from "../game/enemies/jellyfish";
import { MODE_STRAIGHT } from "../game/types";
import { KR_HUG, PUDDLE_LIFE, PUDDLE_N, PUDDLE_R, PUDDLE_TELE, TENT_N, TENT_SINK, TENT_STAY, TENT_TELE, krakenState } from "../game/bosses/kraken-chan";
import { BURST_COLORS, SEGMENTS, dragonState } from "../game/bosses/firework-dragon";
import { TIDE_HALF, tideBands } from "../game/director/events-s45";
import type { Anims } from "./anims";
import { bulletLook } from "./bullet-looks";
import { Captions, popText, step, tick, ticks, type S45BindOpts } from "./s45-common";
import type { Speech } from "./speech";
import type { WorldTexts } from "./texts";

const PI = Math.PI;
/** Sea water over sand (teal reads as water on the warm beach; plain blue went grey). */
const SEA = 0x2fb8c9;

// enemy bullets of the beach (bullet-looks.ts)
bulletLook("eb_ink", { glow: C.cyan, glowR: 9.5, spin: 2.5 });
bulletLook("eb_seed", { glow: C.pink, glowR: 6.5, velRot: true });
bulletLook("eb_firework", { glow: C.yellow, glowR: 9.5, spin: 7 });

// ---------------------------------------------------------------- emitters
const sand: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [20, 70],
  life: [0.4, 0.8],
  size: [1, 0.6],
  sizeJitter: 0.4,
  colors: [0xf3d9a4, 0xe8c27e, 0xfff0c9, C.gold],
  bounce: { vz: [40, 110], gravity: 380, restitution: 0.3, friction: 7 },
  alphaCurve: "late",
  layer: Layer.Fx,
};
const splashDrop: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [25, 80],
  angle: -PI / 2,
  spread: PI * 0.9,
  life: [0.35, 0.65],
  size: [1, 0.5],
  colors: [C.white, C.aqua, C.lightBlue],
  gravity: 260,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const ink: EmitterDef = { ...splashDrop, colors: [C.darkViolet, C.violet, C.deep, C.cyan] };
const juice: EmitterDef = { ...splashDrop, colors: [C.red, C.pinkLight, C.green, C.lime, C.white], speed: [30, 95] };
const zap: EmitterDef = { ...P.sparkle, colors: [C.cyan, C.aqua, C.white], speed: [20, 70], life: [0.15, 0.3] };
const ember: EmitterDef = { ...P.sparkle, colors: [C.yellow, C.orange, C.paleYellow], speed: [10, 40], gravity: 30, life: [0.3, 0.6] };
const heart: EmitterDef = { ...P.hearts };
const ice: EmitterDef = { ...P.sparkle, colors: [C.aqua, C.lightBlue, C.white], speed: [15, 50] };

/** Kraken-chan's death scene: a cosmetic crab walks up and hugs her. */
interface KrakenDeath {
  t: number;
  x: number;
  y: number;
  h: number;
  face: number;
}

export class BeachFx {
  private w: World | null = null;
  private o: S45BindOpts | null = null;
  private now = 0;
  private frameN = 0;
  private live = true;
  private readonly hTentacle: number;
  private readonly nTentacle: number;
  private readonly hBody: number;
  private readonly hCrab: number;
  private readonly nCrab: number;
  private readonly hKraken: number;
  private readonly hCoin: number;
  private readonly hChest: number;
  private readonly hOnigiri: number;
  private readonly hCake: number;
  private readonly hHeart: number;
  private readonly hPx: number;
  // timed visuals
  private readonly zaps = ticks(8);
  private readonly rockets = ticks(12);
  private readonly rings = ticks(10);
  private readonly kd: KrakenDeath = { t: -1, x: 0, y: 0, h: 0, face: 1 };
  private readonly captions: Captions;
  private tamayaAt = -1;
  private hugAt = -1;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly anims: Anims,
    private readonly texts: WorldTexts,
    speech: Speech,
  ) {
    const t = anims.get("boss_kraken_tentacle");
    this.hTentacle = t.first;
    this.nTentacle = t.count;
    this.hBody = anims.get("boss_firework_body").first;
    const crab = anims.get("en_crab");
    this.hCrab = crab.first;
    this.nCrab = crab.count;
    this.hKraken = anims.get("boss_kraken").first;
    this.hCoin = anims.get("coin").first;
    this.hChest = anims.get("chest").first;
    this.hOnigiri = anims.get("food_onigiri").first;
    this.hCake = anims.get("food_cake").first;
    this.hHeart = r.atlas.handle("icon_heart");
    this.hPx = r.atlas.handle("fx_px");
    this.captions = new Captions(speech);
  }

  setWorld(w: World): void {
    this.w = w;
    for (const l of [this.zaps, this.rockets, this.rings]) for (const t of l) t.life = 0;
    this.kd.t = -1;
    this.captions.clear();
  }

  private sfx(id: Parameters<S45BindOpts["sfx"]>[0], vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  // ================================================================ per enemy
  /** Extra looks for one beach enemy; true when it drew the sprite itself. */
  decorate(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number, alpha: number): boolean {
    const w = this.w;
    if (!w) return false;
    const r = this.r;
    const live = this.live;
    switch (e.def.id) {
      case "crab_kun": {
        // crabs face the hero and scuttle sideways
        const f = w.player.x >= e.x ? 1 : -1;
        const jit = e.state === 1 ? (((time * 40) | 0) & 1 ? 0.6 : -0.6) : 0;
        if (e.state === 2 && live && (this.frameN + e.uid) % 2 === 0) this.fx.ghosts.spawn(h, e.x, y, Math.abs(sx) * f, sy, 0, C.orange, 0.16, 0.45);
        r.spr(Layer.Entity, h, e.x + jit, y, Math.abs(sx) * f, sy, 0, tint, alpha, flash, 0);
        if (e.elite) this.crown(e.x, y - 14 * e.scale, e.scale, time);
        return true;
      }
      case "seagull": {
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, tint, alpha, flash, 0);
        if (e.state === 1) {
          // the dive tell: "!" and a shadow that swells where it will hit
          const k = clamp(e.timer / 0.5, 0, 1);
          r.text.drawFast(Layer.Text, "!", Math.round(e.x - 1), Math.round(y - 22 - 2 * Math.sin(time * 30)), 1, C.red, 1, 0, 0, 0);
          r.shadow(e.x, e.y, 10 + 8 * k, 0.5 + 0.3 * k);
        }
        if (e.b > 0) this.loot(e, y, time);
        return true;
      }
      case "jellyfish": {
        const tell = e.state === 1;
        const k = tell ? clamp(e.timer / 0.5, 0, 1) : 0;
        r.glow(e.x, y - 7 * e.scale, (9 + 8 * k) * e.scale, tell ? C.cyan : C.lavender, (0.22 + 0.08 * Math.sin(time * 4 + e.uid)) * (1 + 2 * k) * alpha);
        if (tell) {
          // crackle: the ring it is about to pulse
          const R = jellyRadius(e);
          r.ring(Layer.Decal, e.x, e.y, R * (0.4 + 0.6 * k), C.cyan, 0.5 * k, Flag.Add | Flag.Glow, true);
          if (live && (this.frameN + e.uid) % 3 === 0) this.fx.ps.emit(zap, e.x + Math.cos(time * 9) * 6, y - 8, 1);
        }
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, tint, alpha * 0.88, tell ? Math.max(flash, 0.35 + 0.35 * Math.sin(time * 40)) : flash, tell ? Flag.Glow : 0);
        return true;
      }
      case "tiny_shark": {
        if (e.state === 0) {
          // just a fin: sand ripples behind it
          const q = (time * 2.2 + e.uid * 0.37) % 1;
          r.ring(Layer.Decal, e.x, e.y, 4 + 7 * q, 0xe8c27e, 0.55 * (1 - q), 0, false);
          if (live && (this.frameN + e.uid) % 6 === 0) this.fx.ps.emit(sand, e.x - e.face * 4, e.y, 1, NaN, -1, 0.6, 0.4);
        } else if (e.state === 1) {
          r.text.drawFast(Layer.Text, "!", Math.round(e.x - 1), Math.round(y - 17 - 2 * Math.sin(time * 30)), 1, C.red, 1, 0, 0, 0);
        }
        return false;
      }
      case "sandcastle_golem": {
        if (e.state !== GOLEM_PILE) return false;
        // the rebuild clock: a ring that fills, sand that trickles back up
        const k = clamp(e.timer / PILE_TIME, 0, 1);
        const n = 16;
        const lit = Math.floor(k * n);
        for (let i = 0; i < n; i++) {
          const a = -PI / 2 + (i / n) * TAU;
          r.rect(Layer.Decal, Math.round(e.x + Math.cos(a) * 13 * e.scale), Math.round(e.y + Math.sin(a) * 6 * e.scale), 1, 1, i < lit ? C.gold : C.paleYellow, i < lit ? 0.95 : 0.35);
        }
        if (live && k > 0.6 && (this.frameN + e.uid) % 4 === 0) this.fx.ps.emit(sand, e.x + (Math.random() - 0.5) * 14, e.y - 2, 1, -PI / 2, -1, 0.7, 0.5);
        r.spr(Layer.Entity, h, e.x, y + (k > 0.85 ? -(((time * 30) | 0) & 1) : 0), sx, sy, 0, tint, alpha, flash, 0);
        return true;
      }
      case "watermelon": {
        if ((e.mode === MODE_STRAIGHT || e.state === 2) && live && (this.frameN + e.uid) % 3 === 0) this.fx.ps.emit(P.dust, e.x, e.y, 1, NaN, -1, 0.8);
        return false;
      }
      case "firework_dragon": {
        // fuse whiskers fizz
        if (live && this.frameN % 2 === 0) this.fx.ps.emit(ember, e.x + e.face * 22 * e.scale, y - 24, 1);
        r.glow(e.x, y - 18, 30, C.orange, 0.18 + 0.06 * Math.sin(time * 7), Layer.FxAdd);
        return false;
      }
      case "kraken_chan": {
        if (e.state === KR_HUG && live && this.frameN % 2 === 0) this.fx.ghosts.spawn(h, e.x, y, sx, sy, 0, C.pink, 0.2, 0.35);
        return false;
      }
      default:
        return false;
    }
  }

  /** A little gold crown (King Crab). */
  private crown(x: number, y: number, s: number, time: number): void {
    const r = this.r;
    const cx = Math.round(x);
    const cy = Math.round(y + Math.sin(time * 6) * 0.5);
    r.rect(Layer.Text, cx - 4, cy - 1, 9, 3, C.outline, 1);
    r.rect(Layer.Text, cx - 3, cy, 7, 1, C.yellow, 1);
    for (let i = 0; i < 3; i++) {
      r.rect(Layer.Text, cx - 4 + i * 4, cy - 3, 1, 2, C.outline, 1);
      r.rect(Layer.Text, cx - 3 + i * 3, cy - 2, 1, 2, C.yellow, 1);
    }
    r.glow(cx, cy, 5 * s, C.yellow, 0.35);
  }

  /** The stolen pickup in a seagull's beak. */
  private loot(e: Enemy, y: number, time: number): void {
    const r = this.r;
    const bx = e.x + e.face * 6 * e.scale;
    const by = y - 6 * e.scale + Math.sin(time * 12) * 0.5;
    let h = this.hCoin;
    let s = 0.8;
    switch (e.b) {
      case SG_COIN:
        h = this.hCoin;
        break;
      case SG_ONIGIRI:
        h = this.hOnigiri;
        break;
      case SG_CAKE:
        h = this.hCake;
        break;
      case SG_HEART:
        h = this.hHeart;
        s = 0.55;
        break;
      case SG_CHEST:
      case SG_GOLD_CHEST:
        h = this.hChest;
        s = 0.6;
        r.glow(bx, by, 12, e.b === SG_GOLD_CHEST ? C.yellow : C.pink, 0.4);
        break;
    }
    r.spr(Layer.Fx, h, bx, by, s, s, 0, 0xffffff, 1, 0, Flag.Glow);
  }

  // ================================================================ per frame
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.frameN++;
    this.now += realDt;
    this.live = dt > 0;
    this.flushLater();
    this.drawTides(time);
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i];
      if (e.dead) continue;
      if (e.def.id === "kraken_chan") this.drawKraken(e, time);
      else if (e.def.id === "firework_dragon") this.drawDragon(e, time);
    }
    this.drawTicks(time, realDt);
    this.drawKrakenDeath(time, realDt);
    // (a slowed hero splashes)
    const env = envOf(w);
    if (env.slowNow < 0.95 && this.live && this.frameN % 5 === 0 && w.stage.id === "beach_episode") this.fx.ps.emit(splashDrop, w.player.x, w.player.y, 1, NaN, -1, 0.7, 0.4);
  }

  /** tideSweep water bands: translucent sea with a foam edge on both sides. */
  private drawTides(time: number): void {
    const w = this.w!;
    const bands = tideBands(w);
    if (!bands.length) return;
    const r = this.r;
    const v = r.camera.view;
    for (const b of bands) {
      if (!b.on) continue;
      const cx = b.ox + b.dx * b.pos;
      const cy = b.oy + b.dy * b.pos;
      const horiz = b.dx !== 0;
      const tele = b.tele > 0;
      const a = tele ? 0.35 + 0.35 * Math.abs(Math.sin(time * 9)) : 1;
      if (!tele) {
        if (horiz) r.rect(Layer.Decal, Math.round(cx - TIDE_HALF), Math.round(v.y - 4), TIDE_HALF * 2, v.h + 8, SEA, 0.55);
        else r.rect(Layer.Decal, Math.round(v.x - 4), Math.round(cy - TIDE_HALF), v.w + 8, TIDE_HALF * 2, SEA, 0.55);
        // a lighter shimmer stripe in the middle
        if (horiz) r.rect(Layer.Decal, Math.round(cx - 6 + Math.sin(time * 3) * 4), Math.round(v.y - 4), 8, v.h + 8, C.aqua, 0.16);
        else r.rect(Layer.Decal, Math.round(v.x - 4), Math.round(cy - 6 + Math.sin(time * 3) * 4), v.w + 8, 8, C.aqua, 0.16);
      }
      // foam edges (the leading one only while it waits: the telegraph)
      for (let side = -1; side <= 1; side += 2) {
        if (tele && side !== 1) continue;
        const ex = horiz ? cx + side * TIDE_HALF * b.dx : 0;
        const ey = horiz ? 0 : cy + side * TIDE_HALF * b.dy;
        const len = horiz ? v.h + 8 : v.w + 8;
        for (let s = 0; s < len; s += 3) {
          const wob = Math.round(Math.sin(time * 6 + s * 0.21) * 1.6);
          if (horiz) r.rect(Layer.Decal, Math.round(ex + wob), Math.round(v.y - 4 + s), 2, 2, C.white, 0.75 * a);
          else r.rect(Layer.Decal, Math.round(v.x - 4 + s), Math.round(ey + wob), 2, 2, C.white, 0.75 * a);
        }
      }
    }
  }

  private drawKraken(e: Enemy, time: number): void {
    const s = krakenState(e);
    if (!s) return;
    const r = this.r;
    const v = r.camera.view;
    // HIGH TIDE: the sea around the shrinking beach
    if (s.tide && s.tideD > 0) {
      const ix = this.w!.viewW * 0.5 - s.tideD;
      const iy = this.w!.viewH * 0.5 - s.tideD;
      const x0 = s.tideX - ix;
      const x1 = s.tideX + ix;
      const y0 = s.tideY - iy;
      const y1 = s.tideY + iy;
      const L = Layer.Decal;
      const vx0 = v.x - 4;
      const vy0 = v.y - 4;
      const vx1 = v.x + v.w + 4;
      const vy1 = v.y + v.h + 4;
      const col = SEA;
      const al = 0.62;
      if (y0 > vy0) r.rect(L, vx0, vy0, vx1 - vx0, y0 - vy0, col, al);
      if (y1 < vy1) r.rect(L, vx0, y1, vx1 - vx0, vy1 - y1, col, al);
      const top = Math.max(vy0, y0);
      const bot = Math.min(vy1, y1);
      if (x0 > vx0 && bot > top) r.rect(L, vx0, top, x0 - vx0, bot - top, col, al);
      if (x1 < vx1 && bot > top) r.rect(L, x1, top, vx1 - x1, bot - top, col, al);
      // shallows: a lighter strip just inside the waterline, and slow swell stripes out at sea
      const sh = 7;
      if (y0 > vy0) r.rect(L, Math.max(vx0, x0 - sh), y0 - sh, Math.min(vx1, x1 + sh) - Math.max(vx0, x0 - sh), sh, C.aqua, 0.35);
      if (y1 < vy1) r.rect(L, Math.max(vx0, x0 - sh), y1, Math.min(vx1, x1 + sh) - Math.max(vx0, x0 - sh), sh, C.aqua, 0.35);
      if (x0 > vx0 && bot > top) r.rect(L, x0 - sh, top, sh, bot - top, C.aqua, 0.35);
      if (x1 < vx1 && bot > top) r.rect(L, x1, top, sh, bot - top, C.aqua, 0.35);
      for (let k = 0; k < 3; k++) {
        const d = ((time * 9 + k * 14) % 40) + 10;
        if (x0 - d > vx0) r.rect(L, Math.round(x0 - d), top, 1, bot - top, C.white, 0.18);
        if (x1 + d < vx1) r.rect(L, Math.round(x1 + d), top, 1, bot - top, C.white, 0.18);
        if (y0 - d > vy0) r.rect(L, vx0, Math.round(y0 - d), vx1 - vx0, 1, C.white, 0.18);
        if (y1 + d < vy1) r.rect(L, vx0, Math.round(y1 + d), vx1 - vx0, 1, C.white, 0.18);
      }
      // foam along the waterline
      for (let k = 0; k < 4; k++) {
        const horiz = k < 2;
        const fixed = k === 0 ? y0 : k === 1 ? y1 : k === 2 ? x0 : x1;
        const from = horiz ? Math.max(vx0, x0) : Math.max(vy0, y0);
        const to = horiz ? Math.min(vx1, x1) : Math.min(vy1, y1);
        for (let q = from; q < to; q += 3) {
          const wob = Math.round(Math.sin(time * 5 + q * 0.19 + k) * 1.5);
          if (horiz) r.rect(L, Math.round(q), Math.round(fixed + wob), 2, 2, C.white, 0.7);
          else r.rect(L, Math.round(fixed + wob), Math.round(q), 2, 2, C.white, 0.7);
        }
      }
    }
    // ink puddles
    for (let i = 0; i < PUDDLE_N; i++) {
      const a = s.pAge[i];
      if (a < 0) continue;
      const grow = a < PUDDLE_TELE ? 0 : clamp((a - PUDDLE_TELE) / 0.25, 0, 1);
      if (grow <= 0) continue;
      const fade = a > PUDDLE_TELE + PUDDLE_LIFE - 0.6 ? (PUDDLE_TELE + PUDDLE_LIFE - a) / 0.6 : 1;
      const R = PUDDLE_R * ease.backOut(grow);
      r.circle(Layer.Decal, s.px[i], s.py[i], R, C.darkViolet, 0.5 * fade);
      r.circle(Layer.Decal, s.px[i] - R * 0.25, s.py[i] - R * 0.3, R * 0.35, C.violet, 0.35 * fade);
      r.ring(Layer.Decal, s.px[i], s.py[i], R, C.cyan, 0.35 * fade, 0, false);
    }
    // tentacles rising from the sand
    const b = r.batch;
    for (let i = 0; i < TENT_N; i++) {
      const a = s.tAge[i];
      if (a < 0) continue;
      let f = 1;
      let rise = 1;
      if (a < TENT_TELE) {
        if (a < TENT_TELE - 0.35) continue;
        f = 0;
        rise = (a - (TENT_TELE - 0.35)) / 0.35;
      } else if (a < TENT_TELE + 0.14) f = 2;
      else if (a < TENT_TELE + TENT_STAY) f = 1;
      else {
        f = 3;
        rise = 1 - (a - TENT_TELE - TENT_STAY) / TENT_SINK;
      }
      if (rise <= 0) continue;
      const sway = f === 1 ? Math.sin(time * 4 + i * 1.7) * 0.08 : 0;
      b.sortKey = s.ty[i];
      r.spr(Layer.Entity, this.hTentacle + Math.min(this.nTentacle - 1, f), s.tx[i], s.ty[i], 1, Math.max(0.05, rise), sway, 0xffffff, 1, 0, 0);
      b.sortKey = NaN;
      r.shadow(s.tx[i], s.ty[i], 12, 0.7);
      if (f === 0 && this.live && (this.frameN + i) % 3 === 0) this.fx.ps.emit(sand, s.tx[i], s.ty[i], 1, -PI / 2, -1, 0.7, 0.6);
    }
  }

  private drawDragon(e: Enemy, time: number): void {
    const s = dragonState(e);
    if (!s) return;
    const r = this.r;
    const b = r.batch;
    // the lantern body, tail to neck (y-sorted with everything else)
    for (let k = SEGMENTS - 1; k >= 0; k--) {
      const x = s.segX[k];
      const y = s.segY[k];
      const z = e.z + 2 + Math.sin(time * 4 + k * 0.9) * 2;
      const sc = 1 - k * 0.06;
      const f = Math.floor(time * 4 + k) & 1;
      r.shadow(x, y, 10 * sc, 0.6);
      const col = s.phase >= 2 ? BURST_COLORS[(k + Math.floor(time * 3)) % BURST_COLORS.length] : C.orange;
      r.glow(x, y - z - 7, 11 * sc, col, 0.22 + 0.08 * Math.sin(time * 6 + k), Layer.FxAdd);
      b.sortKey = y;
      r.spr(Layer.Entity, this.hBody + f, x, y - z - 7, sc, sc, 0, 0xffffff, e.alpha, e.flash > 0 ? 0.6 : 0, 0);
      b.sortKey = NaN;
      if (this.live && (this.frameN + k * 3) % 9 === 0) this.fx.ps.emit(ember, x, y - z - 12, 1);
    }
  }

  // ---------------------------------------------------------------- timed visuals
  private drawTicks(time: number, realDt: number): void {
    const r = this.r;
    // zap rings
    for (const t of this.zaps) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const R = t.r * (0.4 + 0.6 * ease.cubicOut(k));
      r.ring(Layer.FxAdd, t.x, t.y, R, C.cyan, 0.8 * (1 - k), Flag.Add | Flag.Glow, true);
      r.ring(Layer.Decal, t.x, t.y, R, C.white, 0.5 * (1 - k), 0, false);
    }
    // rockets climbing to their burst spot (an arc from the dragon's mouth)
    for (const t of this.rockets) {
      const k = step(t, realDt);
      if (k < 0) continue;
      const e = ease.quadOut(k);
      const x = t.x + (t.x2 - t.x) * e;
      const y = t.y + (t.y2 - 28 - t.y) * e - Math.sin(k * PI) * 46;
      const col = BURST_COLORS[t.n % BURST_COLORS.length];
      r.glow(x, y, 7, col, 0.7, Layer.FxAdd);
      r.spr(Layer.FxAdd, this.hPx, x, y, 1.2, 1.2, 0, C.white, 1, 0, Flag.Add | Flag.Glow);
      if (this.live && ((time * 60) | 0) % 2 === 0) this.fx.ps.emit(ember, x, y, 1, NaN, col);
    }
    // soft expanding rings (tide rush, hug hearts, rebuilds)
    for (const t of this.rings) {
      const k = step(t, realDt);
      if (k < 0) continue;
      r.ring(Layer.FxAdd, t.x, t.y, t.r * ease.cubicOut(k), t.n || C.white, 0.6 * (1 - k), Flag.Add | Flag.Glow, true);
    }
  }

  /** Kraken-chan's defeat: her blushing pose stays, a crab walks up and hugs her. */
  private drawKrakenDeath(time: number, realDt: number): void {
    const d = this.kd;
    if (d.t < 0) return;
    d.t += realDt;
    const T = 4.2;
    if (d.t >= T) {
      d.t = -1;
      return;
    }
    const r = this.r;
    const fade = d.t > T - 0.6 ? (T - d.t) / 0.6 : Math.min(1, d.t / 0.5);
    if (d.t > 0.9) r.spr(Layer.Entity, d.h, d.x, d.y, d.face, 1, 0, 0xffffff, fade, 0, 0);
    // the crab: walks in from the side (1.0 -> 2.4 s), then hugs (claws up, little hops)
    const startX = d.x - d.face * 70;
    const endX = d.x - d.face * 30;
    const k = clamp((d.t - 1) / 1.4, 0, 1);
    if (d.t > 1) {
      const cx = startX + (endX - startX) * ease.sineInOut(k);
      const hugging = k >= 1;
      const f = hugging ? 2 : Math.floor(time * 10) & 1;
      const hop = hugging ? Math.abs(Math.sin(time * 9)) * 2 : 0;
      r.shadow(cx, d.y, 12, fade);
      r.spr(Layer.Entity, this.hCrab + Math.min(this.nCrab - 1, f), cx, d.y - hop, d.face, 1, 0, 0xffffff, fade, 0, 0);
      if (hugging && this.live && this.frameN % 10 === 0) this.fx.ps.emit(heart, (cx + d.x) / 2, d.y - 26, 1);
    }
  }

  // ================================================================ events
  bind(w: World, o: S45BindOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    const bus = w.bus;
    return [
      bus.on("enemyFx", (e) => this.onFx(e)),
      bus.on("enemyKilled", (e) => {
        if (!e.boss) return;
        const en = e.enemy;
        if (en.def.id === "kraken_chan") {
          this.kd.t = 0;
          this.kd.x = en.x;
          this.kd.y = en.y;
          this.kd.h = this.hKraken + 5;
          this.kd.face = en.face;
          this.captions.show("Nobody... ever wants... to hug the kraken...", en.x, en.y - 58, 3.2);
          this.later(2.6, () => this.captions.show("...♡", this.kd.x, this.kd.y - 44, 1.8, C.hotPink));
        } else if (en.def.id === "firework_dragon") {
          this.captions.show("...and that concludes tonight's show. Please exit in an orderly fashion.", en.x, en.y - 48, 4);
          // the last of the fireworks go up
          for (let i = 0; i < 6; i++) this.later(0.25 + i * 0.22, () => fxFirework(this.fx, w.player.x + (Math.random() - 0.5) * 150, w.player.y - 40 - Math.random() * 70, CONFETTI_COLORS));
        }
      }),
      bus.on("propBroken", (e) => {
        if (e.sprite === "prop_beachball") {
          this.fx.ps.emit(P.confetti, e.x, e.y - 6, 18);
          this.sfx("bubblePop", 0.9, 2, e.x);
        } else if (e.sprite === "prop_cooler") {
          this.fx.ps.emit(ice, e.x, e.y - 6, 10);
          this.sfx("freeze", 0.5, 4, e.x);
        }
      }),
      bus.on("bossPhase", (e) => {
        if (e.id === "firework_dragon" && !o.calm) {
          for (let i = 0; i < 5; i++) this.later(0.1 + i * 0.15, () => fxFirework(this.fx, w.player.x + (Math.random() - 0.5) * 140, w.player.y - 50 - Math.random() * 60, CONFETTI_COLORS));
        }
      }),
    ];
  }

  private readonly laters: { t: number; fn: () => void }[] = [];
  /** Event-time delayed effect (real seconds; ticks in draw via flushLater). */
  private later(sec: number, fn: () => void): void {
    this.laters.push({ t: this.now + sec, fn });
  }
  flushLater(): void {
    const l = this.laters;
    for (let i = l.length - 1; i >= 0; i--) {
      if (this.now >= l[i].t) {
        const fn = l[i].fn;
        l.splice(i, 1);
        fn();
      }
    }
  }
  dispose(): void {
    this.laters.length = 0;
    this.kd.t = -1;
    this.captions.clear();
  }

  private onFx(e: EnemyFxEvent): void {
    const w = this.w;
    if (!w || e.kind < 400 || e.kind >= 450) return;
    const fx = this.fx;
    const ps = fx.ps;
    const o = this.o;
    const calm = !!o?.calm;
    switch (e.kind) {
      case BX_SIDESTEP:
        ps.emit(P.dust, e.x - e.dx * e.power, e.y, 3, Math.atan2(-e.dy, -e.dx));
        this.sfx("dash", 0.35, 6, e.x);
        break;
      case BX_LUNGE:
        ps.emit(P.dust, e.x, e.y, 2, Math.atan2(-e.dy, -e.dx), -1, e.power);
        break;
      case BX_STEAL:
        ps.emit(P.sparkle, e.x, e.y - 14, 4, NaN, C.yellow);
        this.sfx("coin", 0.5, -4, e.x);
        break;
      case BX_DIVE:
        this.sfx("dash", 0.3, 3, e.x);
        break;
      case BX_ZAP:
        tick(this.zaps, e.x, e.y, 0, 0, e.power, 0, 0.32);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + Math.random();
          fx.bolts.strike(e.x, e.y - 8, e.x + Math.cos(a) * e.power, e.y + Math.sin(a) * e.power * 0.7, { color: C.cyan, thickness: 1, life: 0.12, branches: 0, impact: false });
        }
        ps.emit(zap, e.x, e.y - 6, 6);
        this.sfx("thunder", 0.25, 8, e.x);
        break;
      case BX_CHAIN:
        fx.bolts.strike(e.x, e.y, e.dx, e.dy, { color: C.cyan, thickness: 2, life: 0.18, branches: 1 });
        this.sfx("thunder", 0.35, 5, e.x);
        break;
      case BX_SPLIT:
        ps.emit(juice, e.x, e.y, 14);
        this.sfx("splash", 0.6, 2, e.x);
        break;
      case BX_PILE:
        ps.emit(sand, e.x, e.y - 6, 16, NaN, -1, e.power);
        fx.ps.emit(P.smoke, e.x, e.y - 4, 3, NaN, 0xf3d9a4);
        this.sfx("crunch", 0.7, -2, e.x);
        break;
      case BX_MOAT:
        ps.emit(sand, e.x, e.y - 4, 22, NaN, -1, 1.2);
        ps.emit(splashDrop, e.x, e.y, 8);
        popText(w, this.texts, "MOAT!", e.x, e.y - 22, C.lightBlue, 1.6);
        this.sfx("splash", 0.8, 0, e.x);
        this.sfx("crunch", 0.6, 3, e.x);
        break;
      case BX_REBUILD:
        tick(this.rings, e.x, e.y - 8, 0, 0, 26, C.gold, 0.45);
        ps.emit(sand, e.x, e.y - 10, 10, -PI / 2);
        this.sfx("crunch", 0.5, 6, e.x);
        break;
      case BX_SURFACE:
        ps.emit(sand, e.x, e.y, e.power > 1 ? 14 : 7);
        this.sfx("splash", 0.35, 6, e.x);
        break;
      case BX_SUBMERGE:
        ps.emit(sand, e.x, e.y, 4, -PI / 2, -1, 0.7);
        break;
      case BX_TENTACLE:
        ps.emit(sand, e.x, e.y, 14);
        ps.emit(splashDrop, e.x, e.y - 4, 8);
        tick(this.rings, e.x, e.y, 0, 0, e.power + 8, C.pinkLight, 0.4);
        if (!calm) fx.juice.shake(0.25);
        this.sfx("explosion", 0.55, 4, e.x);
        o?.haptic(20);
        break;
      case BX_HUG:
        if (this.now - this.hugAt > 1) {
          this.hugAt = this.now;
          popText(w, this.texts, "HUG!", e.x, e.y - 8, C.hotPink, 2);
        }
        ps.emit(heart, e.x, e.y, 6);
        this.sfx("fanSmack", 0.7, -3, e.x);
        break;
      case BX_INK:
        ps.emit(ink, e.x, e.y, 10);
        this.sfx("splash", 0.4, -4, e.x);
        break;
      case BX_INK_CANNON:
        ps.emit(ink, e.x, e.y, e.power > 1 ? 10 : 6);
        this.sfx("bubblePop", 0.6, -6, e.x);
        break;
      case BX_TIDE: {
        const v = this.r.camera.view;
        for (let i = 0; i < 18; i++) ps.emit(splashDrop, v.x + Math.random() * v.w, Math.random() < 0.5 ? v.y + 6 : v.y + v.h - 6, 2);
        this.sfx("splash", 1, -6);
        if (!calm) fx.juice.shake(0.35);
        break;
      }
      case BX_ROCKET:
        tick(this.rockets, e.x, e.y, e.dx, e.dy, 0, (Math.random() * 6) | 0, Math.max(0.3, e.power - 0.05));
        ps.emit(ember, e.x, e.y, 4);
        this.sfx("telegraph", 0.25, 9, e.x);
        break;
      case BX_BURST: {
        const col = BURST_COLORS[e.dx | 0] ?? C.yellow;
        fxFirework(fx, e.x, e.y - 20, [col, C.white, rainbow(this.now, 0.6)]);
        if (!calm) fx.juice.flash(col, 0.12, 0.15);
        if (this.now - this.tamayaAt > 2.2) {
          this.tamayaAt = this.now;
          popText(w, this.texts, "TAMAYA!", e.x, e.y - 34, C.yellow, 1.8);
        }
        this.sfx("explosion", 0.5, 7, e.x);
        break;
      }
      case BX_BREATH:
        ps.emit(ember, e.x, e.y, 10);
        this.sfx("beam", 0.45, 4, e.x);
        break;
      case BX_DANCE:
        this.sfx("bossRoar", 0.4, 6, e.x);
        break;
    }
  }
}
