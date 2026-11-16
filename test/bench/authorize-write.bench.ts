import { Channel } from '@feathersjs/transport-commons'
import { defineAbility } from '@casl/ability'

import { measure } from './builds.js'

// a write's after hook, with real-time connections whose rules reach through no relation: what
// answering them for the write's events costs where there's nothing to answer
const ability = defineAbility((can) => {
  can('patch', 'tests', { userId: 1 })
  can('get', 'tests', { userId: 1 })
})
const roles = [
  (can: any) => can('get', 'tests'),
  (can: any) => can('get', 'tests', ['title'], { userId: 1 }),
]
const makeConnections = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    ability: defineAbility(roles[i % roles.length]),
  })) as any[]

const service = {
  options: {
    id: 'id',
    relations: {
      user: { service: 'users', keyHere: 'userId', keyThere: 'id' },
    },
  },
}
const appWith = (connections: any[]) =>
  ({
    get: () => undefined,
    channels: connections.length ? ['authenticated'] : [],
    channel: () => new Channel(connections),
  }) as any

const makeContext = (app: unknown) =>
  ({
    app,
    path: 'tests',
    method: 'patch',
    type: 'after',
    service,
    params: { provider: 'rest', ability, query: {} },
    result: { id: 1, title: 't', userId: 1 },
  }) as any

for (const n of [100, 1000]) {
  const withConnections = appWith(makeConnections(n))
  const withoutRealTime = appWith([])

  test(`authorize after patch (${n} connections)`, (context) =>
    measure(context, ({ authorize }) => {
      const hook = authorize({ adapter: '@feathersjs/memory' })
      return {
        'no real-time': () => hook(makeContext(withoutRealTime)),
        [`${n} connections`]: () => hook(makeContext(withConnections)),
      }
    }))
}
