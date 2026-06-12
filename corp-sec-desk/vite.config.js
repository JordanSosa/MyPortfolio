import { defineConfig } from "vite";

// Project lives at https://<user>.github.io/MyPortfolio/ on GitHub Pages,
// so assets are served from the /MyPortfolio/ sub-path. The BASE_PATH env
// var lets the GitHub Actions workflow override this; it defaults to "/"
// for local dev and root-domain hosts (Cloudflare Pages, Netlify).
export default defineConfig({
  base: process.env.BASE_PATH || "/",
});
