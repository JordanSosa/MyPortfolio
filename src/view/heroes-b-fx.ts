/**
 * Season 2 heroes, group B - the looks (docs/content/heroes.md §2.8-2.11,
 * weapons.md §2.5-2.8, satire.md §5 pop rules):
 *
 *   Senpai            sparkle aura (10 orbiting twinkles, faint pink disc; Shoujo Filter: four turning
 *                     roses, a screentone dot ring, KIRA KIRA), charmed enemies (a beating heart + a pink
 *                     tint), heartbreak (the heart cracks and falls), Meaningful Glance sparkle lines,
 *                     SENPAI NOTICED YOU: the pink shoujo frame with roses in the corners, swoon hearts,
 *                     two sparkle waves, flustered bosses
 *   Magical Girl #47  the charge ring under her feet (pulses when a Panic Henshin is armed), the henshin
 *                     flash + cast pose, mint bursts, PANIC HENSHIN!, the narrator; the ult's turntable
 *                     spin, stage captions and the "running for four minutes" subtitle
 *   Isekai-kun        the casual cast pose, burning craters on the ground, "Did I overdo it?", the
 *                     STATUS SCREEN window slams (and "9999999" instead of their damage numbers),
 *                     Guild Support arrows
 *   Truck-kun         the vehicle lean / bounce / exhaust / headlights, HONK waves + the fx_honk pop, ram
 *                     impacts, isekai'd light pillars (instead of confetti), ghost trucks centred on their
 *                     lanes with speed lines, the ISEKAI EXPRESS flash
 *
 * Sim -> view through `heroFx` events (kinds in game/weapons/_hb.ts HB) plus per-frame reads of the
 * world (weapon instance data, the charm book, tagged projectiles). Reads the world, never mutates it.
 * No allocation per frame (fixed pools / ring buffers).
 */
import { C } from "../art/palette";
import type { SfxId } from "../audio";
import { TAU, clamp, easeOutBack } from "../core/math";
import { P, type EmitterDef, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import type { HeroFxEvent, HitEvent, KillEvent } from "../game/events";
import { charmRecs } from "../game/weapons/_charm";
import { CRATER, GHOST_TRUCK, HB } from "../game/weapons/_hb";
import { truckState } from "../game/weapons/_truck";
import type { World } from "../game/world";
import type { Anims } from "./anims";
import type { FeedbackHooks } from "./feedback";
import type { WorldTexts } from "./texts";
import { TRAILS, type TrailDef } from "./trails";

const PI = Math.PI;

export interface HeroesBBindOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  calm: boolean;
  hooks?: FeedbackHooks;
}

/** The WorldView bits this module drives (cast pose, hero transform, blast-over-hero beacon). */
export interface HeroesBHost {
  pose(seconds: number): void;
  coverHero(seconds: number): void;
  readonly heroXf: { rot: number; sx: number; sy: number; dy: number };
}

// ---------------------------------------------------------------- emitters / trails
const fireTrail: EmitterDef = {
  sprite: "fx_glow_s",
  frames: "fixed",
  speed: [4, 16],
  life: [0.16, 0.3],
  size: [0.55, 0.12],
  colors: [C.yellow, C.orange, C.red, C.paleYellow],
  gravity: -30,
  additive: true,
  glow: true,
  alphaCurve: "linear",
  layer: Layer.FxAdd,
};
const fireTrailBig: EmitterDef = { ...fireTrail, size: [0.9, 0.2], speed: [8, 26] };
const ribbonTrail: EmitterDef = { ...P.sparkle, speed: [2, 10], life: [0.18, 0.3], size: [0.6, 0.6], colors: [C.mint, C.pinkLight, C.white] };
const roseBits: EmitterDef = { ...P.petals, colors: [C.red, C.pink, C.pinkLight, C.white], speed: [30, 90] };
const charmBits: EmitterDef = { ...P.hearts, speed: [10, 30], life: [0.45, 0.8], size: [0.9, 0.6], colors: [C.pink, C.pinkLight, C.hotPink] };
const mintSpark: EmitterDef = { ...P.sparkle, speed: [30, 110], life: [0.35, 0.7], size: [1.1, 1.1], colors: [C.mint, C.white, C.lightBlue, C.pinkLight] };
const goldSpark: EmitterDef = { ...mintSpark, colors: [C.yellow, C.paleYellow, C.white, C.mint] };
const ember: EmitterDef = { ...P.ember, speed: [6, 18], life: [0.4, 0.8] };
const exhaust: EmitterDef = { ...P.smoke, speed: [6, 18], life: [0.3, 0.55], size: [0.45, 0.85], colors: [C.offWhite, C.lavender] };
const ramBits: EmitterDef = { ...P.debris, speed: [30, 80] };
const pillarSpark: EmitterDef = { ...P.sparkle, speed: [6, 20], angle: -PI / 2, spread: 0.5, life: [0.4, 0.7], colors: [C.paleYellow, C.white, C.aqua] };

const HB_TRAILS: Record<string, TrailDef> = {
  hbFire: { def: fireTrail, every: 1, n: 1, color: C.orange, halo: 9, haloAlpha: 0.32 },
  hbFireBig: { def: fireTrailBig, every: 1, n: 2, color: C.orange, halo: 16, haloAlpha: 0.45 },
  hbRibbon: { def: ribbonTrail, every: 3, n: 1, color: C.mint, halo: 7, haloAlpha: 0.2 },
};
Object.assign(TRAILS, HB_TRAILS);

const STAGE_CAPTIONS = ["RIBBONS!", "SPARKLES!", "SHOES!", "MORE RIBBONS!", "TRANSFORMED!"];
const NARRATOR = "This transformation has been running for four minutes.";
/** Hero ids of this group (per-frame looks only run for them / their weapons). */
const MG47 = "magical_girl_47";
const TRUCK = "truck_kun";

/** One timed visual in a ring buffer. */
interface Tick {
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  n: number;
  t: number;
  life: number;
}
function ring(n: number): Tick[] {
  const out: Tick[] = [];
  for (let i = 0; i < n; i++) out.push({ x: 0, y: 0, x2: 0, y2: 0, r: 0, n: 0, t: 0, life: 0 });
  return out;
}

export class HeroesBFx {
  private w: World | null = null;
  private o: HeroesBBindOpts | null = null;
  private now = 0;
  private readonly hSpark: number;
  private readonly nSpark: number;
  private readonly hCharm: number;
  private readonly hRose: number;
  private readonly hHenshin: number;
  private readonly nHenshin: number;
  private readonly hCrater: number;
  private readonly hPillar: number;
  private readonly nPillar: number;
  private readonly hHonkPop: number;
  private readonly hWave: number;
  private readonly nWave: number;
  private readonly hWindow: number;
  private readonly hTruck: number;
  private readonly nTruck: number;
  private readonly hStreak: number;
  private readonly hPx: number;
  private readonly hRingSoft: number;
  // timed visuals
  private readonly pillars = ring(24);
  private pillarI = 0;
  private readonly pops = ring(3);
  private popI = 0;
  private readonly waves = ring(6);
  private waveI = 0;
  private readonly glances = ring(4);
  private glanceI = 0;
  private readonly arrows = ring(12);
  private arrowI = 0;
  private readonly slams = ring(6);
  private slamI = 0;
  private readonly henshins = ring(3);
  private henshinI = 0;
  // isekai'd marks (uids) for the death filter
  private readonly marks = new Int32Array(64).fill(-1);
  private markI = 0;
  private markLive = 0;
  // rate limits
  private charmSfxAt = -9;
  private panicAt = -9;
  private overdoAt = -9;
  private honkPopAt = -9;
  private ramAt = -9;
  private isekaiSfxAt = -9;
  private heartbreakAt = -9;
  private exhaustAt = 0;
  // ult overlays (-1 = off)
  private frameT = -1;
  private frameLen = 0;
  private mgT = -1;
  private mgLen = 0;
  private spin = 0;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly anims: Anims,
    private readonly texts: WorldTexts,
    private readonly host: HeroesBHost,
  ) {
    const sp = anims.get("fx_spark");
    this.hSpark = sp.first;
    this.nSpark = sp.count;
    this.hCharm = anims.get("fx_charm_heart").first;
    this.hRose = anims.get("fx_rose_big").first;
    const hs = anims.get("fx_henshin");
    this.hHenshin = hs.first;
    this.nHenshin = hs.count;
    this.hCrater = anims.get("fx_crater").first;
    const pl = anims.get("fx_light_pillar");
    this.hPillar = pl.first;
    this.nPillar = pl.count;
    this.hHonkPop = anims.get("fx_honk").first;
    const wv = anims.get("w_honk_wave");
    this.hWave = wv.first;
    this.nWave = wv.count;
    this.hWindow = anims.get("ult_status_window").first;
    const tr = anims.get("truck_kun_run");
    this.hTruck = tr.first;
    this.nTruck = tr.count;
    this.hStreak = r.atlas.handle("fx_streak");
    this.hPx = r.atlas.handle("fx_px");
    this.hRingSoft = r.atlas.handle("fx_ring_soft");
  }

  setWorld(w: World): void {
    this.w = w;
    for (const l of [this.pillars, this.pops, this.waves, this.glances, this.arrows, this.slams, this.henshins]) for (const t of l) t.life = 0;
    this.marks.fill(-1);
    this.markLive = 0;
    this.frameT = this.mgT = -1;
    this.spin = 0;
    const xf = this.host.heroXf;
    xf.rot = 0;
    xf.sx = xf.sy = 1;
    xf.dy = 0;
  }

  private push(list: Tick[], i: number, x: number, y: number, x2: number, y2: number, r: number, n: number, life: number): void {
    const t = list[i % list.length];
    t.x = x;
    t.y = y;
    t.x2 = x2;
    t.y2 = y2;
    t.r = r;
    t.n = n;
    t.t = 0;
    t.life = life;
  }

  // ================================================================ feedback filters
  /** enemyKilled filter (Feedback): an isekai'd enemy leaves a light pillar instead of confetti. */
  death(e: KillEvent): boolean {
    if (this.markLive <= 0) return false;
    const uid = e.enemy.uid;
    const m = this.marks;
    for (let i = 0; i < m.length; i++)
      if (m[i] === uid) {
        m[i] = -1;
        this.markLive--;
        this.push(this.pillars, this.pillarI++, e.x, e.y, 0, 0, e.elite ? 1.6 : 1, 0, 0.55);
        if (this.fx.ps.count < this.fx.ps.capacity * 0.8) this.fx.ps.emit(pillarSpark, e.x, e.y - 10, e.elite ? 8 : 3);
        return true;
      }
    return false;
  }

  /** Damage-number text override (Feedback): STATUS SCREEN!! shows absurd fake numbers. */
  numberText(e: HitEvent): string | null {
    if (e.source !== "status_screen") return null;
    return this.w && this.w.talentRank("isekai_status_expanded") > 0 ? "99999999999" : "9999999";
  }

  // ================================================================ events
  /** Subscribe to the world's heroFx cues (called from Feedback.bind). Returns the unsubscribers. */
  bind(w: World, o: HeroesBBindOpts): (() => void)[] {
    this.o = o;
    const bus = w.bus;
    return [
      () => {
        this.frameT = this.mgT = -1;
      },
      bus.on("heroFx", (e) => this.cue(e, o)),
      bus.on("ultEnd", () => {
        this.mgT = -1;
      }),
    ];
  }

  private cue(e: HeroFxEvent, o: HeroesBBindOpts): void {
    const fx = this.fx;
    const ps = fx.ps;
    const juice = fx.juice;
    const calm = o.calm;
    const texts = this.texts;
    const w = this.w;
    switch (e.kind) {
      // ---------------------------------------------------------- Senpai
      case HB.CHARM: {
        ps.emit(charmBits, e.x, e.y, e.n ? 4 : 3);
        if (e.n) ps.emit(P.sparkle, e.x, e.y, 3, NaN, C.pinkLight, 0.8, 1.2);
        if (this.now - this.charmSfxAt >= 0.3) {
          this.charmSfxAt = this.now;
          o.sfx("sparkleCharm", 0.6, (Math.random() * 4) | 0, e.x);
        }
        break;
      }
      case HB.HEARTBREAK: {
        if (e.n) {
          ps.emit(P.ring, e.x, e.y, 1, NaN, C.pink, e.r / 16);
          ps.emit(charmBits, e.x, e.y, 6, NaN, -1, 1, 1.6);
        }
        if (this.now - this.heartbreakAt >= 0.25) {
          this.heartbreakAt = this.now;
          o.sfx("bubblePop", 0.45, -4, e.x);
        }
        break;
      }
      case HB.KIRA: {
        texts.add("KIRA KIRA", 0, -34, { anchor: 1, scale: 2, color: C.pinkLight, life: 1, rise: 10, wobble: 2 });
        ps.emit(P.ring, e.x, e.y, 1, NaN, C.pink, e.r / 16);
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.white, e.r / 13);
        ps.emit(roseBits, e.x, e.y, 14, NaN, -1, 1, 1.4);
        ps.emit(P.sparkle, e.x, e.y, 12, NaN, C.pinkLight, 1.2, 2);
        if (!calm) juice.bloomSurge(0.4, 0.6);
        this.host.pose(0.5);
        o.sfx("sparkleCharm", 0.9, 5);
        break;
      }
      case HB.GLANCE: {
        this.push(this.glances, this.glanceI++, e.x, e.y, e.x2, e.y2, 0, e.n, 0.35);
        ps.emit(P.flare, e.x2, e.y2, 1, NaN, C.white, 0.8);
        o.sfx("sparkleCharm", 0.7, 7, e.x2);
        break;
      }
      case HB.NOTICED: {
        this.frameT = 0;
        this.frameLen = 3.5;
        if (!calm) {
          juice.bloomSurge(0.3, 3.5);
          juice.flash(C.pinkLight, 0.35, 0.4);
        }
        // every swooned enemy sighs a heart
        if (w)
          for (const rec of charmRecs(w)) {
            if (rec.swoon <= 0 || rec.e.dead) continue;
            ps.emit(charmBits, rec.e.x, rec.e.y - rec.e.cy * 2, 1);
          }
        o.sfx("sparkleCharm", 1, 0);
        o.haptic(30);
        break;
      }
      case HB.SPARKLE_WAVE: {
        const v = this.r.camera.view;
        const R = Math.sqrt(v.w * v.w + v.h * v.h) * 0.55;
        this.push(this.waves, this.waveI++, e.x, e.y, 0, 0, R, e.n, 0.6);
        for (let i = 0; i < 18; i++) ps.emit(P.sparkle, v.x + Math.random() * v.w, v.y + Math.random() * v.h, 1, NaN, i & 1 ? C.white : C.pinkLight, 1.3, 1);
        if (!calm) {
          juice.shake(0.3);
          juice.shockwave(e.x, e.y, 1.2, R * 0.9, 0.6);
        }
        o.sfx("ultBlast", 0.6, 4 + e.n * 3);
        o.sfx("sparkleCharm", 0.8, 2);
        break;
      }
      case HB.FLUSTER: {
        ps.emit(charmBits, e.x, e.y, 6, NaN, -1, 1.4, 1.2);
        texts.add("!!", e.x, e.y - 6, { scale: 2, color: C.pink, life: 0.7, rise: 8 });
        o.sfx("sparkleCharm", 0.8, -3, e.x);
        break;
      }
      case HB.ROSE_BURST: {
        ps.emit(roseBits, e.x, e.y, 8);
        ps.emit(P.ring, e.x, e.y, 1, NaN, C.red, e.r / 16);
        break;
      }
      case HB.VALENTINE: {
        texts.add("VALENTINE'S DAY!", 0, -34, { anchor: 1, scale: 1, color: C.pinkLight, life: 1.4, rise: 10 });
        ps.emit(charmBits, e.x, e.y - 10, 8, NaN, -1, 1.2, 1.4);
        o.sfx("powerup", 0.7, 3);
        break;
      }
      // ---------------------------------------------------------- Magical Girl #47
      case HB.HENSHIN: {
        this.push(this.henshins, this.henshinI++, e.x, e.y, 0, 0, e.n === 3 ? 1 : 0, e.n, Math.max(0.35, e.r));
        this.host.pose(e.r + 0.1);
        ps.emit(e.n === 3 ? goldSpark : mintSpark, e.x, e.y, 8, NaN, -1, 1, 0.8);
        break;
      }
      case HB.PANIC: {
        if (this.now - this.panicAt >= 5) {
          this.panicAt = this.now;
          texts.add("PANIC HENSHIN!", 0, -32, { anchor: 1, scale: 1, color: C.mint, life: 1, rise: 8, wobble: 2 });
        }
        if (!calm) juice.flash(C.mint, 0.2, 0.2);
        o.sfx("bubblePop", 0.8, 6);
        o.haptic(25);
        break;
      }
      case HB.BURST: {
        const evo = (e.n & 2) !== 0;
        // (a soft 64 px ring: the 16 px ring sprites stair-step at burst sizes)
        this.push(this.waves, this.waveI++, e.x, e.y, 0, 0, e.r * 1.1, evo ? -4 : -3, 0.42);
        ps.emit(evo ? goldSpark : mintSpark, e.x, e.y, 12, NaN, -1, 1, 1 + e.r / 60);
        if (e.n & 4) ps.emit(P.sparkle, e.x, e.y, 10, NaN, C.white, 1, 1.8);
        if (!calm) {
          juice.shockwave(e.x, e.y, 0.6, e.r * 1.8, 0.45);
          juice.shake(0.12);
        }
        o.sfx("explosion", 0.45, 7, e.x);
        break;
      }
      case HB.NARRATE_47: {
        const v = this.r.camera.view;
        texts.add("That's the 47th transformation this episode.", 0, Math.round(v.h * 0.3), { anchor: 2, scale: 1, color: C.paleYellow, life: 2.6, rise: 0 });
        o.sfx("narratorSting", 0.6);
        break;
      }
      case HB.TRANSFORM: {
        this.mgT = 0;
        this.mgLen = e.r;
        this.spin = 0;
        if (!calm) juice.bloomSurge(0.5, e.r);
        ps.emit(mintSpark, e.x, e.y - 8, 20, NaN, -1, 1.2, 1.6);
        break;
      }
      case HB.STAGE: {
        const k = e.n;
        const v = this.r.camera.view;
        const R = e.r > 0 ? e.r : Math.sqrt(v.w * v.w + v.h * v.h) * 0.55;
        this.push(this.henshins, this.henshinI++, e.x, e.y, 0, 0, 2 + R / 40, k, 0.45);
        if (R <= 90) {
          ps.emit(P.ring, e.x, e.y, 1, NaN, C.mint, R / 16);
          ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.white, R / 13);
        } else this.push(this.waves, this.waveI++, e.x, e.y, 0, 0, R, -3, 0.7);
        ps.emit(k === 4 ? goldSpark : mintSpark, e.x, e.y, 10 + k * 4, NaN, -1, 1.2, 1 + R / 50);
        texts.add(STAGE_CAPTIONS[k] ?? "", 0, -Math.round(v.h * 0.18), { anchor: 2, scale: k === 4 ? 3 : 2, color: k === 4 ? C.paleYellow : C.mint, rainbow: k === 4, life: 0.9, rise: 6, wobble: 2 });
        if (!calm) {
          juice.flash(k === 4 ? C.white : C.mint, k === 4 ? 0.6 : 0.25, 0.3);
          juice.shake(k === 4 ? 0.7 : 0.25);
          juice.shockwave(e.x, e.y, 1 + k * 0.2, R * 1.6, 0.6);
          if (k === 4) juice.hitstop(90);
        }
        o.sfx("transform", 0.8, k * 2);
        if (k === 4) o.sfx("ultBlast", 0.9);
        o.haptic(k === 4 ? 70 : 20);
        break;
      }
      case HB.FORGOTTEN: {
        texts.add("...who?", 0, -30, { anchor: 1, scale: 1, color: C.lightBlue, life: 0.9, rise: 6 });
        ps.emit(P.ringThin, e.x, e.y, 1, NaN, C.cyan, 1.2);
        o.sfx("bubblePop", 0.6, 3);
        break;
      }
      // ---------------------------------------------------------- Isekai-kun
      case HB.CAST: {
        // one finger raised, completely casual (only standing still: a cast pose would slide while running)
        if (w && !w.player.moving) this.host.pose(0.28);
        break;
      }
      case HB.OVERDO: {
        const meteor = e.n === 1;
        if (!calm) {
          juice.flash(C.white, meteor ? 0.35 : 0.15, meteor ? 0.25 : 0.15);
          juice.shake(meteor ? 0.6 : 0.4);
          juice.shockwave(e.x, e.y, meteor ? 1.6 : 1, e.r * 2, 0.6);
        }
        ps.emit(ember, e.x, e.y, 10, NaN, -1, 1.2, 1.4);
        // "Did I overdo it?" (1 / 8 s), never over the hero
        if (this.now - this.overdoAt >= 8 && w) {
          this.overdoAt = this.now;
          const p = w.player;
          let ty = e.y - e.r * 0.4 - 8;
          if (Math.abs(e.x - p.x) < 40 && Math.abs(ty - (p.y - 10)) < 32) ty = p.y - 46;
          texts.add(meteor ? "...did I overdo it again?" : "Did I overdo it?", e.x, ty, { scale: 1, color: C.paleYellow, life: 1.4, rise: 10 });
        }
        if (w) {
          const p = w.player;
          const dx = e.x - p.x;
          const dy = e.y - (p.y - 8);
          if (dx * dx + dy * dy < (e.r + 10) * (e.r + 10)) this.host.coverHero(0.6);
        }
        o.haptic(meteor ? 50 : 30);
        break;
      }
      case HB.SLAM_TELL: {
        this.push(this.slams, this.slamI++, e.x, e.y, e.x2, e.y2, 0, -1, e.r);
        break;
      }
      case HB.SLAM: {
        this.push(this.slams, this.slamI++, e.x, e.y, e.x2, e.y2, 0, e.n, 0.75);
        if (!calm) {
          juice.shake(0.4);
          juice.flash(C.lightBlue, 0.18, 0.15);
          juice.hitstop(50);
        }
        const v = this.r.camera.view;
        for (let i = 0; i < 8; i++) ps.emit(P.sparkle, v.x + Math.random() * v.w, e.y + (Math.random() * 2 - 1) * e.y2, 1, NaN, i & 1 ? C.white : C.lightBlue, 1.2, 1);
        o.sfx("explosionBig", 0.7, -3);
        o.sfx("uiConfirm", 0.9, -5);
        o.haptic(40);
        break;
      }
      case HB.AGAIN: {
        texts.add("...did I overdo it again?", 0, -32, { anchor: 1, scale: 1, color: C.paleYellow, life: 1.8, rise: 6 });
        break;
      }
      case HB.ARROW: {
        this.push(this.arrows, this.arrowI++, e.x, e.y, e.x2, e.y2, 0, e.n, 0.22);
        if (e.n === 0) o.sfx("starShot", 0.5, -6);
        break;
      }
      // ---------------------------------------------------------- Truck-kun
      case HB.HONK: {
        // e.n: half-angle (0 = 360° ring, -1 = a mini truck's honk)
        if (e.n >= 0) this.push(this.waves, this.waveI++, e.x, e.y, e.x2, e.y2, e.r, e.n === 0 ? -2 : -1, 0.3);
        if (e.n > 0 && w && w.hero.id === TRUCK) this.host.pose(0.22);
        if (this.now - this.honkPopAt >= 1) {
          this.honkPopAt = this.now;
          this.pop(e.x + (e.n >= 0 ? e.x2 * 26 : 0), e.y - 16, e.n >= 0);
        }
        if (e.n < 0) o.sfx("honk", 0.5, 5, e.x);
        if (!calm && e.n >= 0) juice.shake(0.06);
        break;
      }
      case HB.RAM: {
        ps.emit(ramBits, e.x, e.y, Math.min(6, 2 + e.n));
        ps.emit(P.dust, e.x, e.y + 6, 2);
        if (this.now - this.ramAt >= 0.12) {
          this.ramAt = this.now;
          if (!calm) juice.shake(0.08);
          o.sfx("hitCrit", 0.4, -7, e.x);
        }
        break;
      }
      case HB.ISEKAI_MARK: {
        const mi = this.markI++ % this.marks.length;
        if (this.marks[mi] < 0) this.markLive++;
        this.marks[mi] = e.n;
        break;
      }
      case HB.ISEKAI: {
        if (this.now - this.isekaiSfxAt >= 0.12) {
          this.isekaiSfxAt = this.now;
          o.sfx("gem", 0.4, 10, e.x);
        }
        break;
      }
      case HB.LANE_TELL: {
        if (e.n === 1) texts.add("EXPRESS LANE", (e.x + e.x2) / 2, (e.y + e.y2) / 2 - 18, { scale: 1, color: C.yellow, life: 0.6, rise: 4 });
        break;
      }
      case HB.LANE: {
        fx.speed.directional(Math.atan2(e.y2 - e.y, e.x2 - e.x), 0.5, { color: C.aqua, intensity: 0.8 });
        if (!calm) juice.shake(0.25);
        o.sfx("honk", 0.8, 0, e.x);
        o.sfx("dash", 0.7, -4);
        o.haptic(25);
        break;
      }
      case HB.EXPRESS: {
        juice.flash(C.white, 0.4, 0.4);
        if (!calm) juice.shake(0.35);
        this.honkPopAt = -9;
        this.pop(e.x + 18, e.y - 18, true);
        o.sfx("honk", 1, 0);
        o.sfx("honk", 0.9, 2);
        o.haptic(40);
        break;
      }
      default:
        break;
    }
  }

  /** A HONK pop (fx_honk), max 3 alive, never over the hero (`side` shifts it off the body). */
  private pop(x: number, y: number, side: boolean): void {
    const w = this.w;
    if (w) {
      if (w.ult?.phase === "cutin") return;
      const p = w.player;
      const dx = x - p.x;
      const dy = y - (p.y - 10);
      if (dx * dx + dy * dy < 32 * 32) {
        x = p.x + (side ? (dx >= 0 ? 34 : -34) : 0);
        y = p.y - 40;
      }
    }
    this.push(this.pops, this.popI++, x, y, 0, 0, 0, 0, 0.8);
  }

  // ================================================================ per frame
  /** Per frame (WorldView.draw, after the hero). */
  draw(time: number, dt: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.now += realDt;
    const hero = w.hero.id;
    this.drawSenpaiAura(time);
    this.drawCharms(time);
    this.drawHenshin(time, realDt);
    this.drawCraters(time);
    this.drawGhostTrucks(time);
    this.drawTicks(time, realDt);
    // (the hero transform is only driven for this group's heroes; setWorld resets it for everyone else)
    if (hero === TRUCK) this.drawTruck(time, dt);
    else if (hero === MG47) this.drawMg47(time, realDt);
    this.drawOverlays(time, realDt);
  }

  // ---------------------------------------------------------------- Senpai
  private drawSenpaiAura(time: number): void {
    const w = this.w as World;
    const inst = w.hasWeapon("shoujo_filter") ?? w.hasWeapon("who_are_you_again") ?? w.hasWeapon("notice_me_sparkles");
    if (!inst) return;
    const R = inst.data.r ?? 0;
    if (R <= 1) return;
    const r = this.r;
    const p = w.player;
    const cx = p.x;
    const cy = p.y - 8;
    const evo = inst.def.id === "shoujo_filter";
    const breathe = 0.5 + 0.5 * Math.sin(time * 2.4);
    r.circle(Layer.Decal, cx, cy + 3, R, C.pink, (evo ? 0.13 : 0.1) + 0.03 * breathe);
    r.ring(Layer.Decal, cx, cy + 3, R, C.pink, 0.45 + 0.15 * breathe, 0, true);
    r.ring(Layer.FxAdd, cx, cy + 3, R - 2, C.pinkLight, 0.25 + 0.1 * breathe, Flag.Add | Flag.Glow, false);
    // 10 twinkles orbiting at the aura radius
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = time * 1.1 + (i / n) * TAU;
      const f = Math.floor(time * 7 + i * 1.7) % this.nSpark;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R * 0.92;
      r.spr(Layer.FxAdd, this.hSpark + f, x, y, 1.35, 1.35, 0, i & 1 ? C.white : C.pinkLight, 1, 0, Flag.Glow | Flag.NoSnap);
    }
    if (!evo) return;
    // Shoujo Filter: four turning roses on the diagonals, a screentone dot ring, a soft pink bloom
    for (let k = 0; k < 4; k++) {
      const a = time * 0.35 + PI / 4 + (k * PI) / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R * 0.92;
      r.spr(Layer.Fx, this.hRose + (Math.floor(time * 2 + k) % 2), x, y, 1, 1, time * 0.6 + k, 0xffffff, 0.95, 0, Flag.NoSnap);
    }
    const dots = 28;
    for (let i = 0; i < dots; i++) {
      const a = -time * 0.25 + (i / dots) * TAU;
      r.spr(Layer.Fx, this.hPx, cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.76, 0.5, 0.5, 0, C.lavender, 0.55, 0, Flag.NoSnap);
    }
    r.glow(cx, cy, 20, C.pinkLight, 0.16 + 0.05 * Math.sin(time * 3));
    const kira = inst.data.kira ?? 99;
    if (kira < 0.6) r.ring(Layer.FxAdd, cx, cy, R * (0.4 + kira), C.white, 0.6 * (1 - kira / 0.6), Flag.Add | Flag.Glow, true);
  }

  /** Hearts over charmed / swooned / flustered enemies, a pink tint, cracked hearts falling. */
  private drawCharms(time: number): void {
    const w = this.w as World;
    const recs = charmRecs(w);
    if (recs.length === 0) return;
    const r = this.r;
    const cam = r.camera;
    const b = r.batch;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const e = rec.e;
      if (e.dead || e.uid !== rec.uid) continue;
      if (!cam.inView(e.x, e.y - e.cy, 30)) continue;
      const top = e.y - e.z - e.cy * 2 - 4;
      if (rec.charm > 0 || rec.swoon > 0) {
        // the enemy is tinted pink (its own current frame, a translucent pink silhouette on top)
        const def = e.def;
        const a = this.anims.fps(e.skin || def.sprite, def.fps ?? 0);
        const f = Math.floor((e.t + (e.a % 1)) * a.fps) % a.count;
        b.sortKey = e.y + 0.01;
        r.spr(Layer.Entity, a.first + (rec.swoon > 0 ? 0 : f), e.x, e.y - e.z, e.face * e.scale, e.scale, 0, C.pink, rec.swoon > 0 ? 0.38 : 0.34, 1, 0);
        b.sortKey = NaN;
        const beat = 1 + 0.25 * Math.max(0, Math.sin(time * (rec.swoon > 0 ? 7 : 10) + e.uid));
        const s = rec.swoon > 0 ? 1.45 : 1.4;
        // (Focus: a dozen admirers crowding him stacked their hearts over Senpai until he was gone - Who Are You Again?)
        r.spr(Layer.Text, this.hCharm, e.x, top - 1 - Math.sin(time * 3 + e.uid) * 1.2, beat * s, beat * s, 0, 0xffffff, 1, 0, Flag.Glow | Flag.NoSnap | Flag.Focus);
      } else if (rec.vuln > 0) {
        // a flustered boss: a heart pops over it
        const k = Math.min(1, rec.vuln);
        r.spr(Layer.Text, this.hCharm, e.x, top - 6 - Math.sin(time * 4) * 2, 1.8 * k, 1.8 * k, 0, 0xffffff, k, 0, Flag.Glow | Flag.NoSnap);
      }
      if (rec.hb > 0) {
        // heartbroken: the heart cracks (f1) and falls
        const k = 1 - rec.hb / 0.6;
        r.spr(Layer.Text, this.hCharm + 1, e.x + k * 3, top + k * 14, 1, 1, k * 0.6, 0xffffff, 1 - k * 0.8, 0, Flag.NoSnap | Flag.Focus);
      }
    }
  }

  // ---------------------------------------------------------------- Magical Girl #47
  private drawHenshin(time: number, realDt: number): void {
    const w = this.w as World;
    const r = this.r;
    const p = w.player;
    // the charge ring under the feet (12 pips; pulses mint when a Panic Henshin is armed)
    const inst = w.hasWeapon("infinite_henshin_loop") ?? w.hasWeapon("henshin_burst");
    if (inst && !p.dead) {
      const k = inst.data.k ?? 0;
      const hen = inst.data.hen ?? 0;
      const thresh = 0.8 - 0.1 * w.talentRank("mg47_panic_plus");
      const armed = k >= thresh && hen <= 0;
      const n = 12;
      const lit = Math.floor(k * n + 1e-6);
      for (let i = 0; i < n; i++) {
        const a = -PI / 2 + (i / n) * TAU;
        const on = i < lit;
        r.spr(Layer.Decal, this.hPx, p.x + Math.cos(a) * 10, p.y + 1 + Math.sin(a) * 4, 0.5, 0.5, 0, on ? (armed ? C.mint : C.lightBlue) : C.lavender, on ? 0.95 : 0.3, 0, Flag.NoSnap);
      }
      if (armed) r.glow(p.x, p.y - 8, 13 + 2 * Math.sin(time * 9), C.mint, 0.22 + 0.1 * Math.sin(time * 9));
    }
    // henshin flashes (fx_henshin play-once over the hero; ult stages bigger)
    for (const t of this.henshins) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      const f = Math.min(this.nHenshin - 1, Math.floor(k * this.nHenshin));
      const s = t.r >= 2 ? Math.min(3.2, t.r) * (0.7 + 0.3 * k) : 1 + 0.3 * k;
      const col = t.r === 1 ? C.paleYellow : 0xffffff;
      // (the weapon's flash fades over her body - Flag.Focus - and stays a corona around her: on Infinite Henshin
      // Loop it plays every 2.5 s and hid her for half a second each time, 17 % of her contrast left in the key
      // crowd film. The ultimate's stages are a set piece and keep covering her.)
      r.spr(Layer.Fx, this.hHenshin + f, p.x, p.y - 10, s, s, 0, col, t.r >= 2 ? 0.85 * (1 - k) : 1, 0, t.r >= 2 ? Flag.Glow | Flag.NoSnap : Flag.Glow | Flag.NoSnap | Flag.Focus);
    }
  }

  /** The ult turntable: she turns slowly in her cast pose (x scale through 0, flipping). */
  private drawMg47(time: number, realDt: number): void {
    const xf = this.host.heroXf;
    const w = this.w as World;
    if (w.ult && w.ult.phase === "active" && w.ult.def.id === "episode_long_transformation") {
      this.spin += realDt * 2.2;
      const c = Math.cos(this.spin);
      xf.sx = Math.abs(c) < 0.18 ? (c < 0 ? -0.18 : 0.18) : c;
      xf.dy = -2 - Math.sin(time * 3) * 1.5;
      xf.rot = 0;
      xf.sy = 1;
    } else {
      xf.sx = xf.sy = 1;
      xf.rot = 0;
      xf.dy = 0;
    }
  }

  // ---------------------------------------------------------------- Isekai-kun
  private drawCraters(time: number): void {
    const w = this.w as World;
    const r = this.r;
    const items = w.projectiles.items;
    const cam = r.camera;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = items[i];
      if (p.dead || p.update !== CRATER) continue;
      if (!cam.inView(p.x, p.y, p.r + 8)) continue;
      const k = p.age / Math.max(0.01, p.life);
      const f = k < 0.35 ? 0 : k < 0.75 ? 1 : 2;
      const s = (p.r * 2) / 24;
      const a = k > 0.85 ? (1 - k) / 0.15 : 1;
      r.spr(Layer.Decal, this.hCrater + f, p.x, p.y, s, s, 0, 0xffffff, a, 0, Flag.NoSnap);
      if (k < 0.6) {
        r.glow(p.x, p.y - 2, p.r * 0.9, C.orange, (0.35 + 0.1 * Math.sin(time * 12 + p.uid)) * (1 - k / 0.6));
        if ((Math.floor(time * 30) + p.uid) % 6 === 0) this.fx.ps.emit(ember, p.x + (Math.random() - 0.5) * p.r, p.y - 2, 1);
      }
    }
  }

  // ---------------------------------------------------------------- Truck-kun
  /** Ghost trucks (Isekai Rush Hour, ISEKAI EXPRESS): centred on their lane, speed lines behind. */
  private drawGhostTrucks(time: number): void {
    const w = this.w as World;
    const r = this.r;
    const b = r.batch;
    const items = w.projectiles.items;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = items[i];
      if (p.dead || p.update !== GHOST_TRUCK) continue;
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      const ux = p.vx / sp;
      const uy = p.vy / sp;
      const left = ux < -0.01;
      const rot = left ? Math.atan2(uy, ux) - PI : Math.atan2(uy, ux);
      const s = p.scale;
      const f = Math.floor((time + p.uid * 0.13) * 16) % this.nTruck;
      // speed lines streaming behind it
      for (let k = 0; k < 5; k++) {
        const off = (k - 2) * 5 * s;
        const len = (18 + ((k * 7 + Math.floor(time * 40)) % 12)) * s;
        const bx = p.x - ux * 14 * s - uy * off;
        const by = p.y - uy * 14 * s + ux * off;
        b.drawP(Layer.FxAdd, this.hStreak, bx, by, len / 16, 0.6, Math.atan2(-uy, -ux), C.aqua, 0.5, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 0, 2);
      }
      r.glow(p.x, p.y, 16 * s, C.aqua, 0.25);
      b.drawP(Layer.Fx, this.hTruck + f, p.x, p.y, left ? -s : s, s, rot, p.tint, p.alpha, 0.18, Flag.NoSnap, 16, 12);
      if ((Math.floor(time * 60) + p.uid) % 3 === 0) this.fx.ghosts.spawn(this.hTruck + f, p.x - ux * 8, p.y - uy * 8 + 11 * s, left ? -s : s, s, rot, C.aqua, 0.18, 0.35, Layer.FxBelow);
    }
  }

  /** Truck-kun's driving feel: lean into corners, pitch with the heading, bounce, exhaust, headlights. */
  private drawTruck(time: number, dt: number): void {
    const w = this.w as World;
    const st = truckState(w);
    const xf = this.host.heroXf;
    const p = w.player;
    if (!st || p.dead) {
      xf.rot = 0;
      xf.sx = xf.sy = 1;
      xf.dy = 0;
      return;
    }
    const max = 72 * w.stats.moveSpeed;
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const k = clamp(sp / Math.max(1, max), 0, 1.6);
    // nose up when driving up, a lean into the turn, a road bounce at speed
    const pitch = Math.sin(st.hd) * 0.3 * k * p.face;
    const lean = clamp(-st.turn * 0.012, -0.12, 0.12) * p.face;
    xf.rot = clamp(pitch + lean, -0.4, 0.4);
    xf.sx = 1;
    xf.sy = 1 + (k > 0.2 ? 0.04 * Math.sin(time * 26) : 0.02 * Math.sin(time * 40));
    xf.dy = k > 0.2 ? -Math.abs(Math.sin(time * 13)) * 0.8 : 0;
    // exhaust from the rear (more when accelerating), dust from the wheels in hard turns
    this.exhaustAt -= dt;
    if (this.exhaustAt <= 0 && dt > 0) {
      this.exhaustAt = k > 0.2 ? 0.09 : 0.35;
      this.fx.ps.emit(exhaust, p.x - p.face * 15, p.y - 5, 1, p.face > 0 ? PI : 0);
      if (Math.abs(st.turn) > 4 && k > 0.5) this.fx.ps.emit(P.dust, p.x - p.face * 8, p.y, 2);
    }
    // headlights
    this.r.glow(p.x + p.face * 15, p.y - 7, 7, C.paleYellow, 0.3 + 0.08 * Math.sin(time * 7));
  }

  // ---------------------------------------------------------------- timed visuals
  private drawTicks(time: number, realDt: number): void {
    const r = this.r;
    const b = r.batch;
    // light pillars (isekai'd)
    for (const t of this.pillars) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      const f = Math.min(this.nPillar - 1, Math.floor(k * this.nPillar));
      // (a kill fx: fades over the hero like the particles when the enemy died right next to her, SpriteBatch.focus)
      r.spr(Layer.FxAdd, this.hPillar + f, t.x, t.y, t.r, t.r * (0.8 + 0.4 * k), 0, 0xffffff, 1 - k * k, 0, Flag.Add | Flag.Glow | Flag.Focus);
    }
    // honk waves (cone: w_honk_wave scaled to the length; ring: a soft expanding ring) and sparkle waves
    for (const t of this.waves) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      if (t.n === -1) {
        const f = Math.min(this.nWave - 1, Math.floor(k * this.nWave));
        const s = t.r / 32;
        const a = Math.atan2(t.y2, t.x2);
        b.drawP(Layer.FxAdd, this.hWave + f, t.x, t.y, s * (0.6 + 0.6 * k), s * (0.7 + 0.5 * k), a, C.paleYellow, 1 - k * 0.8, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 4, 16);
      } else if (t.n === -2) {
        r.ring(Layer.FxAdd, t.x, t.y, t.r * (0.35 + 0.65 * k), C.yellow, 0.8 * (1 - k), Flag.Add | Flag.Glow, true);
        r.ring(Layer.FxAdd, t.x, t.y, t.r * (0.2 + 0.6 * k), C.white, 0.5 * (1 - k), Flag.Add | Flag.Glow);
        // sound arcs radiating all around (the 360° honk)
        const f = Math.min(this.nWave - 1, Math.floor(k * this.nWave));
        const s = (t.r * 0.45) / 32;
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TAU + 0.3;
          const d = t.r * (0.25 + 0.45 * k);
          b.drawP(Layer.FxAdd, this.hWave + f, t.x + Math.cos(a) * d, t.y + Math.sin(a) * d, s, s, a, C.paleYellow, 0.8 * (1 - k), 0, Flag.Add | Flag.Glow | Flag.NoSnap, 4, 16);
        }
      } else {
        // Senpai's sparkle wave: a white then a pink ring sweeping the view
        // (big view-sized rings use the soft 64 px ring: the 16 px ones turn into stair-steps at this size)
        const ca = t.n === -3 ? C.mint : t.n === -4 ? C.yellow : t.n & 1 ? C.pinkLight : C.white;
        const cb = t.n <= -3 ? C.white : t.n & 1 ? C.white : C.pinkLight;
        const R = Math.max(1, t.r * (t.n <= -3 ? 0.3 + 0.7 * k : k));
        b.drawP(Layer.FxAdd, this.hRingSoft, t.x, t.y, R / 32, R / 32, 0, ca, 0.95 * (1 - k), 0, Flag.Add | Flag.Glow | Flag.NoSnap, 32, 32);
        b.drawP(Layer.FxAdd, this.hRingSoft, t.x, t.y, (R * 0.8) / 32, (R * 0.8) / 32, 0, cb, 0.6 * (1 - k), 0, Flag.Add | Flag.Glow | Flag.NoSnap, 32, 32);
      }
    }
    // HONK pops: 2.2 -> 1 bounce, an 8° wobble, 0.8 s
    for (const t of this.pops) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      const s = k < 0.25 ? 2.2 - 1.2 * easeOutBack(k / 0.25, 2) : 1;
      const rot = Math.sin(t.t * 22) * (8 * PI) / 180;
      const a = k > 0.75 ? (1 - k) / 0.25 : 1;
      r.spr(Layer.Text, this.hHonkPop + (Math.floor(t.t * 12) % 2), t.x, t.y - k * 6, s, s, rot, 0xffffff, a, 0, Flag.NoSnap);
    }
    // Meaningful Glance: a sparkle line from Senpai's eye to the target
    for (const t of this.glances) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      const x1 = t.x + (t.x2 - t.x) * Math.min(1, k * 4);
      const y1 = t.y + (t.y2 - t.y) * Math.min(1, k * 4);
      r.line(Layer.FxAdd, t.x, t.y, x1, y1, 2, C.pinkLight, 0.7 * (1 - k), Flag.Add | Flag.Glow);
      r.line(Layer.FxAdd, t.x, t.y, x1, y1, 1, C.white, 0.9 * (1 - k), Flag.Add | Flag.Glow);
    }
    // Guild Support arrows: a fast streak, then a spark
    for (const t of this.arrows) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        this.fx.ps.emit(P.hit, t.x2, t.y2, 1, NaN, C.paleYellow);
        continue;
      }
      const k = t.t / t.life;
      const ax = t.x + (t.x2 - t.x) * k;
      const ay = t.y + (t.y2 - t.y) * k;
      const ang = Math.atan2(t.y2 - t.y, t.x2 - t.x);
      b.drawP(Layer.FxAdd, this.hStreak, ax, ay, 1.4, 0.7, ang, C.paleYellow, 0.95, 0, Flag.Add | Flag.Glow | Flag.NoSnap, 16, 2);
    }
    void time;
  }

  // ---------------------------------------------------------------- screen overlays
  private drawOverlays(time: number, realDt: number): void {
    const r = this.r;
    const v = r.camera.view;
    const w = this.w as World;
    // STATUS SCREEN!! windows: a faint outline while telegraphed, then the slam (1.2 -> 1) and a fade
    for (const t of this.slams) {
      if (t.life <= 0) continue;
      t.t += realDt;
      if (t.t >= t.life) {
        t.life = 0;
        continue;
      }
      const k = t.t / t.life;
      // (the window spans the visible view: centred on the camera, not on the sim's hero-centred rect)
      const wx = v.x + v.w / 2;
      const sx = (v.w - 6) / 64;
      const sy = Math.max(0.6, (t.y2 * 2 - 4) / 40);
      if (t.n < 0) {
        r.spr(Layer.Overlay, this.hWindow, wx, t.y, sx, sy, 0, 0xffffff, 0.14 + 0.1 * Math.sin(time * 20), 0, Flag.NoSnap);
        continue;
      }
      const pop = k < 0.16 ? 1.2 - 0.2 * easeOutBack(k / 0.16, 1.6) : 1;
      const a = k < 0.55 ? 0.82 : 0.82 * (1 - (k - 0.55) / 0.45);
      r.spr(Layer.Overlay, this.hWindow, wx, t.y, sx * pop, sy * pop, 0, 0xffffff, a, k < 0.08 ? 0.6 : 0, Flag.NoSnap);
    }
    // SENPAI NOTICED YOU: the pink shoujo frame (roses in the corners, twinkles, screentone dots)
    if (this.frameT >= 0) {
      this.frameT += realDt;
      const len = this.frameLen;
      if (this.frameT >= len + 0.4) this.frameT = -1;
      else {
        const k = this.frameT < 0.3 ? this.frameT / 0.3 : this.frameT > len ? 1 - (this.frameT - len) / 0.4 : 1;
        const th = Math.round(Math.max(4, Math.min(v.w, v.h) * 0.035));
        const pk = 0.55 * k;
        r.rect(Layer.Overlay, v.x, v.y, v.w, th, C.pink, pk);
        r.rect(Layer.Overlay, v.x, v.y + v.h - th, v.w, th, C.pink, pk);
        r.rect(Layer.Overlay, v.x, v.y, th, v.h, C.pink, pk);
        r.rect(Layer.Overlay, v.x + v.w - th, v.y, th, v.h, C.pink, pk);
        r.rect(Layer.Overlay, v.x + th, v.y + th, v.w - th * 2, 1, C.white, 0.8 * k);
        r.rect(Layer.Overlay, v.x + th, v.y + v.h - th - 1, v.w - th * 2, 1, C.white, 0.8 * k);
        r.rect(Layer.Overlay, v.x + th, v.y + th, 1, v.h - th * 2, C.white, 0.8 * k);
        r.rect(Layer.Overlay, v.x + v.w - th - 1, v.y + th, 1, v.h - th * 2, C.white, 0.8 * k);
        r.fillView(Layer.Overlay, C.pinkLight, 0.06 * k);
        // screentone dots along the frame
        const step = 9;
        for (let x = v.x + th + 4; x < v.x + v.w - th; x += step) {
          r.spr(Layer.Overlay, this.hPx, x, v.y + th + 4, 0.5, 0.5, 0, C.lavender, 0.6 * k, 0, 0);
          r.spr(Layer.Overlay, this.hPx, x + 4, v.y + v.h - th - 5, 0.5, 0.5, 0, C.lavender, 0.6 * k, 0, 0);
        }
        // roses in the four corners
        const rs = Math.max(1.5, Math.min(v.w, v.h) / 110);
        const inset = 10 * rs;
        for (let c = 0; c < 4; c++) {
          const x = c & 1 ? v.x + v.w - inset : v.x + inset;
          const y = c & 2 ? v.y + v.h - inset : v.y + inset;
          r.spr(Layer.Overlay, this.hRose + (Math.floor(time * 2 + c) % 2), x, y, rs * k, rs * k, Math.sin(time * 1.3 + c) * 0.3, 0xffffff, k, 0, 0);
        }
        // twinkles along the border
        for (let i = 0; i < 14; i++) {
          const u = (i * 0.618 + time * 0.07) % 1;
          const side = i & 3;
          const x = side < 2 ? v.x + u * v.w : side === 2 ? v.x + th * 1.5 : v.x + v.w - th * 1.5;
          const y = side === 0 ? v.y + th * 1.5 : side === 1 ? v.y + v.h - th * 1.5 : v.y + u * v.h;
          const f = Math.floor(time * 8 + i) % this.nSpark;
          r.spr(Layer.Overlay, this.hSpark + f, x, y, 1, 1, 0, i & 1 ? C.white : C.pinkLight, k, 0, Flag.Glow);
        }
      }
    }
    // the transformation narrator: a subtitle plate at the bottom for the whole ult
    if (this.mgT >= 0) {
      this.mgT += realDt;
      if (this.mgT >= this.mgLen + 0.3 || !w.ult) this.mgT = -1;
      else if (this.mgT > 0.4) {
        const k = Math.min(1, (this.mgT - 0.4) / 0.3) * (this.mgT > this.mgLen ? 1 - (this.mgT - this.mgLen) / 0.3 : 1);
        const scale = 1;
        const tw = r.text.measure(NARRATOR, scale);
        // (portrait: under the hero, above the touch buttons; landscape: bottom-left, clear of DASH / OVERDRIVE)
        const land = v.w > v.h;
        const maxW = land ? v.w * 0.66 : v.w - 16;
        const lh = r.text.lineHeight;
        if (tw <= maxW) {
          const y = v.y + (land ? v.h - 26 : v.h * 0.635);
          r.rect(Layer.Overlay, v.x + v.w / 2 - tw / 2 - 5, y - lh / 2 - 3, tw + 10, lh + 6, C.outline, 0.7 * k);
          r.text.draw(NARRATOR, v.x + v.w / 2, y, { scale, color: C.paleYellow, align: "center", valign: "middle", alpha: k, layer: Layer.Overlay });
        } else {
          // narrow portrait view: two lines
          const cut = NARRATOR.indexOf("running");
          const a = NARRATOR.slice(0, cut - 1);
          const c = NARRATOR.slice(cut);
          const w2 = Math.max(r.text.measure(a, scale), r.text.measure(c, scale));
          const y = v.y + (land ? v.h - 30 : v.h * 0.635);
          const cx = land ? v.x + 10 + w2 / 2 : v.x + v.w / 2;
          r.rect(Layer.Overlay, cx - w2 / 2 - 5, y - lh / 2 - 3, w2 + 10, lh * 2 + 6, C.outline, 0.7 * k);
          r.text.draw(a, cx, y, { scale, color: C.paleYellow, align: "center", valign: "middle", alpha: k, layer: Layer.Overlay });
          r.text.draw(c, cx, y + lh, { scale, color: C.paleYellow, align: "center", valign: "middle", alpha: k, layer: Layer.Overlay });
        }
      }
    }
  }
}
