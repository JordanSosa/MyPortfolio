import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build`         -> dist/        (multi-file, for GitHub Pages; BASE_PATH sets the sub-path)
// `npm run build:single`  -> dist-single/ (one self-contained index.html, for sharing as a single page)
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    base: single ? "./" : process.env.BASE_PATH || "./",
    plugins: single ? [viteSingleFile()] : [],
    server: { port: Number(process.env.PORT) || 5173, strictPort: false },
    build: {
      outDir: single ? "dist-single" : "dist",
      target: "es2022",
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 2000,
    },
  };
});
