/**
 * UR ("Ultra Rare") relics (docs/content/relics.md).
 */
import { RANKS } from "../config";
import type { RelicDef } from "../defs";
import { Buff } from "../hooks";
import { atStar, dirtyOn, proc } from "./_util";

const MINT = [30, 33, 36, 39, 42, 45, 48];
const OPENED = [10, 11, 12, 13, 14, 15, 16];

export const unopenedFigure: RelicDef = {
  id: "unopened_figure",
  name: "Limited Figure (Box Unopened)",
  rarity: "UR",
  icon: "icon_relic_unopened_figure",
  flavor: "The moment you open it, it loses 66% of its value.",
  desc: (s) => `+${atStar(MINT, s)}% might while you have taken no damage this run ("MINT"); after the first hit, +${atStar(OPENED, s)}% ("OPENED")`,
  install(w, s) {
    const mint = atStar(MINT, s) / 100;
    const opened = atStar(OPENED, s) / 100;
    w.statMods.push((st) => void (st.might += w.damageTaken > 0 ? opened : mint));
    dirtyOn(w, () => (w.damageTaken > 0 ? 1 : 0));
    let open = false;
    w.hooks.on("hurt", () => {
      if (open) return;
      open = true;
      const p = w.player;
      proc(w, "unopened_figure", p.x, p.y - 14);
    });
  },
};

const DIRECTOR = [5, 6, 7, 8, 9, 10, 11];

export const directorsCut: RelicDef = {
  id: "directors_cut",
  name: "Director's Cut Blu-ray",
  rarity: "UR",
  icon: "icon_relic_directors_cut",
  flavor: "Includes 40 extra minutes of the director watching the footage.",
  desc: (s) => `Bosses drop 2 golden chests; +${atStar(DIRECTOR, s)}% might per boss killed this run`,
  install(w, s) {
    const k = atStar(DIRECTOR, s) / 100;
    let bosses = 0;
    w.statMods.push((st) => void (st.might += k * bosses));
    w.hooks.on("bossKill", (b) => {
      bosses++;
      w.statsDirty = true;
      // (every boss already drops one golden chest: the director's cut adds the second)
      const e = b.enemy;
      w.dropPickup("chest", e.x + 10, e.y, 1, true);
      proc(w, "directors_cut", e.x, e.y - e.cy, Math.round(k * bosses * 100));
    });
  },
};

const CLOCK_CD = [90, 85, 80, 75, 70, 65, 60];

export const timeSkipClock: RelicDef = {
  id: "time_skip_clock",
  name: "Time-Skip Clock",
  rarity: "UR",
  icon: "icon_relic_time_skip_clock",
  flavor: "Two years later, nothing had changed.",
  desc: (s) => `When HP drops below 30%: every enemy and bullet freezes for 3 s and you heal 20% (cooldown ${atStar(CLOCK_CD, s)} s)`,
  install(w, s) {
    const cd = atStar(CLOCK_CD, s);
    let ready = 0;
    w.hooks.on("hurt", (h) => {
      const p = w.player;
      if (w.t < ready || h.hp <= 0 || h.hp >= p.maxHp * 0.3) return;
      ready = w.t + cd;
      // a clock freeze stops enemies AND their bullets (World.updateBullets)
      w.freezeT = Math.max(w.freezeT, 3);
      w.emit("freeze", { seconds: 3 });
      w.heal(p.maxHp * 0.2);
      proc(w, "time_skip_clock", p.x, p.y - 10);
    });
  },
};

const BANDANA = [50, 58, 66, 74, 82, 90, 98];

export const hotBloodedBandana: RelicDef = {
  id: "hot_blooded_bandana",
  name: "Hot-Blooded Bandana",
  rarity: "UR",
  icon: "icon_relic_hot_blooded_bandana",
  flavor: "The louder you shout, the harder you hit.",
  desc: (s) => `Your combo rank XP multiplier also applies to your damage at ${atStar(BANDANA, s)}% strength (SSS ×2.0 at 50% = +50% might)`,
  install(w, s) {
    const k = atStar(BANDANA, s) / 100;
    w.statMods.push((st) => {
      const r = w.comboRank;
      if (r >= 0) st.might += (RANKS[r].mult - 1) * k;
    });
    dirtyOn(w, () => w.comboRank);
    let last = -1;
    w.hooks.on("step", () => {
      const r = w.comboRank;
      // a flame flare when the combo climbs to S or above
      if (r > last && r >= 3) {
        const p = w.player;
        proc(w, "hot_blooded_bandana", p.x, p.y - 12, r);
      }
      last = r;
    });
  },
};

const TICKET_CARDS = [1, 1, 1, 1, 1, 1, 2];
const TICKET_REROLLS = [0, 0, 0, 1, 1, 1, 1];

export const goldenTicket: RelicDef = {
  id: "golden_ticket",
  name: "Golden Gacha Ticket",
  rarity: "UR",
  icon: "icon_relic_golden_ticket",
  flavor: "Guaranteed SSR!* (*Terms and conditions apply. They're long.)",
  desc: (s) => {
    const r = atStar(TICKET_REROLLS, s);
    return `+${atStar(TICKET_CARDS, s)} card${atStar(TICKET_CARDS, s) > 1 ? "s" : ""} on every level-up; chests offer evolutions at Lv4${r > 0 ? `; +${r} reroll` : ""}`;
  },
  mods: (st, s) => {
    st.cards += atStar(TICKET_CARDS, s);
    st.rerolls += atStar(TICKET_REROLLS, s);
  },
  install(w) {
    w.chestEvoEarly = Math.max(w.chestEvoEarly, 1);
  },
};

const PLOT = [0, 3, 6, 9, 12, 15, 18];
/** Seconds the plot-device might lasts after a level-up. */
const PLOT_T = 5;

export const sacredPlotDevice: RelicDef = {
  id: "sacred_plot_device",
  name: "Sacred Plot Device",
  rarity: "UR",
  icon: "icon_relic_sacred_plot_device",
  flavor: "Nobody knows what it does. It does whatever the plot needs.",
  desc: (s) => `Every level-up resets all weapon cooldowns (they fire at once)${atStar(PLOT, s) > 0 ? ` and grants +${atStar(PLOT, s)}% might for ${PLOT_T} s` : ""}`,
  install(w, s) {
    const k = atStar(PLOT, s) / 100;
    const plot = new Buff(w);
    if (k > 0) w.statMods.push((st) => void (plot.on && (st.might += k)));
    w.hooks.on("levelUp", () => {
      for (let i = 0; i < w.weapons.length; i++) w.weapons[i].timer = 0;
      if (k > 0) plot.start(PLOT_T);
      const p = w.player;
      proc(w, "sacred_plot_device", p.x, p.y - 12, k > 0 ? PLOT_T : 0);
    });
  },
};

export const relics: RelicDef[] = [unopenedFigure, directorsCut, timeSkipClock, hotBloodedBandana, goldenTicket, sacredPlotDevice];
