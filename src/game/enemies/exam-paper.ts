/**
 * Exam Paper (Shoujo Academy, enemies.md §2): the Boo sine-wave flutter.
 *
 * Twist - Failing Grade: contact also applies F-: -5 % XP gain for 5 s,
 * stacking to 3 (-15 %); the view shows a red "F-" badge under the XP bar and
 * pops "F-" on contact. Elite "Final Exam": stacks to 6 and lasts 8 s.
 * (Contact damage is dealt here so the hit and the grade land together:
 * e.d = stored contact damage, the generic contact is off.)
 *
 * a = flutter phase.
 */
import { C } from "../../art/palette";
import { TAU } from "../../core/math";
import { CFG } from "../config";
import type { EnemyDef } from "../types";
import { toPlayer } from "./_steer";
import { academyInstall, addFail, SA_FAIL } from "./_academy";
import { cue } from "./_cue";

const dir = { x: 0, y: 0 };

export const examPaper: EnemyDef = {
  id: "exam_paper",
  name: "Exam Paper",
  sprite: "en_exam_paper",
  fps: 8,
  hp: 16,
  speed: 44,
  dmg: 4,
  radius: 5,
  height: 10,
  xp: 1,
  shadow: 8,
  colors: [C.white, C.offWhite, C.red],
  init(e, w) {
    academyInstall(w);
    e.a = w.rng.next() * TAU;
    e.d = e.dmg;
    e.dmg = 0;
  },
  update(e, w) {
    const d = toPlayer(e, w, dir);
    const s = Math.sin(e.t * 2.6 + e.a);
    const k = Math.min(1, d / 40) * 1.1;
    e.vx = (dir.x - dir.y * s * k) * e.speed;
    e.vy = (dir.y + dir.x * s * k) * e.speed;
    e.z = 3 + Math.sin(e.t * 3.4 + e.a) * 2;
    // contact: the hit + the grade
    const p = w.player;
    const dx = e.x - p.x;
    const dy = e.y - e.cy - (p.y - CFG.playerCy);
    const rr = e.r + CFG.playerRadius * w.stats.hitbox;
    if (dx * dx + dy * dy >= rr * rr || w.invulnerable) return;
    const hp0 = p.hp;
    if (w.hurtPlayer(w.contactDmg === 1 ? e.d : e.d * w.contactDmg, e.x, e.y, e.def.id) && p.hp < hp0) {
      const n = addFail(w, e.elite);
      cue(w, SA_FAIL, p.x, p.y - 22, e.x, e.y, e.elite ? 1 : 0, n, e);
    }
  },
};

export const enemies: EnemyDef[] = [examPaper];
