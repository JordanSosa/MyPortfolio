// PoE-style tooltips for items and skills.

import { G } from "../core/state.js";
import { RARITIES, BASES, SLOT_NAMES } from "../data/items.js";
import { SKILLS, AUGMENTS } from "../data/classes.js";

const tt = () => document.getElementById("tooltip");

export function showTooltipHtml(html, evt) {
  const el = tt();
  el.innerHTML = html;
  el.style.display = "block";
  positionTooltip(evt);
}

export function positionTooltip(evt) {
  const el = tt();
  if (el.style.display === "none") return;
  const pad = 16;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  const r = el.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export function hideTooltip() { tt().style.display = "none"; }

export function itemTooltipHtml(item, opts = {}) {
  const color = RARITIES[item.rarity]?.color || "#fff";
  const base = item.kind === "equip" ? BASES[item.baseId] : null;
  let h = `<div class="tt-name" style="color:${color}">${item.name}</div>`;
  if (item.kind === "equip") {
    h += `<div class="tt-type">${RARITIES[item.rarity].name} ${base.name} · ${SLOT_NAMES[item.slot] || item.slot} · Item level ${item.ilvl}</div>`;
    if (item.wmin) h += `<div class="tt-imp">Physical Damage: ${item.wmin}–${item.wmax} · Attack Speed: ${item.wspd.toFixed(2)}</div>`;
    if (item.armorImp) h += `<div class="tt-imp">Armor: ${item.armorImp}</div>`;
    if (item.affixes?.length || item.mods?.length || item.special) h += "<hr/>";
    for (const a of item.affixes || []) h += `<div class="tt-affix">${a.text.replace("#", a.value)}</div>`;
    for (const m of item.mods || []) h += `<div class="tt-affix">${modText(m)}</div>`;
    if (item.specialText) h += `<div class="tt-special">${item.specialText}</div>`;
    if (item.flavor) h += `<div class="tt-flavor">“${item.flavor}”</div>`;
  } else {
    h += `<div class="tt-type">${item.kind === "currency" ? "Crafting Currency" : item.kind === "rune" ? "Augment Rune" : item.kind === "potion" ? "Consumable" : "Quest Item"}${item.count > 1 ? ` · ×${item.count}` : ""}</div>`;
    h += `<div>${item.text || ""}</div>`;
  }
  if (opts.footer) h += `<div class="tt-foot">${opts.footer}</div>`;

  // compare with equipped
  if (opts.compare && item.kind === "equip") {
    const slotKey = item.slot === "ring" ? "ring1" : item.slot;
    const eq = G.player.equipment[slotKey];
    if (eq && eq !== item) {
      h += `<hr/><div class="tt-type">Currently equipped:</div>`;
      h += `<div class="tt-name" style="color:${RARITIES[eq.rarity].color};font-size:12px">${eq.name}</div>`;
      if (eq.wmin) h += `<div class="tt-imp">Phys ${eq.wmin}–${eq.wmax} · Spd ${eq.wspd.toFixed(2)}</div>`;
      if (eq.armorImp) h += `<div class="tt-imp">Armor: ${eq.armorImp}</div>`;
      for (const a of eq.affixes || []) h += `<div class="tt-affix">${a.text.replace("#", a.value)}</div>`;
      for (const m of eq.mods || []) h += `<div class="tt-affix">${modText(m)}</div>`;
      if (eq.specialText) h += `<div class="tt-special">${eq.specialText}</div>`;
    }
  }
  return h;
}

const STAT_TEXT = {
  str: "+# to Strength", dex: "+# to Dexterity", int: "+# to Intelligence", vit: "+# to Vitality",
  maxHp: "+# to maximum Life", maxMp: "+# to maximum Mana",
  hpRegen: "+# Life Regenerated per second", mpRegen: "+# Mana Regenerated per second",
  mpRegenPct: "#% increased Mana Regeneration",
  armor: "+# to Armor", armorPct: "#% increased Armor", evasionPct: "+#% to Evasion",
  moveSpdPct: "#% increased Movement Speed", atkSpdPct: "#% increased Attack Speed", castSpdPct: "#% increased Cast Speed",
  critCh: "+#% to Critical Chance", critMult: "+#% to Critical Multiplier",
  fireRes: "+#% to Fire Resistance", coldRes: "+#% to Cold Resistance", lightRes: "+#% to Lightning Resistance",
  dmgPct: "#% increased Damage", meleeDmgPct: "#% increased Melee Damage", projDmgPct: "#% increased Projectile Damage",
  spellDmgPct: "#% increased Spell Damage", physDmgPct: "#% increased Physical Damage",
  fireDmgPct: "#% increased Fire Damage", coldDmgPct: "#% increased Cold Damage", lightDmgPct: "#% increased Lightning Damage",
  aoePct: "#% increased Area of Effect", dotDmgPct: "#% increased Damage over Time",
  flatPhys: "Adds # Physical Damage", flatFire: "Adds # Fire Damage", flatCold: "Adds # Cold Damage", flatLight: "Adds # Lightning Damage",
  leechPct: "#% of Damage Leeched as Life", chillDurPct: "#% increased Chill Duration",
  ignitePct: "+#% chance to Ignite", shockPct: "+#% chance to Shock", physTakenPct: "#% Physical Damage taken",
};

export function modText(m) {
  const t = STAT_TEXT[m.stat] || `# ${m.stat}`;
  const v = m.v > 0 ? m.v : m.v; // sign shown by template below
  return (m.v < 0 ? t.replace("+#", "#").replace("#", String(v)) : t.replace("#", String(v)));
}

export function skillTooltip(sid, unlocked = true, unlockLevel = 1) {
  const def = SKILLS[sid];
  const st = G.player.skills[sid];
  const lvl = st?.level || 1;
  let h = `<div class="tt-name" style="color:#ffe8b0">${def.icon} ${def.name}</div>`;
  h += `<div class="tt-type">Level ${lvl}/10 · ${def.mana ? `${Math.round(def.mana)} mana · ` : ""}${def.cd}s cooldown${def.range ? ` · ${def.range}m range` : ""}</div>`;
  h += `<div>${def.desc}</div>`;
  h += `<div class="tt-affix">+${Math.round((lvl - 1) * 12)}% effectiveness from levels</div>`;
  if (def.per3) h += `<div class="tt-affix">Every 3rd level: ${def.per3}</div>`;
  const augs = (st?.augments || []).filter(Boolean);
  if (augs.length) {
    h += "<hr/>";
    for (const a of augs) h += `<div class="tt-special">${AUGMENTS[a].icon} ${AUGMENTS[a].name} — ${AUGMENTS[a].text}</div>`;
  }
  if (!unlocked) h += `<div class="tt-foot">Unlocks at character level ${unlockLevel}</div>`;
  return h;
}
