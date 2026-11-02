import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

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

// `npm run build`         -> dist/        (multi-file, for GitHub Pages; BASE_PATH sets the sub-path)
// `npm run build:single`  -> dist-single/ (one self-contained index.html, for sharing as a single page)
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    base: single ? "./" : process.env.BASE_PATH || "./",
    plugins: single ? [standaloneHead(), viteSingleFile()] : [],
    publicDir: single ? false : "public",
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
