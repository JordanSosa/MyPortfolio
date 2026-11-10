/**
 * Destructible props of the Beach Episode and The Final Arc (stages.md §3-4):
 * enemies with `prop: true` like the meadow's lanterns (hit by every weapon,
 * never auto-aimed, no contact damage, no kill credit; loot rolled by World).
 * Each stage names its own (`StageDef.props.ids`), so none of these ever show
 * up in another stage. Looks: the beach ball pops into confetti, the cooler
 * holds something chilled (beach-episode.ts onStart), the CRT TV flickers to
 * static, the clapperboard reads "TAKE 47" (view: beach-fx.ts / finale-fx.ts).
 */
import { C } from "../../art/palette";
import type { EnemyDef } from "../types";

const still = (): void => {};

function prop(id: string, name: string, radius: number, height: number, shadow: number, colors: readonly number[], fps?: number): EnemyDef {
  return { id, name, sprite: id, fps, hp: 1, speed: 0, dmg: 0, radius, height, xp: 0, shadow, prop: true, noElite: true, noSeparation: true, colors, update: still };
}

export const beachBall = prop("prop_beachball", "Beach Ball", 6, 11, 11, [C.red, C.white, C.blue, C.yellow], 3);
export const cooler = prop("prop_cooler", "Cooler", 7, 11, 13, [C.blue, C.white, C.lightBlue, C.aqua]);
export const clapboard = prop("prop_clapboard", "Clapperboard", 7, 13, 12, [C.white, C.outline, C.yellow]);
export const crtTv = prop("prop_crt_tv", "CRT TV", 7, 13, 12, [C.lavender, C.cyan, C.pink, C.lime], 4);

export const enemies: EnemyDef[] = [beachBall, cooler, clapboard, crtTv];
