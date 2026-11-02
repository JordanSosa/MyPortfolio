/**
 * Game over ("DREAM OVER…") and victory ("DAWN BREAKS!").
 *
 * Defeat: the hero's portrait (greyed, tilted), a "so close" line (the boss's
 * HP left / the next boss's arrival / the gap to the best time), REVIVE when
 * owned, and RETRY next to RESULTS. RETRY banks the run exactly like the
 * Results screen (recordRun, once) before starting the next one, so coins,
 * bests and the run counter are never lost.
 */
import { CFG } from "../../game/config";
import { EVENTS } from "../../game/director/timeline";
import { heroDef } from "../../game/heroes";
import { BOSSES } from "../../game/registry";
import type { World } from "../../game/world";
import type { App, UiScreen } from "../app";
import { esc, fmtTime, h, img, letters } from "../dom";
import { recordRun, save } from "../save";
import { layer, onTap, sparkles } from "./common";

/** "m:ss" */
function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The "so close" line for a defeat. */
function soClose(w: World): string {
  const b = w.boss;
  if (b && !b.dead && b.def.boss) {
    const pct = Math.max(1, Math.ceil((b.hp / b.maxHp) * 100));
    return `<b>${esc(b.def.boss.title)}</b> had only <b>${pct}%</b> HP left!`;
  }
  let next: { at: number; title: string } | null = null;
  for (const ev of EVENTS) {
    if (ev.kind !== "boss") continue;
    const at = ev.at + CFG.bossWarningTime;
    const def = BOSSES.get(ev.enemy ?? "");
    if (at > w.t && def?.boss && (!next || at < next.at)) next = { at, title: def.boss.title };
  }
  const lasted = `you lasted <b>${clock(w.t)}</b>`;
  const best = save.data.best.time;
  if (next && next.at - w.t <= 60) return `<b>${esc(next.title)}</b> arrives at ${clock(next.at)} — ${lasted}`;
  if (best > w.t + 0.5) return `only <b>${clock(best - w.t)}</b> short of your best!`;
  if (best > 0) return `a new best time — ${lasted}!`;
  if (next) return `<b>${esc(next.title)}</b> arrives at ${clock(next.at)} — ${lasted}`;
  return `${lasted}!`;
}

export function openGameOver(app: App, w: World, victory: boolean): UiScreen {
  const el = h("div", `modal ${victory ? "victory" : "gameover"}`);
  const canRevive = !victory && w.revivesLeft > 0;
  const hd = heroDef(w.hero.id);
  el.innerHTML = victory
    ? `
    ${sparkles(30)}
    <div class="over-t">${letters("DAWN BREAKS!", "ltr", 0.08)}</div>
    <div class="over-s">the nightmare stampede fades with the sunrise<br>${fmtTime(w.t)} · LV ${w.level} · ${w.kills} KO</div>
    <div class="btn-row">
      <button class="btn" data-nav data-nav-default data-act="results">RESULTS ▶</button>
    </div>`
    : `
    <div class="over-por" style="--hc:${app.heroColor(hd.id)}">${img(hd.portrait, "px", 0, 3)}<i class="sweat"></i></div>
    <div class="over-t">${letters("DREAM OVER…", "ltr", 0.08)}</div>
    <div class="over-close">${soClose(w)}</div>
    <div class="over-s">${fmtTime(w.t)} · LV ${w.level} · ${w.kills} KO</div>
    <div class="btn-row">
      ${canRevive ? `<button class="btn gold" data-nav data-nav-default data-act="revive">${img("icon_hp_up")} REVIVE (${w.revivesLeft})</button>` : ""}
      <button class="btn${canRevive ? " small" : ""}" data-nav ${canRevive ? "" : "data-nav-default"} data-act="retry">↻ RETRY</button>
      <button class="btn ${canRevive ? "ghost" : "violet"} small" data-nav data-act="results">RESULTS ▶</button>
    </div>`;
  app.ui.appendChild(el);
  let t = 0;
  let banked = false;
  onTap(el.querySelector('[data-act="revive"]'), () => {
    if (t < 0.5) return;
    if (w.revive()) {
      app.sfx("revive");
      app.closeModal();
      app.revived();
    }
  });
  onTap(el.querySelector('[data-act="retry"]'), () => {
    if (t < 0.5 || banked) return;
    // bank the run like the Results screen does (coins, bests, run counter), then go again
    banked = true;
    recordRun(w.summary());
    app.sfx("uiConfirm");
    app.retry();
  });
  onTap(el.querySelector('[data-act="results"]'), () => {
    if (t < 0.5 || banked) return;
    app.sfx("uiConfirm");
    app.endRun();
  });
  // victory: the sfx + victory track already started with the "victory" event (feedback.ts)
  if (!victory) app.sfx("gameOver");
  return {
    el,
    layer: layer(el),
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
    update(dt) {
      t += dt;
      if (app.params.autoplay && t > 2.5) {
        if (canRevive && w.revive()) {
          app.closeModal();
          app.revived();
        } else app.endRun();
      }
    },
  };
}
