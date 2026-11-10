/**
 * Season 2 content coverage: the registries against the content bible
 * (docs/content/*.md id lists, names and key numbers), the art manifest
 * (every referenced sprite id exists) and the audio contract (every sfx /
 * music id a content def names exists), plus the unlock path of everything a
 * player can earn and the hub-facing data (gacha pools, wiki copy, speech
 * pools, death lines).
 *
 * The bible is parsed from the markdown tables (backticked ids), so a row
 * added to the bible without its content - or content that drifts from the
 * bible's name / rarity / numbers - fails here with the exact id.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { MANIFEST } from "../src/art/manifest";
import { SONGS } from "../src/audio/music/songs";
import { RARITIES } from "../src/game/defs";
import { EVENT_HANDLERS } from "../src/game/director/events";
import { HEROES } from "../src/game/heroes";
import { PASSIVES } from "../src/game/passives";
import { BOSSES, ENEMIES, RELICS, STAGES, TALENT_TREES, TWISTS, ULTIMATES, WEAPONS } from "../src/game/registry";
import { finalBossAt, stageBosses } from "../src/game/stage";
import { World } from "../src/game/world";
import { ACHIEVEMENTS } from "../src/meta/achievements";
import { gameContent } from "../src/meta/content";
import { bannerPool, featuredCandidates, FEATURED_ROTATION } from "../src/meta/gacha/banners";
import { defaultProfile } from "../src/meta/profile";
import { ROSTER, ROSTER_BY_ID } from "../src/meta/roster";
import { UNLOCK_RULES, unlockRule, type UnlockKind } from "../src/meta/unlocks";
import { deathLine } from "../src/ui/hub/copy";
import { BIOS, BOSS_DEATH_LINES, WIKI } from "../src/ui/hub/copy-data";
import { SPEECH_POOLS } from "../src/view/speech";
import * as A2 from "../src/game/weapons/_arsenal2";
import { HB } from "../src/game/weapons/_hb";
import * as HA from "../src/game/weapons/_heroes-a";

const ROOT = join(__dirname, "..");
const doc = (f: string): string => readFileSync(join(ROOT, "docs/content", f), "utf8");
const src = (f: string): string => readFileSync(join(ROOT, "src", f), "utf8");

/**
 * Lines of a markdown section: from the first heading matching `from` to the next heading of the
 * same or higher level (`own`: to the next heading of any level, i.e. without its subsections).
 */
function section(md: string, from: RegExp, own = false): string[] {
  const lines = md.split("\n");
  const i0 = lines.findIndex((l) => /^#+ /.test(l) && from.test(l));
  if (i0 < 0) throw new Error(`bible section ${from} not found`);
  const level = /^#+/.exec(lines[i0])![0].length;
  const out: string[] = [];
  for (let i = i0 + 1; i < lines.length; i++) {
    const m = /^(#+) /.exec(lines[i]);
    if (m && (own || m[1].length <= level)) break;
    out.push(lines[i]);
  }
  return out;
}

/** Body rows (cells trimmed) of the markdown tables in a block of lines: header + separator rows skipped. */
function rows(lines: readonly string[]): string[][] {
  const out: string[][] = [];
  const isSep = (l: string | undefined) => !!l && /^\|(\s*:?-+:?\s*\|)+\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith("|") || isSep(l) || isSep(lines[i + 1])) continue;
    out.push(l.split("|").slice(1, -1).map((c) => c.trim()));
  }
  return out;
}

/** First backticked token of a cell ("`kuro` ●" -> "kuro"). */
const tick = (cell: string): string => /`([^`]+)`/.exec(cell)?.[1] ?? "";
const clock = (s: string): number => {
  const m = /(\d+):(\d\d)/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const lower = (s: string): string => s.toLowerCase().replace(/[’']/g, "'");

// ---------------------------------------------------------------- the bible's id lists
const HEROES_MD = doc("heroes.md");
const WEAPONS_MD = doc("weapons.md");
const ENEMIES_MD = doc("enemies.md");
const STAGES_MD = doc("stages.md");
const RELICS_MD = doc("relics.md");
const ACH_MD = doc("achievements.md");
const ART_MD = doc("art-manifest.md");

/** The slice's 8 + 8 (DESIGN.md), kept verbatim by the bible. */
const ORIGINAL_WEAPONS = ["star_shot", "petal_slash", "yarn_orbit", "heart_boomerang", "thunder_bell", "candy_bomb", "bubble_aura", "prism_beam"];
const ORIGINAL_PASSIVES = ["power_bow", "wish_charm", "big_ribbon", "twin_charm", "swift_shoes", "magnet_star", "lucky_clover", "heart_locket"];
const ORIGINAL_ENEMIES = ["puff", "batbun", "boo", "shroomie", "spore", "eyepuff", "pumpkin", "teddy", "wisp"];
/** Implementation-only actors that are not bible roster entries (EnemyDef.noCodex: the Animation Error's decoys). */
const ACTORS_NOT_IN_ROSTER = new Set([...ENEMIES.values()].filter((e) => e.noCodex).map((e) => e.id));

const bibleHeroes = rows(section(HEROES_MD, /^## 1\. Roster/, true)).map((r) => ({ id: tick(r[1]), name: r[2], title: r[3], weapon: tick(r[5]), ult: tick(r[6]) }));

const evoRows = rows(section(WEAPONS_MD, /^## 1\. Evolution pairs/)).map((r) => ({ base: r[0], passive: r[1], evo: r[2], id: tick(r[3]) }));
const lbRows = rows(section(WEAPONS_MD, /^## 4\. Limit Breaks/)).map((r) => ({ id: r[0], lv6: r[1], lv6Text: r[2], lv7: r[3], lv7Text: r[4] }));
const newPassiveRows = rows(section(WEAPONS_MD, /^## 5\. The 8 new passives/)).map((r) => ({ id: tick(r[0]), name: r[1] }));
const newWeaponHeads = section(WEAPONS_MD, /^## 2\. The 12 new weapons/)
  .map((l) => /^### 2\.\d+ (.+?) — `([a-z0-9_]+)`/.exec(l))
  .filter((m): m is RegExpExecArray => !!m)
  .map((m) => ({ name: m[1], id: m[2] }));
const newEvoRows = rows(section(WEAPONS_MD, /^## 3\. The 12 new evolutions/)).map((r) => ({ id: tick(r[0]), name: r[1] }));
/** §8.1: one row per base weapon's SECOND evolution (status `done` = implemented, `designed` = to do). */
const evo2Rows = rows(section(WEAPONS_MD, /^### 8\.1 The table/)).map((r) => ({ base: r[0], file: tick(r[1]), first: r[2], name: r[3], id: tick(r[4]), passive: r[5], pkg: r[6], status: r[7] }));

const bibleEnemies = ENEMIES_MD.split("\n")
  .map((l) => /^### (?!5\.)(.+?) — `([a-z0-9_]+)`(?: \(\+ split `([a-z0-9_]+)`\))?/.exec(l))
  .filter((m): m is RegExpExecArray => !!m)
  .map((m) => ({ name: m[1].replace(/^Twist enemy: /, ""), id: m[2], split: m[3] }));
const bibleBosses = section(ENEMIES_MD, /^## 5\. Bosses/)
  .map((l) => /^### 5\.\d+ (.+?) — `([a-z0-9_]+)`/.exec(l))
  .filter((m): m is RegExpExecArray => !!m)
  .map((m) => ({ name: m[1], id: m[2] }));

const bibleStages = rows(STAGES_MD.split("\n").slice(0, 20)).filter((r) => /^\d+$/.test(r[0])).map((r) => ({
  order: Number(r[0]),
  id: tick(r[1]),
  name: r[2],
  duration: Number(r[3]),
  finalAt: clock(r[4]),
  mids: r[5].split(",").map(clock).filter((x) => !Number.isNaN(x)),
  rewardMul: Number(r[6]),
  requires: tick(r[7]) || undefined,
  bpm: Number(r[8]),
}));

const bibleTwists = rows(section(STAGES_MD, /^## 6\. Plot Twists/))
  .filter((r) => /^\d+$/.test(r[0]))
  .map((r) => ({ id: tick(r[1]), name: r[2], ranks: Number(r[3]), heat: JSON.parse(r[4]) as number[], by: r[8] }));

const RARITY_HEAD: Record<string, string> = { N: "N", R: "R", SR: "SR", SSR: "SSR", UR: "UR", LR: "LR", MYTHIC: "MYTHIC" };
const bibleRelics: { id: string; name: string; rarity: string }[] = [];
{
  let rarity = "";
  for (const l of RELICS_MD.split("\n")) {
    const h = /^## (N|R|SR|SSR|UR|LR|MYTHIC) /.exec(l);
    if (h) rarity = RARITY_HEAD[h[1]];
    const m = /^\| `([a-z0-9_]+)` \| ([^|]+) \|/.exec(l);
    if (m && rarity) bibleRelics.push({ id: m[1], name: m[2].trim(), rarity });
  }
}

const ACH_CATS: Record<string, string> = { Story: "story", Combat: "combat", Heroes: "heroes", Weapons: "weapons", Gacha: "gacha", Silly: "silly" };
const bibleAch: { id: string; name: string; category: string; reward: string }[] = [];
const bibleAchCounts: Record<string, number> = {};
{
  let cat = "";
  for (const l of ACH_MD.split("\n")) {
    const h = /^## \d+\. (\w+) \((\d+)\)/.exec(l);
    if (h) {
      cat = ACH_CATS[h[1]] ?? "";
      if (cat) bibleAchCounts[cat] = Number(h[2]);
      continue;
    }
    if (/^## /.test(l)) cat = "";
    const m = /^\| `([a-z0-9_]+)`(?: ●)? \| ([^|]+) \|/.exec(l);
    if (m && cat) bibleAch.push({ id: m[1], name: m[2].trim(), category: cat, reward: l.split("|").slice(-2, -1)[0] ?? "" });
  }
}

/** Talent tree rows per hero (heroes.md §3): tier -> 3 cells "`id` **Name** ×N: ...". */
const bibleTalents: { hero: string; id: string; name: string; tier: number; branch: number; rank: number }[] = [];
{
  const lines = section(HEROES_MD, /^## 3\. Talent trees/);
  let hero = "";
  for (const l of lines) {
    const h = /^### (.+?) — /.exec(l);
    if (h) {
      hero = bibleHeroes.find((x) => x.name === h[1])?.id ?? "";
      continue;
    }
    const cells = l.startsWith("|") ? l.split("|").slice(1, -1).map((c) => c.trim()) : [];
    if (!hero || cells.length !== 4 || !/^\d$/.test(cells[0])) continue;
    const tier = Number(cells[0]);
    cells.slice(1).forEach((c, branch) => {
      const m = /^`([a-z0-9_]+)` \*\*(.+?)\*\*(?: ×(\d))?/.exec(c);
      if (m) bibleTalents.push({ hero, id: m[1], name: m[2], tier, branch, rank: m[3] ? Number(m[3]) : 1 });
    });
  }
}

/** Every sprite id the Season 2 art manifest (docs) lists. */
const bibleArt = new Set(rows(ART_MD.split("\n")).map((r) => tick(r[0])).filter((id) => /^[a-z0-9_]+$/.test(id)));

// ---------------------------------------------------------------- the code's id sets
const SPRITES = new Set(MANIFEST.map((m) => m.id));
/** Engine-provided extras outside the manifest (src/art/sprites/engine-fx.ts, docs/ENGINE.md). */
for (const m of src("art/sprites/engine-fx.ts").matchAll(/\bid: "([a-z0-9_]+)"/g)) SPRITES.add(m[1]);
/** audio/api.ts without comments (they contain ";" and quoted words). */
const API = src("audio/api.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
function unionIds(type: string): Set<string> {
  const block = new RegExp(`export type ${type} =([\\s\\S]*?);`).exec(API)?.[1] ?? "";
  return new Set([...block.matchAll(/"([a-zA-Z0-9_]+)"/g)].map((m) => m[1]));
}
const SFX = unionIds("SfxId");
const MUSIC = unionIds("MusicTrack");
const ctx = gameContent();

const hasSprite = (id: string): boolean => SPRITES.has(id);

/** Every .ts file under a directory. */
function walkTs(d: string, out: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walkTs(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
const missing = (ids: Iterable<string>, have: (id: string) => boolean): string[] => [...ids].filter((id) => !have(id));

// ================================================================================================
describe("the bible parses (sanity)", () => {
  test("id lists have their documented sizes", () => {
    expect(bibleHeroes).toHaveLength(11);
    expect(evoRows).toHaveLength(20);
    expect(lbRows).toHaveLength(20);
    expect(newPassiveRows).toHaveLength(8);
    expect(newWeaponHeads).toHaveLength(12);
    expect(newEvoRows).toHaveLength(12);
    expect(bibleEnemies.length + bibleEnemies.filter((e) => e.split).length).toBe(22 + 1 + 1); // 22 new + 1 split + the twist enemy
    expect(bibleBosses).toHaveLength(9);
    expect(bibleStages).toHaveLength(5);
    expect(bibleTwists).toHaveLength(15);
    expect(bibleRelics).toHaveLength(61);
    expect(bibleAch.length).toBe(Object.values(bibleAchCounts).reduce((a, b) => a + b, 0));
    expect(bibleTalents).toHaveLength(11 * 15);
    expect(SFX.size).toBeGreaterThan(80);
    expect(MUSIC.has("cancel")).toBe(true);
  });
});

// ================================================================================================
describe("heroes", () => {
  test("all 11 bible heroes are registered with the bible's name, title, start weapon and ultimate", () => {
    expect(HEROES.map((h) => h.id).sort()).toEqual(bibleHeroes.map((h) => h.id).sort());
    for (const b of bibleHeroes) {
      const h = HEROES.find((x) => x.id === b.id)!;
      expect([h.id, h.name, h.title, h.weapon, h.ult]).toEqual([b.id, b.name, b.title, b.weapon, b.ult]);
    }
  });

  test.each(HEROES.map((h) => [h.id, h] as const))("%s: weapon, ultimate, talents, constellations, art, unlock and roster line up", (id, h) => {
    const wpn = WEAPONS.get(h.weapon);
    expect(wpn && !wpn.evolved, `start weapon ${h.weapon}`).toBe(true);
    const ult = ULTIMATES.get(h.ult);
    expect(ult?.hero, `ultimate ${h.ult}`).toBe(id);
    expect(ult!.duration).toBeGreaterThan(0);
    const tree = TALENT_TREES.get(id);
    expect(tree?.nodes, `talent tree of ${id}`).toHaveLength(15);
    expect(h.constellations, "C1-C6").toHaveLength(6);
    expect(missing([`${h.sprite}_idle`, `${h.sprite}_run`, `${h.sprite}_hurt`, `${h.sprite}_cast`, h.portrait], hasSprite)).toEqual([]);
    expect(ROSTER_BY_ID.get(id), "roster entry").toBeTruthy();
    expect(UNLOCK_RULES.some((r) => r.kind === "hero" && r.id === id), "explicit unlock rule").toBe(true);
    // the signature weapon unlocks with its hero (or is a start weapon)
    const wr = unlockRule("weapon", h.weapon);
    expect(wr.cond.t === "start" || (wr.cond.t === "hero" && wr.cond.hero === id), `${h.weapon} unlock`).toBe(true);
    expect(BIOS[id], "OC bio").toBeTruthy();
    if (id !== "hoshi" && id !== "rin" && id !== "mochi") expect(h.cutinLine, "cut-in line").toBeTruthy();
  });

  test("talent trees match heroes.md §3 node for node (id, name, branch, tier, ranks)", () => {
    const code = [...TALENT_TREES.values()].flatMap((t) => t.nodes.map((n) => ({ hero: t.hero, id: n.id, name: n.name, tier: n.tier, branch: n.branch, rank: n.maxRank })));
    const key = (x: { hero: string; id: string }) => `${x.hero}:${x.id}`;
    expect(code.map(key).sort()).toEqual(bibleTalents.map(key).sort());
    for (const b of bibleTalents) {
      const n = code.find((c) => c.id === b.id)!;
      expect({ id: n.id, name: n.name, tier: n.tier, branch: n.branch, rank: n.rank }).toEqual({ id: b.id, name: b.name, tier: b.tier, branch: b.branch, rank: b.rank });
    }
  });

  test("roster sources match the unlock rules (gacha heroes only from the Merch Machine)", () => {
    for (const r of ROSTER) {
      const rule = unlockRule("hero", r.id);
      if (r.source === "gacha" || r.source === "mythic") expect(rule.cond.t, r.id).toBe("gacha");
      else expect(rule.cond.t, r.id).not.toBe("gacha");
    }
  });
});

// ================================================================================================
describe("weapons, evolutions, Limit Breaks, passives", () => {
  const byName = (name: string) => [...WEAPONS.values()].find((w) => lower(w.name) === lower(name));
  const passiveByName = (name: string) => PASSIVES.find((p) => lower(p.name) === lower(name));

  test("20 base weapons + 20 evolutions + 16 passives: exactly the bible's", () => {
    const bases = [...WEAPONS.values()].filter((w) => !w.evolved).map((w) => w.id).sort();
    const evos = [...WEAPONS.values()].filter((w) => w.evolved).map((w) => w.id).sort();
    expect(bases).toEqual(lbRows.map((r) => r.id).sort());
    // (first evolutions: §1; second evolutions: the `done` rows of §8.1)
    expect(evos).toEqual([...evoRows.map((r) => r.id), ...evo2Rows.filter((r) => r.status === "done").map((r) => r.id)].sort());
    expect(PASSIVES.map((p) => p.id).sort()).toEqual([...ORIGINAL_PASSIVES, ...newPassiveRows.map((r) => r.id)].sort());
    for (const id of ORIGINAL_WEAPONS) expect(bases).toContain(id);
  });

  test("the 12 new weapons, 12 evolutions and 8 passives carry the bible's names", () => {
    for (const b of newWeaponHeads) expect(WEAPONS.get(b.id)?.name, b.id).toBe(b.name);
    for (const b of newEvoRows) expect(WEAPONS.get(b.id)?.name, b.id).toBe(b.name);
    for (const b of newPassiveRows) expect(PASSIVES.find((p) => p.id === b.id)?.name, b.id).toBe(b.name);
  });

  test("every evolution recipe is the bible's pair (base + passive -> evolution), both sides registered", () => {
    for (const r of evoRows) {
      const base = byName(r.base);
      const passive = passiveByName(r.passive);
      expect(base, `base weapon '${r.base}'`).toBeTruthy();
      expect(passive, `passive '${r.passive}'`).toBeTruthy();
      expect(base!.evolutions?.[0], r.base).toEqual({ into: r.id, with: passive!.id });
      const evo = WEAPONS.get(r.id);
      expect(evo?.evolved, r.id).toBe(true);
      expect(lower(evo!.name), r.id).toBe(lower(r.evo));
      // exactly one base evolves into it
      expect([...WEAPONS.values()].filter((w) => w.evolutions?.some((e) => e.into === r.id))).toHaveLength(1);
    }
  });

  test("second evolutions (§8.1): one row per base weapon, a different passive, no passive gating more than 3", () => {
    expect(evo2Rows).toHaveLength(20);
    expect(new Set(evo2Rows.map((r) => r.id)).size).toBe(20);
    expect(new Set(evo2Rows.map((r) => r.base)).size).toBe(20);
    const load = new Map<string, number>();
    for (const r of evoRows) load.set(r.passive, (load.get(r.passive) ?? 0) + 1);
    for (const r of evo2Rows) {
      const first = evoRows.find((e) => e.base === r.base);
      expect(first, `§1 row of '${r.base}'`).toBeTruthy();
      expect(r.first, r.base).toBe(`${first!.evo} (${first!.passive})`);
      expect(r.passive, `${r.id}: a different passive from the first evolution`).not.toBe(first!.passive);
      expect(passiveByName(r.passive), `passive '${r.passive}'`).toBeTruthy();
      expect(byName(r.base), r.base).toBeTruthy();
      expect(existsSync(join(ROOT, "src/game/weapons", r.file)), r.file).toBe(true);
      expect(["done", "designed"]).toContain(r.status);
      expect(evoRows.some((e) => e.id === r.id), `${r.id} is a first evolution's id`).toBe(false);
      load.set(r.passive, (load.get(r.passive) ?? 0) + 1);
    }
    for (const [p, n] of load) expect(n, p).toBeLessThanOrEqual(3);
    expect([...load.values()].reduce((a, b) => a + b, 0)).toBe(40);
  });

  test("every implemented second evolution is its §8.1 row (id, name, base, passive), and every `done` row is implemented", () => {
    for (const b of [...WEAPONS.values()].filter((w) => !w.evolved)) {
      const evos = b.evolutions ?? [];
      expect(evos.length, `${b.id}: at most two evolutions`).toBeLessThanOrEqual(2);
      const row = evo2Rows.find((r) => lower(r.base) === lower(b.name));
      expect(row, `§8.1 row of ${b.name}`).toBeTruthy();
      const second = evos[1];
      expect(row!.status, `${b.id}: §8.1 status`).toBe(second ? "done" : "designed");
      if (!second) continue;
      expect(second, b.id).toEqual({ into: row!.id, with: passiveByName(row!.passive)!.id });
      const evo = WEAPONS.get(second.into);
      expect(evo?.evolved, second.into).toBe(true);
      expect(evo?.name, second.into).toBe(row!.name);
      expect(evo?.icon, second.into).toBe(`icon_${second.into}`);
      expect(evo?.desc.startsWith("EVOLUTION! "), `${second.into}: card desc`).toBe(true);
      expect(src(join("game/weapons", row!.file)), row!.file).toContain(`"${second.into}"`);
    }
  });

  test("Limit Breaks: every base weapon has Lv6 + Lv7 with the bible's numbers and card texts", () => {
    const parse = (s: string): Record<string, number> =>
      Object.fromEntries([...s.matchAll(/(\w+):\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));
    for (const r of lbRows) {
      const w = WEAPONS.get(r.id)!;
      expect(w.limitBreak, r.id).toHaveLength(2);
      const [l6, l7] = w.limitBreak!;
      const nums = (lb: object) => Object.fromEntries(Object.entries(lb).filter(([k, v]) => k !== "text" && v !== undefined));
      expect(nums(l6), `${r.id} Lv6`).toEqual(parse(r.lv6));
      expect(nums(l7), `${r.id} Lv7`).toEqual(parse(r.lv7));
      expect(l6.text, `${r.id} Lv6 text`).toBe(r.lv6Text.replace(/^"|"$/g, ""));
      expect(l7.text, `${r.id} Lv7 text`).toBe(r.lv7Text.replace(/^"|"$/g, ""));
    }
  });

  test.each([...WEAPONS.values()].map((w) => [w.id, w] as const))("%s: levels, icon, sfx", (id, w) => {
    expect(w.levels.length, "levels").toBe(w.evolved ? 1 : 5);
    if (!w.evolved) expect(w.upgrades, "upgrade texts Lv2..Lv5").toHaveLength(4);
    expect(hasSprite(w.icon), `icon ${w.icon}`).toBe(true);
    if (w.sfx) expect(SFX.has(w.sfx), `sfx ${w.sfx}`).toBe(true);
    if (w.hitSfx) expect(SFX.has(w.hitSfx), `hitSfx ${w.hitSfx}`).toBe(true);
    expect(w.desc.length, "card text").toBeGreaterThan(10);
  });

  test("passives: 5 level texts, an icon, an unlock rule", () => {
    for (const p of PASSIVES) {
      expect(p.levels, p.id).toHaveLength(5);
      expect(hasSprite(p.icon), `${p.id} icon ${p.icon}`).toBe(true);
      const r = unlockRule("passive", p.id);
      if (!ORIGINAL_PASSIVES.includes(p.id)) expect(r.cond.t, p.id).not.toBe("start");
    }
  });

  test("every new base weapon has an unlock rule with a codex hint; signature weapons come with their hero", () => {
    for (const w of WEAPONS.values()) {
      if (w.evolved || ORIGINAL_WEAPONS.includes(w.id)) continue;
      const r = unlockRule("weapon", w.id);
      expect(r.cond.t, w.id).not.toBe("start");
      expect(r.hint.length, `${w.id} hint`).toBeGreaterThan(3);
      const owner = HEROES.find((h) => h.weapon === w.id);
      if (owner) expect(r.cond, w.id).toEqual({ t: "hero", hero: owner.id });
    }
  });
});

// ================================================================================================
describe("enemies, bosses, stages", () => {
  test("the bible's 22 new enemies (+ split + twist enemy) and 9 new bosses are registered by name", () => {
    for (const b of bibleEnemies) {
      const e = ENEMIES.get(b.id);
      expect(e, b.id).toBeTruthy();
      expect(lower(e!.name), b.id).toBe(lower(b.name));
      if (b.split) expect(ENEMIES.get(b.split), b.split).toBeTruthy();
    }
    for (const b of bibleBosses) {
      const e = BOSSES.get(b.id);
      expect(e?.boss, b.id).toBeTruthy();
      // the boss card splits the heading into name + subtitle ("CANCEL-SAMA" / "the Network Executive")
      expect(lower(b.name).startsWith(lower(e!.name)) || lower(`${e!.name} ${e!.boss!.title}`).includes(lower(b.name)), `${b.id}: '${e!.name}' vs '${b.name}'`).toBe(true);
    }
    const regular = [...ENEMIES.values()].filter((e) => !e.prop && !ACTORS_NOT_IN_ROSTER.has(e.id)).map((e) => e.id).sort();
    const listed = [...ORIGINAL_ENEMIES, ...bibleEnemies.map((e) => e.id), ...bibleEnemies.flatMap((e) => (e.split ? [e.split] : []))].sort();
    expect(regular).toEqual(listed);
  });

  test("every enemy / boss sprite and every bullet sprite a stage names exists", () => {
    const bad: string[] = [];
    for (const e of [...ENEMIES.values(), ...BOSSES.values()]) if (!hasSprite(e.sprite)) bad.push(`${e.id}: ${e.sprite}`);
    for (const s of STAGES.values()) for (const ev of s.events) if (ev.sprite && !hasSprite(ev.sprite)) bad.push(`${s.id} event ${ev.kind}: ${ev.sprite}`);
    expect(bad).toEqual([]);
  });

  test("the 5 stages match stages.md (order, name, length, boss times, reward, gating)", () => {
    expect([...STAGES.keys()]).toEqual(bibleStages.map((s) => s.id));
    for (const b of bibleStages) {
      const s = STAGES.get(b.id)!;
      expect({ order: s.order, name: s.name, duration: s.duration, rewardMul: s.rewardMul, requires: s.requires }, b.id).toEqual({
        order: b.order,
        name: b.name,
        duration: b.duration,
        rewardMul: b.rewardMul,
        requires: b.requires,
      });
      expect(finalBossAt(s), `${b.id} final boss`).toBe(b.finalAt);
      expect(s.enrageAt, `${b.id} enrage`).toBe(b.duration + 30);
      const mids = s.events.filter((e) => e.kind === "boss" && e.enemy !== s.finalBoss).map((e) => e.at).sort((a, z) => a - z);
      expect(mids, `${b.id} mid bosses`).toEqual(b.mids);
      expect(BOSSES.get(s.finalBoss)?.boss?.final, `${b.id} final boss is final`).toBe(true);
    }
  });

  test("every bible boss appears in exactly one stage timeline; every roster enemy spawns somewhere", () => {
    const bosses = [...STAGES.values()].flatMap((s) => stageBosses(s));
    for (const b of BOSSES.values()) expect(bosses.filter((x) => x === b.id), b.id).toHaveLength(1);
    const spawned = new Set<string>();
    for (const s of STAGES.values()) {
      for (const p of s.phases) for (const id of Object.keys(p.mix)) spawned.add(id);
      for (const e of s.events) if (e.enemy) spawned.add(e.enemy);
      spawned.add(s.opening.enemy);
    }
    // spawned by another enemy / twist / event rather than a timeline
    const indirect = new Set(["spore", "watermelon_half", "dropped_frame", "rival_recolour"]);
    const never = [...ENEMIES.values()].filter((e) => !e.prop && !spawned.has(e.id) && !indirect.has(e.id)).map((e) => e.id);
    expect(never).toEqual([]);
  });

  test.each([...STAGES.values()].map((s) => [s.id, s] as const))("%s: ids in phases / events / props exist, events have handlers, art + music + tempo exist", (id, s) => {
    const bad: string[] = [];
    for (const p of s.phases) for (const e of Object.keys(p.mix)) if (!ENEMIES.has(e)) bad.push(`phase enemy ${e}`);
    for (const e of Object.keys(s.endless.phase?.mix ?? {})) if (!ENEMIES.has(e)) bad.push(`endless enemy ${e}`);
    if (!ENEMIES.has(s.opening.enemy)) bad.push(`opening ${s.opening.enemy}`);
    for (const ev of s.events) {
      if (!EVENT_HANDLERS[ev.kind]) bad.push(`event kind ${ev.kind}`);
      if (ev.enemy && !ENEMIES.has(ev.enemy) && !BOSSES.has(ev.enemy)) bad.push(`event enemy ${ev.enemy}`);
    }
    for (const p of s.props.ids ?? []) if (!ENEMIES.get(p)?.prop) bad.push(`prop ${p}`);
    for (const b of s.endless.rematches ?? []) if (!BOSSES.has(b)) bad.push(`rematch ${b}`);
    if (!hasSprite(s.tiles.sprite)) bad.push(`tiles ${s.tiles.sprite}`);
    for (const d of s.deco) {
      if (d.kind === "tall" && !hasSprite(d.sprite)) bad.push(`deco ${d.sprite}`);
      if (d.kind === "scatter") for (const it of d.items) if (!hasSprite(it.sprite)) bad.push(`deco ${it.sprite}`);
    }
    for (const l of s.ambient.layers ?? []) if (!hasSprite(l.sprite)) bad.push(`ambient ${l.sprite}`);
    for (const m of [s.music.battle, s.music.boss, s.music.final]) if (!MUSIC.has(m)) bad.push(`music ${m}`);
    expect(bad).toEqual([]);
    // the beat clock (Idol Lightstick Wave) runs at the battle theme's own tempo
    const song = SONGS[s.music.battle as keyof typeof SONGS];
    expect(s.bpm ?? 140, `${id} bpm vs '${s.music.battle}'`).toBe(song.bpm);
    const bible = bibleStages.find((b) => b.id === id)!;
    // (Dream Meadow keeps the slice's 150 bpm battle theme: the bible's 140 predates it, the music wins)
    if (id !== "dream_meadow") expect(s.bpm, `${id} bible bpm`).toBe(bible.bpm);
  });

  test("Plot Twists match stages.md §6 (ranks, heat, unlock stage) and unlock with that stage's clear", () => {
    expect([...TWISTS.keys()].sort()).toEqual(bibleTwists.map((t) => t.id).sort());
    for (const b of bibleTwists) {
      const t = TWISTS.get(b.id)!;
      expect({ name: t.name, maxRank: t.maxRank, heat: [...t.heat] }, b.id).toEqual({ name: b.name, maxRank: b.ranks, heat: b.heat });
      expect(hasSprite(t.icon ?? ""), `${b.id} icon ${t.icon}`).toBe(true);
      const stage = bibleStages.find((s) => s.name === b.by)!;
      const r = unlockRule("twist", b.id);
      expect(r.cond, b.id).toEqual({ t: "stageClear", order: stage.order });
      if (t.unlockedBy) expect(t.unlockedBy, b.id).toBe(stage.id);
    }
  });
});

// ================================================================================================
describe("relics and the Merch Machine", () => {
  test("61 relics at the bible's rarity and name, icons drawn", () => {
    expect([...RELICS.keys()].sort()).toEqual(bibleRelics.map((r) => r.id).sort());
    for (const b of bibleRelics) {
      const r = RELICS.get(b.id)!;
      expect([r.name, r.rarity], b.id).toEqual([b.name, b.rarity]);
      expect(hasSprite(r.icon), `${b.id} icon ${r.icon}`).toBe(true);
      expect(r.desc(0).length, b.id).toBeGreaterThan(3);
      expect(r.desc(6).length, b.id).toBeGreaterThan(3);
    }
    const count = (k: string) => bibleRelics.filter((r) => r.rarity === k).length;
    expect(RARITIES.map(count)).toEqual([12, 14, 12, 10, 6, 4, 3]);
  });

  test("banners: every rarity tier has items for a progressed account; featured lists resolve", () => {
    const p = defaultProfile();
    p.unlocks.heroes = HEROES.map((h) => h.id).filter((id) => ROSTER_BY_ID.get(id)?.source !== "gacha" && ROSTER_BY_ID.get(id)?.source !== "mythic");
    for (const banner of ["permanent", "hero", "relic", "mythic"] as const) {
      const pool = bannerPool(p, banner);
      for (const r of RARITIES) {
        if (r === "MYTHIC" && banner !== "mythic") {
          // the permanent banners still carry the MYTHIC relics; Truck-kun only rides the Isekai Express
          expect(pool.MYTHIC.some((x) => x.id === "truck_kun"), banner).toBe(false);
          continue;
        }
        expect(pool[r].length, `${banner} ${r}`).toBeGreaterThan(0);
      }
    }
    expect(bannerPool(p, "mythic").MYTHIC.some((x) => x.id === "truck_kun")).toBe(true);
    // SSR+ heroes: Senpai / MG47 at SSR, Isekai-kun at UR
    const perm = bannerPool(p, "permanent");
    expect(perm.SSR.map((x) => x.id)).toEqual(expect.arrayContaining(["senpai", "magical_girl_47"]));
    expect(perm.UR.map((x) => x.id)).toContain("isekai_kun");
    expect(featuredCandidates("hero").map((x) => x.id).sort()).toEqual(["isekai_kun", "magical_girl_47", "senpai"]);
    expect(featuredCandidates("mythic").map((x) => x.id)).toEqual(["truck_kun"]);
    for (const e of FEATURED_ROTATION.relic) expect(RELICS.has(e.id), `featured relic ${e.id}`).toBe(true);
    for (const e of FEATURED_ROTATION.hero) expect(HEROES.some((h) => h.id === e.id), `featured hero ${e.id}`).toBe(true);
  });
});

// ================================================================================================
describe("Plot Points and unlock paths", () => {
  test("every bible Plot Point is registered once, in its category, by name", () => {
    expect([...ACHIEVEMENTS.keys()].sort()).toEqual(bibleAch.map((a) => a.id).sort());
    for (const b of bibleAch) {
      const a = ACHIEVEMENTS.get(b.id)!;
      expect([a.name, a.category], b.id).toEqual([b.name, b.category]);
    }
    for (const [cat, n] of Object.entries(bibleAchCounts)) expect([...ACHIEVEMENTS.values()].filter((a) => a.category === cat).length, cat).toBe(n);
  });

  test("unlock rewards point at registered content, match the bible and have an UNLOCK_RULES row", () => {
    for (const b of bibleAch) {
      const want = /unlock `([a-z0-9_]+)`/.exec(b.reward)?.[1];
      const a = ACHIEVEMENTS.get(b.id)!;
      expect(a.reward.unlock, b.id).toBe(want);
      if (!want) continue;
      const known = ctx.heroById.has(want) || ctx.weapons.has(want) || ctx.passives.has(want) || ctx.stageById.has(want) || ctx.twists.has(want) || ctx.relics.has(want);
      expect(known, `${b.id} unlocks unknown '${want}'`).toBe(true);
      expect(UNLOCK_RULES.some((r) => r.id === want), `${want} has no UNLOCK_RULES row`).toBe(true);
    }
  });

  test("RunStats.evolutions lists evolved weapons only (Evolve X / Six-Evolution Spectacle), never maxed bases", () => {
    const w = new World({ hero: "hoshi", seed: 3 });
    w.addWeapon("thunder_bell", w.weaponMaxLevel(WEAPONS.get("thunder_bell")!));
    w.addWeapon("rainbow_cannon", 1);
    const s = w.summary().stats;
    expect(s.evolutions).toEqual(["rainbow_cannon"]);
  });

  test("everything earnable has a reachable unlock path", () => {
    const kinds: [UnlockKind, string[]][] = [
      ["hero", HEROES.map((h) => h.id)],
      ["weapon", [...WEAPONS.values()].filter((w) => !w.evolved).map((w) => w.id)],
      ["passive", PASSIVES.map((p) => p.id)],
      ["stage", [...STAGES.keys()]],
      ["twist", [...TWISTS.keys()]],
      ["relic", [...RELICS.keys()]],
    ];
    for (const [kind, ids] of kinds) {
      for (const id of ids) {
        const r = unlockRule(kind, id);
        switch (r.cond.t) {
          case "hero":
            expect(HEROES.some((h) => h.id === (r.cond as { hero: string }).hero), `${kind} ${id}`).toBe(true);
            break;
          case "bossKill":
            expect(BOSSES.has(r.cond.boss), `${kind} ${id}`).toBe(true);
            break;
          case "enemyKills":
            expect(ENEMIES.has(r.cond.enemy), `${kind} ${id}`).toBe(true);
            break;
          case "stageClear":
          case "survive":
            expect([...STAGES.values()].some((s) => s.order === (r.cond as { order: number }).order), `${kind} ${id}`).toBe(true);
            break;
          case "achievement":
            expect(ACHIEVEMENTS.has(r.cond.id), `${kind} ${id}`).toBe(true);
            break;
          default:
            break;
        }
        if (r.cond.t !== "start") expect(r.hint.length, `${kind} ${id} hint`).toBeGreaterThan(3);
      }
    }
    // stages chain one after another
    for (const s of STAGES.values()) {
      const r = unlockRule("stage", s.id);
      if (s.order === 1) expect(r.cond.t).toBe("start");
      else expect(r.cond, s.id).toEqual({ t: "stageClear", order: s.order - 1 });
    }
  });
});

// ================================================================================================
describe("art manifest and audio", () => {
  test("every sprite id of docs/content/art-manifest.md is in src/art/manifest.ts", () => {
    expect(bibleArt.size).toBeGreaterThan(250);
    expect(missing(bibleArt, (id) => SPRITES.has(id))).toEqual([]);
  });

  test("every sprite id literal in src/game, src/view, src/ui, src/meta exists (manifest or engine extras)", () => {
    const re = /["'`]((?:en|boss|eb|w|fx|ult|icon|tile|deco|prop|ui|board|portrait)_[a-z0-9_]+)["'`]/g;
    // music track ids that share a sprite prefix
    const notSprites = new Set([...MUSIC]);
    const bad: string[] = [];
    for (const dir of ["game", "view", "ui", "meta"])
      for (const f of walkTs(join(ROOT, "src", dir))) {
        const text = readFileSync(f, "utf8");
        for (const m of text.matchAll(re)) {
          const id = m[1];
          if (id.endsWith("_") || notSprites.has(id) || SPRITES.has(id) || ENEMIES.has(id)) continue;
          bad.push(`${f.slice(ROOT.length + 1)}: ${id}`);
        }
      }
    expect([...new Set(bad)]).toEqual([]);
  });

  test("content ids named in code exist (talentRank, spawnEnemy, weapon / passive / relic lookups)", () => {
    const talentIds = new Set([...TALENT_TREES.values()].flatMap((t) => t.nodes.map((n) => n.id)));
    const passiveIds = new Set(PASSIVES.map((p) => p.id));
    const checks: [RegExp, (id: string) => boolean, string][] = [
      [/talentRank\("([a-z0-9_]+)"\)/g, (id) => talentIds.has(id), "talent"],
      [/spawnEnemy\("([a-z0-9_]+)"/g, (id) => ENEMIES.has(id) || BOSSES.has(id), "enemy"],
      [/(?:addWeapon|hasWeapon|addWeaponDamage|weaponLevel)\("([a-z0-9_]+)"/g, (id) => WEAPONS.has(id), "weapon"],
      [/(?:passiveLevel|addPassive)\("([a-z0-9_]+)"/g, (id) => passiveIds.has(id), "passive"],
      [/RELICS\.get\("([a-z0-9_]+)"\)/g, (id) => RELICS.has(id), "relic"],
      [/(?:ENEMIES|BOSSES)\.get\("([a-z0-9_]+)"\)/g, (id) => ENEMIES.has(id) || BOSSES.has(id), "enemy"],
    ];
    const bad: string[] = [];
    let seen = 0;
    for (const dir of ["game", "view", "ui", "meta", "debug"])
      for (const f of walkTs(join(ROOT, "src", dir))) {
        const text = readFileSync(f, "utf8");
        for (const [re, ok, what] of checks)
          for (const m of text.matchAll(re)) {
            seen++;
            if (!ok(m[1])) bad.push(`${f.slice(ROOT.length + 1)}: ${what} '${m[1]}'`);
          }
      }
    expect(seen, "the scan found references").toBeGreaterThan(60);
    expect([...new Set(bad)]).toEqual([]);
  });

  test("heroFx cue kinds of the three Season 2 groups never collide (one shared event, namespaced kinds)", () => {
    const kinds = [
      ...Object.entries(HA).filter(([k, v]) => k.startsWith("HFX_") && typeof v === "string").map(([, v]) => v as string),
      ...Object.values(HB),
      ...Object.entries(A2).filter(([k, v]) => k.startsWith("A2_") && typeof v === "string").map(([, v]) => v as string),
    ];
    expect(kinds.length).toBeGreaterThan(40);
    expect(kinds.filter((k, i) => kinds.indexOf(k) !== i)).toEqual([]);
  });

  test("every relic / twist / passive / weapon / hero icon the hub draws is in the manifest", () => {
    const ids = [
      ...[...RELICS.values()].map((r) => r.icon),
      ...[...TWISTS.values()].map((t) => t.icon ?? `(no icon: ${t.id})`),
      ...PASSIVES.map((p) => p.icon),
      ...[...WEAPONS.values()].map((w) => w.icon),
      ...HEROES.map((h) => h.portrait),
      ...["icon_dreamgem", "icon_copium", "icon_trophy", "icon_codex_unknown", "icon_heat", "ui_gacha_capsule", "ui_rarity_badge", "ui_merch_machine"],
    ];
    expect(missing(ids, hasSprite)).toEqual([]);
  });

  test("every stage music track and boss music hint is an audio MusicTrack; every song exists", () => {
    for (const s of STAGES.values()) for (const m of [s.music.battle, s.music.boss, s.music.final]) expect(SONGS[m as keyof typeof SONGS], `${s.id} ${m}`).toBeTruthy();
    for (const m of MUSIC) if (m !== "none") expect(SONGS[m as keyof typeof SONGS], `song for ${m}`).toBeTruthy();
  });
});

// ================================================================================================
describe("hub-facing copy for every entry", () => {
  test("enemies speak (satire.md §6 pools), bosses have a wiki blurb and a TO BE CONTINUED line", () => {
    for (const e of ENEMIES.values()) {
      if (e.prop || ACTORS_NOT_IN_ROSTER.has(e.id)) continue;
      expect(SPEECH_POOLS[e.id]?.length ?? 0, `speech pool ${e.id}`).toBeGreaterThan(0);
    }
    const keys = Object.keys(WIKI).map(lower);
    const blurb = (name: string) => keys.some((k) => k === lower(name) || k.startsWith(lower(name)) || lower(name).startsWith(k));
    for (const e of [...ENEMIES.values(), ...BOSSES.values()]) {
      if (e.prop || ACTORS_NOT_IN_ROSTER.has(e.id)) continue;
      expect(blurb(e.name), `wiki blurb for '${e.name}'`).toBe(true);
    }
    const bossLines = new Set(Object.values(BOSS_DEATH_LINES));
    for (const b of BOSSES.values()) expect(bossLines.has(deathLine(120, b.name, {})), `TO BE CONTINUED line for '${b.name}'`).toBe(true);
  });
});
