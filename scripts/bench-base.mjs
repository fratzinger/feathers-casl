// The build `pnpm bench:compare` compares this checkout's to: a git ref's (an argument or
// `BENCH_BASE_REF`, default `origin/main`), built where no test run or linter looks and where it
// finds this checkout's dependencies.
import { execFileSync } from 'node:child_process'
import process from 'node:process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ref = process.argv[2] ?? process.env.BENCH_BASE_REF ?? 'origin/main'
const dir = resolve('node_modules/.cache/bench-base')
const archive = `${dir}.tar`

rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
execFileSync('git', ['archive', '--output', archive, ref], { stdio: 'inherit' })
execFileSync('tar', ['-xf', archive, '-C', dir], { stdio: 'inherit' })
rmSync(archive)
// this checkout's tsdown: `pnpm exec` would install the base's dependencies anew. Node strips no
// types under `node_modules`, so `unrun` loads the base's config.
execFileSync(
  resolve('node_modules/.bin/tsdown'),
  ['--config-loader', 'unrun'],
  {
    cwd: dir,
    stdio: 'inherit',
  },
)

process.stdout.write(
  `\nbase build of ${ref}: node_modules/.cache/bench-base/dist\n`,
)
