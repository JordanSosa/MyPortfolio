/**
 * Boot: fonts, page shell, atlas, app (renderer + input + audio + screens), debug hooks.
 *
 * index.html carries a static, inline-styled splash (#boot) so the first paint
 * is immediate; boot() waits one animation frame (so that splash is on screen),
 * loads the texture atlas (the production build's baked atlas.png, or the
 * sprites painted at runtime on the dev server: render/atlas-source.ts, docs/
 * ENGINE.md "Boot path"), builds the App and removes the splash once it runs.
 * A constructor failure only reports "needs WebGL2" when WebGL2 really is
 * missing; anything else (e.g. a bad saved setting) resets the settings and
 * retries once before showing a generic error.
 */
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/silkscreen/400.css";
import "./ui/styles.css";
import "./ui/kit/kit.css";
import "./ui/hub/hub.css";
import { readParams } from "./debug/params";
import { installHooks } from "./debug/hooks";
import { installDiag } from "./debug/diag";
import { installDev } from "./debug/dev";
import { preloadAtlas } from "./render/atlas-source";
import { App } from "./ui/app";
import { resetSettings } from "./ui/save";

function fatal(msg: string): void {
  document.getElementById("boot")?.remove();
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;display:grid;place-items:center;text-align:center;padding:24px;font:16px/1.5 'Pixelify Sans',system-ui,sans-serif;color:#fff;background:#2d1b45;z-index:9999";
  el.innerHTML = `<div><div style="font-size:28px;margin-bottom:12px">✦ Kira Kira Overdrive ✦</div>${msg}</div>`;
  document.body.appendChild(el);
}

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/** Remove what a failed App constructor left behind (its canvas, touch overlay, HUD). */
function cleanupFailedApp(): void {
  for (const c of document.querySelectorAll<HTMLCanvasElement>("canvas.kk-canvas")) {
    try {
      c.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      /* ignore */
    }
    c.remove();
  }
  for (const el of document.querySelectorAll(".kk-touch, .kk-fps")) el.remove();
  const ui = document.getElementById("ui");
  if (ui) ui.replaceChildren();
}

function createApp(): App | null {
  const params = readParams();
  try {
    return new App(params);
  } catch (e) {
    console.error(e);
    if (!hasWebGL2()) {
      fatal("This game needs WebGL2.<br>Please try a recent Chrome, Safari or Firefox.");
      return null;
    }
  }
  // not a WebGL problem: start again from default settings once
  cleanupFailedApp();
  resetSettings();
  try {
    return new App(params);
  } catch (e) {
    console.error(e);
    cleanupFailedApp();
    fatal("Something went wrong while starting the game.<br>Please reload the page.");
    return null;
  }
}

async function boot(): Promise<void> {
  // diagnostics (Settings "Copy diagnostics"): record errors / warnings from the very start
  installDiag();
  // block pinch / double-tap zoom and long-press menus on iOS
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  // (text fields keep their double-tap selection and long-press paste menu: the save import box)
  const textField = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("textarea, input");
  document.addEventListener("dblclick", (e) => !textField(e.target) && e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => !textField(e.target) && e.preventDefault());
  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.target as HTMLElement | null;
      // allow scrolling inside scrollable menus only (hub pages / sheets / strips use .kscroll / .kscroll-x)
      // (a held finger's moves while another one scrolls a panel are not cancelable: Chrome logs an intervention)
      if (e.cancelable && !t?.closest(".kscroll, .kscroll-x, .tabbar, .results, .pause-panel, .settings-panel, textarea")) e.preventDefault();
    },
    { passive: false },
  );
  // let the static splash (index.html #boot) paint before the atlas loads and the constructor runs
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  try {
    await preloadAtlas();
  } catch (e) {
    console.error(e);
    fatal("The game's art could not be loaded.<br>Please check your connection and reload the page.");
    return;
  }
  const app = createApp();
  if (!app) return;
  installHooks(app);
  // developer suite: ?step=1 / ?scenario= / ?dev=1, the ` key, a 3-finger long-press (lazy chunks)
  installDev(app);
  app.start();
  document.getElementById("boot")?.remove();
}

void boot();
