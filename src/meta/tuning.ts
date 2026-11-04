/**
 * EVERY tunable number of the account layer lives here (docs/EXPANSION.md §2-§11,
 * docs/META.md). The economy pass (`npm run progression`, §13) edits only this
 * file: payouts, XP / mastery curves, board costs, gacha rates and pity, Copium
 * prices, codex bounties, migration gifts.
 *
 * Conventions: "per" values are per rank / per unit; multipliers are applied as
 * `x (1 + value)`; costs are in Star Coins unless stated (♦ = Dream Gems,
 * Copium = pills).
 */
import type { Rarity } from "../game/defs";

export const TUNING = {
  /** End-of-run payout (§4 "Episode Results"). */
  payout: {
    /** Time bonus: coins per minute survived (before multipliers); the first earlySeconds pay x (1 + earlyBoost). */
    coinsPerMinute: 9,
    earlySeconds: 120,
    earlyBoost: 1,
    /** Kill bonus: coins per kill. */
    coinsPerKill: 0.0002,
    /** Extra coins per elite kill. */
    coinsPerElite: 0.2,
    /** Coins per boss kill: `bossCoins[i]` for the i-th boss of the stage (last = final boss); extra bosses use the last. */
    bossCoins: [5, 10, 18, 28],
    /** Flat bonus for clearing the stage. */
    clearCoins: 20,
    /** Endless ("Filler Arc") coins per minute after the final boss (stacks with the time bonus). */
    endlessCoinsPerMinute: 4,
    /** Results grade -> coin multiplier. */
    gradeMul: { D: 1, C: 1.05, B: 1.1, A: 1.15, S: 1.25, SS: 1.35 } as Record<string, number>,
    /** Plot Twist heat: coins x (1 + heat x this). */
    heatCoinPer: 0.08,
    /** Plot Twist heat: run gems x (1 + heat x this). */
    heatGemPer: 0.06,
    /** Curse ("more enemies, more rewards"): coins and run gems x (1 + curse x this). */
    curseRewardPer: 0.5,
    /** Gems every run ("small per-run trickle"). */
    gemsPerRun: 4,
    /** Gems per minute survived. */
    gemsPerMinute: 1.5,
    /** Endless gems per minute after the final boss. */
    endlessGemsPerMinute: 3,
    /** First clear of a stage, by stage order (1-based; extra stages use the last). */
    firstClearGems: [240, 320, 400, 480, 800],
    /** First kill of a boss: mid bosses / final bosses. */
    bossFirstKillGems: 30,
    finalBossFirstKillGems: 60,
    /** Run gems x stage rewardMul ^ this (coins get the whole "Ratings" multiplier). */
    gemStageExp: 0.5,
    /** Heat badges per stage (§10): first clear at heat >= badge pays the gems. */
    heatBadges: [4, 8, 16, 32],
    heatBadgeGems: [200, 400, 800, 1600],
  },

  /** Results grade thresholds (death score = minutes + kills / scoreKills + level / scoreLevel + maxCombo / scoreCombo, see economy.ts). */
  grade: {
    scoreKills: 2000,
    scoreLevel: 20,
    scoreCombo: 500,
    /** Score thresholds for C / B / A on a death. */
    deathC: 2.5,
    deathB: 5,
    deathA: 9,
    /** A clear is at least A; S when damage taken stays under this; SS also needs an SSS combo rank and this little damage. */
    clearS: 150,
    clearSS: 50,
  },

  /** Hero levels (§6): automatic from hero XP, every level gives a talent point and +1% damage / HP. */
  hero: {
    maxLevel: 30,
    /** XP for level L -> L+1 = round(base x L^exp x growth^(L-1)): gentle early levels, a long climb to 30. */
    xpBase: 120,
    xpExp: 1.3,
    xpGrowth: 1.06,
    /** Hero XP per second survived / per kill / per boss / per clear. */
    xpPerSecond: 1,
    xpPerKill: 0.004,
    xpPerBoss: 40,
    xpPerClear: 150,
    /** Hero XP x stage rewardMul ^ this. */
    xpStageExp: 0.3,
    /** "Recap Episode" catch-up: a hero more than catchUpGap levels below the account's best hero earns x (1 + catchUp) XP. */
    catchUp: 2,
    catchUpGap: 2,
    /** Per level above 1: +1% damage, +1% max HP. */
    mightPerLevel: 0.01,
    hpPerLevel: 0.01,
    /** Talent points: one per level (level 1 included). */
    pointsPerLevel: 1,
    /** Coins per missing XP when buying a level ("optional accelerator"). */
    levelUpCoinsPerXp: 0.6,
    /** (Talent tier gating uses the sim contract's TALENT_TIER_POINTS, src/game/defs.ts.) */
    /** Talent respec cost = base + perPoint x points spent. */
    respecBase: 50,
    respecPerPoint: 15,
  },

  /** Weapon mastery (§7): ranks 0-10 from damage dealt with the weapon (and its evolution). */
  mastery: {
    maxRank: 10,
    /** Mastery XP per point of damage. */
    xpPerDamage: 0.001,
    /** Cumulative mastery XP to reach rank 1..10. */
    thresholds: [500, 2500, 12000, 35000, 80000, 160000, 320000, 900000, 3000000, 10000000],
    /** +3% damage with that weapon per rank. */
    mightPerRank: 0.03,
    /** Rank -> extra max weapon levels (rank 5 Limit Break: max Lv 6; rank 10: max Lv 7). */
    levelBonus: [
      [5, 1],
      [10, 2],
    ] as [number, number][],
  },

  /** Hero constellations C0-C6 from gacha dupes (generic table in heroes.ts). */
  constellation: { max: 6 },

  /** Training Arc board (§5). */
  board: {
    /** Base cost of rank 1 of a plain node per ring 1..5. */
    ringCost: [15, 220, 1500, 7000, 22000],
    /** Each further rank costs x this. */
    rankGrowth: 1.55,
    /** Within a ring, nodes farther along a sector path cost up to +this (fraction). */
    pathGrowth: 0.45,
    /** Node cost multipliers by kind. */
    kindMul: { stat: 1, utility: 1.8, keystone: 4 } as Record<string, number>,
    /** Full respec fee = min(cap, base + rate x coins spent), never more than the refund. */
    respecBase: 50,
    respecRate: 0.04,
    respecCap: 6000,
    /** Single-node refunds return this share of what that rank cost. */
    nodeRefundRate: 1,
    /** Keystones that can be active at once ("only two Arcs can air per season"). */
    keystoneSlots: 2,
  },

  /** Relic loadout (§8). */
  relics: { baseSlots: 1, maxSlots: 4, maxStars: 6 },

  /** Banner rotation (§9): featured banners change every N runs. */
  rotation: { runsPerBanner: 3 },

  /** The Merch Machine (§9). */
  gacha: {
    pullCost: 160,
    tenPullCost: 1600,
    /** Printed base rates in percent (they sum to 99.9969: N absorbs the remaining 0.0031 at roll time). */
    rates: { N: 52, R: 30, SR: 13.5, SSR: 3.6, UR: 0.75, LR: 0.14, MYTHIC: 0.0069 } as Record<Rarity, number>,
    /** SSR-or-better pity: from pull `softPityStart` the SSR+ chance rises by `softPityStep` per pull; pull `hardPity` is guaranteed. */
    softPityStart: 74,
    softPityStep: 0.06,
    hardPity: 90,
    /** UR-or-better pity. */
    urPity: 300,
    /** Pulls (any banner) for a MYTHIC spark: pick any MYTHIC. */
    spark: 1000,
    /** A 10-pull always holds at least one of this rarity or better. */
    tenPullFloor: "SR" as Rarity,
    /** Featured banners: chance an SSR+ drop at the featured rarity is the featured item (guaranteed after a loss). */
    featuredChance: 0.5,
    /** Copium per pull ("consolation"). */
    copiumPerPull: 1,
    /** Copium for a dupe past the cap (★6 relic / C6 hero), by rarity. */
    overflowCopium: { N: 2, R: 5, SR: 15, SSR: 60, UR: 200, LR: 500, MYTHIC: 1500 } as Record<Rarity, number>,
    historySize: 100,
    /** Gameplay heroes appear in the pools (once unlocked) at this rarity, as constellation dupes. */
    gameplayHeroRarity: "SR" as Rarity,
  },

  /** Copium Exchange (§9) prices in Copium. */
  exchange: {
    relic: { N: 30, R: 70, SR: 180, SSR: 600, UR: 1600, LR: 3600 } as Partial<Record<Rarity, number>>,
    hero: { SR: 400, SSR: 1400, UR: 3800 } as Partial<Record<Rarity, number>>,
    /** "Pull Voucher": one pull's worth of gems. */
    pullVoucher: 120,
    pullVoucherGems: 160,
    /** "Pity Insurance": +10 pity on a banner (never past hard pity - 1). */
    pityInsurance: 150,
    pityInsuranceAmount: 10,
  },

  /** Joke "Gem Exchange": coins -> gems at a terrible rate. */
  gemExchange: { coins: 1000, gems: 10 },

  /** Codex (§11): gems for discovering an entry. */
  codex: { hero: 10, weapon: 5, passive: 3, enemy: 3, boss: 12, relic: 2, stage: 15 } as Record<string, number>,

  /** Save migration (§14). */
  migration: {
    /** "Welcome to Season 2" gift for v1 players: one 10-pull. */
    welcomeGems: 1600,
    /** Old Dream Shop costs (frozen v1 formula: round(base x 1.6^rank / 5) x 5). */
    oldShopGrowth: 1.6,
  },
};

export type Tuning = typeof TUNING;
