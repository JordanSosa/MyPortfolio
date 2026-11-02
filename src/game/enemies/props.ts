/**
 * Destructible props (DESIGN §3.7): lanterns and gift boxes spawned by the
 * director every ~20 s just off-screen. They are enemies with `prop: true`:
 * hit by every weapon, never targeted by auto-aim, no contact damage, no
 * kill credit. Loot is rolled by World (food, coins, magnet, bomb, clock).
 */
import { C } from "../../art/palette";
import type { EnemyDef } from "../types";

const still = (): void => {};

export const lantern: EnemyDef = {
  id: "prop_lantern",
  name: "Paper Lantern",
  sprite: "prop_lantern",
  fps: 5,
  hp: 1,
  speed: 0,
  dmg: 0,
  radius: 6,
  height: 18,
  xp: 0,
  shadow: 10,
  prop: true,
  noElite: true,
  noSeparation: true,
  colors: [C.orange, C.yellow, C.red, C.paleYellow],
  update: still,
};

export const gift: EnemyDef = {
  id: "prop_gift",
  name: "Gift Box",
  sprite: "prop_gift",
  hp: 1,
  speed: 0,
  dmg: 0,
  radius: 7,
  height: 13,
  xp: 0,
  shadow: 13,
  prop: true,
  noElite: true,
  noSeparation: true,
  colors: [C.mint, C.pink, C.white, C.yellow],
  update: still,
};

export const enemies: EnemyDef[] = [lantern, gift];
