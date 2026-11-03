/**
 * MOCHI's talent tree, literally as docs/content/heroes.md §3: "Cat Nap" /
 * "Nine Lives" / "Zoomies". Weapon / ult parts are read by
 * weapons/yarn-orbit.ts (Infinite Yarn) and ultimates/nyan-stampede.ts (Cat
 * Army, Catnip Overdrive) through w.talentRank(id); the rest is installed here.
 */
import { C } from "../../art/palette";
import type { TalentTree } from "../defs";
import { onDashThrough } from "../hooks";
import { byRank, node } from "./_node";

const YARN_SOURCES = new Set(["yarn_orbit", "cosmic_yarn"]);

export const mochiTree: TalentTree = {
  hero: "mochi",
  branches: ["Cat Nap", "Nine Lives", "Zoomies"],
  nodes: [
    // ---- Cat Nap
    node("mochi_fluffy", "Fluffy", 0, 1, 5, (r) => `+${4 * r}% area`, { mods: (s, r) => void (s.area += 0.04 * r) }),
    node("mochi_kneading", "Kneading", 0, 2, 3, (r) => `Yarn Orbit +${8 * r}% damage`, { install: (w, r) => w.addWeaponDamage("yarn_orbit", 0.08 * r) }),
    node("mochi_purr", "Purr", 0, 3, 3, (r) => `+${4 * r}% duration`, { mods: (s, r) => void (s.duration += 0.04 * r) }),
    node("mochi_tangled", "Tangled Up", 0, 4, 3, (r) => `Yarn hits slow enemies ${10 * r}% for 1 s`, {
      install: (w, r) => {
        const slow = 1 - 0.1 * r;
        w.hooks.on("hit", (h) => {
          if (!YARN_SOURCES.has(h.source)) return;
          const e = h.enemy;
          if (e.def.boss) return;
          if (slow < e.slow) e.slow = slow;
          if (e.slowT < 1) e.slowT = 1;
        });
      },
    }),
    node("mochi_infinite_yarn", "Infinite Yarn", 0, 5, 1, () => "Yarn Orbit never turns off and gains +2 balls"),
    // ---- Nine Lives
    node("mochi_lands_on_feet", "Lands on Feet", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("mochi_cat_reflexes", "Cat Reflexes", 1, 2, 3, (r) => `-${5 * r}% dash cooldown`, { mods: (s, r) => void (s.dashCd -= 0.05 * r) }),
    node("mochi_grooming", "Grooming", 1, 3, 3, (r) => `+${(0.1 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.1 * r) }),
    node("mochi_ninth_life", "Ninth Life", 1, 4, 3, (r) => `Once per run, survive a lethal hit at 1 HP, then ${byRank([1, 1.5, 2], r)} s invulnerable`, {
      install: (w, r) => {
        w.plotArmor += 1;
        w.plotArmorIframes = Math.max(w.plotArmorIframes, byRank([1, 1.5, 2], r));
      },
    }),
    node("mochi_cat_army", "Cat Army", 1, 5, 1, () => "Nyan Stampede has 90 cats (from 60) and every trampled enemy has a 10% chance to drop a coin"),
    // ---- Zoomies
    node("mochi_zoomies", "Zoomies", 2, 1, 5, (r) => `+${3 * r}% move speed`, { mods: (s, r) => void (s.moveSpeed += 0.03 * r) }),
    node("mochi_shiny_things", "Shiny Things", 2, 2, 3, (r) => `+${10 * r}% pickup range`, { mods: (s, r) => void (s.pickup += 0.1 * r) }),
    node("mochi_pounce", "Pounce", 2, 3, 3, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("mochi_hunter", "Hunter Instinct", 2, 4, 3, (r) => `Dashing through enemies deals ${byRank([20, 35, 50], r)} damage to each`, {
      install: (w, r) => {
        const dmg = byRank([20, 35, 50], r);
        onDashThrough(w, (e) => {
          const p = w.player;
          w.hitEnemy(e, dmg * w.stats.might, null, Math.atan2(p.dashDY, p.dashDX), 120, 0, "mochi_hunter", C.lavender);
        });
      },
    }),
    node("mochi_catnip", "Catnip Overdrive", 2, 5, 1, () => "Nyan Stampede also runs top-to-bottom and bottom-to-top (2 extra walls) and pulls in every gem in view"),
  ],
};

export const talentTrees: TalentTree[] = [mochiTree];
