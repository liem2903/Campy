import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Tests share one local database; run files one at a time to keep them predictable.
    fileParallelism: false,
  },
});
