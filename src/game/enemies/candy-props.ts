/**
 * Candy Kingdom destructible props (stages.md §1): a glass jar of sweets
 * (breaks into candy confetti) and a star pinata (bursts into coins and
 * wrapped sweets: the stage's prop hook adds the extra coins + a gumdrop
 * snack). Regular prop loot is rolled by World.
 */
import { C } from "../../art/palette";
import type { EnemyDef } from "../types";

const still = (): void => {};

export const candyJar: EnemyDef = {
  id: "prop_candy_jar",
  name: "Candy Jar",
  sprite: "prop_candy_jar",
  fps: 3,
  hp: 1,
  speed: 0,
  dmg: 0,
  radius: 6,
  height: 16,
  xp: 0,
  shadow: 10,
  prop: true,
  noElite: true,
  noSeparation: true,
  colors: [C.pink, C.yellow, C.cyan, C.lime, C.white, C.lightBlue],
  update: still,
};

export const pinata: EnemyDef = {
  id: "prop_pinata",
  name: "Star Pinata",
  sprite: "prop_pinata",
  fps: 3,
  hp: 1,
  speed: 0,
  dmg: 0,
  radius: 7,
  height: 16,
  xp: 0,
  shadow: 11,
  prop: true,
  noElite: true,
  noSeparation: true,
  colors: [C.yellow, C.pink, C.cyan, C.gold, C.white],
  update: still,
};

export const enemies: EnemyDef[] = [candyJar, pinata];
