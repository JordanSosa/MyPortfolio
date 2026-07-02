// In-game screenshots of the integrated GLB character: idle, running, combat.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "/tmp/claude-0/-home-user-MyPortfolio/6911641b-ac73-5033-856f-ebc0ce66d168/scratchpad";
const PORT = 4181;

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "pipe" });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.click(".cs-card:first-child"); // blademaster
await page.click("#cs-start");
await page.waitForTimeout(4500); // world + model load

// model loaded?
const modelState = await page.evaluate(() => ({
  hasCtl: !!window.__aether.G.playerEnt?.ctl,
  clips: window.__aether.G.playerEnt?.ctl ? Object.keys(window.__aether.G.playerEnt.ctl.actions) : [],
}));
console.log("modelState:", JSON.stringify(modelState));

await page.screenshot({ path: `${OUT}/ingame-idle.png` });

// run north
await page.keyboard.down("w");
await page.waitForTimeout(1300);
await page.screenshot({ path: `${OUT}/ingame-run.png` });
await page.waitForTimeout(3500);
await page.keyboard.up("w");

// fight a puffling
await page.evaluate(() => { window.__aether.G.player.pos = { x: -18, z: 48 }; });
await page.waitForTimeout(600);
await page.keyboard.press("Tab");
await page.keyboard.press("1");
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/ingame-attack.png` });
await page.keyboard.press("r");
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/ingame-combat.png` });

console.log("ERRORS:", errors.length ? errors.slice(0, 12).join("\n") : "none");
await browser.close();
server.kill();
