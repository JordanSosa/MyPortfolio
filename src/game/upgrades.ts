/**
 * Level-up card generation + application, and chest rewards (DESIGN §2.3, §2.4).
 *
 * Pool (weighted, picked without replacement):
 *   evolution (eligible: base weapon at max level + required passive owned)  - always shown first; a weapon
 *     with several evolutions gets one card per passive held, and the pick decides (the other is gone)
 *   upgrade of an owned weapon (w 10) / owned passive (w 8)
 *   NEW weapon while a weapon slot is free (w 6) / NEW passive while a passive slot is free (w 5)
 * Season 2: the NEW weapons (passives) share the slice's 7 (8) candidates' weight however big the pool is,
 * and while the hero holds only its starter weapon every offer shows one NEW weapon (builds still form).
 * Rarity: evolution > epic (lucky double level, chance 4% x luck) > rare (NEW weapon or MAX level) > common.
 * Empty / short pool -> "Heal 30 HP" and "Star Pouch" (+CFG.starPouchCoins coins) fallbacks.
 *
 * Season 2 gates (World): NEW items only from RunConfig.weaponPool / passivePool
 * (World.inPool), banished items never come back, slot limits come from the
 * RunConfig (World.weaponSlots / passiveSlots), and a weapon's max level grows
 * with its mastery Limit Breaks (World.weaponMaxLevel; those cards carry
 * `limitBreak`).
 */
import { CFG } from "./config";
import { PASSIVES, PASSIVE_BY_ID } from "./passives";
import { WEAPONS, baseWeapons, evolutionsOf } from "./registry";
import type { ChestResult, UpgradeCard, WeaponDef } from "./types";
import { limitBreakText } from "./weapons/_shared";
import type { World } from "./world";

interface Cand {
  card: UpgradeCard;
  w: number;
}

/** Light Novel Title twist: far too long card subtitles (generic tropes, no real titles). */
const NOVEL: ((n: string) => string)[] = [
  (n) => `The ${n} I Picked Up in Another World Was Secretly Level 99?!`,
  (n) => `Apparently My ${n} Is the Strongest, but I Just Want a Quiet Life`,
  (n) => `I Was Reborn as a Humble ${n}, So I Maxed It Out (Vol. 12)`,
  (n) => `Everyone Laughed at My ${n}, Until It Evolved Twice`,
  (n) => `My Party Kicked Me Out, but My ${n} Was Overpowered All Along?!`,
  (n) => `A Slow, Relaxing Life With My ${n} (That Keeps Getting Interrupted)`,
];

/** Card title for this run: the item name, or the Light Novel Title version of it. */
function title(w: World, id: string, name: string): string {
  if (!w.novelTitles) return name;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `${name}: ${NOVEL[h % NOVEL.length](name)}`;
}

export const HEAL_CARD: Readonly<UpgradeCard> = {
  kind: "heal",
  id: "heal",
  name: "Onigiri Break",
  icon: "icon_hp_up",
  desc: "Heal 30 HP",
  from: 0,
  to: 0,
  rarity: "common",
};
export const COINS_CARD: Readonly<UpgradeCard> = {
  kind: "coins",
  id: "coins",
  name: "Star Pouch",
  icon: "icon_gold_up",
  desc: `+${CFG.starPouchCoins} coins`,
  from: 0,
  to: 0,
  rarity: "common",
};

function weaponUpText(def: WeaponDef, from: number, to: number): string {
  const parts: string[] = [];
  const n = def.levels.length;
  for (let l = from + 1; l <= to; l++) {
    const t = l > n ? limitBreakText(def, l - n) : def.upgrades[l - 2];
    if (t) parts.push(t);
  }
  return parts.join(" · ") || def.desc;
}

/**
 * Evolution cards currently eligible (`early`: levels below max that already qualify - chests with the Golden Gacha Ticket).
 * One card per ready recipe: a weapon with two evolutions and both passives held yields two cards (same `base`).
 * A weapon whose choice a chest already queued (World.pendingChoices) is left out: that pick comes first.
 */
export function evolutionCards(w: World, early = 0): UpgradeCard[] {
  const out: UpgradeCard[] = [];
  for (const inst of w.weapons) {
    const def = inst.def;
    const evos = evolutionsOf(def);
    if (evos.length === 0) continue;
    if (inst.level < def.levels.length - early) continue;
    if (w.choiceQueued(def.id)) continue;
    for (const e of evos) {
      if (w.banished.has(e.into)) continue;
      if (w.passiveLevel(e.with) <= 0) continue;
      const evo = WEAPONS.get(e.into);
      if (!evo) continue;
      // (evolving a Limit-Broken weapon carries +15% damage per Limit Break level into the evolution)
      const lb = inst.level - def.levels.length;
      out.push({
        kind: "evolution",
        id: evo.id,
        name: title(w, evo.id, evo.name),
        icon: evo.icon,
        desc: lb > 0 ? `${evo.desc} +${Math.round(lb * CFG.limitBreakInherit * 100)}% (Limit Break)` : evo.desc,
        from: inst.level,
        to: 1,
        rarity: "evolution",
        base: def.id,
        with: e.with,
      });
    }
  }
  return out;
}

/** Does the hero hold any evolved form of this base weapon? */
function holdsEvolved(w: World, def: WeaponDef): boolean {
  for (const e of evolutionsOf(def)) if (w.hasWeapon(e.into)) return true;
  return false;
}

/**
 * The level-up nudge of a NEW passive that would evolve a weapon in the build: every weapon nudges by 3 in total,
 * shared between the passives of its routes (two evolutions: 1.5 each), and not at all once one of its routes is
 * covered. So a second evolution does not make recipe passives crowd the offers: the passive / weapon mix of the
 * level-ups stays what the one-evolution game was tuned on.
 */
function recipeNudge(w: World, passive: string): number {
  let n = 0;
  for (const inst of w.weapons) {
    const evos = evolutionsOf(inst.def);
    let mine = false;
    let covered = false;
    for (const e of evos) {
      if (e.with === passive) mine = true;
      else if (w.passiveLevel(e.with) > 0) covered = true;
    }
    if (mine && !covered) n += 3 / evos.length;
  }
  return n;
}

/** Every candidate card with its weight (owned-only = chest mode). */
function candidates(w: World, ownedOnly: boolean): Cand[] {
  const out: Cand[] = [];
  const luck = w.stats.luck;
  const epicChance = 0.04 * luck;
  for (const inst of w.weapons) {
    const def = inst.def;
    const max = w.weaponMaxLevel(def);
    if (inst.level >= max || w.banished.has(def.id)) continue;
    let to = inst.level + 1;
    let rarity: UpgradeCard["rarity"] = to >= max ? "rare" : "common";
    if (to < max && w.rng.next() < epicChance) {
      to++;
      rarity = "epic";
    }
    const card: UpgradeCard = { kind: "weapon", id: def.id, name: title(w, def.id, def.name), icon: def.icon, desc: weaponUpText(def, inst.level, to), from: inst.level, to, rarity };
    if (max !== def.levels.length) card.max = max;
    if (to > def.levels.length) card.limitBreak = true;
    out.push({ w: 10, card });
  }
  for (const pi of w.passives) {
    const def = pi.def;
    const max = def.levels.length;
    if (pi.level >= max || w.banished.has(def.id)) continue;
    let to = pi.level + 1;
    let rarity: UpgradeCard["rarity"] = to >= max ? "rare" : "common";
    if (to < max && w.rng.next() < epicChance) {
      to++;
      rarity = "epic";
    }
    out.push({ w: 8, card: { kind: "passive", id: def.id, name: title(w, def.id, def.name), icon: def.icon, desc: def.levels[to - 1], from: pi.level, to, rarity } });
  }
  if (ownedOnly) return out;
  // Pool normalisation: the NEW weapons (passives) share the weight the shipped slice's 7 (8) had, so a
  // bigger Season 2 pool doesn't drown the upgrades of what the build already holds (builds still form).
  if (w.weapons.length < w.weaponSlots) {
    const start = out.length;
    for (const def of baseWeapons()) {
      if (w.hasWeapon(def.id) || !w.inPool("weapon", def.id)) continue;
      // already own its evolved form?
      if (holdsEvolved(w, def)) continue;
      out.push({ w: NEW_WEAPON_W, card: { kind: "weapon", id: def.id, name: title(w, def.id, def.name), icon: def.icon, desc: def.desc, from: 0, to: 1, rarity: "rare" } });
    }
    normalise(out, start, NEW_WEAPON_REF);
  }
  if (w.passives.length < w.passiveSlots) {
    const start = out.length;
    for (const def of PASSIVES) {
      if (w.passiveLevel(def.id) > 0 || !w.inPool("passive", def.id)) continue;
      out.push({ w: NEW_PASSIVE_W, card: { kind: "passive", id: def.id, name: title(w, def.id, def.name), icon: def.icon, desc: def.levels[0], from: 0, to: 1, rarity: "common" } });
    }
    normalise(out, start, NEW_PASSIVE_REF);
    // nudge passives that would evolve an owned weapon (on top: a recipe stands out even in a big pool)
    for (let i = start; i < out.length; i++) out[i].w += recipeNudge(w, out[i].card.id);
  }
  return out;
}

/** Offers guarantee a NEW weapon card while the build holds fewer weapons than this (the starter only). */
const EARLY_WEAPONS = 2;
/** Base weight of a NEW weapon / passive card, and how many of each the shipped slice could offer at once (7 / 8). */
const NEW_WEAPON_W = 6;
const NEW_WEAPON_REF = 7;
const NEW_PASSIVE_W = 5;
const NEW_PASSIVE_REF = 8;

/** Scale the weights of out[start..] so that more than `ref` candidates share `ref` candidates' total weight. */
function normalise(out: Cand[], start: number, ref: number): void {
  const n = out.length - start;
  if (n <= ref) return;
  const k = ref / n;
  for (let i = start; i < out.length; i++) out[i].w *= k;
}

function pickWeighted(w: World, list: Cand[]): Cand | null {
  let total = 0;
  for (const c of list) total += c.w;
  if (total <= 0) return null;
  let r = w.rng.next() * total;
  for (let i = 0; i < list.length; i++) {
    r -= list[i].w;
    if (r <= 0) return list.splice(i, 1)[0];
  }
  return list.pop() ?? null;
}

/** Generate `count` cards for a level-up. */
export function makeOffer(w: World, count: number = w.stats.cards): UpgradeCard[] {
  const out: UpgradeCard[] = [];
  for (const evo of evolutionCards(w)) if (out.length < count) out.push(evo);
  const pool = candidates(w, false);
  // the build forms: while the hero holds only its starter weapon, every offer shows one NEW weapon
  if (out.length < count && count >= 2 && w.weapons.length < Math.min(EARLY_WEAPONS, w.weaponSlots)) {
    const news = pool.filter((c) => c.card.kind === "weapon" && c.card.from === 0);
    const c = pickWeighted(w, news);
    if (c) {
      out.push(c.card);
      pool.splice(pool.indexOf(c), 1);
    }
  }
  while (out.length < count && pool.length) {
    const c = pickWeighted(w, pool);
    if (!c) break;
    out.push(c.card);
  }
  if (out.length < count) out.push({ ...HEAL_CARD });
  if (out.length < count) out.push({ ...COINS_CARD });
  return out;
}

/**
 * Whether a re-rolled level-up offer could differ from the current one (no RNG is
 * consumed). False when the pool fits in the offer entirely (every candidate is
 * always shown) and none of them can roll the epic double level, e.g. a maxed
 * build that only gets the Heal / Star Pouch fallbacks.
 */
export function canChangeOffer(w: World, count: number = w.stats.cards): boolean {
  const p = poolSize(w);
  return p.n > count || (p.n > 0 && p.epic && w.stats.luck > 0);
}

const POOL = { n: 0, epic: false };
/** Number of distinct cards the pool could offer right now (no RNG; shared scratch result). */
function poolSize(w: World): { n: number; epic: boolean } {
  let n = evolutionCards(w).length;
  let epic = false;
  for (const inst of w.weapons) {
    const max = w.weaponMaxLevel(inst.def);
    if (inst.level >= max || w.banished.has(inst.def.id)) continue;
    n++;
    if (inst.level + 1 < max) epic = true;
  }
  for (const pi of w.passives) {
    const max = pi.def.levels.length;
    if (pi.level >= max || w.banished.has(pi.def.id)) continue;
    n++;
    if (pi.level + 1 < max) epic = true;
  }
  if (w.weapons.length < w.weaponSlots)
    for (const def of baseWeapons()) if (!w.hasWeapon(def.id) && w.inPool("weapon", def.id) && !holdsEvolved(w, def)) n++;
  if (w.passives.length < w.passiveSlots) for (const def of PASSIVES) if (w.passiveLevel(def.id) <= 0 && w.inPool("passive", def.id)) n++;
  POOL.n = n;
  POOL.epic = epic;
  return POOL;
}

/**
 * Replacement for the banished card at `index` of `offer`: a fresh pick from the
 * pool that is not already in the offer, else the Heal / Star Pouch fallbacks.
 */
export function banishCard(w: World, offer: UpgradeCard[], index: number): UpgradeCard {
  const pool = candidates(w, false).filter((c) => !offer.some((o, i) => i !== index && o.kind === c.card.kind && o.id === c.card.id));
  const c = pickWeighted(w, pool);
  if (c) return c.card;
  if (!offer.some((o) => o.kind === "heal")) return { ...HEAL_CARD };
  return { ...COINS_CARD };
}

/** Apply a card to the build. */
export function applyCard(w: World, card: UpgradeCard): void {
  switch (card.kind) {
    case "weapon": {
      const have = w.hasWeapon(card.id);
      if (have) w.setWeaponLevel(have, card.to);
      else w.addWeapon(card.id, card.to);
      break;
    }
    case "passive": {
      if (w.passiveLevel(card.id) > 0) w.setPassiveLevel(card.id, card.to);
      else if (PASSIVE_BY_ID.has(card.id)) w.addPassive(card.id, card.to);
      break;
    }
    case "evolution": {
      if (card.choices) {
        // a chest's ROUTE SPLIT: the player picks which evolution (the level-up picker shows the choice next)
        w.queueChoice(card.choices);
        break;
      }
      const base = card.base ? w.hasWeapon(card.base) : undefined;
      if (base) w.evolveWeapon(base, card.id);
      break;
    }
    case "heal":
      w.heal(30);
      break;
    case "coins":
      w.coins += CFG.starPouchCoins;
      break;
  }
  w.emit("upgradeApplied", { card });
}

/** The chest's evolution reward: the first ready one, or a ROUTE SPLIT card when its weapon has several ready. */
function chestEvolution(w: World): UpgradeCard | null {
  const evos = evolutionCards(w, w.chestEvoEarly);
  const first = evos[0];
  if (!first) return null;
  const same = evos.filter((c) => c.base === first.base);
  if (same.length < 2) return first;
  const base = WEAPONS.get(first.base ?? "");
  return {
    kind: "evolution",
    id: first.base ?? first.id,
    name: "Route Split!",
    icon: base?.icon ?? first.icon,
    desc: `Choose ${base?.name ?? "the weapon"}'s evolution: ${same.map((c) => WEAPONS.get(c.id)?.name ?? c.name).join(" or ")}`,
    from: first.from,
    to: 1,
    rarity: "evolution",
    base: first.base,
    choices: same,
  };
}

/**
 * Chest rewards: 1 upgrade (golden: 3, 5% x luck JACKPOT: 5), evolutions first,
 * then upgrades of owned items, then new items, then coins. Applied immediately - except when the weapon
 * the chest would evolve has several evolutions ready: the reward is then a ROUTE SPLIT card (`choices`),
 * which queues the pick between them for the player (World.pendingChoices; the chest never decides a route).
 * `coins` in the result is the total coin delta (bonus + any Star Pouch rewards).
 */
export function rollChest(w: World, golden: boolean): ChestResult {
  const cl = Math.max(0, Math.min(1, w.run.flags.chestLuck ?? 0));
  // (w.jackpotBonus: relics - Waving Lucky Cat, Pity Counter Keychain)
  const jackpot = w.rng.next() < 0.05 * w.stats.luck * (1 + cl) + w.jackpotBonus;
  // chest luck: a plain chest may roll like a golden one (no extra RNG draw without it)
  const n = jackpot ? 5 : golden || (cl > 0 && w.rng.next() < cl) ? 3 : 1;
  const rewards: UpgradeCard[] = [];
  const bonus = Math.round((golden ? CFG.chestCoinsGolden : CFG.chestCoins + w.rng.int(0, CFG.chestCoins)) * (jackpot ? 3 : 1) * w.stats.greed);
  const before = w.coins;
  for (let i = 0; i < n; i++) {
    let card: UpgradeCard | null = chestEvolution(w);
    if (!card) {
      const owned = candidates(w, true);
      card = pickWeighted(w, owned)?.card ?? null;
    }
    if (!card) {
      const any = candidates(w, false);
      card = pickWeighted(w, any)?.card ?? null;
    }
    if (!card) {
      card = { ...COINS_CARD };
    }
    applyCard(w, card);
    rewards.push(card);
  }
  w.coins += bonus;
  // every coin this chest gave (the bonus + Star Pouch fallbacks on a maxed build): the UI toast reads it
  return { golden, jackpot, rewards, coins: Math.round(w.coins - before) };
}
