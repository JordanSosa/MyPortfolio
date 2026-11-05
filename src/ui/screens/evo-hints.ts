/**
 * Evolution hint lines (src/game/evo-hints.ts decides; this draws): one compact line per known
 * recipe under a level-up / chest card and in the pause menu's build list, plus the synergy glow
 * of a card whose pick completes a pair or makes an evolution ready. Readable on a 360 px phone:
 * the line wraps inside the card, never past it.
 *
 *   weapon card   → [evo] Cosmic Yarn · [passive]✓ READY!          passive held, the pick reaches the evolve level
 *                 → [evo] Cosmic Yarn · [passive]✓ Lv 3→4 of 5     passive held, levels to go
 *                 → [evo] Cosmic Yarn · needs [passive, grey] Magnet Star
 *                 → [evo] Cosmic Yarn · [passive, grey] Magnet Star NO SLOT / LOCKED / BANISHED
 *   NEW passive   Evolves [weapon] Yarn Orbit → [evo] Cosmic Yarn READY! / Lv 2 of 5
 *   pause list    [weapon] → [evo] Cosmic Yarn · [passive]✓ Lv 3 of 5   (names drop on short phones)
 *
 * The known rule for a run (`runKnown`): practice runs know every recipe; account runs know what the
 * Wiki shows (profile codex.weapons) plus this run's own evolutions. Styles: KE_CSS, injected once,
 * every class namespaced `kk-evo*` / `kk-syn*` (the global stylesheet pitfall, CLAUDE.md).
 */
import { ALL_KNOWN, evoSynergy, knownFrom, type EvoHint, type Known } from "../../game/evo-hints";
import type { World } from "../../game/world";
import type { App } from "../app";
import { esc, img } from "../dom";
import { save } from "../save";

/** Which recipes this run may hint: everything in a practice run, else the Wiki's discoveries + this run's evolutions. */
export function runKnown(app: App, w: World): Known {
  if (app.practice) return ALL_KNOWN;
  return knownFrom(save.profile.codex.weapons, w.weaponsUsed);
}

const BLOCK_LABEL: Record<string, string> = { slots: "NO SLOT", locked: "LOCKED", banished: "BANISHED" };
const STATE_CLASS: Record<EvoHint["state"], string> = { ready: "kk-evo-ready", have: "kk-evo-have", missing: "kk-evo-miss", blocked: "kk-evo-block" };

const icon = (id: string, off = false) => img(id, off ? "px kk-evo-ic kk-evo-off" : "px kk-evo-ic");

/**
 * The state chip at the end of a line. Every level chip carries a long and a short form
 * (`kk-evo-lvl` "Lv 3→4 of 5" / `kk-evo-lvs` "4/5"): compact layouts (the 5-6 card grid, the
 * pause list on short phones) show the short one.
 */
function chip(h: EvoHint): string {
  if (h.state === "ready") return `<span class="kk-evo-st">READY!</span>`;
  if (h.state === "blocked") return `<span class="kk-evo-st">${BLOCK_LABEL[h.blocked ?? ""] ?? "BLOCKED"}</span>`;
  if (h.state !== "have") return "";
  const long = h.from > 0 && h.from !== h.level ? `Lv ${h.from}→${h.level} of ${h.need}` : `Lv ${h.level} of ${h.need}`;
  return `<span class="kk-evo-st"><span class="kk-evo-lvl">${long}</span><span class="kk-evo-lvs">${h.level}/${h.need}</span></span>`;
}

/** The passive half of a weapon-side line: held = icon + check, else "needs [grey icon] Name". */
function passivePart(h: EvoHint): string {
  if (h.passiveHeld) return `<span class="kk-evo-pa">${icon(h.passive.icon)}<i class="kk-evo-ok">✓</i></span>`;
  const needs = h.state === "missing" ? `<span class="kk-evo-word">needs</span>` : "";
  return `<span class="kk-evo-pa">${needs}${icon(h.passive.icon, true)}<span class="kk-evo-nm">${esc(h.passive.name)}</span></span>`;
}

/**
 * One recipe line. Weapon side: "→ [evo] Name · [passive]✓ CHIP" (`withBase`: the base weapon's icon
 * first, for the pause list); passive side: "Evolves [weapon] Name → [evo] Name CHIP".
 */
function line(h: EvoHint, withBase: boolean): string {
  const cls = `kk-evo-ln ${STATE_CLASS[h.state]}`;
  const evoOff = h.state === "blocked" && h.blocked === "banished";
  const to = `<span class="kk-evo-to">→${icon(h.into.icon, evoOff)}<b>${esc(h.into.name)}</b></span>`;
  if (h.on === "passive") {
    return `<div class="${cls}"><span class="kk-evo-to"><span class="kk-evo-word">Evolves</span>${icon(h.base.icon)}<b class="kk-evo-bn">${esc(h.base.name)}</b></span>${to}${chip(h)}</div>`;
  }
  const base = withBase ? `<span class="kk-evo-base">${icon(h.base.icon)}</span>` : "";
  return `<div class="${cls}">${base}${to}<span class="kk-evo-dot">·</span>${passivePart(h)}${chip(h)}</div>`;
}

/** Hint lines under a card (empty string: no known recipe). */
export function evoLinesHtml(hints: readonly EvoHint[]): string {
  if (!hints.length) return "";
  return `<div class="kk-evo">${hints.map((h) => line(h, false)).join("")}</div>`;
}

/** Card classes for these hints: kk-evo-on (it has lines) + kk-syn-ready / kk-syn-pair (the synergy glow). */
export function evoCardClass(hints: readonly EvoHint[]): string {
  if (!hints.length) return "";
  const s = evoSynergy(hints);
  return s ? ` kk-evo-on kk-syn-${s}` : " kk-evo-on";
}

/** The glow layer inside a synergy card (opacity-only pulse; static under reduced motion). */
export function evoGlowHtml(hints: readonly EvoHint[]): string {
  return evoSynergy(hints) ? `<i class="kk-syn-glow"></i>` : "";
}

const BADGE_CLASS: Record<EvoHint["state"], string> = { ready: "kk-evb-r", have: "kk-evb-h", missing: "kk-evb-m", blocked: "kk-evb-b" };
const BADGE_ORDER: EvoHint["state"][] = ["ready", "have", "missing", "blocked"];

/** A weapon slot's badge: its best recipe's evolved icon, coloured by state (READY first), or "". */
export function evoBadgeHtml(hints: readonly EvoHint[]): string {
  let best: EvoHint | null = null;
  for (const h of hints) if (!best || BADGE_ORDER.indexOf(h.state) < BADGE_ORDER.indexOf(best.state)) best = h;
  return best ? `<span class="kk-evo-badge ${BADGE_CLASS[best.state]}">${img(best.into.icon, "px")}</span>` : "";
}

/** The pause menu's EVOLUTIONS block (every known recipe of the held base weapons), or "". */
export function evoListHtml(hints: readonly EvoHint[]): string {
  if (!hints.length) return "";
  return `<div class="h2 kk-evo-h">EVOLUTIONS</div><div class="kk-evo kk-evo-list">${hints.map((h) => line(h, true)).join("")}</div>`;
}

const KE_CSS = `
.kk-evo{display:flex;flex-direction:column;gap:.22em;width:100%;margin-top:.3em;text-align:left}
.kk-evo-ln{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:.3em;row-gap:.06em;min-width:0;padding:.16em .5em .2em;border-radius:8px;background:rgba(20,12,34,.6);border:2px solid rgba(221,198,255,.3);font-family:var(--font);font-size:max(11px,.8em);line-height:1.15;color:var(--off);text-shadow:0 1px 0 var(--outline)}
.kk-evo-ln b{color:var(--white);font-weight:700}
.kk-evo-to,.kk-evo-pa,.kk-evo-base{display:inline-flex;align-items:center;gap:.16em;min-width:0}
.kk-evo-ic{width:1.45em;height:1.45em;flex:none}
.kk-evo-off{filter:grayscale(1) brightness(.7);opacity:.65}
.kk-evo-ok{font-style:normal;color:var(--lime);font-weight:700}
.kk-evo-dot{opacity:.55}
.kk-evo-st{font-family:var(--mono);font-size:max(9px,.78em);letter-spacing:.03em;white-space:nowrap;padding:.06em .38em .12em;border-radius:5px;background:rgba(221,198,255,.16);color:var(--lav)}
.kk-evo-lvs{display:none}
.kk-evo-ready{border-color:var(--yellow);background:linear-gradient(90deg,rgba(255,225,77,.2),rgba(255,122,184,.14))}
.kk-evo-ready .kk-evo-st{background:var(--yellow);color:var(--outline);text-shadow:none}
.kk-evo-have{border-color:rgba(79,230,223,.55)}
.kk-evo-have .kk-evo-st{color:var(--aqua)}
.kk-evo-miss .kk-evo-nm{color:var(--lav)}
.kk-evo-block{opacity:.62}
.kk-evo-block .kk-evo-st{color:#ff9aa8}
.card.kk-syn-ready{box-shadow:0 0 0 3px var(--outline),0 7px 0 3px var(--outline),0 0 0 6px rgba(255,225,77,.9),0 0 28px 6px rgba(255,225,77,.5)}
.card.kk-syn-pair{box-shadow:0 0 0 3px var(--outline),0 7px 0 3px var(--outline),0 0 0 5px rgba(79,230,223,.75),0 0 24px 4px rgba(79,230,223,.38)}
.card.kk-syn-ready:hover,.card.kk-syn-ready.nav-focus{box-shadow:0 0 0 3px var(--outline),0 9px 0 3px var(--outline),0 0 0 6px rgba(255,225,77,1),0 0 40px 8px rgba(255,225,77,.6)}
.card.kk-syn-pair:hover,.card.kk-syn-pair.nav-focus{box-shadow:0 0 0 3px var(--outline),0 9px 0 3px var(--outline),0 0 0 5px rgba(79,230,223,.95),0 0 34px 6px rgba(79,230,223,.5)}
.kk-syn-glow{position:absolute;inset:0;border-radius:13px;pointer-events:none;box-shadow:inset 0 0 18px 3px rgba(255,225,77,.55);opacity:.35;animation:kk-syn-pulse 1.3s ease-in-out infinite alternate}
.kk-syn-pair .kk-syn-glow{box-shadow:inset 0 0 16px 2px rgba(79,230,223,.5)}
@keyframes kk-syn-pulse{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.kk-syn-glow{animation:none;opacity:.7}}
@media (orientation:portrait){
.card.kk-evo-on{padding-top:.65em;padding-bottom:.6em}
.card.kk-evo-on>.nm{grid-row:1;grid-column:2}
.card.kk-evo-on>.lvl-ch{grid-row:2;grid-column:2}
.card.kk-evo-on>.ds{grid-row:3;grid-column:2}
.card.kk-evo-on>.pips{position:static;grid-row:3;grid-column:2;justify-self:end;align-self:end}
.card.kk-evo-on>.kk-evo{grid-row:4;grid-column:1/-1;margin-top:.3em}
.card.kk-evo-on .kk-evo-ln{justify-content:flex-start}
.levelup.many .card.kk-evo-on{padding-top:.5em;padding-bottom:.5em}
}
.levelup.many .kk-evo{margin-top:.2em}
.levelup.many .card .kk-evo-ln{justify-content:center;font-size:max(10px,.72em);padding:.12em .3em}
.levelup.many .kk-evo-word,.levelup.many .kk-evo-bn,.levelup.many .kk-evo-nm,.levelup.many .kk-evo-dot,.levelup.many .kk-evo-lvl{display:none}
.levelup.many .kk-evo-lvs{display:inline}
@media (orientation:landscape) and (min-height:521px){
.levelup.kk-evo-any .card .ic{margin-top:.5em}
.levelup.many.kk-evo-any .card .ic{width:4em;height:4em;margin-top:.3em}
.levelup.many.kk-evo-any .card .ic img{width:3.3em;height:3.3em}
}
@media (orientation:landscape) and (max-height:520px){
.kk-evo-on .kk-evo{margin-top:.15em}
.kk-evo-on .kk-evo-ln{justify-content:center;font-size:max(10px,.7em);padding:.06em .3em;border-width:1.5px}
.levelup.many .kk-evo-on .kk-evo-ln{flex-wrap:nowrap;white-space:nowrap}
.levelup.many .kk-evo-to b{min-width:0;overflow:hidden;text-overflow:ellipsis}
.levelup.many .kk-evo-ln>*{flex:0 1 auto}
.kk-evo-on .kk-evo-word,.kk-evo-on .kk-evo-bn,.kk-evo-on .kk-evo-nm,.kk-evo-on .kk-evo-dot,.kk-evo-on .kk-evo-lvl,.kk-evo-on .kk-evo-pa{display:none}
.kk-evo-on .kk-evo-miss .kk-evo-pa,.kk-evo-on .kk-evo-block .kk-evo-pa{display:inline-flex}
.kk-evo-on .kk-evo-lvs{display:inline}
.kk-evo-on .kk-evo-ic{width:1.25em;height:1.25em}
.levelup.many.kk-evo-any .card .ic{width:2.1em;height:2.1em;margin-top:0}
.levelup.many.kk-evo-any .card .ic img{width:1.8em;height:1.8em}
}
.kk-evo-list{display:grid;grid-template-columns:minmax(0,1fr);gap:.25em;margin:0}
.kk-evo-list .kk-evo-ln{justify-content:flex-start}
@media (min-width:600px) and (min-height:521px){
.kk-evo-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:.3em .5em}
.kk-evo-list .kk-evo-ln{flex-wrap:nowrap;white-space:nowrap}
.kk-evo-list .kk-evo-to b{min-width:0;overflow:hidden;text-overflow:ellipsis}
.kk-evo-list .kk-evo-ln>*{flex:0 1 auto}
.kk-evo-list .kk-evo-word,.kk-evo-list .kk-evo-nm,.kk-evo-list .kk-evo-lvl,.kk-evo-list .kk-evo-dot,.kk-evo-list .kk-evo-ready .kk-evo-pa,.kk-evo-list .kk-evo-have .kk-evo-pa{display:none}
.kk-evo-list .kk-evo-lvs{display:inline}
}
@media (orientation:landscape) and (max-height:520px){.kk-evo-h,.kk-evo-list{display:none}}
.kk-evo-badge{position:absolute;top:-8px;right:-8px;width:1.45em;height:1.45em;border-radius:50%;display:grid;place-items:center;background:var(--deep);border:2px solid rgba(221,198,255,.55);box-shadow:0 0 0 2px var(--outline);pointer-events:none}
.kk-evo-badge img.px{width:1.1em;height:1.1em}
.kk-evo-badge.kk-evb-r{border-color:var(--yellow);box-shadow:0 0 0 2px var(--outline),0 0 9px var(--yellow)}
.kk-evo-badge.kk-evb-h{border-color:var(--cyan)}
.kk-evo-badge.kk-evb-m img,.kk-evo-badge.kk-evb-b img{filter:grayscale(1) brightness(.75);opacity:.7}
@media (orientation:portrait) and (max-height:620px){
.kk-evo-h{display:none}
.kk-evo-list{grid-template-columns:minmax(0,1fr);gap:.18em}
.kk-evo-list .kk-evo-ln{font-size:max(10px,.72em);padding:.08em .35em;border-width:1.5px}
.kk-evo-list .kk-evo-ic{width:1.3em;height:1.3em}
.kk-evo-list .kk-evo-word,.kk-evo-list .kk-evo-nm,.kk-evo-list .kk-evo-lvl{display:none}
.kk-evo-list .kk-evo-lvs{display:inline}
}`;

let cssDone = false;
/** Inject the hint styles once (level-up, chest and pause call it before drawing). */
export function injectEvoCss(): void {
  if (cssDone || typeof document === "undefined") return;
  cssDone = true;
  const s = document.createElement("style");
  s.dataset.kk = "evo-hints";
  s.textContent = KE_CSS;
  document.head.appendChild(s);
}
