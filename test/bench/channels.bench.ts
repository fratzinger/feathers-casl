import { Channel } from '@feathersjs/transport-commons'
import { defineAbility } from '@casl/ability'

import { measure } from './builds.js'

const availableFields = ['id', 'title', 'body', 'secret', 'userId']

const roles = [
  (can: any) => can('get', 'tests'),
  (can: any) => can('get', 'tests', ['title', 'body']),
  (can: any) => can('get', 'tests', ['title'], { userId: 1 }),
  (can: any, cannot: any) => {
    can('get', 'tests')
    cannot('get', 'tests', ['secret'])
  },
]

// every connection gets its own ability instance, like one per user
const makeConnections = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    ability: defineAbility(roles[i % roles.length]),
  })) as any[]

const app = {
  get: () => undefined,
  channels: [],
  channel: () => new Channel(),
} as any

const context = {
  path: 'tests',
  method: 'patch',
  service: { options: { id: 'id' } },
} as any

// declared, as feathers-kysely's services do, but no rule reaches through one
const contextWithRelations = {
  ...context,
  service: {
    options: {
      id: 'id',
      relations: {
        user: { service: 'users', keyHere: 'userId', keyThere: 'id' },
      },
    },
  },
} as any

const data = () => ({ id: 1, title: 't', body: 'b', secret: 's', userId: 1 })

for (const n of [100, 1000]) {
  const connections = makeConnections(n)

  // all connections in `authenticated`, half of them additionally in a room
  const channels = [
    new Channel(connections),
    new Channel(connections.filter((_, i) => i % 2 === 0)),
  ]

  test(`getChannelsWithReadAbility (${n} connections)`, (context_) =>
    measure(context_, ({ getChannelsWithReadAbility }) => ({
      restrictFields: () =>
        getChannelsWithReadAbility(app, data(), context, {
          channels,
          availableFields,
        }),
      'restrictFields, relations declared': () =>
        getChannelsWithReadAbility(app, data(), contextWithRelations, {
          channels,
          availableFields,
        }),
      'restrictFields: false': () =>
        getChannelsWithReadAbility(app, data(), context, {
          channels,
          availableFields,
          restrictFields: false,
        }),
    })))
}
