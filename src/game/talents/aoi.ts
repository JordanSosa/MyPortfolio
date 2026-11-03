/**
 * AOI's talent tree, literally as docs/content/heroes.md §3: "Payload" /
 * "Armor Plating" / "Thrusters". Weapon / ult parts are read by the weapon and
 * ult code through w.talentRank(id): Extended Magazine, Cluster Warheads and
 * FULL BURST in weapons/micro-missile-swarm.ts; Super Robot Upgrade in
 * ultimates/get-in-the-robot.ts. Jet Dash and Combining Sequence live here.
 */
import { CFG, CH_RELIC } from "../config";
import type { TalentTree } from "../defs";
import { Buff } from "../hooks";
import { PK_MANAGED } from "../types";
import type { World } from "../world";
import { HERO_TEXTS, HFX_AOI_JET, HFX_TEXT, hfx } from "../weapons/_heroes-a";
import { byRank, node } from "./_node";

/** Jet Dash: the dash leaves a flame trail (10 damage every 0.25 s for 1 s; rank 2 +50 %; rank 3 +1 dash charge). */
function jetDash(w: World, r: number): void {
  if (r >= 3) {
    w.player.dashChargesMax++;
    w.player.dashCharges++;
  }
  const k = r >= 2 ? 1.5 : 1;
  let acc = 0;
  w.hooks.on("step", (h) => {
    const p = w.player;
    if (p.dashT <= 0 || w.phase !== "play") {
      acc = 0.04;
      return;
    }
    acc += h.dt;
    if (acc < 0.04) return;
    acc = 0;
    const q = w.spawnProjectile(null, "aoi_jet_dash");
    q.kind = PK_MANAGED;
    q.ch = CH_RELIC;
    q.x = p.x;
    q.y = p.y - 3;
    q.r = 7;
    q.dmg = 10 * k * w.stats.might;
    q.knock = 0;
    q.pierce = Infinity;
    q.hitEvery = 0.25;
    q.life = 1;
    hfx(w, HFX_AOI_JET, q.x, q.y, p.dashDX, p.dashDY, 1);
  });
}

/** Combining Sequence: after GET IN THE ROBOT ends, 10 s of Combined Mode (+30 % might, +1 amount, +20 % move). */
function combining(w: World): void {
  const mode = new Buff(w);
  w.statMods.push((s) => {
    if (!mode.on) return;
    s.might += 0.3;
    s.amount += 1;
    s.moveSpeed += 0.2;
  });
  w.hooks.on("ultEnd", (e) => {
    if (e.id !== "get_in_the_robot") return;
    mode.start(10);
    const p = w.player;
    hfx(w, HFX_TEXT, p.x, p.y - 32, p.x, p.y, 2.4, HERO_TEXTS.indexOf("COMBINED!"));
    hfx(w, HFX_AOI_JET, p.x, p.y - CFG.playerCy, 0, 0, 10, 2);
  });
}

export const aoiTree: TalentTree = {
  hero: "aoi",
  branches: ["Payload", "Armor Plating", "Thrusters"],
  nodes: [
    // ---- Payload
    node("aoi_ammo_racks", "Ammo Racks", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("aoi_magazine", "Extended Magazine", 0, 2, 3, (r) => `Micro Missile Swarm +${r} missile${r > 1 ? "s" : ""}`),
    node("aoi_targeting", "Targeting Computer", 0, 3, 3, (r) => `+${5 * r}% projectile speed`, { mods: (s, r) => void (s.projSpeed += 0.05 * r) }),
    node("aoi_cluster", "Cluster Warheads", 0, 4, 3, (r) => `Missile blast radius +${15 * r}%`),
    node("aoi_full_burst", "FULL BURST", 0, 5, 1, () => 'Every 5th salvo fires twice the missiles in a figure-eight ("FULL BURST!")'),
    // ---- Armor Plating
    node("aoi_hull", "Reinforced Hull", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("aoi_plating", "Plating", 1, 2, 3, (r) => `-${2 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.02 * r) }),
    node("aoi_shock_absorbers", "Shock Absorbers", 1, 3, 3, (r) => `+${(0.1 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.1 * r) }),
    node("aoi_emergency_shield", "Emergency Shield", 1, 4, 3, (r) => `+1 shield charge, recharging every ${byRank([25, 20, 15], r)} s`, {
      mods: (s, r) => {
        s.shield += 1;
        s.shieldCd = Math.min(s.shieldCd, byRank([25, 20, 15], r));
      },
    }),
    node("aoi_super_robot", "Super Robot Upgrade", 1, 5, 1, () => "GET IN THE ROBOT drops 5 fists and the rocket punch comes back like a boomerang"),
    // ---- Thrusters
    node("aoi_boosters", "Boosters", 2, 1, 5, (r) => `+${3 * r}% move speed`, { mods: (s, r) => void (s.moveSpeed += 0.03 * r) }),
    node("aoi_afterburner", "Afterburner", 2, 2, 3, (r) => `-${5 * r}% dash cooldown`, { mods: (s, r) => void (s.dashCd -= 0.05 * r) }),
    node("aoi_hover", "Hover Mode", 2, 3, 3, (r) => `+${8 * r}% pickup range`, { mods: (s, r) => void (s.pickup += 0.08 * r) }),
    node(
      "aoi_jet_dash",
      "Jet Dash",
      2,
      4,
      3,
      (r) => `Dashes leave a flame trail (${r >= 2 ? 15 : 10} damage every 0.25 s for 1 s)${r >= 3 ? ", +1 dash charge" : r === 1 ? " (rank 2: +50% damage, rank 3: +1 dash charge)" : " (rank 3: +1 dash charge)"}`,
      { install: jetDash },
    ),
    node("aoi_combining", "Combining Sequence", 2, 5, 1, () => "After GET IN THE ROBOT ends, 10 s of Combined Mode: +30% might, +1 amount, +20% move speed", {
      install: combining,
    }),
  ],
};

export const talentTrees: TalentTree[] = [aoiTree];
