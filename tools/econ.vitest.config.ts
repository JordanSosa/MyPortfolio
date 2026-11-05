// Config for the economy helpers (tools/econ.sim.ts: payout fitting, checkpoint repricing): kept out of `npm test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tools/econ.sim.ts"], testTimeout: 600_000 },
});
