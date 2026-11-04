import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, runnerImport, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/** tools/bake-atlas.ts `bakeAtlas()` (typed here: the config bundle imports nothing from the game). */
interface BakedAtlas {
  meta: { width: number; height: number; fx: number[] };
  png: Uint8Array;
}

const ATLAS_ID = "virtual:kk-atlas";
const ATLAS_RESOLVED = `\0${ATLAS_ID}`;

/**
 * The production build bakes the texture atlas (docs/ENGINE.md "Boot path"): every sprite is painted
 * and packed once here, in Node (tools/bake-atlas.ts through Vite's module runner, for import.meta.glob),
 * and `virtual:kk-atlas` hands the client its tables plus atlas.png (an emitted asset, or a data URI in
 * the single-file build). The dev server and Vitest get `null` and paint at runtime, so the sprite
 * modules never reach the production bundle.
 */
function bakedAtlas(single: boolean): Plugin {
  let build = false;
  let baked: BakedAtlas | null = null;
  return {
    name: "kko-baked-atlas",
    configResolved(c) {
      build = c.command === "build";
    },
    async buildStart() {
      if (!build) return;
      const t0 = Date.now();
      const tool = fileURLToPath(new URL("./tools/bake-atlas.ts", import.meta.url));
      const { module } = await runnerImport<{ bakeAtlas(): BakedAtlas }>(tool, { configFile: false, root: fileURLToPath(new URL(".", import.meta.url)), logLevel: "error" });
      baked = module.bakeAtlas();
      this.info(`baked atlas ${baked.meta.width}x${baked.meta.height}, ${baked.meta.fx.length} frames, png ${(baked.png.length / 1024).toFixed(0)} KB in ${Date.now() - t0} ms`);
    },
    resolveId(id) {
      return id === ATLAS_ID ? ATLAS_RESOLVED : null;
    },
    load(id) {
      if (id !== ATLAS_RESOLVED) return null;
      if (!build || !baked) return "export default null;";
      const meta = JSON.stringify(baked.meta);
      if (single) return `export default { meta: ${meta}, url: "data:image/png;base64,${Buffer.from(baked.png).toString("base64")}" };`;
      const ref = this.emitFile({ type: "asset", name: "atlas.png", source: baked.png });
      return `export default { meta: ${meta}, url: import.meta.ROLLUP_FILE_URL_${ref} };`;
    },
  };
}

/**
 * Single-file build: the page must work when shared on its own, so the favicon
 * is inlined as a data URI and the PWA manifest / apple-touch-icon links (which
 * would 404 next to a lone HTML file) are dropped.
 */
function standaloneHead(): Plugin {
  return {
    name: "kko-standalone-head",
    transformIndexHtml(html) {
      const icon = `data:image/png;base64,${readFileSync(new URL("./public/icon-192.png", import.meta.url)).toString("base64")}`;
      return html
        .replace(/\s*<link rel="manifest"[^>]*>/, "")
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, "")
        .replace(/href="\.\/icon-192\.png"/g, `href="${icon}"`);
    },
  };
}

/** Build stamp for Settings "Copy diagnostics" (src/debug/diag.ts `__KK_BUILD__`): package version, commit, date. */
function buildStamp(): { version: string; commit: string; date: string } {
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (execSync("git status --porcelain --untracked-files=no", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim()) commit += "+dirty";
  } catch {
    /* not a git checkout */
  }
  const version = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version?: string }).version ?? "0";
  return { version, commit, date: new Date().toISOString().slice(0, 16).replace("T", " ") };
}

// `npm run build`         -> dist/        (multi-file, for GitHub Pages; BASE_PATH sets the sub-path)
// `npm run build:single`  -> dist-single/ (one self-contained index.html, for sharing as a single page)
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    base: single ? "./" : process.env.BASE_PATH || "./",
    plugins: single ? [bakedAtlas(true), standaloneHead(), viteSingleFile()] : [bakedAtlas(false)],
    publicDir: single ? false : "public",
    define: { __KK_BUILD__: JSON.stringify(buildStamp()) },
    server: { port: Number(process.env.PORT) || 5173, strictPort: false },
    build: {
      outDir: single ? "dist-single" : "dist",
      emptyOutDir: true,
      target: "es2022",
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
    },
  };
});
