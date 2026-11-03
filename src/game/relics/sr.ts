/**
 * SR ("Super Rare") relics: event hooks (docs/content/relics.md).
 */
import { CFG } from "../config";
import type { RelicDef } from "../defs";
import { popNani } from "../nani";
import type { Enemy } from "../types";
import { atStar, num, proc } from "./_util";

const RIVAL = [10, 12, 14, 16, 18, 20, 22];
/** Seconds a Rival mark lasts. */
const MARK_T = 3;

/**
 * Rival marks: per pooled enemy object a reused [uid, until] pair (allocated
 * once per pooled object, never per mark).
 */
const marks = new WeakMap<Enemy, Float64Array>();

/** Is the enemy under a Rival Plushie mark right now (view: the mark glint)? */
export function rivalMarked(e: Enemy, t: number): boolean {
  const m = marks.get(e);
  return !!m && m[0] === e.uid && m[1] > t;
}

export const rivalPlushie: RelicDef = {
  id: "rival_plushie",
  name: "Plushie of Your Rival",
  rarity: "SR",
  icon: "icon_relic_rival_plushie",
  flavor: "You punch it when you're sad. It's therapeutic.",
  desc: (s) => `Crits Mark the enemy for ${MARK_T} s: it takes +${atStar(RIVAL, s)}% damage from everything`,
  install(w, s) {
    const k = 1 + atStar(RIVAL, s) / 100;
    w.dmgTaken.push((e) => (rivalMarked(e, w.t) ? k : 1));
    w.hooks.on("hit", (h) => {
      if (!h.crit) return;
      const e = h.enemy;
      if (e.dead || e.hp <= 0 || e.def.prop) return;
      let m = marks.get(e);
      if (!m) {
        m = new Float64Array(2);
        marks.set(e, m);
      }
      const fresh = m[0] !== e.uid || m[1] <= w.t;
      m[0] = e.uid;
      m[1] = w.t + MARK_T;
      if (fresh) proc(w, "rival_plushie", e.x, e.y - e.cy - e.r - 4);
    });
  },
};

const SWORD = [8, 7.5, 7, 6.5, 6, 5.5, 5];

export const oversizedSwordKeychain: RelicDef = {
  id: "oversized_sword_keychain",
  name: "Oversized Sword Keychain",
  rarity: "SR",
  icon: "icon_relic_oversized_sword_keychain",
  flavor: "Bigger than the bag it's attached to.",
  desc: (s) => `Every ${num(atStar(SWORD, s))} s the next hit deals +200% damage and pops NANI?!`,
  install(w, s) {
    let armed = false;
    w.every(atStar(SWORD, s), () => {
      if (armed) return;
      armed = true;
      const p = w.player;
      proc(w, "oversized_sword_keychain", p.x, p.y - CFG.playerCy);
    });
    w.dmgTaken.push((e) => {
      if (!armed || e.def.prop) return 1;
      armed = false;
      popNani(w, e.x, e.y - e.cy);
      proc(w, "oversized_sword_keychain_hit", e.x, e.y - e.cy);
      return 3;
    });
  },
};

const NOVEL = [8, 9, 10, 11, 12, 13, 14];

export const lightNovelVol1: RelicDef = {
  id: "light_novel_vol1",
  name: "Light Novel Vol. 1 (Unread)",
  rarity: "SR",
  icon: "icon_relic_light_novel_vol1",
  flavor: "Full title: 'I Never Read This Book, So Now I Get an Extra Card?!'",
  desc: (s) => `The first ${atStar(NOVEL, s)} level-ups each run offer +1 card`,
  install(w, s) {
    const n = atStar(NOVEL, s);
    let ups = 0;
    w.statMods.push((st) => {
      if (ups < n) st.cards += 1;
    });
    w.hooks.on("levelUp", () => {
      // (the offer for level-up #k is made after it: +1 card while k <= n)
      if (++ups === n) w.statsDirty = true;
    });
  },
};

const CD_SINGLE = [10, 13, 16, 19, 22, 25, 28];

export const themeSongCd: RelicDef = {
  id: "theme_song_cd",
  name: "Theme Song CD Single",
  rarity: "SR",
  icon: "icon_relic_theme_song_cd",
  flavor: "Track 2 is the karaoke version. So is track 3.",
  desc: (s) => `+${atStar(CD_SINGLE, s)}% Overdrive gain`,
  mods: (st, s) => void (st.ultGain += atStar(CD_SINGLE, s) / 100),
};

const WIG = [10, 13, 16, 19, 22, 25, 28];
/** Wig stats in roll order (the toast prints WIG_NAMES[i]). */
export const WIG_NAMES = ["MIGHT", "AREA", "COOLDOWN", "MOVE SPEED", "PROJECTILE SPEED", "DURATION", "LUCK", "XP"];

export const cosplayWig: RelicDef = {
  id: "cosplay_wig",
  name: "Cosplay Wig (Wrong Colour)",
  rarity: "SR",
  icon: "icon_relic_cosplay_wig",
  flavor: "It's supposed to be pink. Nobody noticed.",
  desc: (s) => `One random stat (might, area, cooldown, move, projectile speed, duration, luck, XP) +${atStar(WIG, s)}% for the run`,
  install(w, s) {
    const k = atStar(WIG, s) / 100;
    const pick = w.rng.int(0, WIG_NAMES.length - 1);
    w.statMods.push((st) => {
      switch (pick) {
        case 0:
          st.might += k;
          break;
        case 1:
          st.area += k;
          break;
        case 2:
          st.cooldown -= k;
          break;
        case 3:
          st.moveSpeed += k;
          break;
        case 4:
          st.projSpeed += k;
          break;
        case 5:
          st.duration += k;
          break;
        case 6:
          st.luck += k;
          break;
        default:
          st.growth += k;
      }
    });
    // "Today's wig: AREA!" once the episode is under way (the run-start card is gone by then)
    w.after(0.8, () => {
      const p = w.player;
      proc(w, "cosplay_wig", p.x, p.y - 12, pick);
    });
  },
};

const GOLDFISH = [5, 6, 7, 8, 9, 10, 11];
const SPLASH_R = 48;

export const festivalGoldfish: RelicDef = {
  id: "festival_goldfish",
  name: "Festival Goldfish (Bagged)",
  rarity: "SR",
  icon: "icon_relic_festival_goldfish",
  flavor: "Named Captain. Has been through a lot.",
  desc: (s) => `Every 15 s a splash heals ${atStar(GOLDFISH, s)} HP and slows enemies within ${SPLASH_R} px by 50% for 1 s`,
  install(w, s) {
    const hp = atStar(GOLDFISH, s);
    w.every(15, () => {
      const p = w.player;
      const y = p.y - CFG.playerCy;
      w.heal(hp);
      const buf = w.acquire();
      const n = w.grid.query(p.x, y, SPLASH_R + 24, buf);
      for (let k = 0; k < n; k++) {
        const e = w.enemies.items[buf[k]];
        if (!e || e.dead || e.def.prop || e.def.boss) continue;
        const dx = e.x - p.x;
        const dy = e.y - e.cy - y;
        const rr = SPLASH_R + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (e.slow > 0.5) e.slow = 0.5;
        if (e.slowT < 1) e.slowT = 1;
      }
      w.release();
      proc(w, "festival_goldfish", p.x, y, SPLASH_R);
    });
  },
};

const MASCOT = [20, 23, 26, 29, 32, 35, 38];

export const mascotHead: RelicDef = {
  id: "mascot_head",
  name: "Mascot Costume Head",
  rarity: "SR",
  icon: "icon_relic_mascot_head",
  flavor: "It's very hot in there. Enemies feel bad hitting it.",
  desc: (s) => `${atStar(MASCOT, s)}% chance a hit deals only 1 damage`,
  install(w, s) {
    const chance = atStar(MASCOT, s) / 100;
    w.hurtMods.push((d) => {
      if (d <= 1 || w.rng.next() >= chance) return d;
      const p = w.player;
      proc(w, "mascot_head", p.x, p.y - 14);
      return 1;
    });
  },
};

const PITY = [5, 6, 7, 8, 9, 10, 11];

export const pityKeychain: RelicDef = {
  id: "pity_keychain",
  name: "Pity Counter Keychain",
  rarity: "SR",
  icon: "icon_relic_pity_keychain",
  flavor: "Soft pity, but for chests.",
  desc: (s) => `Each non-JACKPOT chest adds +${atStar(PITY, s)}% JACKPOT chance, until a JACKPOT`,
  install(w, s) {
    const step = atStar(PITY, s) / 100;
    let stack = 0;
    w.hooks.on("chest", (c) => {
      if (c.jackpot) {
        w.jackpotBonus -= stack;
        if (stack > 0) {
          const p = w.player;
          proc(w, "pity_keychain", p.x, p.y - 12, Math.round(stack * 100));
        }
        stack = 0;
        return;
      }
      stack += step;
      w.jackpotBonus += step;
    });
  },
};

const SHONEN = [10, 13, 16, 19, 22, 25, 28];

export const shonenHeadband: RelicDef = {
  id: "shonen_headband",
  name: "Shonen Headband",
  rarity: "SR",
  icon: "icon_relic_shonen_headband",
  flavor: "Smells like effort.",
  desc: (s) => `+${atStar(SHONEN, s)}% might while below 50% HP`,
  install(w, s) {
    const k = atStar(SHONEN, s) / 100;
    const low = () => (w.player.hp < w.player.maxHp * 0.5 && !w.player.dead ? 1 : 0);
    w.statMods.push((st) => void (low() && (st.might += k)));
    let was = 0;
    w.hooks.on("step", () => {
      const now = low();
      if (now === was) return;
      was = now;
      w.statsDirty = true;
      if (now) {
        const p = w.player;
        proc(w, "shonen_headband", p.x, p.y - 12);
      }
    });
  },
};

const MIRROR = [300, 350, 400, 450, 500, 550, 600];

export const compactMirror: RelicDef = {
  id: "compact_mirror",
  name: "Magical Girl Compact Mirror",
  rarity: "SR",
  icon: "icon_relic_compact_mirror",
  flavor: "Reflects damage. And your choices.",
  desc: (s) => `The attacker takes ${atStar(MIRROR, s)}% of the contact damage it dealt`,
  install(w, s) {
    const k = atStar(MIRROR, s) / 100;
    w.hooks.on("hurt", (h) => {
      // contact hits report the attacker's own feet position as the source (bullets / blasts never match);
      // a plain scan: hurts are rare (i-frames) and the spatial grid may not hold a fresh spawn yet
      const items = w.enemies.items;
      let hit: Enemy | null = null;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = items[i];
        if (!e.dead && e.x === h.sx && e.y === h.sy && !e.def.prop) {
          hit = e;
          break;
        }
      }
      if (!hit) return;
      const dmg = Math.max(h.dmg, hit.dmg) * k;
      const p = w.player;
      w.hitEnemy(hit, dmg, null, Math.atan2(hit.y - p.y, hit.x - p.x), 120, 0, "compact_mirror", 0xff8fd0);
      proc(w, "compact_mirror", hit.x, hit.y - hit.cy);
    });
  },
};

const KIT = [8, 7, 6, 5, 4, 3, 2];

export const mechaModelKit: RelicDef = {
  id: "mecha_model_kit",
  name: "Mecha Model Kit (Missing Parts)",
  rarity: "SR",
  icon: "icon_relic_mecha_model_kit",
  flavor: "Part B-14 was never in the box.",
  desc: (s) => `+1 amount, but −${atStar(KIT, s)}% might`,
  mods: (st, s) => {
    st.amount += 1;
    st.might -= atStar(KIT, s) / 100;
  },
};

const GLASS = [15, 20, 25, 30, 35, 40, 45];

export const magnifyingGlass: RelicDef = {
  id: "magnifying_glass",
  name: "Detective's Magnifying Glass",
  rarity: "SR",
  icon: "icon_relic_magnifying_glass",
  flavor: "The culprit was the chest all along.",
  desc: (s) => `Elites have a ${atStar(GLASS, s)}% chance to drop an extra chest`,
  install(w, s) {
    const chance = atStar(GLASS, s) / 100;
    w.hooks.on("kill", (k) => {
      if (!k.elite || k.boss || w.rng.next() >= chance) return;
      w.dropPickup("chest", k.x, k.y, 1, false);
      proc(w, "magnifying_glass", k.x, k.y - 10);
    });
  },
};

export const relics: RelicDef[] = [
  rivalPlushie,
  oversizedSwordKeychain,
  lightNovelVol1,
  themeSongCd,
  cosplayWig,
  festivalGoldfish,
  mascotHead,
  pityKeychain,
  shonenHeadband,
  compactMirror,
  mechaModelKit,
  magnifyingGlass,
];
