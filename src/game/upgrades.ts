/**
 * Level-up card generation + application, and chest rewards (DESIGN §2.3, §2.4).
 *
 * Pool (weighted, picked without replacement):
 *   evolution (eligible: base weapon at max level + required passive owned)  - always shown first
 *   upgrade of an owned weapon (w 10) / owned passive (w 8)
 *   NEW weapon while a weapon slot is free (w 6) / NEW passive while a passive slot is free (w 5)
 * Rarity: evolution > epic (lucky double level, chance 4% x luck) > rare (NEW weapon or MAX level) > common.
 * Empty / short pool -> "Heal 30 HP" and "+50 coins" fallbacks.
 */
import { CFG } from "./config";
import { PASSIVES, PASSIVE_BY_ID } from "./passives";
import { WEAPONS, baseWeapons } from "./registry";
import type { ChestResult, UpgradeCard, WeaponDef } from "./types";
import type { World } from "./world";

interface Cand {
  card: UpgradeCard;
  w: number;
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
  desc: "+50 coins",
  from: 0,
  to: 0,
  rarity: "common",
};

function weaponUpText(def: WeaponDef, from: number, to: number): string {
  const parts: string[] = [];
  for (let l = from + 1; l <= to; l++) {
    const t = def.upgrades[l - 2];
    if (t) parts.push(t);
  }
  return parts.join(" · ") || def.desc;
}

/** Evolution cards currently eligible. */
export function evolutionCards(w: World): UpgradeCard[] {
  const out: UpgradeCard[] = [];
  for (const inst of w.weapons) {
    const def = inst.def;
    if (def.evolved || !def.evolution) continue;
    if (inst.level < def.levels.length) continue;
    if (w.passiveLevel(def.evolution.with) <= 0) continue;
    const evo = WEAPONS.get(def.evolution.into);
    if (!evo) continue;
    out.push({
      kind: "evolution",
      id: evo.id,
      name: evo.name,
      icon: evo.icon,
      desc: evo.desc,
      from: inst.level,
      to: 1,
      rarity: "evolution",
      base: def.id,
      with: def.evolution.with,
    });
  }
  return out;
}

/** Every candidate card with its weight (owned-only = chest mode). */
function candidates(w: World, ownedOnly: boolean): Cand[] {
  const out: Cand[] = [];
  const luck = w.stats.luck;
  const epicChance = 0.04 * luck;
  for (const inst of w.weapons) {
    const def = inst.def;
    const max = def.levels.length;
    if (inst.level >= max) continue;
    let to = inst.level + 1;
    let rarity: UpgradeCard["rarity"] = to >= max ? "rare" : "common";
    if (to < max && w.rng.next() < epicChance) {
      to++;
      rarity = "epic";
    }
    out.push({ w: 10, card: { kind: "weapon", id: def.id, name: def.name, icon: def.icon, desc: weaponUpText(def, inst.level, to), from: inst.level, to, rarity } });
  }
  for (const pi of w.passives) {
    const def = pi.def;
    const max = def.levels.length;
    if (pi.level >= max) continue;
    let to = pi.level + 1;
    let rarity: UpgradeCard["rarity"] = to >= max ? "rare" : "common";
    if (to < max && w.rng.next() < epicChance) {
      to++;
      rarity = "epic";
    }
    out.push({ w: 8, card: { kind: "passive", id: def.id, name: def.name, icon: def.icon, desc: def.levels[to - 1], from: pi.level, to, rarity } });
  }
  if (ownedOnly) return out;
  if (w.weapons.length < CFG.weaponSlots) {
    for (const def of baseWeapons()) {
      if (w.hasWeapon(def.id)) continue;
      // already own its evolved form?
      if (def.evolution && w.hasWeapon(def.evolution.into)) continue;
      out.push({ w: 6, card: { kind: "weapon", id: def.id, name: def.name, icon: def.icon, desc: def.desc, from: 0, to: 1, rarity: "rare" } });
    }
  }
  if (w.passives.length < CFG.passiveSlots) {
    for (const def of PASSIVES) {
      if (w.passiveLevel(def.id) > 0) continue;
      // nudge passives that would evolve an owned weapon
      let wt = 5;
      for (const inst of w.weapons) if (inst.def.evolution?.with === def.id) wt += 3;
      out.push({ w: wt, card: { kind: "passive", id: def.id, name: def.name, icon: def.icon, desc: def.levels[0], from: 0, to: 1, rarity: "common" } });
    }
  }
  return out;
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
  let n = evolutionCards(w).length;
  let epic = false;
  for (const inst of w.weapons) {
    const max = inst.def.levels.length;
    if (inst.level >= max) continue;
    n++;
    if (inst.level + 1 < max) epic = true;
  }
  for (const pi of w.passives) {
    const max = pi.def.levels.length;
    if (pi.level >= max) continue;
    n++;
    if (pi.level + 1 < max) epic = true;
  }
  if (w.weapons.length < CFG.weaponSlots)
    for (const def of baseWeapons()) if (!w.hasWeapon(def.id) && !(def.evolution && w.hasWeapon(def.evolution.into))) n++;
  if (w.passives.length < CFG.passiveSlots) for (const def of PASSIVES) if (w.passiveLevel(def.id) <= 0) n++;
  return n > count || (n > 0 && epic && w.stats.luck > 0);
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
      const base = card.base ? w.hasWeapon(card.base) : undefined;
      if (base) w.evolveWeapon(base);
      break;
    }
    case "heal":
      w.heal(30);
      break;
    case "coins":
      w.coins += 50;
      break;
  }
  w.emit("upgradeApplied", { card });
}

/**
 * Chest rewards: 1 upgrade (golden: 3, 5% x luck JACKPOT: 5), evolutions first,
 * then upgrades of owned items, then new items, then coins. Applied immediately.
 * `coins` in the result is the total coin delta (bonus + any Star Pouch rewards).
 */
export function rollChest(w: World, golden: boolean): ChestResult {
  const jackpot = w.rng.next() < 0.05 * w.stats.luck;
  const n = jackpot ? 5 : golden ? 3 : 1;
  const rewards: UpgradeCard[] = [];
  const bonus = Math.round((golden ? 60 : 15 + w.rng.int(0, 15)) * (jackpot ? 3 : 1) * w.stats.greed);
  const before = w.coins;
  for (let i = 0; i < n; i++) {
    let card: UpgradeCard | null = evolutionCards(w)[0] ?? null;
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
