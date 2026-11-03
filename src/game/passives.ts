/**
 * Passive items (DESIGN §3.3). 5 levels each. To add one: append a PassiveDef
 * (the icon id must exist in the art manifest) - upgrades, chests, the HUD
 * and the pause screen pick it up automatically.
 */
import type { PassiveDef } from "./types";

const lv = (fmt: (l: number) => string) => [1, 2, 3, 4, 5].map(fmt);

/** Friendship Bracelet: damage per different weapon held, per level. */
export const FRIENDSHIP_PER = 0.015;

export const PASSIVES: PassiveDef[] = [
  {
    id: "power_bow",
    name: "Power Bow",
    icon: "icon_power_bow",
    levels: lv((l) => `Damage +${l * 10}%`),
    apply: (s, l) => {
      s.might += 0.1 * l;
    },
  },
  {
    id: "wish_charm",
    name: "Wish Charm",
    icon: "icon_wish_charm",
    levels: lv((l) => `Cooldown -${l * 8}%`),
    apply: (s, l) => {
      s.cooldown -= 0.08 * l;
    },
  },
  {
    id: "big_ribbon",
    name: "Big Ribbon",
    icon: "icon_big_ribbon",
    levels: lv((l) => `Area +${l * 10}%`),
    apply: (s, l) => {
      s.area += 0.1 * l;
    },
  },
  {
    id: "twin_charm",
    name: "Twin Charm",
    icon: "icon_twin_charm",
    levels: ["Projectiles +1", "Projectiles +1 (Lv3: +2)", "Projectiles +2", "Projectiles +2 (Lv5: +3)", "Projectiles +3"],
    apply: (s, l) => {
      s.amount += l >= 5 ? 3 : l >= 3 ? 2 : 1;
    },
  },
  {
    id: "swift_shoes",
    name: "Swift Shoes",
    icon: "icon_swift_shoes",
    levels: lv((l) => `Move speed +${l * 10}%, dash cooldown -${l * 5}%`),
    apply: (s, l) => {
      s.moveSpeed += 0.1 * l;
      s.dashCd -= 0.05 * l;
    },
  },
  {
    id: "magnet_star",
    name: "Magnet Star",
    icon: "icon_magnet_star",
    levels: lv((l) => `Pickup range +${l * 30}%`),
    apply: (s, l) => {
      s.pickup += 0.3 * l;
    },
  },
  {
    id: "lucky_clover",
    name: "Lucky Clover",
    icon: "icon_lucky_clover",
    levels: lv((l) => `Crit +${l * 4}%, luck +${l * 10}%`),
    apply: (s, l) => {
      s.crit += 0.04 * l;
      s.luck += 0.1 * l;
    },
  },
  {
    id: "heart_locket",
    name: "Heart Locket",
    icon: "icon_heart_locket",
    levels: lv((l) => `Max HP +${l * 20}, regen +${(l * 0.2).toFixed(1)}/s`),
    apply: (s, l) => {
      s.maxHp += 20 * l;
      s.regen += 0.2 * l;
    },
  },
  // ---- Season 2 (docs/content/weapons.md §5): locked until unlocked (RunConfig.passivePool, src/meta/unlocks.ts)
  {
    id: "plot_armor",
    name: "Plot Armor",
    icon: "icon_plot_armor",
    levels: lv((l) => `Damage taken -${5 * l}%`),
    apply: (s, l) => {
      s.dmgReduction += 0.05 * l;
    },
  },
  {
    id: "main_character_aura",
    name: "Main Character Aura",
    icon: "icon_main_character_aura",
    levels: lv((l) => `Crit damage +${15 * l}%`),
    apply: (s, l) => {
      s.critMult += 0.15 * l;
    },
  },
  {
    id: "bento_box",
    name: "Bento Box",
    icon: "icon_bento_box",
    levels: lv((l) => `Regen +${(0.15 * l).toFixed(2)}/s, healing +${10 * l}%`),
    apply: (s, l) => {
      s.regen += 0.15 * l;
      s.healMul += 0.1 * l;
    },
  },
  {
    id: "speed_lines",
    name: "Speed Lines",
    icon: "icon_speed_lines",
    levels: lv((l) => `Projectile speed +${12 * l}%, knockback +${5 * l}%`),
    apply: (s, l) => {
      s.projSpeed += 0.12 * l;
      s.knock += 0.05 * l;
    },
  },
  {
    id: "inner_monologue",
    name: "Inner Monologue",
    icon: "icon_inner_monologue",
    levels: lv((l) => `Duration +${10 * l}%`),
    apply: (s, l) => {
      s.duration += 0.1 * l;
    },
  },
  {
    id: "training_montage",
    name: "Training Montage",
    icon: "icon_training_montage",
    levels: lv((l) => `XP +${8 * l}%`),
    apply: (s, l) => {
      s.growth += 0.08 * l;
    },
  },
  {
    id: "friendship_bracelet",
    name: "Friendship Bracelet",
    icon: "icon_friendship_bracelet",
    levels: lv((l) => `Damage +${1.5 * l}% per different weapon held`),
    // (all of it is run state: the statMod below)
    apply: () => {},
    install: (w, inst) => {
      // every slot holds a different weapon (an evolution counts as its own weapon); World.addWeapon /
      // evolveWeapon mark the stats dirty when statMods exist, and level-ups recompute them
      w.statMods.push((s) => {
        if (inst.level > 0) s.might += FRIENDSHIP_PER * inst.level * w.weapons.length;
      });
    },
  },
  {
    id: "chibi_charm",
    name: "Chibi Charm",
    icon: "icon_chibi_charm",
    levels: lv((l) => `Hitbox -${8 * l}%, pickup range +${15 * l}%`),
    apply: (s, l) => {
      s.hitbox -= 0.08 * l;
      s.pickup += 0.15 * l;
    },
  },
];

export const PASSIVE_BY_ID: ReadonlyMap<string, PassiveDef> = new Map(PASSIVES.map((p) => [p.id, p]));
