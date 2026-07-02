// Player-driven actions shared by UI: equipping, passive allocation, skill
// leveling, augment socketing, vendoring, crafting application.

import { G, bagAdd, bagRemove, save } from "../core/state.js";
import { TREE } from "../data/passives.js";
import { SKILLS, SKILL_MAX_LEVEL, AUGMENTS } from "../data/classes.js";
import { BASES, POTIONS } from "../data/items.js";
import { emit } from "../core/events.js";
import { computeStats } from "./stats.js";
import { applyCurrency, sellValue } from "./loot.js";

// ---- equipment ----
export function equipItem(item) {
  const p = G.player;
  if (item.kind !== "equip") return;
  if (item.slot === "weapon") {
    const usable = BASES[item.baseId].id === (p.classId === "blademaster" ? "sword" : p.classId === "arcanist" ? "staff" : "bow");
    if (!usable) { emit("uiError", `Your class can't wield a ${BASES[item.baseId].name.toLowerCase()}.`); return; }
  }
  let slot = item.slot;
  if (item.slot === "ring") slot = !p.equipment.ring1 ? "ring1" : !p.equipment.ring2 ? "ring2" : "ring1";
  const prev = p.equipment[slot];
  bagRemove(item);
  p.equipment[slot] = item;
  if (prev) bagAdd(prev);
  computeStats();
  emit("inventoryChanged");
  emit("sfx", { type: "equip" });
  save();
}

export function unequipItem(slot) {
  const p = G.player;
  const item = p.equipment[slot];
  if (!item) return;
  if (!bagAdd(item)) { emit("uiError", "Bag is full."); return; }
  p.equipment[slot] = null;
  computeStats();
  emit("inventoryChanged");
  save();
}

// ---- crafting ----
export function craftWith(currencyItem, targetItem) {
  const err = applyCurrency(currencyItem.typeId, targetItem);
  if (err) { emit("uiError", err); emit("sfx", { type: "error" }); return false; }
  bagRemove(currencyItem, 1);
  computeStats(); // in case the item is equipped
  emit("inventoryChanged");
  emit("chat", { channel: "loot", text: `${currencyItem.name} → ${targetItem.name}`, rarity: targetItem.rarity });
  emit("sfx", { type: "craft", rarity: targetItem.rarity });
  save();
  return true;
}

// ---- passives ----
export function nodeAllocatable(nodeId) {
  const p = G.player;
  if (p.passivePoints <= 0) return false;
  if (p.allocated.includes(nodeId)) return false;
  const adj = TREE.adj.get(nodeId);
  return [...adj].some((n) => p.allocated.includes(n));
}

export function allocateNode(nodeId) {
  if (!nodeAllocatable(nodeId)) return false;
  G.player.allocated.push(nodeId);
  G.player.passivePoints--;
  computeStats();
  emit("treeChanged");
  emit("sfx", { type: "allocate" });
  save();
  return true;
}

export const RESPEC_COST = 50;

export function refundNode(nodeId) {
  const p = G.player;
  const node = TREE.nodes[nodeId];
  if (!node || node.kind === "start" || !p.allocated.includes(nodeId)) return false;
  if (p.gold < RESPEC_COST) { emit("uiError", `Refunding costs ${RESPEC_COST} gold.`); return false; }
  // removal must keep every other allocated node connected to the class start
  const remaining = new Set(p.allocated.filter((id) => id !== nodeId));
  const start = TREE.starts[p.classId].id;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    for (const nb of TREE.adj.get(id)) {
      if (remaining.has(nb) && !seen.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  for (const id of remaining) if (!seen.has(id)) { emit("uiError", "That node holds your path together."); return false; }
  p.allocated = [...remaining];
  p.passivePoints++;
  p.gold -= RESPEC_COST;
  computeStats();
  emit("treeChanged");
  save();
  return true;
}

// ---- skills ----
export function levelSkill(skillId) {
  const p = G.player;
  const st = p.skills[skillId];
  if (!st || p.skillPoints <= 0 || st.level >= SKILL_MAX_LEVEL) return false;
  st.level++;
  p.skillPoints--;
  emit("skillsChanged");
  emit("sfx", { type: "allocate" });
  save();
  return true;
}

export const SKILL_REFUND_COST = 30;

export function refundSkill(skillId) {
  const p = G.player;
  const st = p.skills[skillId];
  if (!st || st.level <= 1) return false;
  if (p.gold < SKILL_REFUND_COST) { emit("uiError", `Refunding costs ${SKILL_REFUND_COST} gold.`); return false; }
  if (st.level <= 5 && st.augments[1]) { emit("uiError", "Unsocket the second augment first (needs skill level 5)."); return false; }
  st.level--;
  p.skillPoints++;
  p.gold -= SKILL_REFUND_COST;
  emit("skillsChanged");
  save();
  return true;
}

export function socketRune(skillId, socketIdx, runeItem) {
  const p = G.player;
  const st = p.skills[skillId];
  if (!st) return;
  if (socketIdx === 1 && st.level < 5) { emit("uiError", "Second socket unlocks at skill level 5."); return; }
  // duplicate augment on same skill not allowed
  const aug = runeItem.typeId;
  if (st.augments.includes(aug)) { emit("uiError", "That augment is already socketed here."); return; }
  const prev = st.augments[socketIdx];
  st.augments[socketIdx] = aug;
  bagRemove(runeItem, 1);
  if (prev) bagAdd({ ...runeItem, id: `${runeItem.id}-r`, typeId: prev, count: 1, icon: AUGMENTS[prev].icon, name: `Augment Rune: ${AUGMENTS[prev].name}`, text: AUGMENTS[prev].text });
  emit("skillsChanged");
  emit("inventoryChanged");
  emit("sfx", { type: "equip" });
  save();
}

export function unsocketRune(skillId, socketIdx) {
  const p = G.player;
  const st = p.skills[skillId];
  const aug = st?.augments?.[socketIdx];
  if (!aug) return;
  const a = AUGMENTS[aug];
  if (!bagAdd({ id: `rune-${Date.now()}`, kind: "rune", typeId: aug, count: 1, stack: true, icon: a.icon, name: `Augment Rune: ${a.name}`, text: a.text, rarity: "rare" })) {
    emit("uiError", "Bag is full."); return;
  }
  st.augments[socketIdx] = null;
  emit("skillsChanged");
  emit("inventoryChanged");
  save();
}

// ---- vendor ----
export function buyPotion(typeId, count = 1) {
  const p = G.player;
  const cost = POTIONS[typeId].price * count;
  if (p.gold < cost) { emit("uiError", "Not enough gold."); return; }
  p.gold -= cost;
  p.potions[typeId] = (p.potions[typeId] || 0) + count;
  emit("inventoryChanged");
  emit("sfx", { type: "coin" });
  save();
}

export function sellItem(item) {
  const p = G.player;
  const v = sellValue(item);
  if (v <= 0) { emit("uiError", "Poppy politely declines."); return; }
  bagRemove(item, item.count || 1);
  p.gold += v;
  emit("chat", { channel: "loot", text: `Sold ${item.name} for ${v}g.`, rarity: "normal" });
  emit("inventoryChanged");
  emit("sfx", { type: "coin" });
  save();
}
