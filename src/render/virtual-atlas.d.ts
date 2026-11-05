/** The atlas baked by the production build (vite.config.ts `bakedAtlas`); null on the dev server / in tests. */
declare module "virtual:kk-atlas" {
  import type { BakedAtlasMeta } from "./atlas";
  const baked: { meta: BakedAtlasMeta; url: string } | null;
  export default baked;
}
