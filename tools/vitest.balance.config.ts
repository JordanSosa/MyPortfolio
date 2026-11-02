// Config for `npm run balance` (tools/balance.probe.ts): kept out of the normal `npm test` run.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tools/balance.probe.ts"], testTimeout: 900_000 },
});
