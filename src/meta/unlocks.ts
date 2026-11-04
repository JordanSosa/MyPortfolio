/**
 * Unlock rules (docs/EXPANSION.md §6, §7, §10): a data table content id ->
 * condition + codex hint ("???" entries), evaluated after every run (and at
 * boot, for content that a new build adds). Returns what was newly unlocked so
 * the results screen can throw a full-screen "NEW WEAPON UNLOCKED!".
 *
 * The table mirrors the content bible (docs/content/achievements.md §1,
 * weapons.md §6, stages.md §6). Defaults for content without a table entry:
 * weapons / passives / heroes are available from the start (so dev content
 * just works); a hero's signature weapon unlocks with the hero; stages need
 * the previous stage cleared (or StageInfo.requires); Plot Twists open after
 * the first clear of any stage; relics only come from the Merch Machine.
 * PURE.
 */
import { gameContent, stageByOrder, type MetaContent } from "./content";
import { discover } from "./codex";
import { unlockHero } from "./heroes";
import type { Lifetime, Profile } from "./profile";
import { addId } from "./util";

export type UnlockKind = "hero" | "weapon" | "passive" | "stage" | "twist" | "relic";

type NumericLifetimeKey = { [K in keyof Lifetime]: Lifetime[K] extends number ? K : never }[keyof Lifetime];

export type UnlockCond =
  | { t: "start" }
  /** Only from the Merch Machine / Copium Exchange / spark. */
  | { t: "gacha" }
  /** Clear the stage with this map order. */
  | { t: "stageClear"; order: number }
  /** Survive `time` seconds in the stage with this order (best time). */
  | { t: "survive"; order: number; time: number }
  | { t: "bossKill"; boss: string }
  | { t: "enemyKills"; enemy: string; count: number }
  /** Any numeric lifetime counter (kills, noDashBest, maxRank, levelUps ...). */
  | { t: "life"; key: NumericLifetimeKey; count: number }
  | { t: "heroCount"; count: number }
  | { t: "achievement"; id: string }
  /** Unlocks together with a hero (signature weapons). */
  | { t: "hero"; hero: string };

export interface UnlockRule {
  id: string;
  kind: UnlockKind;
  cond: UnlockCond;
  /** Codex hint for the locked entry. */
  hint: string;
}

/**
 * The table. Ids of content that is not registered yet are simply skipped,
 * so rules can land before (or after) the content files.
 */
export const UNLOCK_RULES: readonly UnlockRule[] = [
  // ---- heroes (EXPANSION §6, docs/content/achievements.md §1)
  { id: "hoshi", kind: "hero", cond: { t: "start" }, hint: "Your first hero." },
  { id: "rin", kind: "hero", cond: { t: "bossKill", boss: "king_puff" }, hint: "Defeat King Puff." },
  { id: "mochi", kind: "hero", cond: { t: "life", key: "kills", count: 3000 }, hint: "Defeat 3,000 enemies in total." },
  { id: "kuro", kind: "hero", cond: { t: "survive", order: 1, time: 360 }, hint: "Survive 6:00 in Dream Meadow. Something stirs. It's edgy." },
  { id: "pudding", kind: "hero", cond: { t: "stageClear", order: 1 }, hint: "Clear Dream Meadow." },
  { id: "aoi", kind: "hero", cond: { t: "stageClear", order: 2 }, hint: "Clear Candy Kingdom." },
  { id: "akane", kind: "hero", cond: { t: "stageClear", order: 3 }, hint: "Clear Shoujo Academy." },
  { id: "senpai", kind: "hero", cond: { t: "gacha" }, hint: "Merch Machine (SSR) or the Copium Exchange." },
  { id: "magical_girl_47", kind: "hero", cond: { t: "gacha" }, hint: "Merch Machine (SSR) or the Copium Exchange." },
  { id: "isekai_kun", kind: "hero", cond: { t: "gacha" }, hint: "Merch Machine (UR) or the Copium Exchange." },
  { id: "truck_kun", kind: "hero", cond: { t: "gacha" }, hint: "Truck-kun's Isekai Express (MYTHIC), or the 1,000-pull spark." },
  // ---- the 8 original weapons and passives are yours from the start
  ...["star_shot", "petal_slash", "yarn_orbit", "heart_boomerang", "thunder_bell", "candy_bomb", "bubble_aura", "prism_beam"].map(
    (id): UnlockRule => ({ id, kind: "weapon", cond: { t: "start" }, hint: "" }),
  ),
  ...["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "magnet_star", "lucky_clover", "heart_locket"].map(
    (id): UnlockRule => ({ id, kind: "passive", cond: { t: "start" }, hint: "" }),
  ),
  // ---- signature weapons come with their hero (docs/content/weapons.md §6)
  { id: "dark_flame_dragon", kind: "weapon", cond: { t: "hero", hero: "kuro" }, hint: "Comes bundled with a certain chuunibyou. Survive 6:00 in Dream Meadow." },
  { id: "teapot_tempest", kind: "weapon", cond: { t: "hero", hero: "pudding" }, hint: "Served only after Dream Meadow is cleared." },
  { id: "micro_missile_swarm", kind: "weapon", cond: { t: "hero", hero: "aoi" }, hint: "A mecha pilot is waiting past the Candy Kingdom." },
  { id: "baka_harisen", kind: "weapon", cond: { t: "hero", hero: "akane" }, hint: "Graduate from Shoujo Academy. N-not that she's waiting for you." },
  { id: "notice_me_sparkles", kind: "weapon", cond: { t: "hero", hero: "senpai" }, hint: "Pulled with Senpai. He won't notice you either way." },
  { id: "henshin_burst", kind: "weapon", cond: { t: "hero", hero: "magical_girl_47" }, hint: "Comes with Magical Girl #... #4-something." },
  { id: "cheat_fireball", kind: "weapon", cond: { t: "hero", hero: "isekai_kun" }, hint: "Pulled with Isekai-kun. Probably overpowered." },
  { id: "horn_of_reincarnation", kind: "weapon", cond: { t: "hero", hero: "truck_kun" }, hint: "HONK." },
  // ---- the 4 general Season 2 weapons
  { id: "bubble_tea_cannon", kind: "weapon", cond: { t: "enemyKills", enemy: "puff", count: 1000 }, hint: "Puffs are chewy. Squish a thousand of them." },
  { id: "paper_crane_flock", kind: "weapon", cond: { t: "life", key: "evolutions", count: 600 }, hint: "Fold 600 evolutions. Legend says a thousand folds grant a wish; the other 400 are sold separately." },
  { id: "idol_lightstick_wave", kind: "weapon", cond: { t: "life", key: "maxRank", count: 5 }, hint: "The crowd only cheers for SSS." },
  { id: "kotatsu_of_sloth", kind: "weapon", cond: { t: "life", key: "noDashBest", count: 180 }, hint: "Have you tried... not dashing? For three whole minutes?" },
  // ---- the 8 Season 2 passives
  { id: "plot_armor", kind: "passive", cond: { t: "life", key: "damageTaken", count: 5000 }, hint: "Take five thousand damage. Walk it off. Character building." },
  { id: "main_character_aura", kind: "passive", cond: { t: "life", key: "maxRank", count: 3 }, hint: "Reach S rank. Main characters always do." },
  { id: "bento_box", kind: "passive", cond: { t: "life", key: "foodEaten", count: 50 }, hint: "Eat fifty snacks. Heroes are growing." },
  { id: "speed_lines", kind: "passive", cond: { t: "life", key: "dashes", count: 500 }, hint: "Dash five hundred times. Feel the lines." },
  { id: "inner_monologue", kind: "passive", cond: { t: "life", key: "ults", count: 25 }, hint: "Shout twenty-five attack names." },
  { id: "training_montage", kind: "passive", cond: { t: "life", key: "bestLevel", count: 25 }, hint: "Reach level 25 in one episode. Cue the montage music." },
  { id: "friendship_bracelet", kind: "passive", cond: { t: "heroCount", count: 4 }, hint: "Make four friends. (Heroes count.)" },
  { id: "chibi_charm", kind: "passive", cond: { t: "life", key: "noHitBest", count: 120 }, hint: "Two minutes without a scratch. Be small. Be unhittable." },
  // ---- Plot Twists: the roster grows with stage clears (docs/content/stages.md §6)
  ...["budget_cuts", "filler_overload", "rushed_production", "censored", "cliffhanger", "power_creep"].map((id): UnlockRule => ({ id, kind: "twist", cond: { t: "stageClear", order: 1 }, hint: "Clear Dream Meadow." })),
  ...["spoilers", "dub_version", "mid_season_break"].map((id): UnlockRule => ({ id, kind: "twist", cond: { t: "stageClear", order: 2 }, hint: "Clear Candy Kingdom." })),
  ...["darker_and_edgier", "light_novel_title"].map((id): UnlockRule => ({ id, kind: "twist", cond: { t: "stageClear", order: 3 }, hint: "Clear Shoujo Academy." })),
  ...["shounen_rival", "studio_change"].map((id): UnlockRule => ({ id, kind: "twist", cond: { t: "stageClear", order: 4 }, hint: "Clear Beach Episode." })),
  ...["sequel_hook", "simulcast_delay"].map((id): UnlockRule => ({ id, kind: "twist", cond: { t: "stageClear", order: 5 }, hint: "Clear The Final Arc." })),
];

const RULE_BY_KEY: ReadonlyMap<string, UnlockRule> = new Map(UNLOCK_RULES.map((r) => [`${r.kind}:${r.id}`, r]));

/** The rule for a content id (explicit table entry, else the default for its kind). */
export function unlockRule(kind: UnlockKind, id: string, ctx: MetaContent = gameContent()): UnlockRule {
  const r = RULE_BY_KEY.get(`${kind}:${id}`);
  if (r) return r;
  switch (kind) {
    case "weapon": {
      const owner = ctx.heroes.find((h) => h.weapon === id);
      if (owner) return { id, kind, cond: { t: "hero", hero: owner.id }, hint: `Unlocks with ${owner.name}.` };
      return { id, kind, cond: { t: "start" }, hint: "" };
    }
    case "stage": {
      const st = ctx.stageById.get(id);
      if (!st || st.order <= 1) return { id, kind, cond: { t: "start" }, hint: "" };
      const req = st.requires ? ctx.stageById.get(st.requires) : stageByOrder(st.order - 1, ctx);
      return { id, kind, cond: { t: "stageClear", order: req?.order ?? st.order - 1 }, hint: `Clear ${req?.name ?? "the previous stage"}.` };
    }
    case "twist": {
      // the sim's TwistDef.unlockedBy (a stage id) when the table has no row; a stage that is not
      // registered yet keeps the twist locked
      const by = ctx.twists.get(id)?.unlockedBy;
      if (by) {
        const st = ctx.stageById.get(by);
        return { id, kind, cond: { t: "stageClear", order: st?.order ?? Number.MAX_SAFE_INTEGER }, hint: `Clear ${st?.name ?? "a later episode"}.` };
      }
      return { id, kind, cond: { t: "life", key: "clears", count: 1 }, hint: "Clear any stage to unlock Plot Twists." };
    }
    case "relic":
      return { id, kind, cond: { t: "gacha" }, hint: "Merch Machine or the Copium Exchange." };
    default:
      return { id, kind, cond: { t: "start" }, hint: "" };
  }
}

function stageClears(p: Profile, order: number, ctx: MetaContent): number {
  const st = stageByOrder(order, ctx);
  return st ? (p.records[st.id]?.clears ?? 0) : 0;
}

/** Progress toward a condition (value / target); `met` when value >= target. */
export function condProgress(p: Profile, cond: UnlockCond, ctx: MetaContent = gameContent()): { value: number; target: number; met: boolean } {
  const out = (value: number, target: number) => ({ value: Math.min(value, target), target, met: value >= target });
  switch (cond.t) {
    case "start":
      return out(1, 1);
    case "gacha":
      return out(0, 1);
    case "stageClear":
      return out(Math.min(1, stageClears(p, cond.order, ctx)), 1);
    case "survive": {
      const st = stageByOrder(cond.order, ctx);
      return out(Math.floor(st ? (p.records[st.id]?.bestTime ?? 0) : 0), cond.time);
    }
    case "bossKill":
      return out(Math.min(1, p.lifetime.bossKills[cond.boss] ?? 0), 1);
    case "enemyKills":
      return out(p.lifetime.killsByEnemy[cond.enemy] ?? 0, cond.count);
    case "life":
      return out(Math.floor(p.lifetime[cond.key]), cond.count);
    case "heroCount":
      return out(p.unlocks.heroes.length, cond.count);
    case "achievement":
      return out(cond.id in p.achievements.done ? 1 : 0, 1);
    case "hero":
      return out(p.unlocks.heroes.includes(cond.hero) ? 1 : 0, 1);
  }
}

const LIST: Record<Exclude<UnlockKind, "hero" | "relic">, "weapons" | "passives" | "stages" | "twists"> = {
  weapon: "weapons",
  passive: "passives",
  stage: "stages",
  twist: "twists",
};

export function isUnlocked(p: Profile, kind: UnlockKind, id: string): boolean {
  if (kind === "hero") return p.unlocks.heroes.includes(id);
  if (kind === "relic") return id in p.relics;
  return p.unlocks[LIST[kind]].includes(id);
}

export interface UnlockEvent {
  kind: UnlockKind;
  id: string;
  name: string;
  /** The hint text (what was achieved). */
  hint: string;
  /** Start content (available from the beginning): nothing to celebrate. */
  start: boolean;
}

/** Kind of a registered content id (heroes first), or undefined. */
export function contentKind(id: string, ctx: MetaContent = gameContent()): UnlockKind | undefined {
  if (ctx.heroById.has(id)) return "hero";
  if (ctx.weapons.has(id)) return "weapon";
  if (ctx.passives.has(id)) return "passive";
  if (ctx.stageById.has(id)) return "stage";
  if (ctx.twists.has(id)) return "twist";
  if (ctx.relics.has(id)) return "relic";
  return undefined;
}

/** Unlock one content id directly (achievement rewards, gifts). Returns the event, or null if unknown / already owned. */
export function grantUnlock(p: Profile, id: string, ctx: MetaContent = gameContent()): UnlockEvent | null {
  const kind = contentKind(id, ctx);
  if (!kind || isUnlocked(p, kind, id)) return null;
  const name = nameOf(kind, id, ctx);
  // (the unlock is the reward and gets its own celebration: the wiki entry is known, no silent bounty)
  if (kind === "hero") {
    unlockHero(p, id);
    discover(p, "heroes", id, false);
  } else if (kind === "relic") {
    p.relics[id] = 0;
    discover(p, "relics", id, false);
  } else addId(p.unlocks[LIST[kind]], id);
  return { kind, id, name, hint: "", start: false };
}

function nameOf(kind: UnlockKind, id: string, ctx: MetaContent): string {
  switch (kind) {
    case "hero":
      return ctx.heroById.get(id)?.name ?? id;
    case "weapon":
      return ctx.weapons.get(id)?.name ?? id;
    case "passive":
      return ctx.passives.get(id)?.name ?? id;
    case "stage":
      return ctx.stageById.get(id)?.name ?? id;
    case "twist":
      return ctx.twists.get(id)?.name ?? id;
    case "relic":
      return ctx.relics.get(id)?.name ?? id;
  }
}

/** Every registered content id of a kind that has unlock rules (relics excluded: gacha only). */
function idsOf(kind: Exclude<UnlockKind, "relic">, ctx: MetaContent): string[] {
  switch (kind) {
    case "hero":
      return ctx.heroes.map((h) => h.id);
    case "weapon":
      return ctx.baseWeapons.map((w) => w.id);
    case "passive":
      return [...ctx.passives.keys()];
    case "stage":
      return ctx.stages.map((s) => s.id);
    case "twist":
      return [...ctx.twists.keys()];
  }
}

const ORDER: readonly Exclude<UnlockKind, "relic">[] = ["hero", "stage", "weapon", "passive", "twist"];

/**
 * Unlock everything whose condition is met. Heroes go first so their
 * signature weapons follow in the same pass. Returns the new unlocks in order
 * (start content is flagged `start`: unlocked silently, not celebrated).
 */
export function evaluateUnlocks(p: Profile, ctx: MetaContent = gameContent()): UnlockEvent[] {
  const events: UnlockEvent[] = [];
  for (const kind of ORDER) {
    for (const id of idsOf(kind, ctx)) {
      if (isUnlocked(p, kind, id)) continue;
      const rule = unlockRule(kind, id, ctx);
      if (rule.cond.t === "gacha" || !condProgress(p, rule.cond, ctx).met) continue;
      const ev = grantUnlock(p, id, ctx);
      if (ev) events.push({ ...ev, hint: rule.hint, start: rule.cond.t === "start" });
    }
  }
  return events;
}

export interface UnlockStatus {
  unlocked: boolean;
  rule: UnlockRule;
  /** Progress toward the condition (codex "412 / 1,000"). */
  value: number;
  target: number;
}

/** Codex / select-screen status of a content id. */
export function unlockStatus(p: Profile, kind: UnlockKind, id: string, ctx: MetaContent = gameContent()): UnlockStatus {
  const rule = unlockRule(kind, id, ctx);
  const pr = condProgress(p, rule.cond, ctx);
  return { unlocked: isUnlocked(p, kind, id), rule, value: pr.value, target: pr.target };
}
