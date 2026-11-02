/** Pause menu: build overview (weapons + passives with levels), stat sheet, resume / settings / quit. */
import { CFG } from "../../game/config";
import { describeStats } from "../../game/stats";
import type { World } from "../../game/world";
import type { App, UiScreen } from "../app";
import { esc, fmtTime, h, img } from "../dom";
import { layer, onTap } from "./common";

export function openPause(app: App, w: World): UiScreen {
  const el = h("div", "modal pause");
  const slots = (n: number, items: string[]) => {
    let s = items.join("");
    for (let i = items.length; i < n; i++) s += `<div class="bslot empty"></div>`;
    return s;
  };
  const weapons = w.weapons.map((wi) => `<div class="bslot${wi.def.evolved ? " evo" : ""}" title="${esc(wi.def.name)}">${img(wi.def.icon, "px", 0, 2)}<span class="lv">${wi.def.evolved ? "EVO" : `Lv${wi.level}`}</span></div>`);
  const passives = w.passives.map((p) => `<div class="bslot" title="${esc(p.def.name)}">${img(p.def.icon, "px", 0, 2)}<span class="lv">Lv${p.level}</span></div>`);
  el.innerHTML = `
    <div class="panel pause-panel">
      <div class="h1">PAUSED</div>
      <div class="h2">${esc(w.hero.name)} · LV ${w.level} · ${fmtTime(w.t)} · ${w.kills} KO</div>
      <div class="build">
        <div class="h2">WEAPONS</div><div class="row">${slots(CFG.weaponSlots, weapons)}</div>
        <div class="h2">PASSIVES</div><div class="row">${slots(CFG.passiveSlots, passives)}</div>
      </div>
      <div class="stat-grid">${describeStats(w.stats)
        .map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
        .join("")}</div>
      <div class="btn-row">
        <button class="btn" data-nav data-nav-default data-act="resume">▶ RESUME</button>
        <button class="btn violet small" data-nav data-act="settings">⚙ SETTINGS</button>
        <button class="btn ghost small" data-nav data-act="quit">✕ QUIT RUN</button>
      </div>
    </div>`;
  app.ui.appendChild(el);
  onTap(el.querySelector('[data-act="resume"]'), () => app.resume());
  onTap(el.querySelector('[data-act="settings"]'), () => {
    app.sfx("uiConfirm");
    app.openSettingsModal();
  });
  let confirmQuit = false;
  const quitBtn = el.querySelector('[data-act="quit"]') as HTMLElement;
  onTap(quitBtn, () => {
    if (!confirmQuit) {
      confirmQuit = true;
      quitBtn.textContent = "SURE? TAP AGAIN";
      app.sfx("uiDeny");
      return;
    }
    app.sfx("uiBack");
    app.endRun();
  });
  return {
    el,
    layer: layer(el, () => app.resume()),
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
  };
}
