/**
 * Heroes juice (WAAPI on transform / opacity of short-lived elements):
 *
 *  - `sparkBurst`     hearts / sparkles / stars fly out of a screen point
 *                     (SET AS ACTIVE, +1 talent rank, favourite);
 *  - `levelUpSplash`  full-screen HERO LEVEL UP! (rays in the hero's colours,
 *                     the shouting portrait, LV a -> b, +talent point chips, confetti);
 *  - `capstoneSplash` the tier-5 talent moment (CAPSTONE! + the new behaviour);
 *  - `miniCutin`      the hero's Overdrive cut-in, in miniature, inside a card.
 *
 * Reduced motion: end states (cards still show, nothing flies). "Reduce
 * flashing": no white flash.
 */
import { esc, h, letters } from "../../dom";
import { portrait } from "../../kit/art";
import { btn } from "../../kit/controls";
import { trackOverlay, type KitHost } from "../../kit/overlay";
import { reducedMotion } from "../../kit/ticker";
import type { NavLayer } from "../../nav";
import { markBorn, onTap, tooSoon } from "../../screens/common";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const anim = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions): Animation | null =>
  typeof (el as HTMLElement).animate === "function" ? (el as HTMLElement).animate(kf, o) : null;

/** Particles out of the centre of `from` (screen), drawn in `layer` (a full-screen fixed box). */
export function sparkBurst(layer: HTMLElement, from: Element | null, o: { n?: number; glyphs?: string; colors?: readonly string[]; spread?: number } = {}): void {
  if (!from || reducedMotion()) return;
  const r = from.getBoundingClientRect();
  const L = layer.getBoundingClientRect();
  const x = r.left + r.width / 2 - L.left;
  const y = r.top + r.height / 2 - L.top;
  const glyphs = [...(o.glyphs ?? "♥✦★")];
  const colors = o.colors ?? ["#ff7ab8", "#ffe14d", "#fff", "#4fe6df"];
  const n = o.n ?? 14;
  for (let i = 0; i < n; i++) {
    const p = h("i", "hfx-p", esc(glyphs[i % glyphs.length]));
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.color = colors[i % colors.length];
    layer.appendChild(p);
    const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
    const d = rnd(40, o.spread ?? 110);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d - rnd(10, 40);
    const s = rnd(0.8, 1.5);
    const an = anim(
      p,
      [
        { transform: `translate(-50%, -50%) scale(0.3) rotate(0deg)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${(dx * 0.7).toFixed(0)}px), calc(-50% + ${(dy * 0.7).toFixed(0)}px)) scale(${s}) rotate(${rnd(-90, 90).toFixed(0)}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx.toFixed(0)}px), calc(-50% + ${(dy + 30).toFixed(0)}px)) scale(${(s * 0.6).toFixed(2)}) rotate(${rnd(-180, 180).toFixed(0)}deg)`, opacity: 0 },
      ],
      { duration: rnd(620, 900), easing: "cubic-bezier(0.15, 0.8, 0.3, 1)", fill: "both" },
    );
    const kill = () => p.remove();
    if (an) an.onfinish = kill;
    setTimeout(kill, 1200);
  }
}

/** Squash-and-stretch hop of an element (portrait on SET AS ACTIVE). */
export function hop(el: Element | null): void {
  if (!el || reducedMotion()) return;
  anim(
    el,
    [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(4px) scale(1.08, 0.9)", offset: 0.15 },
      { transform: "translateY(-18px) scale(0.94, 1.08) rotate(-4deg)", offset: 0.45 },
      { transform: "translateY(2px) scale(1.06, 0.94) rotate(2deg)", offset: 0.75 },
      { transform: "translateY(0) scale(1)" },
    ],
    { duration: 620, easing: "ease-out" },
  );
}

interface SplashParts {
  cls: string;
  hc: string;
  colors: readonly string[];
  body: string;
  ok: string;
  calm: boolean;
  label: string;
  sfx?: () => void;
  done?: () => void;
}

function confetti(colors: readonly string[], n = 28): string {
  if (reducedMotion()) return "";
  return Array.from({ length: n }, (_, i) => `<i style="left:${rnd(2, 98).toFixed(1)}%;--c:${colors[i % colors.length]};--d:${rnd(0, 0.8).toFixed(2)}s;--t:${rnd(1.6, 2.8).toFixed(2)}s;--r:${rnd(-540, 540).toFixed(0)}deg;--x:${rnd(-60, 60).toFixed(0)}px"></i>`).join("");
}

/** Shared full-screen splash shell (rays, confetti, flash, one card, tap / OK / Back closes). */
function splash(host: KitHost, o: SplashParts): void {
  const el = h("div", `kover hsplash ${o.cls}${o.calm ? " calm" : ""}`);
  el.style.setProperty("--hc", o.hc);
  el.innerHTML = `
    <div class="hs-bg"></div>
    <div class="hs-rays" aria-hidden="true"></div>
    <div class="hs-conf" aria-hidden="true">${confetti(o.colors)}</div>
    ${o.calm ? "" : `<div class="hs-flash" aria-hidden="true"></div>`}
    <section class="hs-card" role="dialog" aria-modal="true" aria-label="${esc(o.label)}">
      ${o.body}
      ${btn(o.ok, { cls: "gold", act: "ok", def: true })}
    </section>`;
  host.ui.appendChild(el);
  o.sfx?.();
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
  const t0 = performance.now();
  el.addEventListener("click", () => {
    if (!tooSoon() && performance.now() - t0 > 650) close();
  });
}

export interface LevelUpOpts {
  name: string;
  portraitId: string;
  hc: string;
  colors: readonly string[];
  from: number;
  to: number;
  /** Talent points gained (one per level). */
  points: number;
  calm: boolean;
  done?: () => void;
}

/** HERO LEVEL UP! */
export function levelUpSplash(host: KitHost, o: LevelUpOpts): void {
  const gained = o.to - o.from;
  splash(host, {
    cls: "lvup",
    hc: o.hc,
    colors: o.colors,
    calm: o.calm,
    label: `${o.name} level up`,
    ok: "NICE!",
    sfx: () => {
      host.sfx("heroLevelUp");
      setTimeout(() => host.sfx("voiceBlip", 0.8, 3), reducedMotion() ? 0 : 450);
    },
    done: o.done,
    body: `
      <div class="hs-por">${portrait(o.portraitId, 1, "pimg")}<i class="hs-ring" aria-hidden="true"></i></div>
      <h2 class="hs-t">${letters("LEVEL UP!", "hs-l", 0.05)}</h2>
      <div class="hs-lv"><span>LV ${o.from}</span><b>▶</b><span class="to">LV ${o.to}</span></div>
      <div class="hs-chips">
        <span class="hs-chip pts">+${o.points} TALENT POINT${o.points === 1 ? "" : "S"}</span>
        <span class="hs-chip">+${gained}% damage · +${gained}% max HP</span>
      </div>
      <small class="hs-narr">${esc(o.name)} has grown! Narratively!</small>`,
  });
}

export interface CapstoneOpts {
  hero: string;
  hc: string;
  colors: readonly string[];
  name: string;
  desc: string;
  /** "ULT" or "WPN": what the capstone changes. */
  kind: string;
  icon: string;
  calm: boolean;
}

/** CAPSTONE! (a tier-5 talent was taken). */
export function capstoneSplash(host: KitHost, o: CapstoneOpts): void {
  splash(host, {
    cls: "capst",
    hc: o.hc,
    colors: o.colors,
    calm: o.calm,
    label: `Capstone: ${o.name}`,
    ok: "CHARACTER ARC!",
    sfx: () => {
      host.sfx("unlockFanfare");
      setTimeout(() => host.sfx("narratorSting", 0.8), reducedMotion() ? 0 : 500);
    },
    body: `
      <small class="hs-k">CAPSTONE · ${esc(o.kind === "ULT" ? "CHANGES THE OVERDRIVE" : "CHANGES THE START WEAPON")}</small>
      <div class="hs-ic">${o.icon}<i class="hs-ring" aria-hidden="true"></i></div>
      <h2 class="hs-t name">${letters(o.name.toUpperCase(), "hs-l", 0.04)}</h2>
      <p class="hs-desc">${esc(o.desc)}</p>
      <small class="hs-narr">${esc(o.hero)}'s character arc is complete. (Until the sequel.)</small>`,
  });
}

/** The Overdrive cut-in in miniature, played inside `host` (a card). */
export function miniCutin(host: HTMLElement, o: { band: readonly [string, string, string]; portraitId: string; title: string; line?: string }): void {
  host.querySelector(".mcut")?.remove();
  const el = h("div", "mcut");
  el.style.setProperty("--b1", o.band[0]);
  el.style.setProperty("--b2", o.band[1]);
  el.style.setProperty("--b3", o.band[2]);
  el.innerHTML = `<i class="mc-band"></i><i class="mc-lines"></i><span class="mc-por">${portrait(o.portraitId, 1, "pimg")}</span><span class="mc-tx"><b>${esc(o.title)}</b>${o.line ? `<small>“${esc(o.line)}”</small>` : ""}</span>`;
  host.appendChild(el);
  const dur = reducedMotion() ? 1600 : 2300;
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 320);
  }, dur);
}
