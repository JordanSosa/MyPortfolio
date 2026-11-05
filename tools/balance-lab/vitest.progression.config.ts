// The balance lab's progression sample (tools/balance-lab/progression.lab.ts): kept out of `npm test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tools/balance-lab/progression.lab.ts"], testTimeout: 36_000_000 },
});
