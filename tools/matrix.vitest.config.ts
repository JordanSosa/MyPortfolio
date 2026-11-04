// Config for the power-vs-stage matrix worker (tools/matrix.sim.ts, driven by tools/matrix.mjs): kept out of `npm test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tools/matrix.sim.ts"], testTimeout: 36_000_000 },
});
