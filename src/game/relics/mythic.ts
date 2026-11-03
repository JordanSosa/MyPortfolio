/**
 * MYTHIC relics: absurd, run-defining effects (0.0069% "nice"; docs/content/relics.md).
 */
import type { RelicDef } from "../defs";
import { atStar } from "./_util";

const CARD_BANISHES = [0, 1, 2, 3, 4, 5, 6];

export const infiniteCreditCard: RelicDef = {
  id: "infinite_credit_card",
  name: "Infinite Gacha Credit Card",
  rarity: "MYTHIC",
  icon: "icon_relic_infinite_credit_card",
  flavor: "No limit. No statement. No consequences. (There are consequences.)",
  desc: (s) => `Every level-up offers 6 cards and rerolls are free${atStar(CARD_BANISHES, s) > 0 ? `; +${atStar(CARD_BANISHES, s)} banishes` : ""}`,
  mods: (st) => void (st.cards = 6),
  install(w, s) {
    w.freeRerolls = true;
    w.banishes += atStar(CARD_BANISHES, s);
  },
};

export const relics: RelicDef[] = [infiniteCreditCard];
