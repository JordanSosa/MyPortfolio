/**
 * Training Arc juice. Everything here is WAAPI on transform / opacity of
 * short-lived elements (created, animated, removed), so a purchase never
 * relayouts the map and every frame stays on the compositor:
 *
 *  - `flyCoins`   Star Coins arc from the header's coin pill to a screen point;
 *  - `burstAt`    shockwave rings + flash + sparkles + a rising label at a node
 *                 (inside the map layer, so it zooms / pans with it);
 *  - `ignite`     a bolt of light runs along a constellation line into a node;
 *  - `popEl`      the bought star squashes and springs back; `revealEl` for
 *                 neighbours that just became reachable;
 *  - `keystoneSplash` the full-screen KEYSTONE ARC card (rays, stamp, confetti);
 *  - `rewind`     the respec "◀◀ REBOOTING THE SERIES" VHS sweep.
 *
 * Reduced motion: no flights / bursts (end states only). "Reduce flashing":
 * no white flash, softer splash.
 */
import { effectText } from "../../../meta/board/board";
import type { BoardNode, NodeEffect } from "../../../meta/board/types";
import { esc, h, hasArt, img } from "../../dom";
import { btn } from "../../kit/controls";
import { trackOverlay, type KitHost } from "../../kit/overlay";
import { reducedMotion } from "../../kit/ticker";
import type { NavLayer } from "../../nav";
import { markBorn, onTap, tooSoon } from "../../screens/common";
import { effectGlyph, glyphImg } from "./glyph";
import { BOUNDS, OWN_TINT } from "./layout";

export interface Pt {
  x: number;
  y: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** Escaped flavour text with the data's *emphasis* as italics. */
export const flavor = (t: string): string => esc(t).replace(/\*([^*]+)\*/g, "<em>$1</em>");
const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions): Animation | null =>
  typeof (el as HTMLElement).animate === "function" ? (el as HTMLElement).animate(kf, o) : null;

/** Remove `el` when its animation ends (or after `ms` as a fallback). */
function reap(el: Element, a: Animation | null, ms: number): void {
  let gone = false;
  const kill = () => {
    if (gone) return;
    gone = true;
    el.remove();
  };
  if (a) a.onfinish = kill;
  setTimeout(kill, ms + 200);
}

/** Centre of an element's box on screen, relative to `layer`'s box. */
export function centerIn(el: Element | null, layer: HTMLElement): Pt | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const L = layer.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2 - L.left, y: r.top + r.height / 2 - L.top };
}

/**
 * Star Coins fly from `from` to `to` (both in `layer` pixels) on a little arc,
 * staggered. Returns the ms until the first coin lands (0 = no flight).
 */
export function flyCoins(layer: HTMLElement, from: Pt | null, to: Pt | null, n: number, dur = 460, stagger = 30): number {
  if (!from || !to || reducedMotion() || n <= 0) return 0;
  const icon = hasArt("ui_coin_big") ? img("ui_coin_big", "px") : img("icon_coin", "px");
  for (let i = 0; i < n; i++) {
    const c = h("i", "bfx-coin", icon);
    c.style.left = `${from.x}px`;
    c.style.top = `${from.y}px`;
    layer.appendChild(c);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // control point: swung out to one side (alternating), a little past the straight line
    const side = (i % 2 ? 1 : -1) * rnd(40, 120);
    const mx = dx * 0.45 + side;
    const my = dy * 0.4 + rnd(-24, 24);
    const sc0 = rnd(0.8, 1.05);
    const a = anim(
      c,
      [
        { transform: `translate(0px, 0px) scale(${sc0}) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${(mx * 0.5).toFixed(1)}px, ${(my * 0.6).toFixed(1)}px) scale(${sc0 * 1.15}) rotate(${side > 0 ? 90 : -90}deg)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) scale(${sc0}) rotate(${side > 0 ? 200 : -200}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.45) rotate(${side > 0 ? 360 : -360}deg)`, opacity: 0.9 },
      ],
      { duration: dur, delay: i * stagger, easing: "cubic-bezier(0.45, 0, 0.75, 0.6)", fill: "both" },
    );
    reap(c, a, dur + i * stagger);
  }
  return dur;
}

/** Content-layer element at board pixel (x, y). */
function at(content: HTMLElement, cls: string, x: number, y: number, html = ""): HTMLElement {
  const el = h("i", cls, html);
  el.style.left = `${(x - BOUNDS.x0).toFixed(1)}px`;
  el.style.top = `${(y - BOUNDS.y0).toFixed(1)}px`;
  content.appendChild(el);
  return el;
}

export interface BurstOpts {
  color: string;
  /** Keystones / max rank: more of everything. */
  big?: boolean;
  /** White flash disc (off with "Reduce flashing"). */
  flash?: boolean;
  /** Rising label ("+1 RANK", "MAX!"). */
  label?: string;
}

/** Shockwave + sparkles at board pixel (x, y) inside the map layer. */
export function burstAt(content: HTMLElement, x: number, y: number, o: BurstOpts): void {
  if (reducedMotion()) return;
  const big = !!o.big;
  const rings: [string, number, number][] = [
    ["bfx-ring gold", big ? 4.2 : 3, 0],
    ["bfx-ring", big ? 5.4 : 3.8, 70],
  ];
  for (const [cls, s, delay] of rings) {
    const r = at(content, cls, x, y);
    r.style.setProperty("--c", o.color);
    reap(r, anim(r, [{ transform: "translate(-50%, -50%) scale(0.25)", opacity: 1 }, { transform: `translate(-50%, -50%) scale(${s})`, opacity: 0 }], { duration: 560, delay, easing: "cubic-bezier(0.1, 0.7, 0.3, 1)", fill: "both" }), 560 + delay);
  }
  if (o.flash) {
    const f = at(content, "bfx-flash", x, y);
    reap(f, anim(f, [{ transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.95 }, { transform: `translate(-50%, -50%) scale(${big ? 2.2 : 1.5})`, opacity: 0 }], { duration: 280, easing: "ease-out", fill: "both" }), 280);
  }
  const n = big ? 16 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2);
    const d = rnd(big ? 70 : 46, big ? 140 : 84);
    const sp = at(content, `bfx-sp${i % 3 === 0 ? " w" : ""}`, x, y);
    sp.style.setProperty("--c", o.color);
    const s = rnd(0.7, 1.3);
    reap(
      sp,
      anim(
        sp,
        [
          { transform: `translate(-50%, -50%) rotate(0deg) scale(${s})`, opacity: 1 },
          { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(1)}px), calc(-50% + ${(Math.sin(a) * d).toFixed(1)}px)) rotate(${rnd(-200, 200).toFixed(0)}deg) scale(0.2)`, opacity: 0 },
        ],
        { duration: rnd(480, 720), easing: "cubic-bezier(0.15, 0.8, 0.3, 1)", fill: "both" },
      ),
      720,
    );
  }
  if (o.label) {
    const t = at(content, "bfx-txt", x, y - 30, esc(o.label));
    reap(
      t,
      anim(
        t,
        [
          { transform: "translate(-50%, -50%) scale(0.4)", opacity: 0 },
          { transform: "translate(-50%, calc(-50% - 18px)) scale(1.2)", opacity: 1, offset: 0.2 },
          { transform: "translate(-50%, calc(-50% - 30px)) scale(1)", opacity: 1, offset: 0.7 },
          { transform: "translate(-50%, calc(-50% - 52px)) scale(0.9)", opacity: 0 },
        ],
        { duration: 1000, easing: "ease-out", fill: "both" },
      ),
      1000,
    );
  }
}

/** A bolt of light along the line a -> b (board px), `dur` ms after `delay`. */
export function ignite(content: HTMLElement, a: Pt, b: Pt, delay: number, dur: number, color = "#ffe14d"): void {
  if (reducedMotion()) return;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return;
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const bar = at(content, "bfx-ign", a.x, a.y);
  bar.style.width = `${len.toFixed(1)}px`;
  bar.style.setProperty("--c", color);
  const rot = `rotate(${ang.toFixed(2)}deg)`;
  reap(
    bar,
    anim(
      bar,
      [
        { transform: `translateY(-50%) ${rot} scaleX(0)`, opacity: 1 },
        { transform: `translateY(-50%) ${rot} scaleX(1)`, opacity: 1, offset: 0.62 },
        { transform: `translateY(-50%) ${rot} scaleX(1)`, opacity: 0 },
      ],
      { duration: dur / 0.62, delay, easing: "linear", fill: "both" },
    ),
    dur / 0.62 + delay,
  );
  const head = at(content, "bfx-head", a.x, a.y);
  head.style.setProperty("--c", color);
  reap(
    head,
    anim(
      head,
      [
        { transform: `${rot} translateX(0px) translate(-50%, -50%) scale(0.6)`, opacity: 0 },
        { transform: `${rot} translateX(${(len * 0.15).toFixed(1)}px) translate(-50%, -50%) scale(1.2)`, opacity: 1, offset: 0.15 },
        { transform: `${rot} translateX(${len.toFixed(1)}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
      ],
      { duration: dur, delay, easing: "cubic-bezier(0.5, 0, 0.9, 0.7)", fill: "both" },
    ),
    dur + delay,
  );
}

/** Squash-and-stretch pop of a bought star. */
export function popEl(el: Element | null, big = false): void {
  if (!el || reducedMotion()) return;
  anim(
    el,
    [
      { transform: "scale(1)" },
      { transform: `scale(${big ? 1.7 : 1.5}) rotate(-8deg)`, offset: 0.3 },
      { transform: "scale(0.9) rotate(3deg)", offset: 0.62 },
      { transform: "scale(1)" },
    ],
    { duration: 520, easing: "cubic-bezier(0.3, 1.6, 0.5, 1)" },
  );
}

/** A neighbour that just became reachable twinkles into view. */
export function revealEl(el: Element | null, delay: number): void {
  if (!el || reducedMotion()) return;
  anim(
    el,
    [
      { transform: "scale(0.4)", opacity: 0.3 },
      { transform: "scale(1.3)", opacity: 1, offset: 0.55 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 420, delay, easing: "cubic-bezier(0.3, 1.5, 0.5, 1)", fill: "backwards" },
  );
}

// ------------------------------------------------------------------ keystone splash

/** + / - / neutral for one effect line (what a player would call a buff). */
export function effectMood(e: NodeEffect): "good" | "bad" | "meh" {
  if (e.t === "stat" || e.t === "statPct") {
    if (e.stat === "curse") return "meh";
    const lowerIsBetter = e.stat === "cooldown" || e.stat === "dashCd";
    return (e.per < 0) === lowerIsBetter ? "good" : "bad";
  }
  if (e.t === "startWeapon") return "good";
  return e.per > 0 ? "good" : "bad";
}

export interface KeystoneSplashOpts {
  node: BoardNode;
  /** It went on air right away (a free keystone slot). */
  activated: boolean;
  slots: number;
  /** "Reduce flashing" (no white flash). */
  calm: boolean;
  done?: () => void;
}

/** Full-screen "KEYSTONE ARC UNLOCKED!" card. Tap / OK / Back closes it. */
export function keystoneSplash(host: KitHost, o: KeystoneSplashOpts): void {
  const n = o.node;
  const name = n.name.toUpperCase();
  let li = 0;
  const words = name
    .split(" ")
    .map((w) => `<span class="kss-w">${[...w].map((ch) => `<span class="kss-l" style="--i:${li++}">${esc(ch)}</span>`).join("")}</span>`)
    .join(" ");
  const lines = n.effects
    .map((e, i) => {
      const m = effectMood(e);
      return `<li class="kss-fx ${m}" style="--i:${i}"><b>${m === "good" ? "▲" : m === "bad" ? "▼" : "◆"}</b>${esc(effectText(e, 1))}</li>`;
    })
    .join("");
  const conf = reducedMotion()
    ? ""
    : Array.from({ length: 26 }, (_, i) => {
        const c = ["#ffe14d", "#ff7ab8", "#4fe6df", "#ddc6ff", "#fff"][i % 5];
        return `<i style="left:${rnd(2, 98).toFixed(1)}%;--c:${c};--d:${rnd(0, 0.9).toFixed(2)}s;--t:${rnd(1.6, 2.8).toFixed(2)}s;--r:${rnd(-540, 540).toFixed(0)}deg;--x:${rnd(-60, 60).toFixed(0)}px"></i>`;
      }).join("");
  const art = hasArt("board_keystone") ? img("board_keystone", "px kss-star", 3) : `<i class="kss-star css-star"></i>`;
  const el = h("div", `kover ks-splash${o.calm ? " calm" : ""}`);
  el.innerHTML = `
    <div class="kss-bg"></div>
    <div class="kss-rays" aria-hidden="true"></div>
    <div class="kss-conf" aria-hidden="true">${conf}</div>
    ${o.calm ? "" : `<div class="kss-flash" aria-hidden="true"></div>`}
    <section class="kss-card" role="dialog" aria-modal="true" aria-label="Keystone: ${esc(n.name)}">
      <small class="kss-k">KEYSTONE ARC UNLOCKED!</small>
      <div class="kss-art">${art}${glyphImg(effectGlyph(n.effects), OWN_TINT, "px kss-gl")}<i class="kss-ring" aria-hidden="true"></i></div>
      <h2 class="kss-name">${words}</h2>
      <ul class="kss-list">${lines}</ul>
      ${n.flavor ? `<p class="kss-flav">“${flavor(n.flavor)}”</p>` : ""}
      ${o.activated ? `<div class="kss-stamp">ON AIR</div>` : `<p class="kss-off">${o.slots} arcs are already on air. Swap one in from its card.</p>`}
      ${btn(o.activated ? "AIR IT!" : "OKAY!", { cls: "gold", act: "ok", def: true })}
    </section>`;
  host.ui.appendChild(el);
  host.sfx("unlockFanfare");
  setTimeout(() => host.sfx("narratorSting", 0.8), reducedMotion() ? 0 : 520);
  if (o.activated) setTimeout(() => host.sfx("equip", 0.9), reducedMotion() ? 0 : 1100);
  trackOverlay(1);
  markBorn();
  let closed = false;
  const L: NavLayer = { root: el, focus: null, onBack: () => close() };
  const close = () => {
    if (closed) return;
    closed = true;
    host.nav.remove(L);
    el.classList.add("out");
    el.style.pointerEvents = "none";
    setTimeout(() => el.remove(), reducedMotion() ? 0 : 260);
    trackOverlay(-1);
    host.overlayClosed();
    o.done?.();
  };
  host.nav.push(L);
  host.overlayOpened();
  onTap(el.querySelector('[data-act="ok"]'), close);
  // tap anywhere once the name has landed (not the ghost click of the BUY tap)
  const opened = performance.now();
  el.addEventListener("click", () => {
    if (!tooSoon() && performance.now() - opened > 700) close();
  });
}

// ------------------------------------------------------------------ respec rewind

/** VHS "◀◀ REBOOTING THE SERIES" sweep over `host` (the map viewport). Resolves at the midpoint. */
export function rewind(host: HTMLElement): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  const el = h("div", "bd-rewind", `<i class="rw-band"></i><i class="rw-band b2"></i><b class="rw-t">◀◀ REBOOTING THE SERIES</b>`);
  host.appendChild(el);
  const a = anim(el, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 1100, easing: "linear", fill: "both" });
  for (const [i, b] of [...el.querySelectorAll(".rw-band")].entries())
    anim(b, [{ transform: "translateY(-120%)" }, { transform: "translateY(520%)" }], { duration: 520, delay: i * 180, iterations: 2, easing: "linear" });
  reap(el, a, 1100);
  return new Promise((r) => setTimeout(r, 480));
}
