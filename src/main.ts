/**
 * Boot: fonts, page shell, app (renderer + atlas + input + audio + screens), debug hooks.
 */
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/silkscreen/400.css";
import "./ui/styles.css";
import { readParams } from "./debug/params";
import { installHooks } from "./debug/hooks";
import { App } from "./ui/app";

function fatal(msg: string): void {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;display:grid;place-items:center;text-align:center;padding:24px;font:16px/1.5 'Pixelify Sans',system-ui,sans-serif;color:#fff;background:#2d1b45;z-index:9999";
  el.innerHTML = `<div><div style="font-size:28px;margin-bottom:12px">✦ Kira Kira Overdrive ✦</div>${msg}</div>`;
  document.body.appendChild(el);
}

function boot(): void {
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
  let app: App;
  try {
    app = new App(readParams());
  } catch (e) {
    console.error(e);
    fatal("This game needs WebGL2.<br>Please try a recent Chrome, Safari or Firefox.");
    return;
  }
  installHooks(app);
  app.start();
}

boot();
