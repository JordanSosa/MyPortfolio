/**
 * In-game HUD (DESIGN §7): XP bar + level badge, timer, kills + coins, owned
 * weapon/passive icons, combo counter with rank stamps, boss HP bar,
 * banners (WARNING / INCOMING / ELITE / EVOLUTION / boss name card with
 * letterbox bars), low-HP danger border, the SSS rainbow screen border,
 * onboarding hints / bubbles and the run-start READY?/GO! stinger. Pause
 * button top-right. Keyboard / mouse / gamepad play: the Overdrive gauge
 * bottom-right (hud-overdrive.ts; touch has the OVERDRIVE button instead).
 *
 * Performance rules (it runs every frame on phones):
 *  - every write is diffed; bars are quantised (1/400) and use pre-built
 *    transform strings, so steady play allocates nothing;
 *  - counter text (kills / coins / combo) is written at most 15x per second;
 *  - juice (bump / pop / stamp / shim) is WAAPI via `Bump` (no class
 *    replays, no forced reflow), rate-limited per element;
 *  - weapon / passive slots are reused: only a new item creates a node.
 */
import { CFG, RANKS } from "../game/config";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import type { FeedbackHooks } from "../view/feedback";
import { Bump, fmtNum, fmtTime, h, img, sprite } from "./dom";
import { HudArsenal2 } from "./hud-arsenal2";
import { HudOverdrive } from "./hud-overdrive";

/** Pre-built `scaleX(i / 400)` strings (bars are quantised to 1/400). */
const SCALE: string[] = Array.from({ length: 401 }, (_, i) => `scaleX(${i / 400})`);
/** Counter text refresh interval (s): at most 15 writes per second. */
const TEXT_DT = 1 / 15;
/** The boss bar's white "ghost" catches up once the HP has held still this long (s). */
const GHOST_HOLD = 0.2;

const E_POP = "cubic-bezier(0.3, 2, 0.5, 1)";
const K_POP: Keyframe[] = [
  { transform: "scale(1)", easing: E_POP },
  { transform: "scale(1.45) rotate(-8deg)", offset: 0.35, easing: E_POP },
  { transform: "scale(1)" },
];
const O_POP: KeyframeAnimationOptions = { duration: 500 };
const K_CBUMP: Keyframe[] = [
  { transform: "none", easing: "ease-out" },
  { transform: "scale(1.22) rotate(-4deg)", offset: 0.4, easing: "ease-out" },
  { transform: "none" },
];
const O_CBUMP: KeyframeAnimationOptions = { duration: 180 };
const K_CDROP: Keyframe[] = [
  { transform: "none", color: "#ffffff", easing: "ease-out" },
  { transform: "translateX(-5px) rotate(5deg) scale(0.9)", color: "#ff4d6d", offset: 0.25, easing: "ease-out" },
  { transform: "translateX(3px) rotate(-2deg)", offset: 0.6, easing: "ease-out" },
  { transform: "none", color: "#ffffff" },
];
const O_CDROP: KeyframeAnimationOptions = { duration: 400 };
const K_COIN: Keyframe[] = [
  { transform: "none", easing: "ease-out" },
  { transform: "scale(1.25)", offset: 0.4, easing: "ease-out" },
  { transform: "none" },
];
const O_COIN: KeyframeAnimationOptions = { duration: 250 };
const K_SHIM: Keyframe[] = [
  { transform: "translateX(-133%)", opacity: 1 },
  { transform: "translateX(367%)", opacity: 0.4 },
];
const O_SHIM: KeyframeAnimationOptions = { duration: 450, easing: "ease-out" };
/** The C..SS rank glyph outline (matches `.combo .rank` in styles.css). */
const RANK_DROP = "drop-shadow(0 3px 0 #2d1b45) drop-shadow(2px 0 0 #2d1b45) drop-shadow(-2px 0 0 #2d1b45) drop-shadow(0 -2px 0 #2d1b45) drop-shadow(0 0 6px rgba(255, 225, 77, 0.6))";
const E_STAMP = "cubic-bezier(0.2, 1.6, 0.4, 1)";
const K_STAMP: Keyframe[] = [
  { transform: "rotate(-30deg) scale(3)", opacity: 0, easing: E_STAMP },
  { transform: "rotate(-8deg) scale(0.9)", opacity: 1, offset: 0.6, easing: E_STAMP },
  { transform: "rotate(-12deg) scale(1)", opacity: 1 },
];
const O_STAMP: KeyframeAnimationOptions = { duration: 420 };
const K_FALL: Keyframe[] = [
  { transform: "translateY(-0.5em) rotate(-24deg) scale(1.3)", filter: `${RANK_DROP} brightness(0.6) sepia(1) hue-rotate(-40deg) saturate(4)`, easing: "cubic-bezier(0.3, 1.4, 0.5, 1)" },
  { transform: "rotate(-12deg) scale(1)", filter: `${RANK_DROP} brightness(1) sepia(0) hue-rotate(0deg) saturate(1)` },
];
const O_FALL: KeyframeAnimationOptions = { duration: 450 };
/** One-shot shine sweep through the rank glyph's gradient fill, right after the stamp lands. */
const K_SWEEP: Keyframe[] = [{ backgroundPosition: "130% 0" }, { backgroundPosition: "-30% 0" }];
const O_SWEEP: KeyframeAnimationOptions = { duration: 650, delay: 360, easing: "ease-in-out" };
const K_LB_TOP: Keyframe[] = [
  { transform: "translateY(-100%)", easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" },
  { transform: "none", offset: 0.12 },
  { transform: "none", offset: 0.86, easing: "ease-in" },
  { transform: "translateY(-100%)" },
];
const K_LB_BOT: Keyframe[] = K_LB_TOP.map((k) => ({ ...k, transform: k.transform === "none" ? "none" : "translateY(100%)" }));
const O_LB: KeyframeAnimationOptions = { duration: 2100 };

interface Slot {
  el: HTMLElement;
  img: HTMLImageElement;
  lv: HTMLElement;
  id: string;
  lvText: string;
}

type BubbleId = "dash" | "ult" | "tip";
interface Bubble {
  el: HTMLElement;
  /** Selector of the element it points at (null: a free pill above the bottom edge). */
  anchor: string | null;
  /** Seconds left (real time, paused under modals); <= 0 = until hidden. */
  ttl: number;
}

export class Hud implements FeedbackHooks {
  readonly root: HTMLElement;
  private xp: HTMLElement;
  private xpFill: HTMLElement;
  private lvl: HTMLElement;
  private timer: HTMLElement;
  private killsN: HTMLElement;
  private coinsN: HTMLElement;
  private wRow: HTMLElement;
  private pRow: HTMLElement;
  private combo: HTMLElement;
  private comboN: HTMLElement;
  private comboBar: HTMLElement;
  private comboRankEl: HTMLElement;
  private comboMult: HTMLElement;
  private boss: HTMLElement;
  private bossFill: HTMLElement;
  private bossGhost: HTMLElement;
  private bossName: HTMLElement;
  private danger: HTMLElement;
  private sss: HTMLElement;
  private bannerEl: HTMLElement;
  private warn: HTMLElement;
  private lbTop: HTMLElement;
  private lbBot: HTMLElement;
  private warnT = 0;
  private bossEnemy: Enemy | null = null;
  // juice (WAAPI, created once)
  private bLvl: Bump;
  private bCombo: Bump;
  private bDrop: Bump;
  private bCoin: Bump;
  private bShim: Bump;
  private bStamp: Bump;
  private bFall: Bump;
  private bSweep: Bump;
  // reused build slots
  private wSlots: Slot[] = [];
  /** Lightstick beat pulse + Thousand Crane Wish counter on the weapon slots (hud-arsenal2.ts). */
  private readonly a2 = new HudArsenal2();
  /** Overdrive gauge for non-touch play (hud-overdrive.ts). */
  private readonly od: HudOverdrive;
  private pSlots: Slot[] = [];
  // diff cache
  private c = { lvl: -1, sec: -1, kills: -1, coins: -1, bv: -1, combo: -1, comboShown: -1, rank: -2, xpk: -1, full: false, barQ: -1, hot: false, bossQ: -1, ghostQ: -1, warn: false, dirWarn: false, danger: false, sss: false };
  private textT = 0;
  private bossHold = 0;
  private bannerT = 0;
  private modalOpen = false;
  // onboarding
  private hintEl: HTMLElement | null = null;
  private bubbles = new Map<BubbleId, Bubble>();
  /** First-runs OVERDRIVE bubble (set by the tutorial; null = none). */
  ultHint: { html: string; anchor: string | null; shown: () => void } | null = null;
  private stampEl: HTMLElement | null = null;

  constructor(parent: HTMLElement, onPause: () => void) {
    const r = h("div", "hud hidden");
    r.innerHTML = `
      <div class="letterbox"><i class="lb-t"></i><i class="lb-b"></i></div>
      <div class="danger"></div>
      <div class="warn-border"></div>
      <div class="sss-border"></div>
      <div class="xpbar"><div class="fill"></div><div class="shim"></div></div>
      <div class="lvl">1</div>
      <div class="hud-row">
        <div class="icons"><div class="row w"></div><div class="row p"></div></div>
        <div class="timer">00:00</div>
        <div class="stats">
          <div class="stat kills">${img("icon_skull")}<span>0</span></div>
          <div class="stat coin">${img("icon_coin")}<span>0</span></div>
        </div>
      </div>
      <div class="bossbar"><div class="bb-name"></div><div class="track"><div class="ghost"></div><div class="fill"></div></div></div>
      <div class="combo"><span class="rank"></span><span class="n">0</span><span class="lbl">COMBO</span><div class="bar"></div><span class="mult"></span></div>
      <div class="banner"></div>`;
    // the pause button never keeps keyboard focus (Enter / Space must reach the game, not re-click it)
    const pause = h("button", "pause-btn", '<span class="pb"></span>');
    pause.tabIndex = -1;
    pause.setAttribute("aria-label", "Pause");
    pause.setAttribute("data-ui", "");
    pause.addEventListener("click", (e) => {
      e.stopPropagation();
      pause.blur();
      onPause();
    });
    r.appendChild(pause);
    this.od = new HudOverdrive(r);
    parent.appendChild(r);
    this.root = r;
    const q = (s: string) => r.querySelector(s) as HTMLElement;
    this.xp = q(".xpbar");
    this.xpFill = q(".xpbar .fill");
    this.lvl = q(".lvl");
    this.timer = q(".timer");
    this.killsN = q(".stat.kills span");
    this.coinsN = q(".stat.coin span");
    this.wRow = q(".icons .w");
    this.pRow = q(".icons .p");
    this.combo = q(".combo");
    this.comboN = q(".combo .n");
    this.comboBar = q(".combo .bar");
    this.comboRankEl = q(".combo .rank");
    this.comboMult = q(".combo .mult");
    this.boss = q(".bossbar");
    this.bossFill = q(".bossbar .fill");
    this.bossGhost = q(".bossbar .ghost");
    this.bossName = q(".bossbar .bb-name");
    this.danger = q(".danger");
    this.sss = q(".sss-border");
    this.bannerEl = q(".banner");
    this.warn = q(".warn-border");
    this.lbTop = q(".letterbox .lb-t");
    this.lbBot = q(".letterbox .lb-b");
    this.bLvl = new Bump(this.lvl, K_POP, O_POP, 0);
    this.bCombo = new Bump(this.comboN, K_CBUMP, O_CBUMP);
    this.bDrop = new Bump(this.comboN, K_CDROP, O_CDROP, 0);
    this.bCoin = new Bump(q(".stat.coin"), K_COIN, O_COIN);
    this.bShim = new Bump(q(".xpbar .shim"), K_SHIM, O_SHIM);
    this.bStamp = new Bump(this.comboRankEl, K_STAMP, O_STAMP, 0);
    this.bFall = new Bump(this.comboRankEl, K_FALL, O_FALL, 0);
    this.bSweep = new Bump(this.comboRankEl, K_SWEEP, O_SWEEP, 0);
    window.addEventListener("resize", () => this.placeBubbles());
  }

  show(on: boolean): void {
    this.root.classList.toggle("hidden", !on);
  }

  reset(): void {
    this.c = { lvl: -1, sec: -1, kills: -1, coins: -1, bv: -1, combo: -1, comboShown: -1, rank: -2, xpk: -1, full: false, barQ: -1, hot: false, bossQ: -1, ghostQ: -1, warn: false, dirWarn: false, danger: false, sss: false };
    this.textT = 0;
    this.bossEnemy = null;
    this.boss.classList.remove("on");
    this.combo.classList.remove("on", "shatter");
    this.bannerEl.className = "banner";
    this.bannerEl.innerHTML = "";
    this.bannerT = 0;
    this.sss.classList.remove("on");
    this.danger.classList.remove("on");
    this.warn.classList.remove("on");
    this.warnT = 0;
    this.setModalOpen(false);
    for (const s of this.wSlots) s.el.remove();
    for (const s of this.pSlots) s.el.remove();
    this.wSlots.length = this.pSlots.length = 0;
    this.hintEl?.remove();
    this.hintEl = null;
    for (const id of [...this.bubbles.keys()]) this.hideBubble(id, true);
    this.ultHint = null;
    this.intro(false);
    this.root.classList.remove("intro");
    this.xp.classList.remove("full");
    this.comboRankEl.textContent = "";
    this.comboMult.textContent = "";
    this.od.reset();
  }

  /** Re-render icons (art may have changed after a hot reload / context restore). */
  refreshIcons(): void {
    this.c.bv = -1;
    for (const s of this.wSlots) s.id = "";
    for (const s of this.pSlots) s.id = "";
  }

  update(w: World, realDt: number): void {
    const c = this.c;
    // XP
    const full = w.pendingLevels > 0;
    const kq = full ? 400 : Math.round(Math.min(1, w.xp / w.xpNext) * 400);
    if (kq !== c.xpk) {
      c.xpk = kq;
      this.xpFill.style.transform = SCALE[kq];
    }
    if (full !== c.full) {
      c.full = full;
      this.xp.classList.toggle("full", full);
    }
    if (w.level !== c.lvl) {
      if (c.lvl > 0) this.bLvl.play(true);
      c.lvl = w.level;
      this.lvl.textContent = String(w.level);
    }
    const sec = Math.floor(w.t);
    if (sec !== c.sec) {
      c.sec = sec;
      this.timer.textContent = fmtTime(w.t);
      this.timer.classList.toggle("boss", !!w.boss);
    }
    // counters: at most 15 text writes per second (the final value lands on the next tick)
    this.textT += realDt;
    const textTick = this.textT >= TEXT_DT;
    if (textTick) {
      this.textT = 0;
      if (w.kills !== c.kills) {
        c.kills = w.kills;
        this.killsN.textContent = fmtNum(w.kills);
      }
      const coins = Math.floor(w.coins);
      if (coins !== c.coins) {
        c.coins = coins;
        this.coinsN.textContent = fmtNum(coins);
      }
    }
    // build icons: slots are reused, only a new weapon / passive creates a node
    if (w.buildVersion !== c.bv) {
      c.bv = w.buildVersion;
      this.syncSlots(this.wSlots, this.wRow, w.weapons.length, (i) => {
        const wi = w.weapons[i];
        return [wi.def.id, wi.def.icon, wi.def.evolved ? "★" : String(wi.level), wi.def.evolved ? "slot evo" : "slot"];
      });
      this.syncSlots(this.pSlots, this.pRow, w.passives.length, (i) => {
        const p = w.passives[i];
        return [p.def.id, p.def.icon, String(p.level), "slot ps"];
      });
    }
    this.a2.update(w, this.wSlots, realDt);
    this.od.update(w.ultMeter / CFG.ultMax, w.ultReady, realDt);
    // combo
    const cb = w.combo;
    if (cb >= 3) {
      if (!this.combo.classList.contains("on") || this.combo.classList.contains("shatter")) {
        this.combo.classList.remove("shatter");
        this.combo.classList.add("on");
      }
      if (textTick && cb !== c.comboShown) {
        c.comboShown = cb;
        this.comboN.textContent = String(cb);
        this.bCombo.play();
      }
      // the window shrinks at high ranks: the bar visibly drains unless kills keep feeding it
      const q = Math.round(Math.min(1, Math.max(0, w.comboTimer / w.comboWindow)) * 200) * 2;
      if (q !== c.barQ) {
        c.barQ = q;
        this.comboBar.style.transform = SCALE[q];
      }
      const hot = w.comboRank >= 3;
      if (hot !== c.hot) {
        c.hot = hot;
        this.comboBar.classList.toggle("hot", hot);
      }
    } else c.comboShown = -1;
    c.combo = cb;
    if (w.comboRank !== c.rank) {
      // a lower rank that is still a rank = the combo fell one step (timer ran dry / got hit)
      const fell = w.comboRank >= 0 && w.comboRank < c.rank;
      c.rank = w.comboRank;
      if (w.comboRank >= 0) {
        const rk = RANKS[w.comboRank];
        this.comboRankEl.textContent = rk.id;
        this.comboRankEl.className = `rank r${w.comboRank}`;
        if (fell) {
          this.bFall.play(true);
          this.bDrop.play(true);
        } else {
          this.bStamp.play(true);
          if (w.comboRank < RANKS.length - 1) this.bSweep.play(true);
          else this.bSweep.cancel();
        }
        this.comboMult.textContent = `XP x${rk.mult.toFixed(2)}`;
      } else {
        this.comboRankEl.textContent = "";
        this.comboMult.textContent = "";
      }
      const sss = w.comboRank >= RANKS.length - 1;
      if (sss !== c.sss) {
        c.sss = sss;
        this.sss.classList.toggle("on", sss);
      }
    }
    // boss bar: quantised, written on change; the ghost catches up after the HP holds for 0.2 s
    const b = this.bossEnemy;
    if (b) {
      if (b.dead || !b.def.boss) this.bossBar(null);
      else {
        const q = Math.round(Math.max(0, Math.min(1, b.hp / b.maxHp)) * 400);
        if (q !== c.bossQ) {
          c.bossQ = q;
          this.bossFill.style.transform = SCALE[q];
          this.bossHold = 0;
        } else if (c.ghostQ !== q) {
          this.bossHold += realDt;
          if (this.bossHold >= GHOST_HOLD) {
            c.ghostQ = q;
            this.bossGhost.style.transform = SCALE[q];
          }
        }
      }
    }
    // low HP
    const low = w.player.hp / w.player.maxHp < 0.3 && w.phase === "play";
    if (low !== c.danger) {
      c.danger = low;
      this.danger.classList.toggle("on", low);
    }
    // boss warning border: follows the director's countdown (ends when the boss arrives);
    // timers never run down under a modal, so the WARNING never burns out behind a level-up
    const dirWarn = w.director.warning !== null;
    if (c.dirWarn && !dirWarn) this.warnT = 0;
    c.dirWarn = dirWarn;
    const open = this.modalOpen;
    if (!open && this.warnT > 0) this.warnT -= realDt;
    const warnOn = dirWarn || this.warnT > 0;
    if (warnOn !== c.warn) {
      c.warn = warnOn;
      this.warn.classList.toggle("on", warnOn);
    }
    if (!open && this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) {
        // (clear the text too: without the animation class it would sit on screen, unanimated)
        this.bannerEl.className = "banner";
        this.bannerEl.innerHTML = "";
      }
    }
    // onboarding bubbles
    if (this.bubbles.size) {
      const ub = this.bubbles.get("ult");
      if (ub && (w.ult || !w.ultReady)) this.hideBubble("ult");
      if (!open) {
        for (const [id, bb] of this.bubbles) {
          if (bb.ttl <= 0) continue;
          bb.ttl -= realDt;
          if (bb.ttl <= 0) this.hideBubble(id);
        }
      }
    }
  }

  private syncSlots(slots: Slot[], row: HTMLElement, n: number, info: (i: number) => [string, string, string, string]): void {
    for (let i = 0; i < n; i++) {
      const [id, icon, lv, cls] = info(i);
      let s = slots[i];
      let pop = false;
      if (!s) {
        const el = h("div", cls, '<img class="px" alt="" draggable="false"><span class="lv"></span>');
        s = { el, img: el.firstElementChild as HTMLImageElement, lv: el.lastElementChild as HTMLElement, id: "", lvText: "" };
        slots.push(s);
        row.appendChild(el);
        // the very first build of a run (starting weapon) appears without the pop
        pop = this.c.lvl > 1 || i > 0;
      }
      if (s.id !== id) {
        if (s.id) pop = true; // evolution replaced the weapon in place
        s.id = id;
        s.img.src = sprite(icon);
      }
      if (s.el.className !== cls) s.el.className = cls;
      if (s.lvText !== lv) {
        s.lvText = lv;
        s.lv.textContent = lv;
      }
      if (pop && typeof s.el.animate === "function") s.el.animate(K_POP, O_POP);
    }
    while (slots.length > n) slots.pop()?.el.remove();
  }

  /** A modal is open on top: hints / bubbles hide, banner + warning timers (and CSS) pause until it closes. */
  setModalOpen(on: boolean): void {
    this.modalOpen = on;
    this.root.classList.toggle("modal-open", on);
    if (!on) this.placeBubbles();
  }

  /**
   * The Overdrive gauge (App, every frame): shown while the touch controls are not (keyboard / mouse /
   * gamepad play), `pad` = the gamepad's button label. Re-anchors the onboarding bubbles when it appears /
   * disappears (they point at it, or at the touch button).
   */
  overdriveGauge(show: boolean, pad: boolean): void {
    if (this.od.mode(show, pad) && this.bubbles.size) this.placeBubbles();
  }

  /** Overdrive pressed before it is charged: the gauge shakes (the touch button's deny). */
  denyOverdrive(): void {
    this.od.deny();
  }

  /** Take keyboard focus away from HUD buttons (so Enter / Space never re-click the pause button). */
  blurButtons(): void {
    const a = document.activeElement;
    if (a instanceof HTMLElement && this.root.contains(a)) a.blur();
  }

  // ---------------------------------------------------------------- onboarding
  /**
   * Onboarding pill below the hero. `html` may contain <b>. Timed hints fade out
   * by themselves (their CSS lifetime pauses under modals); sticky ones stay until hideHint().
   */
  hint(html: string, sticky = false): void {
    this.hintEl?.remove();
    const el = h("div", sticky ? "hint-pill sticky" : "hint-pill", html);
    this.root.appendChild(el);
    this.hintEl = el;
    el.addEventListener("animationend", (e) => {
      if (e.target !== el) return;
      if (!sticky || el.classList.contains("out")) {
        el.remove();
        if (this.hintEl === el) this.hintEl = null;
      }
    });
  }

  /** Fade the onboarding pill out. */
  hideHint(): void {
    this.hintEl?.classList.add("out");
  }

  /**
   * A speech bubble pointing at a touch button (`anchor` selector, e.g. ".kk-dash"; a selector list points
   * at the first of them on screen, e.g. the OVERDRIVE button or else the HUD's Overdrive gauge),
   * or a free pill above the bottom edge when `anchor` is null / not on screen.
   * `ttl` > 0 hides it after that many real seconds (paused under modals).
   */
  bubble(id: BubbleId, html: string, anchor: string | null, ttl = 0): void {
    this.hideBubble(id, true);
    const el = h("div", `tut-bubble b-${id}`, html);
    this.root.appendChild(el);
    this.bubbles.set(id, { el, anchor, ttl });
    this.placeBubble(el, anchor);
  }

  hideBubble(id: BubbleId, now = false): void {
    const b = this.bubbles.get(id);
    if (!b) return;
    this.bubbles.delete(id);
    if (now) b.el.remove();
    else {
      b.el.classList.add("out");
      setTimeout(() => b.el.remove(), 260);
    }
  }

  hasBubble(id: BubbleId): boolean {
    return this.bubbles.has(id);
  }

  /** Re-anchor the bubbles (resize, touch controls shown / hidden). Reads layout: not per frame. */
  placeBubbles(): void {
    for (const b of this.bubbles.values()) this.placeBubble(b.el, b.anchor);
  }

  private placeBubble(el: HTMLElement, anchor: string | null): void {
    let r: DOMRect | null = null;
    if (anchor)
      for (const a of document.querySelectorAll<HTMLElement>(anchor)) {
        const ar = a.getBoundingClientRect();
        if (ar.width >= 1) {
          r = ar;
          break;
        }
      }
    const s = el.style;
    if (!r) {
      el.classList.add("free");
      s.right = s.top = "";
      s.removeProperty("--avail");
      return;
    }
    // to the left of the button, vertically centred on it, arrow pointing right; the CSS caps its
    // width to the room left of the button minus the left safe area (--avail)
    el.classList.remove("free");
    s.right = `${Math.round(window.innerWidth - r.left + 14)}px`;
    s.top = `${Math.round(r.top + r.height / 2)}px`;
    s.setProperty("--avail", `${Math.max(120, Math.round(r.left - 14))}px`);
  }

  /** Pulse a touch button (first-runs DASH lesson). */
  pulseButton(sel: string, on: boolean): void {
    document.querySelector(sel)?.classList.toggle("tut-pulse", on);
  }

  // ---------------------------------------------------------------- run-start stinger
  /** READY? stamp + HUD fly-in (on) / clean up (off). */
  intro(on: boolean): void {
    if (on) {
      this.stampEl?.remove();
      this.root.classList.add("intro");
      const el = h("div", "go-stamp", "<span>READY?</span>");
      this.root.appendChild(el);
      this.stampEl = el;
    } else {
      this.root.classList.remove("intro");
      this.stampEl?.remove();
      this.stampEl = null;
    }
  }

  /** READY? -> GO! */
  introGo(): void {
    const el = this.stampEl;
    if (!el) return;
    el.classList.add("go");
    el.innerHTML = "<span>GO!</span>";
  }

  // ---------------------------------------------------------------- feedback hooks
  xpPulse(): void {
    this.bShim.play();
  }
  coinPulse(): void {
    this.bCoin.play();
  }
  comboRank(): void {
    /* handled in update (diffed) */
  }
  comboBreak(count: number): void {
    if (count >= 3) {
      this.combo.classList.add("shatter");
      setTimeout(() => {
        if (this.c.combo < 3) this.combo.classList.remove("on", "shatter");
      }, 480);
    } else this.combo.classList.remove("on");
  }
  banner(kind: "warning" | "incoming" | "evolution" | "boss" | "elite" | "info", title: string, sub = ""): void {
    // a fresh element per banner restarts its CSS animation without a forced reflow
    const el = h("div", "banner");
    this.bannerEl.replaceWith(el);
    this.bannerEl = el;
    if (kind === "warning") {
      this.warnT = 3;
      el.innerHTML = `<div class="hazard"></div><div class="bt">${title}</div><div class="bs">${sub}</div><div class="hazard"></div>`;
      this.bannerT = 3;
    } else if (kind === "boss") {
      // cinematic name card: on a dark plate (readable over bloom) under the boss bar, letterbox bars slide in
      el.innerHTML = `<div class="plate"><div class="bt">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ""}</div>`;
      this.bannerT = 2;
      if (typeof this.lbTop.animate === "function") {
        this.lbTop.animate(K_LB_TOP, O_LB);
        this.lbBot.animate(K_LB_BOT, O_LB);
      }
    } else {
      el.innerHTML = `<div class="bt">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ""}`;
      this.bannerT = 2;
    }
    // a boss fights from the upper half of the screen (Lady Lunatic hovers above the hero): while one is
    // alive, banners drop below the hero and shrink so they never hide it or its bullets
    const low = !!this.bossEnemy && kind !== "boss";
    el.className = `banner b-${kind}${low ? " low" : ""} show`;
  }
  bossBar(e: Enemy | null, title = ""): void {
    this.bossEnemy = e;
    this.boss.classList.toggle("on", !!e);
    if (e) {
      this.bossName.textContent = title;
      // long titles ("THE BISHOUNEN WHO NEVER NOTICES YOU") set tighter so they stay on one line above the bar
      this.bossName.classList.toggle("long", title.length > 24);
      this.bossFill.style.transform = SCALE[400];
      this.bossGhost.style.transform = SCALE[400];
      this.c.bossQ = this.c.ghostQ = 400;
      this.bossHold = 0;
    }
  }
  /** OVERDRIVE is charged: the first-runs bubble (the touch button or the gauge + hero aura show readiness anyway). */
  ultReady(): void {
    const u = this.ultHint;
    if (!u) return;
    this.bubble("ult", u.html, u.anchor);
    u.shown();
  }
}
