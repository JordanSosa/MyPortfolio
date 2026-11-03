/**
 * The Merch Machine's dice (docs/EXPANSION.md §9), allocation-free so a test
 * can roll millions of pulls: rarity from the printed rates plus SSR-or-better
 * soft / hard pity, UR-or-better pity and the 10-pull floor.
 *
 * Model: a pull first decides "SSR or better?" with chance
 *   base(SSR+)                               pulls 1..softPityStart-1
 *   base(SSR+) + softPityStep x (p - softPityStart + 1)   from softPityStart
 *   1                                        at hardPity
 * (p = pulls since the last SSR+, this one included); the tier inside SSR+
 * keeps the printed proportions. Otherwise N / R / SR by their printed
 * proportions (only SR+ when the 10-pull floor applies). UR pity forces UR+
 * (UR / LR / MYTHIC by printed proportions) on the urPity-th pull without one.
 */
import { RARITIES, type Rarity } from "../../game/defs";
import { TUNING } from "../tuning";
import type { RandomSource } from "../util";

export const R_N = 0;
export const R_R = 1;
export const R_SR = 2;
export const R_SSR = 3;
export const R_UR = 4;
export const R_LR = 5;
export const R_MYTHIC = 6;

export const rarityIndex = (r: Rarity): number => RARITIES.indexOf(r);
export const rarityAt = (i: number): Rarity => RARITIES[Math.max(0, Math.min(RARITIES.length - 1, i))];

/** Printed rates as fractions, N absorbing the remainder so they sum to exactly 1. */
export function rateTable(rates: Record<Rarity, number> = TUNING.gacha.rates): Float64Array {
  const t = new Float64Array(RARITIES.length);
  let rest = 1;
  for (let i = 1; i < RARITIES.length; i++) {
    t[i] = Math.max(0, rates[RARITIES[i]] / 100);
    rest -= t[i];
  }
  t[0] = Math.max(0, rest);
  return t;
}

/** Mutable pity counters for one banner (a BannerPity subset). */
export interface PityCounters {
  pity: number;
  pityUR: number;
}

/** Why a rarity came out (tests / fine print / "PITY!" stamp). */
export const WHY_BASE = 0;
export const WHY_SOFT = 1;
export const WHY_HARD = 2;
export const WHY_UR = 3;
export const WHY_FLOOR = 4;

export interface RollerConfig {
  rates: Float64Array;
  softPityStart: number;
  softPityStep: number;
  hardPity: number;
  urPity: number;
}

export function rollerConfig(): RollerConfig {
  const G = TUNING.gacha;
  return { rates: rateTable(G.rates), softPityStart: G.softPityStart, softPityStep: G.softPityStep, hardPity: G.hardPity, urPity: G.urPity };
}

/** Allocation-free rarity roller. `last` holds the reason of the latest roll (WHY_*). */
export class RarityRoller {
  readonly cfg: RollerConfig;
  private readonly ssrPlus: number;
  private readonly urPlus: number;
  private readonly lowSum: number;
  last = WHY_BASE;

  constructor(cfg: RollerConfig = rollerConfig()) {
    this.cfg = cfg;
    const t = cfg.rates;
    this.ssrPlus = t[R_SSR] + t[R_UR] + t[R_LR] + t[R_MYTHIC];
    this.urPlus = t[R_UR] + t[R_LR] + t[R_MYTHIC];
    this.lowSum = t[R_N] + t[R_R] + t[R_SR];
  }

  /** Base chance of SSR-or-better (printed). */
  get baseSsrPlus(): number {
    return this.ssrPlus;
  }

  /** SSR+ chance of the next pull given the pulls since the last SSR+ (`pity`, before this pull). */
  ssrChance(pity: number): number {
    const p = pity + 1;
    const c = this.cfg;
    if (p >= c.hardPity) return 1;
    if (p >= c.softPityStart) return Math.min(1, this.ssrPlus + c.softPityStep * (p - c.softPityStart + 1));
    return this.ssrPlus;
  }

  /**
   * Roll one rarity index and update the counters. `floor` = minimum rarity
   * index (the 10-pull guarantee; -1 = none).
   */
  roll(st: PityCounters, rng: RandomSource, floor = -1): number {
    const t = this.cfg.rates;
    let r: number;
    if (st.pityUR + 1 >= this.cfg.urPity) {
      r = this.pickIn(rng, R_UR, R_MYTHIC, this.urPlus);
      this.last = WHY_UR;
    } else {
      const chance = this.ssrChance(st.pity);
      if (rng.next() < chance) {
        r = this.pickIn(rng, R_SSR, R_MYTHIC, this.ssrPlus);
        this.last = chance >= 1 ? WHY_HARD : chance > this.ssrPlus ? WHY_SOFT : WHY_BASE;
      } else if (floor > R_N) {
        const lo = Math.min(floor, R_SR);
        let sum = 0;
        for (let i = lo; i <= R_SR; i++) sum += t[i];
        r = this.pickIn(rng, lo, R_SR, sum);
        this.last = WHY_FLOOR;
      } else {
        r = this.pickIn(rng, R_N, R_SR, this.lowSum);
        this.last = WHY_BASE;
      }
    }
    st.pity = r >= R_SSR ? 0 : st.pity + 1;
    st.pityUR = r >= R_UR ? 0 : st.pityUR + 1;
    return r;
  }

  /** Index in [lo, hi] proportional to the printed rates (their sum given). */
  private pickIn(rng: RandomSource, lo: number, hi: number, sum: number): number {
    const t = this.cfg.rates;
    let x = rng.next() * sum;
    for (let i = lo; i < hi; i++) {
      x -= t[i];
      if (x < 0) return i;
    }
    return hi;
  }
}

/**
 * Consolidated SSR+ rate including soft / hard pity (exact, from the pity
 * Markov chain: expected pulls per SSR+). Shown on the fine-print screen next
 * to the printed rate, as real gacha games are legally required to.
 */
export function consolidatedSsrPlus(roller: RarityRoller = new RarityRoller()): number {
  // E[pulls to SSR+] = sum over n >= 1 of P(no SSR+ in the first n-1 pulls)
  let survive = 1;
  let expected = 0;
  for (let pity = 0; pity < roller.cfg.hardPity; pity++) {
    expected += survive;
    survive *= 1 - roller.ssrChance(pity);
    if (survive <= 0) break;
  }
  return 1 / expected;
}
