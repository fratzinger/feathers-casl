import { GeneralError } from '@feathersjs/errors'
import { isPlainObject } from 'feathers-utils/helpers'

import type { SubjectRawRule, MongoQuery, ClaimRawRule } from '@casl/ability'
import type { Query } from '@feathersjs/feathers'
import type { GetConditionalQueryOptions } from '../types.js'

const invertedMap = {
  $gt: '$lte',
  $gte: '$lt',
  $lt: '$gte',
  $lte: '$gt',
  $in: '$nin',
  $nin: '$in',
  $ne: (prop: Record<string, unknown>): unknown => {
    return prop['$ne']
  },
}

const supportedOperators = Object.keys(invertedMap)

const invertedProp = (
  prop: Record<string, unknown>,
  name: string,
): Record<string, unknown> | string | undefined => {
  // @ts-expect-error `name` maybe is not in `invertedMap`
  const map = invertedMap[name]
  if (typeof map === 'string') {
    return { [map]: prop[name] }
  } else if (typeof map === 'function') {
    return map(prop)
  }
}

/**
 * Turns a rule's conditions into a feathers query, negating them for inverted
 * (`cannot`) rules.
 *
 * Throws a `GeneralError` when an inverted rule uses only operators that can't
 * be negated - the alternative would be to hand back a query that doesn't
 * restrict anything, which reads as "allowed" and silently leaks records.
 */
export const convertRuleToQuery = (
  rule: SubjectRawRule<any, any, MongoQuery> | ClaimRawRule<any>,
  options?: GetConditionalQueryOptions,
): Query | undefined => {
  const { conditions, inverted } = rule
  if (!conditions) {
    if (inverted && options?.actionOnForbidden) {
      options.actionOnForbidden()
    }
    return undefined
  }
  if (inverted) {
    // A rule's `conditions` is a conjunction: every field (and every operator
    // within a field) must match for the rule to apply. Negating it therefore
    // follows De Morgan's law - `NOT (a AND b)` becomes `(NOT a) OR (NOT b)` -
    // so each atomic condition is inverted into its own clause and the clauses
    // are combined with `$or`. Naively merging the negations into a single
    // object would `AND` them instead and exclude far too many records.
    const clauses: Query[] = []
    const unsupported: string[] = []
    for (const prop in conditions as Record<string, unknown>) {
      const value = (conditions as Record<string, unknown>)[prop]
      if (isPlainObject(value)) {
        const obj = value as Record<string, unknown>
        for (const name in obj) {
          if (!Object.hasOwn(invertedMap, name)) {
            unsupported.push(`${prop}.${name}`)
            continue
          }
          clauses.push({ [prop]: invertedProp(obj, name) } as Query)
        }
      } else {
        clauses.push({ [prop]: { $ne: value } } as Query)
      }
    }

    if (unsupported.length) {
      const detail =
        `cannot negate ${unsupported.join(', ')} for this adapter. ` +
        `Invertible operators are ${supportedOperators.join(', ')}. ` +
        `Adapters with native support for inverted rules (@feathersjs/memory, ` +
        `@feathersjs/mongodb, feathers-kysely, feathers-sequelize) don't have ` +
        `this restriction.`

      if (clauses.length === 0) {
        // nothing left to restrict by - the `cannot` would just disappear
        throw new GeneralError(`feathers-casl: ${detail}`)
      }

      // dropping one branch of an `$or` narrows the result, so this errs on the
      // safe side - but the query is stricter than the rule asked for
      console.warn(
        `feathers-casl: ${detail} The condition is left out, so the query is ` +
          `more restrictive than the rule.`,
      )
    }

    if (clauses.length === 0) {
      return {}
    }
    if (clauses.length === 1) {
      return clauses[0]
    }
    return { $or: clauses }
  } else {
    return conditions as Query
  }
}
