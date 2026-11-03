/**
 * Playable heroes (DESIGN §3.1). Sprites come from the art manifest:
 * `${sprite}_idle|run|hurt|cast` and `portrait_${id}`.
 */
import { C } from "../art/palette";
import type { ConstellationDef } from "./defs";
import { Budget } from "./talents/_node";
import type { HeroDef, HeroId } from "./types";
import { miniStar } from "./weapons/star-shot";
import type { World } from "./world";

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
];

export const HERO_BY_ID: ReadonlyMap<string, HeroDef> = new Map(HEROES.map((h) => [h.id, h]));

export function heroDef(id: string | null | undefined): HeroDef {
  return HERO_BY_ID.get(id ?? "") ?? HEROES[0];
}

export const HERO_IDS: HeroId[] = HEROES.map((h) => h.id);
