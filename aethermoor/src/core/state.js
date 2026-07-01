// Global game state. `G` is the single shared object modules attach to; the
// serializable character lives at G.player and persists to localStorage.

import { CLASSES, SKILLS, UNLOCK_LEVELS } from "../data/classes.js";
import { TREE } from "../data/passives.js";

const SAVE_KEY = "aethermoor-save-v1";

export const G = {
  player: null,        // serializable character (below)
  stats: null,         // derived stats cache (systems/stats.js)
  mobs: [],            // live mob entities (world/entities.js)
  npcs: [],
  fakes: [],
  drops: [],           // ground loot
  projectiles: [],
  telegraphs: [],      // ground AoE warnings
  target: null,        // current target (mob entity or null)
  moveTarget: null,    // click-to-move destination {x,z}
  autoAttack: false,
  cooldowns: {},       // skillId -> readyAt (perf.now seconds)
  gcdUntil: 0,
  potCdUntil: 0,
  now: 0,              // sim clock, seconds
  dayT: 0.25,          // 0..1 day cycle
  paused: false,
  dead: false,
  three: {},           // scene, camera, renderer, meshes... (world/scene.js)
  ui: {},              // dom refs
  version: 1,
};

export function xpToLevel(n) { return Math.round(80 * Math.pow(n, 1.9)); }

export function newCharacter(classId, name) {
  const cls = CLASSES[classId];
  const skills = {};
  for (const sid of cls.skills) skills[sid] = { level: 1, augments: [null, null] };
  return {
    name: name || "Adventurer",
    classId,
    level: 1, xp: 0, gold: 60,
    hp: 1, mp: 1, // clamped to max after first stat compute
    pos: { x: 4, z: 124 }, facing: Math.PI,
    skillPoints: 0, passivePoints: 1,
    skills,
    allocated: [TREE.starts[classId].id],
    equipment: { weapon: null, helmet: null, chest: null, gloves: null, boots: null, belt: null, amulet: null, ring1: null, ring2: null },
    bag: Array(40).fill(null),
    potions: { hp_potion: 3, mp_potion: 2 },
    quests: {},   // id -> {status:'active'|'complete'|'done', progress:{}}
    kills: {},
    deaths: 0,
    title: null,
    bossKilled: false,
    playtime: 0,
    createdAt: Date.now(),
  };
}

export function classOf(p = G.player) { return CLASSES[p.classId]; }

export function unlockedSkills(p = G.player) {
  const cls = CLASSES[p.classId];
  return cls.skills.filter((sid, i) => p.level >= UNLOCK_LEVELS[i]).map((sid) => SKILLS[sid]);
}

export function save() {
  if (!G.player) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: G.version, player: G.player, savedAt: Date.now() }));
  } catch { /* storage full/blocked — non-fatal */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.player?.classId || !CLASSES[data.player.classId]) return null;
    return data.player;
  } catch { return null; }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
}

// ---- bag helpers ----
export function bagAdd(item) {
  const bag = G.player.bag;
  if (item.stack) {
    const existing = bag.find((it) => it && it.stack && it.typeId === item.typeId);
    if (existing) { existing.count += item.count || 1; return true; }
  }
  const idx = bag.indexOf(null);
  if (idx === -1) return false;
  bag[idx] = item;
  return true;
}

export function bagRemove(item, count = 1) {
  const bag = G.player.bag;
  const idx = bag.indexOf(item);
  if (idx === -1) return;
  if (item.stack && item.count > count) item.count -= count;
  else bag[idx] = null;
}

export function bagCount(typeId) {
  return G.player.bag.reduce((s, it) => s + (it && it.typeId === typeId ? (it.count || 1) : 0), 0);
}
