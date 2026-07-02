// Screenshot a model's animations via viewer.html in headless Chromium.
//   node tools/shoot-model.mjs <name> [outdir]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2];
const outDir = process.argv[3] || "/tmp/claude-0/-home-user-MyPortfolio/6911641b-ac73-5033-856f-ebc0ce66d168/scratchpad";
const PORT = 4179;

const dir = join(ROOT, "public/models", name);
const files = readdirSync(dir).filter((f) => f.endsWith(".glb"));
console.log("files:", files.join(", "));

const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "pipe" });
await new Promise((r) => setTimeout(r, 3000));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

async function shoot(file, label, angle, t) {
  const url = `http://localhost:${PORT}/viewer.html?model=/models/${name}/${file}&angle=${angle}${t != null ? `&t=${t}` : ""}&toon=1`;
  await page.goto(url, { waitUntil: "networkidle" });
  try {
    await page.waitForFunction("window.__ready === true || window.__error", { timeout: 20000 });
  } catch { console.log(`TIMEOUT ${file}`); return; }
  const err = await page.evaluate("window.__error");
  if (err) { console.log(`ERROR ${file}: ${err}`); return; }
  const clips = await page.evaluate("window.__clips");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/${name}-${label}.png` });
  console.log(`shot ${name}-${label}.png  clips=${JSON.stringify(clips)}`);
}

// base model turntable
if (files.includes("base.glb")) {
  await shoot("base.glb", "base-front", 0.2);
  await shoot("base.glb", "base-side", 1.6);
  await shoot("base.glb", "base-back", 3.1);
}
// each animation at two points in the cycle
for (const f of files.filter((f) => f.startsWith("anim_"))) {
  const label = f.replace(".glb", "").replace("anim_", "");
  await shoot(f, `${label}-a`, 0.5, 0.3);
  await shoot(f, `${label}-b`, 0.5, 0.7);
}

await browser.close();
server.kill();
