import { defineAbility } from '@casl/ability'

import type * as Lib from '../../src/index.js'

// benchmark the build, not `src/` - vitest's module runner adds overhead to
// every export access. `BENCH_DIST` points to another build for A/B runs.
const { authorize }: typeof Lib = await import(
  process.env.BENCH_DIST ?? '../../dist/index.mjs'
)

const availableFields = ['id', 'title', 'body', 'secret', 'userId']

const ability = defineAbility((can, cannot) => {
  can('find', 'tests', ['id', 'title', 'body', 'userId'], { userId: 1 })
  can('find', 'tests', ['id', 'title', 'userId'], { userId: 2 })
  can('find', 'tests', { userId: 3 })
  cannot('find', 'tests', ['secret'], { userId: 3 })
})

// no rule carries `fields`
const abilityWithoutFields = defineAbility((can) => {
  can('find', 'tests', { userId: { $in: [1, 2, 3] } })
})

const app = { get: () => undefined } as any

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    title: `t${i}`,
    body: `b${i}`,
    secret: `s${i}`,
    userId: (i % 4) + 1,
  }))

const makeContext = (
  items: unknown[],
  $select?: string[],
  ability_: unknown = ability,
) =>
  ({
    app,
    path: 'tests',
    method: 'find',
    type: 'after',
    service: { options: { id: 'id', casl: { availableFields } } },
    params: {
      provider: 'rest',
      ability: ability_,
      query: $select ? { $select } : {},
    },
    result: items,
  }) as any

const hook = authorize({ adapter: '@feathersjs/memory' })

for (const n of [100, 1000]) {
  const items = makeItems(n)

  test(`authorize after find (${n} items)`, async ({ bench }) => {
    await bench.compare(
      bench('without $select', async () => {
        await hook(makeContext(items.map((x) => ({ ...x }))))
      }),

      bench('with $select', async () => {
        await hook(
          makeContext(
            items.map((x) => ({ ...x })),
            ['id', 'title', 'secret', 'userId'],
          ),
        )
      }),

      bench('without field rules', async () => {
        await hook(
          makeContext(
            items.map((x) => ({ ...x })),
            undefined,
            abilityWithoutFields,
          ),
        )
      }),
    )
  })
}
