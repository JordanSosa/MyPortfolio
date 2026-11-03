/**
 * UR ("Ultra Rare") relics (docs/content/relics.md).
 */
import type { RelicDef } from "../defs";
import { atStar, proc } from "./_util";

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

export const relics: RelicDef[] = [timeSkipClock];
