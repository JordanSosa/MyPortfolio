/**
 * The "heroes B" group of Season 2 (docs/content/heroes.md §1-2, §4): Senpai,
 * Magical Girl #47, Isekai-kun and Truck-kun - traits (`apply` + `install`),
 * accents, cut-in bands and lines, and constellations C1-C6. Listed in HEROES
 * (heroes.ts). Weapons / ultimates / talents live in their registry folders;
 * the trait behaviours in weapons/_charm.ts (staring) and weapons/_truck.ts
 * (driving).
 *
 * Constellation conventions as heroes.ts: shared star names, C2 = the start
 * weapon at Lv2, C3 upgrades the trait (mods add the difference, installs read
 * w.cons), ult / weapon parts are read by their code through w.cons.
 */
import { C } from "../art/palette";
import type { ConstellationDef } from "./defs";
import type { HeroDef } from "./types";
import type { World } from "./world";
import { charmRules, installStaring } from "./weapons/_charm";
import { everyStat } from "./weapons/_hb";
import { forceHenshin } from "./weapons/henshin-burst";
import { installTrailer, installTruck } from "./weapons/_truck";

const NAMES = [
  "Recolour Edition",
  "Rerun Banner Edition",
  "Summer Variant (Sun Hat Included)",
  "Unlicensed Collab Outfit",
  "Super-Deformed Plushie Form",
  "Fully Awakened (Final Form)",
] as const;

function stars(weapon: string, list: [string, ConstellationDef["mods"]?, ConstellationDef["install"]?][]): ConstellationDef[] {
  return list.map(([desc, mods, install], i) => ({
    name: NAMES[i],
    desc,
    mods,
    // C2: the run starts with the signature weapon at Lv2
    install: i === 1 ? (w: World) => void (w.startWeapon === weapon && (w.startWeaponLevel = Math.max(w.startWeaponLevel, 2))) : install,
  }));
}

export const SENPAI: HeroDef = {
  id: "senpai",
  name: "Senpai",
  title: "Sparkly Bishounen",
  sprite: "senpai",
  portrait: "portrait_senpai",
  weapon: "notice_me_sparkles",
  ult: "senpai_noticed_you",
  trait: "+20% luck, +10% XP, enemies within 40 px are 10% slower (they're staring)",
  color: C.lavender,
  colors: [C.lavender, C.pinkLight, C.white, C.red],
  band: ["#ffffff", "#ddc6ff", "#ff7ab8"],
  cutinLine: "...Oh. You were there? ✧",
  apply: (s) => {
    s.luck += 0.2;
    s.growth += 0.1;
  },
  // they're staring: 10 % slower within 40 px (C3: 20 % within 56 px)
  install: (w) => (w.cons >= 3 ? installStaring(w, 56, 0.8) : installStaring(w, 40, 0.9)),
  constellations: stars("notice_me_sparkles", [
    ["+8% luck", (s) => void (s.luck += 0.08)],
    ["Notice-Me Sparkles starts at Lv2"],
    ["Trait slow aura becomes 20% within 56 px"],
    ["Swoon lasts +2 s"],
    ["+6% XP, +6% coins", (s) => void ((s.growth += 0.06), (s.greed += 0.06))],
    ["Charmed enemies drop double XP when they die", undefined, (w) => charmRules(w, { doubleXp: true })],
  ]),
};

export const MAGICAL_GIRL_47: HeroDef = {
  id: "magical_girl_47",
  name: "Magical Girl #47",
  title: "Aggressively Generic Magical Girl",
  sprite: "magical_girl_47",
  portrait: "portrait_magical_girl_47",
  weapon: "henshin_burst",
  ult: "episode_long_transformation",
  trait: "+5% to EVERYTHING",
  color: C.mint,
  colors: [C.mint, C.lightBlue, C.white, C.pinkLight],
  band: ["#d0f7ad", "#b0d8ff", "#5aa8ff"],
  cutinLine: "Magical... Miracle... Something-or-other... (what was my catchphrase?) TRANSFORM!!",
  apply: (s) => everyStat(s, 0.05),
  constellations: stars("henshin_burst", [
    ["+3% to every stat", (s) => everyStat(s, 0.03)],
    ["Henshin Burst starts at Lv2"],
    ["Trait becomes +8% to everything", (s) => everyStat(s, 0.03)],
    ["Transformation stages +30% damage"],
    ["+10 max HP, +5% move speed", (s) => void ((s.maxHp += 10), (s.moveSpeed += 0.05))],
    ["Henshin Burst also triggers on every level-up", undefined, (w) => void w.hooks.on("levelUp", () => forceHenshin(w))],
  ]),
};

export const ISEKAI_KUN: HeroDef = {
  id: "isekai_kun",
  name: "Isekai-kun",
  title: "Beige Overpowered Protagonist",
  sprite: "isekai_kun",
  portrait: "portrait_isekai_kun",
  weapon: "cheat_fireball",
  ult: "status_screen",
  trait: "+15% damage, +15% XP, starts every run at Lv 3",
  color: C.cyan,
  colors: [0xdda574, C.cyan, C.aqua, C.white],
  band: ["#fff0c9", "#dda574", "#1c97ad"],
  cutinLine: "Huh? Is this a lot? Everyone has numbers like these, right?",
  apply: (s) => {
    s.might += 0.15;
    s.growth += 0.15;
  },
  // Cheat Skill: the run starts at Lv 3 (C3: Lv 5); Starter Village Bonus adds on top (talent)
  install: (w) => void (w.startLevel = Math.max(w.startLevel, w.cons >= 3 ? 5 : 3)),
  constellations: stars("cheat_fireball", [
    ["+5% XP", (s) => void (s.growth += 0.05)],
    ["Cheat Fireball starts at Lv2"],
    ["Trait starts the run at Lv 5"],
    ["Status Screen +1 slam"],
    ["+5% might", (s) => void (s.might += 0.05)],
    ['+1 card on every level-up ("he didn\'t even notice")', (s) => void (s.cards += 1)],
  ]),
};

export const TRUCK_KUN: HeroDef = {
  id: "truck_kun",
  name: "Truck-kun",
  title: "The Isekai Truck (Playable)",
  sprite: "truck_kun",
  portrait: "portrait_truck_kun",
  weapon: "horn_of_reincarnation",
  ult: "isekai_express",
  trait: "180 max HP, 3 armor, +50% pickup, -15% move speed, can't be knocked back, bigger hitbox",
  color: C.white,
  colors: [C.white, C.lightBlue, C.yellow, C.blue],
  band: ["#e9e3f7", "#5aa8ff", "#1f2a73"],
  cutinLine: "HONK HONK. (Translation: Your next life will be better.)",
  apply: (s) => {
    s.maxHp += 80;
    s.armor += 3;
    s.pickup += 0.5;
    s.moveSpeed -= 0.15;
    // player radius 9 (6 x 1.5)
    s.hitbox += 0.5;
  },
  // Heavy Vehicle: drives like a truck (heading + throttle) and ignores hit recoil
  install: (w) => void installTruck(w),
  constellations: stars("horn_of_reincarnation", [
    ["+20 max HP", (s) => void (s.maxHp += 20)],
    ["Horn of Reincarnation starts at Lv2"],
    ["Trait becomes 5 armor and -5% move speed", (s) => void ((s.armor += 2), (s.moveSpeed += 0.1))],
    ["Isekai Express +1 lane"],
    ["+10% might", (s) => void (s.might += 0.1)],
    ["Now With Trailer: a trailer follows on a rope and rams like the cab", undefined, installTrailer],
  ]),
};

/** Senpai, Magical Girl #47, Isekai-kun, Truck-kun (roster order 8-11). */
export const HEROES_B: HeroDef[] = [SENPAI, MAGICAL_GIRL_47, ISEKAI_KUN, TRUCK_KUN];
