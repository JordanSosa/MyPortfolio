/**
 * MYTHIC relics: absurd, run-defining effects (0.0069% "nice"; docs/content/relics.md).
 */
import { CFG } from "../config";
import type { RelicDef } from "../defs";
import { installFriend } from "./_friend";
import { atStar, num, proc } from "./_util";

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
    // the card swipes on every level-up (view: a black-and-gold card, "∞", "APPROVED")
    w.hooks.on("levelUp", (l) => {
      const p = w.player;
      proc(w, "infinite_credit_card", p.x, p.y - 14, l.level);
    });
    w.hooks.on("reroll", () => {
      const p = w.player;
      proc(w, "infinite_credit_card_reroll", p.x, p.y - 14);
    });
  },
};

const FRIEND = [50, 58, 66, 74, 82, 90, 98];

export const realFriend: RelicDef = {
  id: "real_friend",
  name: "A Real Friend",
  rarity: "MYTHIC",
  icon: "icon_relic_real_friend",
  flavor: "Not imaginary. We checked. Twice.",
  desc: (s) => `A second copy of your hero fights beside you with your start weapon, dealing ${atStar(FRIEND, s)}% of your damage`,
  install(w, s) {
    installFriend(w, atStar(FRIEND, s) / 100);
  },
};

const SCRIPT = [6, 5.5, 5, 4.5, 4, 3.5, 3];

export const finalEpisodeScript: RelicDef = {
  id: "final_episode_script",
  name: "The Final Episode Script",
  rarity: "MYTHIC",
  icon: "icon_relic_final_episode_script",
  flavor: "Spoiler: everyone uses their ultimate. Constantly.",
  desc: (s) => `Overdrive is always ready: the meter refills to full ${num(atStar(SCRIPT, s))} s after each ultimate ends`,
  install(w, s) {
    const delay = atStar(SCRIPT, s);
    w.hooks.on("ultEnd", () => {
      w.after(delay, () => {
        if (w.ult || w.ultMeter >= CFG.ultMax) return;
        w.addUlt(CFG.ultMax);
        const p = w.player;
        proc(w, "final_episode_script", p.x, p.y - 14);
      });
    });
  },
};

export const relics: RelicDef[] = [infiniteCreditCard, realFriend, finalEpisodeScript];
