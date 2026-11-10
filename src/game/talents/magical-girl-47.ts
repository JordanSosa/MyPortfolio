/**
 * MAGICAL GIRL #47's talent tree, literally as docs/content/heroes.md §3:
 * "Henshin" / "Nobody Remembers Me" / "Season Regular". Weapon / ult parts are
 * read by weapons/henshin-burst.ts (Quick Change, Panic Henshin+, Double
 * Henshin) and ultimates/episode-long-transformation.ts (Episode 47 (Special),
 * Finally Has a Name!) through w.talentRank(id); the rest is installed here.
 * "Every stat" is always the trait's exact list (weapons/_hb.ts everyStat).
 */
import { CFG } from "../config";
import type { TalentTree } from "../defs";
import type { World } from "../world";
import { HB, everyStat, hfx } from "../weapons/_hb";
import { byRank, node } from "./_node";

/** "Who Are You Again?": after 10 / 8 / 6 s without taking damage, a shield charge (max 1 bonus). */
function installForgotten(w: World, r: number): void {
  const need = byRank([10, 8, 6], r);
  let quiet = 0;
  w.hooks.on("hurt", () => {
    quiet = 0;
  });
  w.hooks.on("block", () => {
    quiet = 0;
  });
  w.hooks.on("step", (h) => {
    if (w.phase !== "play") return;
    quiet += h.dt;
    if (quiet < need) return;
    quiet = 0;
    const p = w.player;
    if (p.shield >= w.stats.shield + 1) return;
    p.shield++;
    hfx(w, HB.FORGOTTEN, p.x, p.y - CFG.playerCy);
  });
}

/** Recurring Character: each boss killed this run gives +3 / 4 / 5 % to every stat. */
function installRecurring(w: World, r: number): void {
  const per = byRank([0.03, 0.04, 0.05], r);
  let bosses = 0;
  w.hooks.on("bossKill", () => {
    bosses++;
    w.statsDirty = true;
  });
  w.statMods.push((s) => {
    if (bosses > 0) everyStat(s, per * bosses);
  });
}

export const magicalGirl47Tree: TalentTree = {
  hero: "magical_girl_47",
  branches: ["Henshin", "Nobody Remembers Me", "Season Regular"],
  nodes: [
    // ---- Henshin
    node("mg47_ribbon_practice", "Ribbon Practice", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("mg47_quick_change", "Quick Change", 0, 2, 3, (r) => `Henshin Burst cooldown -${4 * r}%`),
    node("mg47_sparkle_budget", "Sparkle Budget", 0, 3, 3, (r) => `+${4 * r}% area`, { mods: (s, r) => void (s.area += 0.04 * r) }),
    node("mg47_panic_plus", "Panic Henshin+", 0, 4, 3, (r) => `Panic Henshin triggers from ${byRank([70, 60, 50], r)}% charge (base 80%)`),
    node("mg47_double_henshin", "Double Henshin", 0, 5, 1, () => "Every Henshin Burst repeats 0.5 s later at 50% damage with mirrored ribbons"),
    // ---- Nobody Remembers Me
    node("mg47_background", "Background Character", 1, 1, 5, (r) => `+${3 * r}% move speed`, { mods: (s, r) => void (s.moveSpeed += 0.03 * r) }),
    node("mg47_forgettable", "Forgettable", 1, 2, 3, (r) => `-${2 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.02 * r) }),
    node("mg47_name_tag", "Generic Name Tag", 1, 3, 3, (r) => `+${6 * r} max HP`, { mods: (s, r) => void (s.maxHp += 6 * r) }),
    node("mg47_who_are_you", '"Who Are You Again?"', 1, 4, 3, (r) => `After ${byRank([10, 8, 6], r)} s without taking damage, gain a shield charge (max 1)`, {
      install: installForgotten,
    }),
    node("mg47_special_episode", "Episode 47 (Special)", 1, 5, 1, () => "After the transformation sequence: 6 s of +40% might and +20% move speed"),
    // ---- Season Regular
    node("mg47_average", "Average Joe", 2, 1, 5, (r) => `+${r}% to every stat`, { mods: (s, r) => everyStat(s, 0.01 * r) }),
    node("mg47_filler_training", "Filler Training", 2, 2, 3, (r) => `+${5 * r}% XP`, { mods: (s, r) => void (s.growth += 0.05 * r) }),
    node("mg47_bgm", "Insert Song", 2, 3, 3, (r) => `+${5 * r}% Overdrive gain`, { mods: (s, r) => void (s.ultGain += 0.05 * r) }),
    node("mg47_recurring", "Recurring Character", 2, 4, 3, (r) => `Each boss killed this run gives +${byRank([3, 4, 5], r)}% to every stat`, {
      install: installRecurring,
    }),
    node("mg47_has_a_name", "Finally Has a Name!", 2, 5, 1, () => 'The cut-in says "It\'s... Mahou— wait—" and the transformation takes 4 s instead of 6, with +50% damage'),
  ],
};

export const talentTrees: TalentTree[] = [magicalGirl47Tree];
