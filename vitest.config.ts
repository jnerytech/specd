import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The integration suite needs Docker. `verify` is the gate, and the gate
    // may not require a container to be up: an offline layer that quietly
    // depends on a daemon is no longer offline. Run it with
    // `npm run test:integration`, which owns the container's lifecycle.
    exclude: ["node_modules/**", "dist/**", "test/integration/**"],
  },
});
