/**
 * ISEKAI-KUN's talent tree, literally as docs/content/heroes.md §3: "Cheat
 * Magic" / "Party Members" / "Reincarnation Perks". Weapon / ult parts are read
 * by weapons/cheat-fireball.ts ("Lv.9999", Overdone, "Did I Overdo It AGAIN?")
 * and ultimates/status-screen.ts (Status Screen: Expanded) through
 * w.talentRank(id); the rest is installed here.
 */
import { C } from "../../art/palette";
import type { TalentTree } from "../defs";
import { HEROES } from "../heroes";
import { baseWeapons } from "../registry";
import type { Enemy } from "../types";
import type { World } from "../world";
import { randomTargetsInView } from "../weapons/_fx";
import { HB, hfx } from "../weapons/_hb";
import { byRank, node } from "./_node";

const volley: Enemy[] = [];

/** Guild Support: every 20 s an arrow volley from off-screen hits 6 / 8 / 10 random enemies in view (40 each). */
function installGuild(w: World, r: number): void {
  const n = byRank([6, 8, 10], r);
  w.every(20, () => {
    const k = randomTargetsInView(w, n, volley);
    if (k === 0) return;
    const p = w.player;
    // the party shoots from just past the top edge, from the side the hero faces
    const sx = p.x - p.face * w.viewW * 0.35;
    const sy = p.y - 8 - w.viewH * 0.5 - 24;
    for (let i = 0; i < k; i++) {
      const e = volley[i];
      if (e.dead) continue;
      const ex = e.x;
      const ey = e.y - e.cy;
      hfx(w, HB.ARROW, sx + w.rng.spread(20), sy, ex, ey, 0, i);
      w.hitEnemy(e, 40 * w.stats.might, null, Math.atan2(ey - sy, ex - sx), 60, 0, "isekai_guild_support", C.paleYellow);
    }
  });
}

/**
 * Second Cheat Skill: the run also starts with a random unlocked non-signature
 * weapon at Lv1 (any hero's signature weapon is excluded; picked with the run's
 * RNG on the first step, after the start weapon took slot 0).
 */
function installSecondCheat(w: World): void {
  w.after(0, (ww) => {
    const sig = new Set(HEROES.map((h) => h.weapon));
    const pool = ww.run.weaponPool;
    const ids = baseWeapons()
      .map((d) => d.id)
      .filter((id) => !sig.has(id) && (!pool || pool.includes(id)) && !ww.banished.has(id) && !ww.hasWeapon(id));
    if (ids.length === 0) return;
    ww.addWeapon(ids[ww.rng.int(0, ids.length - 1)], 1);
  });
}

export const isekaiKunTree: TalentTree = {
  hero: "isekai_kun",
  branches: ["Cheat Magic", "Party Members", "Reincarnation Perks"],
  nodes: [
    // ---- Cheat Magic
    node("isekai_mana_overflow", "Mana Overflow", 0, 1, 5, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node("isekai_lv9999", '"Lv.9999"', 0, 2, 3, (r) => `Cheat Fireball blast radius +${8 * r}%`),
    node("isekai_chant_skip", "Chant Skip", 0, 3, 3, (r) => `-${3 * r}% cooldown`, { mods: (s, r) => void (s.cooldown -= 0.03 * r) }),
    node("isekai_overdone", "Overdone", 0, 4, 3, (r) => (r >= 3 ? "Overdo every 3rd cast, overdone blasts +20% radius" : r >= 2 ? "Overdo every 4th cast (base 5th), overdone blasts +20% radius" : "Overdo every 4th cast (base 5th)")),
    node("isekai_overdid_again", '"Did I Overdo It AGAIN?"', 0, 5, 1, () => "Every overdone fireball bursts into 6 regular fireballs on detonation"),
    // ---- Party Members
    node("isekai_companions", "Loyal Companions", 1, 1, 5, (r) => `+${5 * r} max HP`, { mods: (s, r) => void (s.maxHp += 5 * r) }),
    node("isekai_party_healer", "Party Healer", 1, 2, 3, (r) => `+${(0.1 * r).toFixed(1)} HP/s regen`, { mods: (s, r) => void (s.regen += 0.1 * r) }),
    node("isekai_party_tank", "Party Tank", 1, 3, 3, (r) => `-${2 * r}% damage taken`, { mods: (s, r) => void (s.dmgReduction += 0.02 * r) }),
    node("isekai_guild_support", "Guild Support", 1, 4, 3, (r) => `Every 20 s an arrow volley from off-screen hits ${byRank([6, 8, 10], r)} random enemies in view (40 damage each)`, {
      install: installGuild,
    }),
    node("isekai_status_expanded", "Status Screen: Expanded", 1, 5, 1, () => "STATUS SCREEN!! slams 5 times (top, bottom, middle, top half, bottom half) and the fake numbers read 99999999999"),
    // ---- Reincarnation Perks
    node("isekai_skill_points", "Skill Points", 2, 1, 5, (r) => `+${4 * r}% XP`, { mods: (s, r) => void (s.growth += 0.04 * r) }),
    node("isekai_item_box", "Item Box", 2, 2, 3, (r) => `+${8 * r}% pickup range`, { mods: (s, r) => void (s.pickup += 0.08 * r) }),
    node("isekai_appraisal", "Appraisal", 2, 3, 3, (r) => `+${4 * r}% luck`, { mods: (s, r) => void (s.luck += 0.04 * r) }),
    node("isekai_starter_village", "Starter Village Bonus", 2, 4, 3, (r) => `Start the run +${r} level${r > 1 ? "s" : ""} (on top of the trait's Lv 3)`, {
      install: (w, r) => void (w.startLevel += r),
    }),
    node("isekai_second_cheat", "Second Cheat Skill", 2, 5, 1, () => "The run also starts with a random unlocked non-signature weapon at Lv1", { install: installSecondCheat }),
  ],
};

export const talentTrees: TalentTree[] = [isekaiKunTree];
