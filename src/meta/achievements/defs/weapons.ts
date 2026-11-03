/**
 * Weapon Plot Points (docs/content/achievements.md §5, 37): evolutions, the
 * unlock feats, mastery, the arsenal codex, and one per evolution.
 */
import { counter, feat } from "../helpers";
import type { AchievementDef } from "../types";
import { bestMastery, codexWeapons, masteryAtLeast, weaponSeen } from "./_shared";

/** "Evolve X" (the evolution is in the codex, or held this run). */
const evo = (weapon: string, name: string, desc: string, gems: number): AchievementDef => feat(`evo_${weapon}`, name, desc, "weapons", (c) => weaponSeen(c, weapon), { gems });

export const achievements: AchievementDef[] = [
  counter("evolve_1", "Glow-Up", "Evolve a weapon.", "weapons", 1, (c) => c.life.evolutions, { gems: 60 }),
  counter("evolve_10", "Origami Is Just Paper Evolving", "Evolve 10 weapons.", "weapons", 10, (c) => c.life.evolutions, { gems: 120, unlock: "paper_crane_flock" }),
  counter("evolve_25", "Transformation Sequence Addict", "Evolve 25 weapons.", "weapons", 25, (c) => c.life.evolutions, { gems: 240 }),
  counter("evolve_6_run", "Six-Evolution Spectacle", "Hold 6 evolved weapons in one run.", "weapons", 6, (c) => Math.max(c.life.maxEvolutions, c.run?.evolutions.length ?? 0), { gems: 320 }),
  counter("boba_origins", "Tapioca Origins", "Defeat 1,000 Puffs. They're chewy.", "weapons", 1_000, (c) => c.life.killsByEnemy.puff ?? 0, { gems: 80, coins: 300, unlock: "bubble_tea_cannon" }),
  counter("snacks_50", "Growing Hero", "Eat 50 snacks.", "weapons", 50, (c) => c.life.foodEaten, { gems: 60, unlock: "bento_box" }),
  counter("dashes_500", "Feel the Speed Lines", "Dash 500 times.", "weapons", 500, (c) => c.life.dashes, { gems: 60, unlock: "speed_lines" }),
  counter("mastery_5", "Limit Break!", "Reach mastery rank 5 with any weapon.", "weapons", 5, bestMastery, { gems: 120 }),
  counter("mastery_10", "MASTERED", "Reach mastery rank 10 with any weapon.", "weapons", 10, bestMastery, { gems: 400, title: "Weapon Otaku" }),
  counter("mastery_5x5", "Limit Breaker", "Reach mastery rank 5 with 5 weapons.", "weapons", 5, (c) => masteryAtLeast(c, 5), { gems: 300 }),
  counter("mastery_10x5", "Five Masterpieces", "Reach mastery rank 10 with 5 weapons.", "weapons", 5, (c) => masteryAtLeast(c, 10), { gems: 800 }),
  counter("mastery_all", "Arsenal: MASTERED", "Reach mastery rank 10 with all 20 weapons.", "weapons", 20, (c) => masteryAtLeast(c, 10), { gems: 2000, title: "Weapon Encyclopedia" }),
  counter("arsenal_8", "Arsenal Otaku", "Discover 8 weapons in the codex.", "weapons", 8, (c) => c.p.codex.weapons.length, { gems: 100 }),
  counter("arsenal_20", "Full Arsenal", "Discover all 20 base weapons.", "weapons", 20, (c) => codexWeapons(c, false), { gems: 300 }),
  counter("evolutions_all", "Evolution Encyclopedia", "Discover all 20 evolutions.", "weapons", 20, (c) => codexWeapons(c, true), { gems: 800 }),
  counter("passives_all", "Fully Accessorised", "Discover all 16 passives.", "weapons", 16, (c) => c.p.codex.passives.length, { gems: 200 }),
  counter("seven_weapons", "Seven-Weapon Sampler", "Hold 7 weapons at once.", "weapons", 7, (c) => c.run?.maxWeaponsHeld ?? 0, { gems: 160 }),
  evo("galaxy_barrage", "Galaxy Brain", "Evolve Galaxy Barrage.", 40),
  evo("sakura_tempest", "Petal to the Metal", "Evolve Sakura Tempest.", 40),
  evo("cosmic_yarn", "Ball of Infinite Yarn", "Evolve Cosmic Yarn.", 40),
  evo("love_tornado", "Whirlwind Romance", "Evolve Love Tornado.", 40),
  evo("raijin_drum", "Drum Solo", "Evolve Raijin Drum.", 40),
  evo("sugar_nuke", "Tactical Sweetness", "Evolve Sugar Nuke.", 40),
  evo("ocean_dome", "Bath Time Is Over", "Evolve Ocean Dome.", 40),
  evo("rainbow_cannon", "Full Spectrum Argument", "Evolve Rainbow Cannon.", 40),
  evo("unsealed_abyss_dragon", "He Was Right All Along", "Evolve Unsealed Abyss Dragon. The flames are black now.", 60),
  evo("eternal_tea_party", "Bottomless Refills", "Evolve Eternal Tea Party.", 60),
  evo("al_dente_armageddon", "Al Dente Achieved", "Evolve Al Dente Armageddon.", 60),
  evo("dere_dere_harisen", "...B-Baka ♡", "Evolve Dere Dere Harisen.", 60),
  evo("shoujo_filter", "Screentone Overload", "Evolve Shoujo Filter.", 60),
  evo("infinite_henshin_loop", "Still Transforming", "Evolve Infinite Henshin Loop.", 60),
  evo("cheat_meteor", "He Trained (Once)", "Evolve Meteor Lv.99999.", 60),
  evo("isekai_rush_hour", "Gridlock to Another World", "Evolve Isekai Rush Hour.", 60),
  evo("tapioca_tsunami", "Tapioca Tsunami Warning", "Evolve Tapioca Tsunami.", 60),
  evo("thousand_crane_wish", "Wish Granted", "Evolve Thousand Crane Wish.", 60),
  evo("sold_out_dome_tour", "Sold Out (Emotionally)", "Evolve Sold-Out Dome Tour.", 60),
  evo("eternal_winter_break", "Never Leaving the Kotatsu", "Evolve Eternal Winter Break.", 60),
];
