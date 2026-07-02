// Item bases, affix pools, rarity tiers, uniques, currencies, potions.

export const RARITIES = {
  normal:    { id: "normal",    name: "Normal",    color: "#e8e8e8", affixes: [0, 0], weight: 100, mult: 1 },
  uncommon:  { id: "uncommon",  name: "Uncommon",  color: "#6fe06f", affixes: [1, 2], weight: 55,  mult: 2 },
  rare:      { id: "rare",      name: "Rare",      color: "#5ab2ff", affixes: [2, 3], weight: 22,  mult: 4 },
  epic:      { id: "epic",      name: "Epic",      color: "#c07dff", affixes: [3, 4], weight: 7,   mult: 8 },
  legendary: { id: "legendary", name: "Legendary", color: "#ffa632", affixes: [4, 6], weight: 1.6, mult: 15 },
  unique:    { id: "unique",    name: "Unique",    color: "#ffd700", affixes: [0, 0], weight: 0.5, mult: 25 },
};
export const RARITY_ORDER = ["normal", "uncommon", "rare", "epic", "legendary", "unique"];

export const SLOTS = ["weapon", "helmet", "chest", "gloves", "boots", "belt", "amulet", "ring1", "ring2"];
export const SLOT_NAMES = {
  weapon: "Weapon", helmet: "Helmet", chest: "Chest", gloves: "Gloves", boots: "Boots",
  belt: "Belt", amulet: "Amulet", ring1: "Ring", ring2: "Ring",
};

// kind: which affix pool + paperdoll slot family. weapon type per class.
export const BASES = {
  // weapons (implicit: phys damage range scaled by ilvl via dmgMult)
  sword: { id: "sword", name: "Sword", slot: "weapon", kind: "weapon", icon: "🗡️", dmgMult: 1.15, spdBase: 1.1 },
  staff: { id: "staff", name: "Staff", slot: "weapon", kind: "weapon", icon: "🪄", dmgMult: 1.25, spdBase: 0.9 },
  bow:   { id: "bow",   name: "Bow",   slot: "weapon", kind: "weapon", icon: "🏹", dmgMult: 1.0,  spdBase: 1.25 },
  // armor (implicit: armor scaled by ilvl via armMult)
  helmet: { id: "helmet", name: "Helm",       slot: "helmet", kind: "armor", icon: "🪖", armMult: 0.7 },
  chest:  { id: "chest",  name: "Tunic",      slot: "chest",  kind: "armor", icon: "🥋", armMult: 1.2 },
  gloves: { id: "gloves", name: "Gloves",     slot: "gloves", kind: "armor", icon: "🧤", armMult: 0.5 },
  boots:  { id: "boots",  name: "Boots",      slot: "boots",  kind: "armor", icon: "👢", armMult: 0.5 },
  belt:   { id: "belt",   name: "Belt",       slot: "belt",   kind: "armor", icon: "🎗️", armMult: 0.4 },
  // jewelry (no implicit)
  amulet: { id: "amulet", name: "Amulet", slot: "amulet", kind: "jewelry", icon: "📿" },
  ring:   { id: "ring",   name: "Ring",   slot: "ring",   kind: "jewelry", icon: "💍" },
};

export const WEAPON_BY_CLASS = { blademaster: "sword", arcanist: "staff", windrunner: "bow" };

// Affix families. val: [minAt ilvl1, maxAt ilvl20] — value scales with ilvl then
// rolls within a bracket. pfx=prefix (damage/defense), sfx=suffix (utility).
// pools: which base kinds can roll it.
const A = (id, stat, text, lo, hi, pools, kind, pct = false) =>
  ({ id, stat, text, lo, hi, pools, kind, pct });

export const AFFIXES = [
  // prefixes — offense
  A("flat_phys",  "flatPhys",  "Adds # Physical Damage",     2, 26,  ["weapon", "jewelry"], "pfx"),
  A("flat_fire",  "flatFire",  "Adds # Fire Damage",         2, 22,  ["weapon", "jewelry"], "pfx"),
  A("flat_cold",  "flatCold",  "Adds # Cold Damage",         2, 22,  ["weapon", "jewelry"], "pfx"),
  A("flat_light", "flatLight", "Adds # Lightning Damage",    1, 26,  ["weapon", "jewelry"], "pfx"),
  A("pct_dmg",    "dmgPct",    "#% increased Damage",        4, 24,  ["weapon"],            "pfx", true),
  A("pct_melee",  "meleeDmgPct","#% increased Melee Damage", 6, 30,  ["weapon", "gloves"],  "pfx", true),
  A("pct_proj",   "projDmgPct","#% increased Projectile Damage", 6, 30, ["weapon", "gloves"], "pfx", true),
  A("pct_spell",  "spellDmgPct","#% increased Spell Damage", 6, 30,  ["weapon", "helmet"],  "pfx", true),
  A("pct_fire",   "fireDmgPct", "#% increased Fire Damage",  5, 28,  ["weapon", "jewelry"], "pfx", true),
  A("pct_cold",   "coldDmgPct", "#% increased Cold Damage",  5, 28,  ["weapon", "jewelry"], "pfx", true),
  A("pct_light",  "lightDmgPct","#% increased Lightning Damage", 5, 28, ["weapon", "jewelry"], "pfx", true),
  A("pct_aoe",    "aoePct",    "#% increased Area of Effect", 4, 16, ["helmet", "amulet"],  "pfx", true),
  // prefixes — defense
  A("flat_hp",    "maxHp",     "+# to maximum Life",         8, 90,  ["armor", "jewelry"],  "pfx"),
  A("flat_mp",    "maxMp",     "+# to maximum Mana",         6, 70,  ["armor", "jewelry"],  "pfx"),
  A("flat_armor", "armor",     "+# to Armor",                6, 80,  ["armor"],             "pfx"),
  A("pct_armor",  "armorPct",  "#% increased Armor",         8, 40,  ["armor"],             "pfx", true),
  // suffixes — utility
  A("atk_spd",    "atkSpdPct", "#% increased Attack Speed",  3, 14,  ["weapon", "gloves"],  "sfx", true),
  A("cast_spd",   "castSpdPct","#% increased Cast Speed",    3, 14,  ["weapon", "helmet"],  "sfx", true),
  A("crit_ch",    "critCh",    "+#% to Critical Chance",     2, 9,   ["weapon", "jewelry"], "sfx", true),
  A("crit_mult",  "critMult",  "+#% to Critical Multiplier", 6, 30,  ["weapon", "amulet"],  "sfx", true),
  A("move_spd",   "moveSpdPct","#% increased Movement Speed",3, 12,  ["boots"],             "sfx", true),
  A("fire_res",   "fireRes",   "+#% to Fire Resistance",     5, 26,  ["armor", "jewelry"],  "sfx", true),
  A("cold_res",   "coldRes",   "+#% to Cold Resistance",     5, 26,  ["armor", "jewelry"],  "sfx", true),
  A("light_res",  "lightRes",  "+#% to Lightning Resistance",5, 26,  ["armor", "jewelry"],  "sfx", true),
  A("hp_regen",   "hpRegen",   "+# Life Regenerated per second", 1, 8, ["armor", "amulet"], "sfx"),
  A("mp_regen",   "mpRegen",   "+# Mana Regenerated per second", 1, 7, ["armor", "amulet"], "sfx"),
  A("str",        "str",       "+# to Strength",             3, 20,  ["armor", "jewelry", "weapon"], "sfx"),
  A("dex",        "dex",       "+# to Dexterity",            3, 20,  ["armor", "jewelry", "weapon"], "sfx"),
  A("int",        "int",       "+# to Intelligence",         3, 20,  ["armor", "jewelry", "weapon"], "sfx"),
  A("vit",        "vit",       "+# to Vitality",             3, 20,  ["armor", "jewelry"],  "sfx"),
  A("evasion",    "evasionPct","+#% to Evasion",             2, 8,   ["armor", "boots"],    "sfx", true),
  A("leech",      "leechPct",  "#% of Damage Leeched as Life", 1, 3, ["weapon", "amulet"],  "sfx", true),
];

export function affixesFor(kind) {
  return AFFIXES.filter((a) => a.pools.includes(kind));
}

// Legendary name generator pieces: "<Adj> <Noun> of the <Domain>"
export const LEGEND_ADJ = ["Wrathful", "Gleaming", "Forsaken", "Radiant", "Grim", "Whispering", "Molten", "Frozen", "Storm-touched", "Ancient", "Feral", "Hallowed"];
export const LEGEND_NOUN = {
  weapon: ["Edge", "Fang", "Spire", "Talon", "Requiem", "Hymn"],
  armor: ["Aegis", "Shell", "Mantle", "Ward", "Bulwark", "Embrace"],
  jewelry: ["Sigil", "Eye", "Loop", "Tear", "Heart", "Knot"],
};
export const LEGEND_DOMAIN = ["Tempest", "Deep", "Dawn", "Long Night", "Wilds", "Ember Court", "Frozen Choir", "Broken King", "Skyfather", "Duskfang"];

// Hand-designed uniques. mods use the same stat keys; special = bespoke flags
// the combat/stat systems check for.
export const UNIQUES = [
  {
    id: "emberclad", name: "Emberclad Mantle", base: "chest", icon: "🥋",
    flavor: "It never stopped burning. She never stopped wearing it.",
    mods: [{ stat: "fireDmgPct", v: 40 }, { stat: "coldRes", v: -20 }, { stat: "maxHp", v: 35 }],
    special: "igniteSpread", specialText: "Your ignites spread to nearby enemies",
  },
  {
    id: "whisperwind", name: "Whisperwind", base: "bow", icon: "🏹",
    flavor: "The string sings a note only the wind remembers.",
    mods: [{ stat: "dmgPct", v: -15 }, { stat: "atkSpdPct", v: 10 }],
    special: "extraProj", specialText: "+1 Projectile to all projectile skills",
  },
  {
    id: "hungering", name: "The Hungering Band", base: "ring", icon: "💍",
    flavor: "It feeds so that you may feast.",
    mods: [{ stat: "leechPct", v: 3 }, { stat: "dmgPct", v: 12 }],
    special: "noRegen", specialText: "You cannot regenerate Life",
  },
  {
    id: "aetherheart", name: "Aetherheart", base: "amulet", icon: "📿",
    flavor: "A shard of the sky, still beating.",
    mods: [{ stat: "mpRegenPct", v: 50 }, { stat: "maxMp", v: 40 }],
    special: "freeCast", specialText: "Skills have 10% chance to cost no mana",
  },
  {
    id: "titans_resolve", name: "Titan's Resolve", base: "belt", icon: "🎗️",
    flavor: "The mountain does not flinch.",
    mods: [{ stat: "maxHp", v: 80 }, { stat: "atkSpdPct", v: -10 }],
    special: "noCrit", specialText: "You cannot be dealt critical strikes",
  },
];

// Crafting currencies — consumed on gear.
export const CURRENCIES = {
  shard_awakening: {
    id: "shard_awakening", name: "Shard of Awakening", icon: "🔹", weight: 34,
    text: "Upgrades a Normal item to Uncommon with random affixes.",
  },
  crystal_change: {
    id: "crystal_change", name: "Crystal of Change", icon: "🔷", weight: 22,
    text: "Rerolls the affixes of an Uncommon item.",
  },
  orb_ascension: {
    id: "orb_ascension", name: "Orb of Ascension", icon: "🔮", weight: 18,
    text: "Upgrades an item one rarity tier (up to Epic), adding an affix.",
  },
  prism_chaos: {
    id: "prism_chaos", name: "Prism of Chaos", icon: "🌈", weight: 12,
    text: "Rerolls all affixes on a Rare, Epic or Legendary item.",
  },
  rune_fortune: {
    id: "rune_fortune", name: "Rune of Fortune", icon: "🍀", weight: 9,
    text: "Rerolls the values of existing affixes.",
  },
  tome_legends: {
    id: "tome_legends", name: "Tome of Legends", icon: "📜", weight: 3,
    text: "Reforges an Epic item into a named Legendary with 4-6 affixes.",
  },
};

export const POTIONS = {
  hp_potion: { id: "hp_potion", name: "Vita Potion", icon: "🧪", price: 25, text: "Restores 40% of maximum Life. (Q)" },
  mp_potion: { id: "mp_potion", name: "Aether Potion", icon: "🫙", price: 25, text: "Restores 40% of maximum Mana. (E)" },
};
