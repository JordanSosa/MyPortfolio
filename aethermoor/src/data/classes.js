// Classes, active skills, and augment runes (drop-only skill modifiers).

export const CLASSES = {
  blademaster: {
    id: "blademaster", name: "Blademaster", icon: "⚔️",
    blurb: "A frontline duelist. Cleaves through packs, shrugs off blows, and turns strength into steel.",
    color: 0xe0574f, uiColor: "#e0574f",
    baseAttrs: { str: 14, dex: 8, int: 5, vit: 10 },
    perLevel: { str: 1.4, dex: 0.5, int: 0.2, vit: 0.9 }, // +3/level total
    weapon: "sword",
    treeAngle: 90, // degrees — entry point on the shared passive tree
    skills: ["heavy_strike", "cleave", "whirlwind", "war_banner", "lunge", "executioners_call"],
  },
  arcanist: {
    id: "arcanist", name: "Arcanist", icon: "🔮",
    blurb: "An aether-wielding scholar. Fragile, but erases whole camps with fire, frost, and storm.",
    color: 0x7d6ff0, uiColor: "#8f7ff5",
    baseAttrs: { str: 5, dex: 7, int: 15, vit: 8 },
    perLevel: { str: 0.2, dex: 0.4, int: 1.7, vit: 0.7 },
    weapon: "staff",
    treeAngle: 210,
    skills: ["aether_bolt", "fireball", "frost_nova", "chain_spark", "mana_weave", "meteor"],
  },
  windrunner: {
    id: "windrunner", name: "Windrunner", icon: "🏹",
    blurb: "A skyborne hunter. Kites, crits, and lets poison and arrows do the talking.",
    color: 0x4fae6b, uiColor: "#57c47a",
    baseAttrs: { str: 7, dex: 15, int: 6, vit: 8 },
    perLevel: { str: 0.4, dex: 1.6, int: 0.3, vit: 0.7 },
    weapon: "bow",
    treeAngle: 330,
    skills: ["piercing_shot", "split_arrow", "serpent_sting", "hunters_focus", "rain_of_arrows", "skyfall_volley"],
  },
};

// Skill schema:
//  tags: melee | proj | spell (+ implicit aoe when aoe/splash present)
//  weaponMult — portion of weapon damage; flat(l) — flat base by skill level
//  aoe: {shape:'arc'|'circle', radius, angle?} centered on player or target
//  proj: {speed, count?, spreadDeg?, pierce?}   splash: radius at impact
//  chain: n bounces      dot: {dur, frac} (frac of hit as DoT over dur)
//  buff: {dur, mods, name}    dash: true    delay: {time, radius} ground AoE
//  execBelow/execMult — bonus damage vs low-HP targets
//  element: 'phys'|'fire'|'cold'|'light'      stun/ignite/chill/shock: extra status chance
export const SKILLS = {
  // ---- Blademaster ----
  heavy_strike: {
    id: "heavy_strike", name: "Heavy Strike", icon: "🗡️", unlock: 1, cd: 3, mana: 6, range: 3.2,
    tags: ["melee"], element: "phys", weaponMult: 1.5, flat: (l) => 3 + l * 3, stun: 0.25,
    desc: "A crushing blow with a 25% chance to stun.", per3: "+10% stun chance",
  },
  cleave: {
    id: "cleave", name: "Cleave", icon: "🪓", unlock: 1, cd: 4.5, mana: 9, range: 3.2,
    tags: ["melee"], element: "phys", weaponMult: 1.1, flat: (l) => 4 + l * 2.5,
    aoe: { shape: "arc", radius: 5, angle: 100 },
    desc: "Sweep all enemies in a frontal arc.", per3: "+12° arc width",
  },
  whirlwind: {
    id: "whirlwind", name: "Whirlwind", icon: "🌪️", unlock: 4, cd: 7, mana: 14, range: 0,
    tags: ["melee"], element: "phys", weaponMult: 0.9, flat: (l) => 5 + l * 2.5, targeted: false,
    aoe: { shape: "circle", radius: 4.5 },
    desc: "Spin, striking everything around you.", per3: "+0.4m radius",
  },
  war_banner: {
    id: "war_banner", name: "War Banner", icon: "🚩", unlock: 7, cd: 20, mana: 20, range: 0,
    tags: ["melee"], targeted: false,
    buff: { dur: 12, name: "War Banner", mods: (l) => [{ stat: "dmgPct", v: 15 + l * 3 }, { stat: "atkSpdPct", v: 8 + l }] },
    desc: "Rally: increased damage and attack speed for 12s.", per3: "+1s duration",
  },
  lunge: {
    id: "lunge", name: "Lunge", icon: "💨", unlock: 10, cd: 8, mana: 12, range: 14,
    tags: ["melee"], element: "phys", weaponMult: 1.2, flat: (l) => 4 + l * 3, dash: true,
    desc: "Dash to your target and strike.", per3: "+2m dash range",
  },
  executioners_call: {
    id: "executioners_call", name: "Executioner's Call", icon: "☠️", unlock: 13, cd: 10, mana: 16, range: 3.2,
    tags: ["melee"], element: "phys", weaponMult: 1.6, flat: (l) => 6 + l * 3.5, execBelow: 0.35, execMult: 2.2,
    desc: "A killing stroke: massive bonus damage below 35% HP.", per3: "+5% execute threshold",
  },

  // ---- Arcanist ----
  aether_bolt: {
    id: "aether_bolt", name: "Aether Bolt", icon: "✨", unlock: 1, cd: 1.2, mana: 4, range: 22,
    tags: ["spell", "proj"], element: "light", weaponMult: 0.7, flat: (l) => 4 + l * 2.5,
    proj: { speed: 26 },
    desc: "A quick dart of raw aether.", per3: "+8% damage",
  },
  fireball: {
    id: "fireball", name: "Fireball", icon: "🔥", unlock: 1, cd: 4, mana: 11, range: 22,
    tags: ["spell", "proj"], element: "fire", weaponMult: 1.0, flat: (l) => 6 + l * 3.2,
    proj: { speed: 18 }, splash: 3.5, ignite: 0.3,
    desc: "Explodes on impact; 30% chance to ignite.", per3: "+10% ignite chance",
  },
  frost_nova: {
    id: "frost_nova", name: "Frost Nova", icon: "❄️", unlock: 4, cd: 8, mana: 16, range: 0,
    tags: ["spell"], element: "cold", weaponMult: 0.8, flat: (l) => 5 + l * 2.8, targeted: false,
    aoe: { shape: "circle", radius: 5.5 }, chill: 1,
    desc: "A ring of frost that always chills.", per3: "+0.5m radius",
  },
  chain_spark: {
    id: "chain_spark", name: "Chain Spark", icon: "⚡", unlock: 7, cd: 5, mana: 13, range: 20,
    tags: ["spell", "proj"], element: "light", weaponMult: 0.9, flat: (l) => 5 + l * 2.8,
    proj: { speed: 30 }, chain: 3, shock: 0.25,
    desc: "Lightning that arcs to 3 extra enemies.", per3: "+1 chain",
  },
  mana_weave: {
    id: "mana_weave", name: "Mana Weave", icon: "🌀", unlock: 10, cd: 18, mana: 0, range: 0,
    tags: ["spell"], targeted: false,
    buff: { dur: 12, name: "Mana Weave", mods: (l) => [{ stat: "spellDmgPct", v: 15 + l * 3 }, { stat: "mpRegen", v: 3 + l }] },
    desc: "Weave ambient aether: spell damage and mana regen for 12s.", per3: "+1s duration",
  },
  meteor: {
    id: "meteor", name: "Meteor", icon: "☄️", unlock: 13, cd: 12, mana: 26, range: 22,
    tags: ["spell"], element: "fire", weaponMult: 1.8, flat: (l) => 12 + l * 5,
    delay: { time: 1.1, radius: 4.5 }, ignite: 0.5,
    desc: "Call down a meteor after a short delay. Huge area damage.", per3: "+0.4m radius",
  },

  // ---- Windrunner ----
  piercing_shot: {
    id: "piercing_shot", name: "Piercing Shot", icon: "➹", unlock: 1, cd: 2.5, mana: 6, range: 24,
    tags: ["proj"], element: "phys", weaponMult: 1.3, flat: (l) => 3 + l * 2.8,
    proj: { speed: 34, pierce: true },
    desc: "An arrow that punches through everything in its path.", per3: "+8% damage",
  },
  split_arrow: {
    id: "split_arrow", name: "Split Arrow", icon: "🔱", unlock: 1, cd: 4, mana: 10, range: 22,
    tags: ["proj"], element: "phys", weaponMult: 0.85, flat: (l) => 3 + l * 2.2,
    proj: { speed: 28, count: 3, spreadDeg: 28 },
    desc: "Fires a fan of three arrows.", per3: "+4° spread coverage",
  },
  serpent_sting: {
    id: "serpent_sting", name: "Serpent Sting", icon: "🐍", unlock: 4, cd: 6, mana: 12, range: 22,
    tags: ["proj"], element: "phys", weaponMult: 0.7, flat: (l) => 3 + l * 2,
    proj: { speed: 30 }, dot: { dur: 6, frac: 1.6 },
    desc: "Venom deals heavy damage over 6 seconds.", per3: "+1s venom duration",
  },
  hunters_focus: {
    id: "hunters_focus", name: "Hunter's Focus", icon: "🎯", unlock: 7, cd: 18, mana: 14, range: 0,
    tags: ["proj"], targeted: false,
    buff: { dur: 12, name: "Hunter's Focus", mods: (l) => [{ stat: "critCh", v: 10 + l * 2 }, { stat: "atkSpdPct", v: 10 + l * 2 }] },
    desc: "Steady breath: crit chance and attack speed for 12s.", per3: "+1s duration",
  },
  rain_of_arrows: {
    id: "rain_of_arrows", name: "Rain of Arrows", icon: "🌧️", unlock: 10, cd: 9, mana: 18, range: 22,
    tags: ["proj"], element: "phys", weaponMult: 1.1, flat: (l) => 6 + l * 3,
    delay: { time: 0.8, radius: 4.5 },
    desc: "Arrows blanket the target area after a beat.", per3: "+0.4m radius",
  },
  skyfall_volley: {
    id: "skyfall_volley", name: "Skyfall Volley", icon: "🌠", unlock: 13, cd: 11, mana: 20, range: 22,
    tags: ["proj"], element: "phys", weaponMult: 1.5, flat: (l) => 6 + l * 3.5,
    proj: { speed: 34, count: 3, spreadDeg: 8 }, execBelow: 0.35, execMult: 1.8,
    desc: "A concentrated volley; bonus damage to weakened prey.", per3: "+1 arrow",
  },
};

export const SKILL_MAX_LEVEL = 10;
export const SKILL_LEVEL_DMG = 0.12; // +12% effectiveness per level past 1
export const UNLOCK_LEVELS = [1, 1, 4, 7, 10, 13];

// Augment runes: PoE-style support gems. Each skill has 2 sockets
// (2nd unlocks at skill level 5). All effects are trade-offs.
export const AUGMENTS = {
  echo:       { id: "echo",       name: "Echo",       icon: "🔁", text: "Skill repeats once at 40% damage. +25% mana cost." },
  overwhelm:  { id: "overwhelm",  name: "Overwhelm",  icon: "🔨", text: "+35% damage. +20% cooldown." },
  swiftness:  { id: "swiftness",  name: "Swiftness",  icon: "🕊️", text: "-25% cooldown. -15% damage." },
  splinter:   { id: "splinter",   name: "Splinter",   icon: "🧩", text: "Hits splinter to 2 extra nearby targets at 45% damage." },
  immolate:   { id: "immolate",   name: "Immolate",   icon: "🔥", text: "40% of damage added as fire. Hits can ignite (25%)." },
  permafrost: { id: "permafrost", name: "Permafrost", icon: "❄️", text: "30% of damage added as cold. Always chills." },
  storming:   { id: "storming",   name: "Storming",   icon: "⚡", text: "30% of damage added as lightning. +15% shock chance." },
  leeching:   { id: "leeching",   name: "Leeching",   icon: "🩸", text: "Heal for 4% of skill damage dealt." },
  thrift:     { id: "thrift",     name: "Thrift",     icon: "🪙", text: "-40% mana cost. -10% damage." },
  colossus:   { id: "colossus",   name: "Colossus",   icon: "💥", text: "+40% area of effect." },
  precision:  { id: "precision",  name: "Precision",  icon: "🎯", text: "+15% crit chance for this skill." },
  brutality:  { id: "brutality",  name: "Brutality",  icon: "🐺", text: "+50% crit multiplier. -10% damage." },
};
export const AUGMENT_IDS = Object.keys(AUGMENTS);
