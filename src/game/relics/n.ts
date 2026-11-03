/**
 * N ("Normie") relics: small, honest stat sticks (docs/content/relics.md).
 * One file per rarity; `export const relics: RelicDef[]` is auto-registered.
 * Stars 0..6 (gacha dupes) pick the value from the ★0..★6 table.
 */
import type { RelicDef } from "../defs";
import type { Stats } from "../stats";
import { atStar } from "./_util";

/**
 * A one-stat relic: `table` holds the ★0..★6 values in the card's unit,
 * `apply(stats, value)` adds it, `text(value)` prints the card line.
 */
function statRelic(id: string, name: string, flavor: string, table: readonly number[], text: (v: number) => string, apply: (s: Stats, v: number) => void): RelicDef {
  return {
    id,
    name,
    rarity: "N",
    icon: `icon_relic_${id}`,
    flavor,
    desc: (s) => text(atStar(table, s)),
    mods: (st, s) => apply(st, atStar(table, s)),
  };
}

const pct = (v: number) => v / 100;

export const bentSpoon = statRelic("bent_spoon", "Slightly Bent Spoon", "Bent by psychic powers. Or a drawer.", [3, 4, 5, 6, 7, 8, 9], (v) => `+${v}% might`, (st, v) => void (st.might += pct(v)));

export const knockoffKeychain = statRelic("knockoff_keychain", "Knockoff Plushie Keychain", "The tag says 'Kawai Bare'.", [6, 8, 10, 12, 14, 16, 18], (v) => `+${v} max HP`, (st, v) => void (st.maxHp += v));

export const stickerSheet = statRelic(
  "sticker_sheet",
  "Half-Used Sticker Sheet",
  "The good stickers are gone. They're always gone.",
  [3, 4, 5, 6, 7, 8, 9],
  (v) => `+${v}% area`,
  (st, v) => void (st.area += pct(v)),
);

export const expiredEnergyDrink = statRelic(
  "expired_energy_drink",
  "Expired Energy Drink",
  "Best before: last season.",
  [4, 5, 6, 7, 8, 9, 10],
  (v) => `+${v}% move speed`,
  (st, v) => void (st.moveSpeed += pct(v)),
);

export const emptyCapsule = statRelic(
  "empty_capsule",
  "Empty Gacha Capsule",
  "It was empty. It's still the luckiest thing you own.",
  [5, 6.5, 8, 9.5, 11, 12.5, 14],
  (v) => `+${v}% luck`,
  (st, v) => void (st.luck += pct(v)),
);

export const wikiPrintout = statRelic("wiki_printout", "Printed-Out Fan Wiki Page", "Contains spoilers. Also typos.", [4, 5, 6, 7, 8, 9, 10], (v) => `+${v}% XP`, (st, v) => void (st.growth += pct(v)));

export const conventionLanyard = statRelic(
  "convention_lanyard",
  "Convention Lanyard",
  "Not technically staff. Nobody has asked.",
  [8, 10, 12, 14, 16, 18, 20],
  (v) => `+${v}% pickup range`,
  (st, v) => void (st.pickup += pct(v)),
);

export const usedBandage = statRelic(
  "used_bandage",
  "Slightly Used Bandage",
  "Used once. On a papercut. It's fine.",
  [0.1, 0.13, 0.16, 0.19, 0.22, 0.25, 0.28],
  (v) => `+${v.toFixed(2)} HP/s regen`,
  (st, v) => void (st.regen += v),
);

export const offbrandWatch = statRelic(
  "offbrand_watch",
  "Off-Brand Wristwatch",
  "Water resistant to a depth of one puddle.",
  [2, 2.5, 3, 3.5, 4, 4.5, 5],
  (v) => `−${v}% cooldown`,
  (st, v) => void (st.cooldown -= pct(v)),
);

export const regionLockedDvd = statRelic(
  "region_locked_dvd",
  "Region-Locked DVD Box Set",
  "Plays in exactly one country. Not yours.",
  [4, 5, 6, 7, 8, 9, 10],
  (v) => `+${v}% duration`,
  (st, v) => void (st.duration += pct(v)),
);

export const chocolateCoin = statRelic(
  "chocolate_coin",
  "Chocolate Commemorative Coin",
  "Legal tender in the Candy Kingdom.",
  [5, 7, 9, 11, 13, 15, 17],
  (v) => `+${v}% coins`,
  (st, v) => void (st.greed += pct(v)),
);

/** The guaranteed N result on the Truck-kun banner (docs/content/gacha.md). */
export const trafficCone = statRelic("traffic_cone", "Traffic Cone", "Found near a suspicious truck.", [1, 1, 1, 2, 2, 2, 3], (v) => `+${v} armor`, (st, v) => void (st.armor += v));

export const relics: RelicDef[] = [
  bentSpoon,
  knockoffKeychain,
  stickerSheet,
  expiredEnergyDrink,
  emptyCapsule,
  wikiPrintout,
  conventionLanyard,
  usedBandage,
  offbrandWatch,
  regionLockedDvd,
  chocolateCoin,
  trafficCone,
];
