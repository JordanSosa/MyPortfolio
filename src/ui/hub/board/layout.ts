/**
 * Training Arc geometry: the meta layer's constellation layout (board units,
 * centre at 0,0) spread into CSS px, plus the static markup of the map: the
 * nebula backdrop, ring orbits, the constellation lines (a soft halo line and
 * a core line per edge, restyled by class when a path lights up), the sector
 * names curved along the outer rim, the ring-gate chips and one button per
 * node (star sprite + tinted stat glyph + rank pips). Built once per page.
 */
import { BOARD, CENTER_ID } from "../../../meta/board/graph";
import type { BoardNode } from "../../../meta/board/types";
import { esc, hasArt, img } from "../../dom";
import { effectGlyph, glyphImg } from "./glyph";

/**
 * Screen spread of the meta layout (board units -> CSS px at zoom 1): ring 1's
 * twelve nodes sit 120 units from the centre, too tight for 48 px stars with a
 * rank row under them, so the UI spreads every position.
 */
export const K = 1.4;
/** Ring radius in px (index = ring; the last entry is the keystone orbit). */
export const RING_PX: readonly number[] = BOARD.radius.map((r) => r * K);
const KEY_PX = RING_PX[RING_PX.length - 1];
/** Curved sector names run along this radius, past the keystones. */
export const LABEL_R = KEY_PX + 92;
export const R_MAX = LABEL_R + 70;
export const BOUNDS = { x0: -R_MAX, y0: -R_MAX, x1: R_MAX, y1: R_MAX };
/** Node footprint (px at zoom 1): the art is 16 / 24 / 32 px, drawn at 3x. */
export const SIZE: Record<BoardNode["kind"], number> = { center: 96, stat: 48, utility: 54, keystone: 72 };
/** Pixel position of a node (content coordinates, centre 0,0). */
export const px = (n: BoardNode): [number, number] => [n.x * K, n.y * K];
/** Left / top inside the content element (whose origin is the bounds' corner). */
const at = (x: number, y: number) => `left:${(x - BOUNDS.x0).toFixed(1)}px;top:${(y - BOUNDS.y0).toFixed(1)}px`;

export const LOCK_TINT = "#6c5a92";
export const OWN_TINT = "#ffffff";
export const sectorColor = (n: BoardNode): string => (n.sector >= 0 ? BOARD.sectors[n.sector].color : "#ffe14d");

/** Star frame per state (board_node / board_keystone: 0 locked, 1 available, 2 affordable, 3 owned). */
export type Look = 0 | 1 | 2 | 3;

export function starImg(n: BoardNode, look: Look): string {
  if (n.kind === "center") return "";
  const id = n.kind === "keystone" ? "board_keystone" : "board_node";
  return hasArt(id) ? img(id, "px bn-st", look) : `<i class="bn-st css-star" aria-hidden="true"></i>`;
}

/** Glyph tint for a look: dim on locked, the sector colour while buyable, white on gold. */
export function glyphTint(n: BoardNode, look: Look): string {
  return look === 0 ? LOCK_TINT : look === 3 ? OWN_TINT : sectorColor(n);
}

/** Static SVG under the nodes: orbits, edges (halo + core), sector names on arcs. */
export function boardSvg(): string {
  const s: string[] = [];
  const W = R_MAX * 2;
  // ring orbits (open ones get a second, finer line: a "track")
  for (let r = 1; r <= BOARD.rings; r++) s.push(`<circle class="orb" data-ring="${r}" cx="0" cy="0" r="${RING_PX[r].toFixed(1)}"/>`);
  s.push(`<circle class="orb ks" cx="0" cy="0" r="${KEY_PX.toFixed(1)}"/>`);
  // wedge dividers (faint)
  for (const sec of BOARD.sectors) {
    const a = ((sec.angle - 30) * Math.PI) / 180;
    const r0 = RING_PX[1] * 0.55;
    const r1 = KEY_PX + 40;
    s.push(`<line class="wedge" x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * r1).toFixed(1)}" y2="${(Math.sin(a) * r1).toFixed(1)}"/>`);
  }
  // edges: halo group under the core group
  const halo: string[] = [];
  const core: string[] = [];
  BOARD.edges.forEach(([a, b], i) => {
    const na = BOARD.byId.get(a) as BoardNode;
    const nb = BOARD.byId.get(b) as BoardNode;
    const [x1, y1] = px(na);
    const [x2, y2] = px(nb);
    const c = `x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"`;
    halo.push(`<line class="eh" data-e="${i}" ${c}/>`);
    core.push(`<line class="ec" data-e="${i}" ${c}/>`);
  });
  s.push(`<g class="g-halo">${halo.join("")}</g><g class="g-core">${core.join("")}</g>`);
  // sector names on arcs (bottom half reversed so they read upright)
  const defs: string[] = [];
  const text: string[] = [];
  BOARD.sectors.forEach((sec, k) => {
    const mid = sec.angle;
    const bottom = Math.sin((mid * Math.PI) / 180) > 0.2;
    const r = bottom ? LABEL_R + 24 : LABEL_R;
    const a0 = ((mid - 28) * Math.PI) / 180;
    const a1 = ((mid + 28) * Math.PI) / 180;
    const p0 = [Math.cos(a0) * r, Math.sin(a0) * r];
    const p1 = [Math.cos(a1) * r, Math.sin(a1) * r];
    const d = bottom ? `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${r},${r} 0 0 0 ${p0[0].toFixed(1)},${p0[1].toFixed(1)}` : `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A${r},${r} 0 0 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    defs.push(`<path id="bd-arc-${k}" d="${d}"/>`);
    text.push(`<text class="sec-t" style="--sc:${sec.color}"><textPath href="#bd-arc-${k}" startOffset="50%" text-anchor="middle">${esc(sec.name.toUpperCase())}</textPath></text>`);
  });
  s.push(`<defs>${defs.join("")}</defs>${text.join("")}`);
  return `<svg class="bd-svg" width="${W}" height="${W}" viewBox="${BOUNDS.x0} ${BOUNDS.y0} ${W} ${W}" aria-hidden="true">${s.join("")}</svg>`;
}

/** Soft sector-coloured nebulae + the centre glow (static CSS gradients, rastered once). */
export function nebulae(): string {
  const out: string[] = [`<i class="bd-neb core" style="${at(0, 0)}"></i>`];
  for (const sec of BOARD.sectors) {
    const a = (sec.angle * Math.PI) / 180;
    const r = RING_PX[3];
    out.push(`<i class="bd-neb" style="${at(Math.cos(a) * r, Math.sin(a) * r)};--sc:${sec.color}"></i>`);
  }
  return out.join("");
}

/** Where a ring's gate chip sits: the wedge border nearest the top of the ring (no star there). */
export function gateAt(ring: number): [number, number] {
  const a = ((ring % 2 === 0 ? -60 : -120) * Math.PI) / 180;
  return [Math.cos(a) * RING_PX[ring], Math.sin(a) * RING_PX[ring]];
}

/**
 * The gate chip of a locked ring: one per ring, on its upper wedge border (gateAt). The page shows
 * only the NEXT locked ring's "REQUIRES: EPISODE N CLEAR" and, on the ring after it, a single
 * "MORE SEASONS TBA" teaser (`.tba`); rings further out stay quiet.
 */
export function gateChips(ring: number, need: string, stageName: string): string {
  const [x, y] = gateAt(ring);
  return `<span class="bd-gate" data-ring="${ring}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}" style="${at(x, y)}" hidden><i class="lock-i"></i><span class="g-tx g-req"><b>${esc(need)}</b><small>Ring ${ring} · ${esc(stageName)}</small></span><span class="g-tx g-tba"><b>MORE SEASONS TBA</b><small>Ring ${ring}+ · stay tuned</small></span></span>`;
}

/** One node button (state classes / frames are painted later). */
export function nodeButton(n: BoardNode): string {
  const [x, y] = px(n);
  const sz = SIZE[n.kind];
  const sc = sectorColor(n);
  if (n.kind === "center") {
    const art = hasArt("board_center") ? `${img("board_center", "px bn-st", 0)}${img("board_center", "px bn-st glow", 1)}` : `<i class="bn-st css-star center"></i>`;
    return `<button class="bn k-center s-max" data-nav data-act="node" data-id="${n.id}" style="${at(x, y)};--sz:${sz}px;--sc:${sc}" aria-label="${esc(n.name)}"><span class="bn-halo"></span>${art}<span class="bn-cap">EPISODE 1</span></button>`;
  }
  const pips = n.maxRank > 1 ? `<span class="bn-pips">${"<i></i>".repeat(n.maxRank)}</span>` : `<span class="bn-pips one"><i></i></span>`;
  return `<button class="bn k-${n.kind}" data-nav data-act="node" data-id="${n.id}" style="${at(x, y)};--sz:${sz}px;--sc:${sc}" aria-label="${esc(n.name)}"><span class="bn-halo"></span>${starImg(n, 1)}${glyphImg(effectGlyph(n.effects), sectorColor(n), "px bn-gl")}${pips}<span class="bn-ap"></span><span class="bn-plus" aria-hidden="true">+</span>${n.kind === "keystone" ? `<span class="bn-air">ON AIR</span>` : ""}</button>`;
}

/** Every node, the centre last (drawn on top). */
export function nodeButtons(): string {
  return BOARD.nodes
    .filter((n) => n.id !== CENTER_ID)
    .map(nodeButton)
    .concat(nodeButton(BOARD.center))
    .join("");
}

/** Edge index lookups: node id -> edge indices touching it. */
export const EDGES_OF: ReadonlyMap<string, readonly number[]> = (() => {
  const m = new Map<string, number[]>();
  BOARD.edges.forEach(([a, b], i) => {
    for (const id of [a, b]) {
      let l = m.get(id);
      if (!l) m.set(id, (l = []));
      l.push(i);
    }
  });
  return m;
})();

/** Bounding box (px) of some nodes, padded. */
export function boxOf(ids: readonly string[], pad = 60): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const id of ids) {
    const n = BOARD.byId.get(id);
    if (!n) continue;
    const [x, y] = px(n);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  if (!Number.isFinite(x0)) return { x0: -pad, y0: -pad, x1: pad, y1: pad };
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}
