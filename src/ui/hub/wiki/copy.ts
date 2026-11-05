/**
 * Kira Kira Wiki parody copy (docs/content/satire.md §8 codex lines, §10 blurbs
 * live in ../copy-data.ts): maintenance-template notices, "[citation needed]"
 * markers, the [edit] rejections, "last edited by" bylines, talk-page
 * excerpts, categories and the search page's "does not exist" joke. The joke
 * is always on the wiki format (edit wars, stubs, unsourced claims), never on
 * people. Pure data + tiny pickers.
 */
import type { CodexTab } from "../../../meta/profile";

export type WikiTab = CodexTab | "plot";

export const WIKI_TITLE = "KIRA KIRA WIKI";
export const WIKI_TAGLINE = "The Free Fan Encyclopedia Anyone Can't Edit";
export const WIKI_FROM = "From Kira Kira Wiki, the free fan encyclopedia";
export const STUB = "This article is a stub. You can help by finding it.";

/** Short tab labels (the strip) and the article title each list page wears. */
export const TAB_INFO: Readonly<Record<WikiTab, { label: string; title: string; cats: string }>> = {
  plot: { label: "PLOT POINTS", title: "List of Plot Points (achievements, but anime)", cats: "Achievements · Lists of things you did · Articles with too many trophies" },
  heroes: { label: "HEROES", title: "List of Kira Kira Overdrive characters", cats: "Characters · Original characters (do not steal) · Protagonists (all of them)" },
  weapons: { label: "WEAPONS", title: "List of weapons (and what they turn into)", cats: "Weapons · Things that go pew · Merchandise opportunities" },
  passives: { label: "PASSIVES", title: "List of passive items (accessories)", cats: "Passives · Accessories · Stats you forget you have" },
  enemies: { label: "ENEMIES", title: "Bestiary of plushies and other menaces", cats: "Plushies · Things that go boing · Articles with unsourced claims" },
  bosses: { label: "BOSSES", title: "List of bosses (they'll be back in the movie)", cats: "Bosses · Villains with redemption arcs pending · Name cards" },
  relics: { label: "MERCH", title: "List of official merchandise (allegedly)", cats: "Merch · Gacha results · Things you did not need" },
  stages: { label: "STAGES", title: "List of episodes", cats: "Episodes · Settings · Places the plushies live" },
};

/** Maintenance-template notices (the amber box), one picked per visit of a list page. */
export const NOTICES: Readonly<Record<WikiTab, readonly string[]>> = {
  plot: [
    "This article has multiple issues: it is 40% achievements and 60% anime.",
    "This list is incomplete. You can help by playing more episodes.",
  ],
  heroes: [
    "This list contains OC bios. DO NOT STEAL!! DO NOT REPOST!!",
    "This article is about the cast. For the cast's opinions about you, see Talk:Heroes.",
  ],
  weapons: [
    "This article needs additional citations. Unsourced damage numbers may be challenged and removed (by enemies).",
    "This article is the subject of an edit war about whether yarn counts as a weapon.",
  ],
  passives: [
    "This article is an accessory. You can help by equipping it.",
    "The neutrality of this list is disputed. Plot Armor wrote most of it.",
  ],
  enemies: [
    "This article may contain plushies. Reader discretion is advised.",
    "No plushie was harmed in the making of this list. They pop into confetti. That's different.",
  ],
  bosses: [
    "Spoiler warning: plot and/or ending details follow. (They are all defeatable.)",
    "This page is protected due to repeated vandalism by King Puff.",
  ],
  relics: [
    "This article reads like an advertisement. Please help rewrite it from a neutral point of view. (The Merch Machine declined.)",
    "Prices on this page are \"definitely not premium currency\".",
  ],
  stages: [
    "This article is about the episodes. For the filler, see Filler Arc.",
    "This list may contain a beach episode. It is crabs.",
  ],
};

/** Inline maintenance markers, sprinkled after trivia lines. */
export const CITES = ["[citation needed]", "[dubious – discuss]", "[according to whom?]", "[clarification needed]", "[original research?]", "[who?]", "[when?]"] as const;

/** The [edit] link's rejection toasts. */
export const EDIT_DENIED: readonly string[] = [
  "Editing has been disabled. This is the Wiki Anyone Can't Edit.",
  "Your edit was reverted by King Puff 0.3 seconds later.",
  "Edit rejected: please cite a source other than \"trust me\".",
  "This page is locked until next season.",
  "Edit failed: you need 1,000 Copium to edit this page.",
  "Akane reverted your edit. It's not like she cares.",
  "Your edit summary \"fixed typo\" has been flagged as suspicious.",
  "Kuro has protected this page with a Forbidden Seal.",
  "Edit queued for review. Estimated wait: one season.",
  "Senpai did not notice your edit.",
];

/** "This page was last edited N ago by …" */
export const EDITORS: readonly string[] = [
  "Anonymous Puff",
  "LordOfTheAbyssalFlame (Kuro)",
  "TotallyNotSenpai",
  "a Batbun (talk)",
  "The Narrator",
  "MagicalGirl#47 (name pending)",
  "Truck-kun (HONK)",
  "Maid_Pudding_Official",
  "IsekaiKun_lv9999",
  "the Merch Machine (bot)",
];
export const EDIT_AGO: readonly string[] = ["3 seconds", "12 seconds", "a moment", "4 minutes", "one episode", "an entire filler arc"];

/** Talk-page excerpts in a list page's footer. */
export const TALK: Readonly<Record<WikiTab, readonly string[]>> = {
  plot: ["Should \"Speedrun Any%\" count if you did it on purpose? (88 replies)", "Proposal: rename Plot Points to Plot Holes (rejected 31 times)"],
  heroes: ["Is Magical Girl #47's name confirmed yet? (412 replies, locked)", "Requesting Senpai's height \"without hair\" (unanswered)"],
  weapons: ["Is the Baka Harisen a weapon or a lifestyle? (archived)", "Dark Flame Dragon: \"the flames are orange\" (edit war, 1,204 reverts)"],
  passives: ["Does Plot Armor stack with plot armor? (the narrator says yes)", "Bento Box contents spoiler policy (ongoing)"],
  enemies: ["Is the Puff a slime or a dumpling? (412 replies, locked)", "Batbun steering: citation needed (they do not steer)"],
  bosses: ["King Puff's moustache: real or merch? (it's real)", "Should Cancel-sama's page be cancelled? (pending network notes)"],
  relics: ["Is the Slightly Bent Spoon \"slightly\" bent? (measurements pending)", "Rates on this page match the printed rates (disputed)"],
  stages: ["The Beach Episode is crabs. Please stop asking. (locked)", "Why is it always night in the meadow? (on schedule)"],
};

/** Search page with no hits. */
export function noResults(q: string): string {
  return `The page "${q}" does not exist. You can ask for it to be created, but nobody will.`;
}

/** Small rotating pick (seeded by the string so a page shows the same joke while it's open). */
export function pickBy<T>(list: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

/** Boss taunts (satire.md §6, scripted lines) by boss id. */
export const BOSS_TAUNTS: Readonly<Record<string, readonly string[]>> = {
  king_puff: ["BEHOLD MY SQUISH!", "THE CROWN STAYS ON!"],
  nightmare_teddy: ["...NO BEDTIME.", "RAAAAWR."],
  lady_lunatic: ["Dance with the moon.", "How lunatic of you."],
  gingerbread_golem: ["I AM... BAKED.", "STILL GOOEY!"],
  sugar_plum_tyrant: ["Bow to the sugar!", "MORE DESSERT!", "...so... sleepy..."],
  council_president: ["Motion: denied.", "Assembly!", "My GLASSES?!"],
  bishounen: ["Nice weather.", "One moment.", "...Oh. Hello."],
  kraken_chan: ["Hug time~!", "Tide's in!"],
  firework_dragon: ["TAMAYA!!", "ENCORE!"],
  truck_kun_boss: ["HONK.", "HONK HONK."],
  rival_chan: ["Remember me?!", "MONTAGE TIME!", "FINAL CLASH!"],
  cancel_sama: ["Let's look at the numbers.", "We're cutting costs.", "Wrap it up."],
};

/** "(Redirected from …)" aliases for a few famous pages. */
export const REDIRECTS: Readonly<Record<string, string>> = {
  puff: "Puff-kun",
  king_puff: "His Royal Squishiness",
  truck_kun_boss: "The Truck",
  truck_kun: "The Truck",
  magical_girl_47: "Magical Girl #46",
  senpai: "Senpai (noticing)",
  bent_spoon: "Spoon (bent, slightly)",
  shroomie: "Polka Dot Mushroom (do not call it that)",
};

/** Printed rates (the Merch Machine fine print), quoted on merch articles. */
export const RATE: Readonly<Record<string, string>> = { N: "52%", R: "30%", SR: "13.5%", SSR: "3.6%", UR: "0.75%", LR: "0.14%", MYTHIC: "0.0069% (nice)" };
