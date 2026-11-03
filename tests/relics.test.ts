/**
 * Relics ("Merch", docs/content/relics.md): the full 61-relic catalogue, every
 * relic installed at ★0 and ★6 in a headless bot run without exceptions, and
 * each relic's effect observed through the sim (stats, hooks, procs), plus the
 * NANI?! pop rules (docs/content/satire.md §5) and A Real Friend.
 */
import { describe, expect, test } from "vitest";
import { MANIFEST } from "../src/art/manifest";
import { Bot, simulate } from "../src/debug/bot";
import { CFG } from "../src/game/config";
import { RARITIES, type Rarity } from "../src/game/defs";
import { HEROES } from "../src/game/heroes";
import { naniState } from "../src/game/nani";
import { RELICS } from "../src/game/registry";
import { friendOf } from "../src/game/relics/_friend";
import { rivalMarked } from "../src/game/relics/sr";
import { redStringTarget } from "../src/game/relics/ssr";
import { defaultRunConfig, type RunConfig } from "../src/game/run-config";
import type { Stats } from "../src/game/stats";
import { World } from "../src/game/world";

const DT = 1 / 30;
const mk = (relics: [string, number][] = [], hero = "hoshi", over: Partial<RunConfig> = {}, director = false) =>
  new World({ hero, seed: 7, director, run: defaultRunConfig({ relics: relics.map(([id, stars]) => ({ id, stars })), ...over }) });
const steps = (w: World, sec: number) => {
  for (let t = 0; t < sec; t += DT) w.step(DT);
};
const near = (w: World, id: string, dx = 16, dy = 0, elite = false) => w.spawnEnemy(id, w.player.x + dx, w.player.y + dy, elite)!;
/** Take the hero's weapons away (effects under test stay the only damage source). */
const disarm = (w: World) => void w.weapons.splice(0);
/** Land a hit on the hero whatever the i-frames say. */
const hurt = (w: World, dmg: number) => {
  w.player.iframes = 0;
  w.player.dashInv = 0;
  const before = w.player.hp;
  w.hurtPlayer(dmg, w.player.x + 10, w.player.y);
  return before - w.player.hp;
};

/** The bible's catalogue: rarity -> ids (docs/content/relics.md). */
const BIBLE: Record<Rarity, string[]> = {
  N: ["bent_spoon", "knockoff_keychain", "sticker_sheet", "expired_energy_drink", "empty_capsule", "wiki_printout", "convention_lanyard", "used_bandage", "offbrand_watch", "region_locked_dvd", "chocolate_coin", "traffic_cone"],
  R: ["acrylic_stand", "smudged_poster", "pencil_case", "pocket_tissues", "phone_strap", "rubber_duck", "cat_ear_headband", "mismatched_chopsticks", "hype_towel", "fan_club_card", "instant_ramen", "battle_playlist", "sparkly_hair_clip", "lucky_cat"],
  SR: ["rival_plushie", "oversized_sword_keychain", "light_novel_vol1", "theme_song_cd", "cosplay_wig", "festival_goldfish", "mascot_head", "pity_keychain", "shonen_headband", "compact_mirror", "mecha_model_kit", "magnifying_glass"],
  SSR: ["protagonist_scarf", "transformation_brooch", "abandoned_headband", "sakura_snow_globe", "season_finale_manga", "wind_machine", "sentai_badge", "isekai_status_card", "screentone_sheet", "red_string_of_fate"],
  UR: ["unopened_figure", "directors_cut", "time_skip_clock", "hot_blooded_bandana", "golden_ticket", "sacred_plot_device"],
  LR: ["original_manuscript", "revival_theme", "last_budget", "sakuga_cel"],
  MYTHIC: ["infinite_credit_card", "real_friend", "final_episode_script"],
};

describe("relic catalogue", () => {
  test("all 61 relics, by rarity, exactly as the bible lists them", () => {
    expect(RELICS.size).toBe(61);
    for (const r of RARITIES) {
      const ids = [...RELICS.values()].filter((d) => d.rarity === r).map((d) => d.id);
      expect(ids.sort(), r).toEqual([...BIBLE[r]].sort());
    }
  });

  test("every relic: icon in the art manifest, flavour, a card text for every star", () => {
    const ids = new Set(MANIFEST.map((m) => m.id));
    for (const d of RELICS.values()) {
      expect(d.icon).toBe(`icon_relic_${d.id}`);
      expect(ids.has(d.icon), d.icon).toBe(true);
      expect(d.flavor.length, d.id).toBeGreaterThan(8);
      expect(d.name.length).toBeGreaterThan(3);
      for (let s = 0; s <= 6; s++) {
        const t = d.desc(s);
        expect(t.length, `${d.id} ★${s}`).toBeGreaterThan(5);
        expect(t).not.toMatch(/NaN|undefined/);
      }
    }
  });
});

describe("every relic in a headless run", () => {
  test("installs at ★0 and ★6 and plays 45 s with the bot without exceptions", () => {
    for (const d of RELICS.values())
      for (const s of [0, 6]) {
        const w = new World({ hero: "hoshi", seed: 11, maxEnemies: 220, run: defaultRunConfig({ relics: [{ id: d.id, stars: s }] }) });
        expect(() => simulate(w, 45, DT, new Bot(3)), `${d.id} ★${s}`).not.toThrow();
        expect(w.t, d.id).toBeGreaterThan(40);
        expect(Number.isFinite(w.stats.might), d.id).toBe(true);
      }
  });

  test("a fast-forwarded (muted) run plays exactly like a watched one with all the event relics on", () => {
    const relics = ["rival_plushie", "oversized_sword_keychain", "screentone_sheet", "red_string_of_fate", "sakura_snow_globe", "wind_machine", "mascot_head", "compact_mirror", "real_friend"];
    const run = (muted: boolean) => {
      const w = new World({ hero: "rin", seed: 4, maxEnemies: 220, run: defaultRunConfig({ relics: relics.map((id) => ({ id, stars: 3 })) }) });
      w.muted = muted;
      simulate(w, 60, DT, new Bot(5));
      const s = w.runStats();
      return [w.kills, w.level, Math.round(w.player.hp), s.nanis, Math.round(w.damageBy.get("screentone_sheet") ?? 0)].join("|");
    };
    expect(run(true)).toBe(run(false));
  });
});

// ---------------------------------------------------------------- stat relics
/** [id, stat, value at ★0, value at ★6] (the delta to a relic-free run). */
const STAT_TABLE: [string, keyof Stats, number, number][] = [
  ["bent_spoon", "might", 0.03, 0.09],
  ["knockoff_keychain", "maxHp", 6, 18],
  ["sticker_sheet", "area", 0.03, 0.09],
  ["expired_energy_drink", "moveSpeed", 0.04, 0.1],
  ["empty_capsule", "luck", 0.05, 0.14],
  ["wiki_printout", "growth", 0.04, 0.1],
  ["convention_lanyard", "pickup", 0.08, 0.2],
  ["used_bandage", "regen", 0.1, 0.28],
  ["offbrand_watch", "cooldown", -0.02, -0.05],
  ["region_locked_dvd", "duration", 0.04, 0.1],
  ["chocolate_coin", "greed", 0.05, 0.17],
  ["traffic_cone", "armor", 1, 3],
  ["smudged_poster", "crit", 0.03, 0.06],
  ["pencil_case", "rerolls", 1, 3],
  ["phone_strap", "projSpeed", 0.12, 0.3],
  ["cat_ear_headband", "moveSpeed", 0.06, 0.12],
  ["cat_ear_headband", "pickup", 0.1, 0.22],
  ["hype_towel", "comboTime", 0.2, 0.5],
  ["battle_playlist", "bossDmg", 0.08, 0.2],
  ["sparkly_hair_clip", "dashCd", -0.08, -0.2],
  ["lucky_cat", "greed", 0.08, 0.14],
  ["theme_song_cd", "ultGain", 0.1, 0.28],
  ["mecha_model_kit", "amount", 1, 1],
  ["mecha_model_kit", "might", -0.08, -0.02],
  ["abandoned_headband", "bossDmg", 0.15, 0.27],
  ["wind_machine", "area", 0.15, 0.27],
  ["golden_ticket", "cards", 1, 2],
  ["golden_ticket", "rerolls", 0, 1],
  ["unopened_figure", "might", 0.3, 0.48],
  ["revival_theme", "revives", 1, 1],
  ["last_budget", "ultPower", 1.0, 1.6],
];

describe("stat relics", () => {
  test.each(STAT_TABLE)("%s: %s +%f (★0) / +%f (★6)", (id, key, v0, v6) => {
    const base = mk().stats[key] as number;
    expect((mk([[id, 0]]).stats[key] as number) - base).toBeCloseTo(v0, 6);
    expect((mk([[id, 6]]).stats[key] as number) - base).toBeCloseTo(v6, 6);
  });

  test("Infinite Gacha Credit Card: 6 cards, free rerolls, +stars banishes", () => {
    const w = mk([["infinite_credit_card", 6]]);
    expect(w.stats.cards).toBe(6);
    expect(w.freeRerolls).toBe(true);
    expect(w.banishes).toBe(6);
  });

  test("Cosplay Wig: exactly one of the eight stats gets +X% for the run", () => {
    const base = mk().stats;
    const w = mk([["cosplay_wig", 6]]);
    const keys: (keyof Stats)[] = ["might", "area", "cooldown", "moveSpeed", "projSpeed", "duration", "luck", "growth"];
    const changed = keys.filter((k) => Math.abs((w.stats[k] as number) - (base[k] as number)) > 1e-9);
    expect(changed.length).toBe(1);
    expect(Math.abs((w.stats[changed[0]] as number) - (base[changed[0]] as number))).toBeCloseTo(0.28, 6);
  });
});

// ---------------------------------------------------------------- R / SR event relics
describe("event relics", () => {
  test("Pocket Tissues: the first hit every X s deals 50% less", () => {
    const w = mk([["pocket_tissues", 6]], "hoshi", { mods: [(s) => void (s.maxHp = 1000)] });
    expect(hurt(w, 40)).toBe(20);
    expect(hurt(w, 40)).toBe(40);
    steps(w, 18.1);
    expect(hurt(w, 40)).toBe(20);
  });

  test("Mismatched Chopsticks: food (incl. Season 2 snacks) heals more", () => {
    const heal = (relic: boolean, kind: "onigiri" | "snack") => {
      const w = mk(relic ? [["mismatched_chopsticks", 6]] : []);
      w.player.hp = 10;
      const k = w.dropPickup(kind, w.player.x, w.player.y - 6, 12);
      k.t = 1;
      k.z = 0;
      k.vz = 0;
      steps(w, 0.2);
      return w.player.hp - 10;
    };
    expect(heal(true, "onigiri")).toBeCloseTo(heal(false, "onigiri") * 1.5, 5);
    expect(heal(true, "snack")).toBeCloseTo(heal(false, "snack") * 1.5, 5);
  });

  test("Fan Club Card / Hot-Blooded Bandana: might follows the combo rank", () => {
    const fan = mk([["fan_club_card", 6]]);
    const band = mk([["hot_blooded_bandana", 0]]);
    const m0 = fan.stats.might;
    const b0 = band.stats.might;
    fan.comboRank = 5;
    band.comboRank = 5;
    fan.step(DT);
    band.step(DT);
    expect(fan.stats.might - m0).toBeCloseTo(0.044 * 6, 6);
    // SSS x2.0 at 50 % strength = +50 % might
    expect(band.stats.might - b0).toBeCloseTo(0.5, 6);
  });

  test("Lucky Cat / Pity Counter Keychain: JACKPOT chance (soft pity that resets on a JACKPOT)", () => {
    expect(mk([["lucky_cat", 6]]).jackpotBonus).toBeCloseTo(0.05, 9);
    const w = mk([["pity_keychain", 6]]);
    let jackpot = false;
    let opened = 0;
    while (!jackpot && opened < 200) {
      w.pendingChests.push({ golden: false });
      const r = w.openChest()!;
      opened++;
      if (r.jackpot) jackpot = true;
      else expect(w.jackpotBonus).toBeCloseTo(0.11 * opened, 6);
    }
    expect(jackpot).toBe(true);
    expect(w.jackpotBonus).toBeCloseTo(0, 9);
  });

  test("Rival Plushie: crits mark the enemy for 3 s, marked enemies take +X% from everything", () => {
    const w = mk([["rival_plushie", 6]]);
    disarm(w);
    w.critRules.push(() => true);
    const e = near(w, "teddy", 40);
    w.hitEnemy(e, 1, null, 0, 0, 0, "test", 0);
    expect(rivalMarked(e, w.t)).toBe(true);
    const rule = w.dmgTaken[w.dmgTaken.length - 1];
    expect(rule(e, "anything", false)).toBeCloseTo(1.22, 9);
    steps(w, 3.1);
    expect(rivalMarked(e, w.t)).toBe(false);
  });

  test("Oversized Sword Keychain: every X s the next hit deals x3 and pops NANI?!", () => {
    const w = mk([["oversized_sword_keychain", 6]]);
    disarm(w);
    const e = near(w, "teddy", 60);
    e.hp = e.maxHp = 1e6;
    steps(w, 5.05);
    const before = e.hp;
    w.hitEnemy(e, 100, null, 0, 0, -1, "test", 0);
    expect(before - e.hp).toBeGreaterThan(250);
    expect(w.runStats().nanis).toBe(1);
    const mid = e.hp;
    w.hitEnemy(e, 100, null, 0, 0, -1, "test", 0);
    expect(mid - e.hp).toBeLessThan(120);
  });

  test("Mascot Costume Head: some hits deal only 1 damage", () => {
    const w = mk([["mascot_head", 6]], "hoshi", { mods: [(s) => void (s.maxHp = 100000)] });
    let ones = 0;
    for (let i = 0; i < 60; i++) if (hurt(w, 30) === 1) ones++;
    expect(ones).toBeGreaterThan(8);
    expect(ones).toBeLessThan(40);
  });

  test("Shonen Headband: +X% might while below 50% HP", () => {
    const w = mk([["shonen_headband", 6]]);
    const m0 = w.stats.might;
    w.player.hp = w.player.maxHp * 0.4;
    w.step(DT);
    expect(w.stats.might - m0).toBeCloseTo(0.28, 6);
    w.player.hp = w.player.maxHp;
    w.step(DT);
    expect(w.stats.might).toBeCloseTo(m0, 6);
  });

  test("Compact Mirror: an enemy that touches the hero takes X% of its contact damage", () => {
    const w = mk([["compact_mirror", 6]]);
    disarm(w);
    const e = near(w, "teddy", 2);
    e.hp = e.maxHp = 1e6;
    steps(w, 0.5);
    expect(w.damageTaken).toBeGreaterThan(0);
    expect(w.damageBy.get("compact_mirror") ?? 0).toBeGreaterThan(0);
  });

  test("Detective's Magnifying Glass: elites drop extra chests", () => {
    const chests = (relic: boolean) => {
      const w = mk(relic ? [["magnifying_glass", 6]] : []);
      for (let i = 0; i < 40; i++) w.killEnemy(near(w, "puff", 80, 0, true), null, "test");
      let n = 0;
      for (let i = 0; i < w.pickups.count; i++) if (!w.pickups.items[i].dead && w.pickups.items[i].kind === "chest") n++;
      return n;
    };
    expect(chests(false)).toBe(40);
    expect(chests(true)).toBeGreaterThan(48);
  });
});

// ---------------------------------------------------------------- SSR
describe("SSR relics", () => {
  test("Transformation Brooch: +X% might and +20% speed for 8 s after Overdrive", () => {
    const w = mk([["transformation_brooch", 6]]);
    const m0 = w.stats.might;
    const s0 = w.stats.moveSpeed;
    w.hooks.emit("ultEnd", { id: "test" });
    w.step(DT);
    expect(w.stats.might - m0).toBeCloseTo(0.6, 6);
    expect(w.stats.moveSpeed - s0).toBeCloseTo(0.2, 6);
    steps(w, 8.2);
    expect(w.stats.might).toBeCloseTo(m0, 6);
  });

  test("Rival's Abandoned Headband / Director's Cut: might per boss killed (+ a second golden chest)", () => {
    const a = mk([["abandoned_headband", 0]]);
    const d = mk([["directors_cut", 6]]);
    const ma = a.stats.might;
    const md = d.stats.might;
    for (const w of [a, d]) w.killEnemy(near(w, "king_puff", 60), null, "test");
    a.step(DT);
    d.step(DT);
    expect(a.stats.might - ma).toBeCloseTo(0.05, 6);
    expect(d.stats.might - md).toBeCloseTo(0.11, 6);
    let golden = 0;
    for (let i = 0; i < d.pickups.count; i++) if (!d.pickups.items[i].dead && d.pickups.items[i].kind === "chest" && d.pickups.items[i].golden) golden++;
    expect(golden).toBe(2);
  });

  test("Sakura Snow Globe: every 12 s a petal storm hits everything in view", () => {
    const w = mk([["sakura_snow_globe", 6]]);
    disarm(w);
    w.player.iframes = 1e9;
    for (let i = 0; i < 6; i++) near(w, "teddy", 60 + i * 10, -40).hp = 1e5;
    steps(w, 12.1);
    expect(w.damageBy.get("sakura_snow_globe") ?? 0).toBeGreaterThan(6 * 50);
  });

  test("Season Finale Manga: every Xth level-up lets you pick 2 cards from the offer", () => {
    const w = mk([["season_finale_manga", 6]]);
    while (w.level < 8) w.addXp(w.xpNext);
    expect(w.doublePicks.has(8)).toBe(true);
    let picks = 0;
    let finale = 0;
    while (w.pendingLevels > 0 && picks < 40) {
      const lv = w.level - w.pendingLevels + 1;
      const offer = w.offer();
      if (lv === 8 && finale === 1) expect(offer.length).toBe(w.stats.cards - 1);
      w.choose(offer[0]);
      picks++;
      if (lv === 8) finale++;
    }
    // 7 level-ups, the 7th (Lv 8) a finale: its offer is picked from twice -> 8 picks
    expect(finale).toBe(2);
    expect(picks).toBe(8);
    expect(w.doublePicks.size).toBe(0);
  });

  test("Dramatic Wind Machine: enemies next to the hero are pushed away", () => {
    const dist = (relic: boolean) => {
      const w = mk(relic ? [["wind_machine", 6]] : []);
      disarm(w);
      const e = near(w, "teddy", 18);
      steps(w, 1);
      return Math.hypot(e.x - w.player.x, e.y - w.player.y);
    };
    expect(dist(true)).toBeGreaterThan(dist(false) + 5);
  });

  test("Isekai Status Card: each level-up gives +X% might for the run", () => {
    const w = mk([["isekai_status_card", 6]]);
    const m0 = w.stats.might;
    for (let i = 0; i < 5; i++) w.addXp(w.xpNext);
    w.step(DT);
    expect(w.stats.might - m0).toBeCloseTo(0.011 * 5, 6);
  });

  test("Sparkle Screentone Sheet: crits burst onto nearby enemies; NANI?! chance doubles", () => {
    const w = mk([["screentone_sheet", 6]]);
    expect(naniState(w).chance).toBe(0.6);
    w.critRules.push(() => true);
    const a = near(w, "teddy", 60);
    const b = near(w, "teddy", 70);
    a.hp = b.hp = a.maxHp = b.maxHp = 1e5;
    w.step(DT);
    w.hitEnemy(a, 100, null, 0, 0, 0, "test", 0);
    expect(w.damageBy.get("screentone_sheet") ?? 0).toBeGreaterThan(50);
    expect(b.hp).toBeLessThan(1e5);
  });

  test("Red String of Fate: ties the nearest enemy (a boss on screen first), +X% damage, jumps on death", () => {
    const w = mk([["red_string_of_fate", 6]]);
    disarm(w);
    const a = near(w, "puff", 40);
    near(w, "puff", 90);
    steps(w, 0.1);
    expect(redStringTarget(w)).toBe(a);
    const rule = w.dmgTaken[w.dmgTaken.length - 1];
    expect(rule(a, "x", false)).toBeCloseTo(1.7, 9);
    w.killEnemy(a, null, "test");
    steps(w, 0.1);
    const next = redStringTarget(w);
    expect(next).not.toBeNull();
    expect(next).not.toBe(a);
    const boss = near(w, "king_puff", 70, -30);
    w.boss = boss;
    w.step(DT);
    expect(redStringTarget(w)).toBe(boss);
  });
});

// ---------------------------------------------------------------- UR / LR / MYTHIC
describe("UR, LR and MYTHIC relics", () => {
  test("Limited Figure: MINT until the first hit, then OPENED", () => {
    const w = mk([["unopened_figure", 6]]);
    const base = mk().stats.might;
    expect(w.stats.might - base).toBeCloseTo(0.48, 6);
    hurt(w, 5);
    w.step(DT);
    expect(w.stats.might - base).toBeCloseTo(0.16, 6);
  });

  test("Golden Gacha Ticket: chests offer evolutions at Lv4", () => {
    const w = mk([["golden_ticket", 0]]);
    const inst = w.weapons[0];
    w.setWeaponLevel(inst, 4);
    w.addPassive(inst.def.evolution!.with, 1);
    w.pendingChests.push({ golden: false });
    const r = w.openChest()!;
    expect(r.rewards[0].kind).toBe("evolution");
    expect(w.weapons[0].def.id).toBe(inst.def.evolution!.into);
  });

  test("Sacred Plot Device: level-ups reset every weapon cooldown (+ might for 5 s)", () => {
    const w = mk([["sacred_plot_device", 6]]);
    const m0 = w.stats.might;
    w.weapons[0].timer = 9;
    w.addXp(w.xpNext);
    expect(w.weapons[0].timer).toBe(0);
    w.step(DT);
    expect(w.stats.might - m0).toBeCloseTo(0.18, 6);
  });

  test("Author's Original Manuscript: start weapon at Lv W, its evolution passive at Lv P", () => {
    for (const [s, W, P] of [
      [0, 3, 1],
      [6, 5, 3],
    ]) {
      const w = mk([["original_manuscript", s]]);
      expect(w.weapons[0].level).toBe(W);
      w.step(DT);
      expect(w.passiveLevel(w.weapons[0].def.evolution!.with)).toBe(P);
    }
  });

  test("The Hero's Revival Theme: +1 revive, a revive refills Overdrive and grants SECOND WIND", () => {
    const w = mk([["revival_theme", 6]]);
    expect(w.revivesLeft).toBe(1);
    const m0 = w.stats.might;
    w.ultMeter = 0;
    w.player.iframes = 0;
    w.hurtPlayer(1e6, w.player.x, w.player.y);
    expect(w.phase).toBe("dead");
    expect(w.revive()).toBe(true);
    expect(w.ultMeter).toBe(CFG.ultMax);
    w.step(DT);
    expect(w.stats.might - m0).toBeCloseTo(0.5, 6);
  });

  test("Studio's Last Remaining Budget: ult power xX, the cast lasts 50% longer", () => {
    const w = mk([["last_budget", 6]]);
    w.ultMeter = CFG.ultMax;
    expect(w.tryUlt()).toBe(true);
    const base = w.ult!.def.duration;
    steps(w, CFG.cutinTime + 0.1);
    expect(w.ult!.dur).toBeCloseTo(base * 1.5, 6);
    expect(w.ult!.power).toBeCloseTo((1 + 0 * 0.06) * 2.6, 6);
  });

  test("The Final Episode Script: the meter refills X s after each ultimate", () => {
    const w = mk([["final_episode_script", 6]]);
    w.ultMeter = CFG.ultMax;
    w.tryUlt();
    let guard = 0;
    while ((w.ult || w.ultMeter > 0.5 * CFG.ultMax) && guard++ < 2000) w.step(DT);
    expect(w.ult).toBeNull();
    steps(w, 2.5);
    expect(w.ultMeter).toBeLessThan(CFG.ultMax);
    steps(w, 1);
    expect(w.ultMeter).toBe(CFG.ultMax);
  });

  test("A Real Friend: follows 24-40 px behind and fights with the start weapon at X% (kills credit it)", () => {
    const w = new World({ hero: "hoshi", seed: 9, maxEnemies: 200, run: defaultRunConfig({ relics: [{ id: "real_friend", stars: 6 }] }) });
    let far = 0;
    simulate(w, 40, DT, new Bot(2), (ww) => {
      const f = friendOf(ww)!;
      if (ww.t > 2 && Math.hypot(f.x - ww.player.x, f.y - ww.player.y) > 40.5) far++;
    });
    const f = friendOf(w)!;
    expect(f).not.toBeNull();
    expect(far).toBe(0);
    expect(f.inst!.def.id).toBe(w.weapons[0].def.id);
    expect(f.inst!.damage).toBeGreaterThan(100);
    expect(f.inst!.kills).toBeGreaterThan(0);
    expect(f.inst!.dmgMul).toBeCloseTo((w.weapons[0].dmgMul ?? 1) * 0.98, 6);
    // (kills by the Friend are credited to the start weapon: the run's weapon kills exceed the hero's own)
    expect(w.runStats().killsByWeapon.star_shot).toBe(w.weapons[0].kills + f.inst!.kills);
  });

  test("A Real Friend works with every hero (and leaves the hero's i-frames / shields alone)", () => {
    for (const h of HEROES) {
      const w = new World({ hero: h.id, seed: 2, maxEnemies: 180, run: defaultRunConfig({ relics: [{ id: "real_friend", stars: 3 }] }) });
      expect(() => simulate(w, 30, DT, new Bot(4)), h.id).not.toThrow();
      const f = friendOf(w)!;
      expect(f.inst, h.id).not.toBeNull();
      expect(f.inst!.damage, h.id).toBeGreaterThan(0);
      // the sandbox restores the hero after every Friend update: never left at the Friend's spot
      expect(Math.hypot(w.player.x - f.x, w.player.y - f.y), h.id).toBeGreaterThan(1);
    }
  });
});

describe("NANI?! pops", () => {
  test("qualifying crits pop at most once per 6 s and count into RunStats.nanis", () => {
    const w = mk();
    w.critRules.push(() => true);
    const st = naniState(w);
    st.chance = 1;
    const e = near(w, "teddy", 60);
    e.hp = e.maxHp = 1e6;
    w.hitEnemy(e, 600, null, 0, 0, 0, "test", 0);
    w.hitEnemy(e, 600, null, 0, 0, 0, "test", 0);
    expect(w.runStats().nanis).toBe(1);
    steps(w, 6.05);
    w.hitEnemy(e, 600, null, 0, 0, 0, "test", 0);
    expect(w.runStats().nanis).toBe(2);
    // small crits never qualify
    steps(w, 6.05);
    w.hitEnemy(e, 10, null, 0, 0, 0, "test", 0);
    expect(w.runStats().nanis).toBe(2);
  });

  test("a long bot run pops some NANI?! (and never more than one per 6 s)", () => {
    const w = new World({ hero: "rin", seed: 3, maxEnemies: 250 });
    simulate(w, 180, DT, new Bot(2));
    const n = w.runStats().nanis ?? 0;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(Math.ceil(180 / 6));
  });
});
