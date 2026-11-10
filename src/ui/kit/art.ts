/**
 * Atlas art for the hub, with CSS stand-ins while Season 2 art is still being
 * drawn. Every id here is a manifest id (src/art/manifest.ts): as soon as the
 * art agents register a sprite, `hasArt` turns true and the real pixels show;
 * until then the hub draws a styled CSS shape in the same footprint (never the
 * magenta placeholder checkerboard, which is for in-world debugging).
 */
import type { Rarity } from "../../game/defs";
import { esc, hasArt, img } from "../dom";

export type CurrencyId = "coins" | "gems" | "copium";

/** CSS class suffix per rarity (rarity frames, badges, colours). */
export const RARITY_CLS: Readonly<Record<Rarity, string>> = { N: "n", R: "r", SR: "sr", SSR: "ssr", UR: "ur", LR: "lr", MYTHIC: "my" };
/** Short badge text. */
export const RARITY_LABEL: Readonly<Record<Rarity, string>> = { N: "N", R: "R", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR", MYTHIC: "MYTHIC" };
/** Reveal titles (docs/content/gacha.md §3). */
export const RARITY_TITLE: Readonly<Record<Rarity, string>> = {
  N: "N — NORMIE",
  R: "R — RARE (ISH)",
  SR: "SR — SUPER RARE!",
  SSR: "SSR — SUPER SUPER RARE!!",
  UR: "UR — ULTRA RARE!!!",
  LR: "LR — LEGENDARY RARE!!!!",
  MYTHIC: "MYTHIC — 0.0069% — NICE",
};
/** Atlas frame of `ui_rarity_badge` / `ui_card_corner` per rarity. */
const RARITY_FRAME: Readonly<Record<Rarity, number>> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4, LR: 5, MYTHIC: 6 };

/** `<img>` when the atlas has real art for `id`, else `fallback` markup. */
export function art(id: string, fallback: string, cls = "px", frame = 0): string {
  return hasArt(id) ? img(id, cls, frame) : fallback;
}

/** Currency icon (big = the hub bar's 24 px coin / gem / capsule). */
export function currencyIcon(c: CurrencyId, big = false, cls = "cico"): string {
  if (c === "coins") return big && hasArt("ui_coin_big") ? img("ui_coin_big", `px ${cls}`) : img("icon_coin", `px ${cls}`);
  if (c === "gems") {
    if (big && hasArt("ui_gem_big")) return img("ui_gem_big", `px ${cls}`);
    return art("icon_dreamgem", `<i class="${cls} css-gem" aria-hidden="true"></i>`, `px ${cls}`);
  }
  if (big && hasArt("ui_copium_big")) return img("ui_copium_big", `px ${cls}`);
  return art("icon_copium", `<i class="${cls} css-pill" aria-hidden="true"></i>`, `px ${cls}`);
}

/** Inline currency amount: icon + number ("★ 1,250"). */
export function money(c: CurrencyId, amount: string, cls = ""): string {
  return `<span class="money m-${c} ${cls}">${currencyIcon(c, false, "mico")}<b>${amount}</b></span>`;
}

/** Relic icon (16 px art, else a capsule in rarity colours). */
export function relicIcon(id: string, rarity: Rarity, cls = "rico"): string {
  return art(`icon_relic_${id}`, `<i class="${cls} css-capsule r-${RARITY_CLS[rarity]}" aria-hidden="true"></i>`, `px ${cls}`);
}

/** Plot Twist icon (art, else a flame). */
export function twistIcon(id: string, cls = "tico"): string {
  return art(`icon_twist_${id}`, heatIcon(cls), `px ${cls}`);
}

/** Heat flame. */
export function heatIcon(cls = "tico"): string {
  return art("icon_heat", `<i class="${cls} css-flame" aria-hidden="true"></i>`, `px ${cls}`);
}

/** Plot Point trophy. */
export function trophyIcon(cls = "aico"): string {
  return art("icon_trophy", `<i class="${cls} css-trophy" aria-hidden="true"></i>`, `px ${cls}`);
}

/** Undiscovered codex entry. */
export function unknownIcon(cls = "uico"): string {
  return art("icon_codex_unknown", `<i class="${cls} css-unknown" aria-hidden="true"></i>`, `px ${cls}`);
}

/** Hero portrait frame (0 calm / 1 shouting); a silhouette while the art is missing (or `locked`). */
export function portrait(portraitId: string, frame = 0, cls = "pimg", locked = false): string {
  if (!locked && hasArt(portraitId)) return img(portraitId, `px ${cls}`, frame);
  return `<i class="${cls} css-silhouette" aria-hidden="true"><b>?</b></i>`;
}

/** Rarity badge chip (art frame, else a CSS chip with the lettering). */
export function rarityBadge(r: Rarity, cls = "rbadge"): string {
  if (hasArt("ui_rarity_badge")) return img("ui_rarity_badge", `px ${cls} art`, RARITY_FRAME[r]);
  return `<span class="${cls} r-${RARITY_CLS[r]}">${esc(RARITY_LABEL[r])}</span>`;
}

/** A sprite as a CSS background tile (stage thumbnails). Empty string when unavailable. */
export function spriteUrl(dataUrl: string): string {
  // (single quotes: the value goes into double-quoted inline style attributes - a `"` would end the attribute
  // early and drop every custom property after it, e.g. the stage cards' --tile / --clear)
  return dataUrl ? `url('${dataUrl}')` : "none";
}
