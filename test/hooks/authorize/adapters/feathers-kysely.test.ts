import { PostgresDialect, Kysely } from 'kysely'
import type { PoolConfig } from 'pg'
import { Pool } from 'pg'
import makeTests from './makeTests/index.js'
import type { Adapter, ServiceCaslOptions } from '../../../../src/types.js'
import { KyselyService } from '@fratzinger/feathers-kysely'
import { getItemsIsArray } from '@fratzinger/feathers-utils'
import type { HookContext } from '@feathersjs/feathers'

declare module '@fratzinger/feathers-kysely' {
  interface KyselyAdapterOptions {
    casl: ServiceCaslOptions
  }
}

const config: PoolConfig = {
  host: 'localhost',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password:
    'POSTGRES_PASSWORD' in process.env
      ? process.env.POSTGRES_PASSWORD
      : 'password',
  database: process.env.POSTGRES_DB ?? 'test',
  port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432,
  max: 10,
}

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool(config),
  }),
})

const makeService = () => {
  return new KyselyService({
    Model: db,
    name: 'tests',
    multi: true,
    casl: {
      availableFields: [
        'id',
        'userId',
        'hi',
        'test',
        'published',
        'supersecret',
        'hidden',
      ],
    },
    paginate: {
      default: 10,
      max: 50,
    },
  })
}

const boolFields = ['test', 'published', 'supersecret', 'hidden']

const afterHooks = [
  (context: HookContext) => {
    const { items, isArray } = getItemsIsArray(context)

    const result = items

    result.forEach((item, i) => {
      const keys = Object.keys(item)
      keys.forEach((key) => {
        if (item[key] === null) {
          delete item[key]
          return
        }
        if (boolFields.includes(key)) {
          item[key] = !!item[key]
        }
      })

      result[i] = { ...item }
    })

    context.result = isArray ? result : result[0]
  },
]

const adapter: Adapter = 'feathers-kysely'

makeTests(
  adapter,
  makeService,
  async () => {
    await db.schema.dropTable('tests').ifExists().execute()

    await db.schema
      .createTable('tests')
      .addColumn('id', 'serial', (col) => col.primaryKey())
      .addColumn('userId', 'integer')
      .addColumn('hi', 'varchar')
      .addColumn('test', 'boolean')
      .addColumn('published', 'boolean')
      .addColumn('supersecret', 'boolean')
      .addColumn('hidden', 'boolean')
      .execute()
  },
  { adapter },
  {
    afterHooks,
  },
)
