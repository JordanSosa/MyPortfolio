/**
 * THE PULL (docs/content/gacha.md §2, the big AAA moment): one full-screen
 * overlay that plays the storyboard on the kit ticker's clock (frame time, so
 * a hidden tab pauses it):
 *
 *   0.00  dim 70 %, summoning circle scales 0 -> 1.4 while spinning, 40
 *         sparkles spiral in, the machine's crank turns, gachaCharge, music
 *         ducked 50 %, a narrator caption           0.30  "Skip? …fine."
 *   1.20  the meteor falls on a diagonal (its frame = the BEST rarity);
 *         1.80 SSR+ fake-out (15 %): blue, "...wait.", promoted mid-fall
 *   2.20  impact: flash, shockwave ring, burst, the capsule lands (3 bounces),
 *         wobbles 3x, cracks (f5) with beams in the rarity colour
 *   3.10  cards fly out of the capsule into a 2x5 grid (landscape 5x2) and
 *         flip one by one every 0.18 s; an SSR+ card pauses the flips for its
 *         full-screen splash (rays, diagonal band, art, stamped title, typed
 *         name, flavour, NEW / ★ UP, LOST / WON THE 50/50)
 *   MYTHIC replaces impact..splash with "the game breaks": crack, music cut,
 *         KAWAII_OVERFLOW 0xDEADBEEF window, shatter, 200 confetti + scream,
 *         MYTHIC title stamp, the item slams in, music back (gacha_mythic)
 *   end   summary: cards with NEW / ★ UP / +Copium, the consolation ticker,
 *         dupe notes, "Pull ×10 again" / "Back".
 *
 * Skip jumps to the summary (a MYTHIC still plays a 1.5 s cut: "You can't skip
 * destiny."). Tap = hurry (x3) / end a splash. Reduced motion: no flight, no
 * stamps, no particles - the same beats as fades. "Reduce flashing": flashes
 * become soft fades and the MYTHIC glitch / strobe become a corner badge.
 * transform / opacity only (+ one canvas for particles).
 *
 * The overlay keeps the class names the e2e drives: `.reveal` (open),
 * `.reveal.done` (summary), `[data-act="ok"]` (Back).
 */
import type { MusicTrack, SfxId } from "../../../audio/api";
import type { Rarity } from "../../../game/defs";
import { RELICS } from "../../../game/registry";
import type { AchievementDone } from "../../../meta/achievements/engine";
import type { PullOutcome, PullResult } from "../../../meta/gacha/engine";
import { TUNING } from "../../../meta/tuning";
import { esc, fmtInt, h, hasArt, img, letters, sprite } from "../../dom";
import { money, RARITY_CLS, RARITY_TITLE, rarityBadge, trophyIcon } from "../../kit/art";
import { tag } from "../../kit/controls";
import { trackOverlay, type KitHost, type ToastOpts } from "../../kit/overlay";
import { animate, reducedMotion, stopAnimating, type Tickable } from "../../kit/ticker";
import type { NavLayer } from "../../nav";
import { markBorn, onTap } from "../../screens/common";
import { BIOS, LOST_5050, RARITY_SUBTITLES, WON_5050 } from "../copy-data";
import { pick } from "../copy";
import { CAPSULE_CRACKED, cardHtml, castPose, heroDef, isSsrPlus, itemArt, meteorFrame, METEOR_CLS, RAINBOW, RARITY_HEX, rarityIdx } from "./art";
import * as C from "./copy";
import { debugSpeed, setDebugStepper } from "./debug";
import { Particles } from "./fx";

/** What the summon needs from the hub / App. */
export interface SummonHost extends KitHost {
  music(track: MusicTrack, fade?: number): void;
  duck(amount: number, seconds: number): void;
  haptic(ms: number): void;
  /** Screen shake setting 0..1+. */
  readonly shakeAmt: number;
  readonly reduceFlash: boolean;
  toast(msg: string, o?: ToastOpts): void;
}

export interface SummonOpts {
  /** "pull" (circle + meteor), "shop" (a Copium Exchange copy: capsule only), "spark" (a MYTHIC by choice). */
  mode: "pull" | "shop" | "spark";
  /** Plot Points completed by this pull (toasted at the summary; "mythic" at the MYTHIC's music return). */
  achievements?: AchievementDone[];
  /** Cones pulled on the Isekai Express so far (the cone dupes get ominous after 30). */
  cones?: number;
  /** Force the SSR+ fake-out (debug). */
  fakeout?: boolean;
  /** "Pull ×N again" (absent = no button). `afford` false shows it greyed. */
  again?: { label: string; sub: string; afford: boolean; run: () => void };
  onClose: () => void;
}

type Wait = { at: number; res: (ok: boolean) => void };

/** Note shown under the summary for a result (dupe lines), with a priority. */
interface Note {
  t: string;
  s: string;
  pri: number;
}

const FLIP_GAP = 0.18;

export class Summon implements Tickable {
  readonly el: HTMLElement;
  private readonly layer: NavLayer;
  private readonly fx: Particles | null;
  private readonly rm = reducedMotion();
  private readonly results: PullResult[];
  private readonly best: Rarity;
  private readonly mythicIdx: number;
  private clock = 0;
  private lastNow = 0;
  private rate = 1;
  private gen = 0;
  private waits: Wait[] = [];
  private tapWait: (() => void) | null = null;
  private tapMin = 0;
  private closed = false;
  private done = false;
  private mythicShown = false;
  private musicCut = false;
  private toastsShown = new Set<string>();
  private flipped = new Set<number>();
  private summaryReady = false;
  private readonly cards: HTMLElement[] = [];
  /** Meteor flight (JS-driven so the trail follows the head). */
  private meteor: { t0: number; dur: number; x0: number; y0: number; x1: number; y1: number; w: number; h: number; el: HTMLElement } | null = null;
  private readonly q = <T extends Element = HTMLElement>(s: string) => this.el.querySelector(s) as T;

  constructor(
    private readonly host: SummonHost,
    private readonly out: PullOutcome,
    private readonly o: SummonOpts,
  ) {
    this.results = out.results;
    this.best = out.best;
    this.mythicIdx = this.results.findIndex((r) => r.rarity === "MYTHIC");
    const n = this.results.length;
    const rc = RARITY_CLS[this.best];
    this.el = h("div", `kover reveal summon ${n > 1 ? "ten" : "one"} best-${rc} m-${o.mode}${host.reduceFlash ? " rflash" : ""}${this.rm ? " rmo" : ""}`);
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-modal", "true");
    this.el.setAttribute("aria-label", "Merch Machine pull");
    const mf = meteorFrame(this.best);
    this.el.innerHTML = `
      <div class="sm-dim"></div>
      <div class="sm-world">
        <div class="sm-circle" aria-hidden="true"><div class="sm-circle-in"><div class="sm-spin">${hasArt("ui_summon_circle") ? img("ui_summon_circle", "px scf", 0) : `<i class="css-circle"></i>`}</div><i class="sm-cglow"></i></div></div>
        <div class="sm-meteor" aria-hidden="true">${hasArt("ui_gacha_meteor") ? img("ui_gacha_meteor", "px sm-met", 0) : `<i class="css-meteor c-${METEOR_CLS[mf]}"></i>`}</div>
        <i class="sm-ring" aria-hidden="true"></i>
        <div class="sm-cap c-${METEOR_CLS[mf]}" aria-hidden="true">
          <i class="sm-beams"></i>
          <div class="sm-cap-in">${hasArt("ui_gacha_capsule") ? `${img("ui_gacha_capsule", "px cpf whole", mf)}${img("ui_gacha_capsule", "px cpf cracked", CAPSULE_CRACKED)}` : `<i class="css-cap whole"></i><i class="css-cap cracked"></i>`}</div>
        </div>
        <div class="sm-cards" role="list">${this.results.map((r, i) => cardHtml(r.item, i, resultChip(r), r.lost5050 ? "lost" : "", n === 1 ? pick(`rs:${r.rarity}`, RARITY_SUBTITLES[r.rarity] ?? []) : "")).join("")}</div>
      </div>
      <i class="sm-flash" aria-hidden="true"></i>
      <p class="sm-line" aria-live="polite"></p>
      <p class="sm-wait" aria-hidden="true">${esc(C.FAKEOUT)}</p>
      <div class="sm-splash" hidden></div>
      <div class="sm-myth" hidden></div>
      <div class="sm-sum">
        <div class="sm-tick"></div>
        <div class="sm-notes"></div>
        <div class="sm-btns">
          ${o.again ? `<button class="btn gold small sm-again${o.again.afford ? "" : " nope"}" data-nav data-act="again"><span class="btxt"><span class="blab">${esc(o.again.label)}</span><small class="bsub">${esc(o.again.sub)}</small></span></button>` : ""}
          <button class="btn ghost small" data-nav data-act="ok">Back</button>
        </div>
      </div>
      <button class="sm-skip" data-nav data-act="skip">${esc(C.SKIP)}</button>`;
    this.fx = this.rm ? null : new Particles("sm-fx");
    if (this.fx) this.el.insertBefore(this.fx.el, this.q(".sm-world"));
    this.cards = Array.from(this.el.querySelectorAll<HTMLElement>(".gc-cd"));
    host.ui.appendChild(this.el);
    this.layer = { root: this.el, onBack: () => (this.done ? this.close() : this.skip()), focus: null };
    host.nav.push(this.layer);
    trackOverlay(1);
    host.overlayOpened();
    markBorn();
    onTap(this.q('[data-act="skip"]'), () => this.skip());
    onTap(this.q('[data-act="ok"]'), () => this.close());
    if (o.again) onTap(this.q('[data-act="again"]'), () => this.again());
    this.el.addEventListener("pointerdown", (e) => this.onTap(e));
    for (const c of this.cards) c.addEventListener("click", () => this.inspect(Number(c.dataset.i)));
    animate(this);
    setDebugStepper((dt) => this.advance(dt * this.rate));
    void this.play(this.gen);
  }

  // ================================================================ clock
  tick(dt: number): boolean {
    if (this.closed) return false;
    // real elapsed time (the main loop clamps dt to 1/20 s; the CSS beats run on real time and the JS cues must
    // keep up with them on a slow phone), capped so a stall never jumps a whole beat
    const now = performance.now();
    const real = this.lastNow > 0 ? (now - this.lastNow) / 1000 : dt;
    this.lastNow = now;
    this.advance(Math.min(real, 0.25) * this.rate * debugSpeed());
    return true;
  }

  private advance(d: number): void {
    this.clock += d;
    if (this.meteor) this.flyMeteor();
    // (no allocation unless something is due)
    let any = false;
    for (let i = 0; i < this.waits.length && !any; i++) any = this.waits[i].at <= this.clock;
    if (any) {
      const due = this.waits.filter((w) => w.at <= this.clock);
      this.waits = this.waits.filter((w) => w.at > this.clock);
      for (const w of due) w.res(true);
    }
  }

  /** Resolve after `s` seconds of summon clock: true, or false when the run was skipped / closed. */
  private sleep(s: number, g: number): Promise<boolean> {
    if (g !== this.gen || this.closed) return Promise.resolve(false);
    if (s <= 0) return Promise.resolve(true);
    return new Promise((res) => this.waits.push({ at: this.clock + s, res: (ok) => res(ok && g === this.gen && !this.closed) }));
  }

  /** Run `fn` after `s` seconds of summon clock (dropped by a skip / close). */
  private after(s: number, fn: () => void): void {
    const g = this.gen;
    this.waits.push({ at: this.clock + s, res: (ok) => ok && g === this.gen && !this.closed && fn() });
  }

  /** Wait `s` seconds or a tap (after `min` seconds). */
  private tapOr(s: number, min: number, g: number): Promise<boolean> {
    if (g !== this.gen || this.closed) return Promise.resolve(false);
    return new Promise((res) => {
      let settled = false;
      const fin = (ok: boolean) => {
        if (settled) return;
        settled = true;
        this.tapWait = null;
        res(ok && g === this.gen && !this.closed);
      };
      this.tapMin = this.clock + min;
      this.tapWait = () => fin(true);
      this.waits.push({ at: this.clock + s, res: fin });
    });
  }

  /** Abort the running sequence (pending sleeps resolve false). */
  private cancel(): void {
    this.gen++;
    const w = this.waits;
    this.waits = [];
    for (const x of w) x.res(false);
    this.tapWait = null;
    this.rate = 1;
  }

  private onTap(e: PointerEvent): void {
    if (this.closed || this.done) return;
    const t = e.target as HTMLElement;
    if (t.closest("button")) return;
    if (this.tapWait) {
      if (this.clock >= this.tapMin) this.tapWait();
      return;
    }
    // hurry: the beats keep their order, three times as fast
    this.rate = 3;
  }

  // ================================================================ helpers
  private sfx(id: SfxId, vol = 1, pitch = 0): void {
    if (!this.closed) this.host.sfx(id, vol, pitch);
  }

  private line(text: string, cls = ""): void {
    const p = this.q(".sm-line");
    p.className = `sm-line ${cls}`;
    p.textContent = text;
    if (text && !this.rm) p.animate([{ transform: "translateY(0.6em)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "ease-out" });
  }

  /** Screen shake on the world layer (settings: shake amount; reduced motion: none). */
  private shake(px: number, ms = 360): void {
    const a = px * this.host.shakeAmt;
    if (this.rm || a < 0.5) return;
    const w = this.q(".sm-world");
    const k: Keyframe[] = [];
    for (let i = 0; i < 7; i++) {
      const f = 1 - i / 7;
      k.push({ transform: `translate(${((i % 2 ? 1 : -1) * a * f).toFixed(1)}px, ${((i % 3) - 1) * a * 0.6 * f}px)` });
    }
    k.push({ transform: "none" });
    w.animate(k, { duration: ms, easing: "linear" });
  }

  /** Full-screen flash (Reduce flashing: a soft, slow fade). */
  private flash(peak = 1, ms = 250, color = "#fff"): void {
    const f = this.q(".sm-flash");
    f.style.background = color;
    const p = this.host.reduceFlash ? Math.min(0.28, peak) : peak;
    const d = this.host.reduceFlash ? ms * 2.4 : ms;
    f.animate([{ opacity: 0 }, { opacity: p, offset: 0.18 }, { opacity: 0 }], { duration: d, easing: "ease-out" });
  }

  /** Circle centre in px (portrait: 40 % of the height). */
  private centre(): { x: number; y: number; d: number } {
    const r = this.q(".sm-circle").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width };
  }

  private colors(r: Rarity = this.best): readonly string[] {
    return RARITY_HEX[r];
  }

  // ================================================================ the storyboard
  private async play(g: number): Promise<void> {
    const host = this.host;
    const mode = this.o.mode;
    const el = this.el;
    const ok = (b: boolean) => b && g === this.gen && !this.closed;
    if (mode !== "shop") host.duck(0.5, this.mythicIdx >= 0 ? 2.4 : 3.4);
    el.classList.add("s-dim");
    if (mode === "shop") {
      // a Copium Exchange copy: the capsule drops straight in
      if (!ok(await this.sleep(0.15, g))) return;
      if (!(await this.capsule(g, true))) return;
    } else {
      // ---- 1. summon
      el.classList.add("s-circle");
      host.sfx("gachaCharge");
      this.line(pick("gacha:summon", C.CAPTIONS));
      document.querySelector(".merch .bnr-machine")?.classList.add("crank");
      if (this.fx) {
        const c = this.centre();
        this.fx.spiral(c.x, c.y, 40, Math.max(c.d * 0.9, 160), ["#fff7b0", "#ffb8dc", "#ffffff", "#ffe14d"], 1.15);
      }
      if (!ok(await this.sleep(0.3, g))) return;
      el.classList.add("s-skip");
      if (!ok(await this.sleep(0.9, g))) return;
      // ---- 2. meteor (1.20 - 2.20)
      const fake = mode === "pull" && isSsrPlus(this.best) && (this.o.fakeout ?? Math.random() < 0.15);
      this.launchMeteor(fake ? "N" : this.best);
      host.sfx("gachaMeteor");
      if (fake) {
        if (!ok(await this.sleep(0.6, g))) return;
        this.promoteMeteor();
        if (!ok(await this.sleep(0.4, g))) return;
      } else if (!ok(await this.sleep(1.0, g))) return;
      this.meteor = null;
      this.line("");
      el.classList.remove("s-meteor", "s-wait");
      document.querySelector(".merch .bnr-machine")?.classList.remove("crank");
      // ---- 3. impact
      if (this.mythicIdx >= 0) {
        if (!(await this.mythic(g, this.results[this.mythicIdx]))) return;
      } else if (!(await this.capsule(g, false))) return;
    }
    // ---- 5. cards
    if (!(await this.dealCards(g))) return;
    this.summary();
  }

  private launchMeteor(as: Rarity): void {
    const m = this.q(".sm-meteor");
    this.setMeteorFrame(as);
    this.el.classList.add("s-meteor");
    if (this.rm) return;
    const c = this.centre();
    const W = innerWidth;
    const H = innerHeight;
    // (one layout read at launch; every frame after that only writes a transform)
    this.meteor = { t0: this.clock, dur: 1.0, x0: c.x + W * 0.5, y0: c.y - H * 0.52, x1: c.x, y1: c.y, w: m.offsetWidth || 1, h: m.offsetHeight || 1, el: m };
    this.flyMeteor();
  }

  private setMeteorFrame(r: Rarity): void {
    const f = meteorFrame(r);
    const im = this.el.querySelector<HTMLImageElement>(".sm-meteor img");
    if (im) {
      const src = sprite("ui_gacha_meteor", f);
      if (src) im.src = src;
    } else this.el.querySelector(".sm-meteor i")?.setAttribute("class", `css-meteor c-${METEOR_CLS[f]}`);
    this.q(".sm-meteor").dataset.c = METEOR_CLS[f];
  }

  private flyMeteor(): void {
    const m = this.meteor;
    if (!m) return;
    const k = Math.min(1, (this.clock - m.t0) / m.dur);
    const e = k * (0.55 + 0.45 * k);
    const x = m.x0 + (m.x1 - m.x0) * e;
    const y = m.y0 + (m.y1 - m.y0) * e;
    const dx = m.x1 - m.x0;
    const dy = m.y1 - m.y0;
    const ang = Math.atan2(-dx, dy);
    const w = m.w;
    const hh = m.h;
    m.el.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - hh).toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
    const cls = m.el.dataset.c ?? "blue";
    this.fx?.trail(x, y, dx, dy, cls === "glitch" ? RAINBOW : cls === "rainbow" ? RAINBOW : cls === "gold" ? RARITY_HEX.SSR : cls === "purple" ? RARITY_HEX.SR : RARITY_HEX.R, 3);
  }

  /** The SSR+ fake-out: the blue meteor flashes and becomes its real colour. */
  private promoteMeteor(): void {
    this.sfx("recordScratch");
    this.el.classList.add("s-wait");
    this.host.duck(0.8, 0.6);
    this.setMeteorFrame(this.best);
    const m = this.q(".sm-meteor");
    if (!this.rm) m.animate([{ opacity: 1 }, { opacity: 0.2, offset: 0.2 }, { opacity: 1, offset: 0.4 }, { opacity: 0.3, offset: 0.6 }, { opacity: 1 }], { duration: 320 });
    if (this.meteor && this.fx) {
      const mm = this.meteor;
      const k = Math.min(1, (this.clock - mm.t0) / mm.dur);
      const e = k * (0.55 + 0.45 * k);
      this.fx.burst(mm.x0 + (mm.x1 - mm.x0) * e, mm.y0 + (mm.y1 - mm.y0) * e, 26, 260, this.colors(), 0.6);
    }
    // the meteor sound again, now with feeling
    this.after(0.12, () => this.sfx("gachaMeteor", 1, 2));
  }

  /** 3-4: impact, capsule bounces, wobbles, cracks with beams. */
  private async capsule(g: number, shop: boolean): Promise<boolean> {
    const el = this.el;
    const host = this.host;
    const c = this.centre();
    el.classList.add("s-cap");
    if (!shop) {
      this.flash(1, 250);
      host.sfx("explosion", 0.6);
      host.haptic(30);
      this.shake(9);
      el.classList.add("s-ring");
      this.fx?.burst(c.x, c.y, 44, 520, this.colors(), 0.9, true);
      this.fx?.burst(c.x, c.y, 18, 300, ["#ffffff"], 0.6);
    }
    const cap = this.q(".sm-cap");
    if (!this.rm) {
      cap.animate(
        [
          { transform: "translateY(-55%) scale(0.6)", opacity: 0 },
          { transform: "translateY(0) scale(1.08, 0.88)", opacity: 1, offset: 0.34 },
          { transform: "translateY(-22%) scale(0.96, 1.04)", offset: 0.52 },
          { transform: "translateY(0) scale(1.05, 0.93)", offset: 0.68 },
          { transform: "translateY(-8%)", offset: 0.8 },
          { transform: "translateY(0) scale(1.02, 0.97)", offset: 0.9 },
          { transform: "none" },
        ],
        { duration: 330, easing: "ease-out" },
      );
    }
    if (!(await this.sleep(shop ? 0.35 : 0.25, g))) return false;
    // wobble x3 (0.2 s each)
    if (!this.rm) cap.animate([{ transform: "rotate(0)" }, { transform: "rotate(-13deg)", offset: 0.16 }, { transform: "rotate(11deg)", offset: 0.33 }, { transform: "rotate(-10deg)", offset: 0.5 }, { transform: "rotate(9deg)", offset: 0.66 }, { transform: "rotate(-6deg)", offset: 0.83 }, { transform: "none" }], { duration: 600, easing: "ease-in-out" });
    for (let i = 0; i < 3; i++) this.after(i * 0.2, () => this.sfx("uiMove", 0.5, 4 + i * 2));
    if (!(await this.sleep(0.6, g))) return false;
    // crack
    el.classList.add("s-crack");
    host.sfx("gachaReveal");
    host.haptic(20);
    this.fx?.burst(c.x, c.y, 24, 340, this.colors(), 0.7);
    if (!(await this.sleep(0.12, g))) return false;
    return true;
  }

  // ---------------------------------------------------------------- cards
  private async dealCards(g: number): Promise<boolean> {
    const el = this.el;
    const host = this.host;
    this.prepareSummary();
    el.classList.add("s-cards");
    el.classList.remove("s-line");
    this.line("");
    // fly from the capsule into the grid (FLIP: one layout read for all cards)
    const cr = this.q(".sm-cap").getBoundingClientRect();
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    const rects = this.cards.map((c) => c.getBoundingClientRect());
    this.cards.forEach((c, i) => {
      const r = rects[i];
      if (this.rm) {
        c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: i * 30, fill: "backwards" });
        return;
      }
      const dx = cx - (r.left + r.width / 2);
      const dy = cy - (r.top + r.height / 2);
      c.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.18) rotate(${(i % 2 ? 1 : -1) * 25}deg)`, opacity: 0 },
          { transform: `translate(${dx * 0.1}px, ${dy * 0.1 - 10}px) scale(1.06)`, opacity: 1, offset: 0.75 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 420, delay: i * 35, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)", fill: "backwards" },
      );
    });
    host.sfx("cardPick", 0.7);
    if (!(await this.sleep(this.rm ? 0.3 : 0.45 + this.cards.length * 0.035, g))) return false;
    for (let i = 0; i < this.results.length; i++) {
      if (!(await this.reveal(i, g))) return false;
    }
    return this.sleep(0.35, g);
  }

  /** Flip card i (+ its splash if SSR+). */
  private async reveal(i: number, g: number): Promise<boolean> {
    const r = this.results[i];
    const card = this.cards[i];
    const big = isSsrPlus(r.rarity);
    const already = i === this.mythicIdx && this.mythicShown;
    if (big && !already && !this.rm) {
      card.classList.add("tease");
      if (!(await this.sleep(0.34, g))) return false;
    }
    this.flip(i);
    if (big && !already) {
      if (!(await this.splash(r, g))) return false;
    } else if (!this.rm && (r.item.kind === "hero" && r.result === "constellation")) {
      // gameplay-hero constellation: a short star-up moment
      if (!(await this.splash(r, g, true))) return false;
    } else if (!(await this.sleep(this.rm ? 0.06 : FLIP_GAP, g))) return false;
    return true;
  }

  private flip(i: number, quiet = false): void {
    if (this.flipped.has(i)) return;
    this.flipped.add(i);
    const r = this.results[i];
    const card = this.cards[i];
    card.classList.remove("tease");
    card.classList.add("flip");
    if (quiet) return;
    this.sfx("cardFlip", 0.8, Math.min(7, i * 0.7));
    if (r.rarity === "SR") this.sfx("gachaRevealSR", 0.7);
    if (r.result === "star" || r.result === "constellation") this.after(0.16, () => this.sfx("starUp", 0.7, r.level));
    else if (r.result === "copium") this.after(0.16, () => this.sfx("gachaDupe", 0.7));
    if (this.fx && !this.rm) {
      const b = card.getBoundingClientRect();
      if (r.result === "star" || r.result === "constellation") this.fx.burst(b.left + b.width / 2, b.top + b.height * 0.3, 10, 160, ["#ffe14d", "#fff7b0"], 0.55);
      else if (rarityIdx(r.rarity) >= 2) this.fx.burst(b.left + b.width / 2, b.top + b.height / 2, 8, 140, this.colors(r.rarity), 0.5, true);
    }
  }

  // ---------------------------------------------------------------- SSR+ splash
  private async splash(r: PullResult, g: number, mini = false): Promise<boolean> {
    const host = this.host;
    const sp = this.q(".sm-splash");
    const rc = RARITY_CLS[r.rarity];
    const hero = r.item.kind === "hero" ? heroDef(r.item.id) : undefined;
    const relic = r.item.kind === "relic" ? RELICS.get(r.item.id) : undefined;
    const note = noteFor(r, this.o.cones ?? 0);
    const flav = hero ? hero.title : (relic?.flavor ?? "");
    const isNewHero = r.item.kind === "hero" && r.result === "new";
    const sub = pick(`rs:${r.rarity}`, RARITY_SUBTITLES[r.rarity] ?? []);
    const bio = isNewHero ? (BIOS[r.item.id] ?? "").split("\n").slice(0, 4).join("\n") : "";
    const art = mini || r.result === "constellation" ? castPose(r.item.id, "sp-img") : itemArt(r.item, "sp-img", r.item.kind === "hero" ? 1 : 0);
    sp.className = `sm-splash r-${rc} k-${r.item.kind}${mini ? " mini" : ""}${r.lost5050 ? " lost" : ""}`;
    sp.innerHTML = `
      <i class="sp-rays" aria-hidden="true"></i>
      <i class="sp-band" aria-hidden="true"></i>
      <div class="sp-art${r.item.kind === "relic" ? " relic" : ""}">${art}</div>
      <div class="sp-tx">
        ${mini ? "" : `<b class="sp-title">${esc(RARITY_TITLE[r.rarity])}</b>`}
        <b class="sp-name">${letters(r.item.name, "spl", 0.035)}</b>
        ${note ? `<span class="sp-note"><b>${esc(note.t)}</b>${note.s ? `<small>${esc(note.s)}</small>` : ""}</span>` : ""}
        ${flav && !mini ? `<small class="sp-flav">${esc(flav)}</small>` : ""}
        ${mini ? "" : `<small class="sp-sub">${esc(sub)}</small>`}
        <span class="sp-badge">${resultChip(r)}</span>
      </div>
      ${r.lost5050 ? `<b class="sp-stamp lost">LOST THE 50/50</b>` : r.won5050 ? `<b class="sp-stamp won">WON THE 50/50!!</b>` : ""}
      ${bio ? `<div class="sp-bio"><small>OC BIO · DO NOT STEAL</small><p>${esc(bio)}</p></div>` : ""}
      <small class="sp-hint">TAP</small>`;
    sp.hidden = false;
    this.el.classList.add("s-splash");
    // the CSS beats are keyframes keyed on .on (no transition: no forced reflow needed)
    sp.classList.add("on");
    if (mini) {
      host.sfx("starUp", 0.9, r.level);
      host.sfx("voiceBlip", 0.6, 4);
    } else {
      host.sfx(r.rarity === "SSR" ? "gachaRevealSSR" : "gachaRevealUR");
      host.haptic(40);
      host.duck(0.55, 2);
      if (!this.rm) {
        this.after(0.33, () => sp.classList.contains("on") && this.shake(r.rarity === "SSR" ? 7 : 11, 300));
        this.fx?.burst(innerWidth / 2, innerHeight * 0.42, 40, 600, this.colors(r.rarity), 1.1);
      }
    }
    // the stamp lands at 1.05 s (CSS), then the trombone / the toast (a skip still gets them at the summary)
    if (r.lost5050) this.after(1.05, () => sp.classList.contains("on") && this.lost5050());
    else if (r.won5050) this.after(1.05, () => sp.classList.contains("on") && this.won5050());
    const dur = mini ? 1.05 : isNewHero ? 4.2 : r.lost5050 ? 3.0 : 2.2;
    // a hurry tap speeds up the flips, never a splash (tap ends one instead)
    const rate0 = this.rate;
    this.rate = 1;
    const ok = await this.tapOr(dur, mini ? 0.35 : 0.6, g);
    if (g === this.gen) this.rate = rate0;
    sp.classList.remove("on");
    sp.classList.add("off");
    this.el.classList.remove("s-splash");
    window.setTimeout(() => {
      if (sp.classList.contains("off")) {
        sp.hidden = true;
        sp.classList.remove("off");
      }
    }, 220);
    if (!ok) return false;
    return this.sleep(0.2, g);
  }

  private lost5050(): void {
    if (this.toastsShown.has("lost")) return;
    this.toastsShown.add("lost");
    this.host.sfx("gachaLost5050");
    this.host.duck(0.7, 2.6);
    this.host.toast(pick("lost", LOST_5050), { kind: "gacha", icon: trophyIcon("kt-img"), ms: 3600 });
  }

  private won5050(): void {
    if (this.toastsShown.has("won")) return;
    this.toastsShown.add("won");
    this.host.sfx("achievement", 0.7);
    this.host.toast(pick("won", WON_5050), { kind: "good" });
  }

  // ---------------------------------------------------------------- MYTHIC: the game breaks
  private async mythic(g: number, r: PullResult): Promise<boolean> {
    const host = this.host;
    const el = this.el;
    const my = this.q(".sm-myth");
    const c = this.centre();
    const W = innerWidth;
    const H = innerHeight;
    el.classList.add("s-myth");
    my.hidden = false;
    my.innerHTML = `
      ${crackSvg(c.x, c.y, W, H)}
      <div class="my-win" role="alertdialog" aria-label="${esc(C.MYTHIC_ERROR.title)}">
        <div class="my-bar"><span>merch_machine</span><i>✕</i></div>
        <div class="my-body"><b>${esc(C.MYTHIC_ERROR.title)}</b>${C.MYTHIC_ERROR.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
        <div class="my-btns"><button class="my-b" data-nav data-act="mywait">[ ${esc(C.MYTHIC_ERROR.wait)} ]</button><button class="my-b" data-nav data-act="myclose">[ ${esc(C.MYTHIC_ERROR.close)} ]</button></div>
      </div>
      <div class="my-shards" aria-hidden="true"></div>
      <div class="my-band" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="my-art">${itemArt(r.item, "my-img", r.item.kind === "hero" ? 1 : 0)}</div>
      <div class="my-tx"><b class="my-title">${esc(RARITY_TITLE.MYTHIC)}</b><b class="my-name">${esc(r.item.name)}</b><small class="my-sub">${esc(pick("rs:MYTHIC", RARITY_SUBTITLES.MYTHIC ?? []))}</small><span class="my-chip">${resultChip(r)}</span></div>
      <p class="my-scream" aria-live="assertive">${this.rm || host.reduceFlash ? esc(C.NARRATOR_SCREAM) : letters(C.NARRATOR_SCREAM, "scrm", 0.012)}</p>
      ${host.reduceFlash ? `<span class="my-badge">⚠ GLITCH (reduced)</span>` : ""}`;
    // 0.0: crack + glitch + music cut
    el.classList.add("m-crack");
    this.sfx("gachaMythicGlitch");
    host.music("none", 0);
    this.musicCut = true;
    host.haptic(80);
    this.flash(0.7, 160, "#ff4fd8");
    this.shake(14, 420);
    // 0.4: silence, the error window drops in
    if (!(await this.sleep(0.4, g))) return false;
    el.classList.add("m-win");
    const win = my.querySelector(".my-win") as HTMLElement;
    this.host.nav.refocus(this.layer, win.querySelector("[data-act='mywait']") as HTMLElement);
    const cont = () => {
      this.sfx("uiConfirm", 0.6);
      this.tapWait?.();
    };
    for (const b of win.querySelectorAll<HTMLElement>(".my-b")) onTap(b, cont);
    // auto-continues after 1.6 s (either button continues sooner)
    if (!this.closed && g === this.gen) await this.tapOr(1.6, 0, g);
    if (g !== this.gen || this.closed) return false;
    // 2.0: glitch + shatter
    el.classList.add("m-glitch");
    this.sfx("glitch", 0.8);
    if (!(await this.sleep(0.3, g))) return false;
    this.shatter(win);
    // 2.3: BOOM
    el.classList.add("m-boom");
    this.sfx("gachaMythicBoom");
    host.haptic(140);
    this.flash(1, 420);
    this.shake(18, 600);
    this.fx?.confetti(c.x, c.y, 200, RAINBOW);
    this.fx?.burst(c.x, c.y, 60, 700, RAINBOW, 1.2);
    if (!(await this.sleep(0.7, g))) return false;
    // 3.0: title stamp, the item slams in, voiceBlip x3
    el.classList.add("m-title");
    for (let i = 0; i < 3; i++) this.after(i * 0.15, () => this.sfx("voiceBlip", 1, 3 + i * 4));
    this.after(0.12, () => this.shake(10, 300));
    this.mythicShown = true;
    if (!(await this.sleep(2.5, g))) return false;
    // 5.5: music back with the MYTHIC sting, Whale-Sized Luck
    this.musicBack();
    this.toastAchievements(["mythic"]);
    if (!(await this.tapOr(1.2, 0, g))) return false;
    el.classList.add("m-out");
    if (!(await this.sleep(0.3, g))) return false;
    my.hidden = true;
    el.classList.remove("s-myth");
    // the cards appear with the MYTHIC already face up
    return true;
  }

  private musicBack(): void {
    if (!this.musicCut) return;
    this.musicCut = false;
    this.host.music("gacha_mythic", 0.4);
  }

  /** The error window shatters: 6 clipped copies fly apart (transform / opacity). */
  private shatter(win: HTMLElement): void {
    const shards = this.q(".sm-myth .my-shards");
    if (this.rm) {
      win.style.opacity = "0";
      return;
    }
    const r = win.getBoundingClientRect();
    const cuts = ["0 0, 45% 0, 30% 55%, 0 40%", "45% 0, 100% 0, 100% 30%, 60% 45%, 30% 55%", "100% 30%, 100% 75%, 70% 100%, 60% 45%", "0 40%, 30% 55%, 40% 100%, 0 100%", "30% 55%, 60% 45%, 70% 100%, 40% 100%", "60% 45%, 100% 30%, 100% 40%"];
    const html = win.outerHTML;
    shards.innerHTML = cuts.map((p) => `<div class="my-shard" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;clip-path:polygon(${p})">${html}</div>`).join("");
    win.style.visibility = "hidden";
    shards.querySelectorAll<HTMLElement>(".my-shard").forEach((s, i) => {
      const a = (i / cuts.length) * Math.PI * 2 + 0.4;
      s.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${Math.cos(a) * 260}px, ${Math.sin(a) * 200 + 160}px) rotate(${(i % 2 ? 1 : -1) * (30 + i * 12)}deg) scale(0.8)`, opacity: 0 },
        ],
        { duration: 700, easing: "cubic-bezier(0.3, 0.6, 0.6, 1)", fill: "forwards" },
      );
    });
  }

  /** Skip during a MYTHIC: a 1.5 s cut ("You can't skip destiny."). */
  private async mythicCut(g: number): Promise<void> {
    const r = this.results[this.mythicIdx];
    const el = this.el;
    const my = this.q(".sm-myth");
    const c = this.centre();
    this.meteor = null;
    el.classList.remove("s-meteor", "s-wait", "s-circle", "s-splash");
    this.q(".sm-splash").hidden = true;
    if (my.hidden || !my.innerHTML) {
      my.hidden = false;
      my.innerHTML = `
        ${crackSvg(c.x, c.y, innerWidth, innerHeight)}
        <div class="my-band" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="my-art">${itemArt(r.item, "my-img", r.item.kind === "hero" ? 1 : 0)}</div>
        <div class="my-tx"><b class="my-title">${esc(RARITY_TITLE.MYTHIC)}</b><b class="my-name">${esc(r.item.name)}</b><span class="my-chip">${resultChip(r)}</span></div>`;
      this.sfx("gachaMythicGlitch");
    }
    my.querySelector(".my-win")?.remove();
    el.classList.add("s-myth", "m-crack", "m-boom", "m-title", "m-cut");
    this.host.music("none", 0);
    this.musicCut = true;
    this.line(C.CANT_SKIP, "destiny");
    this.after(0.2, () => this.sfx("gachaMythicBoom"));
    this.flash(1, 380);
    this.fx?.confetti(c.x, c.y, 120, RAINBOW);
    this.mythicShown = true;
    if (!(await this.sleep(1.5, g))) return;
    this.musicBack();
    this.toastAchievements(["mythic"]);
    my.hidden = true;
    el.classList.remove("s-myth", "m-crack", "m-boom", "m-title", "m-cut");
    this.line("");
    this.summary();
  }

  // ================================================================ skip / summary / close
  skip(): void {
    if (this.closed || this.done) return;
    this.cancel();
    this.sfx("uiBack", 0.7);
    if (this.mythicIdx >= 0 && !this.mythicShown) {
      void this.mythicCut(this.gen);
      return;
    }
    this.summary();
  }

  private summary(): void {
    if (this.done || this.closed) return;
    this.done = true;
    this.cancel();
    this.meteor = null;
    const el = this.el;
    el.classList.remove("s-meteor", "s-wait", "s-splash", "s-myth", "s-skip", "s-circle");
    this.q(".sm-splash").hidden = true;
    this.q(".sm-myth").hidden = true;
    if (this.musicCut) this.musicBack();
    el.classList.add("s-cap", "s-crack", "s-cards", "done");
    for (let i = 0; i < this.cards.length; i++) this.flip(i, true);
    // LOST / WON the 50/50 is never lost to a skip
    if (this.results.some((r) => r.lost5050)) this.lost5050();
    else if (this.results.some((r) => r.won5050)) this.won5050();
    this.prepareSummary();
    this.ticker();
    const ok = this.q('[data-act="ok"]');
    this.host.nav.refocus(this.layer, ok);
  }

  /**
   * Fill the summary bar (dupe notes, the ticker at +0) and reserve its height
   * for the card grid, BEFORE the cards are dealt: the grid never jumps when
   * the summary slides in. One layout read.
   */
  private prepareSummary(): void {
    if (this.summaryReady) return;
    this.summaryReady = true;
    const notes = this.results
      .map((r) => noteFor(r, this.o.cones ?? 0))
      .filter((x): x is Note => !!x)
      .sort((a, b) => b.pri - a.pri);
    const shown = notes.slice(0, this.results.length > 1 ? 2 : 2);
    this.q(".sm-notes").innerHTML =
      shown.map((n) => `<p class="sm-note"><b>${esc(n.t)}</b>${n.s ? ` <small>${esc(n.s)}</small>` : ""}</p>`).join("") + (notes.length > shown.length ? `<p class="sm-note more"><small>+${notes.length - shown.length} more (tap a card)</small></p>` : "");
    const t = this.q(".sm-tick");
    const cons = this.consolation();
    const over = this.results.reduce((s, r) => s + r.copium, 0);
    const gems = this.out.codexGems;
    const extra = `${over > 0 ? `<span class="tk-x">${money("copium", `+${fmtInt(over)}`)} <small>overflow</small></span>` : ""}${gems > 0 ? `<span class="tk-x">${money("gems", `+${fmtInt(gems)}`)} <small>codex bounty</small></span>` : ""}`;
    t.innerHTML = cons > 0 ? `<span class="tk-main"><span class="tk-v">${esc(C.consolation(0))}</span></span>${extra}` : extra;
    const hgt = this.q(".sm-sum").offsetHeight;
    if (hgt > 0) this.el.style.setProperty("--sumh", `${hgt + 8}px`);
  }

  private consolation(): number {
    return this.o.mode === "pull" ? this.results.length * TUNING.gacha.copiumPerPull : 0;
  }

  /** "+10 Copium (consolation)" counts up (countTick per step, payoutTotal at the end). */
  private ticker(): void {
    const cons = this.consolation();
    if (cons <= 0) return;
    const v = this.q(".sm-tick .tk-v");
    if (this.rm) {
      v.textContent = C.consolation(cons);
      return;
    }
    let i = 0;
    const steps = Math.min(cons, 10);
    const step = () => {
      if (this.closed) return;
      i++;
      const n = Math.round((cons * i) / steps);
      v.textContent = C.consolation(n);
      if (i < steps) {
        this.sfx("countTick", 0.6, i * 0.6);
        window.setTimeout(step, 55);
      } else {
        this.sfx("payoutTotal", 0.8);
        v.parentElement?.animate([{ transform: "scale(1.25)" }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(0.3, 1.8, 0.5, 1)" });
      }
    };
    window.setTimeout(step, 260);
  }

  /** Plot Point toasts (`only`: just these ids now; null: everything not toasted yet). */
  private toastAchievements(only: string[] | null): void {
    const list = this.o.achievements ?? [];
    let any = false;
    for (const a of list) {
      if (this.toastsShown.has(`a:${a.def.id}`)) continue;
      if (only && !only.includes(a.def.id)) continue;
      this.toastsShown.add(`a:${a.def.id}`);
      this.host.toast(a.def.name, { kind: "ach", kicker: "PLOT POINT UNLOCKED!", icon: trophyIcon("kt-img"), sub: a.def.desc });
      any = true;
    }
    if (any) this.sfx("achievement", 0.8);
  }

  /** Tap a summary card: its dupe line. */
  private inspect(i: number): void {
    if (!this.done || this.closed) return;
    const r = this.results[i];
    if (!r) return;
    const n = noteFor(r, this.o.cones ?? 0);
    const line = n ?? { t: `${r.item.name} · ${r.rarity}`, s: pick(`rs:${r.rarity}`, RARITY_SUBTITLES[r.rarity] ?? []), pri: 0 };
    this.q(".sm-notes").innerHTML = `<p class="sm-note sel"><b>${esc(line.t)}</b>${line.s ? ` <small>${esc(line.s)}</small>` : ""}</p>`;
    this.sfx("uiMove", 0.6);
    const c = this.cards[i];
    c.animate([{ transform: "scale(1)" }, { transform: "scale(1.08) rotate(-2deg)", offset: 0.4 }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(0.3, 1.8, 0.5, 1)" });
  }

  private again(): void {
    if (!this.o.again || this.closed) return;
    const run = this.o.again.run;
    this.close(false);
    run();
  }

  close(notify = true): void {
    if (this.closed) return;
    if (!this.done) this.summary();
    this.closed = true;
    this.cancel();
    stopAnimating(this);
    setDebugStepper(null);
    this.fx?.dispose();
    if (this.musicCut) {
      this.musicCut = false;
      this.host.music("gacha", 0.4);
    }
    document.querySelector(".merch .bnr-machine")?.classList.remove("crank");
    this.host.nav.remove(this.layer);
    this.el.classList.add("out");
    this.el.style.pointerEvents = "none";
    window.setTimeout(() => this.el.remove(), 230);
    trackOverlay(-1);
    this.host.overlayClosed();
    if (notify) this.host.sfx("uiBack");
    // Plot Points land on the page (the summary grid stays readable)
    this.toastAchievements(null);
    this.o.onClose();
  }
}

// ================================================================== result copy

/** Chip on a card / the splash: what the copy became. */
export function resultChip(r: PullResult): string {
  if (r.result === "new") return tag(r.item.kind === "hero" ? "NEW HERO!" : "NEW!", "gold");
  if (r.result === "star") return tag(r.level >= 6 ? "MAX ★!" : `★ UP! ★${r.level}`, r.level >= 6 ? "gold" : "pink");
  if (r.result === "constellation") return tag(`C${r.level}${r.level >= 6 ? " FINAL FORM" : " UNLOCKED"}`, "rainbow");
  return tag(`+${fmtInt(r.copium)} COPIUM`, "cyan");
}

/** The dupe / star-up line of a result (gacha.md §5.2), or null for a plain new item. */
export function noteFor(r: PullResult, cones: number): Note | null {
  const name = r.item.name;
  if (r.item.kind === "hero") {
    if (r.result === "new") return { t: C.newHero(name), s: "", pri: 9 };
    if (r.result === "copium") return { ...C.heroOverflow(name, r.copium), pri: 3 };
    const d = heroDef(r.item.id);
    const st = d?.constellations?.[r.level - 1];
    if (r.level >= 6) return { t: `${C.consteLine(6, st?.name ?? "Fully Awakened (Final Form)")}`, s: `${C.HERO_FINAL.t}: ${st?.desc ?? ""} ${C.HERO_FINAL.s}`.trim(), pri: 8 };
    return { t: C.consteLine(r.level, st?.name ?? `C${r.level}`), s: [st?.desc, C.CONSTE_SUB[r.level - 1]].filter(Boolean).join(" · "), pri: 7 };
  }
  if (r.result === "new") return null;
  if (r.item.id === "traffic_cone" && cones >= C.CONE_OMEN) return { t: C.CONE_DUPE, s: "", pri: 2 };
  if (r.result === "copium") {
    const o = C.relicOverflow(name, r.copium);
    return { ...o, pri: 2 };
  }
  if (r.level >= 6) return { ...C.relicMax(name), pri: 6 };
  return { ...C.relicStarUp(name, r.level), pri: 1 + rarityIdx(r.rarity) * 0.1 };
}

/** Jagged cracks from the impact point to the edges (SVG, drawn by stroke-dashoffset once). */
function crackSvg(cx: number, cy: number, W: number, H: number): string {
  const lines: string[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const len = Math.hypot(W, H) * (0.45 + Math.random() * 0.3);
    let x = cx;
    let y = cy;
    const pts = [`${x.toFixed(0)},${y.toFixed(0)}`];
    const segs = 6 + ((Math.random() * 4) | 0);
    for (let s = 1; s <= segs; s++) {
      const d = (len / segs) * s;
      const j = (Math.random() - 0.5) * 0.5;
      x = cx + Math.cos(a + j) * d;
      y = cy + Math.sin(a + j) * d;
      pts.push(`${x.toFixed(0)},${y.toFixed(0)}`);
      if (s === 2 || s === 4) {
        const b = a + (Math.random() < 0.5 ? -0.7 : 0.7);
        const bx = x + Math.cos(b) * len * 0.18;
        const by = y + Math.sin(b) * len * 0.18;
        lines.push(`<polyline class="br" points="${x.toFixed(0)},${y.toFixed(0)} ${bx.toFixed(0)},${by.toFixed(0)}"/>`);
      }
    }
    lines.push(`<polyline points="${pts.join(" ")}"/>`);
  }
  return `<svg class="my-crack" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><g class="glow">${lines.join("")}</g><g class="core">${lines.join("")}</g></svg>`;
}
