/**
 * The codex ("Kira Kira Wiki", docs/EXPANSION.md §11): discovered entries per
 * tab and the small Dream Gem bounty paid for each new discovery
 * (TUNING.codex). Undiscovered entries are shown as silhouettes with the
 * unlock hint (src/meta/unlocks.ts). PURE.
 */
import { gameContent, type MetaContent } from "./content";
import { masteryInfo } from "./economy";
import { CODEX_TABS, type CodexTab, type Profile } from "./profile";
import { TUNING } from "./tuning";
import { addId } from "./util";

const BOUNTY_KEY: Record<CodexTab, string> = {
  heroes: "hero",
  weapons: "weapon",
  passives: "passive",
  enemies: "enemy",
  bosses: "boss",
  relics: "relic",
  stages: "stage",
};

/** Gems paid for discovering one entry of a tab. */
export function codexBounty(tab: CodexTab): number {
  return TUNING.codex[BOUNTY_KEY[tab]] ?? 0;
}

/** Mark an entry discovered. Pays (and returns) the gem bounty the first time; 0 if already known. */
export function discover(p: Profile, tab: CodexTab, id: string): number {
  if (!addId(p.codex[tab], id)) return 0;
  const gems = codexBounty(tab);
  p.currencies.gems += gems;
  p.lifetime.gemsEarned += gems;
  return gems;
}

export function isDiscovered(p: Profile, tab: CodexTab, id: string): boolean {
  return p.codex[tab].includes(id);
}

/** All entry ids of a tab in the current content (codex order). */
export function codexEntries(tab: CodexTab, ctx: MetaContent = gameContent()): string[] {
  switch (tab) {
    case "heroes":
      return ctx.heroes.map((h) => h.id);
    case "weapons":
      return ctx.baseWeapons.map((w) => w.id);
    case "passives":
      return [...ctx.passives.keys()];
    case "enemies":
      return [...ctx.enemies.keys()];
    case "bosses":
      return [...ctx.bosses.keys()];
    case "relics":
      return [...ctx.relics.keys()];
    case "stages":
      return ctx.stages.map((s) => s.id);
  }
}

export interface CodexTabProgress {
  tab: CodexTab;
  found: number;
  total: number;
}

/** Discovered / total per tab (only entries that exist in the content count). */
export function codexProgress(p: Profile, ctx: MetaContent = gameContent()): CodexTabProgress[] {
  return CODEX_TABS.map((tab) => {
    const all = codexEntries(tab, ctx);
    const known = new Set(p.codex[tab]);
    return { tab, found: all.filter((id) => known.has(id)).length, total: all.length };
  });
}

/** Weapon codex extras: mastery rank and the "MASTERED" badge (rank 10). */
export function weaponCodexInfo(p: Profile, id: string): { discovered: boolean; mastery: number; mastered: boolean; kills: number; damage: number } {
  const m = masteryInfo(p.mastery[id] ?? 0);
  return { discovered: isDiscovered(p, "weapons", id), mastery: m.rank, mastered: m.maxed, kills: p.lifetime.killsByWeapon[id] ?? 0, damage: Math.round(p.lifetime.damageByWeapon[id] ?? 0) };
}
