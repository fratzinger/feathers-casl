import { defineConfig } from 'vitest/config'
import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'

// Like dotenv: existing environment variables take precedence over `.env`.
// Guard the call — loadEnvFile throws if no `.env` exists (e.g. in CI).
if (existsSync('.env')) {
  loadEnvFile()
}

/**
 * `CASL_VERSION=6` runs the suite against `@casl/ability@6` instead of the
 * installed v7 - feathers-casl supports both.
 */
const caslAlias =
  process.env.CASL_VERSION === '6'
    ? [
        {
          find: /^@casl\/ability\/extra$/,
          replacement: '@casl/ability-v6/extra',
        },
        { find: /^@casl\/ability$/, replacement: '@casl/ability-v6' },
      ]
    : []

export default defineConfig({
  resolve: {
    alias: caslAlias,
  },
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
