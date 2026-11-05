/**
 * Relic ("Merch") visuals beyond the generic proc sparkle (docs/content/relics.md):
 * the per-relic flourishes of the Season 2 merch line, the NANI?! pop
 * (satire.md §5), and the persistent looks the sim state implies:
 *
 *   per frame (`draw`, from RelicFx.draw):
 *     A Real Friend      your hero's sprites (idle / run / cast) with a 1-px pink outline, a floating heart,
 *                        a spawn-in sparkle; "FRIEND!" cheers on the hero's Overdrive
 *     Red String of Fate a sagging red thread from the hero's pinky to the tied enemy, a bow on the target
 *     Rival Plushie      a red "!" over every marked enemy
 *     SECOND WIND        (The Hero's Revival Theme) a crimson-gold border pulse while it lasts
 *     transformations    Transformation Brooch / Sacred Plot Device auras around the hero
 *     NANI?!             the fx_nani pop (2.2 -> 1 bounce, 8° wobble, 0.8 s, one on screen, never on the hero)
 *   events (`proc`, from RelicFx.proc): relicProc ids -> particles, stamps, sfx (returns false for ids it
 *   doesn't own, so RelicFx keeps its own cases and the generic fallback).
 *
 * "Reduce flashing" / attract mode (`calm`): no shakes, no full-screen flashes; borders become a corner glow.
 * No per-frame allocations: fixed fields, module-scope scratch.
 */
import { C } from "../art/palette";
import { rainbow } from "../core/color";
import { P, type Fx } from "../fx";
import { Flag, Layer } from "../render/layers";
import type { Renderer } from "../render/renderer";
import { CFG } from "../game/config";
import { friendOf } from "../game/relics/_friend";
import { rivalMarked, WIG_NAMES } from "../game/relics/sr";
import { redStringTarget } from "../game/relics/ssr";
import type { World } from "../game/world";
import { Anims } from "./anims";
import type { RelicBindOpts } from "./relic-fx";
import type { WorldTexts } from "./texts";

/** Pink outline offsets (1 px) for the Friend. */
const OUT_X = [1, -1, 0, 0];
const OUT_Y = [0, 0, 1, -1];
const NANI_LIFE = 0.8;
/** Gold-and-glitch palette of the Infinite Gacha Credit Card. */
const CARD_GLITCH = [C.yellow, C.cyan, C.violet, C.white];

function stampY(viewH: number): number {
  return -Math.round(Math.max(48, Math.min(100, viewH * 0.24)));
}

export class MerchFx {
  private w: World | null = null;
  private o: RelicBindOpts | null = null;
  private readonly anims: Anims;
  private now = 0;
  private readonly last = new Map<string, number>();
  /** Equipped relic flags for the per-frame looks (resolved once per world). */
  private hasRival = false;
  private hasWind = false;
  // timed looks (view clock, seconds left)
  private windT = 0;
  private formT = 0;
  private plotT = 0;
  private sparkBudget = 0;
  // the NANI?! pop (one on screen at a time)
  private naniOn = false;
  private naniX = 0;
  private naniY = 0;
  private naniT = 0;
  // Friend sprite handles (the hero's anims)
  private fIdle = 0;
  private fIdleN = 1;
  private fIdleFps = 6;
  private fRun = 0;
  private fRunN = 1;
  private fCast = 0;
  private fCastN = 1;
  private hHeart = 0;
  private hNani = 0;
  private hNaniN = 1;
  private gust = 0;
  /** The Friend's attack pose (view seconds left) after its weapon fired. */
  private friendFireT = 0;

  constructor(
    private readonly r: Renderer,
    private readonly fx: Fx,
    private readonly texts: WorldTexts,
  ) {
    this.anims = new Anims(r);
    this.hHeart = r.atlas.handle("fx_heart");
    const n = this.anims.get("fx_nani");
    this.hNani = n.first;
    this.hNaniN = n.count;
  }

  setWorld(w: World): void {
    this.w = w;
    this.last.clear();
    this.windT = this.formT = this.plotT = 0;
    this.naniOn = false;
    this.queued.on = false;
    this.stampFree = 0;
    const ids = w.run.relics;
    this.hasRival = ids.some((r) => r.id === "rival_plushie");
    this.hasWind = ids.some((r) => r.id === "wind_machine");
    const id = w.hero.sprite;
    const a = this.anims;
    const idle = a.get(`${id}_idle`);
    const run = a.get(`${id}_run`);
    const cast = a.get(`${id}_cast`);
    this.fIdle = idle.first;
    this.fIdleN = Math.max(1, idle.count);
    this.fIdleFps = idle.fps || 6;
    this.fRun = run.first;
    this.fRunN = Math.max(1, run.count);
    this.fCast = cast.first;
    this.fCastN = Math.max(1, cast.count);
  }

  bind(o: RelicBindOpts): void {
    this.o = o;
  }

  /** Run end / unbind: drop the timed looks. */
  reset(): void {
    this.windT = this.formT = this.plotT = 0;
    this.naniOn = false;
    this.queued.on = false;
  }

  /**
   * A weapon fired (feedback's weaponFire): when it is the Friend's (fired from the Friend's spot -
   * the sim swaps the hero's position while the Friend's weapon acts), a quick attack pose + sparkle,
   * so the Friend visibly fights even with weapons whose persistent looks follow the hero.
   */
  weaponFire(x: number, y: number): void {
    const w = this.w;
    if (!w) return;
    const f = friendOf(w);
    if (!f || Math.abs(x - f.x) > 0.5 || Math.abs(y - f.y) > 0.5) return;
    this.friendFireT = 0.2;
    if (this.sparkBudget-- > 0) this.fx.ps.emit(P.sparkle, f.x + f.face * 6, f.y - 12, 3, NaN, C.pinkLight, 0.8, 0.9);
  }

  /** True at most once per `every` seconds per key. */
  private rate(key: string, every: number): boolean {
    const l = this.last.get(key) ?? -1e9;
    if (this.now - l < every) return false;
    this.last.set(key, this.now);
    return true;
  }

  /**
   * A screen stamp ("SECOND WIND!" + a sub line). Never two headlines at once: while one is up, the
   * newest waits for it (one pending slot; a newer stamp replaces an older pending one).
   */
  private stamp(text: string, sub: string, color: number, rainbowText = false, life = 1.6): void {
    if (this.now < this.stampFree) {
      const q = this.queued;
      q.on = true;
      q.text = text;
      q.sub = sub;
      q.color = color;
      q.rainbow = rainbowText;
      q.life = life;
      return;
    }
    const y = stampY(this.r.camera.view.h);
    this.texts.add(text, 0, y, { anchor: 2, scale: 2, color, rainbow: rainbowText, life, wobble: 2 });
    if (sub) this.texts.add(sub, 0, y + 20, { anchor: 2, scale: 1, color: C.paleYellow, life: life - 0.2, delay: 0.2 });
    this.stampFree = this.now + life;
  }
  private stampFree = 0;
  private readonly queued = { on: false, text: "", sub: "", color: 0, rainbow: false, life: 1 };

  private tag(text: string, color: number, life = 1.2): void {
    this.texts.add(text, 0, -30, { anchor: 1, scale: 1, color, life, rise: 10 });
  }

  // ================================================================ procs
  /** A relicProc this module owns. Returns false for ids it doesn't handle. */
  proc(id: string, x: number, y: number, v: number): boolean {
    const o = this.o;
    const w = this.w;
    if (!o || !w) return false;
    const ps = this.fx.ps;
    const juice = this.fx.juice;
    const calm = o.calm;
    switch (id) {
      case "nani":
        this.nani(x, y);
        return true;
      // ---------------------------------------------------------- R
      case "pocket_tissues":
        ps.emit(P.smoke, x, y, 3, NaN, C.white, 0.7, 0.6);
        if (this.rate(id, 2)) this.tag("*sniff* (-50%)", C.lightBlue);
        o.sfx("bubblePop", 0.5, -4);
        return true;
      case "lucky_cat":
        ps.emit(P.coins, x, y, 10, NaN, -1, 1, 1.3);
        this.tag("THE CAT WAVED!", C.yellow, 1.4);
        return true;
      // ---------------------------------------------------------- SR
      case "rival_plushie":
        if (this.sparkBudget-- > 0) ps.emit(P.sparkle, x, y, 2, NaN, C.red, 0.8, 0.8);
        return true;
      case "oversized_sword_keychain":
        // the keychain is primed: a glint on the hero
        ps.emit(P.sparkle, x + 6, y - 2, 4, NaN, C.cyan, 1, 0.8);
        ps.emit(P.ringThin, x, y, 1, NaN, C.cyan, 0.8);
        return true;
      case "oversized_sword_keychain_hit":
        ps.emit(P.rays, x, y, 14, NaN, C.cyan, 1.3, 1.6);
        ps.emit(P.ring, x, y, 1, NaN, C.white, 1.8);
        if (!calm) juice.shake(0.25);
        o.sfx("slash", 0.8, -5, x);
        return true;
      case "cosplay_wig": {
        const name = WIG_NAMES[Math.max(0, Math.min(WIG_NAMES.length - 1, Math.round(v)))] ?? "???";
        this.stamp(`TODAY'S WIG: ${name}!`, "(it's supposed to be pink)", C.lightBlue, true, 2);
        ps.emit(P.confetti, x, y, 18, NaN, -1, 1, 1.3);
        o.sfx("powerup", 0.8);
        return true;
      }
      case "mascot_head":
        ps.emit(P.smoke, x, y, 4, NaN, C.paleYellow, 1, 0.8);
        if (this.rate(id, 1)) this.tag("BOING! (1 damage)", C.paleYellow);
        o.sfx("bubblePop", 0.7, -8);
        return true;
      case "pity_keychain":
        this.tag(`PITY PAID OUT! (+${Math.round(v)}%)`, C.pink, 1.6);
        ps.emit(P.sparkle, x, y, 12, NaN, C.pink, 1.1, 1.4);
        return true;
      case "shonen_headband":
        ps.emit(P.ember, x, y + 4, 14, NaN, C.red, 1.2, 1.4);
        if (this.rate(id, 8)) this.tag("NOT... YET...!", C.red, 1.4);
        o.sfx("rankUp", 0.6, -3);
        return true;
      case "compact_mirror":
        ps.emit(P.ringThin, x, y, 1, NaN, C.pink, 1.2);
        ps.emit(P.sparkle, x, y, 5, NaN, C.pinkLight, 1, 1.2);
        if (this.rate(id, 0.25)) o.sfx("bubblePop", 0.5, 7, x);
        return true;
      case "magnifying_glass":
        this.texts.add("THE CULPRIT: A CHEST!", x, y - 6, { scale: 1, color: C.yellow, life: 1.4, rise: 12 });
        ps.emit(P.sparkle, x, y, 10, NaN, C.yellow, 1, 1.3);
        return true;
      // ---------------------------------------------------------- SSR
      case "transformation_brooch":
        this.formT = Math.max(this.formT, v || 8);
        this.stamp("TRANSFORMATION COMPLETE!", "+might, +speed (batteries not included)", C.pinkLight, true, 1.6);
        ps.emit(P.hearts, x, y, 16, NaN, -1, 1.2, 1.6);
        ps.emit(P.ring, x, y, 1, NaN, C.pinkLight, 2.4);
        o.sfx("transform", 0.8);
        return true;
      case "abandoned_headband":
        this.tag(`RIVAL'S RESOLVE: +${Math.round(v)}% MIGHT`, C.orange, 1.8);
        ps.emit(P.ember, x, y, 16, NaN, C.orange, 1.2, 1.5);
        return true;
      case "sakura_snow_globe": {
        // a petal storm across the whole view + a pink wash
        const vw = this.r.camera.view;
        for (let i = 0; i < 28; i++) ps.emit(P.petals, vw.x + Math.random() * vw.w, vw.y + Math.random() * vw.h, 1, NaN, -1, 1.2, 1.4);
        ps.emit(P.ring, x, y, 1, NaN, C.pinkLight, 5);
        if (!calm) juice.flash(C.pinkLight, 0.25, 0.4);
        if (this.rate(id, 30)) this.tag("SHAKE SHAKE!", C.pinkLight);
        o.sfx("slash", 0.7, 4);
        return true;
      }
      case "season_finale_manga":
        this.stamp("SEASON FINALE!", "this level-up: PICK 2 CARDS", C.yellow, true, 2.2);
        ps.emit(P.confetti, x, y, 24, NaN, -1, 1.2, 1.5);
        o.sfx("narratorSting", 0.7);
        return true;
      case "isekai_status_card":
        if (this.rate(id, 0.8)) this.texts.add(`STATUS UPDATED: MIGHT +${v}%`, 0, -42, { anchor: 1, scale: 1, color: C.lightBlue, life: 1.3, rise: 8 });
        return true;
      case "screentone_sheet":
        if (this.sparkBudget-- > 0) {
          ps.emit(P.sparkle, x, y, 6, NaN, C.paleYellow, 1, 1.3);
          ps.emit(P.ringThin, x, y, 1, NaN, C.white, 1.25);
        }
        return true;
      case "red_string_of_fate":
        if (this.rate(id, 0.15)) ps.emit(P.hearts, x, y, 2, NaN, C.red, 0.8, 0.8);
        return true;
      // ---------------------------------------------------------- UR
      case "unopened_figure":
        this.tag("OPENED! (-66% VALUE)", C.lavender, 1.6);
        ps.emit(P.debris, x, y, 8, NaN, C.offWhite, 1, 1.2);
        o.sfx("uiDeny", 0.6);
        return true;
      case "directors_cut":
        this.stamp("DIRECTOR'S CUT!", `+1 golden chest · +${Math.round(v)}% might`, C.yellow, false, 1.8);
        ps.emit(P.rays, x, y, 18, NaN, C.yellow, 1.3, 1.5);
        o.sfx("chestJackpot", 0.7);
        return true;
      case "hot_blooded_bandana":
        ps.emit(P.ember, x, y + 6, 18, NaN, C.orange, 1.3, 1.6);
        if (this.rate(id, 6)) this.tag(v >= 5 ? "MAXIMUM HOT BLOOD!" : "FIRED UP!", C.orange, 1.3);
        return true;
      case "sacred_plot_device":
        if (v > 0) this.plotT = Math.max(this.plotT, v);
        ps.emit(P.rays, x, y, 12, NaN, C.yellow, 1.1, 1.3);
        if (this.rate(id, 4)) this.tag("THE PLOT DEMANDS IT!", C.yellow, 1.3);
        return true;
      // ---------------------------------------------------------- LR
      case "original_manuscript":
        this.stamp("AUTHOR'S DRAFT!", `start weapon Lv ${Math.round(v)} (the better ending)`, C.paleYellow, true, 2.2);
        for (let i = 0; i < 3; i++) ps.emit(P.confetti, x + (i - 1) * 10, y, 8, NaN, C.offWhite, 1.1, 1.2);
        o.sfx("narratorSting", 0.7);
        return true;
      case "revival_theme":
        this.windT = Math.max(0.5, v || 6);
        this.stamp("SECOND WIND!", "cue the opening theme. +50% might", C.red, true, 2);
        ps.emit(P.rays, x, y, 26, NaN, C.yellow, 1.5, 1.8);
        ps.emit(P.ember, x, y, 24, NaN, C.red, 1.4, 1.6);
        if (!calm) {
          juice.flash(C.yellow, 0.5, 0.5);
          juice.shockwave(x, y, 1.4, 120, 0.7);
        }
        this.fx.speed.radial(1, { color: C.yellow, intensity: 0.9 });
        o.sfx("unlockFanfare", 0.8);
        o.haptic(60);
        return true;
      case "last_budget":
        this.stamp("BUDGET: ALL OF IT", `x${v.toFixed(1)} ultimate damage`, C.yellow, false, 1.6);
        for (let i = 0; i < 4; i++) ps.emit(P.coins, x + (i - 1.5) * 14, y - 8, 6, NaN, -1, 1.2, 1.5);
        o.sfx("coin", 0.8, 5);
        return true;
      // ---------------------------------------------------------- MYTHIC
      case "infinite_credit_card":
        if (!this.rate(id, 0.9)) return true;
        this.texts.add("APPROVED!", 0, -40, { anchor: 1, scale: 2, color: C.yellow, life: 1, rise: 10, wobble: 2 });
        for (let i = 0; i < CARD_GLITCH.length; i++) ps.emit(P.sparkle, x, y, 4, NaN, CARD_GLITCH[i], 1.2, 1.5);
        ps.emit(P.coins, x, y, 8, NaN, -1, 1, 1.3);
        o.sfx("coin", 0.7, 9);
        return true;
      case "infinite_credit_card_reroll":
        // (the level-up modal is up: the card swipe sound is enough)
        o.sfx("coin", 0.5, 12);
        return true;
      case "real_friend": {
        if (v === 0) {
          this.stamp("A REAL FRIEND JOINS!", "not imaginary. we checked. twice.", C.pinkLight, true, 2.4);
          ps.emit(P.hearts, x, y, 18, NaN, -1, 1.2, 1.5);
          ps.emit(P.sparkle, x, y, 16, NaN, C.pink, 1.2, 1.6);
          o.sfx("unlockFanfare", 0.6, 4);
        } else {
          this.texts.add("FRIEND!", x, y - 18, { scale: 2, rainbow: true, life: 1.2, rise: 10, wobble: 2 });
          ps.emit(P.hearts, x, y - 10, 10, NaN, -1, 1.1, 1.4);
        }
        return true;
      }
      case "final_episode_script":
        if (this.rate("final_stamp", 20)) this.stamp("FINAL EPISODE!", "overdrive ready. again. (it's in the script)", C.yellow, true, 1.8);
        else this.tag("THE SCRIPT SAYS: AGAIN!", C.yellow, 1.2);
        ps.emit(P.confetti, x, y, 14, NaN, C.offWhite, 1, 1.4);
        ps.emit(P.rays, x, y, 12, NaN, C.yellow, 1.1, 1.3);
        o.sfx("narratorSting", 0.5, 2);
        return true;
      default:
        return false;
    }
  }

  /** The NANI?! pop: one on screen at a time, pushed 32 px off the hero, never during the cut-in. */
  private nani(x: number, y: number): void {
    const o = this.o;
    const w = this.w;
    if (!o || !w || this.naniOn) return;
    if (w.ult && w.ult.phase === "cutin") return;
    const hx = w.player.x;
    const hy = w.player.y - CFG.playerCy;
    let dx = x - hx;
    let dy = y - 10 - hy;
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
      y = hy + dy * 32 + 10;
    }
    this.naniOn = true;
    this.naniX = x;
    this.naniY = y - 10;
    this.naniT = 0;
    this.fx.ps.emit(P.rays, x, y - 10, 10, NaN, C.red, 1, 1.4);
    if (!o.calm) this.fx.juice.zoomPunch(0.03);
    o.sfx("nani", 0.7, 0, x);
  }

  // ================================================================ per frame
  draw(time: number, realDt: number): void {
    const w = this.w;
    if (!w) return;
    this.now += realDt;
    this.sparkBudget = 4;
    const q = this.queued;
    if (q.on && this.now >= this.stampFree) {
      q.on = false;
      this.stamp(q.text, q.sub, q.color, q.rainbow, q.life);
    }
    const r = this.r;
    const p = w.player;
    // ---- red string of fate
    const tgt = redStringTarget(w);
    if (tgt && !p.dead) this.drawString(p.x + p.face * 4, p.y - 7, tgt.x, tgt.y - tgt.cy, time);
    // ---- rival marks
    if (this.hasRival) {
      const items = w.enemies.items;
      const cam = r.camera;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = items[i];
        if (e.dead || !rivalMarked(e, w.t) || !cam.inView(e.x, e.y, 16)) continue;
        const top = Math.round(e.y - e.cy - e.r - 7 + Math.sin(time * 10 + e.uid) * 1);
        r.rect(Layer.Text, Math.round(e.x) - 1, top - 1, 3, 6, C.outline, 0.9);
        r.rect(Layer.Text, Math.round(e.x), top, 1, 3, C.red, 1);
        r.rect(Layer.Text, Math.round(e.x), top + 4, 1, 1, C.red, 1);
      }
    }
    // ---- wind machine: little gusts leaving the hero
    if (this.hasWind && !p.dead && w.phase === "play") {
      this.gust -= realDt;
      if (this.gust <= 0) {
        this.gust = 0.18;
        const a = Math.random() * Math.PI * 2;
        this.fx.ps.emit(P.dust, p.x + Math.cos(a) * 14, p.y - 6 + Math.sin(a) * 10, 1, a, C.offWhite, 0.8, 1.4);
      }
    }
    // ---- timed auras
    if (this.formT > 0) {
      this.formT = Math.max(0, this.formT - realDt);
      const k = Math.min(1, this.formT);
      r.glow(p.x, p.y - 10, 20 + 3 * Math.sin(time * 8), C.pinkLight, 0.35 * k);
      if (Math.random() < 0.3) this.fx.ps.emit(P.sparkle, p.x + (Math.random() - 0.5) * 20, p.y - 4 - Math.random() * 18, 1, NaN, C.pinkLight, 0.8, 0.8);
    }
    if (this.plotT > 0) {
      this.plotT = Math.max(0, this.plotT - realDt);
      r.glow(p.x, p.y - 10, 16 + 2 * Math.sin(time * 6), C.yellow, 0.3 * Math.min(1, this.plotT));
    }
    if (this.windT > 0) this.drawSecondWind(time, realDt);
    // ---- the Friend
    const f = friendOf(w);
    this.friendFireT = Math.max(0, this.friendFireT - realDt);
    if (f && f.t > 0) this.drawFriend(time, f.x, f.y, f.face, f.moving, f.castT > 0 || this.friendFireT > 0, f.t);
    // ---- NANI?!
    if (this.naniOn) this.drawNani(realDt);
  }

  private drawString(x0: number, y0: number, x1: number, y1: number, time: number): void {
    const r = this.r;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 4) return;
    // a sagging thread: 10 segments along a quadratic with the sag growing with length (and a slow sway)
    const sag = Math.min(18, len * 0.12) + Math.sin(time * 2.3) * 1.5;
    let px = x0;
    let py = y0;
    const N = 10;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const x = x0 + dx * t;
      const y = y0 + dy * t + sag * 4 * t * (1 - t);
      // (a soft dark under-stroke keeps the 1-px thread readable on bright ground)
      r.line(Layer.FxBelow, px, py + 1, x, y + 1, 1, C.outline, 0.45);
      r.line(Layer.Fx, px, py, x, y, 1, C.red, 0.95);
      px = x;
      py = y;
    }
    // the bow on the target
    r.rect(Layer.Fx, Math.round(x1) - 3, Math.round(y1) - 1, 2, 2, C.red, 1);
    r.rect(Layer.Fx, Math.round(x1) + 1, Math.round(y1) - 1, 2, 2, C.red, 1);
    r.rect(Layer.Fx, Math.round(x1) - 1, Math.round(y1), 2, 1, C.hotPink, 1);
    r.glow(x1, y1, 6, C.red, 0.25);
  }

  private drawSecondWind(time: number, realDt: number): void {
    const o = this.o;
    this.windT = Math.max(0, this.windT - realDt);
    const r = this.r;
    const v = r.camera.view;
    const k = Math.min(1, this.windT * 2);
    const col = Math.floor(time * 6) % 2 ? C.red : C.yellow;
    if (o?.calm) {
      // (Reduce flashing: a steady corner glow instead of the pulsing border)
      r.glow(v.x + 10, v.y + 10, 22, C.yellow, 0.35 * k);
      r.glow(v.x + v.w - 10, v.y + 10, 22, C.yellow, 0.35 * k);
      return;
    }
    const a = (0.4 + 0.25 * Math.sin(time * 10)) * k;
    const t = 3;
    r.rect(Layer.Overlay, v.x, v.y, v.w, t, col, a, Flag.Add | Flag.Glow);
    r.rect(Layer.Overlay, v.x, v.y + v.h - t, v.w, t, col, a, Flag.Add | Flag.Glow);
    r.rect(Layer.Overlay, v.x, v.y, t, v.h, col, a, Flag.Add | Flag.Glow);
    r.rect(Layer.Overlay, v.x + v.w - t, v.y, t, v.h, col, a, Flag.Add | Flag.Glow);
    const w = this.w;
    if (w && Math.random() < 0.4) this.fx.ps.emit(P.ember, w.player.x + (Math.random() - 0.5) * 16, w.player.y - 2, 1, NaN, C.orange, 1, 1);
  }

  private drawFriend(time: number, x: number, y: number, face: number, moving: boolean, cast: boolean, age: number): void {
    const r = this.r;
    let h: number;
    if (cast) h = this.fCast + (Math.floor(time * 8) % this.fCastN);
    else if (moving) h = this.fRun + (Math.floor(time * 13) % this.fRunN);
    else h = this.fIdle + (Math.floor(time * this.fIdleFps + 0.5) % this.fIdleN);
    const a = Math.min(1, age / 0.4);
    const bob = cast ? Math.abs(Math.sin(time * 9)) * -2 : 0;
    const yy = y + bob;
    r.shadow(x, y, 13, a);
    // 1-px pink outline (four tinted silhouettes), then the sprite, all at the Friend's sort depth
    const b = r.batch;
    b.sortKey = y;
    for (let i = 0; i < 4; i++) r.spr(Layer.Entity, h, x + OUT_X[i], yy + OUT_Y[i], face, 1, 0, C.pink, 0.9 * a, 1, 0);
    b.sortKey = y + 0.001;
    r.spr(Layer.Entity, h, x, yy, face, 1, 0, 0xffffff, a, 0, 0);
    b.sortKey = NaN;
    // the floating heart
    const hy = y - 28 + Math.sin(time * 3.2) * 2;
    r.spr(Layer.Text, this.hHeart, x + face * 8, hy, 1, 1, 0, C.pink, a, 0, 0);
    if (age < 0.6) r.glow(x, y - 10, 24 * (1 - age / 0.6) + 6, C.pinkLight, 0.6 * (1 - age / 0.6));
    if (cast) r.glow(x, y - 12, 14 + 2 * Math.sin(time * 12), rainbow(time * 0.8, 0.6), 0.3);
  }

  private drawNani(realDt: number): void {
    this.naniT += realDt;
    if (this.naniT >= NANI_LIFE) {
      this.naniOn = false;
      return;
    }
    const t = this.naniT;
    const k = t / NANI_LIFE;
    const pop = t < 0.16 ? 2.2 - 1.2 * easeBack(t / 0.16) : 1;
    const rot = ((8 * Math.PI) / 180) * Math.sin(t * 16) * (1 - k);
    const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const f = Math.floor(t * 16) % this.hNaniN;
    this.r.spr(Layer.Text, this.hNani + f, this.naniX, this.naniY - 6 * k, pop, pop, rot, 0xffffff, alpha, 0, 0);
  }
}

/** Back-out ease 0..1 (overshoots a little). */
function easeBack(t: number): number {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
