/**
 * In-game HUD (DESIGN §7): XP bar + level badge, timer, kills + coins, owned
 * weapon/passive icons, combo counter with rank stamps, boss HP bar,
 * banners (WARNING / INCOMING / ELITE / EVOLUTION / boss name card), low-HP
 * danger border and the SSS rainbow screen border. Pause button top-right.
 * Updates are diffed so the DOM is only touched when something changed.
 */
import { CFG, RANKS } from "../game/config";
import type { Enemy } from "../game/types";
import type { World } from "../game/world";
import type { FeedbackHooks } from "../view/feedback";
import { fmtNum, fmtTime, h, img, replay } from "./dom";

export class Hud implements FeedbackHooks {
  readonly root: HTMLElement;
  private xp: HTMLElement;
  private xpFill: HTMLElement;
  private lvl: HTMLElement;
  private timer: HTMLElement;
  private coins: HTMLElement;
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
  private warnT = 0;
  private bossEnemy: Enemy | null = null;
  // diff cache
  private c = { lvl: -1, sec: -1, kills: -1, coins: -1, build: "", bv: -1, combo: -1, rank: -2, xpk: -1, full: false };
  private bannerT = 0;

  constructor(parent: HTMLElement, onPause: () => void) {
    const r = h("div", "hud hidden");
    r.innerHTML = `
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
      <div class="bossbar"><div class="bn"></div><div class="track"><div class="ghost"></div><div class="fill"></div></div></div>
      <div class="combo"><span class="rank"></span><span class="n">0</span><span class="lbl">COMBO</span><div class="bar"></div><span class="mult"></span></div>
      <div class="banner"></div>`;
    const pause = h("button", "pause-btn");
    pause.setAttribute("aria-label", "Pause");
    pause.setAttribute("data-ui", "");
    pause.addEventListener("click", (e) => {
      e.stopPropagation();
      onPause();
    });
    r.appendChild(pause);
    parent.appendChild(r);
    this.root = r;
    const q = (s: string) => r.querySelector(s) as HTMLElement;
    this.xp = q(".xpbar");
    this.xpFill = q(".xpbar .fill");
    this.lvl = q(".lvl");
    this.timer = q(".timer");
    this.coins = q(".stat.coin");
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
    this.bossName = q(".bossbar .bn");
    this.danger = q(".danger");
    this.sss = q(".sss-border");
    this.bannerEl = q(".banner");
    this.warn = q(".warn-border");
  }

  show(on: boolean): void {
    this.root.classList.toggle("hidden", !on);
  }

  reset(): void {
    this.c = { lvl: -1, sec: -1, kills: -1, coins: -1, build: "", bv: -1, combo: -1, rank: -2, xpk: -1, full: false };
    this.bossEnemy = null;
    this.boss.classList.remove("on");
    this.combo.classList.remove("on", "shatter");
    this.bannerEl.className = "banner";
    this.bannerEl.innerHTML = "";
    this.sss.classList.remove("on");
    this.danger.classList.remove("on");
    this.warn.classList.remove("on");
    this.warnT = 0;
    this.root.classList.remove("modal-open");
    this.root.querySelector(".hint-pill")?.remove();
  }

  /** Re-render icons (art may have changed after a hot reload). */
  refreshIcons(): void {
    this.c.build = "";
    this.c.bv = -1;
  }

  update(w: World, realDt: number): void {
    const c = this.c;
    // XP
    const k = Math.min(1, w.xp / w.xpNext);
    const kq = Math.round(k * 400);
    if (kq !== c.xpk) {
      c.xpk = kq;
      this.xpFill.style.transform = `scaleX(${k.toFixed(4)})`;
    }
    const full = w.pendingLevels > 0;
    if (full !== c.full) {
      c.full = full;
      this.xp.classList.toggle("full", full);
      if (full) this.xpFill.style.transform = "scaleX(1)";
    }
    if (w.level !== c.lvl) {
      if (c.lvl > 0) replay(this.lvl, "pop");
      c.lvl = w.level;
      this.lvl.textContent = String(w.level);
    }
    const sec = Math.floor(w.t);
    if (sec !== c.sec) {
      c.sec = sec;
      this.timer.textContent = fmtTime(w.t);
      this.timer.classList.toggle("boss", !!w.boss);
    }
    if (w.kills !== c.kills) {
      c.kills = w.kills;
      this.killsN.textContent = fmtNum(w.kills);
    }
    const coins = Math.floor(w.coins);
    if (coins !== c.coins) {
      c.coins = coins;
      this.coinsN.textContent = fmtNum(coins);
    }
    // build icons (signature string only rebuilt when the build actually changed)
    let sig = c.build;
    if (w.buildVersion !== c.bv) {
      c.bv = w.buildVersion;
      sig = "";
      for (const wi of w.weapons) sig += `${wi.def.id}:${wi.level},`;
      sig += "|";
      for (const p of w.passives) sig += `${p.def.id}:${p.level},`;
    }
    if (sig !== c.build) {
      const prev = c.build;
      c.build = sig;
      this.wRow.innerHTML = w.weapons
        .map((wi) => {
          const isNew = prev && !prev.includes(`${wi.def.id}:`);
          return `<div class="slot${wi.def.evolved ? " evo" : ""}${isNew ? " new" : ""}">${img(wi.def.icon)}<span class="lv">${wi.def.evolved ? "★" : wi.level}</span></div>`;
        })
        .join("");
      this.pRow.innerHTML = w.passives
        .map((p) => {
          const isNew = prev && !prev.includes(`${p.def.id}:`);
          return `<div class="slot ps${isNew ? " new" : ""}">${img(p.def.icon)}<span class="lv">${p.level}</span></div>`;
        })
        .join("");
    }
    // combo
    const cb = w.combo;
    if (cb >= 3) {
      if (!this.combo.classList.contains("on") || this.combo.classList.contains("shatter")) {
        this.combo.classList.remove("shatter");
        this.combo.classList.add("on");
      }
      if (cb !== c.combo) {
        this.comboN.textContent = String(cb);
        replay(this.comboN, "bump");
      }
      this.comboBar.style.transform = `scaleX(${Math.max(0, w.comboTimer / CFG.comboTime).toFixed(3)})`;
    }
    c.combo = cb;
    if (w.comboRank !== c.rank) {
      c.rank = w.comboRank;
      if (w.comboRank >= 0) {
        const rk = RANKS[w.comboRank];
        this.comboRankEl.textContent = rk.id;
        this.comboRankEl.className = `rank r${w.comboRank}`;
        replay(this.comboRankEl, "stamp");
        this.comboMult.textContent = `XP x${rk.mult.toFixed(2)}`;
      } else {
        this.comboRankEl.textContent = "";
        this.comboMult.textContent = "";
      }
      this.sss.classList.toggle("on", w.comboRank >= RANKS.length - 1);
    }
    // boss bar
    const b = this.bossEnemy;
    if (b) {
      if (b.dead || b.def !== undefined && !b.def.boss) this.bossBar(null);
      else {
        const f = Math.max(0, b.hp / b.maxHp).toFixed(4);
        this.bossFill.style.transform = `scaleX(${f})`;
        this.bossGhost.style.transform = `scaleX(${f})`;
      }
    }
    // low HP
    const low = w.player.hp / w.player.maxHp < 0.3 && w.phase === "play";
    if (low !== this.danger.classList.contains("on")) this.danger.classList.toggle("on", low);
    if (this.warnT > 0) {
      this.warnT -= realDt;
      if (this.warnT <= 0) this.warn.classList.remove("on");
    }
    if (this.bannerT > 0) {
      this.bannerT -= realDt;
      if (this.bannerT <= 0) this.bannerEl.className = "banner";
    }
  }

  /** A modal is open on top: the onboarding pill hides and its timer pauses (CSS) until it closes. */
  setModalOpen(on: boolean): void {
    this.root.classList.toggle("modal-open", on);
  }

  /** Onboarding pill below the hero (fades out by itself). `html` may contain <b>. */
  hint(html: string): void {
    this.root.querySelector(".hint-pill")?.remove();
    const el = h("div", "hint-pill", html);
    this.root.appendChild(el);
    // lifetime = its CSS animation, which pauses while a modal is open (level-ups in the first seconds)
    el.addEventListener("animationend", () => el.remove());
  }

  // ---------------------------------------------------------------- feedback hooks
  xpPulse(): void {
    if (!this.xp.classList.contains("pulse")) replay(this.xp, "pulse");
    else {
      this.xp.classList.remove("pulse");
      void this.xp.offsetWidth;
      this.xp.classList.add("pulse");
    }
  }
  coinPulse(): void {
    replay(this.coins, "bump");
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
    const el = this.bannerEl;
    if (kind === "warning") {
      this.warnT = 3;
      this.warn.classList.add("on");
      el.innerHTML = `<div class="hazard"></div><div class="bt">${title}</div><div class="bs">${sub}</div><div class="hazard"></div>`;
      this.bannerT = 3;
    } else {
      el.innerHTML = `<div class="bt">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ""}`;
      this.bannerT = 2;
    }
    el.className = `banner b-${kind}`;
    replay(el, "show");
  }
  bossBar(e: Enemy | null, title = ""): void {
    this.bossEnemy = e;
    this.boss.classList.toggle("on", !!e);
    if (e) {
      this.bossName.textContent = title;
      this.bossFill.style.transform = "scaleX(1)";
      this.bossGhost.style.transform = "scaleX(1)";
    }
  }
  ultReady(): void {
    /* the OVERDRIVE touch button + hero aura show readiness */
  }
}
