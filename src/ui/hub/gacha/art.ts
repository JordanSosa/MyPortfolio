/**
 * Merch Machine art helpers: item art (hero portrait / relic icon) at any
 * size, the per-rarity colours of the summon (meteor / capsule frames, beam and
 * particle colours), result cards (face-down back with ui_card_corner
 * ornaments, face with rarity frame + badge) and the machine sprite stack.
 * Every sprite falls back to a CSS stand-in through kit/art.ts.
 */
import type { Rarity } from "../../../game/defs";
import { RARITIES } from "../../../game/defs";
import { HEROES } from "../../../game/heroes";
import type { GachaItem } from "../../../meta/gacha/banners";
import { esc, hasArt, img } from "../../dom";
import { portrait, RARITY_CLS, RARITY_TITLE, rarityBadge, relicIcon } from "../../kit/art";

export const rarityIdx = (r: Rarity): number => RARITIES.indexOf(r);
export const isSsrPlus = (r: Rarity): boolean => rarityIdx(r) >= 3;

/** `ui_gacha_meteor` / `ui_gacha_capsule` frame per best rarity: blue / purple / gold / rainbow / glitch. */
export function meteorFrame(r: Rarity): number {
  const i = rarityIdx(r);
  return i <= 1 ? 0 : i === 2 ? 1 : i === 3 ? 2 : i <= 5 ? 3 : 4;
}
export const CAPSULE_CRACKED = 5;
export const METEOR_CLS = ["blue", "purple", "gold", "rainbow", "glitch"] as const;

/** Particle / beam colours per rarity (canvas + CSS custom properties). */
export const RARITY_HEX: Readonly<Record<Rarity, readonly string[]>> = {
  N: ["#b0d8ff", "#5aa8ff", "#ffffff"],
  R: ["#b0d8ff", "#5aa8ff", "#ffffff"],
  SR: ["#ddc6ff", "#b47cff", "#ffffff"],
  SSR: ["#fff7b0", "#ffe14d", "#e0a020", "#ffffff"],
  UR: ["#ff7ab8", "#ffe14d", "#4fe6df", "#b47cff", "#94e85e"],
  LR: ["#ffe14d", "#ff4d6d", "#fff7b0", "#ad1d4a"],
  MYTHIC: ["#ff4fd8", "#4fe6df", "#ffe14d", "#94e85e", "#5aa8ff", "#ffffff"],
};
export const RAINBOW: readonly string[] = ["#ff7ab8", "#ff9a3d", "#ffe14d", "#94e85e", "#4fe6df", "#5aa8ff", "#b47cff", "#ff4fd8"];

export function heroDef(id: string) {
  return HEROES.find((x) => x.id === id);
}

/** Item art: hero portrait (frame 0 calm / 1 shouting) or relic icon. */
export function itemArt(it: GachaItem, cls = "gi", frame = 0): string {
  if (it.kind === "hero") return portrait(heroDef(it.id)?.portrait ?? "", frame, cls);
  return relicIcon(it.id, it.rarity, cls);
}

/** The hero's cast pose (constellation star-up), else the portrait's shouting frame. */
export function castPose(id: string, cls = "gi"): string {
  const d = heroDef(id);
  const s = d ? `${d.sprite}_cast` : "";
  if (s && hasArt(s)) return img(s, `px ${cls}`, 0);
  return portrait(d?.portrait ?? "", 1, cls);
}

/** `ui_card_corner` ornaments (mirrored into 4 corners by CSS), else nothing. */
export function cardCorners(r: Rarity): string {
  if (!hasArt("ui_card_corner")) return "";
  const f = rarityIdx(r);
  return `<i class="cc tl">${img("ui_card_corner", "px", f)}</i><i class="cc tr">${img("ui_card_corner", "px", f)}</i><i class="cc bl">${img("ui_card_corner", "px", f)}</i><i class="cc br">${img("ui_card_corner", "px", f)}</i>`;
}

/** A stack of every frame of a sprite (CSS shows one at a time by opacity: compositor-only frame flips). */
export function frameStack(id: string, frames: number, cls: string, fallback: string): string {
  if (!hasArt(id)) return fallback;
  let s = "";
  for (let f = 0; f < frames; f++) s += img(id, `px ${cls} f${f}`, f);
  return s;
}

/** The Merch Machine (64x80x4: f0-1 idle glow, f2 crank, f3 dispensing), CSS stand-in without the art. */
export function machineArt(): string {
  return frameStack("ui_merch_machine", 4, "mmf", `<span class="css-machine"><i class="cm-dome"><i></i><i></i><i></i></i><i class="cm-base"></i><i class="cm-sticker">NOT A SLOT MACHINE</i></span>`);
}

/** Result card: face-down back (rarity-coloured, corner ornaments) + face (art, badge, name, result chip). */
export function cardHtml(it: GachaItem, i: number, chip: string, extra = "", sub = ""): string {
  const rc = RARITY_CLS[it.rarity];
  return `<div class="cd r-${rc}${isSsrPlus(it.rarity) ? " hi" : ""} ${extra}" style="--i:${i}" data-i="${i}">
    <div class="cd-in">
      <div class="cd-back"><i class="cd-emb">✦</i>${cardCorners(it.rarity)}</div>
      <div class="cd-face rf r-${rc}">
        ${cardCorners(it.rarity)}
        <span class="cd-art">${itemArt(it, "cd-img")}</span>
        <span class="cd-tx">${rarityBadge(it.rarity, "rbadge cd-bdg")}<b class="cd-nm">${esc(it.name)}</b><span class="cd-chip">${chip}</span>${sub ? `<span class="cd-rt"><b>${esc(RARITY_TITLE[it.rarity])}</b><small>${esc(sub)}</small></span>` : ""}</span>
        ${extra.includes("lost") ? `<i class="cd-lost">LOST 50/50</i>` : ""}
      </div>
    </div>
  </div>`;
}
