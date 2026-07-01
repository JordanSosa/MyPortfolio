// Quest tracking: availability, kill/collect progress, turn-in rewards.

import { G, bagAdd, bagCount, save } from "../core/state.js";
import { QUESTS, QUEST_ITEMS } from "../data/quests.js";
import { emit } from "../core/events.js";
import { rng } from "../core/rng.js";
import { makeEquipment, makeCurrency, makeRune, makeUnique, makeQuestItem } from "./loot.js";

export function questState(id) { return G.player.quests[id] || null; }

export function availableFrom(npcId) {
  return QUESTS.filter((q) => {
    if (q.giver !== npcId) return false;
    if (questState(q.id)) return false;
    if (q.requires && questState(q.requires)?.status !== "done") return false;
    return G.player.level >= (q.minLevel || 1);
  });
}

export function turninsFor(npcId) {
  return QUESTS.filter((q) => q.turnin === npcId && questState(q.id)?.status === "complete");
}

export function activeQuests() {
  return QUESTS.filter((q) => {
    const s = questState(q.id);
    return s && s.status !== "done";
  });
}

export function acceptQuest(q) {
  G.player.quests[q.id] = { status: "active", progress: {} };
  // talk quests complete instantly (delivery/intro)
  if (q.type === "talk") G.player.quests[q.id].status = "complete";
  emit("chat", { channel: "system", text: `Quest accepted: ${q.name}` });
  emit("questsChanged");
  emit("sfx", { type: "quest" });
  save();
}

export function questProgressText(q) {
  const s = questState(q.id);
  if (!s) return "";
  if (q.type === "talk") return q.objective;
  if (q.type === "kill" || q.type === "boss") return `${q.objective} (${s.progress[q.target] || 0}/${q.count})`;
  if (q.type === "collect") return `${q.objective} (${Math.min(bagCount(q.target), q.count)}/${q.count})`;
  if (q.type === "multikill") {
    return q.objective + " (" + Object.entries(q.targets).map(([t, c]) => `${s.progress[t] || 0}/${c}`).join(", ") + ")";
  }
  return q.objective;
}

function checkComplete(q) {
  const s = questState(q.id);
  if (!s || s.status !== "active") return;
  let done = false;
  if (q.type === "kill" || q.type === "boss") done = (s.progress[q.target] || 0) >= q.count;
  else if (q.type === "collect") done = bagCount(q.target) >= q.count;
  else if (q.type === "multikill") done = Object.entries(q.targets).every(([t, c]) => (s.progress[t] || 0) >= c);
  if (done) {
    s.status = "complete";
    emit("chat", { channel: "system", text: `Quest complete: ${q.name} — return to ${q.turnin === "maren" ? "Captain Maren" : "Skill Sage Elowen"}.` });
    emit("sfx", { type: "questdone" });
  }
  emit("questsChanged");
}

export function onKill(mob) {
  for (const q of activeQuests()) {
    const s = questState(q.id);
    if (s.status !== "active") continue;
    if ((q.type === "kill" || q.type === "boss") && q.target === mob.species.id) {
      s.progress[q.target] = (s.progress[q.target] || 0) + 1;
      checkComplete(q);
    } else if (q.type === "multikill" && q.targets[mob.species.id] != null) {
      if ((s.progress[mob.species.id] || 0) < q.targets[mob.species.id]) {
        s.progress[mob.species.id] = (s.progress[mob.species.id] || 0) + 1;
        checkComplete(q);
      }
    }
  }
}

// Collect-quest drops: granted straight to the bag with a toast.
export function onQuestKillDrop(mob) {
  for (const q of activeQuests()) {
    const s = questState(q.id);
    if (s.status !== "active" || q.type !== "collect" || q.from !== mob.species.id) continue;
    if (bagCount(q.target) >= q.count) continue;
    if (rng.chance(q.dropChance)) {
      bagAdd(makeQuestItem(q.target));
      emit("chat", { channel: "loot", text: `Obtained: ${QUEST_ITEMS[q.target].name} (${Math.min(bagCount(q.target), q.count)}/${q.count})`, rarity: "uncommon" });
      emit("sfx", { type: "loot", rarity: "normal" });
      checkComplete(q);
    }
  }
}

export function turnIn(q) {
  const s = questState(q.id);
  if (!s || s.status !== "complete") return false;
  const p = G.player;
  const r = q.reward || {};

  // consume collect items
  if (q.type === "collect") {
    let need = q.count;
    for (let i = 0; i < p.bag.length && need > 0; i++) {
      const it = p.bag[i];
      if (it && it.typeId === q.target) {
        const take = Math.min(need, it.count || 1);
        need -= take;
        if ((it.count || 1) > take) it.count -= take;
        else p.bag[i] = null;
      }
    }
  }

  s.status = "done";
  if (r.gold) { p.gold += r.gold; emit("chat", { channel: "loot", text: `Received ${r.gold} gold.`, rarity: "normal" }); }
  if (r.passivePoints) { p.passivePoints += r.passivePoints; emit("chat", { channel: "system", text: `+${r.passivePoints} passive point${r.passivePoints > 1 ? "s" : ""}!` }); }
  const grant = (item) => {
    if (!bagAdd(item)) {
      G.drops.push({ item, pos: { x: p.pos.x + 1, z: p.pos.z + 1 }, at: G.now, despawnAt: G.now + 600 });
      emit("chat", { channel: "system", text: "Bag full — reward dropped at your feet!" });
    } else {
      emit("chat", { channel: "loot", text: `Received: ${item.name}`, rarity: item.rarity });
    }
  };
  if (r.currency) for (const [cid, n] of Object.entries(r.currency)) grant(makeCurrency(cid, n));
  if (r.item) grant(makeEquipment(Math.max(p.level, 4), { rarity: r.item.rarity, slotKind: r.item.slotKind }));
  if (r.augment) grant(makeRune());
  if (r.unique) grant(makeUnique());
  if (r.title) {
    p.title = r.title;
    emit("chat", { channel: "system", text: `You have earned the title <${r.title}>!` });
  }
  emit("questsChanged");
  emit("sfx", { type: "questdone" });
  if (r.xp) {
    // deferred import avoidance: award via event
    emit("awardXp", r.xp);
  }
  save();
  return true;
}
