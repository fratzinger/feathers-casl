import { defineAbility } from '@casl/ability'
import { feathers } from '@feathersjs/feathers'
import { KyselyService } from '@fratzinger/feathers-kysely'
import { sql } from 'kysely'

import { db } from '../feathers-kysely/setup.js'
import { measureNet } from './builds.js'
import type { Case } from './builds.js'
import type * as Lib from '../../src/index.js'

/**
 * Whole calls on Postgres through feathers-kysely, per method, with `authorize` and without: what
 * feathers-casl costs net, its own queries included (a single `patch` reads its row first). No
 * relations; the ability of `authorize-methods.bench.ts`.
 */
const TABLE = 'casl_bench_tests'
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

// the table's rows, ids 1 to ROWS; a case's own rows come after them
const ROWS = 100
const row = (i: number) => ({
  title: `t${i}`,
  body: `b${i}`,
  secret: `s${i}`,
  userId: 1,
  published: i % 2 === 0,
})
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1))
const unpublished = (n: number) => Array.from({ length: n }, () => row(1))

const removeAdded = async () => {
  await db.deleteFrom(TABLE).where('id', '>', ROWS).execute()
}

/**
 * Each case starts on the table as it was: what the cases before it left behind (rows removed,
 * free space, statistics) would slow it by how much they wrote.
 */
function onFreshTable(cases: Record<string, Case>) {
  const reset = async () => {
    await sql`TRUNCATE ${sql.table(TABLE)} RESTART IDENTITY`.execute(db)
    await db.insertInto(TABLE).values(rows(ROWS)).execute()
  }
  for (const [name, task] of Object.entries(cases)) {
    cases[name] = {
      ...(typeof task === 'function' ? { fn: task } : task),
      beforeAll: reset,
    }
  }
  return cases
}

beforeAll(async () => {
  await db.schema.dropTable(TABLE).ifExists().execute()
  // no write-ahead log nor autovacuum: what's measured is feathers-casl, not the disk or a
  // cleanup that starts when it does
  await db.schema
    .createTable(TABLE)
    .modifyFront(sql`unlogged`)
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('title', 'text')
    .addColumn('body', 'text')
    .addColumn('secret', 'text')
    .addColumn('userId', 'integer')
    .addColumn('published', 'boolean')
    .modifyEnd(sql`with (autovacuum_enabled = false)`)
    .execute()
})

afterAll(async () => {
  await db.schema.dropTable(TABLE).execute()
})

type Hook = ReturnType<typeof Lib.authorize>

/** The table's service in an app of its own, with `hook` before and after it. */
function serviceWith(hook?: Hook) {
  const app = feathers()
  app.use(
    'tests',
    new KyselyService({
      Model: db,
      name: TABLE,
      multi: true,
      properties: Object.fromEntries(availableFields.map((f) => [f, true])),
      casl: { availableFields },
    }),
  )
  if (hook) {
    app
      .service('tests')
      .hooks({ before: { all: [hook] }, after: { all: [hook] } })
  }
  return app.service('tests')
}

const params = (query = {}) => ({ provider: 'rest', ability, query })

/** Removes `n` unpublished rows, as those may go, added before each call. */
function removing(tests: any, n: number) {
  let ids: number[] = []
  return {
    beforeEach: async () => {
      const added = await db
        .insertInto(TABLE)
        .values(unpublished(n))
        .returning('id')
        .execute()
      ids = added.map((r) => r.id)
    },
    fn: async () =>
      n === 1
        ? tests.remove(ids[0], params())
        : tests.remove(null, params({ id: { $in: ids } })),
  }
}

// async functions: tinybench calls any other once, without `beforeEach`, to tell whether it is
const oneRow = (tests: any) =>
  onFreshTable({
    get: async () => tests.get(2, params()),
    create: {
      fn: async () => tests.create(row(1), params()),
      afterEach: removeAdded,
    },
    // a published row: one patch rule, its fields
    patch: async () => tests.patch(2, { title: 'x' }, params()),
    remove: removing(tests, 1),
  })

const allRows = (tests: any) =>
  onFreshTable({
    find: async () => tests.find(params()),
    create: {
      fn: async () => tests.create(rows(ROWS), params()),
      afterEach: removeAdded,
    },
    patch: async () => tests.patch(null, { title: 'x' }, params()),
    remove: removing(tests, ROWS),
  })

const authorized = ({ authorize }: typeof Lib) =>
  serviceWith(authorize({ adapter: 'feathers-kysely' }))

test('authorize on Postgres, one row', (context) =>
  measureNet(context, (lib) => oneRow(authorized(lib)), oneRow(serviceWith())))

test(`authorize on Postgres, ${ROWS} rows`, (context) =>
  measureNet(
    context,
    (lib) => allRows(authorized(lib)),
    allRows(serviceWith()),
  ))
