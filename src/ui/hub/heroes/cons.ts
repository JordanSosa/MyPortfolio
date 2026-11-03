/**
 * CONSTELLATION tab (docs/content/heroes.md §4): the hero's six dupe stars C1-C6
 * as a little night-sky chart (one of a few star shapes, picked per hero),
 * owned stars gold and joined by lit lines, the next star pulsing, the current
 * tier's satire name in the middle ("C2 · Rerun Banner Edition"); under it the
 * ladder with the shared names, their star-up subtitles and each hero's real
 * effect. Stars are buttons: tap / focus one to read it in the chart caption.
 */
import type { HeroDef } from "../../../game/types";
import { esc, hasArt, img } from "../../dom";
import { btn, tag } from "../../kit/controls";

/** Shared star-up subtitles (heroes.md §4: "Subtitle on the star-up card"). */
export const CONS_SUB: readonly string[] = [
  "Same character, new hair colour. That'll be one dupe, please.",
  "Back by popular demand (the demand was the algorithm).",
  "Sun hat. SPF 50. Otherwise the exact same outfit.",
  "The collab partner has asked us to stop.",
  "Now available as a plushie. The plushie is stronger.",
  "Fully awakened. Until next season's final form.",
];

/** Star shapes in a 100 x 60 box (C1..C6 in order). */
const SHAPES: readonly (readonly [number, number][])[] = [
  [
    [10, 42],
    [25, 22],
    [43, 31],
    [59, 13],
    [76, 27],
    [91, 9],
  ],
  [
    [9, 46],
    [23, 16],
    [39, 37],
    [55, 9],
    [71, 35],
    [89, 15],
  ],
  [
    [8, 40],
    [24, 21],
    [42, 12],
    [60, 13],
    [77, 22],
    [92, 41],
  ],
  [
    [15, 21],
    [30, 8],
    [47, 23],
    [64, 8],
    [81, 21],
    [48, 50],
  ],
];

function shapeOf(id: string): readonly [number, number][] {
  let x = 3;
  for (let i = 0; i < id.length; i++) x = (x * 33 + id.charCodeAt(i)) >>> 0;
  return SHAPES[x % SHAPES.length];
}

export function consCaption(hd: HeroDef, c: number, focus: number | null): string {
  const list = hd.constellations ?? [];
  const i = focus ?? (c > 0 ? c - 1 : -1);
  if (i < 0) return `<b class="cc-c">C0</b><span><b>Base Edition</b><small>No dupes yet. The Merch Machine is right there. (Allegedly.)</small></span>`;
  const s = list[i];
  return `<b class="cc-c${i < c ? " on" : ""}">C${i + 1}</b><span><b>${esc(s?.name ?? "")}</b><small>${esc(s?.desc ?? "")}${i >= c ? " · not yet" : ""}</small></span>`;
}

export function consHtml(hd: HeroDef, c: number, gacha: boolean): string {
  const list = hd.constellations ?? [];
  if (!list.length) return `<p class="lo-note">No constellation chart for this hero yet.</p>`;
  const pts = shapeOf(hd.id);
  const star = (look: number) => (hasArt("board_node") ? img("board_node", "px", look) : `<i class="css-star"></i>`);
  const lines = pts
    .slice(1)
    .map(([x, y], i) => {
      const [x0, y0] = pts[i];
      return `<line class="${i + 1 < c ? "on" : ""}" x1="${x0}" y1="${y0}" x2="${x}" y2="${y}"/>`;
    })
    .join("");
  const stars = pts
    .map(([x, y], i) => {
      const st = i < c ? "on" : i === c ? "next" : "off";
      return `<button class="cs-st ${st}" data-nav data-act="star" data-i="${i}" style="left:${x}%;top:${(y / 60) * 100}%;--i:${i}" aria-label="C${i + 1} ${esc(list[i]?.name ?? "")}">${star(st === "on" ? 3 : st === "next" ? 2 : 0)}<small>C${i + 1}</small></button>`;
    })
    .join("");
  const rows = list
    .map(
      (s, i) => `<div class="cons-row${i < c ? " on" : ""}${i === c ? " next" : ""}" style="--i:${i}">
        <span class="cs-star">${i < c ? "★" : "☆"}<small>C${i + 1}</small></span>
        <span class="cs-tx"><b>${esc(s.name)}</b><small class="cs-sub">“${esc(CONS_SUB[i] ?? "")}”</small><small class="cs-fx">${esc(s.desc)}</small></span>
        ${i < c ? tag("ACTIVE", "gold") : i === c ? tag("NEXT DUPE", "pink") : ""}
      </div>`,
    )
    .join("");
  return `
    <div class="cons-chart" style="--n:${c}">
      <div class="cs-sky" aria-hidden="true"></div>
      <div class="cs-field">
        <svg class="cs-lines" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${stars}
      </div>
      <div class="cs-cap" aria-live="polite">${consCaption(hd, c, null)}</div>
    </div>
    <p class="pg-note">Every dupe from the Merch Machine adds one star. Each star is a real bonus. ${c >= 6 ? "Fully awakened. (Until next season.)" : `${6 - c} to go.`}</p>
    <div class="cons-list">${rows}</div>
    <div class="cons-cta">${btn("MERCH MACHINE", { cls: "violet small", act: "gacha", sub: gacha ? "dupes = stars" : "copies drop at SR" })}</div>`;
}
