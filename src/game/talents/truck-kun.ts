/**
 * TRUCK-KUN's talent tree, literally as docs/content/heroes.md §3: "Engine" /
 * "Chassis" / "Reincarnation Services". Weapon / ult parts are read by
 * weapons/horn-of-reincarnation.ts (Air Horn, Bull Bar, Next-Life Guarantee,
 * Eighteen Wheeler), weapons/_truck.ts (Bull Bar on the C6 trailer) and
 * ultimates/isekai-express.ts (Unlimited Mileage, Afterlife Customer Loyalty)
 * through w.talentRank(id); the rest is stat mods.
 */
import type { TalentTree } from "../defs";
import { byRank, node } from "./_node";

export const truckKunTree: TalentTree = {
  hero: "truck_kun",
  branches: ["Engine", "Chassis", "Reincarnation Services"],
  nodes: [
    // ---- Engine
    node("truck_horsepower", "Horsepower", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("truck_air_horn", "Air Horn", 0, 2, 3, (r) => `Honk cone length +${8 * r}%`),
    node("truck_turbo", "Turbo", 0, 3, 3, (r) => `+${3 * r}% move speed`, { mods: (s, r) => void (s.moveSpeed += 0.03 * r) }),
    node("truck_bull_bar", "Bull Bar", 0, 4, 3, (r) => `Ram damage +${20 * r}%; rammed enemies are stunned ${byRank([0.2, 0.3, 0.4], r)} s`),
    node("truck_eighteen_wheeler", "Eighteen Wheeler", 0, 5, 1, () => "The horn also honks backward (70% damage) and the ram hitbox is 50% larger"),
    // ---- Chassis
    node("truck_steel_frame", "Steel Frame", 1, 1, 5, (r) => `+${8 * r} max HP`, { mods: (s, r) => void (s.maxHp += 8 * r) }),
    node("truck_airbags", "Airbags", 1, 2, 3, (r) => `+1 shield charge, recharging every ${byRank([30, 24, 18], r)} s`, {
      mods: (s, r) => {
        s.shield += 1;
        s.shieldCd = byRank([30, 24, 18], r);
      },
    }),
    node("truck_crumple_zone", "Crumple Zone", 1, 3, 3, (r) => `-${2 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.02 * r) }),
    node("truck_roadside", "Roadside Assistance", 1, 4, 3, (r) => `+${(0.2 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.2 * r) }),
    node("truck_unlimited_mileage", "Unlimited Mileage", 1, 5, 1, () => "ISEKAI EXPRESS drives 6 lanes (two more random lanes at 3.2 / 3.6 s) and each isekai'd enemy gives +1 Overdrive"),
    // ---- Reincarnation Services
    node("truck_delivery_bonus", "Delivery Bonus", 2, 1, 5, (r) => `+${4 * r}% coins`, { mods: (s, r) => void (s.greed += 0.04 * r) }),
    node("truck_express", "Express Shipping", 2, 2, 3, (r) => `+${5 * r}% XP`, { mods: (s, r) => void (s.growth += 0.05 * r) }),
    node("truck_insurance", "Insurance", 2, 3, 3, (r) => `+${4 * r}% luck`, { mods: (s, r) => void (s.luck += 0.04 * r) }),
    node("truck_next_life", "Next-Life Guarantee", 2, 4, 3, (r) => `Isekai'd enemies drop an extra gem with +${byRank([15, 25, 35], r)}% chance`),
    node("truck_loyalty", "Afterlife Customer Loyalty", 2, 5, 1, () => "The express lane drops off 3 tiny Truck-kuns that patrol for 10 s, ramming enemies (60 damage)"),
  ],
};

export const talentTrees: TalentTree[] = [truckKunTree];
