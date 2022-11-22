import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "c8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.{js,ts}"],
      exclude: ["**/*.test.{js,ts}", "lib/types.ts"],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
});
