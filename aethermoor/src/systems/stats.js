// Derived-stat computation. Aggregates mods from class/level, equipment,
// allocated passive nodes, and active buffs into G.stats.

import { G, classOf } from "../core/state.js";
import { TREE } from "../data/passives.js";
import { emit } from "../core/events.js";

export const buffs = []; // live, not serialized: {name, icon, until, mods}

function aggregate() {
  const agg = {};        // stat -> summed value
  const specials = new Set();
  const add = (stat, v) => { agg[stat] = (agg[stat] || 0) + v; };

  // equipment
  for (const item of Object.values(G.player.equipment)) {
    if (!item) continue;
    for (const a of item.affixes || []) add(a.stat, a.value);
    for (const m of item.mods || []) add(m.stat, m.v); // uniques
    if (item.special) specials.add(item.special);
  }
  // passive tree
  for (const id of G.player.allocated) {
    const n = TREE.nodes[id];
    if (!n) continue;
    for (const m of n.mods) add(m.stat, m.v);
    if (n.special) specials.add(n.special);
  }
  // buffs
  for (const b of buffs) for (const m of b.mods) add(m.stat, m.v);
  return { agg, specials };
}

export function computeStats() {
  const p = G.player;
  const cls = classOf(p);
  const { agg, specials } = aggregate();
  const g = (k) => agg[k] || 0;

  const lvlN = p.level - 1;
  const attrs = {
    str: Math.round(cls.baseAttrs.str + cls.perLevel.str * lvlN) + g("str"),
    dex: Math.round(cls.baseAttrs.dex + cls.perLevel.dex * lvlN) + g("dex"),
    int: Math.round(cls.baseAttrs.int + cls.perLevel.int * lvlN) + g("int"),
    vit: Math.round(cls.baseAttrs.vit + cls.perLevel.vit * lvlN) + g("vit"),
  };

  let maxHp = 38 + 12 * p.level + 2 * attrs.str + 5 * attrs.vit + g("maxHp");
  if (specials.has("glassCannon")) maxHp *= 0.7;
  if (specials.has("soulthief")) maxHp *= 0.85;
  maxHp = Math.round(maxHp);

  const maxMp = Math.round(30 + 6 * p.level + 3 * attrs.int + g("maxMp"));

  let mpRegen = (2 + p.level * 0.15 + attrs.int * 0.05 + g("mpRegen")) * (1 + g("mpRegenPct") / 100);
  if (specials.has("archmage")) mpRegen += maxMp / 10;

  let hpRegen = 1 + attrs.vit * 0.2 + g("hpRegen");
  if (specials.has("noRegen")) hpRegen = 0;

  const weapon = p.equipment.weapon;
  const wep = weapon
    ? { min: weapon.wmin, max: weapon.wmax, spd: weapon.wspd }
    : { min: 2, max: 4, spd: 1.15 };

  const stats = {
    attrs, maxHp, maxMp, hpRegen, mpRegen,
    armor: Math.round((g("armor")) * (1 + g("armorPct") / 100)),
    evasion: Math.min(60, 3 + g("evasionPct")),
    moveSpd: 8 * (1 + g("moveSpdPct") / 100),
    atkSpd: wep.spd * (1 + (g("atkSpdPct") + attrs.dex * 0.15) / 100),
    castSpd: 1 + g("castSpdPct") / 100,
    critCh: Math.min(75, 5 + attrs.dex * 0.1 + g("critCh")),
    critMult: 150 + g("critMult"),
    fireRes: Math.min(75, g("fireRes")),
    coldRes: Math.min(75, g("coldRes")),
    lightRes: Math.min(75, g("lightRes")),
    leechPct: g("leechPct"),
    weapon: wep,
    agg, specials,
  };

  G.stats = stats;
  p.hp = Math.min(p.hp, maxHp);
  p.mp = Math.min(p.mp, maxMp);
  emit("statsChanged", stats);
  return stats;
}

export function addBuff(name, icon, dur, mods) {
  const existing = buffs.find((b) => b.name === name);
  if (existing) { existing.until = G.now + dur; existing.mods = mods; }
  else buffs.push({ name, icon, until: G.now + dur, mods });
  computeStats();
}

export function tickBuffs() {
  const before = buffs.length;
  for (let i = buffs.length - 1; i >= 0; i--) if (buffs[i].until <= G.now) buffs.splice(i, 1);
  if (buffs.length !== before) computeStats();
}

// Damage "increase" percentages for a skill's tags, from aggregated mods + attributes.
export function damageIncreases(tags) {
  const { agg, attrs } = G.stats;
  const g = (k) => agg[k] || 0;
  let inc = g("dmgPct");
  if (tags.includes("melee")) inc += g("meleeDmgPct") + attrs.str;
  if (tags.includes("proj")) inc += g("projDmgPct") + attrs.dex;
  if (tags.includes("spell")) inc += g("spellDmgPct") + attrs.int;
  return inc;
}
