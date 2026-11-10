/**
 * The Season 2 hero roster as the account layer sees it (docs/EXPANSION.md §6):
 * which heroes exist, how each is obtained, and the rarity it has in the Merch
 * Machine. Gameplay behaviour (stats, start weapon, ultimate) lives in the sim
 * (src/game/heroes.ts); a hero listed here is only playable / pullable once the
 * sim registers it, so the roster can run ahead of the content wave.
 */
import type { Rarity } from "../game/defs";

/** How a hero joins the account. */
export type HeroSource = "start" | "play" | "gacha" | "mythic";

export interface RosterHero {
  id: string;
  /** Fallback display name (the sim's HeroDef.name wins once registered). */
  name: string;
  source: HeroSource;
  /** Rarity on the gacha card (gacha heroes) / of their constellation dupes (gameplay heroes use TUNING.gacha.gameplayHeroRarity). */
  rarity: Rarity;
  /** Stage-map / select-screen order. */
  order: number;
}

export const ROSTER: readonly RosterHero[] = [
  { id: "hoshi", name: "Hoshi", source: "start", rarity: "SR", order: 1 },
  { id: "rin", name: "Rin", source: "play", rarity: "SR", order: 2 },
  { id: "mochi", name: "Mochi", source: "play", rarity: "SR", order: 3 },
  { id: "kuro", name: "Kuro", source: "play", rarity: "SR", order: 4 },
  { id: "pudding", name: "Pudding", source: "play", rarity: "SR", order: 5 },
  { id: "aoi", name: "Aoi", source: "play", rarity: "SR", order: 6 },
  { id: "akane", name: "Akane", source: "play", rarity: "SR", order: 7 },
  { id: "senpai", name: "Senpai", source: "gacha", rarity: "SSR", order: 8 },
  { id: "magical_girl_47", name: "Magical Girl #47", source: "gacha", rarity: "SSR", order: 9 },
  { id: "isekai_kun", name: "Isekai-kun", source: "gacha", rarity: "UR", order: 10 },
  { id: "truck_kun", name: "Truck-kun", source: "mythic", rarity: "MYTHIC", order: 11 },
];

export const ROSTER_BY_ID: ReadonlyMap<string, RosterHero> = new Map(ROSTER.map((h) => [h.id, h]));

/** Heroes obtained only from the Merch Machine (or the Copium Exchange / spark). */
export function isGachaHero(id: string): boolean {
  const s = ROSTER_BY_ID.get(id)?.source;
  return s === "gacha" || s === "mythic";
}

/** Roster order for sorting (unknown heroes sort last, by id). */
export function heroOrder(id: string): number {
  return ROSTER_BY_ID.get(id)?.order ?? 1000;
}
