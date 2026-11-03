/**
 * Splash: "TAP TO START" (the first gesture unlocks WebAudio). Translucent over
 * the live attract game (it fades in from opaque while the attract world warms
 * up), with the three heroes' portraits as key art. On phones / tablets the tap
 * also asks for fullscreen (browser bars eat a landscape playfield) unless the
 * page already runs fullscreen / installed.
 */
import type { App, UiScreen } from "../app";
import { h } from "../dom";
import { heroLineup, sparkles } from "./common";

function wantsFullscreen(): boolean {
  try {
    return (
      matchMedia("(pointer: coarse)").matches &&
      document.fullscreenEnabled === true &&
      typeof document.documentElement.requestFullscreen === "function" &&
      !document.fullscreenElement &&
      !matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches
    );
  } catch {
    return false;
  }
}

export function showSplash(app: App): UiScreen {
  const el = h("div", "scr splash");
  el.innerHTML = `
    ${sparkles(22)}
    <div class="key-art">
      <div class="logo-mini">KIRA☆KIRA<b>OVERDRIVE</b></div>
      ${heroLineup((id) => app.heroColor(id))}
    </div>
    <div class="tap">TAP TO START</div>
    <div class="hint">best with sound on ♪</div>`;
  el.setAttribute("data-ui", "");
  app.ui.appendChild(el);
  let done = false;
  const go = (gesture: boolean) => {
    if (done) return;
    done = true;
    // (a real user activation: the click / key that dismissed the splash)
    if (gesture && wantsFullscreen()) {
      try {
        document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      } catch {
        /* not allowed */
      }
    }
    app.unlockAudio();
    app.sfx("uiConfirm");
    app.goHub();
  };
  el.addEventListener("click", () => go(true));
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    go(true);
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
      // gamepad: any face button (not a user activation for fullscreen)
      if (app.input.pressed("confirm") || app.input.pressed("dash") || app.input.pressed("pause")) go(false);
    },
  };
}
