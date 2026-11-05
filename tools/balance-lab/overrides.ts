/**
 * What-if overrides (`--set`): dotted paths into the LIVE content, applied in-process
 * (never editing files) and undone afterwards, in the main process (the analytic model)
 * and in every worker (the real sim) alike.
 *
 *   stage.final_arc.scaling.hp=2.8        set a value (numbers, JSON arrays / objects, strings)
 *   weapon.star_shot.dmg*=1.2             multiply (also +=, -=); weapon.<id>.<dmg|cd|amount|area|...>
 *                                         is shorthand for that field of every level entry
 *   boss.*.hp*=0.9                        `*` = every id (or every key / array item at that depth)
 *   tuning.payout.coinsPerMinute*=0.8     the account layer's TUNING (economy: the progression sample)
 *   cp.P3.heroLevel=12                    an account checkpoint (tools/checkpoints.ts) field
 *   cfg.playerHp=100  enemy.puff.hp=12  hero.hoshi.weapon="petal_slash"  relic.<id>.<field>  twist.<id>.<field>  passive.<id>.<field>
 *
 * Roots: cfg (CFG), stage, enemy, boss, weapon, passive, relic, twist, hero, tuning (TUNING), cp.
 */
import { CFG } from "../../src/game/config";
import { HERO_BY_ID } from "../../src/game/heroes";
import { PASSIVE_BY_ID } from "../../src/game/passives";
import { BOSSES, ENEMIES, RELICS, STAGES, TWISTS, WEAPONS } from "../../src/game/registry";
import { TUNING } from "../../src/meta/tuning";
import { CHECKPOINTS } from "../checkpoints";
import { sha } from "./cache";

export type Op = "=" | "*=" | "+=" | "-=";

export interface Override {
  /** The source text (reports, cache keys). */
  text: string;
  path: string[];
  op: Op;
  value: unknown;
}

export const ROOTS = ["cfg", "stage", "enemy", "boss", "weapon", "passive", "relic", "twist", "hero", "tuning", "cp"] as const;
type Root = (typeof ROOTS)[number];

type Obj = Record<string, unknown>;

function parseValue(v: string): unknown {
  const s = v.trim();
  if (s === "true" || s === "false") return s === "true";
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return Number(s);
  if (/^[[{"]/.test(s)) return JSON.parse(s);
  return s;
}

/** Parse `path op value` ("stage.final_arc.scaling.hp=2.8", "weapon.star_shot.dmg*=1.2"). */
export function parseOverride(text: string): Override {
  const m = text.trim().match(/^([\w.*-]+?)\s*(\*=|\+=|-=|=)\s*(.+)$/);
  if (!m) throw new Error(`--set: cannot parse "${text}" (expected path=value, path*=x, path+=x or path-=x)`);
  const path = m[1].split(".");
  if (!(ROOTS as readonly string[]).includes(path[0])) throw new Error(`--set: unknown root "${path[0]}" in "${text}" (roots: ${ROOTS.join(", ")})`);
  if (path.length < (path[0] === "cfg" || path[0] === "tuning" ? 2 : 3)) throw new Error(`--set: path too short in "${text}"`);
  const op = m[2] as Op;
  const value = parseValue(m[3]);
  if (op !== "=" && typeof value !== "number") throw new Error(`--set: ${op} needs a number in "${text}"`);
  return { text: `${m[1]}${op}${m[3].trim()}`, path, op, value };
}

function rootMap(root: Root): ReadonlyMap<string, unknown> | null {
  switch (root) {
    case "stage":
      return STAGES;
    case "enemy":
      return ENEMIES;
    case "boss":
      return BOSSES;
    case "weapon":
      return WEAPONS;
    case "passive":
      return PASSIVE_BY_ID;
    case "relic":
      return RELICS;
    case "twist":
      return TWISTS;
    case "hero":
      return HERO_BY_ID;
    case "cp":
      return new Map(CHECKPOINTS.map((c) => [cpOriginal.get(c) ?? c.id, c]));
    default:
      return null;
  }
}

const WEAPON_LEVEL_KEYS = new Set(["dmg", "cd", "amount", "speed", "pierce", "area", "duration", "knock"]);

/** Every (object, key) the path names (wildcards expanded; weapon level shorthand). */
function targets(o: Override): [Obj, string][] {
  const [root, ...rest] = o.path as [Root, ...string[]];
  let objs: Obj[];
  let path = rest;
  if (root === "cfg") objs = [CFG as unknown as Obj];
  else if (root === "tuning") objs = [TUNING as unknown as Obj];
  else {
    const map = rootMap(root)!;
    const id = rest[0];
    path = rest.slice(1);
    const ids = id === "*" ? [...map.keys()] : [id];
    objs = [];
    for (const k of ids) {
      const v = map.get(k);
      if (!v) throw new Error(`--set: no ${root} "${k}" (${o.text})`);
      objs.push(v as Obj);
    }
    // weapon.<id>.dmg -> levels[*].dmg (the shorthand, when the def has no own field of that name)
    if (root === "weapon" && path.length === 1 && WEAPON_LEVEL_KEYS.has(path[0])) {
      const out: [Obj, string][] = [];
      for (const w of objs) {
        if (Object.prototype.hasOwnProperty.call(w, path[0])) out.push([w, path[0]]);
        else for (const lv of (w.levels as Obj[]) ?? []) if (typeof lv[path[0]] === "number") out.push([lv, path[0]]);
      }
      if (!out.length && !ids.includes("*")) throw new Error(`--set: weapon field "${path[0]}" not found (${o.text})`);
      return out;
    }
  }
  let cur: Obj[] = objs;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const nxt: Obj[] = [];
    for (const c of cur) {
      if (k === "*") for (const v of Object.values(c)) if (v && typeof v === "object") nxt.push(v as Obj);
      if (k !== "*") {
        const v = c[k];
        if (v && typeof v === "object") nxt.push(v as Obj);
        else if (v === undefined) {
          // a missing optional sub-object (a stage without its own `scaling`): create it, undone later
          const fresh: Obj = {};
          c[k] = fresh;
          created.push([c, k]);
          nxt.push(fresh);
        } else throw new Error(`--set: "${k}" is not an object (${o.text})`);
      }
    }
    cur = nxt;
  }
  const last = path[path.length - 1];
  const out: [Obj, string][] = [];
  for (const c of cur) {
    if (last === "*") for (const k of Object.keys(c)) out.push([c, k]);
    else out.push([c, last]);
  }
  return out;
}

let created: [Obj, string][] = [];

/** Checkpoint objects renamed while cp.* overrides are applied (their profiles are cached by id). */
const cpOriginal = new Map<object, string>();

/** The id a checkpoint has right now (renamed while a cp.* override is applied). */
export function cpId(id: string): string {
  for (const c of CHECKPOINTS) if ((cpOriginal.get(c) ?? c.id) === id) return c.id;
  return id;
}

/** Apply overrides to the live content; returns the undo function (call it before the next set). */
export function applyOverrides(set: readonly Override[]): () => void {
  const undo: (() => void)[] = [];
  created = [];
  for (const o of set) {
    for (const [obj, key] of targets(o)) {
      const had = Object.prototype.hasOwnProperty.call(obj, key);
      const old = obj[key];
      let v: unknown = o.value;
      if (o.op !== "=") {
        if (typeof old !== "number") throw new Error(`--set: ${o.text}: the current value is not a number (${JSON.stringify(old)})`);
        const x = o.value as number;
        v = o.op === "*=" ? old * x : o.op === "+=" ? old + x : old - x;
      } else if (v && typeof v === "object" && !Array.isArray(v) && old && typeof old === "object" && !Array.isArray(old)) v = { ...(old as Obj), ...(v as Obj) };
      obj[key] = v;
      undo.push(() => {
        if (had) obj[key] = old;
        else delete obj[key];
      });
    }
  }
  const made = created;
  undo.push(() => {
    for (const [c, k] of made) delete c[k];
  });
  // checkpoint overrides: rename the touched checkpoint and every later one (profiles are cumulative and
  // cached by id in tools/checkpoints.ts), so the overridden accounts are rebuilt instead of served stale
  const cps = set.filter((o) => o.path[0] === "cp");
  if (cps.length) {
    const tag = sha(cps.map((o) => o.text)).slice(0, 8);
    const first = Math.min(...cps.map((o) => (o.path[1] === "*" ? 0 : CHECKPOINTS.findIndex((c) => (cpOriginal.get(c) ?? c.id) === o.path[1]))).filter((i) => i >= 0));
    for (let i = first; i < CHECKPOINTS.length; i++) {
      const c = CHECKPOINTS[i] as { id: string };
      const orig = cpOriginal.get(c) ?? c.id;
      cpOriginal.set(c, orig);
      c.id = `${orig}~${tag}`;
      undo.push(() => {
        c.id = orig;
        cpOriginal.delete(c);
      });
    }
  }
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]();
  };
}

/**
 * Does an override change what a combat job on `stage` measures? (The cache key takes only these;
 * `tuning.*` / `cp.*` reach combat through the RunConfig fingerprint instead.) `ids` = the content ids
 * the job can touch (deps.stageIds; gauges: their dummy enemies), null = a job without a stage.
 */
export function relevant(o: Override, stage: string | null, ids: Set<string> | null): boolean {
  const [root, id] = o.path;
  switch (root) {
    case "tuning":
    case "cp":
      return false;
    case "stage":
      return stage !== null && (id === "*" || id === stage);
    case "enemy":
    case "boss":
      return id === "*" ? ids !== null : !!ids?.has(id);
    default:
      return true;
  }
}
