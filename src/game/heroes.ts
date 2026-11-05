/**
 * Playable heroes (DESIGN §3.1). Sprites come from the art manifest:
 * `${sprite}_idle|run|hurt|cast` and `portrait_${id}`.
 */
import { C } from "../art/palette";
import type { ConstellationDef } from "./defs";
import { Budget } from "./talents/_node";
import type { HeroDef, HeroId } from "./types";
import { miniStar } from "./weapons/star-shot";
import { aoiDrone } from "./weapons/micro-missile-swarm";
import { puddingC6 } from "./weapons/teapot-tempest";
import type { World } from "./world";
import { HEROES_B } from "./heroes-b";

/**
 * Constellations C1..C6 (gacha dupes), literally as docs/content/heroes.md §4:
 * shared star names, per-hero effects. C2 = the start weapon at Lv2; C3
 * upgrades the trait (the mods add the difference); ult / weapon parts are
 * read by the ult and weapon code through `world.cons` (C4: Supernova +10
 * meteors, Thousand Blossom +4 lines and +20%, Nyan Stampede +20 cats; Mochi
 * C6: yarn never turns off and pulls gems).
 */
const NAMES = [
  "Recolour Edition",
  "Rerun Banner Edition",
  "Summer Variant (Sun Hat Included)",
  "Unlicensed Collab Outfit",
  "Super-Deformed Plushie Form",
  "Fully Awakened (Final Form)",
] as const;

function stars(
  weapon: string,
  list: [string, ConstellationDef["mods"]?, ConstellationDef["install"]?][],
): ConstellationDef[] {
  return list.map(([desc, mods, install], i) => ({
    name: NAMES[i],
    desc,
    mods,
    // C2: the run starts with the signature weapon at Lv2
    install: i === 1 ? (w: World) => void (w.startWeapon === weapon && (w.startWeaponLevel = Math.max(w.startWeaponLevel, 2))) : install,
  }));
}

/** Hoshi C6: Star Shot stars that kill split into 2 half-damage stars (budgeted per second). */
function hoshiC6(w: World): void {
  w.ultMeter = Math.max(w.ultMeter, 60);
  const budget = new Budget(12);
  w.hooks.on("kill", (k) => {
    if ((k.source !== "star_shot" && k.source !== "galaxy_barrage") || !k.owner || !budget.take(w)) return;
    const L = k.owner.def.levels[Math.min(k.owner.level, k.owner.def.levels.length) - 1];
    const dmg = L.dmg * w.stats.might * (k.owner.dmgMul ?? 1) * 0.5;
    const a0 = w.rng.angle();
    const y = k.y - k.enemy.cy;
    for (let i = 0; i < 2; i++) miniStar(w, k.owner, "hoshi_c6", k.x, y, a0 + i * Math.PI, dmg, null, 0.6);
  });
}

export const HEROES: HeroDef[] = [
  {
    id: "hoshi",
    name: "Hoshi",
    title: "Star Magician",
    sprite: "hoshi",
    portrait: "portrait_hoshi",
    weapon: "star_shot",
    ult: "supernova_shower",
    trait: "+10% projectile speed, -5% cooldown",
    color: C.pink,
    colors: [C.pink, C.yellow, C.cyan, C.pinkLight],
    apply: (s) => {
      s.projSpeed += 0.1;
      s.cooldown -= 0.05;
    },
    constellations: stars("star_shot", [
      ["+6% might", (s) => void (s.might += 0.06)],
      ["Star Shot starts at Lv2"],
      ["Trait becomes +20% projectile speed, -8% cooldown", (s) => void ((s.projSpeed += 0.1), (s.cooldown -= 0.03))],
      ["Supernova Shower +10 meteors"],
      ["+3% crit, +10% crit damage", (s) => void ((s.crit += 0.03), (s.critMult += 0.1))],
      ["Star Shot stars split into 2 half-damage stars on kill; Overdrive starts at 60%", undefined, hoshiC6],
    ]),
  },
  {
    id: "rin",
    name: "Rin",
    title: "Shrine Swordswoman",
    sprite: "rin",
    portrait: "portrait_rin",
    weapon: "petal_slash",
    ult: "thousand_blossom_cut",
    trait: "+20 max HP, +10% damage",
    color: C.red,
    colors: [C.red, C.pinkLight, C.white, C.pink],
    apply: (s) => {
      s.maxHp += 20;
      s.might += 0.1;
    },
    constellations: stars("petal_slash", [
      ["+15 max HP", (s) => void (s.maxHp += 15)],
      ["Petal Slash starts at Lv2"],
      ["Trait becomes +35 max HP, +15% damage", (s) => void ((s.maxHp += 15), (s.might += 0.05))],
      ["Thousand Blossom Cut +4 slash lines and +20% damage"],
      ["+5% crit", (s) => void (s.crit += 0.05)],
      [
        'Petal Slash always crits enemies above 80% HP ("first cut")',
        undefined,
        (w) => void w.critRules.push((e, src) => (src === "petal_slash" || src === "sakura_tempest") && e.hp > e.maxHp * 0.8),
      ],
    ]),
  },
  {
    id: "mochi",
    name: "Mochi",
    title: "Neko Girl",
    sprite: "mochi",
    portrait: "portrait_mochi",
    weapon: "yarn_orbit",
    ult: "nyan_stampede",
    trait: "+15% move speed, +20% pickup range, 1 armor",
    color: C.violet,
    colors: [C.lavender, C.violet, C.paleYellow, C.pinkLight],
    apply: (s) => {
      s.moveSpeed += 0.15;
      s.pickup += 0.2;
      s.armor += 1;
    },
    constellations: stars("yarn_orbit", [
      ["+6% move speed", (s) => void (s.moveSpeed += 0.06)],
      ["Yarn Orbit starts at Lv2"],
      ["Trait becomes +20% move, +30% pickup, 2 armor", (s) => void ((s.moveSpeed += 0.05), (s.pickup += 0.1), (s.armor += 1))],
      ["Nyan Stampede +20 cats"],
      [
        "+1 dash charge",
        undefined,
        (w) => {
          w.player.dashChargesMax++;
          w.player.dashCharges++;
        },
      ],
      ["Yarn balls never turn off and pull gems like Cosmic Yarn"],
    ]),
  },
  // ---------------------------------------------------------------- Season 2, group A (docs/content/heroes.md §2.4-2.7)
  {
    id: "kuro",
    name: "Kuro",
    title: "Lord of the Abyssal Flame",
    sprite: "kuro",
    portrait: "portrait_kuro",
    weapon: "dark_flame_dragon",
    ult: "eternal_abyss",
    trait: "Sealed Power: +15% area, +10% duration, -10 max HP (the seal is heavy)",
    color: C.darkViolet,
    colors: [C.darkViolet, C.violet, C.red, C.deep],
    band: ["#ddc6ff", "#743fd1", "#2d1b45"],
    cutinLine: "My right arm... it's RESONATING!! Stand back — I can't hold the seal!!",
    apply: (s) => {
      s.area += 0.15;
      s.duration += 0.1;
      s.maxHp -= 10;
    },
    constellations: stars("dark_flame_dragon", [
      ["+6% area", (s) => void (s.area += 0.06)],
      ["Dark Flame Dragon starts at Lv2"],
      ['Trait loses its -10 HP ("the seal holds") and gives +20% area', (s) => void ((s.maxHp += 10), (s.area += 0.05))],
      ["Eternal Abyss +3 ticks"],
      ["+10% crit damage", (s) => void (s.critMult += 0.1)],
      ['A second salamander (Ragnarok II, "the sequel") joins with its own breath'],
    ]),
  },
  {
    id: "pudding",
    name: "Pudding",
    title: "Maid Café Ace",
    sprite: "pudding",
    portrait: "portrait_pudding",
    weapon: "teapot_tempest",
    ult: "omurice_of_love",
    trait: "Customer Service: +0.3 HP/s regen, +15% healing, +10% luck",
    color: C.paleYellow,
    colors: [C.paleYellow, C.gold, C.pinkLight, C.white],
    band: ["#fff0c9", "#f2bd66", "#a6683f"],
    cutinLine: "Welcome home, Master~! Now say it with me... MOE MOE KYUN♡!",
    apply: (s) => {
      s.regen += 0.3;
      s.healMul += 0.15;
      s.luck += 0.1;
    },
    constellations: stars("teapot_tempest", [
      ["+10 max HP", (s) => void (s.maxHp += 10)],
      ["Teapot Tempest starts at Lv2"],
      ["Trait becomes +0.5 HP/s, +25% healing, +10% luck", (s) => void ((s.regen += 0.2), (s.healMul += 0.1))],
      ["Omurice of Love +1 pulse"],
      ["+8% luck, +8% coins", (s) => void ((s.luck += 0.08), (s.greed += 0.08))],
      ["Warm Tea heals twice as fast; every 100 kills drops a pudding (heal 8)", undefined, puddingC6],
    ]),
  },
  {
    id: "aoi",
    name: "Aoi",
    title: "Mecha Pilot (Licensed Since Tuesday)",
    sprite: "aoi",
    portrait: "portrait_aoi",
    weapon: "micro_missile_swarm",
    ult: "get_in_the_robot",
    trait: "Mech Suit: +1 projectile, +1 armor, -15% move speed",
    color: C.blue,
    colors: [C.blue, C.lightBlue, C.yellow, C.white],
    band: ["#b0d8ff", "#5aa8ff", "#3462d6"],
    cutinLine: "I don't need a license for a GIANT FIST!!",
    apply: (s) => {
      s.amount += 1;
      s.armor += 1;
      s.moveSpeed -= 0.15;
    },
    constellations: stars("micro_missile_swarm", [
      ["+1 armor", (s) => void (s.armor += 1)],
      ["Micro Missile Swarm starts at Lv2"],
      ["Trait move penalty becomes -5%", (s) => void (s.moveSpeed += 0.1)],
      ["GET IN THE ROBOT +1 fist"],
      ["+10% projectile speed", (s) => void (s.projSpeed += 0.1)],
      ["A support drone orbits Aoi and fires 3 micro missiles every 2 s (Aoi's missile stats, 60% damage)", undefined, aoiDrone],
    ]),
  },
  {
    id: "akane",
    name: "Akane",
    title: "Tsundere Drill Princess",
    sprite: "akane",
    portrait: "portrait_akane",
    weapon: "baka_harisen",
    ult: "not_like_i_like_you",
    trait: "Tsun Tsun: +10% damage, +30% knockback, +5% crit chance",
    color: C.orange,
    colors: [C.red, C.orange, C.yellow, C.pinkLight],
    band: ["#ffe14d", "#ff9a3d", "#ad1d4a"],
    cutinLine: "D-don't get the wrong idea! I'm only saving you because you're in my WAY!!",
    apply: (s) => {
      s.might += 0.1;
      s.knock += 0.3;
      s.crit += 0.05;
    },
    constellations: stars("baka_harisen", [
      ["+5% might", (s) => void (s.might += 0.05)],
      ["Baka Harisen starts at Lv2"],
      ["Trait becomes +15% damage, +50% knockback, +8% crit", (s) => void ((s.might += 0.05), (s.knock += 0.2), (s.crit += 0.03))],
      ["Barrage +12 smacks"],
      ["+10% crit damage", (s) => void (s.critMult += 0.1)],
      ["Every BAKA! pop stuns enemies within 40 px for 1 s (the shout itself hurts)"],
    ]),
  },
  // ---------------------------------------------------------------- Season 2, group B (heroes-b.ts: Senpai, MG#47, Isekai-kun, Truck-kun)
  ...HEROES_B,
];

export const HERO_BY_ID: ReadonlyMap<string, HeroDef> = new Map(HEROES.map((h) => [h.id, h]));

export function heroDef(id: string | null | undefined): HeroDef {
  return HERO_BY_ID.get(id ?? "") ?? HEROES[0];
}

export const HERO_IDS: HeroId[] = HEROES.map((h) => h.id);
