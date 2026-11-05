// Config for `npm run progression` (tools/progression.sim.ts): kept out of the normal `npm test` run.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tools/progression.sim.ts"], testTimeout: 7_200_000 },
});
