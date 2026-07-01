import { defineConfig } from "vite";

// Deployed as a static site. On GitHub Pages the project lives under a
// /MyPortfolio/aethermoor/ sub-path, so the CI workflow sets BASE_PATH to
// override this. It defaults to "/" for local dev and root-domain hosts.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
});
