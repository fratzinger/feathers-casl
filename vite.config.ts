import { defineConfig } from 'vitest/config'
import { existsSync } from 'node:fs'

// optional - CI passes POSTGRES_* through the environment instead
if (existsSync('.env')) {
  process.loadEnvFile()
}

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['**/*.test.{js,ts}', 'src/types.ts', '**/index.{js,ts}'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
