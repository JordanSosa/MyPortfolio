/**
 * Merch Machine copy (docs/content/gacha.md, implemented literally): the fine
 * print blocks (§4), dupe / star-up lines (§5.2), the MYTHIC break (§2), the
 * pity / banner UI lines (§1.1, §7), the Copium Exchange card copy (§6) and the
 * hero constellation star subtitles (heroes.md §4). Lines shared with other
 * screens (LOST / WON the 50/50, summon captions, rarity subtitles) live in
 * ../copy-data.ts.
 */
import type { Rarity } from "../../../game/defs";
import type { BannerKind } from "../../../meta/profile";
import { fmtInt } from "../../dom";
import { SUMMON_CAPTIONS } from "../copy-data";

/** Banner tab labels (icon tabs: short). */
export const TAB_SHORT: Readonly<Record<BannerKind | "exchange" | "history", string>> = {
  permanent: "NORMAL",
  hero: "HERO",
  relic: "MERCH",
  mythic: "ISEKAI",
  exchange: "COPIUM",
  history: "HISTORY",
};

/** The fine print (§4): banner blocks first, then the common block on every banner. */
export const FINE_PRINT: Readonly<Record<BannerKind, { title: string; lines: readonly string[] }>> = {
  permanent: {
    title: "Permanent banner",
    lines: ["This banner is permanent. Like your commitment to it.", "“Totally Normal” refers to the merch, not to the odds, the machine, or you."],
  },
  hero: {
    title: "Featured Hero",
    lines: [
      "When an SSR-or-better drop matches the featured hero's rarity, there is a 50% chance it is the featured hero.",
      "Losing the 50/50 guarantees the featured hero on the next drop of that rarity. The trombone is free.",
      "The featured hero changes every 3 runs. BANNER ENDS SOON!! (It always ends soon. It also always comes back.)",
      "Isekai-kun is UR. On his banner, the 50/50 happens on UR drops. Yes, that's rarer. Yes, we know.",
    ],
  },
  relic: {
    title: "Featured Merch",
    lines: [
      "When an SSR-or-better drop matches the featured relic's rarity, there is a 50% chance it is the featured relic.",
      "Losing the 50/50 guarantees it next time. The relic is not limited. The edition is.",
    ],
  },
  mythic: {
    title: "Isekai Express",
    lines: [
      "Truck-kun can only be obtained here, or from the 1,000-pull spark. Truck-kun cannot be bought. Truck-kun finds YOU.",
      "When a MYTHIC drops here there is a 50% chance it is Truck-kun. Losing that 50/50 guarantees Truck-kun on the next MYTHIC.",
      "Every N result on this banner is a Traffic Cone. This is not a bug. This is foreshadowing.",
      "Expected MYTHIC drops per 1,600 Dream Gems: 0.00069. Please do not do the math.",
      "Side effects of this banner may include hope, despair, hope again, and an urge to look both ways before crossing the street.",
    ],
  },
};

export const FINE_PRINT_COMMON: readonly string[] = [
  "Rates: N 52% · R 30% · SR 13.5% · SSR 3.6% · UR 0.75% · LR 0.14% · MYTHIC 0.0069% (nice). They add up to 99.9969%. The missing 0.0031% is N. It's always N.",
  "Rates shown are the rates. Rates not shown are also rates.",
  "Soft pity begins at pull 74, at which point the machine starts to feel bad for you.",
  "Hard pity: pull 90 is always SSR or better. The machine is legally required to stop laughing at that point.",
  "UR pity: pull 300 without a UR or better is a UR or better. We checked with the lawyers twice. They are also plushies.",
  "A 10-pull always contains at least one SR or better. The other nine are character building.",
  "Pity is kept per banner type and carries across rotations. Pity is the only thing that carries across anything.",
  "The MYTHIC spark counts pulls on every banner. After 1,000 pulls you may pick any MYTHIC. This is the only promise we keep.",
  "Every pull earns 1 Copium. Copium is not a medical product. Do not inhale Copium. (You will inhale Copium.)",
  "Dupes become relic stars or hero constellations, up to ★6 / C6. Past that they become Copium. The circle of life.",
  "Gameplay heroes appear in the pool as SR only after you unlock them. You cannot pull a hero you haven't met. That would be weird.",
  "Dream Gems have no real-world value. Neither does this banner, emotionally speaking.",
  "Money you would have spent in real life: $0. We checked. Twice. We were very surprised.",
  "The meteor colour shows the best rarity of the pull. Sometimes a blue meteor becomes gold. This is called “hope” and it is a mechanic.",
  "Skipping the animation does not change the result. Watching it does not change the result either. Nothing changes the result.",
  "The “I have regrets” button does not refund regrets.",
  "Tapping the machine does not improve the odds. We counted. You tapped it 4,000 times.",
  "The narrator's screaming during a MYTHIC pull is not a malfunction. The narrator is fine. The narrator is not fine.",
  "No plushies were harmed in the making of this banner. Several were sold.",
  "By pulling you agree that you read all of this. You did not. Nobody does. That is the joke.",
  "If you have read this far: hello. Here is a secret. There is no secret. (Scrolling to the very bottom does unlock the hidden achievement “Read The Fine Print”.)",
];

/** Narrator captions under the summon (§5.3), with the bible's hard line wraps undone. */
export const CAPTIONS: readonly string[] = SUMMON_CAPTIONS.map((s) => s.replace(/\s+/g, " ").trim());

// ---------------------------------------------------------------- pull confirm (§2 beat 0)
export const confirmLine = (cost: number): string => `Spend ${fmtInt(cost)} ♦? (That's ${fmtInt(cost)} ♦.)`;
export const CONFIRM_OK = "PULL!";
export const CONFIRM_NO = "I have regrets";

// ---------------------------------------------------------------- banner / pity UI (§1.1, §7)
export const fomoLine = (runsLeft: number): string => (runsLeft <= 1 ? "" : `BANNER ENDS IN ${runsLeft} RUNS!!`);
export const lastRunLine = (comesBack: number): string => `LAST RUN!!! (it comes back in ${comesBack} runs)`;
export const FOMO_TIP = "Banners rotate every 3 runs. Not real time. We would never pressure you with real time.";
export const ISEKAI_WARNING = "ISEKAI-KUN IS UR. UR PITY IS 300. WE'RE SORRY. (WE'RE NOT.)";
export const CONE_CAPTION = "It's coming.";
export const PITY_TIP = "The machine starts feeling bad for you at 74.";
export const SOFT_PITY = "SOFT PITY ACTIVE — the machine feels bad for you";
export const HARD_NEXT = "NEXT PULL: SSR OR BETTER. (The machine has no choice.)";
export const urLine = (n: number, max: number): string => `UR pity ${fmtInt(n)} / ${fmtInt(max)} (patience is a rarity too)`;
export const guaranteeLine = (r: Rarity): string => `GUARANTEED featured on the next ${r}!`;
export const sparkLine = (n: number, max: number): string => `Spark ${fmtInt(n)} / ${fmtInt(max)} — at ${fmtInt(max)} you pick any MYTHIC.`;
export const SPARK_READY = "SPARK READY! Choose your destiny.";
export const poorLine = (need: number, have: number): string => `Need ${fmtInt(need)} ♦ (you have ${fmtInt(have)} ♦). Play an episode? It pays!`;
export const WELCOME_GIFT = "WELCOME TO SEASON 2! Here's a free 10-pull. (It's 1,600 ♦. We're not made of gems.)";
/** Tapping the machine (fine print 17). */
export const MACHINE_TAPS: readonly string[] = ["+0% ODDS", "+0.000% ODDS", "STILL +0%", "*crank noises*", "NOT A SLOT MACHINE"];

// ---------------------------------------------------------------- the pull (§2)
export const FAKEOUT = "...wait.";
export const SKIP = "Skip? …fine.";
export const CANT_SKIP = "You can't skip destiny.";
export const NARRATOR_SCREAM = "NARRATOR: AAAAAAAAAAAAAAAAAAAAAAA";
export const MYTHIC_ERROR = {
  title: "⚠ KAWAII_OVERFLOW 0xDEADBEEF",
  lines: ["The Merch Machine has stopped responding.", "Cause: too much luck."],
  wait: "Wait",
  close: "Close the program",
};
export const consolation = (n: number): string => `+${fmtInt(n)} Copium (consolation)`;

// ---------------------------------------------------------------- dupes (§5.2)
export const relicStarUp = (name: string, stars: number): { t: string; s: string } => ({ t: `★ UP! ${name} is now ★${stars}!`, s: "The same merch, but more." });
export const relicMax = (name: string): { t: string; s: string } => ({ t: `MAX ★! ${name} is fully upgraded.`, s: "Further copies become Copium. We're sorry. We're not." });
export const relicOverflow = (name: string, copium: number): { t: string; s: string } => ({ t: `${name} ★MAX → +${fmtInt(copium)} Copium`, s: "Inhale deeply." });
export const heroOverflow = (name: string, copium: number): { t: string; s: string } => ({ t: `${name} C6 → +${fmtInt(copium)} Copium`, s: "They're flattered. Truly." });
export const HERO_FINAL = { t: "FULLY AWAKENED (FINAL FORM)", s: "Until next season's final form." };
export const newHero = (name: string): string => `NEW HERO! ${name} has joined the cast!`;
/** A first relic went straight into a free relic slot (meta autoEquipNewRelics). */
export const EQUIPPED_CHIP = "EQUIPPED!";
export const equippedLine = (name: string): { t: string; s: string } => ({ t: `EQUIPPED! ${name} is in your relic slot.`, s: "(It's load-bearing merch.)" });
export const consteLine = (c: number, starName: string): string => `C${c} UNLOCKED — ${starName}`;
/** heroes.md §4: the subtitle on each star-up card. */
export const CONSTE_SUB: readonly string[] = [
  "Same character, new hair colour. That'll be one dupe, please.",
  "Back by popular demand (the demand was the algorithm).",
  "Sun hat. SPF 50. Otherwise the exact same outfit.",
  "The collab partner has asked us to stop.",
  "Now available as a plushie. The plushie is stronger.",
  "Fully awakened. Until next season's final form.",
];
export const CONE_DUPE = "Another cone. The truck is close.";
/** Cones pulled on the Isekai Express before the cone dupes get ominous. */
export const CONE_OMEN = 30;

// ---------------------------------------------------------------- Copium Exchange (§6)
export const COPIUM_HEADER = (n: number): string => `Copium: ${fmtInt(n)} (do not inhale)`;
export const OFFER_COPY = {
  voucher: { name: "Pull Voucher", line: "One pull's worth of gems. Exchanged at a rate we call 'generous'." },
  insurance: { name: "Pity Insurance", line: "Skip ten pulls of suffering. Suffering not included." },
  relic: {
    N: "Every legend starts with a bent spoon.",
    R: "Slightly rarer cope.",
    SR: "Purple, on purpose.",
    SSR: "Gold, without the gacha. Feels illegal.",
    UR: "The rainbow, purchased. The rainbow is disappointed in you.",
    LR: "Legendary, by appointment.",
  } as Partial<Record<Rarity, string>>,
  heroSR: "A constellation for your favourite. They noticed.",
  hero: {
    senpai: "He still won't notice you. But he's yours.",
    magical_girl_47: "Her name is... on the receipt.",
    isekai_kun: "He's so overpowered he was in the shop by accident.",
  } as Record<string, string>,
  mythic: "MYTHICs cannot be bought. They can only be endured (1,000-pull spark).",
};
export const GEMX = {
  title: "Gem Exchange",
  line: "Terrible rate! Truly awful! Do it anyway?",
  ok: "Yes",
  no: "I value my coins",
};

// ---------------------------------------------------------------- stats (§7)
export const IRL = "Money you would have spent IRL: $0 (we checked)";
export const LOYAL_N = "Your most loyal N";
