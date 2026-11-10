/**
 * SECOND EVOLUTIONS, package A (docs/content/weapons.md §8.3): the mechanics of
 *
 *   - Critical Constellation (Star Shot + Lucky Clover): a volley of comets at the highest-HP enemies in view,
 *     the first hit of each always crits, a crit kill splits into two mini stars, crits are linked for the view
 *   - Already Cut (Petal Slash + Swift Shoes): the cut marks and deals nothing, the sheath click `wait` s later
 *     deals it all (+`moved` when she walked on), kills shed petals down the line, nothing behind her
 *   - Unrequited Heart (Heart Boomerang + Heart Locket): 1 / 2 / 3 hearts by Amount, the highest-HP target,
 *     a ramp per pass (half kept on a kill), half damage to what is in the way, a capped heal per catch
 *   - Group Chat Lightning (Thunder Bell + Friendship Bracelet): one hop at a time, nobody twice, no falloff,
 *     +2 hops per other weapon held, the blast only at the end of a full chain
 *   - Konpeito Minefield (Candy Bomb + Chibi Charm): mines up to `max`, a pop + slow on touch, the kick
 *
 * The data model, the choice and the §8.1 table are tests/evo2.test.ts and tests/coverage.test.ts.
 */
import { describe, expect, test } from "vitest";
import { defaultRunConfig } from "../src/game/run-config";
import type { Enemy, WeaponInstance } from "../src/game/types";
import { FX_MINE_KICK, FX_MINE_POP } from "../src/game/weapons/candy-bomb";
import { FX_CUT, FX_CUT_CLICK, FX_CUT_MARK } from "../src/game/weapons/petal-slash";
import { FX_STAR_LINK, starInst } from "../src/game/weapons/star-shot";
import { FX_CHAT_HOP, FX_CHAT_SEEN } from "../src/game/weapons/thunder-bell";
import { World } from "../src/game/world";
import { isWeaponOf } from "../src/game/registry";

const DT = 1 / 60;

/** A quiet world (no director, god mode) whose hero holds `id`, evolved from `base` + `passive`. */
function evolved(hero: string, base: string, passive: string, id: string, seed = 7): { w: World; inst: WeaponInstance } {
  const w = new World({ hero, seed, director: false, god: true, run: defaultRunConfig() });
  const b = w.hasWeapon(base) ?? w.addWeapon(base, 1)!;
  // (only the weapon under test: a general weapon's hero keeps none of her own)
  for (const other of [...w.weapons]) {
    if (other === b) continue;
    other.def.dispose?.(w, other);
    w.weapons.splice(w.weapons.indexOf(other), 1);
  }
  w.setWeaponLevel(b, 5);
  w.addPassive(passive, 1);
  const inst = w.evolveWeapon(b, id)!;
  expect(inst.def.id).toBe(id);
  return { w, inst };
}

function steps(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    w.step(DT);
    each?.();
  }
}

/** A puff at (dx, dy) from the hero that stays put, with `hp`. */
function dummy(w: World, dx: number, dy: number, hp = 1e9): Enemy {
  const e = w.spawnEnemy("puff", w.player.x + dx, w.player.y + dy)!;
  e.maxHp = e.hp = hp;
  e.speed = 0;
  return e;
}

/** Every hit of `source`: [enemy uid, damage, crit]. */
function hitLog(w: World, source: string): [number, number, boolean][] {
  const log: [number, number, boolean][] = [];
  w.hooks.on("hit", (h) => {
    if (h.source === source) log.push([h.enemy.uid, h.dmg, h.crit]);
  });
  return log;
}

function cues(w: World, kind: string): { x: number; y: number; x2: number; y2: number; r: number; n: number }[] {
  const out: { x: number; y: number; x2: number; y2: number; r: number; n: number }[] = [];
  w.bus.on("heroFx", (e) => {
    if (e.kind === kind) out.push({ x: e.x, y: e.y, x2: e.x2, y2: e.y2, r: e.r, n: e.n });
  });
  return out;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe("Critical Constellation", () => {
  const ID = "critical_constellation";
  const make = () => evolved("hoshi", "star_shot", "lucky_clover", ID);

  test("a volley of `amount` comets flies at the highest-HP enemies in view", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    // eight enemies on a ring, HP rising with the index: the comets must go for the last five
    const es = Array.from({ length: 8 }, (_, i) => dummy(w, Math.cos(i * 0.785) * 90, Math.sin(i * 0.785) * 70, 1e6 + i * 1000));
    const seen = new Set<number>();
    const aimed = new Set<number>();
    steps(w, 0.75, () => {
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.dead || p.sprite !== "w_comet_star" || seen.has(p.uid)) continue;
        seen.add(p.uid);
        expect(p.homing).toBe(0);
        // which enemy lies along its flight?
        const a = Math.atan2(p.vy, p.vx);
        let best = -1;
        let bd = 0.2;
        es.forEach((e, k) => {
          let da = Math.abs(Math.atan2(e.y - e.cy - p.y, e.x - p.x) - a);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (da < bd) {
            bd = da;
            best = k;
          }
        });
        aimed.add(best);
      }
    });
    expect(seen.size).toBe(L.amount);
    expect([...aimed].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  test("the first hit of every comet crits; what it pierces afterwards rolls like any hit", () => {
    const { w } = make();
    w.statMods.push((s) => void (s.crit = 0));
    w.recomputeStats();
    // a column of five tanks to the right: every comet goes at the far (highest-HP) one and pierces the rest
    for (let i = 0; i < 5; i++) dummy(w, 40 + i * 14, -8, 1e6 + i);
    const log = hitLog(w, ID);
    steps(w, 1.5);
    expect(log.length).toBeGreaterThanOrEqual(10);
    const crits = log.filter((h) => h[2]).length;
    // (one guaranteed crit per comet, none by luck with the crit stat at 0)
    expect(crits).toBe(5);
    expect(log.length).toBeGreaterThan(crits);
  });

  test("a crit that kills splits into two half-damage mini stars; crits are linked for the view", () => {
    const { w, inst } = make();
    const links = cues(w, FX_STAR_LINK);
    for (let i = 0; i < 5; i++) dummy(w, Math.cos(i * 1.2) * 70, Math.sin(i * 1.2) * 60, 5);
    let minis = 0;
    const seen = new Set<number>();
    steps(w, 1.4, () => {
      for (let i = 0; i < w.projectiles.count; i++) {
        const p = w.projectiles.items[i];
        if (p.dead || p.sprite !== "w_star" || seen.has(p.uid)) continue;
        seen.add(p.uid);
        expect(p.source).toBe(ID);
        expect(p.dmg).toBeCloseTo(inst.def.levels[0].dmg * (inst.def.levels[0].mini ?? 0) * w.stats.might * (inst.dmgMul ?? 1), 6);
        minis++;
      }
    });
    expect(w.kills).toBe(5);
    expect(minis).toBe(10);
    expect(links).toHaveLength(5);
    expect(links.every((l) => l.n === 1)).toBe(true);
    // the first star of a constellation has nothing to link from; the others start where the last crit was
    expect(links[0].x).toBe(links[0].x2);
    for (let i = 1; i < links.length; i++) expect([links[i].x, links[i].y]).toEqual([links[i - 1].x2, links[i - 1].y2]);
  });

  test("Hoshi's Star Shot talents and constellations treat it as Star Shot", () => {
    const { w, inst } = make();
    expect(isWeaponOf(ID, "star_shot")).toBe(true);
    expect(starInst(w)).toBe(inst);
  });
});

describe("Already Cut", () => {
  const ID = "already_cut";
  const make = () => evolved("rin", "petal_slash", "swift_shoes", ID);
  /** Step until the cut has been made (the FX_CUT cue). */
  function untilCut(w: World): void {
    let cut = false;
    const off = w.bus.on("heroFx", (e) => void (cut ||= e.kind === FX_CUT));
    for (let i = 0; i < 120 && !cut; i++) w.step(DT);
    off();
    expect(cut).toBe(true);
  }

  test("the cut deals nothing and marks the line; the sheath click deals it all at once", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    for (let i = 0; i < 8; i++) dummy(w, 24 + i * 14, 0);
    const behind = dummy(w, -30, 0);
    const marks = cues(w, FX_CUT_MARK);
    const clicks = cues(w, FX_CUT_CLICK);
    const log = hitLog(w, ID);
    untilCut(w);
    expect(marks).toHaveLength(8);
    expect(log).toHaveLength(0);
    steps(w, (L.wait ?? 0) - 0.05);
    expect(log).toHaveLength(0);
    steps(w, 0.1);
    expect(log).toHaveLength(8);
    expect(log.some((h) => h[0] === behind.uid)).toBe(false);
    expect(clicks).toEqual([expect.objectContaining({ n: 8, r: 0 })]);
    // standing still: the plain damage
    const dmg = L.dmg * w.stats.might * (inst.dmgMul ?? 1);
    expect(mean(log.filter((h) => !h[2]).map((h) => h[1])) / dmg).toBeGreaterThan(0.9);
    expect(mean(log.filter((h) => !h[2]).map((h) => h[1])) / dmg).toBeLessThan(1.1);
  });

  test("+`moved` when she walked on between the cut and the click", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    for (let i = 0; i < 16; i++) dummy(w, 24 + i * 7, i % 2 ? 4 : -4);
    const clicks = cues(w, FX_CUT_CLICK);
    const log = hitLog(w, ID);
    untilCut(w);
    w.input.my = 1;
    steps(w, (L.wait ?? 0) + 0.05);
    expect(clicks[0].r).toBe(1);
    const plain = log.filter((h) => !h[2]).map((h) => h[1]);
    expect(plain.length).toBeGreaterThan(8);
    const dmg = L.dmg * w.stats.might * (inst.dmgMul ?? 1) * (1 + (L.moved ?? 0));
    expect(mean(plain) / dmg).toBeGreaterThan(0.92);
    expect(mean(plain) / dmg).toBeLessThan(1.08);
  });

  test("it follows the way she moves, and turns to the nearest enemy only when that line is empty", () => {
    const a = make();
    dummy(a.w, 0, -60);
    dummy(a.w, 60, 0);
    const cutsA = cues(a.w, FX_CUT);
    a.w.input.my = -1;
    untilCut(a.w);
    // walking up with an enemy above: straight up, although another one is as near on the right
    expect(Math.abs(cutsA[0].x2 - cutsA[0].x)).toBeLessThan(1);
    expect(cutsA[0].y2).toBeLessThan(cutsA[0].y - 100);

    const b = make();
    dummy(b.w, -50, 0);
    const cutsB = cues(b.w, FX_CUT);
    const marks = cues(b.w, FX_CUT_MARK);
    untilCut(b.w);
    // facing right with nobody there: the cut goes to the one enemy behind her
    expect(cutsB[0].x2).toBeLessThan(cutsB[0].x - 100);
    expect(marks).toHaveLength(1);
  });

  test("a mark that dies sheds `petals` petal blades down the line", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    dummy(w, 40, 0, 10);
    dummy(w, 70, 0, 10);
    untilCut(w);
    steps(w, (L.wait ?? 0) + 0.03);
    expect(w.kills).toBe(2);
    let petals = 0;
    for (let i = 0; i < w.projectiles.count; i++) {
      const p = w.projectiles.items[i];
      if (p.dead || p.sprite !== "ult_petal") continue;
      petals++;
      expect(p.vx).toBeGreaterThan(0);
      expect(p.source).toBe(ID);
    }
    expect(petals).toBe(2 * (L.petals ?? 0));
  });
});

describe("Unrequited Heart", () => {
  const ID = "unrequited_heart";
  const make = () => evolved("hoshi", "heart_boomerang", "heart_locket", ID);

  test("one heart; two with +2 Amount, three with +4", () => {
    for (const [extra, hearts] of [[0, 1], [1, 1], [2, 2], [4, 3], [9, 3]] as const) {
      const { w, inst } = make();
      w.statMods.push((s) => void (s.amount += extra));
      w.recomputeStats();
      steps(w, 0.1);
      expect(inst.projs.filter((p) => !p.dead && p.sprite === "w_heart_big"), `+${extra}`).toHaveLength(hearts);
    }
  });

  test("it picks the highest-HP enemy in range and every pass hits harder, up to the cap", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    dummy(w, 50, 0, 1e6);
    const crushE = dummy(w, -60, 20, 1e7);
    dummy(w, 0, 200, 1e9); // (out of range: never the target)
    const log = hitLog(w, ID);
    steps(w, 14);
    const passes = log.filter((h) => h[0] === crushE.uid && !h[2]).map((h) => h[1]);
    expect(log.every((h) => h[0] === crushE.uid)).toBe(true);
    expect(passes.length).toBeGreaterThan(20);
    const base = L.dmg * w.stats.might * (inst.dmgMul ?? 1);
    expect(passes[0] / base).toBeLessThan(1.15);
    expect(mean(passes.slice(-6)) / base).toBeGreaterThan((1 + (L.rampMax ?? 0)) * 0.93);
    expect(Math.max(...passes) / base).toBeLessThan((1 + (L.rampMax ?? 0)) * 1.12);
    expect(inst.projs[0].target).toBe(crushE);
  });

  test("when the target dies it picks the next one and keeps half of the ramp", () => {
    const { w, inst } = make();
    const first = dummy(w, 50, 0, 1e7);
    const next = dummy(w, -50, 0, 1e6);
    steps(w, 4);
    const p = inst.projs[0];
    const ramp = p.b;
    expect(ramp).toBeGreaterThanOrEqual(6);
    w.killEnemy(first, null);
    steps(w, 0.05);
    expect(p.b).toBe(Math.floor(ramp * 0.5));
    steps(w, 0.6);
    expect(p.target).toBe(next);
    expect(p.b).toBeGreaterThan(Math.floor(ramp * 0.5));
  });

  test("what stands in the way takes `through` of the damage, once per leg", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    dummy(w, 100, -11, 1e7);
    const mid = dummy(w, 50, -11, 1e5);
    const log = hitLog(w, ID);
    steps(w, 3);
    const through = log.filter((h) => h[0] === mid.uid && !h[2]).map((h) => h[1]);
    expect(through.length).toBeGreaterThan(4);
    const base = L.dmg * w.stats.might * (inst.dmgMul ?? 1) * (L.through ?? 0);
    expect(mean(through) / base).toBeGreaterThan(0.9);
    expect(mean(through) / base).toBeLessThan(1.1);
  });

  test("a catch after a pass heals, never more than `healCap` HP a second; an idle heart heals nothing", () => {
    // (the hero's own regen is not the weapon's: count what the heart heals)
    const idle = make();
    idle.w.player.hp = 10;
    let idleHeals = 0;
    idle.w.hooks.on("heal", () => void idleHeals++);
    steps(idle.w, 3);
    expect(idleHeals).toBe(0);

    const { w, inst } = make();
    const L = inst.def.levels[0];
    dummy(w, 30, 0, 1e9);
    w.player.hp = 10;
    let healed = 0;
    w.hooks.on("heal", (h) => void (healed += h.amount));
    steps(w, 6);
    expect(healed).toBeGreaterThan(3);
    expect(healed).toBeLessThanOrEqual((L.healCap ?? 0) * 6 + (L.healCap ?? 0) + 1e-6);
  });

  test("dispose takes the hearts with it", () => {
    const { w, inst } = make();
    steps(w, 0.1);
    const p = inst.projs[0];
    inst.def.dispose?.(w, inst);
    expect(p.dead).toBe(true);
    expect(inst.projs).toHaveLength(0);
  });
});

describe("Group Chat Lightning", () => {
  const ID = "group_chat_lightning";
  const make = () => evolved("hoshi", "thunder_bell", "friendship_bracelet", ID);
  /** `n` tanks in a tight pack (every one within reach of every other), `gap` px apart. */
  const row = (w: World, n: number, gap = 30): Enemy[] => Array.from({ length: n }, (_, i) => dummy(w, -30 + (i % 4) * gap * 0.6, -60 + Math.floor(i / 4) * gap * 0.6));

  test("one bolt, forwarded hop by hop: nobody twice, no falloff, one hop every `hopT` s", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    // (exactly the chain's length: a second bolt cannot start on fresh enemies inside the window)
    row(w, (L.hops ?? 0) + 1, 24);
    const log = hitLog(w, ID);
    const at: number[] = [];
    w.bus.on("heroFx", (e) => void (e.kind === FX_CHAT_HOP && at.push(w.t)));
    steps(w, 0.1 + (L.hops ?? 0) * (L.hopT ?? 0) + 0.1);
    expect(at).toHaveLength(L.hops ?? 0);
    expect(at[at.length - 1] - at[0]).toBeGreaterThan(((L.hops ?? 0) - 1) * (L.hopT ?? 0) * 0.8);
    const direct = log.slice(0, (L.hops ?? 0) + 1);
    expect(new Set(direct.map((h) => h[0])).size).toBe((L.hops ?? 0) + 1);
    const dmg = L.dmg * w.stats.might * (inst.dmgMul ?? 1);
    for (const h of direct) if (!h[2]) expect(h[1] / dmg).toBeGreaterThan(0.85);
  });

  test("the last enemy of a FULL chain takes the blast; a chain that runs out of enemies does not", () => {
    const full = make();
    const L = full.inst.def.levels[0];
    row(full.w, (L.hops ?? 0) + 1, 24);
    const seen = cues(full.w, FX_CHAT_SEEN);
    const log = hitLog(full.w, ID);
    steps(full.w, 0.1 + (L.hops ?? 0) * (L.hopT ?? 0) + 0.1);
    expect(seen).toEqual([expect.objectContaining({ n: L.hops, r: (L.seenR ?? 0) * full.w.stats.area })]);
    // (11 direct hits, then the blast on the last enemy and its neighbours in range)
    expect(log.length).toBeGreaterThan((L.hops ?? 0) + 1);
    const blast = log.slice((L.hops ?? 0) + 1).filter((h) => !h[2]);
    expect(mean(blast.map((h) => h[1])) / (L.dmg * full.w.stats.might * (full.inst.dmgMul ?? 1) * (L.seenMul ?? 0))).toBeGreaterThan(0.85);

    const short = make();
    row(short.w, 4, 24);
    const seen2 = cues(short.w, FX_CHAT_SEEN);
    const log2 = hitLog(short.w, ID);
    steps(short.w, 0.9);
    expect(seen2).toHaveLength(0);
    expect(log2).toHaveLength(4);
  });

  test("+`perWeapon` hops for every other weapon held", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    expect(w.addWeapon("bubble_aura", 1)).toBeTruthy();
    expect(w.addWeapon("prism_beam", 1)).toBeTruthy();
    const want = (L.hops ?? 0) + 2 * (L.perWeapon ?? 0);
    row(w, want + 1, 22);
    const hops = cues(w, FX_CHAT_HOP);
    steps(w, 0.1 + want * (L.hopT ?? 0) + 0.1);
    expect(hops).toHaveLength(want);
    expect(hops[hops.length - 1].n).toBe(want - 1);
  });

  test("no enemy too far to forward to: the chain stops there", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    dummy(w, 40, -40);
    dummy(w, 40 + (L.reach ?? 0) * w.stats.area + 30, -40);
    const hops = cues(w, FX_CHAT_HOP);
    steps(w, 0.6);
    expect(hops).toHaveLength(0);
  });
});

describe("Konpeito Minefield", () => {
  const ID = "konpeito_minefield";
  const make = () => evolved("hoshi", "candy_bomb", "chibi_charm", ID);
  /** The armed mines on the ground (not the tosses in the air; pooled objects: an owned entry counts while its uid matches). */
  const mines = (inst: WeaponInstance) => inst.projs.filter((p, i) => !p.dead && p.uid === inst.uids[i] && p.z === 0 && p.life > 1);

  test("`amount` mines every `cd` s around the hero, never more than `max`; each lasts `duration` s", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    steps(w, 1.3);
    const first = mines(inst);
    expect(first.length).toBeGreaterThanOrEqual(2);
    for (const p of first) {
      const d = Math.hypot(p.x - w.player.x, (p.y - w.player.y) / 0.85);
      expect(d).toBeGreaterThanOrEqual((L.near ?? 0) - 1);
      expect(d).toBeLessThanOrEqual((L.far ?? 0) + 1);
      expect(p.life).toBeCloseTo((L.duration ?? 0) * w.stats.duration, 6);
    }
    let most = 0;
    steps(w, 10, () => void (most = Math.max(most, inst.projs.filter((p, i) => !p.dead && p.uid === inst.uids[i]).length)));
    expect(most).toBe(L.max);
    // a single tint is never the whole field
    expect(new Set(mines(inst).map((p) => p.tint)).size).toBe(4);
  });

  test("a mine pops when an enemy touches it: a blast, a slow; bosses are not slowed", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    steps(w, 0.9);
    const m = mines(inst)[0];
    expect(m).toBeTruthy();
    const pops = cues(w, FX_MINE_POP);
    const log = hitLog(w, ID);
    const toucher = dummy(w, m.x - w.player.x, m.y - w.player.y);
    const near = dummy(w, m.x - w.player.x + 16, m.y - w.player.y);
    const boss = w.spawnEnemy("king_puff", m.x, m.y + 12)!;
    boss.maxHp = boss.hp = 1e9;
    const far = dummy(w, m.x - w.player.x + 60, m.y - w.player.y - 60);
    const uid = m.uid;
    steps(w, 2 * DT);
    // (gone: dead, or its pooled object already reused by the next toss)
    expect(m.dead || m.uid !== uid).toBe(true);
    expect(pops).toHaveLength(1);
    expect(pops[0].r).toBeCloseTo((L.radius ?? 0) * w.stats.area, 6);
    const hit = new Set(log.map((h) => h[0]));
    expect(hit.has(toucher.uid) && hit.has(near.uid) && hit.has(boss.uid)).toBe(true);
    expect(hit.has(far.uid)).toBe(false);
    expect(toucher.slow).toBe(L.slow);
    expect(toucher.slowT).toBeGreaterThan((L.slowT ?? 0) - 0.05);
    expect(near.slow).toBe(L.slow);
    expect(boss.slow).toBe(1);
    expect(far.slow).toBe(1);
  });

  test("the hero kicks a mine she walks over `kick` px ahead", () => {
    const { w, inst } = make();
    const L = inst.def.levels[0];
    steps(w, 0.9);
    const m = mines(inst)[0];
    const kicks = cues(w, FX_MINE_KICK);
    // put her right behind it, walking onto it
    w.player.x = m.x - 12;
    w.player.y = m.y;
    w.input.mx = 1;
    const x0 = m.x;
    steps(w, 0.8, () => void (kicks.length && (w.input.mx = 0)));
    expect(kicks).toHaveLength(1);
    expect(m.dead).toBe(false);
    expect(m.x - x0).toBeCloseTo(L.kick ?? 0, 3);
    expect(m.y).toBeCloseTo(kicks[0].y, 6);
  });

  test("dispose clears the field", () => {
    const { w, inst } = make();
    steps(w, 2);
    const all = [...inst.projs];
    expect(all.length).toBeGreaterThan(4);
    inst.def.dispose?.(w, inst);
    expect(all.every((p) => p.dead)).toBe(true);
  });
});

describe("package A: the sim stays deterministic", () => {
  test("the same seed deals the same damage, hit for hit", { tags: ["slow"] }, () => {
    const builds: [string, string, string, string][] = [
      ["hoshi", "star_shot", "lucky_clover", "critical_constellation"],
      ["rin", "petal_slash", "swift_shoes", "already_cut"],
      ["hoshi", "heart_boomerang", "heart_locket", "unrequited_heart"],
      ["hoshi", "thunder_bell", "friendship_bracelet", "group_chat_lightning"],
      ["hoshi", "candy_bomb", "chibi_charm", "konpeito_minefield"],
    ];
    for (const [hero, base, passive, id] of builds) {
      const run = (): string => {
        const w = new World({ hero, seed: 11, god: true, run: defaultRunConfig() });
        const b = w.hasWeapon(base) ?? w.addWeapon(base, 1)!;
        w.setWeaponLevel(b, 5);
        w.addPassive(passive, 1);
        w.evolveWeapon(b, id);
        w.muted = true;
        for (let i = 0; i < 60 * 25; i++) {
          w.input.mx = Math.cos(i * 0.02);
          w.input.my = Math.sin(i * 0.013);
          w.step(DT);
          if (w.pendingLevels) w.pendingLevels = 0;
        }
        const inst = w.hasWeapon(id)!;
        expect(inst.damage, id).toBeGreaterThan(0);
        return `${inst.damage}/${inst.kills}/${w.kills}/${w.player.x.toFixed(3)}`;
      };
      expect(run(), id).toBe(run());
    }
  });
});
