import { defineAbility } from '@casl/ability'

import { measure } from './builds.js'

/**
 * The whole `authorize` hook, before and after, per method: no relations, an ability of several
 * rules as a role has them, with conditions, fields and `cannot`s. The service answers at once:
 * what's measured is the hook.
 */
const availableFields = ['id', 'title', 'body', 'secret', 'userId', 'published']

const ability = defineAbility((can, cannot) => {
  can(
    ['find', 'get'],
    'tests',
    ['id', 'title', 'body', 'userId', 'published'],
    {
      published: true,
    },
  )
  can(['find', 'get'], 'tests', { userId: 1 })
  cannot(['find', 'get'], 'tests', ['secret'], { userId: { $ne: 1 } })
  can('create', 'tests', { userId: 1 })
  can(['patch', 'update'], 'tests', ['title', 'body', 'published'], {
    userId: 1,
  })
  can('patch', 'tests', ['published'], { published: false })
  can('remove', 'tests', { userId: 1 })
  cannot('remove', 'tests', { published: true })
})

const row = (id: number) => ({
  id,
  title: `t${id}`,
  body: `b${id}`,
  secret: `s${id}`,
  userId: 1,
  published: id % 2 === 0,
})
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(i))

const app = { get: () => undefined } as any
// the stored rows, at once
const service = {
  options: { id: 'id', casl: { availableFields } },
  _get: async (id: number) => row(id),
}

type Hook = (context: any) => Promise<unknown>

/** A call through `hook`: before it, the service's answer as its result, after it. */
const call =
  (
    hook: Hook,
    method: string,
    {
      id,
      data,
      result,
    }: { id?: number | null; data?: unknown; result: () => unknown },
  ) =>
  async () => {
    const context: any = {
      app,
      path: 'tests',
      service,
      method,
      id,
      data,
      type: 'before',
      params: { provider: 'rest', ability, query: {} },
    }
    await hook(context)
    context.type = 'after'
    context.result = result()
    await hook(context)
  }

test('authorize, before and after, one row', (context) =>
  measure(context, ({ authorize }) => {
    const hook = authorize({ adapter: '@feathersjs/memory' })
    return {
      get: call(hook, 'get', { id: 1, result: () => row(1) }),
      create: call(hook, 'create', { data: row(1), result: () => row(1) }),
      // both patch rules match the row: only what both allow, `secret` dropped
      patch: call(hook, 'patch', {
        id: 1,
        data: { published: true, secret: 'y' },
        result: () => row(1),
      }),
      remove: call(hook, 'remove', { id: 1, result: () => row(1) }),
    }
  }))

test('authorize, before and after, 100 rows', (context) =>
  measure(context, ({ authorize }) => {
    const hook = authorize({ adapter: '@feathersjs/memory' })
    return {
      find: call(hook, 'find', { result: () => rows(100) }),
      create: call(hook, 'create', {
        data: rows(100),
        result: () => rows(100),
      }),
      patch: call(hook, 'patch', {
        id: null,
        data: { title: 'x', secret: 'y' },
        result: () => rows(100),
      }),
      remove: call(hook, 'remove', { id: null, result: () => rows(100) }),
    }
  }))
