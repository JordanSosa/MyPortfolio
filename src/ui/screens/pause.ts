/**
 * Pause menu: build overview (weapons + passives with levels and names), stat
 * sheet, resume / settings / quit. Pause (P / START / BACK) toggles it closed;
 * Esc / B / Android Back resume through the nav back path.
 */
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
    for (let i = items.length; i < n; i++) s += `<div class="bitem"><div class="bslot empty"></div></div>`;
    return s;
  };
  // names are printed under the icons (touch has no hover tooltips)
  const item = (name: string, slot: string) => `<div class="bitem">${slot}<span class="bname">${esc(name)}</span></div>`;
  const weapons = w.weapons.map((wi) =>
    item(wi.def.name, `<div class="bslot${wi.def.evolved ? " evo" : ""}">${img(wi.def.icon, "px", 0, 2)}<span class="lv">${wi.def.evolved ? "EVO" : `Lv${wi.level}`}</span></div>`),
  );
  const passives = w.passives.map((p) => item(p.def.name, `<div class="bslot">${img(p.def.icon, "px", 0, 2)}<span class="lv">Lv${p.level}</span></div>`));
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
  const L = layer(el, () => app.resume());
  return {
    el,
    layer: L,
    close() {
      el.classList.add("out");
      setTimeout(() => el.remove(), 220);
    },
    update() {
      // the pause button toggles (Esc already resumed through the nav back path; settings on top: ignore)
      if (app.nav.top === L && app.input.pressed("pause")) {
        app.input.consume("pause");
        app.resume();
      }
    },
  };
}
