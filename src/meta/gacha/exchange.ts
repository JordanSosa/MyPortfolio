/**
 * Copium Exchange (docs/EXPANSION.md §9): spend Copium on a chosen relic or
 * hero, a Pull Voucher (one pull's worth of gems) or Pity Insurance (+10 pity
 * on a banner, never past hard pity - 1). MYTHICs are not for sale (Truck-kun
 * finds YOU). Also the joke Gem Exchange (coins -> gems at a terrible rate).
 */
import { gameContent, type MetaContent } from "../content";
import { gemExchangeQuote } from "../economy";
import { BANNER_KINDS, type BannerKind, type Profile } from "../profile";
import { ROSTER } from "../roster";
import { TUNING } from "../tuning";
import { BANNER_BY_ID, heroItem, relicItem, type GachaItem } from "./banners";
import { grantItem, type PullResult } from "./engine";

export type OfferKind = "relic" | "hero" | "voucher" | "insurance";
export type OfferBlock = "copium" | "maxed" | "notForSale" | "locked" | "pity";

export interface ExchangeOffer {
  /** "relic:<id>", "hero:<id>", "voucher", "insurance:<banner>". */
  id: string;
  kind: OfferKind;
  name: string;
  desc: string;
  price: number;
  item?: GachaItem;
  banner?: BannerKind;
  /** Why it can't be bought now (undefined = buyable). */
  block?: OfferBlock;
}

const isMaxedRelic = (p: Profile, id: string) => (p.relics[id] ?? -1) >= TUNING.relics.maxStars;
const isMaxedHero = (p: Profile, id: string) => p.unlocks.heroes.includes(id) && (p.heroes[id]?.constellation ?? 0) >= TUNING.constellation.max;

/** The whole catalogue for this profile, in shop order (vouchers, insurance, heroes, relics by rarity). */
export function exchangeCatalogue(p: Profile, ctx: MetaContent = gameContent()): ExchangeOffer[] {
  const X = TUNING.exchange;
  const G = TUNING.gacha;
  const copium = p.currencies.copium;
  const out: ExchangeOffer[] = [];
  const priced = (o: Omit<ExchangeOffer, "block">, extra?: OfferBlock): ExchangeOffer => ({ ...o, block: extra ?? (copium < o.price ? "copium" : undefined) });
  out.push(priced({ id: "voucher", kind: "voucher", name: "Pull Voucher", desc: `+${X.pullVoucherGems} Dream Gems. Exactly one pull. Use it wisely (you won't).`, price: X.pullVoucher }));
  for (const b of BANNER_KINDS) {
    const st = p.gacha.banners[b];
    const full = st.pity >= G.hardPity - 1;
    out.push(priced({ id: `insurance:${b}`, kind: "insurance", banner: b, name: `Pity Insurance: ${BANNER_BY_ID.get(b)?.name ?? b}`, desc: `+${X.pityInsuranceAmount} pity on this banner. Legally distinct from buying luck.`, price: X.pityInsurance }, full ? "pity" : undefined));
  }
  for (const r of ROSTER) {
    const it = heroItem(r.id, ctx);
    if (!it) continue;
    if (r.source === "mythic") {
      out.push({ id: `hero:${r.id}`, kind: "hero", item: it, name: it.name, desc: "Not for sale. Truck-kun finds YOU.", price: 0, block: "notForSale" });
      continue;
    }
    // gameplay heroes are earned by playing; their copies (constellations) can be bought once unlocked
    if ((r.source === "start" || r.source === "play") && !p.unlocks.heroes.includes(r.id)) {
      out.push({ id: `hero:${r.id}`, kind: "hero", item: it, name: it.name, desc: "Unlock this hero by playing first.", price: X.hero[it.rarity] ?? 0, block: "locked" });
      continue;
    }
    const price = X.hero[it.rarity];
    if (price === undefined) continue;
    const owned = p.unlocks.heroes.includes(r.id);
    out.push(priced({ id: `hero:${r.id}`, kind: "hero", item: it, name: it.name, desc: owned ? "+1 constellation." : "Unlock this hero.", price }, isMaxedHero(p, r.id) ? "maxed" : undefined));
  }
  const relics = [...ctx.relics.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const d of relics) {
    const it = relicItem(d.id, ctx)!;
    const price = X.relic[d.rarity];
    if (price === undefined) {
      out.push({ id: `relic:${d.id}`, kind: "relic", item: it, name: d.name, desc: "MYTHIC merch is not for sale. Nothing is for sale. Except everything else.", price: 0, block: "notForSale" });
      continue;
    }
    const owned = d.id in p.relics;
    out.push(priced({ id: `relic:${d.id}`, kind: "relic", item: it, name: d.name, desc: owned ? "+1 star." : "Add it to your collection.", price }, isMaxedRelic(p, d.id) ? "maxed" : undefined));
  }
  return out;
}

export interface ExchangeResult {
  ok: boolean;
  block?: OfferBlock | "unknown";
  offer?: ExchangeOffer;
  /** Item grants: what the copy became. */
  result?: PullResult;
  gems?: number;
  pity?: number;
}

/** Buy one offer by id. */
export function buyOffer(p: Profile, offerId: string, ctx: MetaContent = gameContent()): ExchangeResult {
  const offer = exchangeCatalogue(p, ctx).find((o) => o.id === offerId);
  if (!offer) return { ok: false, block: "unknown" };
  if (offer.block) return { ok: false, block: offer.block, offer };
  const X = TUNING.exchange;
  p.currencies.copium -= offer.price;
  p.gacha.stats.exchangeBuys++;
  if (offer.kind === "voucher") {
    p.currencies.gems += X.pullVoucherGems;
    return { ok: true, offer, gems: X.pullVoucherGems };
  }
  if (offer.kind === "insurance" && offer.banner) {
    const st = p.gacha.banners[offer.banner];
    st.pity = Math.min(TUNING.gacha.hardPity - 1, st.pity + X.pityInsuranceAmount);
    p.gacha.stats.pityInsurance++;
    return { ok: true, offer, pity: st.pity };
  }
  const item = offer.item!;
  const g = grantItem(p, item);
  const result: PullResult = { item, rarity: item.rarity, result: g.result, level: g.level, copium: g.copium, featured: false, lost5050: false, won5050: false, pity: "", pityCount: 0, codexGems: g.codexGems };
  return { ok: true, offer, result };
}

/** Joke Gem Exchange: convert whole batches of coins into gems at a terrible rate. */
export function exchangeCoinsForGems(p: Profile, batches = 1): { ok: boolean; coins: number; gems: number } {
  const E = TUNING.gemExchange;
  const want = Math.max(0, Math.floor(batches));
  const q = gemExchangeQuote(Math.min(p.currencies.coins, want * E.coins));
  if (q.batches <= 0) return { ok: false, coins: 0, gems: 0 };
  p.currencies.coins -= q.coins;
  p.currencies.gems += q.gems;
  p.lifetime.gemsEarned += q.gems;
  p.gacha.stats.gemExchanges++;
  return { ok: true, coins: q.coins, gems: q.gems };
}
