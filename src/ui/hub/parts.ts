/**
 * Markup pieces shared by several hub pages: the stage "episode thumbnail"
 * (composed in the DOM from the stage's own ground tile, deco, enemy and boss
 * sprites - docs/content/art-manifest.md), relic tiles with rarity frames and
 * stars, star pips, toggles, and "not enough" helpers.
 */
import type { RelicDef } from "../../game/defs";
import { BOSSES, ENEMIES, STAGES } from "../../game/registry";
import type { StageInfo } from "../../game/defs";
import type { DecoScatter, DecoTall } from "../../game/stage";
import { esc, fmtInt, fmtTime, hasArt, sprite } from "../dom";
import { RARITY_CLS, relicIcon, spriteUrl } from "../kit/art";
import type { StageRecord } from "../../meta/profile";

/** Stage thumbnail: tiled ground + deco + a regular enemy + the final boss; `locked` = a "???" silhouette. */
export function stageThumb(info: StageInfo | undefined, locked = false): string {
  const def = info ? STAGES.get(info.id) : undefined;
  if (!def || locked) return `<div class="thumb locked" aria-hidden="true"><i class="tq">?</i><i class="scan"></i></div>`;
  const tile = spriteUrl(sprite(def.tiles.sprite, 0));
  const tile2 = spriteUrl(sprite(def.tiles.sprite, 3));
  const tall = def.deco.find((d): d is DecoTall => d.kind === "tall");
  const scatter = def.deco.find((d): d is DecoScatter => d.kind === "scatter");
  const flowers = (scatter?.items ?? []).slice(0, 3).map((it) => it.sprite);
  const enemyIds = info?.enemies ?? [];
  const en = enemyIds.map((e) => ENEMIES.get(e)).find((e) => e && hasArt(e.sprite));
  const boss = BOSSES.get(def.finalBoss);
  const im = (id: string | undefined, cls: string, frame = 0) => (id && hasArt(id) ? `<img class="px ${cls}" alt="" draggable="false" src="${sprite(id, frame)}">` : "");
  return `<div class="thumb" aria-hidden="true" style="--tile:${tile};--tile2:${tile2};--clear:#${def.clearColor.toString(16).padStart(6, "0")}">
    ${im(tall?.sprite, "th-tree a")}${im(tall?.sprite, "th-tree b")}
    ${flowers.map((f, i) => im(f, `th-deco d${i}`)).join("")}
    ${im(en?.sprite, "th-en a")}${im(en?.sprite, "th-en b", 1)}
    ${im(boss?.sprite, "th-boss")}
    <i class="th-vig"></i>
  </div>`;
}

/** Record chips of a stage. */
export function stageRecords(rec: StageRecord | undefined, info: StageInfo | undefined): string {
  if (!rec || rec.runs <= 0) return `<span class="rchip muted">NOT AIRED YET</span>`;
  const chips: string[] = [];
  chips.push(`<span class="rchip"><small>BEST</small>${fmtTime(rec.bestTime)}</span>`);
  if (rec.clears > 0) chips.push(`<span class="rchip gold"><small>CLEARS</small>${fmtInt(rec.clears)}</span>`);
  if (rec.bestHeat >= 0) chips.push(`<span class="rchip heat"><small>HEAT</small>${rec.bestHeat}</span>`);
  if (rec.bestEndless > 0 && info?.endless !== false) chips.push(`<span class="rchip cyan"><small>FILLER</small>${fmtTime(rec.bestEndless)}</span>`);
  return chips.join("");
}

/** ★ pips for relic stars (0..6). */
export function starPips(stars: number, max = 6): string {
  let s = "";
  for (let i = 0; i < max; i++) s += `<i class="${i < stars ? "on" : ""}">★</i>`;
  return `<span class="stars6" aria-label="${stars} stars">${s}</span>`;
}

/** Relic tile (icon in its rarity frame + stars). */
export function relicTile(def: RelicDef, stars: number, extra = ""): string {
  return `<span class="relic-t rf r-${RARITY_CLS[def.rarity]} ${extra}">${relicIcon(def.id, def.rarity)}<span class="rt-st">${stars > 0 ? `★${stars}` : ""}</span></span>`;
}

/** On / off switch markup (the settings toggle look). */
export function toggle(on: boolean, act: string, label: string): string {
  return `<button class="tog${on ? " on" : ""}" data-nav data-act="${act}" role="switch" aria-checked="${on}" aria-label="${esc(label)}"></button>`;
}

/** "m:ss". */
export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
