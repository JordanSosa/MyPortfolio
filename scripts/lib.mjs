// Shared helpers for tool scripts: start a Vite dev server + launch headless Chromium with WebGL.
import { createServer, searchForWorkspaceRoot } from "vite";
import { mkdirSync, readFileSync, realpathSync } from "node:fs";
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
  // --help / -h on any tool script: print its header comment (the usage) and exit
  if (argv === process.argv.slice(2) || argv.join("\0") === process.argv.slice(2).join("\0")) {
    if (argv.includes("--help") || argv.includes("-h")) {
      const lines = readFileSync(process.argv[1], "utf8").split("\n");
      const head = [];
      for (const l of lines) {
        if (l.startsWith("#!")) continue;
        if (!l.startsWith("//")) break;
        head.push(l.replace(/^\/\/ ?/, ""));
      }
      console.log(head.join("\n") || "(no usage header)");
      process.exit(0);
    }
  }
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
  const root = new URL("..", import.meta.url).pathname;
  // a checkout whose node_modules is a symlink (a scratch copy / worktree of an old commit, see docs/DEVTOOLS.md §8)
  // serves the fonts from the link's real path: allow it next to the default workspace root
  let modules = null;
  try {
    modules = realpathSync(new URL("../node_modules", import.meta.url));
  } catch {
    /* no node_modules next to the scripts */
  }
  const server = await createServer({
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    root,
    server: { port: p, host: "127.0.0.1", strictPort: false, hmr: false, fs: { allow: [searchForWorkspaceRoot(root), ...(modules ? [modules] : [])] } },
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

/**
 * Software raster + compositing for the DOM (WebGL still renders through SwiftShader): with GPU raster on SwiftShader
 * the first screenshot after a navigation cost 1.4-1.8 s (rasterising the hub DOM on the "GPU"); in software it is
 * 50-80 ms (docs/DEVTOOLS.md §5).
 */
export const FAST_RASTER_ARGS = ["--disable-gpu-rasterization", "--disable-gpu-compositing"];

/** Headless Chromium with WebGL. `{ gpuRaster: true }` keeps the old GPU-rasterised DOM (slower screenshots). */
export async function launchBrowser({ gpuRaster = false } = {}) {
  return chromium.launch({ args: gpuRaster ? CHROME_ARGS : [...CHROME_ARGS, ...FAST_RASTER_ARGS] });
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
