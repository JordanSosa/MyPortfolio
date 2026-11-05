// Generate the PWA icons (public/icon-192.png, public/icon-512.png) from the atlas:
// Hoshi's portrait on a dreamy gradient badge. Re-run after portrait art changes.
//   node scripts/icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { startServer, launchBrowser, newPage } from "./lib.mjs";

const { url, close } = await startServer();
const browser = await launchBrowser();
try {
  const page = await newPage(browser, { w: 800, h: 600 });
  await page.goto(`${url}/?screen=title&mute=1`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__kk, null, { timeout: 30000 });
  for (const size of [192, 512]) {
    const data = await page.evaluate((S) => {
      const atlas = window.__kk.app.r.atlas;
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = c.getContext("2d");
      // background: rounded-safe full bleed (maskable), dreamy gradient + rays
      const bg = g.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.75);
      bg.addColorStop(0, "#ffb8dc");
      bg.addColorStop(0.45, "#b47cff");
      bg.addColorStop(1, "#2d1b45");
      g.fillStyle = bg;
      g.fillRect(0, 0, S, S);
      g.save();
      g.translate(S / 2, S * 0.46);
      g.fillStyle = "rgba(255, 247, 176, 0.18)";
      for (let i = 0; i < 16; i++) {
        g.rotate((Math.PI * 2) / 16);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(S, -S * 0.1);
        g.lineTo(S, S * 0.1);
        g.fill();
      }
      g.restore();
      // portrait (pixel-perfect integer scale), inside the maskable safe zone (80%)
      const src = atlas.canvas("portrait_hoshi", 0, 1);
      const scale = Math.max(1, Math.round((S * 0.66) / src.width));
      g.imageSmoothingEnabled = false;
      const w = src.width * scale;
      g.drawImage(src, Math.round((S - w) / 2), Math.round(S * 0.47 - w / 2), w, w);
      // sparkle star
      const star = (x, y, r) => {
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = i % 2 ? r * 0.28 : r;
          g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        g.closePath();
        g.fill();
      };
      g.fillStyle = "#fff7b0";
      star(S * 0.8, S * 0.2, S * 0.07);
      star(S * 0.18, S * 0.72, S * 0.045);
      return c.toDataURL("image/png");
    }, size);
    mkdirSync("public", { recursive: true });
    writeFileSync(`public/icon-${size}.png`, Buffer.from(data.split(",")[1], "base64"));
    console.log(`wrote public/icon-${size}.png`);
  }
} finally {
  await browser.close();
  await close();
}
