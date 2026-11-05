/**
 * Merch Machine banners (docs/EXPANSION.md §9), item pools and the featured
 * rotation (every TUNING.rotation.runsPerBanner runs, counted in runs, not
 * real time: "BANNER ENDS IN 2 RUNS!!").
 *
 * Pools: every registered relic at its rarity; the gacha heroes (Senpai,
 * Magical Girl #47, Isekai-kun) at their rarity once the sim registers them;
 * unlocked gameplay heroes as constellation dupes (TUNING.gacha.gameplayHeroRarity);
 * Truck-kun (MYTHIC) only on the Isekai Express banner.
 */
import { RARITIES, type Rarity } from "../../game/defs";
import { gameContent, type MetaContent } from "../content";
import type { BannerKind, Profile } from "../profile";
import { ROSTER, ROSTER_BY_ID } from "../roster";
import { TUNING } from "../tuning";

export interface GachaItem {
  kind: "hero" | "relic";
  id: string;
  name: string;
  rarity: Rarity;
}

export interface BannerDef {
  id: BannerKind;
  name: string;
  subtitle: string;
  /** What the banner features (null = nothing: the permanent banner). */
  feature: "hero" | "relic" | "mythic" | null;
  /** The deliberately-too-long fine print. */
  finePrint: readonly string[];
}

const COMMON_FINE_PRINT = [
  "Rates shown are the rates. Rates not shown are also rates.",
  "Soft pity begins at pull 74, at which point the machine starts to feel bad for you.",
  "Hard pity: pull 90 is always SSR or better. The machine is legally required to stop laughing at that point.",
  "UR pity: pull 300 without a UR or better is a UR or better. We checked with the lawyers twice.",
  "A 10-pull always contains at least one SR or better. The other nine are character building.",
  "Pity is kept per banner type and carries across rotations. Pity is the only thing that carries across anything.",
  "Every pull earns 1 Copium. Copium is not a medical product.",
  "Dupes become relic stars or hero constellations (up to 6). Past that they become Copium, the circle of life.",
  "Dream Gems have no real-world value. Neither does this banner, emotionally speaking.",
  "Money you would have spent IRL: $0. We checked.",
];

export const BANNERS: readonly BannerDef[] = [
  {
    id: "permanent",
    name: "Totally Normal Merch",
    subtitle: "Permanent Banner",
    feature: null,
    finePrint: ["This banner is permanent. Like your commitment to it.", ...COMMON_FINE_PRINT],
  },
  {
    id: "hero",
    name: "Featured Hero",
    subtitle: "50% RATE-UP!!",
    feature: "hero",
    finePrint: [
      "When an SSR-or-better drop matches the featured hero's rarity, there is a 50% chance it is the featured hero.",
      "Losing the 50/50 guarantees the featured hero on the next drop of that rarity. The trombone is free.",
      "The featured hero changes every 3 runs. BANNER ENDS SOON!! (It always ends soon. It also always comes back.)",
      "Isekai-kun is UR. On his banner, the 50/50 happens on UR drops. Yes, that's rarer. Yes, we know.",
      ...COMMON_FINE_PRINT,
    ],
  },
  {
    id: "relic",
    name: "Featured Merch",
    subtitle: "LIMITED EDITION (until the next limited edition)",
    feature: "relic",
    finePrint: [
      "When an SSR-or-better drop matches the featured relic's rarity, there is a 50% chance it is the featured relic.",
      "Losing the 50/50 guarantees the featured relic next time. The relic is not limited. The edition is.",
      "The featured relic changes every 3 runs.",
      ...COMMON_FINE_PRINT,
    ],
  },
  {
    id: "mythic",
    name: "Truck-kun's Isekai Express",
    subtitle: "MYTHIC 0.0069% (nice)",
    feature: "mythic",
    finePrint: [
      "Truck-kun can only be obtained from this banner, or from the 1,000-pull spark. Truck-kun cannot be bought. Truck-kun finds YOU.",
      "When a MYTHIC drops here there is a 50% chance it is Truck-kun. Losing that 50/50 guarantees Truck-kun on the next MYTHIC.",
      "Every N result on this banner is the Traffic Cone. It's coming.",
      "Expected number of MYTHIC drops per 1,600 Dream Gems: 0.00069. Please do not do the math.",
      "The MYTHIC spark counts pulls on every banner. After 1,000 pulls you may pick any MYTHIC. This is the only promise we keep.",
      "Side effects of this banner may include: hope, despair, hope again, and an urge to look both ways before crossing the street.",
      "By pulling you agree that you read all of this. You did not. Nobody does. That is the joke.",
      ...COMMON_FINE_PRINT,
    ],
  },
];

export const BANNER_BY_ID: ReadonlyMap<BannerKind, BannerDef> = new Map(BANNERS.map((b) => [b.id, b]));

/** The truck. */
export const TRUCK_KUN = "truck_kun";
/** The Isekai Express curse: every N result on that banner is this relic ("It's coming."). */
export const TRAFFIC_CONE = "traffic_cone";

// ---------------------------------------------------------------- pools

export type Pool = Record<Rarity, GachaItem[]>;

const emptyPool = (): Pool => ({ N: [], R: [], SR: [], SSR: [], UR: [], LR: [], MYTHIC: [] });

/** Gacha hero item for a registered roster hero (undefined if the sim doesn't have it yet). */
export function heroItem(id: string, ctx: MetaContent = gameContent()): GachaItem | undefined {
  const info = ctx.heroById.get(id);
  const r = ROSTER_BY_ID.get(id);
  if (!info || !r) return undefined;
  const rarity = r.source === "gacha" || r.source === "mythic" ? r.rarity : TUNING.gacha.gameplayHeroRarity;
  return { kind: "hero", id, name: info.name, rarity };
}

export function relicItem(id: string, ctx: MetaContent = gameContent()): GachaItem | undefined {
  const d = ctx.relics.get(id);
  return d ? { kind: "relic", id, name: d.name, rarity: d.rarity } : undefined;
}

/** Item of any id (hero first, then relic). */
export function gachaItem(id: string, ctx: MetaContent = gameContent()): GachaItem | undefined {
  return heroItem(id, ctx) ?? relicItem(id, ctx);
}

/** The item pool of a banner for this profile (ids sorted, so a seeded RNG reproduces pulls). */
export function bannerPool(p: Profile, banner: BannerKind, ctx: MetaContent = gameContent()): Pool {
  const pool = emptyPool();
  for (const id of [...ctx.relics.keys()].sort()) {
    const it = relicItem(id, ctx);
    if (it) pool[it.rarity].push(it);
  }
  for (const r of ROSTER) {
    if (r.source === "mythic" && banner !== "mythic") continue;
    if ((r.source === "start" || r.source === "play") && !p.unlocks.heroes.includes(r.id)) continue;
    const it = heroItem(r.id, ctx);
    if (it) pool[it.rarity].push(it);
  }
  for (const r of RARITIES) pool[r].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pool;
}

export function poolSize(pool: Pool): number {
  let n = 0;
  for (const r of RARITIES) n += pool[r].length;
  return n;
}

// ---------------------------------------------------------------- rotation / featured

/** Featured candidates of a banner (sorted ids). */
export function featuredCandidates(banner: BannerKind, ctx: MetaContent = gameContent()): GachaItem[] {
  const out: GachaItem[] = [];
  if (banner === "hero") {
    for (const r of ROSTER) if (r.source === "gacha") {
      const it = heroItem(r.id, ctx);
      if (it) out.push(it);
    }
  } else if (banner === "relic") {
    for (const id of [...ctx.relics.keys()].sort()) {
      const it = relicItem(id, ctx);
      if (it && (it.rarity === "SSR" || it.rarity === "UR" || it.rarity === "LR")) out.push(it);
    }
  } else if (banner === "mythic") {
    const it = heroItem(TRUCK_KUN, ctx);
    if (it) out.push(it);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Rotation order and seasonal banner names (docs/content/gacha.md §1.1-1.2).
 * Featured hero: one per cycle in this order; the banner name changes per
 * loop through the heroes (loop = floor(cycle / heroes) mod 4). Featured
 * merch: these 20 SSR / UR / LR relics in order. Candidates the content does
 * not register yet are skipped; registered candidates missing from a list
 * follow it in id order, so the rotation always covers everything.
 */
export const FEATURED_ROTATION: Readonly<Record<"hero" | "relic", readonly { id: string; names: readonly string[] }[]>> = {
  hero: [
    { id: "senpai", names: ["Senpai's Rooftop Banner", "Senpai (Summer Ver.) (Same Outfit)", "Senpai: Rerun of the Rerun", "Senpai's Anniversary Banner (Year 0)"] },
    { id: "isekai_kun", names: ["Isekai-kun's Overpowered Debut", "Isekai-kun (Did He Overdo It?) Ver.", "Isekai-kun: Back by Popular Demand", "Isekai-kun's Second Reincarnation"] },
    { id: "magical_girl_47", names: ["Magical Girl #47's Banner (We Think)", "Magical Girl #48... #47! Sorry!", "Magical Girl #47: Finally a Banner", "Magical Girl #47 (Name Pending) Ver."] },
  ],
  relic: [
    { id: "protagonist_scarf", names: ["The Scarf Never Touches the Ground"] },
    { id: "unopened_figure", names: ["MINT CONDITION EVENT"] },
    { id: "sakura_snow_globe", names: ["Spring Merch Fair (It's Always Spring)"] },
    { id: "original_manuscript", names: ["The Author's Draft (Signed, Sort Of)"] },
    { id: "transformation_brooch", names: ["Henshin Accessories Week"] },
    { id: "time_skip_clock", names: ["Two Years Later Sale"] },
    { id: "red_string_of_fate", names: ["Destiny Collection"] },
    { id: "season_finale_manga", names: ["Season Finale Merch"] },
    { id: "last_budget", names: ["Studio Clearance Sale"] },
    { id: "hot_blooded_bandana", names: ["Hot-Blooded Summer"] },
    { id: "sentai_badge", names: ["Five-Colour Fest"] },
    { id: "wind_machine", names: ["Windy Rooftop Exclusive"] },
    { id: "directors_cut", names: ["Director's Cut Edition"] },
    { id: "isekai_status_card", names: ["Another World Week"] },
    { id: "revival_theme", names: ["Comeback Concert"] },
    { id: "abandoned_headband", names: ["Rivalry Week"] },
    { id: "golden_ticket", names: ["Golden Ticket Gala (Meta)"] },
    { id: "screentone_sheet", names: ["Manga Artist Appreciation Day"] },
    { id: "sacred_plot_device", names: ["Mystery Box Event (It's the Plot)"] },
    { id: "sakuga_cel", names: ["Budget Was Found Event"] },
  ],
};

/** Featured candidates in rotation order. */
function rotationOrder(banner: BannerKind, ctx: MetaContent): GachaItem[] {
  const cands = featuredCandidates(banner, ctx);
  if (banner !== "hero" && banner !== "relic") return cands;
  const listed = FEATURED_ROTATION[banner].map((e) => e.id);
  const inList = listed.map((id) => cands.find((c) => c.id === id)).filter((c): c is GachaItem => !!c);
  const rest = cands.filter((c) => !listed.includes(c.id));
  return [...inList, ...rest];
}

/** Featured item for a rotation cycle: one per cycle in rotation order, looping. */
export function featuredAt(banner: BannerKind, cycle: number, ctx: MetaContent = gameContent()): GachaItem | undefined {
  const order = rotationOrder(banner, ctx);
  if (order.length === 0) return undefined;
  return order[((cycle % order.length) + order.length) % order.length];
}

/** The banner's display name for a cycle (seasonal names for featured banners). */
export function bannerTitleAt(banner: BannerKind, cycle: number, ctx: MetaContent = gameContent()): string {
  const def = BANNER_BY_ID.get(banner)!;
  if (banner !== "hero" && banner !== "relic") return def.name;
  const order = rotationOrder(banner, ctx);
  const item = featuredAt(banner, cycle, ctx);
  const names = item ? FEATURED_ROTATION[banner].find((e) => e.id === item.id)?.names : undefined;
  if (!item || !names?.length) return item ? `${def.name}: ${item.name}` : def.name;
  const loop = Math.floor(Math.max(0, cycle) / Math.max(1, order.length));
  return names[loop % names.length];
}

export function featuredNow(p: Profile, banner: BannerKind, ctx: MetaContent = gameContent()): GachaItem | undefined {
  return featuredAt(banner, p.rotation.cycle, ctx);
}

/** Count one run toward the banner rotation. Returns true if the featured banners changed. */
export function advanceRotation(p: Profile): boolean {
  p.rotation.runsLeft--;
  if (p.rotation.runsLeft > 0) return false;
  p.rotation.cycle++;
  p.rotation.runsLeft = TUNING.rotation.runsPerBanner;
  return true;
}

// ---------------------------------------------------------------- banner view

export type BannerBlock = "empty" | "noFeatured";

export interface BannerView {
  def: BannerDef;
  /** Display name this rotation ("Senpai's Rooftop Banner"). */
  title: string;
  featured?: GachaItem;
  /** Runs until the featured item changes (featured banners). */
  runsLeft: number;
  available: boolean;
  block?: BannerBlock;
  pity: number;
  pityUR: number;
  guaranteed: boolean;
  pulls: number;
  /** Pulls until hard pity / UR pity. */
  toHardPity: number;
  toUrPity: number;
  spark: number;
  sparkReady: boolean;
  cost1: number;
  cost10: number;
  /** How many single pulls / 10-pulls the current gems buy. */
  canPull1: boolean;
  canPull10: boolean;
}

export function bannerView(p: Profile, banner: BannerKind, ctx: MetaContent = gameContent()): BannerView {
  const def = BANNER_BY_ID.get(banner)!;
  const G = TUNING.gacha;
  const st = p.gacha.banners[banner];
  const featured = def.feature ? featuredNow(p, banner, ctx) : undefined;
  const pool = bannerPool(p, banner, ctx);
  const block: BannerBlock | undefined = poolSize(pool) === 0 ? "empty" : def.feature && !featured ? "noFeatured" : undefined;
  return {
    def,
    title: bannerTitleAt(banner, p.rotation.cycle, ctx),
    featured,
    runsLeft: p.rotation.runsLeft,
    available: !block,
    block,
    pity: st.pity,
    pityUR: st.pityUR,
    guaranteed: st.guaranteed,
    pulls: st.pulls,
    toHardPity: Math.max(1, G.hardPity - st.pity),
    toUrPity: Math.max(1, G.urPity - st.pityUR),
    spark: p.gacha.spark,
    sparkReady: p.gacha.spark >= G.spark,
    cost1: G.pullCost,
    cost10: G.tenPullCost,
    canPull1: !block && p.currencies.gems >= G.pullCost,
    canPull10: !block && p.currencies.gems >= G.tenPullCost,
  };
}

export function bannerViews(p: Profile, ctx: MetaContent = gameContent()): BannerView[] {
  return BANNERS.map((b) => bannerView(p, b.id, ctx));
}
