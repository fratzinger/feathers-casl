import { isEmptyObject, pickPaths } from 'feathers-utils/helpers'
import { Channel } from '@feathersjs/transport-commons'
import { subject } from '@casl/ability'

import {
  makeChannelOptions,
  getAbility,
  getEventName,
} from './channels.utils.js'

import {
  getModelName,
  getAvailableFields,
  getIdFields,
  mergeArrays,
} from '../utils/index.js'
import { hasRestrictingFields } from '../utils/hasRestrictingFields.js'

import type { RealTimeConnection } from '@feathersjs/transport-commons'

interface ConnectionsPerField {
  fields: false | string[]
  connections: RealTimeConnection[]
}

import type { HookContext, Application } from '@feathersjs/feathers'
import type { ChannelOptions, AnyData } from '../types.js'

export const getChannelsWithReadAbility = (
  app: Application,
  data: AnyData,
  context: HookContext,
  _options?: Partial<ChannelOptions>,
): undefined | Channel | Channel[] => {
  if (!_options?.channels && !app.channels.length) {
    return undefined
  }

  const options = makeChannelOptions(app, _options)
  const { channelOnError, activated } = options
  const modelName = getModelName(options.modelName, context)

  if (!activated || !modelName) {
    return !channelOnError ? new Channel() : app.channel(channelOnError)
  }

  let channels = options.channels || app.channel(app.channels)

  if (!Array.isArray(channels)) {
    channels = [channels]
  }

  const dataToTest = subject(modelName, data)

  let method = 'get'

  if (typeof options.useActionName === 'string') {
    method = options.useActionName
  } else {
    const eventName = getEventName(context.method)
    if (eventName && options.useActionName[eventName]) {
      method = options.useActionName[eventName] as string
    }
  }

  let result: Channel[] = []

  if (!options.restrictFields) {
    // return all fields for allowed

    result = channels.map((channel) => {
      return channel.filter((conn: any) => {
        const ability = getAbility(app, data, conn, context, options)
        const can = !!ability && ability.can(method, dataToTest)
        return can
      })
    })
  } else {
    // filter by restricted Fields
    // grouped by their fields, `fields.join()` as key - `false` means unrestricted
    const connectionsPerFields = new Map<string | false, ConnectionsPerField>()
    // a connection can be in multiple channels, but needs to be checked only once
    const seen = new Set<RealTimeConnection>()
    const availableFields = getAvailableFields(context, options)

    for (let i = 0, n = channels.length; i < n; i++) {
      const channel = channels[i]
      const { connections } = channel

      for (let j = 0, o = connections.length; j < o; j++) {
        const connection = connections[j]
        if (seen.has(connection)) {
          continue
        }
        seen.add(connection)

        const ability = getAbility(app, data, connection, context, options)
        if (!ability || !ability.can(method, dataToTest)) {
          // connection cannot read item -> don't send data
          continue
        }

        const fields = hasRestrictingFields(ability, method, dataToTest, {
          availableFields,
        })
        // if fields is true or fields is empty array -> full restriction
        if (fields === true || (fields && fields.length === 0)) {
          continue
        }
        const key = fields && fields.join('\0')
        const connField = connectionsPerFields.get(key)
        if (connField) {
          connField.connections.push(connection)
        } else {
          connectionsPerFields.set(key, {
            connections: [connection],
            fields,
          })
        }
      }
    }

    const idFields = getIdFields(context)

    for (const { fields, connections } of connectionsPerFields.values()) {
      // always keep the service id field(s) so records stay identifiable
      const restrictedData = fields
        ? pickPaths(data, mergeArrays(fields, idFields, 'combine') as string[])
        : data
      if (restrictedData && !isEmptyObject(restrictedData)) {
        result.push(new Channel(connections, restrictedData))
      }
    }
  }

  return result.length === 1 ? result[0] : result
}
