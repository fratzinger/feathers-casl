import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Service } from 'feathers-mongoose'
mongoose.Promise = global.Promise

import makeTests from './makeTests/index.js'
import { getItemsIsArray } from 'feathers-utils'
import type { ServiceCaslOptions } from '../../../../src/index.js'
import type { HookContext } from '@feathersjs/feathers'

let Model

declare module 'feathers-mongoose' {
  interface MongooseServiceOptions {
    casl: ServiceCaslOptions
  }
}

const makeService = () => {
  return new Service({
    Model,
    multi: true,
    lean: true,
    whitelist: ['$nor'],
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

const afterHooks = [
  (context: HookContext) => {
    const { items } = getItemsIsArray(context)

    items.forEach((item) => {
      delete item.__v
    })
  },
]

makeTests(
  'feathers-mongoose',
  makeService,
  async (app, service) => {
    await service.remove(null)
  },
  { adapter: 'feathers-mongoose' },
  afterHooks,
  async () => {
    const server = await MongoMemoryServer.create()
    const uri = server.getUri()

    const client = await mongoose.connect(uri)

    const { Schema } = client
    const schema = new Schema(
      {
        userId: { type: Number },
        hi: { type: String },
        test: { type: Boolean },
        published: { type: Boolean },
        supersecret: { type: Boolean },
        hidden: { type: Boolean },
      },
      {
        timestamps: false,
      },
    )

    if (client.modelNames().includes('tests')) {
      client.deleteModel('tests')
    }
    Model = client.model('tests', schema)
  },
)
