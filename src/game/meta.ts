/**
 * Dream Shop meta progression (DESIGN §3.8). Pure data + stat modifiers; the
 * save file (src/ui/save.ts) stores the purchased ranks as { [id]: rank }.
 */
import type { Stats } from "./stats";

export interface MetaDef {
  id: string;
  name: string;
  icon: string;
  maxRank: number;
  baseCost: number;
  /** Description of one rank. */
  desc: string;
  apply(s: Stats, rank: number): void;
}

export type MetaRanks = Record<string, number>;

export const META: MetaDef[] = [
  { id: "might", name: "Might", icon: "icon_power_bow", maxRank: 5, baseCost: 60, desc: "+5% damage per rank", apply: (s, r) => void (s.might += 0.05 * r) },
  { id: "vitality", name: "Vitality", icon: "icon_heart", maxRank: 5, baseCost: 50, desc: "+10 max HP per rank", apply: (s, r) => void (s.maxHp += 10 * r) },
  { id: "swiftness", name: "Swiftness", icon: "icon_swift_shoes", maxRank: 5, baseCost: 50, desc: "+4% move speed per rank", apply: (s, r) => void (s.moveSpeed += 0.04 * r) },
  { id: "magnetism", name: "Magnetism", icon: "icon_magnet_star", maxRank: 5, baseCost: 40, desc: "+10% pickup range per rank", apply: (s, r) => void (s.pickup += 0.1 * r) },
  { id: "greed", name: "Greed", icon: "icon_gold_up", maxRank: 5, baseCost: 70, desc: "+10% coins per rank", apply: (s, r) => void (s.greed += 0.1 * r) },
  {
    id: "luck",
    name: "Luck",
    icon: "icon_lucky_clover",
    maxRank: 5,
    baseCost: 80,
    desc: "+5% luck per rank. Rank 3: a 4th level-up card!",
    apply: (s, r) => {
      s.luck += 0.05 * r;
      if (r >= 3) s.cards += 1;
    },
  },
  { id: "reroll", name: "Reroll", icon: "icon_reroll", maxRank: 3, baseCost: 100, desc: "+1 reroll per run", apply: (s, r) => void (s.rerolls += r) },
  { id: "revive", name: "Revive", icon: "icon_hp_up", maxRank: 1, baseCost: 400, desc: "Revive once at 50% HP with a screen-clearing burst", apply: (s, r) => void (s.revives += r) },
];

export const META_BY_ID: ReadonlyMap<string, MetaDef> = new Map(META.map((m) => [m.id, m]));

/** Cost of buying the next rank (rank = current rank). Grows ~1.6x per rank. */
export function metaCost(def: MetaDef, rank: number): number {
  return Math.round((def.baseCost * Math.pow(1.6, rank)) / 5) * 5;
}

export function applyMeta(s: Stats, ranks: MetaRanks): void {
  for (const m of META) {
    const r = Math.min(m.maxRank, Math.max(0, Math.floor(ranks[m.id] ?? 0)));
    if (r > 0) m.apply(s, r);
  }
}
