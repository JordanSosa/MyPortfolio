/**
 * Run tab: time controls (pause, freeze + step, 0.25x-8x, skip to a time), the timeline (position,
 * spawn phase, upcoming events), spawn enemies / elites / bosses, give weapons / passives / relics /
 * levels / ult charge, god, kill all, clear bullets. Everything goes through the __kk hooks
 * (src/debug/hooks.ts) or public World methods.
 */
import { time } from "../../core/time";
import { PASSIVES } from "../../game/passives";
import { BOSSES, ENEMIES, RELICS, WEAPONS } from "../../game/registry";
import { stagePhaseAt } from "../../game/stage";
import type { World } from "../../game/world";
import { Bot } from "../bot";
import { setStepMode, stepFrames } from "../dev";
import type { ConsoleHost, Tab } from "./console";
import { btn, el, input, kv, row, sec, select, toast, toggle } from "./ui";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function runTab(h: ConsoleHost): Tab {
  const app = h.app;
  const kk = h.kk as unknown as Record<string, (...a: unknown[]) => unknown>;
  const W = (): World | null => app.game?.world ?? null;
  const need = (): World => {
    const w = W();
    if (!w) throw new Error("no run in progress (Scenarios tab, or PLAY)");
    return w;
  };
  const root = el("div");
  const none = el("div", "kkd-note", "No run in progress: start one from the hub, or the Scenarios tab.");
  root.append(none);

  // ---- time
  root.append(sec("time"));
  const pause = toggle("PAUSE SIM", () => time.paused, (on) => (time.paused = on));
  const freeze = toggle("FREEZE", () => app.loop.manual, (on) => setStepMode(app, on));
  root.append(row(pause, freeze, btn("+1f", () => stepFrames(app, 1), "sm"), btn("+1 s", () => stepFrames(app, 60), "sm"), btn("+10 s", () => stepFrames(app, 600), "sm")));
  const spRow = row();
  const spBtns = SPEEDS.map((x) => {
    const b = btn(`${x}x`, () => {
      time.speed = x;
      sync();
    }, "sm");
    spRow.append(b);
    return [x, b] as const;
  });
  root.append(spRow);
  const skipIn = input("180", 64);
  root.append(
    row(
      "skip to",
      skipIn,
      btn("GO (bot, muted)", () => {
        need();
        const r = kk.skipTo(Number(skipIn.value) || 0);
        toast(`now at ${mmss(Number(r) || 0)}`);
      }),
    ),
  );

  // ---- timeline
  root.append(sec("timeline"));
  const tl = kv();
  root.append(tl.el);
  const evList = el("div", "kkd-note");
  root.append(evList);

  // ---- spawn
  root.append(sec("spawn"));
  const enemyIds = [...ENEMIES.values()].filter((d) => !d.boss).map((d) => [d.id, `${d.id}${d.prop ? " (prop)" : ""}`] as [string, string]);
  enemyIds.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const enSel = select(enemyIds);
  const nIn = input("5", 44, "numeric");
  root.append(row(enSel));
  root.append(
    row(
      "x",
      nIn,
      btn("SPAWN", () => {
        need();
        toast(`spawned ${kk.spawn(enSel.value, Math.max(1, Number(nIn.value) || 1))}`);
      }),
      btn("ELITE", () => {
        need();
        toast(`spawned ${kk.spawn(`${enSel.value}!`, Math.max(1, Number(nIn.value) || 1))} elite`);
      }),
    ),
  );
  const bossSel = select([...BOSSES.values()].filter((d) => d.boss).map((d) => d.id));
  root.append(row(bossSel));
  root.append(
    row(
      btn("BOSS NOW", () => {
        need();
        kk.boss(bossSel.value, false);
      }),
      btn("WITH WARNING", () => {
        need();
        kk.boss(bossSel.value, true);
      }),
      ...[0.5, 0.2, 0.05].map((f) =>
        btn(`HP ${f * 100}%`, () => {
          need();
          if (!kk.bossHp(f)) toast("no boss");
        }, "sm"),
      ),
      btn("ENRAGE", () => {
        need();
        kk.enrage();
      }, "sm"),
    ),
  );

  // ---- give
  root.append(sec("give"));
  const wpSel = select([...WEAPONS.values()].map((d) => [d.id, `${d.id}${d.evolved ? " (evo)" : ""}`] as [string, string]));
  const wpLv = input("5", 40, "numeric");
  root.append(row(wpSel));
  root.append(
    row(
      "lv",
      wpLv,
      btn("GIVE WEAPON", () => {
        need();
        if (!kk.give(wpSel.value, Number(wpLv.value) || 1)) toast("no free slot / unknown");
      }),
      btn("CLEAR WEAPONS", () => {
        need();
        kk.clearWeapons();
      }, "sm"),
    ),
  );
  const psSel = select(PASSIVES.map((p) => p.id));
  const psLv = input("5", 40, "numeric");
  root.append(
    row(
      psSel,
      psLv,
      btn("GIVE", () => {
        need();
        if (!kk.give(psSel.value, Number(psLv.value) || 1)) toast("no free slot / unknown");
      }),
    ),
  );
  const rlSel = select([...RELICS.values()].map((d) => [d.id, `${d.rarity} ${d.id}`] as [string, string]));
  const rlSt = input("0", 36, "numeric");
  root.append(
    row(
      rlSel,
      "★",
      rlSt,
      btn("EQUIP", () => {
        need();
        if (!kk.relic(rlSel.value, Number(rlSt.value) || 0)) toast("already equipped / unknown");
      }),
    ),
  );
  root.append(
    row(
      btn("LEVEL UP", () => {
        need();
        kk.levelUp();
      }),
      btn("+5 LEVELS (bot picks)", () => {
        const w = need();
        const bot = new Bot(w.level * 31 + 7);
        for (let i = 0; i < 5; i++) {
          w.addXp(w.xpNext - w.xp + 0.01);
          while (w.pendingLevels > 0) bot.resolve(w);
        }
        toast(`level ${w.level}`);
      }, "sm"),
      btn("ULT FULL", () => {
        need();
        kk.ult();
      }),
      btn("CHEST", () => {
        need();
        kk.chest(false);
      }, "sm"),
      btn("GOLD CHEST", () => {
        need();
        kk.chest(true);
      }, "sm"),
    ),
  );

  // ---- cheats
  root.append(sec("cheats"));
  const god = toggle("GOD", () => !!(W() as unknown as { god?: boolean } | null)?.god, (on) => kk.god(on));
  root.append(
    row(
      god,
      btn("HEAL", () => {
        const w = need();
        w.heal(w.player.maxHp, true);
      }, "sm"),
      btn("KILL ALL", () => {
        const w = need();
        let n = 0;
        const en = w.enemies;
        for (let i = en.count - 1; i >= 0; i--) {
          const e = en.items[i];
          if (!e.dead && !e.def.boss && !e.def.prop) {
            w.killEnemy(e, null, "debug");
            n++;
          }
        }
        toast(`killed ${n}`);
      }),
      btn("KILL BOSS", () => {
        const w = need();
        if (w.boss && !w.boss.dead) w.killEnemy(w.boss, null, "debug");
        else toast("no boss");
      }, "sm"),
      btn("CLEAR BULLETS", () => need().clearBullets(), "sm"),
      btn("END RUN", () => {
        need();
        kk.endRun();
      }, "sm warn"),
    ),
  );

  const sync = () => {
    for (const [x, b] of spBtns) b.classList.toggle("on", time.speed === x);
    pause.refresh();
    freeze.refresh();
    god.refresh();
  };

  return {
    id: "run",
    label: "Run",
    el: root,
    update() {
      sync();
      const w = W();
      none.style.display = w ? "none" : "";
      if (!w) {
        tl.set([]);
        evList.textContent = "";
        return;
      }
      const st = w.stage;
      const ph = stagePhaseAt(st, w.t);
      const pi = st.phases.indexOf(ph);
      const d = w.director;
      tl.set([
        ["stage", `${st.id} (${mmss(st.duration)})`],
        ["t", `${mmss(w.t)} (${w.t.toFixed(1)} s) · ${w.phase}${w.endlessOn ? " · FILLER ARC" : ""}`],
        ["phase", `#${pi + 1}/${st.phases.length} ${mmss(ph.from)}-${ph.to > 1e8 ? "∞" : mmss(ph.to)} · max ${ph.max} · rate ${ph.rate[0]}-${ph.rate[1]}/s`],
        ["director", `spawn x${d.spawnMul.toFixed(2)} · adapt +${(d.adapt * 100).toFixed(0)}% hp · intro ${d.introT.toFixed(1)}${d.warning ? ` · WARNING ${d.warning.def.id}` : ""}${d.enraged ? " · ENRAGED" : ""}`],
        ["hero", `${w.hero.id} L${w.level} · hp ${Math.ceil(w.player.hp)}/${w.player.maxHp} · ult ${Math.round(w.ultMeter)}${w.ult ? ` (${w.ult.phase})` : ""}`],
        ["build", w.weapons.map((i) => `${i.def.id}:${i.level}`).join(" ") || "-"],
        ["passives", w.passives.map((i) => `${i.def.id}:${i.level}`).join(" ") || "-"],
        ["boss", w.boss && !w.boss.dead ? `${w.boss.def.id} ${Math.round((w.boss.hp / w.boss.maxHp) * 100)}% (state ${w.boss.state})` : "-"],
        ["enrage at", mmss(st.enrageAt)],
      ]);
      const evs = (d as unknown as { events?: { at: number; kind: string; enemy?: string; label?: string }[] }).events ?? st.events;
      const next = evs.filter((e) => e.at > w.t).slice(0, 6);
      evList.textContent = next.length ? `next: ${next.map((e) => `${mmss(e.at)} ${e.kind}${e.enemy ? ` ${e.enemy}` : ""} (in ${Math.round(e.at - w.t)}s)`).join(" · ")}` : "no more timeline events";
    },
  };
}
