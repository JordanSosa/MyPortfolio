/** Balance lab jobs `window` / `full` (tools/balance-lab/jobs.ts): real runs from 0:00 with the bot, 30 s / 60 s marks. */
import { simulate } from "../../src/debug/bot";
import { xpToNext } from "../../src/game/config";
import { stageDef } from "../../src/game/registry";
import type { World } from "../../src/game/world";
import { DT, type Mark, type RunRec } from "./jobs";
import { buildOf, cellWorld, jobBot, type CellSpec } from "./snapshot";

function killerOf(w: World): string {
  const px = w.player.x;
  const py = w.player.y - 8;
  let best = 1e9;
  let k = "?";
  for (let i = 0; i < w.bullets.count; i++) {
    const b = w.bullets.items[i];
    const d = (b.x - px) ** 2 + (b.y - py) ** 2;
    if (d < 100 && d < best) {
      best = d;
      k = `bullet:${b.sprite}`;
    }
  }
  if (k === "?")
    for (let i = 0; i < w.enemies.count; i++) {
      const en = w.enemies.items[i];
      if (en.dead || en.def.prop) continue;
      const d = (en.x - px) ** 2 + (en.y - en.cy - py) ** 2 - en.r * en.r * 4;
      if (d < best) {
        best = d;
        k = en.def.id + (en.elite ? "*" : "");
      }
    }
  return k;
}

/** XP earned so far (the levels' costs + the current bar). */
export const xpTotal = (w: World): number => {
  let x = w.xp;
  for (let l = 1; l < w.level; l++) x += xpToNext(l);
  return x;
};

/** Play a cell from 0:00 to `T` (or its end), recording 30 s marks. */
export function playRun(c: CellSpec, T: number, markEvery = 30): RunRec {
  const w = cellWorld(c);
  const bot = jobBot(c.bot, c.seed);
  const bosses: RunRec["bosses"] = [];
  let cur: RunRec["bosses"][number] | null = null;
  let curE: { hp: number; maxHp: number } | null = null;
  w.bus.on("bossSpawn", (e) => {
    cur = { id: e.enemy.def.id, at: Math.round(w.t), dur: -1, left: 1 };
    curE = e.enemy;
    bosses.push(cur);
  });
  w.bus.on("bossKilled", () => {
    if (cur && cur.dur < 0) cur.dur = Math.round((w.t - cur.at) * 10) / 10;
    cur = null;
    curE = null;
  });
  let revives = 0;
  w.bus.on("playerRevived", () => revives++);
  let dmg = 0;
  let killer = "";
  w.bus.on("playerHurt", (e) => {
    dmg += e.dmg;
    if (w.player.hp <= 0) killer = killerOf(w);
  });
  const marks: Mark[] = [];
  let next = markEvery;
  let aliveAcc = 0;
  let aliveN = 0;
  const steps = simulate(w, T, DT, bot, (ww) => {
    aliveAcc += ww.enemyCount;
    aliveN++;
    if (cur && curE) cur.left = Math.round((curE.hp / curE.maxHp) * 100) / 100;
    if (ww.t >= next) {
      let dealt = 0;
      for (const v of ww.damageBy.values()) dealt += v;
      marks.push({ t: next, level: ww.level, hp: Math.round((ww.player.hp / ww.player.maxHp) * 100) / 100, dmg: Math.round(dmg), kills: ww.kills, dealt: Math.round(dealt), xp: Math.round(xpTotal(ww)), alive: Math.round(aliveAcc / Math.max(1, aliveN)), adapt: Math.round(ww.director.adapt * 100) / 100 });
      aliveAcc = aliveN = 0;
      next += markEvery;
    }
  });
  const outcome: RunRec["outcome"] = w.phase === "victory" || w.stageCleared ? "clear" : w.phase === "dead" ? "death" : w.t >= stageDef(c.stage).duration + 299 ? "timeout" : "alive";
  return { outcome, end: Math.round(w.t * 10) / 10, level: w.level, kills: w.kills, revives, marks, bosses, killer, build: buildOf(w), maxHp: w.player.maxHp, steps };
}

