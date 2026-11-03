/**
 * Headless balance probe (not part of `npm test`): plays full runs with the
 * autoplay bot for every hero x seed and prints per-run lines plus a summary
 * table per hero / bot (medians and ranges) against the pacing targets of
 * docs/ARCHITECTURE.md section 6.
 *
 *   npm run balance                                   # 3 heroes x 10 seeds, good + lazy bot, full runs (12 min)
 *   HEROES=mochi SEEDS=1,2,3 BOT=lazy npm run balance
 *   T=300 BOT=good VERBOSE=1 npm run balance          # 5 min, with the 30 s timeline per run
 *   META=mid|max  MAXE=150|250|350  VIEW=phone|land|desktop  DT=0.0167
 *   GAUGE=1 [IDS=star_shot,...] npm run balance       # per-weapon dps gauge instead of runs
 *   RUN="stage=dream_meadow&twists=budget_cuts:3,spoilers&relics=sakuga_cel:6&flags=dashCharges:1"
 *     npm run balance                                 # any Season 2 RunConfig, same syntax as the debug URL
 *                                                     # params (src/debug/params.ts debugRunConfig)
 *
 * BOT: `good` = the autoplay bot (dodges, dashes, picks a sensible build; the
 * average-player proxy) / `lazy` = random level-up picks and never dashes (a
 * weak-player proxy) / `both` (default).
 */
import { test } from "vitest";
import { Bot, simulate } from "../src/debug/bot";
import { RANKS, xpToNext } from "../src/game/config";
import { META } from "../src/game/meta";
import { debugRunConfig, type DebugParams } from "../src/debug/params";
import { stagePhaseAt } from "../src/game/stage";
import { WEAPONS } from "../src/game/registry";
import { World } from "../src/game/world";

const WEAPON_LIST = [...WEAPONS.values()];

interface Run {
  hero: string;
  seed: number;
  bot: string;
  firstL2: number;
  lv: Record<number, number>;
  /** Median seconds between level-ups in 2:00-8:00. */
  lvlInt: number;
  evo1: number;
  evos: number;
  boss: Record<string, { at: number; dur: number }>;
  outcome: "WIN" | "DIED" | "alive";
  end: number;
  dmg: number;
  /** Damage taken in the last 4 minutes of the run. */
  dmgLate: number;
  minHpLate: number;
  /** First time the alive count reached 90 % of the current cap. */
  capT: number;
  /** Mean alive / cap per minute. */
  capFrac: number[];
  /** Fraction of time at rank SSS per minute. */
  sss: number[];
  /** Fraction of time at rank S or better per minute. */
  sPlus: number[];
  /** Kills per second, per minute. */
  kps: number[];
  /** Damage taken per minute. */
  dpm: number[];
  /** Damage dealt per second (incl. overkill), per minute. */
  dps: number[];
  /** Director adaptive toughness at the end of each minute. */
  adapt: number[];
  /** Total XP earned by 1:00 / 3:00 / 6:00 / 9:00. */
  xpAt: Record<number, number>;
  /** Share of the dropped gem XP that was collected. */
  gemEff: number;
  breaks: number;
  ults: number;
  ultGap: number;
  kills: number;
  level: number;
  build: string;
  ms: number;
}

const MARKS = [60, 180, 360, 540];
/** Damage taken by source over every run of the current summary group. */
const HURT_BY = new Map<string, number>();
/** Final blow of every death in the current summary group. */
const KILLED_BY: string[] = [];
const VIEWS: Record<string, [number, number]> = { phone: [216, 384], land: [384, 216], desktop: [533, 300] };

function metaRanks(kind: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (kind === "mid") for (const m of META) out[m.id] = Math.ceil(m.maxRank / 2);
  else if (kind === "max") for (const m of META) out[m.id] = m.maxRank;
  return out;
}

const median = (a: number[]): number => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length & 1 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const fmt = (v: number, d = 0): string => (Number.isFinite(v) ? v.toFixed(d) : "-");
const range = (a: number[], d = 0): string => {
  const v = a.filter((x) => Number.isFinite(x));
  if (!v.length) return "-";
  return `${fmt(median(v), d)} [${fmt(Math.min(...v), d)}-${fmt(Math.max(...v), d)}]`;
};

/** RUN env -> a fresh RunConfig per World (undefined = the default Dream Meadow config). */
function runConfig() {
  const q = process.env.RUN;
  return q ? debugRunConfig({ query: q.startsWith("?") ? q : `?${q}` } as DebugParams) : undefined;
}

function play(hero: string, seed: number, botKind: string, T: number, dt: number, meta: Record<string, number>, maxE: number, view: [number, number], verbose: boolean): Run {
  const w = new World({ hero, seed, viewW: view[0], viewH: view[1], meta, maxEnemies: maxE, run: runConfig() });
  const bot = new Bot(seed ^ 77);
  if (botKind === "lazy") {
    bot.noDash = true;
    bot.randomPicks = true;
  }
  const lvT: number[] = [];
  let last = 1;
  const boss: Run["boss"] = {};
  let evo1 = -1;
  let evos = 0;
  let breaks = 0;
  const ultT: number[] = [];
  const hurtLog: [number, number][] = [];
  const hurtBy = new Map<string, number>();
  w.bus.on("playerHurt", (e) => {
    hurtLog.push([w.t, e.dmg]);
    // attribute the hit: an overlapping bullet, else the closest enemy (contact / blast)
    const px = w.player.x;
    const py = w.player.y - 8;
    let src = "?";
    let best = 1e9;
    for (let i = 0; i < w.bullets.count; i++) {
      const b = w.bullets.items[i];
      const d = (b.x - px) ** 2 + (b.y - py) ** 2;
      if (d < 100 && d < best) {
        best = d;
        src = `bullet:${b.sprite}`;
      }
    }
    if (src === "?")
      for (let i = 0; i < w.enemies.count; i++) {
        const en = w.enemies.items[i];
        if (en.dead || en.def.prop) continue;
        const d = (en.x - px) ** 2 + (en.y - en.cy - py) ** 2 - en.r * en.r * 4;
        if (d < best) {
          best = d;
          src = en.def.id + (en.elite ? "*" : "");
        }
      }
    hurtBy.set(src, (hurtBy.get(src) ?? 0) + e.dmg);
    lastSrc = src;
  });
  let lastSrc = "";
  w.bus.on("bossSpawn", (e) => (boss[e.enemy.def.id] = { at: w.t, dur: NaN }));
  w.bus.on("bossKilled", () => {
    for (const k of Object.keys(boss)) if (!Number.isFinite(boss[k].dur)) boss[k].dur = w.t - boss[k].at;
  });
  w.bus.on("evolution", () => {
    evos++;
    if (evo1 < 0) evo1 = w.t;
  });
  w.bus.on("comboBreak", (e) => {
    if (e.count >= RANKS[0].at) breaks++;
  });
  w.bus.on("ultStart", () => ultT.push(w.t));
  const mins = Math.ceil(T / 60);
  // gem economy: XP value dropped vs collected (before multipliers)
  let dropped = 0;
  let collected = 0;
  const drop = w.dropGem.bind(w);
  w.dropGem = (x, y, value, tier) => {
    if (tier !== 4) dropped += value;
    return drop(x, y, value, tier);
  };
  w.bus.on("gem", (e) => (collected += e.value));
  const capAcc = new Array(mins).fill(0);
  const sssAcc = new Array(mins).fill(0);
  const sAcc = new Array(mins).fill(0);
  const nAcc = new Array(mins).fill(0);
  const killAcc = new Array(mins).fill(0);
  const dmgAcc = new Array(mins).fill(0);
  let lastKills = 0;
  const dealtAcc = new Array(mins).fill(0);
  const adaptAt = new Array(mins).fill(NaN);
  const xpAt: Record<number, number> = {};
  let xpTotal = 0;
  let mi = 0;
  let lastDealt = 0;
  let capT = -1;
  let minHpLate = 1;
  const marks: string[] = [];
  let nextMark = 30;
  const t0 = performance.now();
  simulate(w, T, dt, bot, (ww) => {
    if (ww.level !== last) {
      for (let l = last + 1; l <= ww.level; l++) lvT.push(ww.t);
      last = ww.level;
    }
    const m = Math.min(mins - 1, Math.floor(ww.t / 60));
    const cap = Math.min(stagePhaseAt(ww.stage, ww.t).max, ww.maxEnemies);
    capAcc[m] += ww.enemyCount / cap;
    if (ww.comboRank >= 5) sssAcc[m]++;
    if (ww.comboRank >= 3) sAcc[m]++;
    nAcc[m]++;
    killAcc[m] += ww.kills - lastKills;
    lastKills = ww.kills;
    let dealt = 0;
    for (const v of ww.damageBy.values()) dealt += v;
    dealtAcc[m] += dealt - lastDealt;
    adaptAt[m] = ww.director.adapt;
    while (mi < MARKS.length && ww.t >= MARKS[mi]) {
      xpTotal = ww.xp;
      for (let l = 1; l < ww.level; l++) xpTotal += xpToNext(l);
      xpAt[MARKS[mi++]] = xpTotal;
    }
    lastDealt = dealt;
    if (capT < 0 && ww.enemyCount >= cap * 0.9) capT = ww.t;
    if (ww.t > 360) minHpLate = Math.min(minHpLate, ww.player.hp / ww.player.maxHp);
    if (verbose && ww.t >= nextMark) {
      marks.push(`${nextMark}s:L${ww.level} k${ww.kills} e${ww.enemyCount} hp${Math.round(ww.player.hp)} c${ww.combo}`);
      nextMark += 30;
    }
  });
  const ms = performance.now() - t0;
  const lv: Record<number, number> = {};
  // (only runs still playing at the mark count: a death at 4:00 is not "level 20 at 9:00")
  for (const t of MARKS) lv[t] = w.t >= t ? 1 + lvT.filter((x) => x <= t).length : NaN;
  const gaps: number[] = [];
  for (let i = 1; i < lvT.length; i++) if (lvT[i] >= 120 && lvT[i] < 480) gaps.push(lvT[i] - lvT[i - 1]);
  const ug: number[] = [];
  for (let i = 1; i < ultT.length; i++) ug.push(ultT[i] - ultT[i - 1]);
  const end = w.t;
  let dmgLate = 0;
  for (const [t, d] of hurtLog) {
    if (t >= end - 240) dmgLate += d;
    dmgAcc[Math.min(mins - 1, Math.floor(t / 60))] += d;
  }
  const div = (a: number[]) => a.map((v, i) => (nAcc[i] ? v / nAcc[i] : NaN));
  const r: Run = {
    hero,
    seed,
    bot: botKind,
    firstL2: lvT[0] ?? NaN,
    lv,
    lvlInt: median(gaps),
    evo1,
    evos,
    boss,
    outcome: w.phase === "victory" ? "WIN" : w.phase === "dead" ? "DIED" : "alive",
    end,
    dmg: w.damageTaken,
    dmgLate,
    minHpLate,
    capT,
    capFrac: div(capAcc),
    sss: div(sssAcc),
    sPlus: div(sAcc),
    kps: killAcc.map((k, i) => (nAcc[i] ? k / (nAcc[i] * dt) : NaN)),
    dpm: dmgAcc.map((d, i) => (nAcc[i] ? d : NaN)),
    dps: dealtAcc.map((d, i) => (nAcc[i] ? d / (nAcc[i] * dt) : NaN)),
    adapt: adaptAt,
    xpAt,
    gemEff: dropped > 0 ? collected / dropped : NaN,
    breaks,
    ults: ultT.length,
    ultGap: ug.length ? ug.reduce((a, b) => a + b, 0) / ug.length : NaN,
    kills: w.kills,
    level: w.level,
    build: `${w.weapons.map((x) => `${x.def.id}:${x.level}`).join(",")} / ${w.passives.map((p) => `${p.def.id}:${p.level}`).join(",")}`,
    ms,
  };
  const b = (id: string) => (r.boss[id] ? (Number.isFinite(r.boss[id].dur) ? `${r.boss[id].dur.toFixed(0)}s` : "alive") : "-");
  console.log(
    `${hero.padEnd(5)} ${botKind.padEnd(4)} s${String(seed).padEnd(2)} ${r.outcome.padEnd(5)}@${fmt(end)} L2 ${fmt(r.firstL2, 1)}s ` +
      `L@1/3/6/9 ${MARKS.map((t) => lv[t]).join("/")} gap ${fmt(r.lvlInt, 1)}s evo1 ${evo1 >= 0 ? fmt(evo1) : "-"} (${evos}) ` +
      `KP ${b("king_puff")} NT ${b("nightmare_teddy")} LL ${b("lady_lunatic")} dmg ${fmt(r.dmg)} late ${fmt(dmgLate)} minHp ${fmt(minHpLate * 100)}% ` +
      `cap@ ${capT >= 0 ? fmt(capT) : "-"} ult ${r.ults}x/${fmt(r.ultGap)}s SSS% ${r.sss.map((x) => fmt(x * 100)).join(",")} brk ${breaks} k${r.kills} ${fmt(ms)}ms`,
  );
  if (verbose)
    console.log(
      `   ${marks.join(" | ")}\n   build: ${r.build}\n   cap%: ${r.capFrac.map((x) => fmt(x * 100)).join(",")}\n` +
        `   hurt by: ${[...hurtBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    );
  for (const [k, v] of hurtBy) HURT_BY.set(k, (HURT_BY.get(k) ?? 0) + v);
  if (r.outcome === "DIED") KILLED_BY.push(`${lastSrc}@${fmt(end)}${w.boss ? `(vs ${w.boss.def.id})` : ""}`);
  return r;
}

function summarize(label: string, runs: Run[], hurt: Map<string, number>, killed: string[] = []): void {
  if (!runs.length) return;
  const n = runs.length;
  const wins = runs.filter((r) => r.outcome === "WIN").length;
  const deaths = runs.filter((r) => r.outcome === "DIED").map((r) => r.end);
  const bossDur = (id: string) => runs.map((r) => r.boss[id]?.dur ?? NaN);
  const perMin = (k: "capFrac" | "sss" | "sPlus" | "kps" | "dpm" | "dps" | "adapt", mul = 100) => {
    const mins = Math.max(...runs.map((r) => r[k].length));
    const out: string[] = [];
    for (let m = 0; m < mins; m++) out.push(fmt(median(runs.map((r) => r[k][m] ?? NaN)) * mul));
    return out.join(",");
  };
  console.log(
    `\n== ${label} (${n} runs) ==\n` +
      `  win ${wins}/${n} (${fmt((wins / n) * 100)}%)  deaths at ${deaths.length ? deaths.map((x) => fmt(x)).join(",") : "-"}\n` +
      `  first L2 ${range(runs.map((r) => r.firstL2), 1)}s | L@1:00 ${range(runs.map((r) => r.lv[60]))} | L@3:00 ${range(runs.map((r) => r.lv[180]))} | L@6:00 ${range(runs.map((r) => r.lv[360]))} | L@9:00 ${range(runs.map((r) => r.lv[540]))}\n` +
      `  XP earned @1/3/6/9 min ${MARKS.map((t) => range(runs.map((r) => r.xpAt[t] ?? NaN))).join(" | ")} | gems collected ${range(runs.map((r) => r.gemEff * 100))}%\n` +
      `  level-up gap 2-8 min ${range(runs.map((r) => r.lvlInt), 1)}s | first evo ${range(runs.map((r) => (r.evo1 >= 0 ? r.evo1 : NaN)))}s (none in ${runs.filter((r) => r.evo1 < 0).length}) | evos ${range(runs.map((r) => r.evos))}\n` +
      `  King Puff ${range(bossDur("king_puff"))}s | Nightmare Teddy ${range(bossDur("nightmare_teddy"))}s | Lady Lunatic ${range(bossDur("lady_lunatic"))}s\n` +
      `  dmg taken ${range(runs.map((r) => r.dmg))} | last 4 min ${range(runs.map((r) => r.dmgLate))} | min HP after 6:00 ${range(runs.map((r) => r.minHpLate * 100))}% | per min ${perMin("dpm", 1)}\n` +
      `  kills/s per min ${perMin("kps", 1)} | dmg dealt/s per min ${perMin("dps", 1)}\n` +
      `  adaptive toughness per min ${perMin("adapt")}%\n` +
      `  reach 90% cap at ${range(runs.map((r) => (r.capT >= 0 ? r.capT : NaN)))}s | alive/cap % per min ${perMin("capFrac")}\n` +
      `  SSS % per min ${perMin("sss")} | S+ % per min ${perMin("sPlus")} | combo breaks (>=C) ${range(runs.map((r) => r.breaks))}\n` +
      `  ults ${range(runs.map((r) => r.ults))} every ${range(runs.map((r) => r.ultGap))}s | kills ${range(runs.map((r) => r.kills))} | sim ${range(runs.map((r) => r.ms))}ms/run`,
  );
  if (killed.length) console.log(`  final blows: ${killed.join(", ")}`);
  if (hurt.size)
    console.log(
      `  hurt by (total over the group): ${[...hurt.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ")}`,
    );
}

/**
 * Weapon gauge (`GAUGE=1 npm run balance`, `IDS=star_shot,thunder_bell` to filter): damage per second of
 * each weapon alone at Lv 1 / 3 / 5 (evolutions: their single level) against (a) a dense crowd - 120
 * respawning 60-HP puffs 20-130 px around the hero, (b) a ring of 80 300-HP enemies 60-170 px out and
 * (c) a boss pinned 50 px above the hero (single-target / reach). 20 s each, 1/60 steps, no passives.
 */
function gauge(): void {
  const EVOS = WEAPON_LIST.filter((d) => d.evolved).map((d) => d.id);
  const ids = process.env.IDS ? process.env.IDS.split(",") : WEAPON_LIST.filter((d) => !d.evolved).map((d) => d.id).concat(EVOS);
  const DT = 1 / 60;
  const T = 20;
  const run = (id: string, lv: number, mode: "dense" | "ring" | "boss"): number => {
    const w = new World({ hero: "hoshi", seed: 3, director: false, god: true });
    w.weapons.length = 0;
    const inst = w.addWeapon(id, lv);
    if (!inst) return NaN;
    const boss = mode === "boss" ? w.spawnEnemy("king_puff", w.player.x, w.player.y - 50) : null;
    if (boss) boss.maxHp = boss.hp = 1e9;
    for (let t = 0; t < T; t += DT) {
      if (boss) {
        boss.x = w.player.x;
        boss.y = w.player.y - 50;
        boss.vx = boss.vy = 0;
        boss.state = 2; // King Puff's rest state: stays put
        boss.timer = 0;
      } else {
        const n = mode === "dense" ? 120 : 80;
        while (w.enemyCount < n) {
          const a = w.rng.angle();
          const r = mode === "dense" ? 20 + w.rng.next() * 110 : 60 + w.rng.next() * 110;
          const e = w.spawnEnemy("puff", w.player.x + Math.cos(a) * r, w.player.y + Math.sin(a) * r);
          if (e) e.maxHp = e.hp = mode === "dense" ? 60 : 300;
        }
      }
      w.step(DT);
    }
    return inst.damage / T;
  };
  console.log("weapon            lv |  dense |   ring |   boss   (dps)");
  for (const id of ids) {
    const evo = EVOS.includes(id);
    for (const lv of evo ? [1] : [1, 3, 5]) {
      const v = (["dense", "ring", "boss"] as const).map((m) => fmt(run(id, lv, m)).padStart(6));
      console.log(`${id.padEnd(16)} L${lv} | ${v.join(" | ")}`);
    }
  }
}

test("balance probe", () => {
  if (process.env.GAUGE) {
    gauge();
    return;
  }
  const heroes = (process.env.HEROES ?? "hoshi,rin,mochi").split(",");
  const seeds = (process.env.SEEDS ?? "1,2,3,4,5,6,7,8,9,10").split(",").map(Number);
  // 12:00 by default: the final boss arrives at 9:00 and enrages at 10:30, so a slow kill still resolves
  const T = Number(process.env.T ?? 720);
  const dt = Number(process.env.DT ?? 1 / 30);
  const bots = (process.env.BOT ?? "both") === "both" ? ["good", "lazy"] : [process.env.BOT as string];
  const meta = metaRanks(process.env.META ?? "0");
  const maxE = Number(process.env.MAXE ?? 350);
  const view = VIEWS[process.env.VIEW ?? "phone"] ?? VIEWS.phone;
  const verbose = !!process.env.VERBOSE;
  console.log(`balance probe: T=${T}s dt=${dt.toFixed(4)} meta=${process.env.META ?? "0"} maxEnemies=${maxE} view=${view.join("x")}${process.env.RUN ? ` run=${process.env.RUN}` : ""}`);
  const all: Run[] = [];
  const hurt = new Map<string, Map<string, number>>();
  const killedBy = new Map<string, string[]>();
  for (const botKind of bots)
    for (const hero of heroes) {
      HURT_BY.clear();
      KILLED_BY.length = 0;
      for (const seed of seeds) all.push(play(hero, seed, botKind, T, dt, meta, maxE, view, verbose));
      hurt.set(`${hero}/${botKind}`, new Map(HURT_BY));
      killedBy.set(`${hero}/${botKind}`, [...KILLED_BY]);
    }
  for (const botKind of bots) {
    const merged = new Map<string, number>();
    for (const hero of heroes) {
      const h = hurt.get(`${hero}/${botKind}`) ?? new Map<string, number>();
      for (const [k, v] of h) merged.set(k, (merged.get(k) ?? 0) + v);
      summarize(`${hero} / ${botKind} bot`, all.filter((r) => r.hero === hero && r.bot === botKind), h, killedBy.get(`${hero}/${botKind}`));
    }
    if (heroes.length > 1) summarize(`ALL HEROES / ${botKind} bot`, all.filter((r) => r.bot === botKind), merged);
  }
}, 3_600_000);
