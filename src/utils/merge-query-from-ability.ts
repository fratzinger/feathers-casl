import { rulesToQuery } from '@casl/ability/extra'
import { mergeQuery, simplifyQuery } from 'feathers-utils/utils'
import _isEmpty from 'lodash/isEmpty.js'

import { getAdapter } from '../hooks/authorize/authorize.hook.utils.js'
import { convertRuleToQuery } from './convertRuleToQuery.js'
import { hasRestrictingConditions } from './hasRestrictingConditions.js'

import type { AnyAbility } from '@casl/ability'
import type { Application, Query } from '@feathersjs/feathers'
import type { AdapterBase } from '@feathersjs/adapter-commons'
import type { Adapter, AuthorizeHookOptions } from '../types.js'

/**
 * How each adapter expresses the conditions of an inverted (`cannot`) rule:
 * - `feathers-kysely` as `{ $not: conditions }`
 * - `feathers-sequelize` as `{ $not: [conditions] }`
 * - `@feathersjs/memory`, `@feathersjs/mongodb` as `{ $nor: [conditions] }`
 *
 * Adapters not listed here (e.g. `@feathersjs/knex`) have no special inverted-rule
 * handling and instead invert the rule's operators via `convertRuleToQuery`.
 */
const invertedRuleToQuery: Partial<Record<Adapter, (rule: any) => Query>> = {
  'feathers-kysely': (rule) => ({ $not: rule.conditions }),
  'feathers-sequelize': (rule) => ({ $not: [rule.conditions] }),
  '@feathersjs/memory': (rule) => ({ $nor: [rule.conditions] }),
  '@feathersjs/mongodb': (rule) => ({ $nor: [rule.conditions] }),
}

export const mergeQueryFromAbility = <T>(
  app: Application,
  ability: AnyAbility,
  method: string,
  modelName: string,
  originalQuery: Query,
  service: AdapterBase<T>,
  options: Pick<AuthorizeHookOptions, 'adapter'>,
): Query => {
  if (!hasRestrictingConditions(ability, method, modelName)) {
    return originalQuery
  }

  const adapter = getAdapter(app, options)
  const invertRule = invertedRuleToQuery[adapter] ?? convertRuleToQuery

  const query = simplifyQuery(
    rulesToQuery(ability, method, modelName, (rule) =>
      rule.inverted ? invertRule(rule) : rule.conditions,
    ),
  )

  if (_isEmpty(query)) {
    return originalQuery
  }

  if (!originalQuery) {
    return query
  }

  return mergeQuery(originalQuery, query, { mode: 'intersect' })
}
