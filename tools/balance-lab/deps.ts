/**
 * What a cached lab result depends on (cache keys, tools/balance-lab/cache.ts):
 *
 *   engine     every src/game file that is not a stage / enemy / boss content file (world, director,
 *              weapons, passives, heroes, relics, talents, twists, upgrades...), src/core, the bot and
 *              the lab's own sim code: a change there recomputes everything;
 *   stage      a stage's file + the files of every enemy / boss it can spawn (its timeline, events,
 *              bosses, and any enemy id those files mention): a change there recomputes that stage only;
 *   meta       src/meta + the balance tools' player policy (the progression sample only: combat cells key
 *              on the RunConfig the meta layer produced instead, see `runFingerprint`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, sha } from "./cache";
import { DT } from "./jobs";
import type { RunConfig } from "../../src/game/run-config";
import { baseStats, finalizeStats } from "../../src/game/stats";
import { STAGES } from "../../src/game/registry";
import { stageBosses, stageEnemies } from "../../src/game/stage";

type ContentMod = { stages?: { id: string }[]; enemies?: { id: string }[]; bosses?: { id: string }[] };
const stageMods = import.meta.glob<ContentMod>("../../src/game/stages/*.ts", { eager: true });
const enemyMods = import.meta.glob<ContentMod>("../../src/game/enemies/*.ts", { eager: true });
const bossMods = import.meta.glob<ContentMod>("../../src/game/bosses/*.ts", { eager: true });

const rel = (globKey: string) => join("src/game", globKey.replace(/^\.\.\/\.\.\/src\/game\//, ""));

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(join(ROOT, dir)).sort()) {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (/\.(ts|mjs|js)$/.test(n)) out.push(p);
  }
  return out;
}

const fileHash = new Map<string, string>();
function hashFile(p: string): string {
  let h = fileHash.get(p);
  if (!h) {
    h = sha(readFileSync(join(ROOT, p), "utf8"));
    fileHash.set(p, h);
  }
  return h;
}

/** Content id -> source file (stages, enemies, bosses: the files a stage's cache key is made of). */
const idFile = new Map<string, string>();
const contentFiles = new Set<string>();
for (const [mods, key] of [
  [stageMods, "stages"],
  [enemyMods, "enemies"],
  [bossMods, "bosses"],
] as const) {
  for (const [k, m] of Object.entries(mods)) {
    const f = rel(k);
    const list = (m as ContentMod)[key];
    if (!list || /\/_[^/]*$/.test(f)) continue;
    contentFiles.add(f);
    for (const d of list) idFile.set(d.id, f);
  }
}

/** Weapon id -> its content file (src/game/weapons/<name>.ts; the `_helpers` stay engine code). */
type WeaponMod = { weapons?: { id: string }[] };
const weaponMods = import.meta.glob<WeaponMod>("../../src/game/weapons/*.ts", { eager: true });
const weaponFile = new Map<string, string>();
const weaponFiles = new Set<string>();
for (const [k, m] of Object.entries(weaponMods)) {
  const f = rel(k);
  if (!m.weapons || /\/_[^/]*$/.test(f)) continue;
  weaponFiles.add(f);
  for (const d of m.weapons) weaponFile.set(d.id, f);
}

/**
 * Hash of the content files of some weapons (the weapon bench: a job recomputes when a weapon it holds, or its
 * hero's signature weapon - hero traits and talents import helpers from that file - changes; the other weapon
 * files do not touch it).
 */
export function weaponFilesHash(ids: string[]): string {
  const files = [...new Set(ids.map((id) => weaponFile.get(id)).filter((f): f is string => !!f))].sort();
  return sha(files.map((f) => `${f}:${hashFile(f)}`));
}

/** Lab files whose code each kind of sim job runs (the rest of the lab is reporting / modelling). */
// (jobs.ts itself is types + the dispatcher: its sim step DT is keyed by value, so a new job kind keeps the cache)
const SIM_COMMON = ["tools/balance-lab/overrides.ts", "tools/checkpoints.ts", "tools/policy.ts"];
const SIM_LAB: Record<string, string[]> = {
  gauge: ["tools/balance-lab/job-gauge.ts"],
  path: ["tools/balance-lab/job-snap.ts", "tools/balance-lab/job-run.ts", "tools/balance-lab/snapshot.ts"],
  slice: ["tools/balance-lab/job-snap.ts", "tools/balance-lab/job-run.ts", "tools/balance-lab/snapshot.ts"],
  boss: ["tools/balance-lab/job-snap.ts", "tools/balance-lab/job-run.ts", "tools/balance-lab/snapshot.ts"],
  census: ["tools/balance-lab/job-snap.ts", "tools/balance-lab/job-run.ts", "tools/balance-lab/snapshot.ts"],
  window: ["tools/balance-lab/job-run.ts", "tools/balance-lab/snapshot.ts"],
  full: ["tools/balance-lab/job-run.ts", "tools/balance-lab/snapshot.ts"],
  progression: ["tools/balance-lab/job-prog.ts"],
  weapon: ["tools/balance-lab/job-weapon.ts", "tools/balance-lab/snapshot.ts"],
};

let srcFiles: string[] | null = null;
const engine = new Map<string, string>();
/**
 * Hash of the shared sim code for a kind of job (see the module comment): the src files of the loaded
 * module graph (boot.mjs leaves it in globalThis.__kkLabGraph; src/meta excluded - combat keys on the
 * RunConfig it builds) or, without it, every src/game + src/core file; plus the lab code that job runs.
 */
export function engineHash(kind = "full"): string {
  // (the weapon bench keys each job on the files of the weapons it holds: weaponFilesHash)
  const perWeapon = kind === "weapon";
  const hit = engine.get(kind);
  if (hit) return hit;
  if (!srcFiles) {
    const graph = (globalThis as { __kkLabGraph?: string[] }).__kkLabGraph;
    const fromGraph = graph?.map((f) => relative(ROOT, f)).filter((f) => /^src\/(game|core|debug)\//.test(f));
    srcFiles = [...new Set(fromGraph?.length ? fromGraph : [...walk("src/game"), ...walk("src/core"), "src/debug/bot.ts"])].sort().filter((f) => !contentFiles.has(f));
  }
  const files = [...srcFiles.filter((f) => !perWeapon || !weaponFiles.has(f)), ...SIM_COMMON, ...(SIM_LAB[kind] ?? [])];
  const h = sha(DT, files.map((f) => `${f}:${hashFile(f)}`));
  engine.set(kind, h);
  return h;
}

let meta: string | null = null;
/** Hash of the account layer + the player policy (progression sample). */
export function metaHash(): string {
  if (meta) return meta;
  const files = [...walk("src/meta"), "tools/policy.ts", "tools/checkpoints.ts", "tools/progression.sim.ts", "tools/balance-lab/progression.lab.ts"];
  meta = sha(files.map((f) => `${f}:${hashFile(f)}`));
  return meta;
}

const stageDeps = new Map<string, Set<string>>();
/** Content ids (enemies / bosses / the stage) a stage's runs can touch. */
export function stageIds(stage: string): Set<string> {
  const hit = stageDeps.get(stage);
  if (hit) return hit;
  const def = STAGES.get(stage);
  const ids = new Set<string>([stage]);
  if (def) for (const id of [...stageEnemies(def), ...stageBosses(def), ...(def.props.ids ?? [])]) ids.add(id);
  // transitive: any enemy id quoted in a file of the set (summons, splits, boss adds)
  const known = [...idFile.keys()];
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of [...ids]) {
      const f = idFile.get(id);
      if (!f) continue;
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const k of known) if (!ids.has(k) && src.includes(`"${k}"`)) {
        ids.add(k);
        changed = true;
      }
    }
  }
  stageDeps.set(stage, ids);
  return ids;
}

/** Hash of a stage's own content files (see the module comment). */
export function stageHash(stage: string): string {
  const files = [...new Set([...stageIds(stage)].map((id) => idFile.get(id)).filter((f): f is string => !!f))].sort();
  return sha(stage, files.map((f) => `${f}:${hashFile(f)}`));
}

/** Hash of some content ids' files (gauges: the dummy enemies). */
export function idsHash(ids: string[]): string {
  return sha(ids.map((id) => `${id}:${idFile.has(id) ? hashFile(idFile.get(id)!) : "?"}`));
}

/**
 * Fingerprint of a RunConfig as the sim sees it: its data (functions dropped) plus the stats its
 * account mods produce - so an economy-only change in src/meta keeps every combat cell cached.
 */
export function runFingerprint(cfg: RunConfig): string {
  const s = baseStats();
  for (const m of cfg.mods) m(s);
  finalizeStats(s);
  return sha(JSON.stringify(cfg, (_k, v) => (typeof v === "function" ? undefined : v)), s);
}

/** Repo-relative path (reports). */
export const repoPath = (abs: string) => relative(ROOT, abs);

let ranged: Set<string> | null = null;
/** Enemy ids that fire bullets (their file calls the shared shoot / ring / fan helpers of enemies/_bullets.ts). */
export function rangedIds(): Set<string> {
  if (ranged) return ranged;
  ranged = new Set();
  for (const [id, f] of idFile) if (/\b(shoot|ring|fan)\(w\b/.test(readFileSync(join(ROOT, f), "utf8"))) ranged.add(id);
  return ranged;
}
