/** Splash: "TAP TO START" (the first gesture unlocks WebAudio). */
import type { App, UiScreen } from "../app";
import { h } from "../dom";
import { sparkles } from "./common";

export function showSplash(app: App): UiScreen {
  const el = h("div", "scr splash");
  el.innerHTML = `
    ${sparkles(22)}
    <div class="logo-mini">KIRA☆KIRA<b>OVERDRIVE</b></div>
    <div class="tap">TAP TO START</div>
    <div class="hint">best with sound on ♪</div>`;
  el.setAttribute("data-ui", "");
  app.ui.appendChild(el);
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    app.unlockAudio();
    app.sfx("uiConfirm");
    app.goTitle();
  };
  el.addEventListener("click", go);
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    go();
  };
  window.addEventListener("keydown", onKey);
  return {
    el,
    layer: null,
    close() {
      window.removeEventListener("keydown", onKey);
      el.classList.add("out");
      setTimeout(() => el.remove(), 240);
    },
    update() {
      // gamepad: any face button
      if (app.input.pressed("confirm") || app.input.pressed("dash") || app.input.pressed("pause")) go();
    },
  };
}
