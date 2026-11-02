/**
 * Headless balance probe (not part of `npm test`): runs the autoplay bot for
 * every hero x seed and prints the level / kill / damage timeline.
 *
 *   npm run balance
 *   HEROES=mochi SEEDS=1,2,3,4,5 T=600 npm run balance
 *
 * Read: first level-up time, level + kills + alive enemies + HP + combo every
 * 30 s, final build, and level-ups per minute (aim ~4-7 after minute 1).
 */
import { test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { World } from "../src/game/world";

test("balance probe", () => {
  const heroes = (process.env.HEROES ?? "hoshi,rin,mochi").split(",");
  const seeds = (process.env.SEEDS ?? "1,2,3").split(",").map(Number);
  const T = Number(process.env.T ?? 300);
  for (const hero of heroes) {
    for (const seed of seeds) {
      const w = new World({ hero, seed, viewW: 216, viewH: 384 });
      const lv: number[] = [];
      let last = 1;
      let hurt = 0;
      let bossAt = -1;
      let bossDead = -1;
      w.bus.on("playerHurt", () => hurt++);
      w.bus.on("bossSpawn", () => (bossAt = w.t));
      w.bus.on("bossKilled", () => (bossDead = w.t));
      const marks: string[] = [];
      let nextMark = 30;
      simulate(w, T, 1 / 30, new Bot(seed ^ 77), (ww) => {
        if (ww.level !== last) {
          for (let l = last + 1; l <= ww.level; l++) lv.push(ww.t);
          last = ww.level;
        }
        if (ww.t >= nextMark) {
          marks.push(`${nextMark}s:L${ww.level} k${ww.kills} e${ww.enemyCount} hp${Math.round(ww.player.hp)} c${ww.combo}`);
          nextMark += 30;
        }
      });
      const per: number[] = [];
      for (let m = 0; m < T / 60; m++) per.push(lv.filter((t) => t >= m * 60 && t < (m + 1) * 60).length);
      const boss = bossAt >= 0 ? ` boss ${bossAt.toFixed(0)}s->${bossDead >= 0 ? `${(bossDead - bossAt).toFixed(1)}s` : "alive"}` : "";
      console.log(
        `${hero} s${seed}: first L2 ${lv[0]?.toFixed(1)}s | final L${w.level} k${w.kills} ${w.phase} dmgTaken=${Math.round(w.damageTaken)} hurt=${hurt}${boss}\n` +
          `   ${marks.join(" | ")}\n` +
          `   build: ${w.weapons.map((x) => `${x.def.id}:${x.level}`).join(",")} / ${w.passives.map((p) => `${p.def.id}:${p.level}`).join(",")}\n` +
          `   level-ups per minute: ${per.join(" ")}`,
      );
    }
  }
}, 900_000);
