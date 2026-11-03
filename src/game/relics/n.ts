/**
 * N ("Normie") relics: small, honest stat sticks (docs/content/relics.md).
 * One file per rarity; `export const relics: RelicDef[]` is auto-registered.
 * Stars 0..6 (gacha dupes) pick the value from the ★0..★6 table.
 */
import type { RelicDef } from "../defs";
import { atStar } from "./_util";

const SPOON = [3, 4, 5, 6, 7, 8, 9];

export const bentSpoon: RelicDef = {
  id: "bent_spoon",
  name: "Slightly Bent Spoon",
  rarity: "N",
  icon: "icon_relic_bent_spoon",
  flavor: "Bent by psychic powers. Or a drawer.",
  desc: (s) => `+${atStar(SPOON, s)}% might`,
  mods: (st, s) => void (st.might += atStar(SPOON, s) / 100),
};

export const relics: RelicDef[] = [bentSpoon];
