import { defineConfig } from "vite";

// Deployed as a static site (Cloudflare Pages / Netlify / GitHub Pages).
// On GitHub Pages the project lives under a /MyPortfolio/swallowed/ sub-path,
// so the CI workflow sets BASE_PATH to override this. It defaults to "/"
// for local dev and root-domain hosts.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
});
