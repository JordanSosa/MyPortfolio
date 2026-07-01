// Loot generation: equipment with rolled affixes, uniques, currencies,
// augment runes — plus the crafting-currency application rules.

import { rng, uid } from "../core/rng.js";
import {
  RARITIES, RARITY_ORDER, BASES, WEAPON_BY_CLASS, affixesFor,
  LEGEND_ADJ, LEGEND_NOUN, LEGEND_DOMAIN, UNIQUES, CURRENCIES, POTIONS,
} from "../data/items.js";
import { AUGMENTS, AUGMENT_IDS } from "../data/classes.js";
import { QUEST_ITEMS } from "../data/quests.js";
import { G } from "../core/state.js";

const clamp01 = (t) => Math.max(0, Math.min(1, t));

function rollAffixValue(fam, ilvl) {
  const t = clamp01(ilvl / 20);
  const center = fam.lo + (fam.hi - fam.lo) * t;
  let v = center * rng.float(0.7, 1.15);
  v = fam.pct || v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return Math.max(fam.pct ? 1 : 0.5, v);
}

function rollAffixes(item, count, keep = []) {
  const pool = affixesFor(BASES[item.baseId].kind).filter((f) => !keep.some((k) => k.id === f.id));
  const picked = [...keep];
  // keep prefix/suffix mix plausible: no more than ceil(count*?) of one kind
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng.next() * pool.length);
    const fam = pool.splice(idx, 1)[0];
    picked.push({ id: fam.id, stat: fam.stat, value: rollAffixValue(fam, item.ilvl), text: fam.text, kind: fam.kind });
  }
  item.affixes = picked;
}

function legendName(kind) {
  const nouns = LEGEND_NOUN[kind] || LEGEND_NOUN.jewelry;
  return `${rng.pick(LEGEND_ADJ)} ${rng.pick(nouns)} of the ${rng.pick(LEGEND_DOMAIN)}`;
}

function applyBaseImplicits(item) {
  const base = BASES[item.baseId];
  if (base.kind === "weapon") {
    item.wmin = Math.max(1, Math.round((3 + item.ilvl * 1.15) * base.dmgMult));
    item.wmax = Math.round(item.wmin * 1.65);
    item.wspd = base.spdBase;
  } else if (base.kind === "armor") {
    item.armorImp = Math.round((4 + item.ilvl * 2.1) * base.armMult);
    item.affixImplicit = { stat: "armor", value: item.armorImp, text: `+${item.armorImp} Armor` };
  }
}

export function makeEquipment(ilvl, opts = {}) {
  let baseId = opts.baseId;
  if (!baseId) {
    if (opts.slotKind === "weapon") baseId = WEAPON_BY_CLASS[G.player.classId];
    else {
      const pool = ["helmet", "chest", "gloves", "boots", "belt", "amulet", "ring", "ring"];
      // ~30% of drops are weapons, biased to the player's class weapon
      if (rng.chance(0.3)) baseId = rng.chance(0.7) ? WEAPON_BY_CLASS[G.player.classId] : rng.pick(Object.values(WEAPON_BY_CLASS));
      else baseId = rng.pick(pool);
    }
  }
  const base = BASES[baseId];
  const rarity = opts.rarity || rollRarity(opts.dropTier || 1);
  const item = {
    id: uid(), kind: "equip", baseId, slot: base.slot, icon: base.icon,
    rarity, ilvl: Math.max(1, Math.round(ilvl)),
    name: base.name, affixes: [],
  };
  applyBaseImplicits(item);

  if (rarity === "unique") return makeUnique(null, ilvl, baseId);

  const [lo, hi] = RARITIES[rarity].affixes;
  if (hi > 0) rollAffixes(item, rng.int(lo, hi));
  if (rarity === "legendary") item.name = legendName(base.kind);
  else if (rarity !== "normal") item.name = `${base.name}`;
  return item;
}

export function makeUnique(uniqueId, ilvl = 15, preferBase = null) {
  let def = UNIQUES.find((u) => u.id === uniqueId);
  if (!def) {
    const pool = UNIQUES.filter((u) => u.base === preferBase);
    def = pool.length ? rng.pick(pool) : rng.pick(UNIQUES);
  }
  const base = BASES[def.base];
  const item = {
    id: uid(), kind: "equip", baseId: def.base, slot: base.slot, icon: def.icon,
    rarity: "unique", ilvl: Math.max(12, Math.round(ilvl)),
    name: def.name, affixes: [],
    mods: def.mods, special: def.special, specialText: def.specialText, flavor: def.flavor,
    uniqueId: def.id,
  };
  applyBaseImplicits(item);
  return item;
}

export function rollRarity(dropTier = 1) {
  // Higher-tier mobs shift weight toward higher rarities.
  const shift = 1 + (dropTier - 1) * 0.6;
  const entries = RARITY_ORDER.map((r, i) => ({
    v: r, w: RARITIES[r].weight * (i === 0 ? 1 / shift : Math.pow(shift, i * 0.45)),
  }));
  return rng.weighted(entries);
}

export function makeCurrency(typeId, count = 1) {
  const c = CURRENCIES[typeId];
  return { id: uid(), kind: "currency", typeId, count, stack: true, icon: c.icon, name: c.name, text: c.text, rarity: "epic" };
}

export function makeRune(typeId) {
  const a = AUGMENTS[typeId || rng.pick(AUGMENT_IDS)];
  return { id: uid(), kind: "rune", typeId: a.id, count: 1, stack: true, icon: a.icon, name: `Augment Rune: ${a.name}`, text: a.text, rarity: "rare" };
}

export function makePotion(typeId, count = 1) {
  const p = POTIONS[typeId];
  return { id: uid(), kind: "potion", typeId, count, stack: true, icon: p.icon, name: p.name, text: p.text, rarity: "uncommon" };
}

export function makeQuestItem(typeId) {
  const q = QUEST_ITEMS[typeId];
  return { id: uid(), kind: "quest", typeId, count: 1, stack: true, icon: q.icon, name: q.name, text: q.text, rarity: "normal" };
}

export function rollCurrencyType() {
  return rng.weighted(Object.values(CURRENCIES).map((c) => ({ v: c.id, w: c.weight })));
}

// Full drop roll for a slain mob. Returns array of items (gold handled separately).
export function rollDrops(mobLevel, dropTier, isBoss = false) {
  const out = [];
  if (isBoss) {
    out.push(makeEquipment(mobLevel, { rarity: rng.chance(0.5) ? "legendary" : "epic", dropTier }));
    out.push(makeCurrency(rollCurrencyType(), rng.int(2, 4)));
    out.push(makeRune());
    if (!G.player.bossKilled) out.push(makeUnique());
    else if (rng.chance(0.25)) out.push(makeUnique());
    return out;
  }
  if (rng.chance(0.22)) out.push(makeEquipment(mobLevel, { dropTier }));
  if (rng.chance(0.11)) out.push(makeCurrency(rollCurrencyType()));
  if (rng.chance(0.045)) out.push(makeRune());
  if (rng.chance(0.07)) out.push(makePotion(rng.chance(0.6) ? "hp_potion" : "mp_potion"));
  return out;
}

export function goldFor(mobLevel, isBoss = false) {
  return Math.round((2 + mobLevel * rng.float(1.6, 2.8)) * (isBoss ? 20 : 1));
}

export function sellValue(item) {
  if (item.kind === "currency") return 15 * (item.count || 1);
  if (item.kind === "rune") return 25;
  if (item.kind === "potion") return 8 * (item.count || 1);
  if (item.kind === "quest") return 0;
  return Math.round((5 + item.ilvl * 2) * RARITIES[item.rarity].mult * 0.5);
}

// ---- Crafting: apply a currency to an equipment item. Returns error string or null.
export function applyCurrency(typeId, item) {
  if (item.kind !== "equip") return "That only works on equipment.";
  if (item.rarity === "unique") return "Unique items cannot be reforged.";
  const rarityUp = () => RARITY_ORDER[RARITY_ORDER.indexOf(item.rarity) + 1];
  const base = BASES[item.baseId];

  switch (typeId) {
    case "shard_awakening": {
      if (item.rarity !== "normal") return "Only works on Normal items.";
      item.rarity = "uncommon";
      rollAffixes(item, rng.int(1, 2));
      return null;
    }
    case "crystal_change": {
      if (item.rarity !== "uncommon") return "Only works on Uncommon items.";
      rollAffixes(item, rng.int(1, 2));
      return null;
    }
    case "orb_ascension": {
      if (!["normal", "uncommon", "rare"].includes(item.rarity)) return "Only upgrades up to Epic.";
      item.rarity = rarityUp();
      const keep = item.rarity === "uncommon" ? [] : item.affixes;
      const [, hi] = RARITIES[item.rarity].affixes;
      rollAffixes(item, Math.max(1, Math.min(1, hi - keep.length)), keep);
      return null;
    }
    case "prism_chaos": {
      if (!["rare", "epic", "legendary"].includes(item.rarity)) return "Only works on Rare, Epic or Legendary items.";
      const [lo, hi] = RARITIES[item.rarity].affixes;
      rollAffixes(item, rng.int(lo, hi));
      return null;
    }
    case "rune_fortune": {
      if (!item.affixes.length) return "The item has no affixes to bless.";
      for (const a of item.affixes) {
        const fam = affixesFor(base.kind).find((f) => f.id === a.id) || { lo: a.value, hi: a.value, pct: true };
        a.value = rollAffixValue(fam, item.ilvl);
      }
      return null;
    }
    case "tome_legends": {
      if (item.rarity !== "epic") return "Only works on Epic items.";
      item.rarity = "legendary";
      item.name = legendName(base.kind);
      rollAffixes(item, rng.int(4, 6));
      return null;
    }
    default: return "Nothing happens.";
  }
}
