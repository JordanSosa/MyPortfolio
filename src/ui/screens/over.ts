/** Game over ("DREAM OVER…", revive if owned) and victory ("DAWN BREAKS!"). */
import type { World } from "../../game/world";
import type { App, UiScreen } from "../app";
import { fmtTime, h, img, letters } from "../dom";
import { layer, onTap, sparkles } from "./common";

export function openGameOver(app: App, w: World, victory: boolean): UiScreen {
  const el = h("div", `modal ${victory ? "victory" : "gameover"}`);
  const canRevive = !victory && w.revivesLeft > 0;
  el.innerHTML = `
    ${victory ? sparkles(30) : ""}
    <div class="over-t">${letters(victory ? "DAWN BREAKS!" : "DREAM OVER…", "ltr", 0.08)}</div>
    <div class="over-s">${victory ? "the nightmare stampede fades with the sunrise" : "the plushies got you this time"}<br>${fmtTime(w.t)} · LV ${w.level} · ${w.kills} KO</div>
    <div class="btn-row">
      ${canRevive ? `<button class="btn gold" data-nav data-nav-default data-act="revive">${img("icon_hp_up")} REVIVE (${w.revivesLeft})</button>` : ""}
      <button class="btn${canRevive ? " ghost small" : ""}" data-nav ${canRevive ? "" : "data-nav-default"} data-act="results">RESULTS ▶</button>
    </div>`;
  app.ui.appendChild(el);
  let t = 0;
  onTap(el.querySelector('[data-act="revive"]'), () => {
    if (t < 0.5) return;
    if (w.revive()) {
      app.sfx("revive");
      app.closeModal();
      app.revived();
    }
  });
  onTap(el.querySelector('[data-act="results"]'), () => {
    if (t < 0.5) return;
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
