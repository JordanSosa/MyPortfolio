/**
 * Candy Kingdom visuals (stage 2): everything about the candy roster, the
 * Gingerbread Golem and the Sugar Plum Tyrant that the generic drawer can't
 * express. Wired like the other content views (WorldView constructs it,
 * Feedback.bind subscribes it):
 *
 *   decorate  per enemy (WorldView.drawEnemies): gummy flavour tints (translucent
 *             jelly), the Candy Corn wrapper-shield glint + Corn-mander flag, donut
 *             spin / roll rotation + afterimages, Toasty marshmallows and S'more
 *             biscuits, the Lollipop Mage's staff glow (pink attack / mint heal),
 *             the golem's glowing coat buttons and crumbling leg, the Tyrant's
 *             halo, sugar-rush aura, jete afterimages and crash Zzz
 *   draw      chocolate puddles, the dashed Cookie Cutter outline, the SUGAR RUSH
 *             grade (hotter, +0.15 saturation) on top of the stage grade
 *   bind      `stageCue` candy_* kinds, deaths (jelly bursts, cookie crumbs, boss
 *             death lines), prop breaks (candy confetti), lane / rain stingers
 *
 * Reads the world, never mutates it. No per-frame allocation (module-scope
 * emitters, fixed pools, event-time closures only).
 */
import { C } from "../art/palette";
import { TAU, clamp } from "../core/math";
import { P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { SfxId } from "../audio";
import type { StageCueEvent } from "../game/events";
import { MODE_STRAIGHT, type Enemy } from "../game/types";
import type { World } from "../game/world";
import {
  candyState,
  CK_BLOCK,
  CK_BOING,
  CK_BOUNCE,
  CK_CAST,
  CK_HEAL,
  CK_HEALED,
  CK_PUDDLE,
  CK_SPIN,
  CK_SPLIT,
  CK_TOAST,
  MAX_PUDDLES,
  PUDDLE_LIFE,
  PUDDLE_R,
} from "../game/enemies/_candy";
import { GUMMY_ST_BOING, GUMMY_TINTS } from "../game/enemies/gummy-bear";
import { DONUT_ROLLING, DONUT_ROLLING2, DONUT_SPINNING, DONUT_SPINNING2 } from "../game/enemies/donut-roller";
import { MAGE_CHARGE, mageHealing } from "../game/enemies/lollipop-mage";
import { BTN_OY, CK_BUTTONS, CK_CRUMBLE, CK_CUT, CUT_R, CUT_X, CUT_Y, GG_BUTTONS, GG_CUTTER, golemState } from "../game/bosses/gingerbread-golem";
import { CK_CRASH, CK_DECREE, CK_HIGH, CK_JETE, CK_PIROUETTE, SP_CRASH, SP_HIGH, SP_JETE, SP_SPIRAL, SP_TELE, tyrantBodyY, tyrantState } from "../game/bosses/sugar-plum-tyrant";
import { bulletLook } from "./bullet-looks";
import type { Anims } from "./anims";
import type { WorldTexts } from "./texts";
import type { Speech } from "./speech";

// ---------------------------------------------------------------- bullets
bulletLook("eb_candy", { glow: C.pink, glowR: 8, spin: 5 });
bulletLook("eb_gumdrop", { glow: C.hotPink, glowR: 9.5, baseR: 2.5 });
bulletLook("eb_plum", { glow: C.violet, glowR: 9.5 });

// ---------------------------------------------------------------- emitters
/** Rainbow sprinkles flung off a spinning donut / a broken jar. */
const sprinkles: EmitterDef = {
  sprite: "fx_sprinkle",
  frames: "random",
  speed: [30, 80],
  life: [0.35, 0.6],
  size: [1, 0.8],
  colors: [C.pink, C.yellow, C.cyan, C.lime, C.white],
  rot: "random",
  spin: [6, 14],
  drag: 2,
  gravity: 90,
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Cookie crumbs (golem steps, the half-baked leg, its death). */
const crumbs: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [30, 95],
  life: [0.6, 1.1],
  size: [1.1, 0.8],
  sizeJitter: 0.45,
  colors: [0xa6683f, 0xdda574, 0x6b3d2c, 0xffffff],
  rot: "random",
  spin: [4, 12],
  bounce: { vz: [60, 170], gravity: 460, restitution: 0.3, friction: 7 },
  alphaCurve: "late",
  layer: Layer.Fx,
};
/** Jelly drops (gummy deaths, tinted per flavour). */
const jelly: EmitterDef = {
  sprite: "fx_glow_s",
  frames: "fixed",
  speed: [30, 80],
  life: [0.35, 0.6],
  size: [0.32, 0.12],
  sizeJitter: 0.3,
  rot: "random",
  bounce: { vz: [60, 140], gravity: 420, restitution: 0.45, friction: 6 },
  alphaCurve: "late",
  additive: true,
  layer: Layer.FxAdd,
};
/** Green "+" heal sparkles rising off a healed candy. */
const healUp: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  speed: [12, 26],
  angle: -Math.PI / 2,
  spread: 1.1,
  life: [0.45, 0.7],
  size: [0.9, 0.5],
  colors: [C.lime, C.mint, C.white],
  gravity: -20,
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};
/** Sugar sparkle (the Tyrant: pirouettes, teleports, the rush aura). */
const sugar: EmitterDef = {
  sprite: "fx_spark",
  frames: "life",
  speed: [16, 60],
  life: [0.3, 0.6],
  size: [1, 0.5],
  colors: [C.pinkLight, C.white, C.violet, C.paleYellow],
  drag: 2.5,
  additive: true,
  glow: true,
  alphaCurve: "none",
  layer: Layer.FxAdd,
};
/** Soft brown smoke over a toasted marshmallow. */
const toastSmoke: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  speed: [6, 16],
  angle: -Math.PI / 2,
  spread: 0.8,
  life: [0.5, 0.8],
  size: [0.35, 0.7],
  colors: [0xdda574, 0xc9b8a8],
  alpha: 0.5,
  gravity: -14,
  alphaCurve: "late",
  layer: Layer.Fx,
};

const PUDDLE_DARK = 0x6b3d2c;
const PUDDLE_GLOSS = 0xa6683f;
const TOAST = 0xdda574;
/** Golem coat buttons (pink, lime, lemon gumdrops). */
const BTN_COLORS = [C.pink, C.lime, C.yellow];

export interface StageFxOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  sound: boolean;
  calm: boolean;
}

export class CandyFx {
  private w: World | null = null;
  private o: StageFxOpts | null = null;
  private frameN = 0;
  private live = true;
  private readonly hSpark: number;
  private readonly hGlow: number;
  private readonly hZzz: number;
  private readonly nZzz: number;
  /** SUGAR RUSH grade blend. */
  private rushK = 0;
  /** Seconds left of the CUT! flash and where. */
  private cutT = 0;
  private cutX = 0;
  private cutY = 0;
  /** Per-frame particle budget. */
  private budget = 0;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    anims: Anims,
    private readonly texts: WorldTexts,
    private readonly speech: Speech,
  ) {
    this.hSpark = r.atlas.handle("fx_spark");
    this.hGlow = r.atlas.handle("fx_glow");
    const z = anims.get("fx_zzz");
    this.hZzz = z.first;
    this.nZzz = z.count;
  }

  setWorld(w: World): void {
    this.w = w;
    this.rushK = 0;
    this.cutT = 0;
  }

  private sfx(id: SfxId, vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  // ================================================================ per enemy
  decorate(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number): boolean {
    const id = e.def.id;
    const r = this.r;
    const frozen = tint !== 0xffffff;
    const live = this.live && !frozen;
    switch (id) {
      case "gummy_bear": {
        if (frozen) return false;
        // translucent jelly in its flavour + a little boing ring
        const c = GUMMY_TINTS[(e.b | 0) & 3];
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, c, e.alpha * 0.92, flash, 0);
        if (e.elite) r.glow(e.x, y - 7 * e.scale, 9 * e.scale, c, 0.2);
        if (e.state === GUMMY_ST_BOING && e.timer < 0.12) r.ring(Layer.FxAdd, e.x, e.y - 2, 6 + e.timer * 70, c, 0.5 - e.timer * 3, Flag.Add);
        return true;
      }
      case "candy_corn": {
        const w = this.w;
        if (w && w.t - e.b < 0.16) {
          // the wrapper shield flashes on a blocked hit (front side)
          const k = 1 - (w.t - e.b) / 0.16;
          const fx0 = e.x + e.face * 6 * e.scale;
          r.spr(Layer.FxAdd, this.hSpark, fx0, y - 7 * e.scale, 1.2 * k + 0.4, 1.2 * k + 0.4, 0, C.paleYellow, 0.9 * k, 0, Flag.Add | Flag.Glow);
          r.line(Layer.FxAdd, fx0, y - 12 * e.scale, fx0, y - 2, 1.5, C.white, 0.7 * k, Flag.Add);
        }
        if (e.elite) this.flag(e, y, time);
        return false;
      }
      case "donut_roller": {
        const rolling = e.mode === MODE_STRAIGHT || e.state === DONUT_ROLLING || e.state === DONUT_ROLLING2;
        const spinning = e.state === DONUT_SPINNING || e.state === DONUT_SPINNING2;
        if (!rolling && !spinning) return false;
        const dir = e.mode === MODE_STRAIGHT ? (e.vx >= 0 ? 1 : -1) : e.face;
        const rot = frozen ? 0 : rolling ? e.t * 15 * dir : Math.sin(e.t * 40) * 0.25;
        const jit = spinning && !frozen ? ((((time * 50) | 0) & 1) * 2 - 1) * 0.6 : 0;
        // rotate around the body centre (the sprite pivot is the feet: move the pivot around the centre)
        const half = 8 * e.scale;
        const px = e.x - Math.sin(rot) * half + jit;
        const py = y - half + Math.cos(rot) * half;
        if (live && rolling && (this.frameN + e.uid) % 3 === 0) this.fx.ghosts.spawn(h, px, py, sx, sy, rot, C.pinkLight, 0.16, 0.35, Layer.FxBelow);
        if (live && spinning && (this.frameN + e.uid) % 2 === 0 && this.budget-- > 0) this.fx.ps.emit(sprinkles, e.x, y - half, 1, NaN, -1, 1);
        if (spinning) r.glow(e.x, y - half, 9 * e.scale, C.pink, 0.2 + 0.15 * Math.sin(time * 30));
        r.spr(Layer.Entity, h, px, py, sx, sy, rot, tint, e.alpha, flash, Flag.NoSnap);
        return true;
      }
      case "marshmallow_brute": {
        const toast = e.c === 1;
        if (!toast && !e.elite) return false;
        const col = frozen ? tint : toast ? TOAST : 0xffffff;
        r.spr(Layer.Entity, h, e.x, y, sx, sy, 0, col, e.alpha, flash, 0);
        if (toast && live && (this.frameN + e.uid) % 9 === 0 && this.budget-- > 0) this.fx.ps.emit(toastSmoke, e.x + (Math.random() - 0.5) * 12, y - 18 * e.scale, 1);
        if (e.elite) this.smore(e, y, sy);
        return true;
      }
      case "lollipop_mage": {
        if (e.state !== MAGE_CHARGE) return false;
        const heal = mageHealing(e);
        const k = clamp(e.timer / 0.4, 0, 1);
        const gx = e.x + e.face * 3 * e.scale;
        const gy = y - 16 * e.scale;
        const c = heal ? C.lime : C.hotPink;
        r.glow(gx, gy, (4 + 8 * k) * e.scale, c, 0.3 + 0.45 * k);
        r.glow(gx, gy, (2 + 2 * k) * e.scale, C.white, 0.4 + 0.4 * k);
        if (heal) r.ring(Layer.Decal, e.x, e.y, 60 * (0.3 + 0.7 * k), C.lime, 0.25 * k + 0.1, 0, true);
        return false;
      }
      case "gingerbread_golem":
        this.decorateGolem(e, y, time, live);
        return false;
      case "sugar_plum_tyrant":
        return this.decorateTyrant(e, h, sx, sy, y, time, tint, flash, live);
    }
    return false;
  }

  /** Corn-mander's little flag on a toothpick. */
  private flag(e: Enemy, y: number, time: number): void {
    const r = this.r;
    const bx = e.x - e.face * 5 * e.scale;
    const top = y - 26 * e.scale;
    r.line(Layer.Fx, bx, y - 10 * e.scale, bx, top, 1, 0xdda574, 1);
    const wave = Math.sin(time * 9 + e.uid) * 1.5;
    const d = -e.face;
    for (let i = 0; i < 4; i++) {
      const w = 7 - i * 1.6;
      r.line(Layer.Fx, bx, top + i, bx + d * w, top + i + wave * (i / 4), 1, i < 2 ? C.red : C.yellow, 1);
    }
  }

  /** S'more Supreme: graham biscuits above and below + a chocolate layer. */
  private smore(e: Enemy, y: number, sy: number): void {
    const r = this.r;
    const s = e.scale;
    const w = 22 * s;
    const top = y - 20 * s * Math.abs(sy) / s;
    r.batch.sortKey = e.y + 0.02;
    r.rect(Layer.Entity, e.x - w / 2, top - 3 * s, w, 4 * s, 0xdda574, 1);
    r.rect(Layer.Entity, e.x - w / 2, top - 3 * s, w, 1, 0xfff0c9, 0.9);
    r.rect(Layer.Entity, e.x - w / 2 + 1, top + s, w - 2, 2 * s, PUDDLE_DARK, 1);
    r.rect(Layer.Entity, e.x - w / 2, y - 3 * s, w, 3 * s, 0xa6683f, 1);
    r.batch.sortKey = NaN;
  }

  private decorateGolem(e: Enemy, y: number, time: number, live: boolean): void {
    const r = this.r;
    const s = golemState(e);
    if (!s) return;
    if (e.state === GG_BUTTONS && s.n === 0) {
      // the three coat buttons glow, faster as they are about to fly
      const k = clamp(e.timer / 0.5, 0, 1);
      const pulse = 0.6 + 0.4 * Math.sin(time * (14 + 20 * k));
      for (let i = 0; i < 3; i++) {
        const bx = e.x + e.face * 2;
        const by = y + BTN_OY[i] + e.z;
        r.glow(bx, by - e.z, (4 + 6 * k) * pulse, BTN_COLORS[i], 0.5 + 0.4 * k);
        r.glow(bx, by - e.z, 2 + 2 * k, C.white, 0.5 * pulse);
      }
    }
    if (s.phase >= 2 && live && (this.frameN + e.uid) % 14 === 0 && this.budget-- > 0) {
      // still gooey: crumbs keep dropping off the missing leg
      this.fx.ps.emit(crumbs, e.x - e.face * 8, y - 8, 1, Math.PI / 2, -1, 1, 0.4);
    }
  }

  private decorateTyrant(e: Enemy, h: number, sx: number, sy: number, y: number, time: number, tint: number, flash: number, live: boolean): boolean {
    const r = this.r;
    const fx = this.fx;
    const s = tyrantState(e);
    const by = y - 30;
    const enr = !!this.w?.director.enraged;
    const rush = (s?.phase ?? 1) >= 2;
    // soft plum halo BEHIND her
    r.batch.sortKey = e.y - 0.02;
    r.spr(Layer.Entity, this.hGlow, e.x, by, 2.3, 2.7, 0, enr ? C.red : rush ? C.hotPink : C.violet, (0.26 + 0.06 * Math.sin(time * 3)) * e.alpha, 0, Flag.Add);
    r.batch.sortKey = NaN;
    // the cupcake crown twinkles
    if (live && (this.frameN & 7) === 0) fx.ps.emit(P.sparkle, e.x + (Math.random() - 0.5) * 10, y - 58, 1, NaN, C.paleYellow, 0.7);
    if (rush && live && (this.frameN & 3) === 0 && this.budget-- > 0) fx.ps.emit(sugar, e.x + (Math.random() - 0.5) * 30, by + (Math.random() - 0.5) * 30, 1);
    switch (e.state) {
      case SP_SPIRAL:
      case SP_TELE:
        if (live && (this.frameN & 1) === 0) {
          const a = time * 9;
          fx.ps.emit(sugar, e.x + Math.cos(a) * 16, by + Math.sin(a) * 8 + 10, 1, a + Math.PI / 2, -1, 0.9, 0.6);
        }
        break;
      case SP_JETE:
        if (live && (this.frameN & 1) === 0) fx.ghosts.spawn(h, e.x, y, sx, sy, 0, C.pink, 0.22, 0.5, Layer.FxBelow);
        break;
      case SP_HIGH: {
        // vibrating with sugar
        const jx = ((((time * 40) | 0) & 1) * 2 - 1) * 1;
        r.spr(Layer.Entity, h, e.x + jx, y, sx, sy, 0, tint, e.alpha, Math.max(flash, 0.15 + 0.1 * Math.sin(time * 25)), 0);
        return true;
      }
      case SP_CRASH: {
        // slumped: Zzz bubbles rise
        for (let i = 0; i < 3; i++) {
          const k = (time * 0.7 + i / 3) % 1;
          const zh = this.hZzz + Math.min(this.nZzz - 1, i);
          r.spr(Layer.Text, zh, e.x + 10 + k * 10 + Math.sin(k * 6 + i) * 3, y - 34 - k * 26, 1, 1, 0, 0xddc6ff, 1 - k, 0, 0);
        }
        break;
      }
    }
    return false;
  }

  // ================================================================ per frame
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.frameN++;
    this.live = dt > 0;
    this.budget = 10;
    this.drawPuddles(w, time);
    this.drawCutter(w, time);
    if (this.cutT > 0) {
      this.cutT = Math.max(0, this.cutT - realDt);
      const k = this.cutT / 0.5;
      for (let i = 0; i < CUT_X.length; i++) this.r.circle(Layer.Decal, this.cutX + CUT_X[i], this.cutY + CUT_Y[i], CUT_R[i], C.orange, 0.45 * k);
    }
    this.applyGrade(w, realDt);
  }

  private drawPuddles(w: World, time: number): void {
    const s = candyState(w);
    if (!s) return;
    const r = this.r;
    for (let i = 0; i < MAX_PUDDLES; i++) {
      const t = s.pt[i];
      if (t <= 0) continue;
      const age = PUDDLE_LIFE - t;
      const grow = Math.min(1, age / 0.25);
      const fade = Math.min(1, t / 0.6);
      const R = PUDDLE_R * (0.6 + 0.4 * grow);
      const x = s.px[i];
      const y = s.py[i];
      r.circle(Layer.Decal, x, y, R, PUDDLE_DARK, 0.62 * fade);
      r.circle(Layer.Decal, x + 2, y + 1, R * 0.7, PUDDLE_GLOSS, 0.35 * fade);
      r.circle(Layer.Decal, x - R * 0.35, y - R * 0.25, R * 0.18, 0xfff0c9, (0.25 + 0.08 * Math.sin(time * 3 + i)) * fade);
      r.ring(Layer.Decal, x, y, R, 0x3d2218, 0.5 * fade, 0, true);
    }
  }

  /** The dashed gingerbread-man outline (on top of the six generic telegraph circles). */
  private drawCutter(w: World, time: number): void {
    const b = w.boss;
    if (!b || b.dead || b.def.id !== "gingerbread_golem" || b.state !== GG_CUTTER) return;
    const s = golemState(b);
    if (!s) return;
    const r = this.r;
    const k = clamp(b.timer / s.cutDur, 0, 1);
    const spin = time * 1.5;
    for (let i = 0; i < CUT_X.length; i++) {
      const cx = s.cutX + CUT_X[i];
      const cy = s.cutY + CUT_Y[i];
      const R = CUT_R[i] + 1;
      const n = Math.max(8, Math.round(R * 0.9));
      for (let j = 0; j < n; j += 2) {
        const a0 = spin + (j / n) * TAU;
        const a1 = spin + ((j + 1) / n) * TAU;
        r.line(Layer.Decal, cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, 1.5, C.white, 0.75 + 0.25 * k);
      }
      // icing fills in as the stamp comes down
      r.circle(Layer.Decal, cx, cy, R * k, C.orange, 0.18 + 0.14 * k);
    }
  }

  private applyGrade(w: World, realDt: number): void {
    const b = w.boss;
    const s = b && !b.dead && b.def.id === "sugar_plum_tyrant" ? tyrantState(b) : undefined;
    const want = s && s.phase >= 2 ? (b!.state === SP_CRASH ? 0.35 : 1) : 0;
    this.rushK += clamp(want - this.rushK, -realDt * 0.8, realDt * 0.8);
    if (this.rushK <= 0.001) return;
    const g = this.r.post.grade;
    const k = this.rushK;
    // hotter, not brighter: more saturation and contrast, a warm push, no lift (the stage is pink already)
    g.saturation += 0.15 * k;
    g.contrast += 0.06 * k;
    g.tint[0] *= 1 + 0.05 * k;
    g.tint[1] *= 1 - 0.04 * k;
    g.tint[2] *= 1 - 0.06 * k;
    g.brightness *= 1 - 0.03 * k;
  }

  // ================================================================ events
  bind(w: World, o: StageFxOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    const bus = w.bus;
    return [
      bus.on("stageCue", (e) => this.onCue(e)),
      bus.on("enemyKilled", (e) => this.onKilled(e.enemy, e.x, e.y)),
      bus.on("propBroken", (e) => {
        if (e.sprite === "prop_candy_jar") {
          this.fx.ps.emit(sprinkles, e.x, e.y - 8, 14, NaN, -1, 1.1, 1.3);
          this.fx.ps.emit(P.confetti, e.x, e.y - 8, 10, NaN, -1, 1);
          this.fx.ps.emit(P.sparkle, e.x, e.y - 10, 5, NaN, C.lightBlue);
        } else if (e.sprite === "prop_pinata") {
          this.fx.ps.emit(P.confetti, e.x, e.y - 12, 22, NaN, -1, 1.2, 1.4);
          this.fx.ps.emit(sprinkles, e.x, e.y - 12, 10, NaN, -1, 1, 1.2);
          this.fx.ps.emit(P.rays, e.x, e.y - 12, 10, NaN, C.yellow, 0.9);
          this.texts.add("OLE!", e.x, e.y - 26, { color: C.yellow, scale: 2, life: 0.8, rise: 12, wobble: 2 });
          this.sfx("chestJackpot", 0.4, 6, e.x);
        }
      }),
      bus.on("waveIncoming", (e) => {
        if (w.stage.id !== "candy_kingdom") return;
        if (e.kind === "lanes") this.sfx("telegraph", 0.6, -2);
        else if (e.kind === "rain") this.sfx("magnet", 0.35, 6);
      }),
    ];
  }

  private onCue(e: StageCueEvent): void {
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!this.o?.calm;
    switch (e.kind) {
      case CK_BOING:
        fx.ps.emit(P.ringThin, e.x, e.y - 4, 1, NaN, GUMMY_TINTS[e.n & 3], 0.5);
        this.sfx("bubblePop", 0.25, 5 + ((Math.random() * 3) | 0), e.x);
        break;
      case CK_BLOCK:
        fx.ps.emit(P.sparkle, e.x, e.y, 2, Math.atan2(e.y2 - e.y, e.x2 - e.x), C.paleYellow, 0.8);
        this.sfx("orbitHit", 0.18, 7, e.x);
        break;
      case CK_TOAST:
        fx.ps.emit(P.ember, e.x, e.y, 8, NaN, C.orange, 0.9);
        fx.ps.emit(toastSmoke, e.x, e.y - 6, 3, NaN, -1, 1.2);
        this.sfx("fireball", 0.35, 4, e.x);
        break;
      case CK_HEAL:
        fx.ps.emit(P.ring, e.x, e.y, 1, NaN, C.lime, e.r / 16);
        fx.ps.emit(healUp, e.x, e.y, 5);
        this.sfx("heal", 0.3, 5, e.x);
        break;
      case CK_HEALED:
        fx.ps.emit(healUp, e.x, e.y, 2, NaN, -1, e.r);
        break;
      case CK_SPIN:
        this.sfx("telegraph", 0.25, 4, e.x);
        break;
      case CK_BOUNCE:
        fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.pinkLight, 0.7);
        fx.ps.emit(sprinkles, e.x, e.y, 5, NaN, -1, 1);
        this.sfx("boomerang", 0.3, 4, e.x);
        break;
      case CK_SPLIT:
        fx.ps.emit(jelly, e.x, e.y, 12, NaN, GUMMY_TINTS[e.n & 3], 1.4);
        this.sfx("bubblePop", 0.5, -3, e.x);
        break;
      case CK_PUDDLE:
        fx.ps.emit(jelly, e.x, e.y - 4, 10, NaN, PUDDLE_GLOSS, 1.2);
        this.sfx("splash", 0.45, -2, e.x);
        break;
      case CK_CAST:
        if (e.r > 0) this.sfx("sparkleCharm", 0.2, -2, e.x);
        break;
      case CK_BUTTONS:
        this.sfx("telegraph", 0.6, 0, e.x);
        break;
      case CK_CUT:
        this.cutT = 0.5;
        this.cutX = e.x;
        this.cutY = e.y;
        this.texts.add("CUT!", e.x, e.y - 30, { color: C.orange, scale: 3, life: 0.9, rise: 14, wobble: 2 });
        fx.ps.emit(crumbs, e.x, e.y - 6, 18, NaN, -1, 1, 1.2);
        if (!calm && juice) {
          juice.shake(0.35);
          juice.flash(C.paleYellow, 0.12, 0.12);
        }
        this.sfx("slash", 0.9, -4, e.x);
        this.sfx("crunch", 0.6, 0, e.x);
        break;
      case CK_CRUMBLE:
        fx.ps.emit(crumbs, e.x, e.y, e.n ? 30 : 18, NaN, -1, 1.2, 1.3);
        fx.ps.emit(P.smoke, e.x, e.y - 4, 3, NaN, 0xdda574, 1.2);
        this.sfx("crunch", 0.9, e.n ? -4 : 0, e.x);
        break;
      case CK_PIROUETTE:
        fx.ps.emit(sugar, e.x, e.y, 14, NaN, -1, 1.1, 1.3);
        this.sfx("sparkleCharm", 0.45, 2, e.x);
        break;
      case CK_DECREE:
        fx.ps.emit(P.rays, e.x, e.y, 12, NaN, C.paleYellow, 1.1);
        fx.ps.emit(sugar, e.x, e.y, 10, NaN, -1, 1.2, 1.4);
        this.sfx("comboUp", 0.6, -5, e.x);
        break;
      case CK_JETE:
        fx.ps.emit(sugar, e.x, e.y - 10, 10, NaN, -1, 1.1);
        this.sfx("dash", 0.6, -2, e.x);
        break;
      case CK_HIGH:
        fx.ps.emit(P.rays, e.x, e.y, 14, NaN, C.hotPink, 1.1);
        if (!calm && juice) juice.flash(C.pink, 0.1, 0.18);
        this.sfx("powerup", 0.5, 4, e.x);
        break;
      case CK_CRASH:
        this.texts.add("Zzz...", e.x + 16, e.y - 30, { color: C.lavender, scale: 2, life: 1.4, rise: 16, wobble: 1 });
        this.sfx("snore", 0.8, 0, e.x);
        break;
    }
  }

  private onKilled(e: Enemy, x: number, y: number): void {
    const fx = this.fx;
    switch (e.def.id) {
      case "gummy_bear":
        fx.ps.emit(jelly, x, y - 5, 5, NaN, GUMMY_TINTS[(e.b | 0) & 3], 1);
        break;
      case "marshmallow_brute":
        fx.ps.emit(P.smoke, x, y - 10, 2, NaN, e.c === 1 ? TOAST : C.white, 1.3);
        break;
      case "gingerbread_golem":
        fx.ps.emit(crumbs, x, y - 20, 40, NaN, -1, 1.4, 1.5);
        this.speech.sayAt(x, y - 64, "...I was supposed to be... a house...", 2.8);
        this.sfx("crunch", 1, -6, x);
        break;
      case "sugar_plum_tyrant":
        fx.ps.emit(sugar, x, tyrantBodyY(e), 30, NaN, -1, 1.4, 1.8);
        this.speech.sayAt(x, y - 72, "My kingdom... for a glass of water...", 3);
        break;
    }
  }
}
