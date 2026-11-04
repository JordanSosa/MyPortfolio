/** Balance lab job `gauge` (tools/balance-lab/jobs.ts): a build's damage against a dense immortal crowd and a pinned boss. */
import { defaultRunConfig, type RunConfig } from "../../src/game/run-config";
import { World } from "../../src/game/world";
import { checkpointRun } from "../checkpoints";
import { DT, type GaugeJob, type GaugeResult } from "./jobs";
import { cpId } from "./overrides";

function clearWeapons(w: World): void {
  for (const inst of w.weapons) {
    inst.def.dispose?.(w, inst);
    for (const p of inst.projs) p.dead = true;
  }
  w.weapons.length = 0;
  w.buildVersion++;
}

function gaugeWorld(j: GaugeJob, seed: number): World {
  let run: RunConfig;
  if (j.cp) run = checkpointRun(cpId(j.cp), { hero: j.hero, stage: "dream_meadow" }).config;
  else run = defaultRunConfig();
  // Limit Break levels (past the def's levels) need the mastery bonus
  const lb: Record<string, number> = { ...(run.weaponLevelBonus ?? {}) };
  for (const [id, lv] of j.weapons) lb[id] = Math.max(lb[id] ?? 0, lv - 5);
  run = { ...run, weaponLevelBonus: lb, start: { level: 1, weapons: [] }, weaponSlots: Math.max(run.weaponSlots, j.weapons.length) };
  const w = new World({ hero: j.hero, seed, director: false, god: true, run, maxEnemies: 400 });
  clearWeapons(w);
  for (const [id, lv] of j.passives ?? []) w.addPassive(id, lv);
  for (const [id, lv] of j.weapons) w.addWeapon(id, lv);
  const st = j.stat;
  if (st) {
    w.statMods.push((s) => {
      if (st.cooldown) s.cooldown *= st.cooldown;
      if (st.area) s.area *= st.area;
      if (st.amount) s.amount += st.amount;
      if (st.might) s.might *= st.might;
    });
  }
  w.recomputeStats();
  w.player.hp = w.player.maxHp;
  return w;
}

/** Pinned boss distance (px above the hero): close enough for orbits and auras, in range of everything. */
const BOSS_D = 32;

export function runGauge(j: GaugeJob): GaugeResult {
  const T = j.T ?? 8;
  const res = (mode: "dense" | "boss") => {
    const w = gaugeWorld(j, 3);
    let hits = 0;
    w.hooks.on("hit", () => void hits++);
    const boss = mode === "boss" ? w.spawnEnemy("king_puff", w.player.x, w.player.y - BOSS_D) : null;
    if (boss) boss.maxHp = boss.hp = 1e12;
    // warm-up 1 s (orbits / auras spin up), then measure
    let dealt0 = 0;
    const by0 = new Map<string, number>();
    const steps = Math.round((T + 1) / DT);
    for (let i = 0; i < steps; i++) {
      // the hero walks a slow circle like a player (standing still dozes off under the Kotatsu of Sloth)
      const a = i * DT * 1.3;
      w.input.mx = Math.cos(a);
      w.input.my = Math.sin(a);
      if (boss) {
        boss.x = w.player.x;
        boss.y = w.player.y - BOSS_D;
        boss.vx = boss.vy = 0;
        boss.state = 2; // King Puff's rest state: stays put
        boss.timer = 0;
      } else {
        while (w.enemyCount < 120) {
          const a = w.rng.angle();
          const r = 20 + w.rng.next() * 110;
          const e = w.spawnEnemy("puff", w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r);
          if (!e) break;
          e.maxHp = e.hp = 1e12;
        }
      }
      w.step(DT);
      if (w.pendingLevels) w.pendingLevels = 0;
      if (i === Math.round(1 / DT) - 1) {
        hits = 0;
        for (const inst of w.weapons) by0.set(inst.def.id, inst.damage);
        dealt0 = [...w.damageBy.values()].reduce((a, b) => a + b, 0);
      }
    }
    const by: Record<string, number> = {};
    for (const inst of w.weapons) by[inst.def.id] = Math.round((inst.damage - (by0.get(inst.def.id) ?? 0)) / T);
    const total = [...w.damageBy.values()].reduce((a, b) => a + b, 0) - dealt0;
    return { dps: Math.round(total / T), hps: Math.round((hits / T) * 10) / 10, by };
  };
  const d = res("dense");
  const b = res("boss");
  return { dense: d, boss: { dps: b.dps, by: b.by }, ...(j.horde ? { horde: j.horde.hp.map((hp) => horde(j, hp, j.horde!.alive, T)) } : {}) };
}


/** Kill throughput against a walking-in horde of `hp` HP enemies kept at `alive` on screen (spawned at the edge). */
function horde(j: GaugeJob, hp: number, alive: number, T: number): { hp: number; kps: number; dps: number } {
  const w = gaugeWorld(j, 5);
  const warm = 2;
  const steps = Math.round((T + warm) / DT);
  let kills0 = 0;
  let dealt0 = 0;
  const fill = () => {
    for (let g = 0; g < 400 && w.enemyCount < alive; g++) {
      w.edgePoint(14 + w.rng.next() * 14, w.tmp, true);
      const e = w.spawnEnemy("puff", w.tmp.x, w.tmp.y);
      if (!e) break;
      e.maxHp = e.hp = hp;
    }
  };
  for (let i = 0; i < steps; i++) {
    const a = i * DT * 1.3;
    w.input.mx = Math.cos(a);
    w.input.my = Math.sin(a);
    fill();
    w.step(DT);
    if (w.pendingLevels) w.pendingLevels = 0;
    if (i === Math.round(warm / DT) - 1) {
      kills0 = w.kills;
      dealt0 = [...w.damageBy.values()].reduce((x, y) => x + y, 0);
    }
  }
  const dealt = [...w.damageBy.values()].reduce((x, y) => x + y, 0) - dealt0;
  return { hp, kps: Math.round(((w.kills - kills0) / T) * 10) / 10, dps: Math.round(dealt / T) };
}
