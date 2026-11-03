/**
 * KURO's talent tree, literally as docs/content/heroes.md §3: "Sealed Right
 * Arm" / "Chuuni Monologue" / "Eye of the Abyss". Weapon / ult parts are read
 * by the weapon and ult code through w.talentRank(id): Dark Flame Kindling,
 * The Seal Is Broken (black flames + burn x2) and Eyepatch: Off in
 * weapons/dark-flame-dragon.ts; Lingering Darkness and TRUE Forbidden
 * Technique in ultimates/eternal-abyss.ts.
 */
import { CFG } from "../config";
import type { TalentTree } from "../defs";
import type { World } from "../world";
import { HFX_KURO_MARK, heroesA, hfx, strongestInView } from "../weapons/_heroes-a";
import { byRank, node } from "./_node";

/** Edgy Backstory: +4 % might per rank while the Overdrive meter is at least half full. */
function edgy(w: World, r: number): void {
  let on = false;
  w.statMods.push((s) => {
    if (on) s.might += 0.04 * r;
  });
  w.hooks.on("step", () => {
    const now = !w.ult && w.ultMeter >= CFG.ultMax * 0.5;
    if (now !== on) {
      on = now;
      w.statsDirty = true;
    }
  });
}

/** Abyssal Gaze: every 6 / 5 / 4 s the strongest enemy in view is Marked; the next hit on it always crits. */
function gaze(w: World, r: number): void {
  const st = heroesA(w);
  w.critRules.push((e) => e === st.mark && e.uid === st.markUid);
  w.hooks.on("hit", (h) => {
    if (st.mark !== null && h.enemy === st.mark) {
      st.mark = null;
      st.markUid = 0;
    }
  });
  w.every(
    byRank([6, 5, 4], r),
    () => {
      const e = strongestInView(w);
      if (!e) return;
      st.mark = e;
      st.markUid = e.uid;
      hfx(w, HFX_KURO_MARK, e.x, e.y - e.cy, e.x, e.y, 0, 0, e);
    },
    1,
  );
}

export const kuroTree: TalentTree = {
  hero: "kuro",
  branches: ["Sealed Right Arm", "Chuuni Monologue", "Eye of the Abyss"],
  nodes: [
    // ---- Sealed Right Arm
    node("kuro_bandages", "Bandages of Restraint", 0, 1, 5, (r) => `+${3 * r}% area`, { mods: (s, r) => void (s.area += 0.03 * r) }),
    node("kuro_kindling", "Dark Flame Kindling", 0, 2, 3, (r) => `Dark Flame Dragon burn damage +${15 * r}%`),
    node("kuro_incantation", "Incantation", 0, 3, 3, (r) => `+${4 * r}% duration`, { mods: (s, r) => void (s.duration += 0.04 * r) }),
    node("kuro_wildfire", "Wildfire", 0, 4, 3, (r) => `Burning enemies that die spread their burn to enemies within ${byRank([12, 16, 20], r)} px`, {
      install: (w, r) => void (heroesA(w).wildfireR = byRank([12, 16, 20], r)),
    }),
    node(
      "kuro_seal_broken",
      "The Seal Is Broken",
      0,
      5,
      1,
      () => "The flames are finally, actually black: burn damage x2 and burning enemies take +15% damage from everything",
      {
        install: (w) => {
          const st = heroesA(w);
          w.dmgTaken.push((e) => (st.burnCount > 0 && st.burning(e) ? 1.15 : 1));
        },
      },
    ),
    // ---- Chuuni Monologue
    node("kuro_dramatic_pose", "Dramatic Pose", 1, 1, 5, (r) => `+${4 * r}% Overdrive gain`, { mods: (s, r) => void (s.ultGain += 0.04 * r) }),
    node("kuro_edgy_backstory", "Edgy Backstory", 1, 2, 3, (r) => `+${4 * r}% might while the Overdrive meter is at least 50%`, { install: edgy }),
    node("kuro_name_that_attack", "Name That Attack", 1, 3, 3, (r) => `+${8 * r}% ultimate damage`, { mods: (s, r) => void (s.ultPower += 0.08 * r) }),
    node("kuro_lingering_darkness", "Lingering Darkness", 1, 4, 3, (r) => `After Eternal Abyss, enemies stay slowed 40% for ${byRank([2, 3, 4], r)} s`),
    node(
      "kuro_true_forbidden",
      "TRUE Forbidden Technique",
      1,
      5,
      1,
      () => "The shadow sweeps twice (the second pass right to left, +10 ticks) and the reveal shows a stadium floodlight",
    ),
    // ---- Eye of the Abyss
    node("kuro_peeking", "Peeking Under the Patch", 2, 1, 5, (r) => `+${r}% crit chance`, { mods: (s, r) => void (s.crit += 0.01 * r) }),
    node("kuro_its_throbbing", '"It\'s Throbbing!"', 2, 2, 3, (r) => `+${8 * r}% crit damage`, { mods: (s, r) => void (s.critMult += 0.08 * r) }),
    node("kuro_night_vision", "Night Vision", 2, 3, 3, (r) => `+${3 * r}% might`, { mods: (s, r) => void (s.might += 0.03 * r) }),
    node(
      "kuro_abyssal_gaze",
      "Abyssal Gaze",
      2,
      4,
      3,
      (r) => `Every ${byRank([6, 5, 4], r)} s the strongest enemy in view is Marked: the next hit on it is a guaranteed crit`,
      { install: gaze },
    ),
    node(
      "kuro_eyepatch_off",
      "Eyepatch: Off",
      2,
      5,
      1,
      () => "Dark Flame Dragon also fires a Crimson Eye Beam at the Marked (or nearest) enemy every 4 s (8 damage every 0.1 s for 0.4 s, pierces)",
    ),
  ],
};

export const talentTrees: TalentTree[] = [kuroTree];
