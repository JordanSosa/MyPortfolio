/**
 * AKANE's talent tree, literally as docs/content/heroes.md §3: "Tsun" / "Dere"
 * / "Drill Princess". Weapon / ult parts are read by the weapon and ult code
 * through w.talentRank(id): Ricochet Bonk, Harisen of Ultimate Denial and
 * Twin-Tail Tornado in weapons/baka-harisen.ts; Dere Mode in
 * ultimates/not-like-i-like-you.ts.
 */
import { C } from "../../art/palette";
import { CFG } from "../config";
import type { TalentTree } from "../defs";
import { Buff } from "../hooks";
import { proc } from "../relics/_util";
import { PK_FREE, ROT_VELOCITY } from "../types";
import type { World } from "../world";
import { foodBonus } from "../weapons/_heroes-a";
import { Budget, byRank, node } from "./_node";

const DRILL = "akane_drill_breaker";

/** "It's Not Like I Was Worried!": dropping below 30 % HP grants +20 / 35 / 50 % might for 6 s (30 s cooldown). */
function notWorried(w: World, r: number): void {
  const rage = new Buff(w);
  const k = byRank([0.2, 0.35, 0.5], r);
  w.statMods.push((s) => {
    if (rage.on) s.might += k;
  });
  let ready = 0;
  w.hooks.on("hurt", (h) => {
    const p = w.player;
    if (w.t < ready || h.hp <= 0 || h.hp >= p.maxHp * 0.3) return;
    ready = w.t + 30;
    rage.start(6);
    proc(w, "akane_not_worried", p.x, p.y - CFG.playerCy, 6);
  });
}

/** Drill Launcher: Akane's crits have a 20 / 30 / 40 % chance to launch a drill (pierce ∞, 30 damage, 200 px/s). */
function drillBreaker(w: World, r: number): void {
  const chance = byRank([0.2, 0.3, 0.4], r);
  const budget = new Budget(6);
  w.hooks.on("hit", (h) => {
    if (!h.crit || h.source === DRILL || w.rng.next() >= chance || !budget.take(w)) return;
    const e = h.enemy;
    const p = w.player;
    const sx = p.x;
    const sy = p.y - CFG.playerCy;
    const a = Math.atan2(e.y - e.cy - sy, e.x - sx);
    const sp = 200 * w.stats.projSpeed;
    const q = w.spawnProjectile(null, DRILL);
    q.kind = PK_FREE;
    q.x = sx;
    q.y = sy;
    q.speed = sp;
    q.vx = Math.cos(a) * sp;
    q.vy = Math.sin(a) * sp;
    q.r = 5;
    q.dmg = 30 * w.stats.might;
    q.knock = 80;
    q.pierce = Infinity;
    q.life = 1.2;
    q.sprite = "fx_streak";
    q.scale = 1.3;
    q.tint = C.orange;
    q.rotMode = ROT_VELOCITY;
    q.glow = true;
    q.trail = "drill";
  });
}

export const akaneTree: TalentTree = {
  hero: "akane",
  branches: ["Tsun", "Dere", "Drill Princess"],
  nodes: [
    // ---- Tsun
    node("akane_wind_up", "Wind-Up", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("akane_heavy_paper", "Heavy Paper", 0, 2, 3, (r) => `+${10 * r}% knockback`, { mods: (s, r) => void (s.knock += 0.1 * r) }),
    node("akane_quick_temper", "Quick Temper", 0, 3, 3, (r) => `-${3 * r}% cooldown`, { mods: (s, r) => void (s.cooldown -= 0.03 * r) }),
    node("akane_ricochet", "Ricochet Bonk", 0, 4, 3, (r) => `Knocked enemies that collide with others deal +${20 * r}% of the hit as collision damage`),
    node("akane_ultimate_denial", "Harisen of Ultimate Denial", 0, 5, 1, () => "Baka Harisen smacks in 3 directions (forward and ±60°)"),
    // ---- Dere
    node("akane_secretly_caring", "Secretly Caring", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("akane_not_for_you", "Bento (Not For You)", 1, 2, 3, (r) => `Food heals +${10 * r}%`, { install: (w, r) => foodBonus(w, 0.1 * r) }),
    node("akane_blush", "Blush", 1, 3, 3, (r) => `+${(0.1 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.1 * r) }),
    node(
      "akane_not_worried",
      '"It\'s Not Like I Was Worried!"',
      1,
      4,
      3,
      (r) => `Dropping below 30% HP grants +${byRank([20, 35, 50], r)}% might for 6 s (30 s cooldown)`,
      { install: notWorried },
    ),
    node("akane_dere_mode", "Dere Mode", 1, 5, 1, () => "The barrage ends with a heart explosion (r 120, 300 damage) and heals 25% max HP"),
    // ---- Drill Princess
    node("akane_rotation", "Rotation", 2, 1, 5, (r) => `+${r}% crit chance`, { mods: (s, r) => void (s.crit += 0.01 * r) }),
    node("akane_drill_spin", "Drill Spin", 2, 2, 3, (r) => `+${8 * r}% crit damage`, { mods: (s, r) => void (s.critMult += 0.08 * r) }),
    node("akane_ojou_laugh", "Ojou-sama Laugh", 2, 3, 3, (r) => `+${4 * r}% area`, { mods: (s, r) => void (s.area += 0.04 * r) }),
    node(
      "akane_drill_breaker",
      "Drill Launcher",
      2,
      4,
      3,
      (r) => `Crits have a ${byRank([20, 30, 40], r)}% chance to launch a drill (pierces, 30 damage)`,
      { install: drillBreaker },
    ),
    node("akane_twin_tail_tornado", "Twin-Tail Tornado", 2, 5, 1, () => "Every 5th smack is replaced by a drill spin (360°, r 48, 3 hits of 60% damage)"),
  ],
};

export const talentTrees: TalentTree[] = [akaneTree];
