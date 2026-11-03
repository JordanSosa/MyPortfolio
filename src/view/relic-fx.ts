/**
 * Season 2 sim effects -> juice: relic / talent / twist procs (`relicProc`,
 * keyed by effect id with a generic sparkle fallback), shield blocks, Plot
 * Armor saves, Overdrive encores, and the endless "Filler Arc" sequence
 * ("TO BE CONTINUED..." -> record scratch -> "JUST KIDDING - FILLER ARC!")
 * plus its elite waves / boss rematches. Bound by Feedback (one subscriber
 * list per World); effects scheduled with after() run on the view clock and
 * are dropped at run end.
 */
import { C } from "../art/palette";
import type { SfxId } from "../audio";
import { fxFirework, P, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import { RELICS } from "../game/registry";
import type { World } from "../game/world";
import type { FeedbackHooks } from "./feedback";
import type { WorldTexts } from "./texts";

/** Seconds from the final killing blow to "TO BE CONTINUED..." (matches the dawn flash beat). */
export const FILLER_AT = 1.7;
/** Seconds from "TO BE CONTINUED..." to the record scratch + "JUST KIDDING". */
export const FILLER_KID = 1.5;
/**
 * Screen-anchored stamps (PLOT ARMOR!, SAKUGA MODE!, FILLER ARC...) sit this far above the view centre:
 * between the HUD and the combo counter, clear of the hero (who stands at the centre).
 */
const STAMP_Y = -100;
/** A proc's name text shows at most once per id per this many seconds. */
const NAME_EVERY = 6;
/** Filler Arc episode card titles (docs/content/satire.md §2.2). */
const FILLER_TITLES = [
  "The Hot Springs Episode (Off-Screen)",
  "Everyone Goes Shopping",
  "A Day at the Spawn Ring",
  "The Plushies' Side of the Story",
  "Recap of the Recap",
  "Sports Festival (Nobody Wins)",
  "The Episode That Is Just Walking",
  "Christmas Special (In Summer)",
  "Cooking Competition: Omurice Edition",
  "Karaoke Night",
  "Lost in the Fog (There's No Fog)",
  "The Body-Swap Episode (Cancelled)",
  "Clip Show",
  "The Villain's Day Off",
  "A Very Long Staircase",
  "The Gem That Got Away",
  "Ghost Story Night",
  "Rainy Day Indoors (Outdoors)",
  "Everyone Learns a Lesson About Teamwork (Again)",
  "Filler Episode About Filler Episodes",
];

export interface RelicBindOpts {
  sfx(id: SfxId, vol?: number, pitch?: number, x?: number): void;
  haptic(ms: number): void;
  calm: boolean;
  hooks?: FeedbackHooks;
  /** The Filler Arc is under way: hand the music back to the stage's battle theme after `delay` s. */
  battleMusicIn(delay: number): void;
}

export class RelicFx {
  private o: RelicBindOpts | null = null;
  private now = 0;
  private later: { t: number; fn: () => void }[] = [];
  private readonly named = new Map<string, number>();
  /** Filler Arc banner sequence clock (-1 = not playing). */
  private fillerT = -1;
  /** SAKUGA MODE seconds left (gold border + hit sparkles) and this frame's sparkle budget. */
  private sakugaT = 0;
  private sparkBudget = 0;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly texts: WorldTexts,
  ) {}

  setWorld(_w: World): void {
    this.later.length = 0;
    this.named.clear();
    this.fillerT = -1;
    this.sakugaT = 0;
  }

  private after(sec: number, fn: () => void): void {
    this.later.push({ t: this.now + sec, fn });
  }

  /** Per frame (WorldView.draw): scheduled effects, the Filler Arc freeze-frame, the SAKUGA MODE border. */
  draw(time: number, realDt: number): void {
    this.now += realDt;
    this.sparkBudget = 6;
    if (this.sakugaT > 0) {
      this.sakugaT = Math.max(0, this.sakugaT - realDt);
      const v = this.r.camera.view;
      const a = (0.35 + 0.25 * Math.sin(time * 9)) * Math.min(1, this.sakugaT * 2);
      const t = 3;
      this.r.rect(Layer.Overlay, v.x, v.y, v.w, t, C.yellow, a, Flag.Add | Flag.Glow);
      this.r.rect(Layer.Overlay, v.x, v.y + v.h - t, v.w, t, C.yellow, a, Flag.Add | Flag.Glow);
      this.r.rect(Layer.Overlay, v.x, v.y, t, v.h, C.yellow, a, Flag.Add | Flag.Glow);
      this.r.rect(Layer.Overlay, v.x + v.w - t, v.y, t, v.h, C.yellow, a, Flag.Add | Flag.Glow);
    }
    if (this.later.length) {
      for (let i = this.later.length - 1; i >= 0; i--) {
        const l = this.later[i];
        if (this.now >= l.t) {
          this.later.splice(i, 1);
          l.fn();
        }
      }
    }
    if (this.fillerT >= 0) {
      this.fillerT += realDt;
      // "TO BE CONTINUED" freeze-frame: a sepia-ish dim + letterbox bars until the punchline
      const t = this.fillerT - FILLER_AT;
      if (t >= 0 && t < FILLER_KID) {
        const k = Math.min(1, t * 4);
        const v = this.r.camera.view;
        const bar = Math.round(v.h * 0.09 * k);
        this.r.fillView(Layer.Overlay, 0x3b2a1a, 0.18 * k);
        this.r.rect(Layer.Overlay, v.x, v.y, v.w, bar, C.outline, 0.92);
        this.r.rect(Layer.Overlay, v.x, v.y + v.h - bar, v.w, bar, C.outline, 0.92);
      } else if (t >= FILLER_KID + 4) this.fillerT = -1;
    }
    void time;
  }

  /** Subscribe to the world's Season 2 events (called from Feedback.bind). Returns the unsubscribers. */
  bind(w: World, o: RelicBindOpts): (() => void)[] {
    this.o = o;
    const bus = w.bus;
    const fx = this.fx;
    const juice = fx.juice;
    return [
      () => {
        this.later.length = 0;
        this.fillerT = -1;
      },
      bus.on("relicProc", (e) => this.proc(e.id, e.x, e.y, e.v)),
      bus.on("enemyHit", (e) => {
        // SAKUGA MODE: every hit sparkles (budgeted per frame)
        if (this.sakugaT > 0 && this.sparkBudget-- > 0) fx.ps.emit(P.sparkle, e.x, e.y, 2, NaN, C.yellow, 0.9, 1.2);
      }),
      bus.on("fillerEpisode", (e) => {
        o.hooks?.banner?.("info", `FILLER EPISODE ${e.n}`, FILLER_TITLES[(e.n - 1) % FILLER_TITLES.length]);
        o.sfx("narratorSting", 0.8);
      }),
      bus.on("shieldBlock", (e) => {
        fx.ps.emit(P.ringThin, e.x, e.y - 9, 1, NaN, C.cyan, 1.4);
        fx.ps.emit(P.sparkle, e.x, e.y - 9, 10, NaN, C.cyan, 1.2, 1.6);
        this.texts.add(e.left > 0 ? "BLOCK!" : "SHIELD BREAK!", 0, -26, { anchor: 1, color: C.cyan, scale: 1, life: 0.8, rise: 8 });
        o.sfx("bubblePop", 0.9, -3);
        if (!o.calm) juice.shake(0.12);
        o.haptic(20);
      }),
      bus.on("plotArmor", (e) => {
        juice.flash(C.white, 0.7, 0.6);
        if (!o.calm) {
          juice.hitstop(160);
          juice.slowmo(0.3, 0.8);
          juice.shockwave(e.x, e.y - 8, 1.6, 140, 0.8);
        }
        fx.speed.radial(0.9, { color: C.paleYellow, intensity: 0.9 });
        fx.ps.emit(P.rays, e.x, e.y - 10, 22, NaN, C.paleYellow, 1.3, 1.6);
        this.texts.add("PLOT ARMOR!", 0, STAMP_Y, { anchor: 2, scale: 3, rainbow: true, life: 1.8, wobble: 2 });
        this.texts.add("the main character can't die yet", 0, STAMP_Y + 20, { anchor: 2, scale: 1, color: C.paleYellow, life: 1.6, delay: 0.25 });
        o.sfx("revive");
        o.haptic(90);
      }),
      bus.on("ultEncore", (e) => {
        this.texts.add("ENCORE!", 0, STAMP_Y, { anchor: 2, scale: 3, rainbow: true, life: 1.4, wobble: 3 });
        fx.ps.emit(P.confetti, e.x, e.y - 16, 30, NaN, -1, 1.2, 1.6);
        if (!o.calm) juice.flash(C.pinkLight, 0.5, 0.4);
        o.sfx("ultBlast", 0.8, 3);
      }),
      bus.on("fillerArc", () => this.fillerArc()),
      bus.on("fillerWave", (e) => {
        if (e.kind === "elite") o.hooks?.banner?.("elite", "FILLER EPISODE!", `${e.n} elites missed their cue`);
        else o.hooks?.banner?.("warning", "REMATCH!", "the budget ran out for new villains");
        o.sfx("narratorSting", 0.7);
      }),
    ];
  }

  /** The endless continuation's banner sequence (the final boss's death throes play first). */
  private fillerArc(): void {
    const o = this.o;
    if (!o) return;
    const fx = this.fx;
    const juice = fx.juice;
    this.fillerT = 0;
    this.after(FILLER_AT, () => {
      this.texts.add("TO BE CONTINUED...", 0, STAMP_Y, { anchor: 2, scale: 2, color: C.paleYellow, life: FILLER_KID + 0.1, rise: 0 });
      o.sfx("toBeContinued");
    });
    this.after(FILLER_AT + FILLER_KID, () => {
      o.sfx("recordScratch");
      juice.flash(C.white, 0.8, 0.5);
      if (!o.calm) {
        juice.shake(0.7);
        juice.aberration(2);
        juice.zoomPunch(0.06);
      }
      fx.speed.radial(1.2, { color: C.pinkLight, intensity: 1 });
      this.texts.add("JUST KIDDING!", 0, STAMP_Y - 18, { anchor: 2, scale: 2, color: C.pink, life: 3, wobble: 2, rise: 2 });
      this.texts.add("...IN THE FILLER ARC!", 0, STAMP_Y + 4, { anchor: 2, scale: 2, rainbow: true, life: 3.4, wobble: 3, rise: 3, delay: 0.15 });
      this.texts.add("the stage counts as cleared. the run goes on", 0, STAMP_Y + 22, { anchor: 2, scale: 1, color: C.paleYellow, life: 3, delay: 0.5, rise: 2 });
      // the HUD card waits for the stamp to clear (never two headlines at once)
      this.after(3.6, () => o.hooks?.banner?.("info", "FILLER ARC", "endless - rewards keep counting"));
      const v = this.r.camera.view;
      for (let i = 0; i < 8; i++) this.after(0.2 + i * 0.22, () => fxFirework(fx, v.x + 20 + Math.random() * (v.w - 40), v.y + 24 + Math.random() * v.h * 0.4));
      o.haptic(80);
      o.battleMusicIn(1.2);
    });
  }

  /** A relic / talent / twist effect fired (`v`: the effect's value, e.g. a duration or radius). */
  private proc(id: string, x: number, y: number, v: number): void {
    const o = this.o;
    if (!o) return;
    const fx = this.fx;
    const juice = fx.juice;
    switch (id) {
      // ---- relics
      case "acrylic_stand":
        fx.ps.emit(P.sparkle, x, y - 6, 6, NaN, C.pink, 1, 1.2);
        return;
      case "rubber_duck":
        fx.ps.emit(P.ringThin, x, y, 1, NaN, C.yellow, 0.8);
        if (this.rate("duck", 0.12)) o.sfx("bubblePop", 0.6, 9, x);
        return;
      case "instant_ramen":
        this.texts.add("THREE MINUTES!", 0, -30, { anchor: 1, scale: 1, color: C.paleYellow, life: 1.2, rise: 10 });
        fx.ps.emit(P.hearts, x, y, 8, NaN, -1, 1, 1.3);
        o.sfx("food");
        return;
      case "festival_goldfish":
        // a splash ring the size of the slow area + droplets
        fx.ps.emit(P.ringThin, x, y, 1, NaN, C.aqua, (v || 48) / 16);
        fx.ps.emit(P.sparkle, x, y, 14, NaN, C.aqua, 1.2, 1.8);
        o.sfx("splash", 0.7);
        this.name(id, C.aqua);
        return;
      case "sentai_badge": {
        const cols = [0xff4d6d, 0x4fa8ff, 0xffe14d, 0x7be36b, 0xff8fd0];
        for (let i = 0; i < 5; i++) this.after(i * 0.06, () => fx.ps.emit(P.ring, x, y, 1, NaN, cols[i], 2.4 + i * 0.6));
        fx.ps.emit(P.rays, x, y, 20, NaN, -1, 1.4, 1.6);
        if (!o.calm) juice.shake(0.5);
        this.texts.add("SENTAI!", 0, STAMP_Y, { anchor: 2, scale: 2, rainbow: true, life: 1.2, wobble: 2 });
        o.sfx("explosionBig", 0.8);
        return;
      }
      case "time_skip_clock":
        this.texts.add("TWO YEARS LATER...", 0, STAMP_Y, { anchor: 2, scale: 2, color: C.paleYellow, life: 2.2, rise: 0 });
        fx.ps.emit(P.ring, x, y, 1, NaN, C.cyan, 3);
        if (!o.calm) juice.flash(C.lavender, 0.4, 0.6);
        o.sfx("freeze");
        return;
      case "sakuga_cel":
        // SAKUGA MODE: a gold border pulses for its duration; every hit sparkles (enemyHit, below)
        this.sakugaT = Math.max(this.sakugaT, v || 5);
        this.texts.add("SAKUGA MODE!", 0, STAMP_Y, { anchor: 2, scale: 2, rainbow: true, life: 1.4, wobble: 2 });
        fx.speed.radial(0.6, { color: C.yellow, intensity: 0.7 });
        o.sfx("powerup");
        return;
      // ---- talents / constellations
      case "hoshi_guardian_stars":
        fx.ps.emit(P.sparkle, x, y, 4, NaN, C.yellow, 0.9, 1);
        return;
      case "rin_sacred_ground":
        fx.ps.emit(P.ring, x, y, 1, NaN, C.red, 4.4);
        fx.ps.emit(P.petals, x, y, 16, NaN, -1, 1.2, 2);
        this.texts.add("SACRED GROUND", 0, -28, { anchor: 1, scale: 1, color: C.pinkLight, life: 1.4, rise: 10 });
        return;
      // ---- Plot Twist: Shounen Rival
      case "rival_recolour":
        this.texts.add("YOUR RIVAL (RECOLOUR) APPEARS!", 0, STAMP_Y + 8, { anchor: 2, scale: 1, color: C.red, life: 2.2, wobble: 2, rise: 4 });
        o.hooks?.banner?.("incoming", "RIVAL!", "\"I'll never lose to you!\"");
        fx.ps.emit(P.smoke, x, y - 8, 4, NaN, -1, 1.2);
        o.sfx("bossRoar", 0.5, 7);
        return;
      case "rival_recolour_down":
        this.texts.add("Next time... for sure!", x, y, { scale: 1, color: C.red, life: 1.6, rise: 12 });
        return;
      default:
        fx.ps.emit(P.sparkle, x, y, 10, NaN, -1, 1.1, 1.6);
        fx.ps.emit(P.ringThin, x, y, 1, NaN, C.pinkLight, 1.5);
        this.name(id, C.pinkLight);
    }
  }

  /** True at most once per `every` seconds per key (sfx spam guard). */
  private rate(key: string, every: number): boolean {
    const last = this.named.get(`#${key}`) ?? -1e9;
    if (this.now - last < every) return false;
    this.named.set(`#${key}`, this.now);
    return true;
  }

  /** The relic's name as a small rising tag over the hero (rate-limited per id). */
  private name(id: string, color: number): void {
    const last = this.named.get(id) ?? -1e9;
    if (this.now - last < NAME_EVERY) return;
    this.named.set(id, this.now);
    const def = RELICS.get(id);
    if (!def) return;
    this.texts.add(def.name.toUpperCase(), 0, -30, { anchor: 1, scale: 1, color, life: 1.2, rise: 10 });
  }
}
