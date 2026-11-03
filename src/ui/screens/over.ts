/**
 * Game over - the "TO BE CONTINUED ->" death stinger (docs/content/satire.md
 * §4) - and victory (the stage's own text, "DAWN BREAKS!" in Dream Meadow).
 *
 * Defeat: the frozen frame goes sepia (vignette + drifting film grain), the
 * chunky arrow banner slides in from the right and bobs, a subtitle line (the
 * killing boss's own line, a speedrun line, or a generic one) types out under
 * it, the hero's portrait (greyed, tilted) drops in, a "so close" line (the
 * boss's HP left / the next boss's arrival / the gap to the best time), REVIVE
 * when owned, and RETRY next to RESULTS. The App banks the run as soon as this
 * modal opens with no revive left (or on victory); RETRY / RESULTS otherwise
 * bank it (App.bankRun, exactly once) before moving on, so coins, bests and the
 * run counter are never lost.
 */
import { CFG } from "../../game/config";
import { heroDef } from "../../game/heroes";
import { BOSSES } from "../../game/registry";
import type { World } from "../../game/world";
import type { App, UiScreen } from "../app";
import { esc, fmtTime, h, img, letters } from "../dom";
import { deathLine } from "../hub/copy";
import { portrait } from "../kit/art";
import { reducedMotion } from "../kit/ticker";
import { save } from "../save";
import { tbcBanner } from "../stinger";
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
  // this run's stage timeline (Dream Meadow: King Puff 3:00, Nightmare Teddy 6:00, Lady Lunatic 9:00)
  for (const ev of w.stage.events) {
    if (ev.kind !== "boss") continue;
    const at = ev.at + CFG.bossWarningTime;
    const def = BOSSES.get(ev.enemy ?? "");
    if (at > w.t && def?.boss && (!next || at < next.at)) next = { at, title: def.boss.title };
  }
  const lasted = `you lasted <b>${clock(w.t)}</b>`;
  // the best time on this stage (the account's per-stage record, before this run is banked)
  const best = save.profile.records[w.stage.id]?.bestTime ?? 0;
  if (next && next.at - w.t <= 60) return `<b>${esc(next.title)}</b> arrives at ${clock(next.at)} — ${lasted}`;
  if (best > w.t + 0.5) return `only <b>${clock(best - w.t)}</b> short of your best!`;
  if (best > 0) return `a new best time — ${lasted}!`;
  if (next) return `<b>${esc(next.title)}</b> arrives at ${clock(next.at)} — ${lasted}`;
  return `${lasted}!`;
}

export function openGameOver(app: App, w: World, victory: boolean): UiScreen {
  const el = h("div", `modal ${victory ? "victory" : "gameover tbc-over"}`);
  const canRevive = !victory && w.revivesLeft > 0;
  const hd = heroDef(w.hero.id);
  const killer = BOSSES.get(w.killedBy);
  const sub = deathLine(w.t, killer?.name, { hero: hd.name, n: app.currentEpisode.n, time: fmtTime(w.t) });
  const vic = w.stage.victory;
  el.innerHTML = victory
    ? `
    ${sparkles(30)}
    <div class="over-t">${letters(vic.title || "DAWN BREAKS!", "ltr", 0.08)}</div>
    <div class="over-s">${esc(vic.line || "the nightmare stampede fades with the sunrise")}<br>${fmtTime(w.t)} · LV ${w.level} · ${w.kills} KO</div>
    <div class="btn-row">
      <button class="btn" data-nav data-nav-default data-act="results">RESULTS ▶</button>
    </div>`
    : `
    <div class="sepia" aria-hidden="true"></div>
    ${tbcBanner()}
    <div class="over-sub typing" aria-label="${esc(sub)}"><span class="os-t">${reducedMotion() ? esc(sub) : ""}</span></div>
    <div class="over-por" style="--hc:${app.heroColor(hd.id)}">${portrait(hd.portrait, 0, "pimg")}<i class="sweat"></i></div>
    <div class="over-close">${soClose(w)}</div>
    <div class="over-s">EPISODE ${app.currentEpisode.n} · ${fmtTime(w.t)} · LV ${w.level} · ${w.kills} KO</div>
    <div class="btn-row">
      ${canRevive ? `<button class="btn gold" data-nav data-nav-default data-act="revive">${img("icon_hp_up")} REVIVE (${w.revivesLeft})</button>` : ""}
      <button class="btn${canRevive ? " small" : ""}" data-nav ${canRevive ? "" : "data-nav-default"} data-act="retry">↻ RETRY</button>
      <button class="btn ${canRevive ? "ghost" : "violet"} small" data-nav data-act="results">RESULTS ▶</button>
    </div>`;
  app.ui.appendChild(el);
  let t = 0;
  let banked = false;
  // the buttons wake up 0.5 s after the stinger lands - in REAL time: the App caps a frame's dt at 1/20 s, so on a
  // slow device a frame-time guard could swallow a deliberate tap / Enter for seconds
  const born = performance.now();
  const asleep = () => performance.now() - born < 500;
  // the subtitle types out once the banner has landed (text changes only when a letter is added)
  const subEl = el.querySelector(".os-t") as HTMLElement | null;
  let typedN = reducedMotion() ? sub.length : 0;
  onTap(el.querySelector('[data-act="revive"]'), () => {
    if (asleep()) return;
    if (w.revive()) {
      app.sfx("revive");
      app.closeModal();
      app.revived();
    }
  });
  onTap(el.querySelector('[data-act="retry"]'), () => {
    if (asleep() || banked) return;
    // bank the run like the Results screen does (coins, bests, run counter), then go again
    banked = true;
    app.sfx("uiConfirm");
    app.retryFromGameOver();
  });
  onTap(el.querySelector('[data-act="results"]'), () => {
    if (asleep() || banked) return;
    app.sfx("uiConfirm");
    app.endRun();
  });
  // victory: the sfx + victory track already started with the "victory" event (feedback.ts)
  if (!victory) {
    app.sfx("gameOver");
    setTimeout(() => app.sfx("toBeContinued"), 180);
  }
  return {
    el,
    layer: layer(el),
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
    update(dt) {
      t += dt;
      if (subEl && typedN < sub.length && t > 0.75) {
        const n = Math.min(sub.length, Math.floor((t - 0.75) * 45));
        if (n !== typedN) {
          typedN = n;
          subEl.textContent = sub.slice(0, n);
        }
      }
      if (app.params.autoplay && t > 2.5) {
        if (canRevive && w.revive()) {
          app.closeModal();
          app.revived();
        } else app.endRun();
      }
    },
  };
}
