import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "c8",
      include: ["lib/**/*.{js,ts}"],
      exclude: ["**/*.test.{js,ts}", "lib/types.ts"],
    },
  },
});
