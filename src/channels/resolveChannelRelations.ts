import { getResultIsArray } from 'feathers-utils'

import { getIdFields } from '../utils/getIdFields.js'
import { getModelName } from '../utils/getModelName.js'
import {
  getRelations,
  hasRelations,
  hasRulesThroughRelations,
  idsToRemove,
  mayReachRelations,
  resolveRelationsOfEvent,
  rowsToRemove,
} from '../utils/relations.js'
import {
  getAbility,
  getEventName,
  makeChannelOptions,
} from './channels.utils.js'

import type { AnyAbility } from '@casl/ability'
import type { Application, HookContext } from '@feathersjs/feathers'
import type { Channel, RealTimeConnection } from '@feathersjs/transport-commons'
import type { AnyData, ChannelOptions } from '../types.js'
import type { RelationAnswers } from '../utils/relations.js'

const WRITES = new Set(['create', 'update', 'patch'])

/** The action a connection's ability is asked for an event: `useActionName`, per event or for all. */
export const getChannelAction = (
  options: Pick<ChannelOptions, 'useActionName'>,
  context: Pick<HookContext, 'method'>,
): string => {
  if (typeof options.useActionName === 'string') return options.useActionName
  const eventName = getEventName(context.method)
  return (eventName && options.useActionName[eventName]) || 'get'
}

/**
 * Per write, its events' answers. Not on `params`: a hook that calls another service with them
 * would hand the answers on to that one's events.
 */
const answersOf = new WeakMap<HookContext, RelationAnswers>()

/** What `resolveChannelRelations` answered for the events of `context`'s write. */
export const channelRelationsOf = (context: HookContext) =>
  answersOf.get(context)

/** The channels an event of `data` goes to before its connections are checked. */
export const channelsFor = (
  app: Application,
  options: Pick<ChannelOptions, 'channels'>,
  data: AnyData,
  context: HookContext,
): Channel[] => {
  const channels =
    typeof options.channels === 'function'
      ? options.channels(data, context)
      : (options.channels ?? app.channel(app.channels))
  return Array.isArray(channels) ? channels : [channels]
}

/**
 * For the events of a write, as channels stay synchronous: which of its rows the connections'
 * rules through a relation match, asked of the database once per distinct condition. By
 * `authorize`, `after` a create, update or patch and `before` a remove, whose rows are gone
 * after. The connections are those of the app's channel options (`channels`), per row.
 */
/**
 * Whether a write's events may need its rows' answers: a create, update or patch after, a remove
 * before, on a service with relations, with real-time connections. Synchronous, so nothing is
 * awaited where they can't.
 */
export const mayResolveChannelRelations = (
  context: HookContext,
  phase: 'before' | 'after',
): boolean =>
  (context.method === 'remove'
    ? phase === 'before'
    : phase === 'after' && WRITES.has(context.method)) &&
  hasRelations(getRelations(context.service)) &&
  !!context.app?.channels?.length

export const resolveChannelRelations = async (
  context: HookContext,
): Promise<void> => {
  const isRemove = context.method === 'remove'
  const { app } = context
  const options = makeChannelOptions(app)
  const modelName = getModelName(options.modelName, context)
  const [idField, ...compound] = getIdFields(context)
  if (!options.activated || !modelName || !idField || compound.length) return

  const action = getChannelAction(options, context)
  const relations = getRelations(context.service)
  const actions = [action]
  const reaches = (connection: RealTimeConnection, data: AnyData) => {
    const ability = getAbility(app, data, connection, context, options)
    // most abilities can't reach a relation at all: one lookup, nothing more
    return ability &&
      mayReachRelations(ability) &&
      hasRulesThroughRelations(ability, actions, modelName, relations)
      ? ability
      : undefined
  }

  // the rows: a remove's as its query finds them, whole where the channels depend on them, and
  // only once a connection could need them
  const perRow = typeof options.channels === 'function'
  let rows: AnyData[] | undefined
  if (!isRemove) rows = getResultIsArray(context).result
  else if (perRow) {
    const anyone = app.channel(app.channels).connections
    if (!anyone.some((connection) => reaches(connection, {}))) return
    rows = await rowsToRemove(context, idField)
  }

  // only those with rules through a relation: without any, nothing to ask. Each row's channels
  // are deduplicated already; several rows' may share connections.
  const data = rows?.[0] ?? {}
  const abilities = new Set<AnyAbility>()
  for (const row of rows && rows.length > 1 ? rows : [data]) {
    for (const channel of channelsFor(app, options, row, context)) {
      for (const connection of channel.connections) {
        const ability = reaches(connection, data)
        if (ability) abilities.add(ability)
      }
    }
  }
  if (!abilities.size) return

  rows ??= (await idsToRemove(context, idField)).map((id) => ({
    [idField]: id,
  }))
  const answers = await resolveRelationsOfEvent(
    context,
    [...abilities],
    action,
    modelName,
    rows.map((row) => row[idField]),
  )
  if (answers) answersOf.set(context, answers)
}
