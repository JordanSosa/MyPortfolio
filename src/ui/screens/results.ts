/** Results: time, level, kills, max combo, coins, per-weapon damage bars, grade, NEW BEST badges; RETRY / TITLE. */
import { heroDef } from "../../game/heroes";
import type { RunSummary } from "../../game/world";
import type { App, UiScreen } from "../app";
import { esc, fmtNum, fmtTime, h, img } from "../dom";
import { recordRun, save } from "../save";
import { closeEl, layer, onTap } from "./common";

function grade(s: RunSummary): string {
  if (s.victory) return s.damageTaken < 150 ? "S" : "A";
  const score = s.time / 60 + s.kills / 400 + s.level / 12 + s.maxCombo / 300;
  return score > 9 ? "A" : score > 5 ? "B" : score > 2.5 ? "C" : "D";
}

export function showResults(app: App, s: RunSummary): UiScreen {
  const rec = recordRun(s);
  const hd = heroDef(s.hero);
  const g = grade(s);
  const el = h("div", "scr results");
  const maxD = Math.max(1, ...s.weapons.map((x) => x.damage));
  const nb = (on: boolean) => (on ? '<span class="badge">NEW BEST!</span>' : "");
  el.innerHTML = `
    <div class="panel res-panel">
      <div class="res-head">
        <div class="por" style="--hc:${app.heroColor(hd.id)}">${img(hd.portrait, "px", s.victory ? 0 : 1, 2)}</div>
        <div class="ttl"><div class="h1">${s.victory ? "VICTORY!" : "RESULTS"}</div><div class="h2">${esc(hd.name)} · ${esc(hd.title)}</div></div>
        <div class="grade ${g}">${g}</div>
      </div>
      <div class="res-rows">
        <div class="res-row" style="--i:0"><span>TIME</span><b data-count="${s.time}" data-fmt="time">00:00</b>${nb(rec.newBest.time)}</div>
        <div class="res-row" style="--i:1"><span>LEVEL</span><b data-count="${s.level}">0</b>${nb(rec.newBest.level)}</div>
        <div class="res-row" style="--i:2"><span>KILLS</span><b data-count="${s.kills}">0</b>${nb(rec.newBest.kills)}</div>
        <div class="res-row" style="--i:3"><span>MAX COMBO</span><b data-count="${s.maxCombo}">0</b>${nb(rec.newBest.combo)}</div>
      </div>
      <div class="h2">DAMAGE</div>
      <div class="dmg-list">${s.weapons
        .slice(0, 7)
        .map(
          (x) =>
            `<div class="dmg">${x.icon ? img(x.icon) : x.id === hd.ult ? img(hd.portrait, "px", 1, 1) : '<span class="noi">★</span>'}<div class="bar"><i data-k="${(x.damage / maxD).toFixed(3)}"></i><span>${esc(x.name)}</span></div><b>${fmtNum(x.damage)}</b></div>`,
        )
        .join("")}</div>
      <div class="earned"><span class="coins">${img("icon_coin")}+<span data-count="${s.coins}">0</span></span> <span class="h2">TOTAL ${save.data.coins}</span></div>
      <div class="btn-row">
        <button class="btn" data-nav data-nav-default data-act="retry">↻ RETRY</button>
        <button class="btn violet small" data-nav data-act="title">⌂ TITLE</button>
      </div>
    </div>`;
  app.ui.appendChild(el);
  onTap(el.querySelector('[data-act="retry"]'), () => app.retry());
  onTap(el.querySelector('[data-act="title"]'), () => {
    app.sfx("uiBack");
    app.goTitle();
  });
  const counters = Array.from(el.querySelectorAll<HTMLElement>("[data-count]"));
  let t = 0;
  let tick = 0;
  requestAnimationFrame(() => {
    for (const b of el.querySelectorAll<HTMLElement>(".dmg .bar i")) b.style.transform = `scaleX(${b.dataset.k})`;
  });
  return {
    el,
    layer: layer(el, () => app.goTitle()),
    close: () => closeEl(el),
    update(dt) {
      if (t > 1.6) return;
      t += dt;
      const k = Math.min(1, Math.max(0, (t - 0.3) / 1.1));
      const e = 1 - Math.pow(1 - k, 3);
      for (const c of counters) {
        const v = Number(c.dataset.count) * e;
        c.textContent = c.dataset.fmt === "time" ? fmtTime(v) : fmtNum(v);
      }
      tick -= dt;
      if (k > 0 && k < 1 && tick <= 0) {
        tick = 0.06;
        app.sfx("countTick", 0.4, k * 10);
      }
    },
  };
}
