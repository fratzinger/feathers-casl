import { defineAbility } from '@casl/ability'

import { measure } from './builds.js'

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

// declared, as feathers-kysely's services do, but no rule reaches through one
const relations = {
  user: { service: 'users', keyHere: 'userId', keyThere: 'id' },
}

const makeContext = (
  items: unknown[],
  $select?: string[],
  ability_: unknown = ability,
  serviceOptions: Record<string, unknown> = {},
) =>
  ({
    app,
    path: 'tests',
    method: 'find',
    type: 'after',
    service: {
      options: { id: 'id', casl: { availableFields }, ...serviceOptions },
    },
    params: {
      provider: 'rest',
      ability: ability_,
      query: $select ? { $select } : {},
    },
    result: items,
  }) as any

for (const n of [100, 1000]) {
  const items = makeItems(n)
  const copies = () => items.map((x) => ({ ...x }))

  test(`authorize after find (${n} items)`, (context) =>
    measure(context, ({ authorize }) => {
      const hook = authorize({ adapter: '@feathersjs/memory' })
      return {
        'without $select': () => hook(makeContext(copies())),
        'with $select': () =>
          hook(makeContext(copies(), ['id', 'title', 'secret', 'userId'])),
        'relations declared, none in the rules': () =>
          hook(makeContext(copies(), undefined, ability, { relations })),
        'without field rules': () =>
          hook(makeContext(copies(), undefined, abilityWithoutFields)),
      }
    }))
}
