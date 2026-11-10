/**
 * PUDDING's talent tree, literally as docs/content/heroes.md §3: "Tea Service"
 * / "Customer Service" / "Head Maid". Weapon / ult parts are read by the
 * weapon and ult code through w.talentRank(id): Free Refills, Extra Cups, Tea
 * Ceremony and Flying Teacup Service in weapons/teapot-tempest.ts; Moe Moe
 * Kyun MAX in ultimates/omurice-of-love.ts.
 */
import type { TalentTree } from "../defs";
import type { World } from "../world";
import { dropPudding, foodBonus, heroesA } from "../weapons/_heroes-a";
import { byRank, node } from "./_node";

/** Service With a Smile: every 50 / 40 / 30 kills a pudding drops (food, heals 8). */
function service(w: World, r: number): void {
  const every = byRank([50, 40, 30], r);
  let n = 0;
  heroesA(w).onKill.push((e, x, y) => {
    if (e.def.prop || ++n < every) return;
    n = 0;
    dropPudding(w, x, y);
  });
}

export const puddingTree: TalentTree = {
  hero: "pudding",
  branches: ["Tea Service", "Customer Service", "Head Maid"],
  nodes: [
    // ---- Tea Service
    node("pudding_perfect_temp", "Perfect Temperature", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("pudding_refill", "Free Refills", 0, 2, 3, (r) => `Tea puddles and Warm Tea last +${(0.5 * r).toFixed(1)} s`),
    node("pudding_bow", "Polite Bow", 0, 3, 3, (r) => `-${3 * r}% cooldown`, { mods: (s, r) => void (s.cooldown -= 0.03 * r) }),
    node("pudding_extra_cups", "Extra Cups", 0, 4, 3, (r) => `Teapot Tempest +${r} teacup${r > 1 ? "s" : ""}`),
    node("pudding_tea_ceremony", "Tea Ceremony", 0, 5, 1, () => "Puddles are twice as big (easier to brush) and slow enemies 40%"),
    // ---- Customer Service
    node("pudding_smile", "Service Smile", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("pudding_water", "Complimentary Water", 1, 2, 3, (r) => `+${5 * r}% healing`, { mods: (s, r) => void (s.healMul += 0.05 * r) }),
    node("pudding_warm_welcome", "Warm Welcome", 1, 3, 3, (r) => `+${(0.1 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.1 * r) }),
    node(
      "pudding_regulars",
      "Regulars' Discount",
      1,
      4,
      3,
      (r) => `Food heals +${10 * r}% and has a ${byRank([10, 20, 30], r)}% chance to also add 5 Overdrive`,
      { install: (w, r) => foodBonus(w, 0.1 * r, byRank([0.1, 0.2, 0.3], r), 5) },
    ),
    node(
      "pudding_moe_max",
      "Moe Moe Kyun MAX",
      1,
      5,
      1,
      () => "Omurice of Love gets a 4th pulse (KYUN KYUN♡) and each pulse grants +1 shield charge (max 3, they last until hit)",
    ),
    // ---- Head Maid
    node("pudding_tips", "Tips Jar", 2, 1, 5, (r) => `+${4 * r}% coins`, { mods: (s, r) => void (s.greed += 0.04 * r) }),
    node("pudding_bell", "Lucky Service Bell", 2, 2, 3, (r) => `+${4 * r}% luck`, { mods: (s, r) => void (s.luck += 0.04 * r) }),
    node("pudding_efficiency", "Rush Hour Efficiency", 2, 3, 3, (r) => `+${4 * r}% move speed`, { mods: (s, r) => void (s.moveSpeed += 0.04 * r) }),
    node("pudding_service", "Service With a Smile", 2, 4, 3, (r) => `Every ${byRank([50, 40, 30], r)} kills a pudding drops (heals 8)`, { install: service }),
    node(
      "pudding_cup_toss",
      "Flying Teacup Service",
      2,
      5,
      1,
      () => "Every 3 s a teacup is thrown at the farthest enemy in view and shatters (r 24, 40 damage), leaving a puddle",
    ),
  ],
};

export const talentTrees: TalentTree[] = [puddingTree];
