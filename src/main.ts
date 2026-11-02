/**
 * Boot: fonts, page shell, app (renderer + atlas + input + audio + screens), debug hooks.
 *
 * index.html carries a static, inline-styled splash (#boot) so the first paint
 * is immediate; boot() waits one animation frame (so that splash is on screen
 * before the long App constructor) and removes it once the app has started.
 * A constructor failure only reports "needs WebGL2" when WebGL2 really is
 * missing; anything else (e.g. a bad saved setting) resets the settings and
 * retries once before showing a generic error.
 */
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/silkscreen/400.css";
import "./ui/styles.css";
import { readParams } from "./debug/params";
import { installHooks } from "./debug/hooks";
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
  // block pinch / double-tap zoom and long-press menus on iOS
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.target as HTMLElement | null;
      // allow scrolling inside scrollable menus only
      if (!t?.closest(".select, .results, .shop, .pause-panel, .settings-panel")) e.preventDefault();
    },
    { passive: false },
  );
  // let the static splash (index.html #boot) paint before the long constructor runs
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const app = createApp();
  if (!app) return;
  installHooks(app);
  app.start();
  document.getElementById("boot")?.remove();
}

void boot();
