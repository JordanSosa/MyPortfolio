/**
 * src/meta: the PURE account layer (docs/EXPANSION.md §2-§14, docs/META.md).
 * No DOM, no localStorage, no audio. The UI persists the Profile through
 * src/ui/save.ts and calls these functions; the sim gets a RunConfig.
 *
 *   profile.ts      Profile type, defaults, sanitiser          reconcile.ts  content-aware repair
 *   economy.ts      grade, payout, XP / mastery curves         tuning.ts     every tunable number
 *   board/          Training Arc graph + rules + effects       heroes.ts     levels, talents, constellations
 *   gacha/          banners, pity, pulls, spark, exchange      achievements/ Plot Points
 *   unlocks.ts      unlock rules + codex hints                 codex.ts      discoveries + bounties
 *   loadout.ts      loadout -> RunConfig                       rewards.ts    applyRunToProfile -> RunReport
 *   legacy.ts       save v1 + migration                        transfer.ts   export / import string
 */
export * from "./util";
export * from "./tuning";
export * from "./content";
export * from "./roster";
export * from "./profile";
export * from "./legacy";
export * from "./transfer";
export * from "./economy";
export * from "./heroes";
export * from "./codex";
export * from "./unlocks";
export * from "./loadout";
export * from "./reconcile";
export * from "./rewards";
export * from "./board/index";
export * from "./gacha/index";
export * from "./achievements/index";
