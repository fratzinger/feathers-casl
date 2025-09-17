import { knex } from 'knex'
import makeTests from '../makeTests/index.js'
import { KnexService } from '@feathersjs/knex'
import { getItemsIsArray } from '@fratzinger/feathers-utils'
import type { HookContext } from '@feathersjs/feathers'
import type { Adapter, ServiceCaslOptions } from '../../../../../src/index.js'

declare module '@feathersjs/knex' {
  interface KnexAdapterOptions {
    casl: ServiceCaslOptions
  }
}

const db = knex({
  client: 'sqlite3',
  debug: false,
  connection: {
    filename: ':memory:',
  },
  useNullAsDefault: true,
})

const makeService = () => {
  return new KnexService({
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

const adapter: Adapter = '@feathersjs/knex'

makeTests(
  adapter,
  makeService,
  async () => {
    await db.schema.dropTableIfExists('tests')
    await db.schema.createTable('tests', (table) => {
      table.increments('id')
      table.integer('userId')
      table.string('hi')
      table.boolean('test')
      table.boolean('published')
      table.boolean('supersecret')
      table.boolean('hidden')
    })
  },
  { adapter },
  { afterHooks },
)
