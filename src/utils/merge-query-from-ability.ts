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

/**
 * An empty query matches everything, so it's the neutral element of `$and` and
 * the absorbing one of `$or`. Collapsing single-element groups matters as well:
 * `$and`/`$or` are operators an adapter has to opt into, so don't ask for them
 * unless there really is more than one branch to combine.
 */
const and = (queries: Query[]): Query => {
  const relevant = queries.filter((query) => !_isEmpty(query))
  if (relevant.length === 0) {
    return {}
  }
  return relevant.length === 1 ? relevant[0] : { $and: relevant }
}

const or = (queries: Query[]): Query => {
  if (queries.length === 0 || queries.some((query) => _isEmpty(query))) {
    return {}
  }
  return queries.length === 1 ? queries[0] : { $or: queries }
}

/** An allowing rule, plus how many `cannot` rules outrank it. */
type Branch = { conditions: Query | undefined; boundedBy: number }

/**
 * Flattens casl's rule precedence (last rule wins, evaluated top down) into a
 * single feathers query.
 *
 * Every `can` becomes an `$or` branch, bounded by the `cannot` rules that
 * outrank it - lower ranked `cannot` rules are overridden and therefore
 * dropped. Bounds that all branches share are hoisted out of the `$or` instead
 * of being repeated in each branch, which keeps the query flat enough for
 * adapters that only whitelist `$or`/`$and` at the top level.
 */
const rulesToQuery = (
  rules: readonly any[],
  invertRule: (rule: any) => Query | undefined,
): Query | null => {
  const bounds: Query[] = []
  const branches: Branch[] = []

  for (const rule of rules) {
    if (rule.inverted) {
      if (!rule.conditions) {
        // denies everything below it, so nothing further can contribute
        break
      }
      bounds.push((invertRule(rule) ?? {}) as Query)
    } else {
      if (!rule.conditions) {
        // allows everything that the outranking `cannot` rules leave over
        branches.push({ conditions: undefined, boundedBy: bounds.length })
        break
      }
      branches.push({
        conditions: rule.conditions as Query,
        boundedBy: bounds.length,
      })
    }
  }

  if (branches.length === 0) {
    return null
  }

  // `bounds` only grows while iterating, so the first branch is the least
  // bounded one and its bounds are the ones every branch has in common
  const shared = branches[0].boundedBy
  const sharedBounds = bounds.slice(0, shared)

  const branchQueries = branches.map(({ conditions, boundedBy }) =>
    and([
      ...(conditions ? [conditions] : []),
      ...bounds.slice(shared, boundedBy),
    ]),
  )

  // an unbounded branch lets everything through, leaving only the shared bounds
  if (branchQueries.some((query) => _isEmpty(query))) {
    return and(sharedBounds)
  }

  if (sharedBounds.length === 0) {
    return or(branchQueries)
  }

  // keep the shared bounds as a sibling of `$or` instead of nesting one inside
  // the other - `simplifyQuery` can still flatten that into a plain query
  return { $or: branchQueries, $and: sharedBounds }
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
    rulesToQuery(ability.rulesFor(method, modelName), invertRule) ?? {},
  )

  if (_isEmpty(query)) {
    return originalQuery
  }

  if (!originalQuery) {
    return query
  }

  return mergeQuery(originalQuery, query, { mode: 'intersect' })
}
