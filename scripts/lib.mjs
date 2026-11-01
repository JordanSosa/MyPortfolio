// Shared helpers for tool scripts: start a Vite dev server + launch headless Chromium with WebGL.
import { createServer } from "vite";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Playwright is pre-installed globally in this environment; fall back to the global npm root.
const require = createRequire(import.meta.url);
function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const root = execSync("npm root -g").toString().trim();
    return require(`${root}/playwright`);
  }
}
const { chromium, devices } = loadPlaywright();
import { dirname } from "node:path";

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) out[k] = true;
      else {
        out[k] = v;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

/** Start a Vite dev server on a random free-ish port. Returns { server, url, close }. */
export async function startServer({ port } = {}) {
  const p = port ?? 5200 + Math.floor(Math.random() * 700);
  const server = await createServer({
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    root: new URL("..", import.meta.url).pathname,
    server: { port: p, host: "127.0.0.1", strictPort: false, hmr: false },
    logLevel: "error",
    clearScreen: false,
  });
  await server.listen();
  const url = (server.resolvedUrls?.local?.[0] ?? `http://127.0.0.1:${p}/`).replace(/\/$/, "");
  return { server, url, close: () => server.close() };
}

export const CHROME_ARGS = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
];

export async function launchBrowser() {
  return chromium.launch({ args: CHROME_ARGS });
}

/**
 * New page. opts.mobile -> iPhone 13 emulation (touch, DPR 3); opts.landscape flips it.
 * opts.w/opts.h -> desktop viewport. Collects console + page errors into page.__logs.
 */
export async function newPage(browser, opts = {}) {
  let ctxOpts;
  if (opts.mobile) {
    const d = devices["iPhone 13"];
    ctxOpts = { ...d };
    if (opts.landscape) ctxOpts.viewport = { width: d.viewport.height, height: d.viewport.width };
    delete ctxOpts.defaultBrowserType;
  } else {
    ctxOpts = { viewport: { width: Number(opts.w ?? 1280), height: Number(opts.h ?? 720) }, deviceScaleFactor: Number(opts.dpr ?? 1) };
  }
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ""}`));
  page.__logs = logs;
  return page;
}

export function ensureDir(file) {
  mkdirSync(dirname(file), { recursive: true });
}
