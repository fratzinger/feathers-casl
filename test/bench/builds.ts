import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Bench, BenchOptions, TestContext } from 'vitest'
import type * as Lib from '../../src/index.js'

type Library = typeof Lib

/** A function to measure, or one with what runs around each call, untimed (`beforeEach`, …). */
export type Case = (() => unknown) | (BenchOptions & { fn: () => unknown })

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

/**
 * Per case: its median latency in this checkout's build, and in what it's compared to: the base
 * build (`measure`) or the same call without feathers-casl (`measureNet`). For the summary.
 */
const rows: {
  test: string
  name: string
  current: number
  base?: number
  withoutCasl?: number
}[] = []

function register(bench: Bench, name: string, task: Case) {
  if (typeof task === 'function') return bench(name, task)
  const { fn, ...options } = task
  return bench(name, options, fn)
}

/**
 * Measures `cases` of each build side by side: `cases` gets a build and returns the functions to
 * measure, by name. A case the base build can't run is measured alone.
 */
export async function measure(
  { bench, task }: TestContext,
  cases: (lib: Library) => Record<string, Case>,
): Promise<void> {
  const now = cases(current)
  let before: Record<string, Case> = {}
  try {
    if (base) before = cases(base)
  } catch {
    // an export the base doesn't have yet
  }

  const registrations = []
  for (const [name, fn] of Object.entries(now)) {
    registrations.push(register(bench, name, fn))
    if (before[name])
      registrations.push(register(bench, `${name} (base)`, before[name]))
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

/**
 * Measures `cases` of this checkout's build against `withoutCasl`, the same calls without
 * feathers-casl by the same names: what it costs net. Each pair in either order, the medians
 * averaged: on Postgres, whichever of two runs second runs slower, by up to a third.
 */
export async function measureNet(
  { bench, task }: TestContext,
  cases: (lib: Library) => Record<string, Case>,
  withoutCasl: Record<string, Case>,
): Promise<void> {
  const withCasl = cases(current)
  const medians: Record<string, { current: number; withoutCasl: number }> = {}
  for (const round of [1, 2]) {
    const registrations = []
    for (const name of Object.keys(withCasl)) {
      const pair = [
        register(bench, `${name} #${round}`, withCasl[name]),
        register(bench, `${name} without casl #${round}`, withoutCasl[name]),
      ]
      if (round === 2) pair.reverse()
      registrations.push(...pair)
    }
    const results = await bench.compare(...registrations)
    for (const name of Object.keys(withCasl)) {
      const median = (medians[name] ??= { current: 0, withoutCasl: 0 })
      median.current += results.get(`${name} #${round}`).latency.p50 / 2
      median.withoutCasl +=
        results.get(`${name} without casl #${round}`).latency.p50 / 2
    }
  }
  for (const [name, median] of Object.entries(medians)) {
    rows.push({ test: task.name, name, ...median })
  }
}

const ms = (value: number | undefined) =>
  value === undefined ? '–' : `${value.toFixed(4)} ms`
const percent = (value: number) =>
  `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)} %`

/** Slower than this counts as a regression worth a look: runners vary by about as much. */
const NOTEWORTHY = 0.15

function change(current: number, base: number | undefined) {
  if (base === undefined) return 'new'
  const delta = (current - base) / base
  return `${percent(delta)}${delta > NOTEWORTHY ? ' ⚠️' : ''}`
}

const cost = (current: number, withoutCasl: number) =>
  `+${ms(current - withoutCasl)} (${percent((current - withoutCasl) / withoutCasl)})`

const tableRow = (cells: string[]) => `| ${cells.join(' | ')} |`

function columnsOf(row: (typeof rows)[number]) {
  if (row.withoutCasl !== undefined)
    return ['case', 'without casl', 'with casl', 'net']
  return base ? ['case', 'base', 'current', 'Δ'] : ['case', 'current']
}

function cellsOf(row: (typeof rows)[number]) {
  if (row.withoutCasl !== undefined) {
    return [
      row.name,
      ms(row.withoutCasl),
      ms(row.current),
      cost(row.current, row.withoutCasl),
    ]
  }
  if (!base) return [row.name, ms(row.current)]
  return [
    row.name,
    ms(row.base),
    ms(row.current),
    change(row.current, row.base),
  ]
}

/** The medians of a file's benchmarks as Markdown; appended to `BENCH_SUMMARY`, as CI's. */
afterAll(() => {
  if (!rows.length) return
  const lines: string[] = []
  let test: string | undefined
  for (const row of rows) {
    if (row.test !== test) {
      test = row.test
      const columns = columnsOf(row)
      lines.push('', `#### ${test}`, '', tableRow(columns))
      lines.push(tableRow(columns.map((_, i) => (i ? '---:' : '---'))))
    }
    lines.push(tableRow(cellsOf(row)))
  }
  const markdown = lines.join('\n') + '\n'
  console.log(markdown)
  if (process.env.BENCH_SUMMARY) {
    appendFileSync(process.env.BENCH_SUMMARY, markdown)
  }
})
