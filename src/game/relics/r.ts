/**
 * R ("Rare") relics: stats with a twist - first event hooks (docs/content/relics.md).
 */
import type { RelicDef } from "../defs";
import { onDashThrough } from "../hooks";
import { atStar, dirtyOn, num, proc } from "./_util";

const STAND = [2, 2.5, 3, 3.5, 4, 4.5, 5];
/** A tiny heart heals this many HP. */
const HEART_HP = 3;

export const acrylicStand: RelicDef = {
  id: "acrylic_stand",
  name: "Limited Edition Acrylic Stand",
  rarity: "R",
  icon: "icon_relic_acrylic_stand",
  flavor: "Limited to 1,000,000 copies.",
  desc: (s) => `${atStar(STAND, s)}% chance a kill drops a tiny heart (heals ${HEART_HP})`,
  install(w, s) {
    const chance = atStar(STAND, s) / 100;
    w.hooks.on("kill", (k) => {
      // (Censored twist: no healing pickups)
      if (k.boss || !w.difficulty.food || w.rng.next() >= chance) return;
      w.dropPickup("heart", k.x, k.y, HEART_HP);
      proc(w, "acrylic_stand", k.x, k.y);
    });
  },
};

const POSTER = [3, 3.5, 4, 4.5, 5, 5.5, 6];

export const smudgedPoster: RelicDef = {
  id: "smudged_poster",
  name: "Signed Poster (Signature Smudged)",
  rarity: "R",
  icon: "icon_relic_smudged_poster",
  flavor: "Signed by someone. Probably.",
  desc: (s) => `+${atStar(POSTER, s)}% crit chance`,
  mods: (st, s) => void (st.crit += atStar(POSTER, s) / 100),
};

const PENCILS = [1, 1, 1, 2, 2, 2, 3];

export const pencilCase: RelicDef = {
  id: "pencil_case",
  name: "Collector's Edition Pencil Case",
  rarity: "R",
  icon: "icon_relic_pencil_case",
  flavor: "Mint condition. Never once held a pencil.",
  desc: (s) => `+${atStar(PENCILS, s)} reroll${atStar(PENCILS, s) > 1 ? "s" : ""}`,
  mods: (st, s) => void (st.rerolls += atStar(PENCILS, s)),
};

const TISSUES = [30, 28, 26, 24, 22, 20, 18];

export const pocketTissues: RelicDef = {
  id: "pocket_tissues",
  name: "Pocket Tissues (For The Finale)",
  rarity: "R",
  icon: "icon_relic_pocket_tissues",
  flavor: "You'll need these for episode 12.",
  desc: (s) => `The first hit every ${atStar(TISSUES, s)} s deals 50% less damage`,
  install(w, s) {
    const every = atStar(TISSUES, s);
    let ready = 0;
    w.hurtMods.push((d) => {
      if (w.t < ready) return d;
      ready = w.t + every;
      const p = w.player;
      proc(w, "pocket_tissues", p.x, p.y - 10);
      return d * 0.5;
    });
  },
};

const STRAP = [12, 15, 18, 21, 24, 27, 30];

export const phoneStrap: RelicDef = {
  id: "phone_strap",
  name: "Glow-in-the-Dark Phone Strap",
  rarity: "R",
  icon: "icon_relic_phone_strap",
  flavor: "Glows for four seconds. Then thinks about it.",
  desc: (s) => `+${atStar(STRAP, s)}% projectile speed`,
  mods: (st, s) => void (st.projSpeed += atStar(STRAP, s) / 100),
};

const DUCK = [10, 13, 16, 19, 22, 25, 28];

export const rubberDuck: RelicDef = {
  id: "rubber_duck",
  name: "Rubber Duck (Squeaky)",
  rarity: "R",
  icon: "icon_relic_rubber_duck",
  flavor: "Squeak. (Translation: move.)",
  desc: (s) => `Dashing through enemies squeaks: ${atStar(DUCK, s)} damage and a knockback to each`,
  install(w, s) {
    const dmg = atStar(DUCK, s);
    onDashThrough(w, (e) => {
      const p = w.player;
      w.hitEnemy(e, dmg * w.stats.might, null, Math.atan2(p.dashDY, p.dashDX), 160, 0, "rubber_duck", 0xffe14d);
      proc(w, "rubber_duck", e.x, e.y - e.cy);
    });
  },
};

const EARS_MOVE = [6, 7, 8, 9, 10, 11, 12];
const EARS_PICK = [10, 12, 14, 16, 18, 20, 22];

export const catEarHeadband: RelicDef = {
  id: "cat_ear_headband",
  name: "Cat-Ear Headband",
  rarity: "R",
  icon: "icon_relic_cat_ear_headband",
  flavor: "+10 cuteness. Cuteness is not a stat. Yet.",
  desc: (s) => `+${atStar(EARS_MOVE, s)}% move speed and +${atStar(EARS_PICK, s)}% pickup range`,
  mods: (st, s) => {
    st.moveSpeed += atStar(EARS_MOVE, s) / 100;
    st.pickup += atStar(EARS_PICK, s) / 100;
  },
};

const CHOPSTICKS = [20, 25, 30, 35, 40, 45, 50];

export const mismatchedChopsticks: RelicDef = {
  id: "mismatched_chopsticks",
  name: "Mismatched Chopsticks",
  rarity: "R",
  icon: "icon_relic_mismatched_chopsticks",
  flavor: "One from home, one from the café. A love story.",
  desc: (s) => `Food heals +${atStar(CHOPSTICKS, s)}%`,
  install(w, s) {
    const k = atStar(CHOPSTICKS, s) / 100;
    w.hooks.on("pickup", (p) => {
      if (p.kind === "onigiri") w.heal(20 * k);
      else if (p.kind === "cake") w.heal(50 * k);
      // Season 2 content food (puddings, petit fours, Moe hearts...)
      else if (p.kind === "snack") w.heal(p.value * k);
    });
  },
};

const TOWEL = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

export const hypeTowel: RelicDef = {
  id: "hype_towel",
  name: "Hype Towel",
  rarity: "R",
  icon: "icon_relic_hype_towel",
  flavor: "Wave it. The crowd waves back. The combo stays.",
  desc: (s) => `Combo window +${num(atStar(TOWEL, s))} s`,
  mods: (st, s) => void (st.comboTime += atStar(TOWEL, s)),
};

const FAN_CLUB = [2, 2.4, 2.8, 3.2, 3.6, 4, 4.4];

export const fanClubCard: RelicDef = {
  id: "fan_club_card",
  name: "Fan Club Membership Card",
  rarity: "R",
  icon: "icon_relic_fan_club_card",
  flavor: "Member #000000004. You're very early.",
  desc: (s) => `+${num(atStar(FAN_CLUB, s))}% might per combo rank (C = 1 … SSS = 6)`,
  install(w, s) {
    const k = atStar(FAN_CLUB, s) / 100;
    // (rank index -1 = none, 0 = C ... 5 = SSS)
    w.statMods.push((st) => void (st.might += k * (w.comboRank + 1)));
    dirtyOn(w, () => w.comboRank);
  },
};

const RAMEN = [20, 23, 26, 29, 32, 35, 38];

export const instantRamen: RelicDef = {
  id: "instant_ramen",
  name: "Instant Ramen (Three Minutes Exactly)",
  rarity: "R",
  icon: "icon_relic_instant_ramen",
  flavor: "Ready in three minutes. So is this heal.",
  desc: (s) => `Every 3:00, heal ${atStar(RAMEN, s)}% max HP`,
  install(w, s) {
    const k = atStar(RAMEN, s) / 100;
    w.every(180, () => {
      const p = w.player;
      w.heal(p.maxHp * k);
      proc(w, "instant_ramen", p.x, p.y - 10);
    });
  },
};

const PLAYLIST = [8, 10, 12, 14, 16, 18, 20];

export const battlePlaylist: RelicDef = {
  id: "battle_playlist",
  name: "Boss Battle Playlist",
  rarity: "R",
  icon: "icon_relic_battle_playlist",
  flavor: "Track 1: Final Boss Theme (Not the Final Boss).",
  desc: (s) => `+${atStar(PLAYLIST, s)}% damage vs bosses and elites`,
  mods: (st, s) => void (st.bossDmg += atStar(PLAYLIST, s) / 100),
};

const CLIP = [8, 10, 12, 14, 16, 18, 20];

export const sparklyHairClip: RelicDef = {
  id: "sparkly_hair_clip",
  name: "Sparkly Hair Clip",
  rarity: "R",
  icon: "icon_relic_sparkly_hair_clip",
  flavor: "Makes you 8% faster at running away. Science.",
  desc: (s) => `−${atStar(CLIP, s)}% dash cooldown`,
  mods: (st, s) => void (st.dashCd -= atStar(CLIP, s) / 100),
};

const CAT_COINS = [8, 9, 10, 11, 12, 13, 14];
const CAT_JACKPOT = [2, 2.5, 3, 3.5, 4, 4.5, 5];

export const luckyCat: RelicDef = {
  id: "lucky_cat",
  name: "Waving Lucky Cat",
  rarity: "R",
  icon: "icon_relic_lucky_cat",
  flavor: "Waves at customers. Customers wave back. Nobody buys anything.",
  desc: (s) => `+${atStar(CAT_COINS, s)}% coins, chests +${atStar(CAT_JACKPOT, s)}% JACKPOT chance`,
  mods: (st, s) => void (st.greed += atStar(CAT_COINS, s) / 100),
  install(w, s) {
    w.jackpotBonus += atStar(CAT_JACKPOT, s) / 100;
    w.hooks.on("chest", (c) => {
      if (!c.jackpot) return;
      const p = w.player;
      proc(w, "lucky_cat", p.x, p.y - 12);
    });
  },
};

export const relics: RelicDef[] = [
  acrylicStand,
  smudgedPoster,
  pencilCase,
  pocketTissues,
  phoneStrap,
  rubberDuck,
  catEarHeadband,
  mismatchedChopsticks,
  hypeTowel,
  fanClubCard,
  instantRamen,
  battlePlaylist,
  sparklyHairClip,
  luckyCat,
];
