import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts on purpose. These tests talk to a real Redmine
// over HTTP, so they need Docker and they need the seed to have run. Keeping
// them out of the default suite is what lets `npm run verify` — the gate over
// this repository — stay offline.
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    // One Redmine, shared state, mutating tests. Parallel files would race on
    // the same issues.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
