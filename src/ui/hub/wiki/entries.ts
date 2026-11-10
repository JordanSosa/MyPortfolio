/**
 * Kira Kira Wiki entry model: every codex tab's entries as plain rows (found?,
 * display name, art, the undiscovered hint, a small badge, filter keys), built
 * once per render from the profile + the content catalogue. The page shell
 * (../wiki.ts) turns them into tiles, filters and search results; the article
 * builder (./article.ts) reads the same helpers.
 */
import type { Rarity } from "../../../game/defs";
import { BOSSES, ENEMIES, RELICS, STAGES } from "../../../game/registry";
import { codexEntries, isDiscovered, weaponCodexInfo } from "../../../meta/codex";
import type { MetaContent } from "../../../meta/content";
import type { CodexTab, Profile } from "../../../meta/profile";
import { unlockStatus } from "../../../meta/unlocks";
import { fmtInt, hasArt, img } from "../../dom";
import { portrait, relicIcon, unknownIcon } from "../../kit/art";
import { clock, stageThumb } from "../parts";
import { STUB } from "./copy";

export interface WikiEntry {
  tab: CodexTab;
  id: string;
  found: boolean;
  /** Display name ("???" while undiscovered). */
  name: string;
  /** Real name (search + sorting; never shown while undiscovered). */
  real: string;
  /** Tile art markup (the silhouette while undiscovered). */
  icon: string;
  /** Undiscovered hint ("Defeat 1,000 Puffs."). */
  hint: string;
  /** Small badge under the name (kills, mastery, stars). */
  badge: string;
  /** Relic rarity (frame + filter). */
  rarity?: Rarity;
  /** Weapon mastery rank / mastered; relic owned. */
  rank?: number;
  mastered?: boolean;
  /** Stage the enemy / boss appears in (filter chips). */
  stage?: string;
}

/** Where an enemy appears / when a boss arrives (hints + infobox rows). */
export function whereIs(id: string, boss: boolean): { stage: string; text: string; at?: number } {
  const list = [...STAGES.values()].sort((a, b) => a.order - b.order);
  for (const s of list) {
    if (boss) {
      const ev = s.events.find((e) => e.kind === "boss" && e.enemy === id);
      if (ev) return { stage: s.id, text: `Arrives at ${clock(ev.at)} in ${s.name}.`, at: ev.at };
      if (s.finalBoss === id) return { stage: s.id, text: `The finale of ${s.name}.` };
    } else if (s.phases.some((ph) => id in ph.mix) || s.events.some((e) => e.enemy === id)) return { stage: s.id, text: `Appears in ${s.name}.` };
  }
  return { stage: "", text: boss ? "Arrives in a later episode." : "Appears in a later episode." };
}

/** Real display name of an entry. */
export function entryName(t: CodexTab, id: string, ctx: MetaContent): string {
  switch (t) {
    case "heroes":
      return ctx.heroById.get(id)?.name ?? id;
    case "weapons":
      return ctx.weapons.get(id)?.name ?? id;
    case "passives":
      return ctx.passives.get(id)?.name ?? id;
    case "enemies":
      return ENEMIES.get(id)?.name ?? id;
    case "bosses":
      return BOSSES.get(id)?.name ?? id;
    case "relics":
      return RELICS.get(id)?.name ?? id;
    case "stages":
      return ctx.stageById.get(id)?.name ?? id;
  }
}

/** Entry art (discovered). */
export function entryIcon(t: CodexTab, id: string, ctx: MetaContent, cls = "wk-ic"): string {
  switch (t) {
    case "heroes":
      return portrait(ctx.heroById.get(id)?.portrait ?? "", 0, cls);
    case "weapons":
    case "passives": {
      const ic = ctx.weapons.get(id)?.icon ?? ctx.passives.get(id)?.icon ?? "";
      return hasArt(ic) ? img(ic, `px ${cls}`) : unknownIcon(cls);
    }
    case "enemies":
    case "bosses": {
      const sp = (t === "enemies" ? ENEMIES.get(id) : BOSSES.get(id))?.sprite ?? "";
      return hasArt(sp) ? img(sp, `px ${cls} spr`) : unknownIcon(cls);
    }
    case "relics": {
      const d = RELICS.get(id);
      return d ? relicIcon(id, d.rarity, cls) : unknownIcon(cls);
    }
    case "stages":
      return `<span class="${cls} st">${stageThumb(ctx.stageById.get(id))}</span>`;
  }
}

/** Undiscovered: the entry's own art as a silhouette (heroes, weapons, passives, enemies, bosses), else "?". */
export function silhouette(t: CodexTab, id: string, ctx: MetaContent, cls = "wk-ic"): string {
  let sp = "";
  if (t === "heroes") sp = ctx.heroById.get(id)?.portrait ?? "";
  else if (t === "weapons" || t === "passives") sp = ctx.weapons.get(id)?.icon ?? ctx.passives.get(id)?.icon ?? "";
  else if (t === "enemies") sp = ENEMIES.get(id)?.sprite ?? "";
  else if (t === "bosses") sp = BOSSES.get(id)?.sprite ?? "";
  if (t === "stages") return `<span class="${cls} st">${stageThumb(undefined, true)}</span>`;
  return sp && hasArt(sp) ? img(sp, `px ${cls} sil${t === "enemies" || t === "bosses" ? " spr" : ""}`) : unknownIcon(cls);
}

/** The per-tab undiscovered hint (satire.md §8 "Codex undiscovered entry"). */
export function hintFor(p: Profile, t: CodexTab, id: string, ctx: MetaContent): string {
  switch (t) {
    case "heroes":
      return unlockStatus(p, "hero", id, ctx).rule.hint || "??? — Appears in a later episode.";
    case "weapons":
    case "passives": {
      const st = unlockStatus(p, t === "weapons" ? "weapon" : "passive", id, ctx);
      if (st.rule.hint) return `${st.rule.hint}${st.target > 1 && !st.unlocked ? ` (${fmtInt(Math.min(st.value, st.target))} / ${fmtInt(st.target)})` : ""}`;
      return "Pick it up in an episode to write its article.";
    }
    case "enemies":
      return whereIs(id, false).text;
    case "bosses":
      return whereIs(id, true).text;
    case "relics":
      return "Available in the Merch Machine. Allegedly.";
    case "stages": {
      const s = ctx.stageById.get(id);
      const prev = s ? ctx.stages.find((x) => x.order === s.order - 1) : undefined;
      return prev ? `Unlocks after ${prev.name}.` : "Play an episode.";
    }
  }
}

/** Every entry of a codex tab (codex order; discovered first is the page's call). */
export function tabEntries(p: Profile, t: CodexTab, ctx: MetaContent): WikiEntry[] {
  return codexEntries(t, ctx).map((id) => {
    const found = isDiscovered(p, t, id);
    const real = entryName(t, id, ctx);
    const e: WikiEntry = { tab: t, id, found, name: found ? real : "???", real, icon: found ? entryIcon(t, id, ctx) : silhouette(t, id, ctx), hint: found ? "" : hintFor(p, t, id, ctx), badge: "" };
    if (t === "weapons") {
      const m = weaponCodexInfo(p, id);
      e.rank = m.mastery;
      e.mastered = m.mastered;
      if (found) e.badge = m.mastered ? `<i class="wk-b gold">MASTERED</i>` : m.mastery >= 5 ? `<i class="wk-b lb">M${m.mastery} · LB</i>` : m.mastery > 0 ? `<i class="wk-b">M${m.mastery}</i>` : "";
    } else if (t === "relics") {
      const d = RELICS.get(id);
      e.rarity = d?.rarity;
      const st = p.relics[id];
      e.rank = st ?? -1;
      if (found && st !== undefined) e.badge = `<i class="wk-b star">${"★".repeat(Math.min(st, 6)) || "☆"}</i>`;
    } else if (t === "enemies" || t === "bosses") {
      const k = t === "enemies" ? (p.lifetime.killsByEnemy[id] ?? 0) : (p.lifetime.bossKills[id] ?? 0);
      e.stage = whereIs(id, t === "bosses").stage;
      if (found) e.badge = `<i class="wk-b">×${fmtInt(k)}</i>`;
    } else if (t === "stages") {
      const r = p.records[id];
      if (found && r && r.clears > 0) e.badge = `<i class="wk-b gold">CLEARED</i>`;
      else if (found && r && r.runs > 0) e.badge = `<i class="wk-b">BEST ${clock(r.bestTime)}</i>`;
    } else if (t === "heroes") {
      const hp = p.heroes[id];
      if (found && p.unlocks.heroes.includes(id)) e.badge = `<i class="wk-b">LV ${hp ? Math.max(1, hp.level) : 1}${hp && hp.constellation ? ` · C${hp.constellation}` : ""}</i>`;
      else if (found) e.badge = `<i class="wk-b dim">NOT IN CAST</i>`;
    }
    return e;
  });
}

export { STUB };
