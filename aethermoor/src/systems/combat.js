// Combat: skill execution (with augment + keystone interactions), damage
// resolution, mob AI + boss phases, statuses, XP and death.

import { G, xpToLevel, save } from "../core/state.js";
import { SKILLS, AUGMENTS, SKILL_LEVEL_DMG } from "../data/classes.js";
import { SPECIES, MOB_RESPAWN_S } from "../data/mobs.js";
import { rng } from "../core/rng.js";
import { emit } from "../core/events.js";
import { computeStats, addBuff, damageIncreases } from "./stats.js";
import { rollDrops, goldFor } from "./loot.js";
import { onKill, onQuestKillDrop } from "./quests.js";

export const GCD = 0.6;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function mobMaxHp(sp, lvl) { return Math.round((26 + 15 * lvl) * sp.hpMult); }
export function mobDmg(sp, lvl) { return (3 + 2.4 * lvl) * sp.dmgMult; }

// ---------- effective skill (def + level + augments) ----------
export function skillInstance(skillId) {
  const def = SKILLS[skillId];
  const st = G.player.skills[skillId];
  const lvl = st?.level || 1;
  const augs = (st?.augments || []).filter(Boolean);
  const has = (a) => augs.includes(a);

  const inst = {
    def, lvl, augs,
    name: def.name, icon: def.icon,
    tags: def.tags, element: def.element || "phys",
    range: def.range, targeted: def.targeted !== false && !def.aoe?.shape?.startsWith?.("self"),
    dmgMult: 1 + SKILL_LEVEL_DMG * (lvl - 1),
    cd: def.cd, mana: def.mana,
    aoeScale: 1, critChBonus: 0, critMultBonus: 0,
    echo: has("echo"), splinter: has("splinter"), leech: has("leeching") ? 4 : 0,
    ignite: def.ignite || 0, chill: def.chill || 0, shock: def.shock || 0, stun: def.stun || 0,
    convert: [], // [{element, frac}]
  };
  if (def.aoe || def.splash || def.delay) inst.aoe = true;
  if (def.targeted === false) inst.targeted = false;

  // per-3-level scalers
  const t3 = Math.floor((lvl - 1) / 3);
  inst.arcBonus = t3 * 12; inst.radiusBonus = t3 * 0.4; inst.chainBonus = def.chain ? t3 : 0;
  inst.projBonus = (def.id === "skyfall_volley" || def.id === "split_arrow") && false ? 0 : 0;
  if (def.id === "heavy_strike") inst.stun += t3 * 0.1;
  if (def.id === "fireball") inst.ignite += t3 * 0.1;
  if (def.id === "executioners_call") { }
  if (def.id === "skyfall_volley") inst.extraProj = t3;
  if (def.id === "chain_spark") inst.chainBonus = t3;
  if (def.id === "lunge") inst.range += t3 * 2;
  if (def.dot) inst.dotDur = def.dot.dur + (def.id === "serpent_sting" ? t3 : 0);
  if (def.buff) inst.buffDur = def.buff.dur + t3;

  for (const a of augs) {
    switch (a) {
      case "overwhelm": inst.dmgMult *= 1.35; inst.cd *= 1.2; break;
      case "swiftness": inst.cd *= 0.75; inst.dmgMult *= 0.85; break;
      case "thrift": inst.mana *= 0.6; inst.dmgMult *= 0.9; break;
      case "echo": inst.mana *= 1.25; break;
      case "colossus": inst.aoeScale *= 1.4; break;
      case "precision": inst.critChBonus += 15; break;
      case "brutality": inst.critMultBonus += 50; inst.dmgMult *= 0.9; break;
      case "immolate": inst.convert.push({ element: "fire", frac: 0.4 }); inst.ignite = Math.max(inst.ignite, 0.25); break;
      case "permafrost": inst.convert.push({ element: "cold", frac: 0.3 }); inst.chill = 1; break;
      case "storming": inst.convert.push({ element: "light", frac: 0.3 }); inst.shock += 0.15; break;
    }
  }
  if (G.stats.specials.has("archmage")) inst.mana *= 1.3;
  inst.aoeScale *= 1 + (G.stats.agg.aoePct || 0) / 100;
  return inst;
}

// ---------- damage roll ----------
function rollSkillDamage(inst) {
  const s = G.stats;
  const wep = s.weapon;
  const isSpell = inst.tags.includes("spell");
  const wroll = rng.float(wep.min, wep.max);
  const gearFlatMult = isSpell ? 0.5 : 1;
  const g = (k) => s.agg[k] || 0;

  const buckets = { phys: 0, fire: 0, cold: 0, light: 0 };
  const base = (wroll * (inst.def.weaponMult || 1) + (inst.def.flat ? inst.def.flat(inst.lvl) : 0)) * inst.dmgMult;
  buckets[inst.element] += base;
  buckets.phys += g("flatPhys") * gearFlatMult * inst.dmgMult;
  buckets.fire += g("flatFire") * gearFlatMult * inst.dmgMult;
  buckets.cold += g("flatCold") * gearFlatMult * inst.dmgMult;
  buckets.light += g("flatLight") * gearFlatMult * inst.dmgMult;

  // augment conversions: add % of current total as element
  const totalPre = buckets.phys + buckets.fire + buckets.cold + buckets.light;
  for (const c of inst.convert) buckets[c.element] += totalPre * c.frac;

  if (s.specials.has("stormsoul")) {
    const t = buckets.phys + buckets.fire + buckets.cold + buckets.light;
    buckets.phys = buckets.fire = buckets.cold = 0;
    buckets.light = t;
  }

  // increases
  const shared = damageIncreases(inst.tags) / 100;
  const elemInc = { phys: g("physDmgPct"), fire: g("fireDmgPct"), cold: g("coldDmgPct"), light: g("lightDmgPct") };
  for (const k of Object.keys(buckets)) buckets[k] *= (1 + shared) * (1 + elemInc[k] / 100);

  // crit
  let crit = false;
  const critCh = Math.min(90, s.critCh + inst.critChBonus);
  let critMult = (s.critMult + inst.critMultBonus) / 100;
  if (s.specials.has("deadeye")) critMult += 1;
  if (rng.chance(critCh / 100)) {
    crit = true;
    for (const k of Object.keys(buckets)) buckets[k] *= critMult;
  } else if (s.specials.has("deadeye")) {
    for (const k of Object.keys(buckets)) buckets[k] *= 0.7;
  }
  return { buckets, crit };
}

function mitigateForMob(mob, buckets) {
  const res = mob.species.resists || {};
  let total = 0;
  for (const [k, v] of Object.entries(buckets)) total += v * (1 - (res[k] || 0) / 100);
  if (mob.statuses.shock > G.now) total *= 1.15;
  return Math.max(1, Math.round(total));
}

export function hitMob(mob, inst, dmgRoll = null, scale = 1) {
  if (!mob || mob.dead) return 0;
  const roll = dmgRoll || rollSkillDamage(inst);
  const buckets = {};
  for (const k of Object.keys(roll.buckets)) buckets[k] = roll.buckets[k] * scale;

  // execute bonus
  if (inst.def?.execBelow) {
    const thr = inst.def.execBelow + Math.floor((inst.lvl - 1) / 3) * 0.05 * (inst.def.id === "executioners_call" ? 1 : 0);
    if (mob.hp / mob.maxHp < thr) for (const k of Object.keys(buckets)) buckets[k] *= inst.def.execMult;
  }

  const dmg = mitigateForMob(mob, buckets);
  mob.hp -= dmg;
  aggro(mob);
  emit("floater", { x: mob.pos.x, z: mob.pos.z, y: mob.species.size * 1.6 + 0.6, text: String(dmg), cls: roll.crit ? "crit" : elemClass(buckets) });
  emit("sfx", { type: "hit", element: dominantElem(buckets), crit: roll.crit });

  // statuses
  if (inst.chill >= 1 || (buckets.cold > 0 && rng.chance(0.25))) {
    const durMult = 1 + (G.stats.agg.chillDurPct || 0) / 100;
    mob.statuses.chill = Math.max(mob.statuses.chill, G.now + 2 * durMult);
  }
  const igniteCh = inst.ignite + (G.stats.agg.ignitePct || 0) / 100;
  if (buckets.fire > 0 && rng.chance(igniteCh)) igniteMob(mob, dmg * 0.5 / 4);
  const shockCh = inst.shock + (G.stats.agg.shockPct || 0) / 100;
  if (buckets.light > 0 && rng.chance(shockCh)) mob.statuses.shock = Math.max(mob.statuses.shock, G.now + 3);
  if (inst.stun > 0 && rng.chance(inst.stun) && !mob.species.boss) mob.statuses.stun = Math.max(mob.statuses.stun, G.now + 1.2);

  // dot skills (venom)
  if (inst.def?.dot) {
    const frac = inst.def.dot.frac * (1 + (G.stats.agg.dotDmgPct || 0) / 100);
    mob.dots.push({ dps: (dmg * frac) / inst.dotDur, until: G.now + inst.dotDur, tickAt: G.now + 1 });
  }

  // leech
  const leech = (G.stats.leechPct + (inst.leech || 0) + (G.stats.specials.has("soulthief") ? 2 : 0)) / 100;
  if (leech > 0) healPlayer(dmg * leech, false);

  // splinter: relay reduced hit to 2 nearby untouched enemies
  if (inst.splinter && scale === 1) {
    const near = livingMobs().filter((m) => m !== mob && dist(m.pos, mob.pos) < 6).slice(0, 2);
    for (const m of near) hitMob(m, inst, roll, 0.45);
  }

  if (mob.hp <= 0) killMob(mob);
  return dmg;
}

function elemClass(buckets) {
  const d = dominantElem(buckets);
  return d === "phys" ? "phys" : d;
}
function dominantElem(buckets) {
  let best = "phys", bv = -1;
  for (const [k, v] of Object.entries(buckets)) if (v > bv) { bv = v; best = k; }
  return best;
}

export function igniteMob(mob, dps) {
  mob.statuses.ignite = { until: G.now + 4, dps: Math.max(dps, mob.statuses.ignite?.dps || 0), tickAt: G.now + 1 };
  if (G.stats.specials.has("igniteSpread")) {
    for (const m of livingMobs()) {
      if (m !== mob && dist(m.pos, mob.pos) < 4.5 && !m.statuses.ignite) {
        m.statuses.ignite = { until: G.now + 4, dps: dps * 0.8, tickAt: G.now + 1 };
        aggro(m);
      }
    }
  }
}

export function livingMobs() { return G.mobs.filter((m) => !m.dead); }

function aggro(mob) {
  if (mob.dead || mob.state === "aggro") return;
  mob.state = "aggro";
  // pack assist
  for (const m of livingMobs()) {
    if (m !== mob && m.species.id === mob.species.id && dist(m.pos, mob.pos) < 8 && m.state !== "aggro" && m.species.aggressive) {
      m.state = "aggro";
    }
  }
}

// ---------- casting ----------
export function canUse(skillId) {
  const p = G.player;
  const inst = skillInstance(skillId);
  if (G.now < (G.cooldowns[skillId] || 0)) return { ok: false, why: "cooldown" };
  if (G.now < G.gcdUntil) return { ok: false, why: "gcd" };
  const bloodPact = G.stats.specials.has("bloodPact");
  if (!bloodPact && p.mp < inst.mana) return { ok: false, why: "Not enough mana" };
  if (bloodPact && p.hp <= inst.mana) return { ok: false, why: "Not enough life" };
  if (inst.targeted && inst.def.range > 0) {
    if (!G.target || G.target.dead) return { ok: false, why: "No target" };
    if (dist(G.player.pos, G.target.pos) > inst.range + 0.5) return { ok: false, why: "Out of range" };
  }
  return { ok: true, inst };
}

export function useSkill(skillId) {
  const chk = canUse(skillId);
  if (!chk.ok) {
    if (chk.why && chk.why !== "cooldown" && chk.why !== "gcd") emit("uiError", chk.why);
    return false;
  }
  const inst = chk.inst;
  const p = G.player;

  // cost
  let free = G.stats.specials.has("freeCast") && rng.chance(0.1);
  if (!free) {
    if (G.stats.specials.has("bloodPact")) p.hp = Math.max(1, p.hp - inst.mana);
    else p.mp -= inst.mana;
  }
  G.cooldowns[skillId] = G.now + inst.cd;
  G.gcdUntil = G.now + GCD;
  G.autoAttack = true;
  emit("sfx", { type: "cast", tags: inst.tags, element: inst.element });
  emit("skillUsed", { skillId });

  const doCast = (scale = 1) => execSkillEffect(inst, scale);
  doCast(1);
  if (inst.echo) setTimeout(() => { if (!G.dead) execSkillEffect(inst, 0.4); }, 350);
  return true;
}

function playerAim() {
  if (G.target && !G.target.dead) {
    const t = G.target.pos;
    return Math.atan2(t.x - G.player.pos.x, t.z - G.player.pos.z);
  }
  return G.player.facing;
}

function execSkillEffect(inst, scale) {
  const p = G.player;
  const def = inst.def;

  if (def.buff) {
    addBuff(def.buff.name, def.icon, inst.buffDur, def.buff.mods(inst.lvl));
    emit("floater", { x: p.pos.x, z: p.pos.z, y: 2.4, text: def.buff.name + "!", cls: "buff" });
    return;
  }

  if (def.dash && G.target && !G.target.dead) {
    const t = G.target.pos;
    const d = dist(p.pos, t);
    const keep = 2.2;
    if (d > keep) {
      const f = (d - keep) / d;
      p.pos.x += (t.x - p.pos.x) * f;
      p.pos.z += (t.z - p.pos.z) * f;
    }
    p.facing = Math.atan2(t.x - p.pos.x, t.z - p.pos.z);
    hitMob(G.target, inst, null, scale);
    emit("dashed", {});
    return;
  }

  if (def.delay) {
    const center = G.target && !G.target.dead ? { ...G.target.pos } : { ...p.pos };
    const radius = (def.delay.radius + inst.radiusBonus) * inst.aoeScale;
    G.telegraphs.push({
      pos: center, radius, at: G.now + def.delay.time, friendly: true,
      inst, scale, element: inst.element,
    });
    return;
  }

  if (def.proj) {
    const count = (def.proj.count || 1) + (inst.extraProj || 0) + (G.stats.specials.has("extraProj") && inst.tags.includes("proj") ? 1 : 0);
    const spread = ((def.proj.spreadDeg || 0) + (def.id === "split_arrow" ? Math.floor((inst.lvl - 1) / 3) * 4 : 0)) * Math.PI / 180;
    const aim = playerAim();
    const roll = rollSkillDamage(inst);
    for (let i = 0; i < count; i++) {
      const off = count > 1 ? (i / (count - 1) - 0.5) * (spread || 0.24) : 0;
      G.projectiles.push({
        pos: { x: p.pos.x, z: p.pos.z }, y: 1.2,
        dir: aim + off, speed: def.proj.speed,
        inst, roll: i === 0 ? roll : null, scale,
        pierce: !!def.proj.pierce, chain: (def.chain || 0) + inst.chainBonus,
        splash: def.splash ? def.splash * inst.aoeScale : 0,
        hit: new Set(), ttl: G.now + 1.6, element: inst.element, friendly: true,
      });
    }
    return;
  }

  if (def.aoe) {
    const radius = (def.aoe.radius + inst.radiusBonus) * inst.aoeScale;
    const arc = ((def.aoe.angle || 360) + (def.id === "cleave" ? inst.arcBonus : 0)) * Math.PI / 180;
    const aim = playerAim();
    const roll = rollSkillDamage(inst);
    emit("aoeFx", { x: p.pos.x, z: p.pos.z, radius, arc, aim, element: inst.element, shape: def.aoe.shape });
    for (const m of livingMobs()) {
      const d = dist(p.pos, m.pos);
      if (d > radius) continue;
      if (def.aoe.shape === "arc") {
        const ang = Math.atan2(m.pos.x - p.pos.x, m.pos.z - p.pos.z);
        let delta = Math.abs(ang - aim); if (delta > Math.PI) delta = 2 * Math.PI - delta;
        if (delta > arc / 2) continue;
      }
      hitMob(m, inst, roll, scale);
    }
    return;
  }

  // plain targeted hit
  if (G.target && !G.target.dead) {
    G.player.facing = playerAim();
    hitMob(G.target, inst, null, scale);
  }
}

// ---------- auto attack ----------
let nextAutoAt = 0;
export function autoAttackRange() {
  const cid = G.player.classId;
  return cid === "blademaster" ? 3.2 : cid === "windrunner" ? 20 : 17;
}

export function tickAutoAttack() {
  if (!G.autoAttack || G.dead) return;
  const t = G.target;
  if (!t || t.dead) return;
  if (G.now < nextAutoAt || G.now < G.gcdUntil - 0.35) return;
  const range = autoAttackRange();
  if (dist(G.player.pos, t.pos) > range) return;
  nextAutoAt = G.now + 1 / Math.max(0.3, G.stats.atkSpd);
  G.player.facing = playerAim();

  const cid = G.player.classId;
  const tags = cid === "blademaster" ? ["melee"] : cid === "arcanist" ? ["spell", "proj"] : ["proj"];
  const inst = {
    def: { weaponMult: 1, flat: () => 0 }, lvl: 1, tags, element: "phys",
    dmgMult: 1, convert: [], critChBonus: 0, critMultBonus: 0,
    chill: 0, ignite: 0, shock: 0, stun: 0, leech: 0, aoeScale: 1,
  };
  emit("sfx", { type: "auto", tags });
  if (cid === "blademaster") {
    hitMob(t, inst);
    emit("swingFx", {});
  } else {
    G.projectiles.push({
      pos: { x: G.player.pos.x, z: G.player.pos.z }, y: 1.2,
      dir: playerAim(), speed: 30, inst, roll: null, scale: 1,
      pierce: false, chain: 0, splash: 0, hit: new Set(), ttl: G.now + 1.2,
      element: cid === "arcanist" ? "light" : "phys", friendly: true, small: true,
    });
  }
}

// ---------- potions ----------
export function usePotion(typeId) {
  const p = G.player;
  if (G.now < G.potCdUntil || G.dead) return;
  if ((p.potions[typeId] || 0) <= 0) { emit("uiError", "No potions left — Poppy sells them."); return; }
  p.potions[typeId]--;
  G.potCdUntil = G.now + 8;
  if (typeId === "hp_potion") healPlayer(G.stats.maxHp * 0.4, true);
  else { p.mp = Math.min(G.stats.maxMp, p.mp + G.stats.maxMp * 0.4); emit("floater", { x: p.pos.x, z: p.pos.z, y: 2.4, text: "+Mana", cls: "mana" }); }
  emit("sfx", { type: "potion" });
  emit("hudDirty");
}

export function healPlayer(amount, show = true) {
  const p = G.player;
  const before = p.hp;
  p.hp = Math.min(G.stats.maxHp, p.hp + amount);
  if (show && p.hp - before >= 1) emit("floater", { x: p.pos.x, z: p.pos.z, y: 2.4, text: `+${Math.round(p.hp - before)}`, cls: "heal" });
}

// ---------- player damage ----------
export function damagePlayer(mob, raw, element = "phys") {
  if (G.dead) return;
  const s = G.stats;
  if (rng.chance(s.evasion / 100)) {
    emit("floater", { x: G.player.pos.x, z: G.player.pos.z, y: 2.2, text: "Dodge!", cls: "dodge" });
    return;
  }
  let dmg = raw * rng.float(0.85, 1.15);
  let crit = false;
  if (!s.specials.has("noCrit") && rng.chance(0.05)) { dmg *= 1.5; crit = true; }
  if (element === "phys") {
    const red = Math.min(0.75, s.armor / (s.armor + 300 + 20 * mob.level));
    dmg *= 1 - red;
  } else {
    const res = element === "fire" ? s.fireRes : element === "cold" ? s.coldRes : s.lightRes;
    dmg *= 1 - res / 100;
  }
  dmg *= 1 + (s.agg.physTakenPct || 0) / 100;
  dmg = Math.max(1, Math.round(dmg));
  G.player.hp -= dmg;
  emit("floater", { x: G.player.pos.x, z: G.player.pos.z, y: 2.2, text: `-${dmg}`, cls: crit ? "takencrit" : "taken" });
  emit("sfx", { type: "hurt" });
  emit("playerHurt");
  emit("hudDirty");

  if (element === "cold" && !s.specials.has("juggernaut")) G.playerChillUntil = G.now + 1.5;
  if (s.specials.has("thornweave") && element === "phys" && dist(mob.pos, G.player.pos) < 4) {
    mob.hp -= Math.round(dmg * 0.3);
    if (mob.hp <= 0) killMob(mob);
  }
  if (G.player.hp <= 0) playerDie();
}

function playerDie() {
  G.player.hp = 0;
  G.dead = true;
  G.autoAttack = false;
  G.player.deaths++;
  // XP penalty: 5% of current level's requirement, floored at level start
  const p = G.player;
  const penalty = Math.round(xpToLevel(p.level) * 0.05);
  p.xp = Math.max(0, p.xp - penalty);
  emit("playerDied", { penalty });
  emit("sfx", { type: "die" });
}

export function respawnPlayer() {
  const p = G.player;
  p.pos = { x: 4, z: 124 };
  p.hp = G.stats.maxHp;
  p.mp = G.stats.maxMp;
  G.dead = false;
  G.target = null;
  G.moveTarget = null;
  emit("respawned");
  save();
}

// ---------- XP ----------
export function awardXp(amount) {
  const p = G.player;
  p.xp += Math.round(amount);
  let leveled = false;
  while (p.xp >= xpToLevel(p.level)) {
    p.xp -= xpToLevel(p.level);
    p.level++;
    p.skillPoints++;
    p.passivePoints++;
    leveled = true;
  }
  if (leveled) {
    computeStats();
    p.hp = G.stats.maxHp;
    p.mp = G.stats.maxMp;
    emit("levelUp", { level: p.level });
    emit("sfx", { type: "levelup" });
    emit("floater", { x: p.pos.x, z: p.pos.z, y: 2.8, text: "LEVEL UP!", cls: "levelup" });
  }
  emit("hudDirty");
}

export function xpForKill(mob) {
  const base = 12 * mob.level * mob.species.xpMult;
  const diff = G.player.level - mob.level;
  let mult = 1;
  if (diff >= 8) mult = 0.1;
  else if (diff > 4) mult = 1 - ((diff - 4) / 4) * 0.9;
  else if (diff < 0) mult = Math.min(1.5, 1 + Math.abs(diff) * 0.05);
  return base * mult;
}

// ---------- mob death ----------
export function killMob(mob) {
  if (mob.dead) return;
  mob.dead = true;
  mob.hp = 0;
  mob.deadAt = G.now;
  mob.respawnAt = G.now + (mob.species.respawn || MOB_RESPAWN_S);
  if (G.target === mob) { G.target = null; emit("targetChanged"); }
  G.player.kills[mob.species.id] = (G.player.kills[mob.species.id] || 0) + 1;

  awardXp(xpForKill(mob));
  const gold = goldFor(mob.level, mob.species.boss);
  G.player.gold += gold;
  emit("floater", { x: mob.pos.x, z: mob.pos.z, y: 1.4, text: `+${gold}g`, cls: "gold" });

  const drops = rollDrops(mob.level, mob.species.dropTier, mob.species.boss);
  for (const item of drops) {
    const ang = rng.float(0, Math.PI * 2), r = rng.float(0.6, 2.2);
    G.drops.push({
      item, pos: { x: mob.pos.x + Math.sin(ang) * r, z: mob.pos.z + Math.cos(ang) * r },
      at: G.now, despawnAt: G.now + 120,
    });
  }
  onKill(mob);
  onQuestKillDrop(mob);
  emit("mobDied", mob);
  emit("sfx", { type: "mobdie", boss: !!mob.species.boss });

  if (mob.species.boss) {
    G.player.bossKilled = true;
    emit("bossKilled", mob);
  }
}

// ---------- AI ----------
export function tickMobs(dt) {
  const p = G.player;
  for (const mob of G.mobs) {
    if (mob.dead) {
      if (mob.species.noRespawn) continue;
      if (G.now >= mob.respawnAt) respawnMob(mob);
      continue;
    }
    const sp = mob.species;
    const st = mob.statuses;
    const stunned = st.stun > G.now;
    const chillMult = st.chill > G.now ? 0.8 : 1;

    // dots
    if (st.ignite && st.ignite.until > G.now && G.now >= st.ignite.tickAt) {
      st.ignite.tickAt = G.now + 1;
      const d = Math.max(1, Math.round(st.ignite.dps));
      mob.hp -= d;
      emit("floater", { x: mob.pos.x, z: mob.pos.z, y: sp.size * 1.6 + 0.4, text: String(d), cls: "fire" });
      if (mob.hp <= 0) { killMob(mob); continue; }
    }
    for (let i = mob.dots.length - 1; i >= 0; i--) {
      const dot = mob.dots[i];
      if (G.now >= dot.tickAt) {
        dot.tickAt = G.now + 1;
        const d = Math.max(1, Math.round(dot.dps));
        mob.hp -= d;
        emit("floater", { x: mob.pos.x, z: mob.pos.z, y: sp.size * 1.6 + 0.4, text: String(d), cls: "poison" });
        if (mob.hp <= 0) { killMob(mob); break; }
      }
      if (dot.until <= G.now) mob.dots.splice(i, 1);
    }
    if (mob.dead) continue;

    const dP = dist(mob.pos, p.pos);
    const dHome = dist(mob.pos, mob.spawn);

    // boss phases
    if (sp.boss) tickBoss(mob, dP);

    switch (mob.state) {
      case "idle": {
        if (sp.aggressive && !G.dead && dP < 11 && !inTown(p.pos)) { aggro(mob); break; }
        // wander
        if (!mob.wanderTo || dist(mob.pos, mob.wanderTo) < 0.5) {
          if (rng.chance(0.008)) {
            const a = rng.float(0, Math.PI * 2), r = rng.float(1, mob.homeR * 0.7);
            mob.wanderTo = { x: mob.spawn.x + Math.sin(a) * r, z: mob.spawn.z + Math.cos(a) * r };
          }
        } else if (!stunned) {
          moveToward(mob, mob.wanderTo, sp.speed * 0.4 * chillMult * dt);
        }
        break;
      }
      case "aggro": {
        if (G.dead || dHome > (sp.boss ? 40 : 32) || inTown(p.pos)) { mob.state = "return"; break; }
        const atkRange = sp.ranged ? 13 : 1.6 + sp.size * 0.6;
        if (dP > atkRange && !stunned) {
          moveToward(mob, p.pos, sp.speed * chillMult * dt);
        } else if (!stunned && G.now >= mob.atkReady) {
          mob.atkReady = G.now + (sp.boss ? 1.8 : 2.1);
          if (sp.ranged) {
            const dir = Math.atan2(p.pos.x - mob.pos.x, p.pos.z - mob.pos.z);
            G.projectiles.push({
              pos: { x: mob.pos.x, z: mob.pos.z }, y: 1 + sp.size * 0.5, dir, speed: 16,
              mobDmg: mobDmg(sp, mob.level), element: sp.element || "phys",
              friendly: false, ttl: G.now + 2, hit: new Set(),
            });
            emit("sfx", { type: "mobshoot" });
          } else {
            emit("mobSwing", mob);
            damagePlayer(mob, mobDmg(sp, mob.level), sp.element || "phys");
          }
        }
        break;
      }
      case "return": {
        if (dHome < 1.5) { mob.state = "idle"; mob.hp = mob.maxHp; }
        else moveToward(mob, mob.spawn, sp.speed * 1.4 * dt);
        break;
      }
    }
  }
}

function tickBoss(mob, dP) {
  if (mob.phase < 2 && mob.hp / mob.maxHp <= 0.7) {
    mob.phase = 2;
    emit("chat", { channel: "system", text: "Grulmok howls — Duskfang whelps answer the call!" });
    emit("bossPhase", { mob, phase: 2 });
    emit("summonAdds", mob);
  }
  if (mob.phase < 3 && mob.hp / mob.maxHp <= 0.35) {
    mob.phase = 3;
    mob.enraged = true;
    emit("chat", { channel: "system", text: "Grulmok is ENRAGED! Watch the ground!" });
    emit("bossPhase", { mob, phase: 3 });
  }
  if (mob.enraged && mob.state === "aggro" && G.now >= (mob.slamAt || 0)) {
    mob.slamAt = G.now + 6;
    G.telegraphs.push({
      pos: { ...G.player.pos }, radius: 4, at: G.now + 1.5, friendly: false,
      mobDmg: mobDmg(mob.species, mob.level) * 2.2, element: "phys", srcMob: mob,
    });
    emit("sfx", { type: "bossroar" });
  }
}

function moveToward(mob, to, step) {
  const dx = to.x - mob.pos.x, dz = to.z - mob.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const s = Math.min(step, d);
  mob.pos.x += (dx / d) * s;
  mob.pos.z += (dz / d) * s;
  mob.facing = Math.atan2(dx, dz);
}

export function inTown(pos) {
  return Math.hypot(pos.x - 0, pos.z - 122) < 34;
}

function respawnMob(mob) {
  const sp = mob.species;
  mob.dead = false;
  mob.level = rng.int(sp.lvl[0], sp.lvl[1]);
  mob.maxHp = mobMaxHp(sp, mob.level);
  mob.hp = mob.maxHp;
  mob.state = "idle";
  mob.statuses = { chill: 0, shock: 0, stun: 0, ignite: null };
  mob.dots = [];
  mob.phase = 1;
  mob.enraged = false;
  const a = rng.float(0, Math.PI * 2), r = rng.float(0, mob.homeR * 0.6);
  mob.pos = { x: mob.spawn.x + Math.sin(a) * r, z: mob.spawn.z + Math.cos(a) * r };
  emit("mobRespawned", mob);
}

// ---------- projectiles & telegraphs ----------
export function tickProjectiles(dt) {
  const p = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const pr = G.projectiles[i];
    pr.pos.x += Math.sin(pr.dir) * pr.speed * dt;
    pr.pos.z += Math.cos(pr.dir) * pr.speed * dt;
    let done = G.now > pr.ttl;

    if (pr.friendly) {
      for (const m of livingMobs()) {
        if (pr.hit.has(m.id)) continue;
        if (dist(pr.pos, m.pos) < 0.9 + m.species.size * 0.5) {
          pr.hit.add(m.id);
          const roll = pr.roll || null;
          hitMob(m, pr.inst, roll, pr.scale || 1);
          if (pr.splash) {
            emit("aoeFx", { x: m.pos.x, z: m.pos.z, radius: pr.splash, arc: Math.PI * 2, aim: 0, element: pr.element, shape: "circle" });
            for (const m2 of livingMobs()) {
              if (m2 !== m && !pr.hit.has(m2.id) && dist(m.pos, m2.pos) < pr.splash) {
                pr.hit.add(m2.id);
                hitMob(m2, pr.inst, roll, (pr.scale || 1) * 0.8);
              }
            }
            done = true;
          } else if (pr.chain > 0) {
            const next = livingMobs().filter((m2) => !pr.hit.has(m2.id) && dist(m.pos, m2.pos) < 11)
              .sort((a, b) => dist(m.pos, a.pos) - dist(m.pos, b.pos))[0];
            if (next) {
              pr.chain--;
              pr.pos = { x: m.pos.x, z: m.pos.z };
              pr.dir = Math.atan2(next.pos.x - m.pos.x, next.pos.z - m.pos.z);
              emit("chainFx", { from: m.pos, to: next.pos });
            } else done = true;
          } else if (!pr.pierce) done = true;
          if (done) break;
        }
      }
    } else {
      if (!G.dead && dist(pr.pos, p.pos) < 1.1) {
        damagePlayer({ pos: pr.pos, level: 14 }, pr.mobDmg, pr.element);
        done = true;
      }
    }
    if (done) { pr.dead = true; G.projectiles.splice(i, 1); }
  }
}

export function tickTelegraphs() {
  for (let i = G.telegraphs.length - 1; i >= 0; i--) {
    const t = G.telegraphs[i];
    if (G.now < t.at) continue;
    if (t.friendly) {
      const roll = null;
      emit("aoeFx", { x: t.pos.x, z: t.pos.z, radius: t.radius, arc: Math.PI * 2, aim: 0, element: t.element, shape: "circle", big: true });
      emit("sfx", { type: "impact", element: t.element });
      for (const m of livingMobs()) {
        if (dist(t.pos, m.pos) < t.radius + m.species.size * 0.4) hitMob(m, t.inst, roll, t.scale);
      }
    } else {
      emit("aoeFx", { x: t.pos.x, z: t.pos.z, radius: t.radius, arc: Math.PI * 2, aim: 0, element: "phys", shape: "circle", hostile: true });
      emit("sfx", { type: "impact", element: "phys" });
      if (!G.dead && dist(t.pos, G.player.pos) < t.radius) damagePlayer(t.srcMob || { pos: t.pos, level: 20 }, t.mobDmg, t.element);
    }
    t.dead = true;
    G.telegraphs.splice(i, 1);
  }
}

// ---------- regen ----------
let regenAcc = 0;
export function tickRegen(dt) {
  regenAcc += dt;
  if (regenAcc < 1) return;
  regenAcc -= 1;
  const p = G.player;
  if (G.dead) return;
  p.hp = Math.min(G.stats.maxHp, p.hp + G.stats.hpRegen);
  p.mp = Math.min(G.stats.maxMp, p.mp + G.stats.mpRegen);
  emit("hudDirty");
}
