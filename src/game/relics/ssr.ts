/**
 * SSR ("Super Super Rare") relics: mechanics changes (docs/content/relics.md).
 */
import { CFG, CH_RELIC } from "../config";
import type { RelicDef } from "../defs";
import { Buff } from "../hooks";
import { naniState } from "../nani";
import type { Enemy } from "../types";
import type { World } from "../world";
import { atStar, num, proc } from "./_util";

const SCARF = [1, 1, 1, 2, 2, 2, 2];

export const protagonistScarf: RelicDef = {
  id: "protagonist_scarf",
  name: "Protagonist's Scarf",
  rarity: "SSR",
  icon: "icon_relic_protagonist_scarf",
  flavor: "Never touches the ground. Never washed.",
  desc: (s) => `Survive ${atStar(SCARF, s)} lethal hit${atStar(SCARF, s) > 1 ? "s" : ""} per run at 1 HP${s >= 6 ? "; each save also heals 30%" : ""}`,
  install(w, s) {
    w.plotArmor += atStar(SCARF, s);
    if (s >= 6)
      w.hooks.on("lethal", (h) => {
        if (!h.saved) return;
        // (the save sets HP to 1 right after this hook: heal on the next step)
        w.after(0, () => w.heal(w.player.maxHp * 0.3));
      });
  },
};

const BROOCH = [30, 35, 40, 45, 50, 55, 60];
/** Seconds the post-Overdrive transformation lasts. */
const BROOCH_T = 8;

export const transformationBrooch: RelicDef = {
  id: "transformation_brooch",
  name: "Transformation Brooch",
  rarity: "SSR",
  icon: "icon_relic_transformation_brooch",
  flavor: "Batteries not included. Transformation also not included.",
  desc: (s) => `After Overdrive ends: +${atStar(BROOCH, s)}% might and +20% move speed for ${BROOCH_T} s`,
  install(w, s) {
    const k = atStar(BROOCH, s) / 100;
    const form = new Buff(w);
    w.statMods.push((st) => {
      if (!form.on) return;
      st.might += k;
      st.moveSpeed += 0.2;
    });
    w.hooks.on("ultEnd", () => {
      form.start(BROOCH_T);
      const p = w.player;
      proc(w, "transformation_brooch", p.x, p.y - 12, BROOCH_T);
    });
  },
};

const RIVAL_BAND = [15, 17, 19, 21, 23, 25, 27];

export const abandonedHeadband: RelicDef = {
  id: "abandoned_headband",
  name: "Rival's Abandoned Headband",
  rarity: "SSR",
  icon: "icon_relic_abandoned_headband",
  flavor: "She left it behind. She'll want it back next season.",
  desc: (s) => `+${atStar(RIVAL_BAND, s)}% damage vs bosses and elites; each boss killed gives +5% might for the rest of the run`,
  mods: (st, s) => void (st.bossDmg += atStar(RIVAL_BAND, s) / 100),
  install(w) {
    let bosses = 0;
    w.statMods.push((st) => void (st.might += 0.05 * bosses));
    w.hooks.on("bossKill", (b) => {
      bosses++;
      w.statsDirty = true;
      proc(w, "abandoned_headband", b.enemy.x, b.enemy.y - b.enemy.cy, bosses * 5);
    });
  },
};

const GLOBE = [30, 34.5, 39, 43.5, 48, 52.5, 57];

export const sakuraSnowGlobe: RelicDef = {
  id: "sakura_snow_globe",
  name: "Sakura Snow Globe",
  rarity: "SSR",
  icon: "icon_relic_sakura_snow_globe",
  flavor: "Shake it. Something, somewhere, gets hurt.",
  desc: (s) => `Every 12 s a petal storm hits every enemy in view for ${num(atStar(GLOBE, s))} × might`,
  install(w, s) {
    const base = atStar(GLOBE, s);
    w.every(12, () => {
      const dmg = base * w.stats.might;
      const p = w.player;
      proc(w, "sakura_snow_globe", p.x, p.y - CFG.playerCy);
      w.hitAllInView(dmg, dmg, 30, "sakura_snow_globe", 0xffb8dc, CH_RELIC);
    });
  },
};

const FINALE = [10, 10, 9, 9, 8, 8, 7];

export const seasonFinaleManga: RelicDef = {
  id: "season_finale_manga",
  name: "Season Finale Manga",
  rarity: "SSR",
  icon: "icon_relic_season_finale_manga",
  flavor: "The finale is two chapters long. You get both.",
  desc: (s) => `Every ${atStar(FINALE, s)}th level-up is a SEASON FINALE: pick 2 cards`,
  install(w, s) {
    const every = atStar(FINALE, s);
    let ups = 0;
    w.hooks.on("levelUp", (l) => {
      if (++ups % every !== 0) return;
      w.doublePicks.add(l.level);
      const p = w.player;
      proc(w, "season_finale_manga", p.x, p.y - 12, l.level);
    });
  },
};

const FAN = [15, 17, 19, 21, 23, 25, 27];
/** Push radius around the hero (px) and speed (px/s). */
const WIND_R = 32;
const WIND_V = 40;

export const windMachine: RelicDef = {
  id: "wind_machine",
  name: "Dramatic Wind Machine",
  rarity: "SSR",
  icon: "icon_relic_wind_machine",
  flavor: "For when your hair needs to be in the scene.",
  desc: (s) => `+${atStar(FAN, s)}% area; enemies within ${WIND_R} px are gently pushed away`,
  mods: (st, s) => void (st.area += atStar(FAN, s) / 100),
  install(w) {
    w.hooks.on("step", (h) => {
      if (w.phase !== "play" || w.freezeT > 0 || w.timeStop) return;
      const p = w.player;
      const y = p.y - CFG.playerCy;
      const buf = w.acquire();
      const n = w.grid.query(p.x, y, WIND_R + 24, buf);
      const v = WIND_V * h.dt;
      for (let i = 0; i < n; i++) {
        const e = w.enemies.items[buf[i]];
        if (!e || e.dead || e.def.prop || e.def.boss) continue;
        const dx = e.x - p.x;
        const dy = e.y - e.cy - y;
        const rr = WIND_R + e.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        e.x += (dx / d) * v;
        e.y += (dy / d) * v;
      }
      w.release();
    });
  },
};

const SENTAI = [300, 345, 390, 435, 480, 525, 570];
/** Five sentai colours (red, blue, yellow, green, pink). */
const SENTAI_COLORS = [0xff4d6d, 0x4fa8ff, 0xffe14d, 0x7be36b, 0xff8fd0];

export const sentaiBadge: RelicDef = {
  id: "sentai_badge",
  name: "Sentai Team Badge",
  rarity: "SSR",
  icon: "icon_relic_sentai_badge",
  flavor: "Requires a team of five. You are the team of five.",
  desc: (s) => `When Overdrive starts, a 5-colour explosion goes off behind you (r 80, ${atStar(SENTAI, s)} x might x ult power)`,
  install(w, s) {
    const base = atStar(SENTAI, s);
    w.hooks.on("ult", (u) => {
      const p = w.player;
      // "behind you": opposite the way the hero faces / moves
      const x = p.x - p.aimX * 24;
      const y = p.y - 8 - p.aimY * 18;
      // (not a "big" blast: the Overdrive's own flash is already on screen - the five-colour rings carry it)
      w.explode(x, y, 80 * w.stats.area, base * w.stats.might * u.power, null, 220, "sentai_badge", SENTAI_COLORS[0]);
      proc(w, "sentai_badge", x, y);
    });
  },
};

const STATUS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1];

export const isekaiStatusCard: RelicDef = {
  id: "isekai_status_card",
  name: "Isekai Status Card",
  rarity: "SSR",
  icon: "icon_relic_isekai_status_card",
  flavor: "STR 9. INT 9. LUCK 9,999,999.",
  desc: (s) => `Each level-up gives +${num(atStar(STATUS, s))}% might for the rest of the run`,
  install(w, s) {
    const k = atStar(STATUS, s) / 100;
    let ups = 0;
    w.statMods.push((st) => void (st.might += k * ups));
    w.hooks.on("levelUp", () => {
      ups++;
      w.statsDirty = true;
      const p = w.player;
      proc(w, "isekai_status_card", p.x, p.y - 12, Math.round(k * ups * 1000) / 10);
    });
  },
};

const TONE = [50, 58, 66, 74, 82, 90, 98];
const TONE_R = 20;
/** Per pooled enemy: [uid, run time it may take another burst]. */
const toneCd = new WeakMap<Enemy, Float64Array>();

export const screentoneSheet: RelicDef = {
  id: "screentone_sheet",
  name: "Sparkle Screentone Sheet",
  rarity: "SSR",
  icon: "icon_relic_screentone_sheet",
  flavor: "Applied by hand. 400 hours. Worth it.",
  desc: (s) => `Crits burst into sparkles: r ${TONE_R}, ${atStar(TONE, s)}% of the crit's damage to nearby enemies; NANI?! pops twice as likely`,
  install(w, s) {
    const k = atStar(TONE, s) / 100;
    naniState(w).chance = 0.6;
    w.hooks.on("hit", (h) => {
      if (!h.crit || h.source === "screentone_sheet") return;
      const src = h.enemy;
      const x = src.x;
      const y = src.y - src.cy;
      const dmg = h.dmg * k;
      const t = w.t;
      const buf = w.acquire();
      const n = w.grid.query(x, y, TONE_R + 24, buf);
      let hits = 0;
      for (let i = 0; i < n; i++) {
        const e = w.enemies.items[buf[i]];
        if (!e || e === src || e.dead || e.def.prop) continue;
        const dx = e.x - x;
        const dy = e.y - e.cy - y;
        const rr = TONE_R + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        let cd = toneCd.get(e);
        if (!cd) {
          cd = new Float64Array(2);
          toneCd.set(e, cd);
        }
        if (cd[0] === e.uid && cd[1] > t) continue;
        cd[0] = e.uid;
        cd[1] = t + 0.3;
        w.hitEnemy(e, dmg, null, Math.atan2(dy, dx), 30, 0, "screentone_sheet", 0xfff7b0);
        hits++;
      }
      w.release();
      if (hits > 0) proc(w, "screentone_sheet", x, y, hits);
    });
  },
};

const STRING = [40, 45, 50, 55, 60, 65, 70];

/** The Red String of Fate's current target (the view draws the string). */
export interface RedString {
  target: Enemy | null;
  uid: number;
}
const strings = new WeakMap<World, RedString>();

/** The live tied enemy for the view, or null. */
export function redStringTarget(w: World): Enemy | null {
  const st = strings.get(w);
  if (!st || !st.target) return null;
  const e = st.target;
  return !e.dead && e.uid === st.uid ? e : null;
}

export const redStringOfFate: RelicDef = {
  id: "red_string_of_fate",
  name: "Red String of Fate",
  rarity: "SSR",
  icon: "icon_relic_red_string_of_fate",
  flavor: "Destiny. Or a fishing accident.",
  desc: (s) => `Your nearest enemy (a boss on screen first) is tied to you by a red string and takes +${atStar(STRING, s)}% damage; when it dies the string jumps to the next`,
  install(w, s) {
    const k = 1 + atStar(STRING, s) / 100;
    const st: RedString = { target: null, uid: 0 };
    strings.set(w, st);
    const valid = (e: Enemy | null): e is Enemy => !!e && !e.dead && e.uid === st.uid;
    const onScreen = (e: Enemy) => Math.abs(e.x - w.player.x) < w.viewW * 0.5 + 8 && Math.abs(e.y - w.player.y) < w.viewH * 0.5 + 8;
    w.dmgTaken.push((e) => (e === st.target && e.uid === st.uid ? k : 1));
    w.hooks.on("step", () => {
      if (w.phase !== "play") return;
      const cur = st.target;
      const boss = w.boss;
      // a boss on screen always wins the string
      if (boss && !boss.dead && onScreen(boss) && cur !== boss) {
        const jumped = valid(cur);
        st.target = boss;
        st.uid = boss.uid;
        if (jumped || !cur) proc(w, "red_string_of_fate", boss.x, boss.y - boss.cy);
        return;
      }
      if (valid(cur) && onScreen(cur)) return;
      const p = w.player;
      const next = w.nearestEnemy(p.x, p.y - CFG.playerCy, Math.max(w.viewW, w.viewH) * 0.6);
      st.target = next;
      st.uid = next ? next.uid : 0;
      if (next) proc(w, "red_string_of_fate", next.x, next.y - next.cy);
    });
  },
};

export const relics: RelicDef[] = [
  protagonistScarf,
  transformationBrooch,
  abandonedHeadband,
  sakuraSnowGlobe,
  seasonFinaleManga,
  windMachine,
  sentaiBadge,
  isekaiStatusCard,
  screentoneSheet,
  redStringOfFate,
];
