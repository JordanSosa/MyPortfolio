/**
 * Hero Plot Points (docs/content/achievements.md §4, 36): the cast, levels,
 * constellations, talents, and two goals per hero (a clear + a signature feat).
 */
import { ROSTER } from "../../roster";
import { counter, feat } from "../helpers";
import type { AchCtx, AchievementDef } from "../types";
import { bestConstellation, bestHeroLevel, hasCapstone, heroCleared, heroesAtLevel, heroesClearedCount, mostTalentPoints } from "./_shared";

const rosterHeroes = (c: AchCtx) => c.p.unlocks.heroes.filter((h) => ROSTER.some((r) => r.id === h)).length;

const clear = (id: string, hero: string, name: string, desc: string): AchievementDef => feat(id, name, desc, "heroes", (c) => heroCleared(c, hero), { gems: 60 });

/** A one-run counter that only counts while playing `hero` (null = any hero). */
const asHero = (hero: string | null, read: (c: AchCtx) => number) => (c: AchCtx) => (c.run && (hero === null || c.run.hero === hero) ? read(c) : 0);

const YARN = ["yarn_orbit", "cosmic_yarn"];

export const achievements: AchievementDef[] = [
  counter("heroes_3", "Assemble The Party", "Unlock 3 heroes.", "heroes", 3, (c) => c.p.unlocks.heroes.length, { gems: 40 }),
  counter("heroes_4", "Party of Four", "Unlock 4 heroes. Friendship achieved.", "heroes", 4, (c) => c.p.unlocks.heroes.length, { gems: 50, unlock: "friendship_bracelet" }),
  counter("heroes_6", "Ensemble Cast", "Unlock 6 heroes.", "heroes", 6, (c) => c.p.unlocks.heroes.length, { gems: 100, coins: 200 }),
  counter("heroes_all", "Full Cast Reveal", `Unlock all ${ROSTER.length} heroes. Yes, even the truck.`, "heroes", ROSTER.length, rosterHeroes, { gems: 800, title: "Showrunner" }),
  counter("hero_level_10", "Character Development", "Raise any hero to level 10.", "heroes", 10, bestHeroLevel, { gems: 50 }),
  counter("hero_level_30", "Max Affection", "Raise any hero to level 30.", "heroes", 30, bestHeroLevel, { gems: 240, title: "Main Character" }),
  counter("all_heroes_30", "Complete Box Set", `Raise all ${ROSTER.length} heroes to level 30.`, "heroes", ROSTER.length, (c) => heroesAtLevel(c, 30), { gems: 1000, title: "Box Set Collector" }),
  counter("clear_3_heroes", "Spin-Off Material", "Clear a stage with 3 different heroes.", "heroes", 3, heroesClearedCount, { gems: 120 }),
  counter("clear_6_heroes", "Ensemble Episode", "Clear a stage with 6 different heroes.", "heroes", 6, heroesClearedCount, { gems: 200 }),
  counter("clear_all_heroes", "Every Character Gets an Episode", `Clear a stage with all ${ROSTER.length} heroes.`, "heroes", ROSTER.length, heroesClearedCount, { gems: 600, title: "Fair Screen Time" }),
  counter("constellation_1", "Recolour Edition", "Raise any hero to C1.", "heroes", 1, bestConstellation, { gems: 30 }),
  counter("constellation_6", "Fully Awakened (Final Form)", "Bring any hero to C6.", "heroes", 6, bestConstellation, { gems: 320, title: "Final Form" }),
  feat("capstone", "Character Arc Complete", "Take any tier-5 talent.", "heroes", hasCapstone, { gems: 40 }),
  counter("two_arcs", "Two Full Arcs", "Spend all 30 talent points on one hero.", "heroes", 30, mostTalentPoints, { gems: 150 }),
  // ---- per hero
  clear("clear_hoshi", "hoshi", "Star of the Show", "Clear a stage as Hoshi."),
  counter("hoshi_stars", "Ten Thousand Wishes", "Defeat 10,000 enemies with Star Shot (or Galaxy Barrage).", "heroes", 10_000, (c) => c.life.killsByWeapon.star_shot ?? 0, { gems: 80 }),
  clear("clear_rin", "rin", "Blade of the Shrine", "Clear a stage as Rin."),
  counter("rin_blossoms", "Thousand Blossom Accountant", "Deal 1,000,000 damage with Petal Slash (or Sakura Tempest).", "heroes", 1_000_000, (c) => c.life.damageByWeapon.petal_slash ?? 0, { gems: 80 }),
  clear("clear_mochi", "mochi", "Cat's Out of the Bag", "Clear a stage as Mochi."),
  feat(
    "mochi_yarn_only",
    "Loyal to the Yarn",
    "Clear a stage as Mochi using no weapon but Yarn Orbit / Cosmic Yarn.",
    "heroes",
    (c) => {
      const r = c.run;
      const used = r?.weaponsUsed ?? [];
      return !!r && r.stageCleared && r.hero === "mochi" && used.length > 0 && used.every((w) => YARN.includes(w));
    },
    { gems: 120 },
    { hidden: true },
  ),
  clear("clear_kuro", "kuro", "The Abyss Gazes Back", "Clear a stage as Kuro."),
  counter("kuro_overdrive", "Chuuni Overload", "Use Overdrive 8 times in one run as Kuro.", "heroes", 8, asHero("kuro", (c) => c.run?.ults ?? 0), { gems: 80 }),
  clear("clear_pudding", "pudding", "Order Up!", "Clear a stage as Pudding."),
  counter("pudding_heal", "Five-Star Service", "Heal 1,000 HP in one run as Pudding.", "heroes", 1_000, asHero("pudding", (c) => c.run?.healed ?? 0), { gems: 80 }),
  clear("clear_aoi", "aoi", "Mission Complete (License Pending)", "Clear a stage as Aoi."),
  counter(
    "aoi_spaghetti",
    "Spaghetti Code",
    "Defeat 2,000 enemies with Micro Missile Swarm (or Al Dente Armageddon) in one run.",
    "heroes",
    2_000,
    asHero(null, (c) => (c.run?.killsByWeapon.micro_missile_swarm ?? 0) + (c.run?.killsByWeapon.al_dente_armageddon ?? 0)),
    { gems: 80 },
  ),
  clear("clear_akane", "akane", "N-Not Like I Wanted to Win", "Clear a stage as Akane."),
  counter("akane_baka", "BAKA ×100", "See 100 BAKA! pops in one run.", "heroes", 100, asHero(null, (c) => c.run?.bakas ?? 0), { gems: 60 }),
  clear("clear_senpai", "senpai", "Noticed (Finally)", "Clear a stage as Senpai."),
  counter("senpai_charm", "Fan Club President", "Charm 300 enemies in one run.", "heroes", 300, asHero(null, (c) => c.run?.charmed ?? 0), { gems: 80 }),
  clear("clear_mg47", "magical_girl_47", "Remembered (For Now)", "Clear a stage as Magical Girl #47."),
  counter("mg47_henshin", "Transformation Sequence #47", "Transform 47 times in one run.", "heroes", 47, asHero(null, (c) => c.run?.henshins ?? 0), { gems: 147 }),
  clear("clear_isekai", "isekai_kun", "Another World, Another Clear", "Clear a stage as Isekai-kun."),
  counter("isekai_overdo", "Did I Overdo It?", "Overdo 30 fireballs in one run.", "heroes", 30, asHero(null, (c) => c.run?.overdos ?? 0), { gems: 80 }),
  clear("clear_truck", "truck_kun", "Delivered", "Clear a stage as Truck-kun."),
  counter("truck_isekai", "Reincarnation Services", "Isekai 1,000 enemies in one run.", "heroes", 1_000, asHero(null, (c) => c.run?.isekaid ?? 0), { gems: 120 }),
];
