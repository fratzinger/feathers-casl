import assert from 'node:assert'
import '@feathersjs/transport-commons'
import type {
  HookContext,
  Params,
  RealTimeConnection,
} from '@feathersjs/feathers'

import {
  getChannelsWithReadAbility,
  makeChannelOptions,
} from '../../../src/index.js'
import type { Application } from '@feathersjs/express'

export default function (app: Application): void {
  if (typeof app.channel !== 'function') {
    return
  }

  app.on('connection', (connection: RealTimeConnection): void => {
    app.channel('anonymous').join(connection)
  })

  app.on('login', (authResult: any, { connection }: Params): void => {
    if (connection) {
      if (authResult.ability) {
        connection.ability = authResult.ability
        connection.rules = authResult.rules
      }

      app.channel('anonymous').leave(connection)
      app.channel('authenticated').join(connection)
    }
  })

  const caslOptions = makeChannelOptions(app)

  const fields = caslOptions.availableFields({
    service: app.service('users'),
  })

  assert.deepStrictEqual(
    fields,
    undefined,
    'gets availableFields from service correctly',
  )

  app.publish((data: unknown, context: HookContext) => {
    const result = getChannelsWithReadAbility(
      app,
      data as Record<string, unknown>,
      context,
      caslOptions,
    )

    // e.g. to publish all service events to all authenticated users use
    return result
  })
}
