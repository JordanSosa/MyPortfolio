/**
 * Playable heroes (DESIGN §3.1). Sprites come from the art manifest:
 * `${sprite}_idle|run|hurt|cast` and `portrait_${id}`.
 */
import { C } from "../art/palette";
import type { HeroDef, HeroId } from "./types";

export const HEROES: HeroDef[] = [
  {
    id: "hoshi",
    name: "Hoshi",
    title: "Star Magician",
    sprite: "hoshi",
    portrait: "portrait_hoshi",
    weapon: "star_shot",
    ult: "supernova_shower",
    trait: "+10% projectile speed, -5% cooldown",
    color: C.pink,
    colors: [C.pink, C.yellow, C.cyan, C.pinkLight],
    apply: (s) => {
      s.projSpeed += 0.1;
      s.cooldown -= 0.05;
    },
  },
  {
    id: "rin",
    name: "Rin",
    title: "Shrine Swordswoman",
    sprite: "rin",
    portrait: "portrait_rin",
    weapon: "petal_slash",
    ult: "thousand_blossom_cut",
    trait: "+20 max HP, +10% damage",
    color: C.red,
    colors: [C.red, C.pinkLight, C.white, C.pink],
    apply: (s) => {
      s.maxHp += 20;
      s.might += 0.1;
    },
  },
  {
    id: "mochi",
    name: "Mochi",
    title: "Neko Girl",
    sprite: "mochi",
    portrait: "portrait_mochi",
    weapon: "yarn_orbit",
    ult: "nyan_stampede",
    trait: "+15% move speed, +20% pickup range",
    color: C.violet,
    colors: [C.lavender, C.violet, C.paleYellow, C.pinkLight],
    apply: (s) => {
      s.moveSpeed += 0.15;
      s.pickup += 0.2;
    },
  },
];

export const HERO_BY_ID: ReadonlyMap<string, HeroDef> = new Map(HEROES.map((h) => [h.id, h]));

export function heroDef(id: string | null | undefined): HeroDef {
  return HERO_BY_ID.get(id ?? "") ?? HEROES[0];
}

export const HERO_IDS: HeroId[] = HEROES.map((h) => h.id);
