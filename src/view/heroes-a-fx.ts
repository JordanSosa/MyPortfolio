/**
 * Season 2 heroes, group A - Kuro, Pudding, Aoi, Akane - visuals the generic
 * projectile drawer can't express (docs/content/heroes.md §2.4-2.7,
 * weapons.md §2.1-2.4). Reads the world, never mutates it.
 *
 *   per frame (`draw`, from WorldView.draw after the bestiary's grade):
 *     Kuro     breath flame streams (orange w/ violet outline, or actually-black), flames on burning heads,
 *              the Abyssal Gaze eye, Crimson Eye Beam / ABYSSAL LORD'S JUDGEMENT beams, the ult's
 *              colossal shadow sweep + dim grade + vignette, the flashlight / stadium-floodlight reveal
 *     Pudding  teacups (tipping; hidden while broken by the Orbital Guard, popping back in), tea puddles
 *              (splash / rest / dry + steam), Warm Tea (an amber ring at her feet whose 8 dots count the
 *              seconds left, steam off her shoulders, a blink as it cools), the tea moat, the flying
 *              teapot pouring, the omurice (plop, ketchup heart)
 *     Aoi      tangled 1-px spaghetti trails (white -> blue; the evolution's 2-px noodles on fire), sauce
 *              decals, Jet Dash flames, the C6 drone, the falling fists' speed lines, the ROCKET PUNCH
 *     Akane    drill spins, the "...h-hmph." portrait slide
 *     pops     BAKA! / "...baka♡" sprites and text pops (MOE, KYUN♡, FULL BURST!...) under the satire
 *              pop rules (2.2 -> 1 bounce + 8° wobble, 0.8 s, max 3 on screen, never on the hero)
 *   events (`bind`, from Feedback.bind): `heroFx` cues -> particles, shakes, flashes, sfx
 *   `killFx` (from Feedback's enemyKilled): kills during ETERNAL ABYSS burst into black feathers
 *
 * No per-frame allocations: fixed pools, typed arrays, module-scope emitter defs.
 */
import { C } from "../art/palette";
import type { SfxId } from "../audio";
import { lerpColor } from "../core/color";
import { TAU, clamp, ease } from "../core/math";
import { P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import { lerpGrade, type Grade } from "../render/post";
import type { Renderer } from "../render/renderer";
import type { HeroFxEvent, KillEvent } from "../game/events";
import { PK_FALL, PK_FREE, PK_MANAGED, type Projectile } from "../game/types";
import {
  HERO_TEXTS,
  HFX_AKANE_BAKA,
  HFX_AKANE_BARRAGE,
  HFX_AKANE_BONK,
  HFX_AKANE_HEART,
  HFX_AKANE_HMPH,
  HFX_AKANE_RING,
  HFX_AKANE_SMACK,
  HFX_AOI_FIST,
  HFX_AOI_IMPACT,
  HFX_AOI_JET,
  HFX_AOI_ROCKET,
  HFX_AOI_SALVO,
  HFX_KURO_BURST,
  HFX_KURO_EYE_BEAM,
  HFX_KURO_JET,
  HFX_KURO_MARK,
  HFX_KURO_REVEAL,
  HFX_KURO_SHADOW,
  HFX_PUD_KETCHUP,
  HFX_PUD_OMURICE,
  HFX_PUD_PULSE,
  HFX_PUD_SHATTER,
  HFX_PUD_SIP,
  HFX_PUD_SPILL,
  HFX_PUD_WARM,
  HFX_TEXT,
  heroesAIf,
} from "../game/weapons/_heroes-a";
import { BEAM_EYE, BEAM_JET } from "../game/weapons/dark-flame-dragon";
import { SAUCE } from "../game/weapons/micro-missile-swarm";
import type { World } from "../game/world";
import type { Anims } from "./anims";
import { TRAILS, type TrailDef } from "./trails";

const PI = Math.PI;
const DFD = "dark_flame_dragon";
const ABYSS = "unsealed_abyss_dragon";
/** ETERNAL ABYSS dim: violet and moody but still clearly readable (see applyDim). */
const ABYSS_GRADE: Grade = { tint: [0.82, 0.76, 0.94], lift: [0.03, 0.0, 0.08], saturation: 0.86, contrast: 1.05, brightness: 0.9, hue: 0 };
const TEA = "teapot_tempest";
const PARTY = "eternal_tea_party";
const ALDENTE = "al_dente_armageddon";
const ROBOT = "get_in_the_robot";
/** Vignette the stage normally runs with (bestiary-fx BASE_VIGNETTE). */
const BASE_VIG = 0.32;

// ---------------------------------------------------------------- emitters
const flameOrange: EmitterDef = {
  sprite: "w_dragon_fire",
  frames: "life",
  speed: [110, 170],
  spread: 0.8,
  life: [0.3, 0.38],
  size: [0.75, 1.4],
  sizeJitter: 0.2,
  colors: 0xffffff,
  drag: 1.6,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const flameBlack: EmitterDef = { ...flameOrange, sprite: "w_abyss_fire", size: [1, 1.9] };
const darkSparkle: EmitterDef = { ...P.sparkle, speed: [6, 26], life: [0.4, 0.8], colors: [C.darkViolet, C.violet, C.deep], additive: false, glow: false, layer: Layer.Fx };
const feather: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [18, 55],
  spread: TAU,
  life: [0.8, 1.3],
  size: [1.5, 0.9],
  aspect: 2.4,
  colors: [C.deep, C.outline, 0x3a2266],
  gravity: 24,
  drag: 2.4,
  sway: 16,
  rot: "random",
  spin: [2, 6],
  alphaCurve: "late",
  layer: Layer.Fx,
};
const steam: EmitterDef = {
  sprite: "fx_puff",
  frames: "life",
  speed: [4, 10],
  angle: -PI / 2,
  spread: 0.5,
  life: [0.7, 1.1],
  size: [0.35, 0.8],
  colors: C.white,
  alpha: 0.4,
  gravity: -12,
  drag: 1,
  sway: 6,
  alphaCurve: "inout",
  layer: Layer.Fx,
};
const teaDrop: EmitterDef = {
  sprite: "fx_px",
  frames: "fixed",
  speed: [30, 70],
  angle: -PI / 2,
  spread: 2.2,
  life: [0.3, 0.55],
  size: [1, 0.6],
  colors: [0xc77a2e, 0xe6a04a, 0xffd27a],
  bounce: { vz: [30, 70], gravity: 380, restitution: 0.2, friction: 6 },
  alphaCurve: "late",
  layer: Layer.Fx,
};
const pourDrop: EmitterDef = { ...teaDrop, speed: [2, 8], angle: PI / 2, spread: 0.3, gravity: 260, life: [0.18, 0.26], bounce: undefined };
/** Warm Tea: amber steam curling off her shoulders while it lasts. */
const warmSteam: EmitterDef = { ...steam, colors: [0xffe2a8, C.white], alpha: 0.5, speed: [6, 14], life: [0.6, 0.9] };
/** Warm Tea dots around her feet (seconds left) and its ring. */
const WARM_DOTS = 8;
/** Warm Tea aura around her body (centre 9 px above her feet: the feet are under her sprite and HP bar). */
const WARM_RX = 13;
const WARM_RY = 14;
const WARM_CY = 9;
const shard: EmitterDef = { ...P.debris, colors: [C.white, 0xf3e6ff, C.pinkLight] };
const heartOut: EmitterDef = {
  sprite: "fx_heart",
  frames: "fixed",
  speed: [80, 140],
  spread: TAU,
  life: [0.5, 0.85],
  size: [1.4, 0.6],
  sizeJitter: 0.3,
  colors: [C.pink, C.hotPink, C.pinkLight, C.white],
  drag: 2.2,
  alphaCurve: "late",
  layer: Layer.Fx,
};
const ketchup: EmitterDef = { ...P.sparkle, speed: [20, 70], colors: [C.red, C.pink, C.white, C.pinkLight] };
const smoke: EmitterDef = { ...P.dust, colors: [0xdcd6e8, 0xb8b0c8], size: [0.5, 1.1], speed: [8, 24], layer: Layer.Fx };
const ember: EmitterDef = { ...P.ember };
const spark: EmitterDef = { ...P.sparkle, speed: [20, 60], life: [0.2, 0.35] };
const bonkStar: EmitterDef = { ...P.sparkle, speed: [30, 80], life: [0.2, 0.32], colors: [C.yellow, C.white, C.orange] };
const pinkRing: EmitterDef = { ...P.ring, life: [0.38, 0.38] };
const exhaust: EmitterDef = {
  sprite: "fx_glow_s",
  frames: "fixed",
  speed: [0, 6],
  life: [0.12, 0.2],
  size: [0.35, 0.1],
  colors: [C.orange, C.yellow, C.white],
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};

/** Missile exhaust sparks (the line itself is drawn by drawTrails). */
const HEROES_A_TRAILS: Record<string, TrailDef> = {
  spaghetti: { def: exhaust, every: 2, n: 1, color: C.orange, halo: 0, haloAlpha: 0 },
  spaghetti_evo: { def: exhaust, every: 1, n: 1, colors: [C.red, C.orange, C.yellow], color: C.red, halo: 5, haloAlpha: 0.2 },
  tea: { def: { ...teaDrop, bounce: undefined, speed: [0, 4], life: [0.15, 0.25] }, every: 2, n: 1, color: C.gold, halo: 0, haloAlpha: 0 },
  drill: { def: bonkStar, every: 2, n: 1, colors: [C.orange, C.yellow, C.red], color: C.orange, halo: 8, haloAlpha: 0.25 },
};
Object.assign(TRAILS, HEROES_A_TRAILS);

// ---------------------------------------------------------------- pops
interface Pop {
  on: boolean;
  /** 0 text, 1 BAKA sprite. */
  kind: number;
  text: string;
  heart: boolean;
  frame: number;
  x: number;
  y: number;
  t: number;
  life: number;
  scale: number;
  color: number;
}
const MAX_POPS = 3;
const MAX_BAKA = 2;
const POP_LIFE = 0.8;

// ---------------------------------------------------------------- missile trails
const TRAIL_SLOTS = 128;
const TRAIL_N = 18;
const TRAIL_LIFE = 0.5;

export interface HeroesABindOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  calm: boolean;
}

export class HeroesAFx {
  private w: World | null = null;
  private o: HeroesABindOpts | null = null;
  private now = 0;
  private frameN = 0;
  // handles
  private readonly hPx: number;
  private readonly hHeart: number;
  private readonly hStreak: number;
  private readonly hFlashlight: number;
  private readonly hRing: number;
  // Kuro
  private readonly breathAcc = new Float32Array(32);
  private shadowT = -1;
  private shadowDur = 0;
  private shadowDir = 1;
  private shadowRoared = false;
  private revealT = -1;
  private revealFlood = 0;
  private revealX = 0;
  private revealY = 0;
  private revealFace = 1;
  private dimK = 0;
  private vigOwned = false;
  private vigSaved = BASE_VIG;
  // Pudding
  private omuT = -1;
  private omuX = 0;
  private omuY = 0;
  private omuDur = 0;
  private omuKetchup = false;
  private pourT = 0;
  private lastPartyTimer = 0;
  private warmSaidAt = -10;
  // Aoi
  private combinedT = 0;
  private rocketSaid = -1;
  // Akane
  private hmphT = -1;
  private drillT = -1;
  private drillR = 48;
  private bonkAt = -1;
  private smackSfxN = 0;
  // pops
  private readonly pops: Pop[] = [];
  // missile trails (ring buffer per slot)
  private readonly tUid = new Int32Array(TRAIL_SLOTS);
  private readonly tGone = new Float32Array(TRAIL_SLOTS);
  private readonly tSeen = new Uint8Array(TRAIL_SLOTS);
  private readonly tEvo = new Uint8Array(TRAIL_SLOTS);
  private readonly tHead = new Int32Array(TRAIL_SLOTS);
  private readonly tCount = new Int32Array(TRAIL_SLOTS);
  private readonly tx = new Float32Array(TRAIL_SLOTS * TRAIL_N);
  private readonly ty = new Float32Array(TRAIL_SLOTS * TRAIL_N);
  private readonly tt = new Float32Array(TRAIL_SLOTS * TRAIL_N);
  private readonly slotOf = new Map<number, number>();

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly anims: Anims,
  ) {
    this.hPx = r.atlas.handle("fx_px");
    this.hHeart = r.atlas.handle("fx_heart");
    this.hStreak = r.atlas.handle("fx_streak");
    this.hFlashlight = r.atlas.handle("ult_flashlight");
    this.hRing = r.atlas.handle("fx_ring");
    for (let i = 0; i < MAX_POPS; i++) this.pops.push({ on: false, kind: 0, text: "", heart: false, frame: 0, x: 0, y: 0, t: 0, life: POP_LIFE, scale: 1, color: C.white });
  }

  setWorld(w: World): void {
    this.w = w;
    this.reset();
  }

  private reset(): void {
    this.shadowT = this.revealT = this.omuT = this.hmphT = this.drillT = -1;
    this.combinedT = this.pourT = 0;
    this.warmSaidAt = -10;
    this.dimK = 0;
    this.releaseVignette();
    for (const p of this.pops) p.on = false;
    this.tUid.fill(0);
    this.tCount.fill(0);
    this.slotOf.clear();
    this.breathAcc.fill(0);
  }

  private sfx(id: SfxId, vol = 1, pitch = 0, x = NaN): void {
    this.o?.sfx(id, vol, pitch, x);
  }

  // ================================================================ kills
  /** Feedback's enemyKilled: true = handled here (no default confetti). Kills during ETERNAL ABYSS become black feathers. */
  killFx(e: KillEvent): boolean {
    const w = this.w;
    if (!w || e.boss) return false;
    const u = w.ult;
    if (!u || u.def.id !== "eternal_abyss" || u.phase !== "active") return false;
    const en = e.enemy;
    this.fx.ps.emit(feather, e.x, e.y - en.cy, e.elite ? 16 : 6);
    this.fx.ps.emit(darkSparkle, e.x, e.y - en.cy, e.elite ? 6 : 2);
    if (e.elite) this.fx.juice.shake(0.2);
    return true;
  }

  // ================================================================ per frame
  /** Called from WorldView.draw (after the bestiary's grade overrides). `dt` = scaled sim dt. */
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.now += realDt;
    this.frameN++;
    this.scanProjectiles(time, dt, realDt);
    this.drawBurns(time);
    this.drawMark(time);
    this.drawTeapot(time, dt);
    this.drawWarmTea(time);
    this.drawDrone(time);
    this.drawShadow(time, realDt);
    this.drawReveal(time, realDt);
    this.drawOmurice(time, realDt);
    this.drawDrill(realDt);
    this.drawCombined(time, realDt);
    this.drawHmph(realDt);
    this.drawPops(realDt);
    this.applyDim(realDt);
  }

  /** One pass over the projectiles: custom looks for the group's sprite-less / special projectiles. */
  private scanProjectiles(time: number, dt: number, realDt: number): void {
    const w = this.w as World;
    const r = this.r;
    const cam = r.camera;
    const items = w.projectiles.items;
    this.tSeen.fill(0);
    let fam = 0;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = items[i];
      if (p.dead) continue;
      const src = p.source;
      if (src === DFD || src === ABYSS) {
        if (p.b === BEAM_JET || p.b === BEAM_EYE) this.drawBeam(p, time);
        else if (p.kind === PK_MANAGED && p.sprite) this.breath(p, fam++, dt);
        continue;
      }
      if (p.sprite === "w_missile" || p.sprite === "w_missile_evo") {
        this.sampleTrail(p);
        continue;
      }
      if (!cam.inView(p.x, p.y, 60)) continue;
      if ((src === TEA || src === PARTY) && !p.sprite) this.drawTea(p, time);
      else if (src === ALDENTE && p.a === SAUCE) this.drawSauce(p, time);
      else if (src === "aoi_jet_dash") this.drawJetFlame(p);
      else if (src === ROBOT) {
        if (p.kind === PK_FREE && p.r > 0) this.drawRocket(p, time);
        else if (p.kind === PK_FALL) this.drawFistLines(p);
      }
    }
    this.drawTrails(realDt);
  }

  // ---------------------------------------------------------------- Kuro
  /** A familiar's breath: a stream of flame puffs along the cone (30/s), a glow at the mouth. */
  private breath(p: Projectile, i: number, dt: number): void {
    if (p.a <= 0 || dt <= 0 || i >= this.breathAcc.length) return;
    const black = p.b === 1 || p.source === ABYSS;
    const mx = p.x + Math.cos(p.ang) * 5;
    const my = p.y + Math.sin(p.ang) * 5;
    const rate = p.source === ABYSS ? 34 : 30;
    this.breathAcc[i] += rate * dt;
    const n = Math.floor(this.breathAcc[i]);
    if (n > 0) {
      this.breathAcc[i] -= n;
      this.fx.ps.emit(black ? flameBlack : flameOrange, mx, my, n, p.ang, -1, 1, p.hh / 64);
    }
    // the cone itself: a soft streak under the puffs so the breath reads even between them
    const L = p.hh * 0.8;
    const cx = mx + Math.cos(p.ang) * L * 0.5;
    const cy = my + Math.sin(p.ang) * L * 0.5;
    const wob = 1 + 0.12 * Math.sin(this.now * 31 + p.uid);
    if (black) this.r.spr(Layer.FxBelow, this.hStreak, cx, cy, L / 16, 2.6 * wob, p.ang, C.darkViolet, 0.32, 0, Flag.NoSnap);
    else this.r.spr(Layer.FxAdd, this.hStreak, cx, cy, L / 16, 2.2 * wob, p.ang, C.orange, 0.3, 0, Flag.Add | Flag.Glow | Flag.NoSnap);
    this.r.glow(mx, my, 7, black ? C.violet : C.orange, black ? 0.3 : 0.4);
  }

  private drawBeam(p: Projectile, time: number): void {
    const r = this.r;
    const k = p.age / Math.max(0.01, p.life);
    const open = Math.min(1, p.age / 0.05) * Math.min(1, (1 - k) / 0.2);
    const ex = p.ox + Math.cos(p.ang) * p.a;
    const ey = p.oy + Math.sin(p.ang) * p.a;
    const jet = p.b === BEAM_JET;
    const flick = 0.85 + 0.15 * Math.sin(time * 60 + p.uid);
    if (jet) {
      r.line(Layer.FxAdd, p.ox, p.oy, ex, ey, 11 * open * flick, C.darkViolet, 0.55, Flag.Add | Flag.Glow);
      r.line(Layer.Fx, p.ox, p.oy, ex, ey, 6 * open, C.deep, 0.9, 0);
      r.line(Layer.FxAdd, p.ox, p.oy, ex, ey, 2 * open, C.hotPink, 0.95, Flag.Add | Flag.Glow);
      r.glow(ex, ey, 10, C.violet, 0.5 * open);
    } else {
      r.line(Layer.FxAdd, p.ox, p.oy, ex, ey, 5 * open * flick, C.red, 0.5, Flag.Add | Flag.Glow);
      r.line(Layer.FxAdd, p.ox, p.oy, ex, ey, 1.5 * open, C.white, 0.95, Flag.Add | Flag.Glow);
      r.glow(p.ox, p.oy, 5, C.red, 0.6 * open);
    }
    if ((this.frameN + p.uid) % 3 === 0) this.fx.ps.emit(spark, ex, ey, 1, NaN, jet ? C.violet : C.red);
  }

  /** Flames on burning heads (orange w/ violet outline; actually black with the seal broken / the evolution). */
  private drawBurns(time: number): void {
    const w = this.w as World;
    const st = heroesAIf(w);
    if (!st || st.burnCount === 0) return;
    const r = this.r;
    const black = st.burnSource === ABYSS || w.talentRank("kuro_seal_broken") > 0;
    const a = this.anims.get(black ? "w_abyss_fire" : "w_dragon_fire");
    const h = a.first + Math.min(3, a.count - 1);
    const cam = r.camera;
    let drawn = 0;
    for (let i = 0; i < st.burnCount && drawn < 90; i++) {
      const b = st.burns[i];
      const e = b.e;
      if (e.dead || e.uid !== b.uid || b.t <= 0) continue;
      const y = e.y - e.z - e.cy * 2 - 1;
      if (!cam.inView(e.x, y, 10)) continue;
      drawn++;
      const fl = Math.sin(time * 23 + e.uid * 1.7);
      const s = (0.5 + 0.06 * fl) * Math.min(1.6, e.scale);
      r.spr(Layer.Fx, h, e.x + fl * 0.6, y, s, s * (1.05 + 0.1 * fl), 0, 0xffffff, 0.85 + 0.15 * fl, 0, 0);
    }
  }

  /** Abyssal Gaze: a purple eye floating over the Marked enemy. */
  private drawMark(time: number): void {
    const st = heroesAIf(this.w as World);
    const e = st?.mark;
    if (!e || e.dead || e.uid !== st.markUid) return;
    const r = this.r;
    const x = e.x;
    const y = e.y - e.z - e.cy * 2 - 9 + Math.sin(time * 4) * 1.5;
    const q = 0.5 + 0.5 * Math.sin(time * 7);
    r.glow(x, y, 9, C.violet, 0.35 + 0.2 * q);
    r.circle(Layer.Text, x, y, 3.6, C.outline, 1);
    r.circle(Layer.Text, x, y, 2.8, C.white, 1);
    r.circle(Layer.Text, x, y, 1.8, C.darkViolet, 1);
    r.circle(Layer.Text, x, y, 0.9, C.deep, 1);
    r.ring(Layer.Text, e.x, e.y - e.cy, e.r + 4 + q * 2, C.violet, 0.5 + 0.3 * q, 0, false);
  }

  /** ETERNAL ABYSS: the colossal shadow (the salamander x10, #140c22 at 85 %) sweeping across the ground. */
  private drawShadow(time: number, realDt: number): void {
    if (this.shadowT === -1) return;
    this.shadowT += realDt;
    const t = this.shadowT;
    if (t < 0) return;
    if (t > this.shadowDur) {
      this.shadowT = -1;
      return;
    }
    const r = this.r;
    const v = r.camera.view;
    const k = t / this.shadowDur;
    const dir = this.shadowDir;
    const x = dir > 0 ? v.x - 90 + (v.w + 180) * k : v.x + v.w + 90 - (v.w + 180) * k;
    const y = v.y + v.h * 0.52 + Math.sin(k * TAU) * 12;
    const a = this.anims.get("w_salamander");
    const h = a.first + (Math.floor(time * 5) % a.count);
    const sweep = Math.sin(PI * k);
    // a faint dark band rides with it (the light dims where it passes - never a black screen)
    r.fillView(Layer.Overlay, C.deep, 0.08 * sweep);
    // size to the view so a portrait phone still sees a creature, not a wall of black
    const sc = Math.max(5, Math.min(9, v.w / 26));
    // the wings, implied by two huge violet streak blurs
    const wx = x - dir * 2.6 * sc;
    const flap = Math.sin(time * 4) * 0.12;
    r.spr(Layer.Decal, this.hStreak, wx, y - 4.2 * sc, 0.9 * sc * dir, 0.9 * sc, (-0.38 - flap) * dir, C.darkViolet, 0.38, 0, Flag.NoSnap);
    r.spr(Layer.Decal, this.hStreak, wx, y + 4 * sc, 0.9 * sc * dir, 0.9 * sc, (0.38 + flap) * dir, C.darkViolet, 0.38, 0, Flag.NoSnap);
    // violet rim (a slightly larger copy behind) + a translucent violet-black body: reads as a shape, not a hole
    r.spr(Layer.Decal, h, x, y, 1.08 * sc * dir, 1.08 * sc, 0, C.violet, 0.32, 1, Flag.NoSnap);
    r.spr(Layer.Decal, h, x, y, sc * dir, sc, 0, 0x2a1840, 0.6, 1, Flag.NoSnap);
    r.glow(x, y, 7 * sc, C.darkViolet, 0.22 * sweep);
    // two burning red eyes on the head (sprite faces right: head is up-right of centre)
    const ex = x + dir * 2.4 * sc;
    const ey = y - 1.6 * sc;
    const blink = Math.sin(time * 9) > 0.92 ? 0.3 : 1;
    for (let i = 0; i < 2; i++) {
      const eox = ex + dir * i * 0.9 * sc;
      r.glow(eox, ey, 0.9 * sc, C.red, 0.55 * blink);
      r.circle(Layer.Fx, eox, ey, Math.max(1.2, 0.16 * sc), C.red, 0.95 * blink);
    }
    if ((this.frameN & 1) === 0) this.fx.ps.emit(darkSparkle, x - dir * 50 + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 70, 1);
  }

  /** The reveal: the real salamander and a tiny flashlight (or a stadium floodlight) pointed at it. */
  private drawReveal(time: number, realDt: number): void {
    if (this.revealT < 0) return;
    this.revealT += realDt;
    const t = this.revealT;
    if (t > 1.1) {
      this.revealT = -1;
      return;
    }
    const r = this.r;
    const alpha = t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.25) : 1;
    const f = this.revealFace;
    const sx = this.revealX;
    const sy = this.revealY;
    const a = this.anims.get("w_salamander");
    const hs = a.first + (Math.floor(time * 8) % a.count);
    r.glow(sx - f * 4, sy - 2, 16, C.paleYellow, 0.28 * alpha);
    r.shadow(sx, sy + 1, 8, 0.6 * alpha);
    // the "dragon" looks back at the light, very small and very orange
    r.spr(Layer.Entity, hs, sx, sy - 5, -f, 1, 0, 0xffffff, alpha, 0, 0);
    if (this.revealFlood) {
      // a stadium floodlight on a pole, blazing at a 12 px salamander
      const lx = sx - f * 46;
      const ly = sy - 34;
      r.rect(Layer.Entity, lx - 1, ly, 2, 34, 0x8a8aa0, alpha);
      r.rect(Layer.Entity, lx - 9, ly - 8, 18, 10, 0x4b4b63, alpha);
      for (let i = 0; i < 4; i++) {
        const bx = lx - 6 + i * 4;
        r.circle(Layer.Entity, bx, ly - 3, 1.6, C.white, alpha);
        r.glow(bx, ly - 3, 6, C.paleYellow, 0.6 * alpha);
      }
      for (let i = 1; i <= 6; i++) {
        const q = i / 6;
        r.glow(lx + (sx - lx) * q, ly + (sy - 6 - ly) * q, 6 + 16 * q, C.paleYellow, 0.18 * alpha);
      }
    } else {
      const fx0 = sx - f * 18;
      r.spr(Layer.Entity, this.hFlashlight, fx0, sy - 4, f, 1, 0, 0xffffff, alpha, 0, 0);
      r.glow(sx - f * 8, sy - 5, 8, C.paleYellow, 0.4 * alpha);
    }
  }

  /** Dim grade + closing vignette while the abyss lasts; snaps back at the reveal. */
  private applyDim(realDt: number): void {
    const w = this.w as World;
    const u = w.ult;
    const want = u && u.phase === "active" && u.def.id === "eternal_abyss" && this.revealT < 0 ? 1 : 0;
    this.dimK = want ? Math.min(1, this.dimK + realDt / 0.3) : 0;
    const post = this.r.post;
    if (this.dimK <= 0) {
      this.releaseVignette();
      return;
    }
    const k = ease.sineOut(this.dimK);
    // a moody violet dusk, not a blackout: phones at low brightness turned GRADES.dim + 0.6 vignette into "just black"
    lerpGrade(post.grade, ABYSS_GRADE, k, post.grade);
    this.vigSaved = this.vigOwned ? this.vigSaved : post.vignette;
    this.vigOwned = true;
    post.vignette = this.vigSaved + (0.4 - this.vigSaved) * k;
  }

  private releaseVignette(): void {
    if (!this.vigOwned) return;
    this.vigOwned = false;
    this.r.post.vignette = this.vigSaved;
  }

  // ---------------------------------------------------------------- Pudding
  /** Teacups (a 0: tipping f1), tea puddles (a 1 / 3: splash -> rest -> dry), the moat (a 2). */
  private drawTea(p: Projectile, time: number): void {
    const r = this.r;
    if (p.a === 0) {
      // (Orbital Guard: scale 0 = broken - nothing is drawn in its place; it pops back in on reform)
      const sc = p.scale;
      if (sc <= 0) return;
      const a = this.anims.get("w_teacup");
      const tip = p.b > 0;
      const h = a.first + (tip ? Math.min(1, a.count - 1) : 0);
      const out = Math.cos(p.ang) >= 0 ? 1 : -1;
      r.shadow(p.x, p.y + 9, 5 * sc, 0.35);
      r.spr(Layer.Entity, h, p.x, p.y, out * sc, sc, tip ? out * 0.7 : Math.sin(time * 5 + p.uid) * 0.08, 0xffffff, 1, 0, 0);
      if ((this.frameN + p.uid) % 40 === 0) this.fx.ps.emit(steam, p.x, p.y - 4, 1, NaN, -1, 0.7);
      return;
    }
    if (p.a === 2) {
      // the tea moat: an amber band with glossy rims and glints running around it
      const R = p.r;
      const band = p.hw;
      const mid = R - band * 0.5;
      const q = 0.5 + 0.5 * Math.sin(time * 2.6);
      r.ring(Layer.Decal, p.x, p.y, mid, 0xb8682a, 0.5, 0, true);
      r.ring(Layer.Decal, p.x, p.y, mid, 0xe6a04a, 0.35, 0, true);
      r.ring(Layer.Decal, p.x, p.y, R, 0xffd27a, 0.55 + 0.2 * q, 0, false);
      r.ring(Layer.Decal, p.x, p.y, R - band, 0xffd27a, 0.35, 0, false);
      for (let i = 0; i < 12; i++) {
        const ang = time * 0.9 + (i / 12) * TAU;
        const rr = mid + Math.sin(time * 3 + i) * band * 0.3;
        r.spr(Layer.FxAdd, this.hPx, p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr, 0.6, 0.6, 0, C.paleYellow, 0.6, 0, Flag.Add | Flag.Glow);
      }
      if (this.frameN % 9 === 0) {
        const ang = Math.random() * TAU;
        this.fx.ps.emit(steam, p.x + Math.cos(ang) * mid, p.y + Math.sin(ang) * mid, 1);
      }
      return;
    }
    // puddle
    const a = this.anims.get("w_tea_puddle");
    const left = p.life - p.age;
    const f = p.age < 0.25 ? 0 : left < 0.5 ? 2 : 1;
    const h = a.first + Math.min(f, a.count - 1);
    const s = p.r / 12;
    const alpha = Math.min(1, left / 0.35) * Math.min(1, p.age / 0.08);
    r.spr(Layer.Decal, h, p.x, p.y, s, s, 0, 0xffffff, 0.92 * alpha, 0, 0);
    r.glow(p.x, p.y, p.r * 0.7, C.gold, 0.08 * alpha);
    if ((this.frameN + p.uid) % 30 === 0 && left > 0.5) this.fx.ps.emit(steam, p.x + (Math.random() - 0.5) * p.r, p.y - 2, 1);
  }

  /**
   * Warm Tea (teapot-tempest.ts warmTea): a thin two-tone aura ring around her body with WARM_DOTS dots counting
   * the seconds left (lit = left / full), a warm glow, steam off her shoulders; it blinks in its last 0.6 s.
   */
  private drawWarmTea(time: number): void {
    const w = this.w as World;
    const inst = w.hasWeapon(TEA) ?? w.hasWeapon(PARTY);
    if (!inst) return;
    const left = inst.data.warm ?? 0;
    const full = inst.data.warmMax ?? 0;
    if (left <= 0 || full <= 0 || w.player.dead) return;
    const r = this.r;
    const p = w.player;
    const k = Math.min(1, left / 0.25);
    const blink = left < 0.6 ? 0.55 + 0.45 * Math.sin(time * 26) : 1;
    const a = k * blink;
    const pulse = 1 + 0.06 * Math.sin(time * 5);
    // a warm halo on her and a thin aura ring around her body with its seconds-left dots
    const cy = p.y - WARM_CY;
    r.glow(p.x, cy, 18, C.paleYellow, 0.16 * a);
    // (two tones from her band colours: a cream ring inside a warm-brown rim reads on white floors and orange carpets)
    r.batch.drawP(Layer.Fx, this.hRing, p.x, cy, (WARM_RX * pulse) / 16, (WARM_RY * pulse) / 16, 0, 0xffd27a, 0.85 * a, 0, Flag.NoSnap, 16, 16);
    r.batch.drawP(Layer.Fx, this.hRing, p.x, cy, (WARM_RX * pulse + 1) / 16, (WARM_RY * pulse + 1) / 16, 0, 0xa6683f, 0.8 * a, 0, Flag.NoSnap, 16, 16);
    const lit = Math.ceil((left / full) * WARM_DOTS);
    for (let i = 0; i < lit; i++) {
      // (clockwise from the top: the last seconds sit at the top)
      const ang = -PI / 2 + (i / WARM_DOTS) * TAU;
      r.spr(Layer.Fx, this.hPx, p.x + Math.cos(ang) * WARM_RX * pulse, cy + Math.sin(ang) * WARM_RY * pulse, 2.2, 2.2, 0, 0xffb84a, a, 0, Flag.NoSnap);
    }
    if ((this.frameN & 15) === 0) this.fx.ps.emit(warmSteam, p.x + (this.frameN & 16 ? 5 : -5), p.y - 15, 1);
  }

  /** Eternal Tea Party: the flying teapot hovering above Pudding, pouring after every fling. */
  private drawTeapot(time: number, dt: number): void {
    const w = this.w as World;
    const inst = w.hasWeapon(PARTY);
    if (!inst) return;
    if (inst.timer > this.lastPartyTimer + 0.2) this.pourT = 0.4;
    this.lastPartyTimer = inst.timer;
    this.pourT = Math.max(0, this.pourT - dt);
    const r = this.r;
    const p = w.player;
    const x = p.x - p.face * 2;
    const y = p.y - 34 + Math.sin(time * 3) * 2;
    const a = this.anims.get("w_teapot_big");
    const pouring = this.pourT > 0 || Math.sin(time * 1.3) > 0.6;
    const h = a.first + (pouring ? Math.min(1, a.count - 1) : 0);
    r.glow(x, y, 14, C.paleYellow, 0.18);
    r.spr(Layer.Fx, h, x, y, p.face, 1, pouring ? p.face * 0.15 : 0, 0xffffff, 1, 0, 0);
    if (pouring && dt > 0 && (this.frameN & 1) === 0) this.fx.ps.emit(pourDrop, x + p.face * 11, y + 3, 1);
  }

  /** The omurice: plopped (squash 1.4 -> 1), ketchup heart from 0.4 s, fades out at the end. */
  private drawOmurice(time: number, realDt: number): void {
    if (this.omuT < 0) return;
    this.omuT += realDt;
    const t = this.omuT;
    if (t > this.omuDur + 0.4) {
      this.omuT = -1;
      return;
    }
    const r = this.r;
    const a = this.anims.get("ult_omurice");
    const h = a.first + (this.omuKetchup ? Math.min(1, a.count - 1) : 0);
    const k = Math.min(1, t / 0.25);
    const sq = 1.4 - 0.4 * ease.backOut(k);
    const alpha = t > this.omuDur ? Math.max(0, 1 - (t - this.omuDur) / 0.4) : 1;
    r.shadow(this.omuX, this.omuY, 30, 0.6 * alpha);
    r.glow(this.omuX, this.omuY - 8, 26, C.pink, (0.12 + 0.06 * Math.sin(time * 6)) * alpha);
    // (just behind Pudding, who stands at the same y)
    r.batch.sortKey = this.omuY - 0.5;
    r.spr(Layer.Entity, h, this.omuX, this.omuY, 2 - sq, sq, 0, 0xffffff, alpha, 0, 0);
    r.batch.sortKey = NaN;
    if (this.omuKetchup && this.frameN % 12 === 0) this.fx.ps.emit(P.hearts, this.omuX + (Math.random() - 0.5) * 30, this.omuY - 16, 1, NaN, -1, 0.7);
  }

  // ---------------------------------------------------------------- Aoi
  /** Record a missile's path (ring buffer per uid). */
  private sampleTrail(p: Projectile): void {
    let s = this.slotOf.get(p.uid);
    if (s === undefined) {
      s = -1;
      for (let i = 0; i < TRAIL_SLOTS; i++)
        if (this.tUid[i] === 0) {
          s = i;
          break;
        }
      if (s < 0) return;
      this.tUid[s] = p.uid;
      this.tCount[s] = 0;
      this.tHead[s] = 0;
      this.tGone[s] = 0;
      this.tEvo[s] = p.sprite === "w_missile_evo" ? 1 : 0;
      this.slotOf.set(p.uid, s);
    }
    this.tSeen[s] = 1;
    const base = s * TRAIL_N;
    const n = this.tCount[s];
    if (n > 0) {
      const li = base + ((this.tHead[s] + TRAIL_N - 1) % TRAIL_N);
      const dx = p.x - this.tx[li];
      const dy = p.y - this.ty[li];
      if (dx * dx + dy * dy < 7) return;
    }
    const i = base + this.tHead[s];
    this.tx[i] = p.x;
    this.ty[i] = p.y;
    this.tt[i] = this.now;
    this.tHead[s] = (this.tHead[s] + 1) % TRAIL_N;
    if (n < TRAIL_N) this.tCount[s] = n + 1;
    if (this.tEvo[s] && (this.frameN + p.uid) % 5 === 0) this.fx.ps.emit(ember, p.x, p.y, 1);
  }

  /** The spaghetti: 1-px lines white -> #5aa8ff over 0.5 s (the evolution: 2-px pale noodles). */
  private drawTrails(realDt: number): void {
    const r = this.r;
    const now = this.now;
    // peak chaos (adaptive bloom limiter load): every other point, half the line instances
    const step = r.post.load > 0.55 ? 2 : 1;
    for (let s = 0; s < TRAIL_SLOTS; s++) {
      const uid = this.tUid[s];
      if (uid === 0) continue;
      if (!this.tSeen[s]) {
        this.tGone[s] += realDt;
        if (this.tGone[s] > TRAIL_LIFE) {
          this.slotOf.delete(uid);
          this.tUid[s] = 0;
          continue;
        }
      }
      const n = this.tCount[s];
      if (n < 2) continue;
      const base = s * TRAIL_N;
      const evo = this.tEvo[s] === 1;
      let pi = base + ((this.tHead[s] + TRAIL_N - n) % TRAIL_N);
      for (let k = step; k < n; k += step) {
        const ci = base + ((this.tHead[s] + TRAIL_N - n + k) % TRAIL_N);
        const age = now - this.tt[ci];
        if (age < TRAIL_LIFE) {
          const q = age / TRAIL_LIFE;
          const col = evo ? lerpColor(0xfff1a8, 0xf2bd66, q) : lerpColor(C.white, C.blue, q);
          r.line(Layer.Fx, this.tx[pi], this.ty[pi], this.tx[ci], this.ty[ci], evo ? 2 : 1, col, (1 - q) * 0.95, Flag.NoSnap);
        }
        pi = ci;
      }
    }
  }

  /** A tomato-sauce splat on the ground: small, warm and short-lived (it must read as sauce, not as gore). */
  private drawSauce(p: Projectile, time: number): void {
    const a = this.anims.get("w_sauce");
    const h = a.first + (Math.floor(time * 4 + p.uid) % a.count);
    const left = p.life - p.age;
    const alpha = Math.min(1, left / 0.45) * Math.min(1, p.age / 0.08);
    const s = Math.min(1.1, p.r / 8) * (0.8 + 0.2 * Math.min(1, p.age / 0.12));
    this.r.spr(Layer.Decal, h, p.x, p.y, (p.uid & 1 ? 1 : -1) * s, s, 0, 0xffd2a8, 0.7 * alpha, 0, 0);
  }

  private drawJetFlame(p: Projectile): void {
    const k = 1 - p.age / p.life;
    const r = this.r;
    r.circle(Layer.Decal, p.x, p.y, 5, 0x3b2a1a, 0.22 * k);
    r.glow(p.x, p.y - 2, 7, C.orange, 0.4 * k);
    if ((this.frameN + p.uid) % 4 === 0) this.fx.ps.emit(ember, p.x, p.y - 2, 1);
  }

  /** ROCKET PUNCH: the clenched fist with a motion blur and speed streaks. */
  private drawRocket(p: Projectile, time: number): void {
    const r = this.r;
    const a = this.anims.get("ult_robot_fist");
    const h = a.first + Math.min(1, a.count - 1);
    const dir = p.vx >= 0 ? 1 : -1;
    for (let i = 1; i <= 3; i++) r.spr(Layer.Fx, h, p.x - dir * i * 14, p.y, -dir * 1.4, 1.4, (dir * PI) / 2, C.lightBlue, 0.35 - i * 0.09, 0.6, Flag.NoSnap);
    r.glow(p.x, p.y, 26, C.blue, 0.3);
    r.spr(Layer.Fx, h, p.x, p.y, -dir * 1.4, 1.4, (dir * PI) / 2 + Math.sin(time * 40) * 0.03, 0xffffff, 1, 0, Flag.NoSnap);
    for (let i = 0; i < 4; i++) {
      const yy = p.y - 18 + i * 12;
      r.spr(Layer.FxAdd, this.hStreak, p.x - dir * 42, yy, 3.5 * dir, 0.6, 0, C.white, 0.5, 0, Flag.Add | Flag.NoSnap);
    }
  }

  /** Falling fists: vertical speed lines above them. */
  private drawFistLines(p: Projectile): void {
    const r = this.r;
    const y = p.y - p.z;
    for (let i = -1; i <= 1; i++) r.spr(Layer.FxAdd, this.hStreak, p.x + i * 14, y - 40, 3, 0.5, PI / 2, C.white, 0.45, 0, Flag.Add | Flag.NoSnap);
  }

  /** Aoi C6: the support drone (a little rotor bot with a blinking light). */
  private drawDrone(time: number): void {
    const st = heroesAIf(this.w as World);
    if (!st || !st.drone) return;
    const r = this.r;
    const x = st.droneX;
    const y = st.droneY + Math.sin(time * 5) * 1.2;
    r.shadow(x, (this.w as World).player.y + 2, 6, 0.35);
    const spin = time * 40;
    r.line(Layer.Fx, x + Math.cos(spin) * 6, y - 4 + Math.sin(spin) * 1, x - Math.cos(spin) * 6, y - 4 - Math.sin(spin) * 1, 1, C.white, 0.7, Flag.NoSnap);
    r.rect(Layer.Fx, x - 1, y - 4, 2, 2, C.outline, 1);
    r.circle(Layer.Fx, x, y, 3.8, C.outline, 1);
    r.circle(Layer.Fx, x, y, 3, C.white, 1);
    r.circle(Layer.Fx, x, y + 0.5, 1.8, C.blue, 1);
    const blink = Math.floor(time * 3) % 2 === 0;
    r.circle(Layer.FxAdd, x + 2, y - 1, 0.8, blink ? C.red : C.lime, 1, Flag.Add | Flag.Glow);
    if (st.droneShot < 0.1) r.glow(x, y - 3, 8, C.yellow, 0.6);
  }

  private drawCombined(time: number, realDt: number): void {
    if (this.combinedT <= 0) return;
    this.combinedT = Math.max(0, this.combinedT - realDt);
    const w = this.w as World;
    const p = w.player;
    const q = 0.5 + 0.5 * Math.sin(time * 8);
    const k = Math.min(1, this.combinedT);
    this.r.ring(Layer.FxAdd, p.x, p.y - 9, 15 + q * 2, C.blue, (0.35 + 0.25 * q) * k, Flag.Add | Flag.Glow, true);
    if (this.frameN % 6 === 0) this.fx.ps.emit(spark, p.x + (Math.random() - 0.5) * 20, p.y - 6 - Math.random() * 14, 1, NaN, C.lightBlue);
  }

  // ---------------------------------------------------------------- Akane
  /** Twin-Tail Tornado: two drills spinning around her (0.3 s). */
  private drawDrill(realDt: number): void {
    if (this.drillT < 0) return;
    this.drillT += realDt;
    if (this.drillT > 0.32) {
      this.drillT = -1;
      return;
    }
    const w = this.w as World;
    const p = w.player;
    const r = this.r;
    const cx = p.x;
    const cy = p.y - 8;
    const R = this.drillR;
    for (let k = 0; k < 2; k++) {
      const a = this.drillT * 26 + k * PI;
      const ca = Math.cos(a);
      const sa = Math.sin(a) * 0.85;
      const tx = cx + ca * R;
      const ty = cy + sa * R;
      r.line(Layer.Fx, cx + ca * 6, cy + sa * 6, tx, ty, 6, C.hotPink, 0.95, Flag.NoSnap);
      r.line(Layer.Fx, cx + ca * 8, cy + sa * 8, tx, ty, 3.5, C.red, 1, Flag.NoSnap);
      r.line(Layer.FxAdd, cx + ca * 10, cy + sa * 10, tx, ty, 1, C.yellow, 0.9, Flag.Add | Flag.Glow | Flag.NoSnap);
      // spiral bands
      for (let i = 1; i <= 3; i++) {
        const q = i / 4;
        const bx = cx + ca * R * q;
        const by = cy + sa * R * q;
        r.circle(Layer.FxAdd, bx, by, 1.2, C.orange, 0.9, Flag.Add | Flag.Glow);
      }
      r.glow(tx, ty, 8, C.orange, 0.4);
    }
  }

  /** "...h-hmph.": her shouting portrait slides back in for a beat on a cut-in band. */
  private drawHmph(realDt: number): void {
    if (this.hmphT < 0) return;
    this.hmphT += realDt;
    const t = this.hmphT;
    const T = 0.62;
    if (t > T) {
      this.hmphT = -1;
      return;
    }
    const r = this.r;
    const v = r.camera.view;
    const inK = ease.backOut(Math.min(1, t / 0.14));
    const outK = t > T - 0.12 ? ease.quadIn((t - (T - 0.12)) / 0.12) : 0;
    // lower left: clear of the hero (centre), the combo counter (right) and the touch buttons (bottom right)
    const by = v.y + v.h * 0.66;
    const slide = -((1 - inK) * 110 + outK * 110);
    const bandA = 0.92 * (1 - outK);
    const bw = Math.min(v.w * 0.62, 150);
    const bx = v.x + bw * 0.5 + slide;
    // the band (tilted like the cut-in's)
    r.spr(Layer.Overlay, this.hPx, bx, by, bw * 0.55, 15, -0.16, C.orange, bandA, 0, Flag.NoSnap);
    r.spr(Layer.Overlay, this.hPx, bx, by - 15, bw * 0.55, 1, -0.16, C.white, bandA, 0, Flag.NoSnap);
    r.spr(Layer.Overlay, this.hPx, bx, by + 15, bw * 0.55, 1, -0.16, C.white, bandA, 0, Flag.NoSnap);
    const a = this.anims.get("portrait_akane");
    const h = a.first + Math.min(1, a.count - 1);
    const px = v.x + 34 + slide;
    r.spr(Layer.Overlay, h, px, by - 8, 0.9, 0.9, 0, 0xffffff, 1 - outK, 0, 0);
    r.text.draw("...h-hmph.", px + 32, by + 2, { scale: 1, align: "left", valign: "middle", layer: Layer.Overlay, color: C.white, alpha: 1 - outK });
  }

  // ---------------------------------------------------------------- pops
  private pop(kind: number, text: string, frame: number, x: number, y: number, scale: number, color: number): void {
    const w = this.w as World;
    if (w.ult && w.ult.phase === "cutin") return;
    let live = 0;
    let bakas = 0;
    let slot: Pop | null = null;
    for (const p of this.pops) {
      if (p.on) {
        live++;
        if (p.kind === 1) bakas++;
      } else if (!slot) slot = p;
    }
    if (!slot || live >= MAX_POPS || (kind === 1 && bakas >= MAX_BAKA)) return;
    // never on the hero: push it out to 32 px along the hero -> pop direction
    const hx = w.player.x;
    const hy = w.player.y - 9;
    let dx = x - hx;
    let dy = y - hy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 32) {
      if (d < 0.5) {
        dx = 0;
        dy = -1;
      } else {
        dx /= d;
        dy /= d;
      }
      x = hx + dx * 32;
      y = hy + dy * 32;
    }
    slot.on = true;
    slot.kind = kind;
    slot.heart = text.endsWith("♡");
    slot.text = slot.heart ? text.slice(0, -1) : text;
    slot.frame = frame;
    slot.x = x;
    slot.y = y;
    slot.t = 0;
    slot.life = kind === 1 ? POP_LIFE : 1.1;
    slot.scale = scale;
    slot.color = color;
  }

  private drawPops(realDt: number): void {
    const r = this.r;
    for (const p of this.pops) {
      if (!p.on) continue;
      p.t += realDt;
      if (p.t >= p.life) {
        p.on = false;
        continue;
      }
      const k = p.t / p.life;
      const pop = p.t < 0.16 ? 2.2 - 1.2 * ease.backOut(p.t / 0.16) : 1;
      const s = p.scale * pop;
      const rot = ((8 * PI) / 180) * Math.sin(p.t * 16) * (1 - k);
      const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const y = p.y - 8 * ease.quadOut(k);
      if (p.kind === 1) {
        const a = this.anims.get("fx_baka");
        const h = a.first + Math.min(p.frame, a.count - 1);
        r.spr(Layer.Text, h, p.x, y, s, s, rot, 0xffffff, alpha, 0, 0);
        continue;
      }
      const ts = Math.max(1, Math.round(s * 2) / 2);
      r.text.draw(p.text, p.x, y, { scale: ts, align: "center", valign: "middle", rotation: rot, layer: Layer.Text, color: p.color, alpha });
      if (p.heart) {
        const tw = r.text.measure(p.text, ts);
        r.spr(Layer.Text, this.hHeart, p.x + tw / 2 + 5 * ts, y, ts * 0.9, ts * 0.9, rot, C.pink, alpha, 0, 0);
      }
    }
  }

  // ================================================================ events
  /** Subscribe to the world's heroFx cues (called from Feedback.bind). Returns the unsubscribers. */
  bind(w: World, o: HeroesABindOpts): (() => void)[] {
    this.w = w;
    this.o = o;
    this.reset();
    return [
      () => {
        this.reset();
        this.o = null;
      },
      w.bus.on("heroFx", (e) => this.cue(e)),
      // Pudding says "Welcome home!" to bosses (she is a professional)
      w.bus.on("bossSpawn", () => {
        if (w.hero.id !== "pudding" || w.phase !== "play") return;
        const p = w.player;
        this.pop(0, "Welcome home, Master~!", 0, p.x, p.y - 40, 1.5, C.pinkLight);
      }),
    ];
  }

  private cue(e: HeroFxEvent): void {
    const w = this.w as World;
    const fx = this.fx;
    const juice = fx.juice;
    const calm = !!this.o?.calm;
    switch (e.kind) {
      // ---------------------------------------------------------- Kuro
      case HFX_KURO_EYE_BEAM:
        this.sfx("beam", 0.5, 7, e.x);
        break;
      case HFX_KURO_JET:
        this.sfx("beamBig", 0.7, 2, e.x);
        fx.ps.emit(darkSparkle, e.x, e.y, 8);
        if (!calm) juice.shake(0.12);
        break;
      case HFX_KURO_MARK:
        fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.violet, 1);
        this.sfx("telegraph", 0.35, 6, e.x);
        break;
      case HFX_KURO_BURST:
        fx.ps.emit(darkSparkle, e.x, e.y, 6);
        fx.ps.emit(P.ring, e.x, e.y, 1, NaN, C.violet, e.r / 16);
        if (this.frameN % 2 === 0) this.sfx("explosion", 0.35, 6, e.x);
        break;
      case HFX_KURO_SHADOW:
        this.shadowT = -e.y2;
        this.shadowDur = e.r;
        this.shadowDir = e.x2 >= 0 ? 1 : -1;
        this.shadowRoared = false;
        this.sfx("dash", 1, -14);
        if (!this.shadowRoared) {
          this.shadowRoared = true;
          this.sfx("bossRoar", 0.45, 7);
        }
        if (!calm) juice.shake(0.25);
        break;
      case HFX_KURO_REVEAL: {
        const p = w.player;
        this.revealT = 0;
        this.revealFlood = e.n;
        this.revealFace = p.face >= 0 ? 1 : -1;
        // in front of him and below the HP bar: clear of the familiars orbiting at body height
        this.revealX = p.x + this.revealFace * 24;
        this.revealY = p.y + 24;
        this.shadowT = -1;
        this.dimK = 0;
        juice.flash(C.white, 0.7, 0.35);
        this.sfx("recordScratch", 0.7);
        break;
      }
      // ---------------------------------------------------------- Pudding
      case HFX_PUD_SPILL:
        // (x, y) where the tea lands - on her path while she moves - and (x2, y2) the cup / teapot it came from
        fx.ps.emit(teaDrop, e.x, e.y + 4, 6);
        fx.ps.emit(teaDrop, e.x2, e.y2, 2);
        fx.ps.emit(steam, e.x, e.y, 1);
        break;
      case HFX_PUD_WARM: {
        // warmed up from cold: an amber ring out of her feet, a couple of hearts; the line at most every 6 s
        fx.ps.emit(P.ringThin, e.x, e.y - 2, 1, NaN, 0xffd27a, 1.1);
        fx.ps.emit(warmSteam, e.x, e.y - 12, 2);
        fx.ps.emit(P.hearts, e.x, e.y - 14, 1, NaN, -1, 0.7);
        if (this.now - this.warmSaidAt > 6) {
          this.warmSaidAt = this.now;
          this.pop(0, "warm tea~♡", 0, e.x, e.y - 40, 1, 0xffd27a);
        }
        this.sfx("teacup", 0.3, 6);
        break;
      }
      case HFX_PUD_SIP:
        if (e.n > 0) fx.dmg.spawn(e.x, e.y - 24, e.n, "heal");
        fx.ps.emit(P.hearts, e.x, e.y - 12, 2, NaN, -1, 0.7);
        fx.ps.emit(steam, e.x, e.y - 4, 1);
        this.sfx("heal", 0.3, 8);
        break;
      case HFX_PUD_SHATTER:
        fx.ps.emit(shard, e.x, e.y - 4, 10);
        fx.ps.emit(teaDrop, e.x, e.y - 2, 10);
        fx.ps.emit(P.ringThin, e.x, e.y - 4, 1, NaN, C.gold, e.r / 16);
        this.sfx("crunch", 0.6, 4, e.x);
        break;
      case HFX_PUD_OMURICE:
        this.omuT = 0;
        this.omuX = e.x;
        this.omuY = e.y;
        this.omuDur = e.r;
        this.omuKetchup = false;
        fx.ps.emit(P.dust, e.x, e.y, 14, NaN, -1, 1.4, 1.6);
        fx.ps.emit(P.ringThin, e.x, e.y - 4, 1, NaN, C.white, 2.2);
        if (!calm) juice.shake(0.25);
        this.sfx("splash", 0.9, -5);
        this.o?.haptic(20);
        break;
      case HFX_PUD_KETCHUP:
        this.omuKetchup = true;
        fx.ps.emit(ketchup, e.x, e.y - 14, 16);
        this.sfx("sparkleCharm", 0.8, 2);
        break;
      case HFX_PUD_PULSE: {
        const last = e.y2 === 1;
        fx.ps.emit(pinkRing, e.x, e.y, 1, NaN, C.pink, e.r / 16);
        fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.pinkLight, e.r / 14);
        fx.ps.emit(heartOut, e.x, e.y, 12);
        if (!calm) {
          juice.shake(last ? 0.45 : 0.25);
          juice.shockwave(e.x, e.y, last ? 1.4 : 0.9, e.r * 2, 0.5);
          if (e.n >= 2) juice.bloomSurge(0.8, 0.6);
        }
        this.sfx("sparkleCharm", 1, e.n * 2);
        this.sfx("explosion", 0.5, 5, e.x);
        this.o?.haptic(last ? 35 : 18);
        break;
      }
      // ---------------------------------------------------------- Aoi
      case HFX_AOI_SALVO:
        fx.ps.emit(smoke, e.x, e.y, e.r ? 8 : 3);
        if (e.r) {
          if (!calm) {
            juice.shake(0.2);
            juice.flash(C.white, 0.2, 0.15);
          }
          fx.speed.radial(0.4, { color: C.lightBlue, intensity: 0.6 });
        }
        break;
      case HFX_AOI_FIST:
        this.sfx("missile", 0.8, -10, e.x);
        break;
      case HFX_AOI_IMPACT:
        fx.ps.emit(P.debris, e.x, e.y - 4, 18);
        fx.ps.emit(P.dust, e.x, e.y, 16, NaN, -1, 1.6, 2.2);
        fx.ps.emit(P.ring, e.x, e.y - 4, 1, NaN, C.lightBlue, e.r / 16);
        if (!calm) {
          juice.shake(0.5);
          juice.shockwave(e.x, e.y, 1.6, e.r * 2.4, 0.6);
          juice.hitstop(45);
        }
        this.o?.haptic(40);
        break;
      case HFX_AOI_ROCKET:
        fx.speed.directional(e.x2 > 0 ? 0 : PI, 0.55, { color: C.white, intensity: 0.9 });
        this.sfx("dash", 1, -6);
        this.sfx("missile", 0.9, -4);
        if (!calm) juice.shake(0.35);
        if (e.n === 0 && this.rocketSaid !== this.frameN) {
          this.rocketSaid = this.frameN;
          const p = w.player;
          this.pop(0, "ROCKET PUNCH!", 0, p.x, p.y - 44, 2, C.yellow);
        }
        break;
      case HFX_AOI_JET:
        if (e.n === 2) {
          this.combinedT = e.r;
          fx.ps.emit(P.rays, e.x, e.y, 14, NaN, C.lightBlue);
          if (!calm) juice.flash(C.lightBlue, 0.25, 0.25);
          this.sfx("powerup", 0.9, 3);
        } else fx.ps.emit(ember, e.x, e.y, 1);
        break;
      // ---------------------------------------------------------- Akane
      case HFX_AKANE_SMACK:
        if (e.n === 2) {
          this.drillT = 0;
          this.drillR = e.r;
          this.sfx("slash", 0.8, 3);
        } else if (e.n === 3) {
          fx.ps.emit(heartOut, e.x, e.y, 10, NaN, -1, 1, 0.9);
          fx.ps.emit(pinkRing, e.x, e.y, 1, NaN, C.hotPink, e.r / 16);
        } else {
          fx.ps.emit(P.rays, e.x, e.y, e.n === 1 ? 10 : 3, e.x2, C.white, 0.8);
          fx.ps.emit(P.dust, e.x, e.y + 6, 2, e.x2);
          if (e.n === 1 && !calm) {
            juice.shake(0.3);
            juice.hitstop(40);
            juice.flash(C.white, 0.18, 0.12);
          }
        }
        break;
      case HFX_AKANE_BAKA: {
        const soft = e.n === 1;
        this.pop(1, "", soft ? 1 : 0, e.x, e.y, e.r || 1, C.white);
        this.sfx("baka", soft ? 0.5 : 0.9, soft ? -3 : 0, e.x);
        // Akane C6: the shout itself hurts
        if (w.hero.id === "akane" && w.cons >= 6) fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.red, 40 / 16);
        break;
      }
      case HFX_AKANE_RING:
        fx.ps.emit(P.ring, e.x, e.y, 1, NaN, C.red, e.r / 16);
        fx.ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.white, e.r / 14);
        if (!calm) {
          juice.shockwave(e.x, e.y, e.n === 2 ? 1.6 : 1, e.r * 2.2, 0.5);
          juice.shake(e.n === 2 ? 0.6 : 0.3);
          if (e.n === 2) juice.flash(C.white, 0.35, 0.2);
        }
        this.sfx("fanSmack", 1, e.n === 2 ? -5 : -2);
        break;
      case HFX_AKANE_BARRAGE:
        fx.ps.emit(bonkStar, e.x, e.y, 5);
        if (!calm && (this.smackSfxN & 1) === 0) juice.shake(0.08);
        if ((this.smackSfxN++ & 1) === 0) this.sfx("fanSmack", 0.45, ((Math.random() * 6) | 0) - 3, e.x);
        break;
      case HFX_AKANE_HEART:
        fx.ps.emit(pinkRing, e.x, e.y, 1, NaN, C.hotPink, e.r / 16);
        fx.ps.emit(heartOut, e.x, e.y, 30, NaN, -1, 1.4, 1.4);
        if (!calm) {
          juice.flash(C.pinkLight, 0.45, 0.4);
          juice.bloomSurge(1.2, 1);
          juice.shockwave(e.x, e.y, 2, e.r * 2, 0.8);
        }
        this.sfx("explosionBig", 0.9, 2);
        this.sfx("heal", 0.8);
        this.pop(0, "...b-baka♡", 0, e.x, e.y - 40, 2, C.pinkLight);
        break;
      case HFX_AKANE_HMPH:
        this.hmphT = 0;
        this.sfx("voiceBlip", 0.8, -4);
        break;
      case HFX_AKANE_BONK:
        if (this.now - this.bonkAt < 0.06) break;
        this.bonkAt = this.now;
        fx.ps.emit(bonkStar, e.x, e.y, 4);
        this.sfx("orbitHit", 0.5, ((Math.random() * 4) | 0) + 2, e.x);
        break;
      // ---------------------------------------------------------- text pops
      case HFX_TEXT: {
        const s = HERO_TEXTS[e.n] ?? "";
        if (!s) break;
        const pink = s.startsWith("MOE") || s.startsWith("KYUN");
        const color = pink ? C.pink : s === "FULL BURST!" ? C.yellow : s === "COMBINED!" ? C.lightBlue : s.startsWith("...it") ? C.lavender : C.white;
        this.pop(0, s, 0, e.x, e.y, clamp(e.r, 1, 3), color);
        break;
      }
      default:
        break;
    }
  }
}
