import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { TestContext } from 'vitest'
import type * as Lib from '../../src/index.js'

type Library = typeof Lib

/**
 * The builds a benchmark measures: this checkout's (`pnpm bench` builds it), and with
 * `BENCH_BASE` the one it's compared to, in the same run (`pnpm bench:compare` builds
 * `origin/main`'s). Builds, not `src/`: vitest's module runner adds overhead to every export
 * access.
 */
const current: Library = await import(
  new URL('../../dist/index.mjs', import.meta.url).href
)
const base: Library | undefined = process.env.BENCH_BASE
  ? await import(pathToFileURL(resolve(process.env.BENCH_BASE)).href)
  : undefined

/** Per case: its median latency in each build, for the summary. */
const rows: {
  test: string
  name: string
  current: number
  base: number | undefined
}[] = []

/**
 * Measures `cases` of each build side by side: `cases` gets a build and returns the functions to
 * measure, by name. A case the base build can't run is measured alone.
 */
export async function measure(
  { bench, task }: TestContext,
  cases: (lib: Library) => Record<string, () => unknown>,
): Promise<void> {
  const now = cases(current)
  let before: Record<string, () => unknown> = {}
  try {
    if (base) before = cases(base)
  } catch {
    // an export the base doesn't have yet
  }

  const registrations = []
  for (const [name, fn] of Object.entries(now)) {
    registrations.push(bench(name, fn))
    if (before[name]) registrations.push(bench(`${name} (base)`, before[name]))
  }
  const results = await bench.compare(...registrations)
  for (const name of Object.keys(now)) {
    rows.push({
      test: task.name,
      name,
      current: results.get(name).latency.p50,
      base: before[name]
        ? results.get(`${name} (base)`).latency.p50
        : undefined,
    })
  }
}

const ms = (value: number) => `${value.toFixed(4)} ms`

/** Slower than this counts as a regression worth a look: runners vary by about as much. */
const NOTEWORTHY = 0.15

/** The medians of a file's benchmarks as Markdown; appended to `BENCH_SUMMARY`, as CI's. */
afterAll(() => {
  if (!rows.length) return
  const lines: string[] = []
  let test: string | undefined
  for (const row of rows) {
    if (row.test !== test) {
      test = row.test
      lines.push('', `#### ${test}`, '')
      lines.push(
        base
          ? '| case | base | current | Δ |\n| --- | ---: | ---: | ---: |'
          : '| case | current |\n| --- | ---: |',
      )
    }
    if (!base) {
      lines.push(`| ${row.name} | ${ms(row.current)} |`)
      continue
    }
    const delta =
      row.base === undefined ? undefined : (row.current - row.base) / row.base
    const shown =
      delta === undefined
        ? 'new'
        : `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)} %${delta > NOTEWORTHY ? ' ⚠️' : ''}`
    lines.push(
      `| ${row.name} | ${row.base === undefined ? '–' : ms(row.base)} | ${ms(row.current)} | ${shown} |`,
    )
  }
  const markdown = lines.join('\n') + '\n'
  console.log(markdown)
  if (process.env.BENCH_SUMMARY) {
    appendFileSync(process.env.BENCH_SUMMARY, markdown)
  }
})
