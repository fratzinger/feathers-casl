import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "c8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.{js,ts}"],
      exclude: ["**/*.test.{js,ts}", "lib/types.ts"],
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    },
  },
});
