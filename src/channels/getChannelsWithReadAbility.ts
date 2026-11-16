import { isEmptyObject, omitPaths, pickPaths } from 'feathers-utils/helpers'
import { Channel } from '@feathersjs/transport-commons'
import { subject } from '@casl/ability'

import {
  makeChannelOptions,
  getAbility as getConnectionAbility,
} from './channels.utils.js'
import {
  channelRelationsOf,
  channelsFor,
  getChannelAction,
} from './resolveChannelRelations.js'
import {
  answerRelations,
  getRelations,
  hasRelations,
  mayReachRelations,
} from '../utils/relations.js'

import {
  getModelName,
  getAvailableFields,
  getIdFields,
  mergeArrays,
} from '../utils/index.js'
import { hasRestrictingFields } from '../utils/hasRestrictingFields.js'
import { getForbiddenFields } from '../utils/getForbiddenFields.js'

import type { RealTimeConnection } from '@feathersjs/transport-commons'

interface ConnectionsPerField {
  fields: false | string[]
  omit: string[]
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

  const channels = channelsFor(app, options, data, context)

  const dataToTest = subject(modelName, data)

  const method = getChannelAction(options, context)

  // rules through a relation, answered by `authorize` for the write: else the worst
  const answers = channelRelationsOf(context)
  // a service without relations: as ever, nothing to answer per connection
  const actions = [method]
  let warned = false
  const onUnanswered = options.debug
    ? () => {
        if (warned) return
        warned = true
        console.warn(
          `Feathers-CASL: getChannelsWithReadAbility - rules through a relation without an answer for '${modelName}' (${context.method}): they count as the worst. Did 'authorize' run for this write, and are the publisher's channel options the app's?`,
        )
      }
    : undefined
  const getAbility: typeof getConnectionAbility = hasRelations(
    getRelations(context.service),
  )
    ? (app_, data_, connection, context_, options_) => {
        const ability = getConnectionAbility(
          app_,
          data_,
          connection,
          context_,
          options_,
        )
        // most can't reach a relation: as they are
        return ability && mayReachRelations(ability)
          ? answerRelations(
              context,
              ability,
              actions,
              modelName,
              answers,
              onUnanswered,
            )
          : ability
      }
    : getConnectionAbility

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
        // without `availableFields` only inverted rules can't be turned into permitted fields
        const omit =
          !fields && !availableFields
            ? getForbiddenFields(ability, method, dataToTest)
            : []
        const key = fields
          ? fields.join('\0')
          : omit.length
            ? `\u0001${omit.join('\0')}`
            : false
        const connField = connectionsPerFields.get(key)
        if (connField) {
          connField.connections.push(connection)
        } else {
          connectionsPerFields.set(key, {
            connections: [connection],
            fields,
            omit,
          })
        }
      }
    }

    const idFields = getIdFields(context)

    for (const { fields, omit, connections } of connectionsPerFields.values()) {
      // always keep the service id field(s) so records stay identifiable
      const restrictedData = fields
        ? pickPaths(data, mergeArrays(fields, idFields, 'combine') as string[])
        : omit.length
          ? omitPaths(data, omit)
          : data
      if (restrictedData && !isEmptyObject(restrictedData)) {
        result.push(new Channel(connections, restrictedData))
      }
    }
  }

  return result.length === 1 ? result[0] : result
}
