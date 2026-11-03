/**
 * Shoujo Academy destructible props (stages.md §2): a classic desk with a
 * carved heart (breaks into paper scraps) and a pastel drink vending machine
 * (drops a chilled can that counts as food: the stage's prop hook). Regular
 * prop loot is rolled by World.
 */
import { C } from "../../art/palette";
import type { EnemyDef } from "../types";

const still = (): void => {};

export const schoolDesk: EnemyDef = {
  id: "prop_school_desk",
  name: "School Desk",
  sprite: "prop_school_desk",
  hp: 1,
  speed: 0,
  dmg: 0,
  radius: 7,
  height: 11,
  xp: 0,
  shadow: 13,
  prop: true,
  noElite: true,
  noSeparation: true,
  colors: [C.white, C.offWhite, C.gold, C.pinkLight],
  update: still,
};

export const vending: EnemyDef = {
  id: "prop_vending",
  name: "Vending Machine",
  sprite: "prop_vending",
  fps: 3,
  hp: 1,
  speed: 0,
  dmg: 0,
  radius: 6,
  height: 20,
  xp: 0,
  shadow: 12,
  prop: true,
  noElite: true,
  noSeparation: true,
  colors: [C.lightBlue, C.pinkLight, C.white, C.aqua, C.yellow],
  update: still,
};

export const enemies: EnemyDef[] = [schoolDesk, vending];
