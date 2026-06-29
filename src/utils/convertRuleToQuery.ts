import _isPlainObject from 'lodash/isPlainObject.js'

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
    for (const prop in conditions as Record<string, unknown>) {
      const value = (conditions as Record<string, unknown>)[prop]
      if (_isPlainObject(value)) {
        const obj = value as Record<string, unknown>
        for (const name in obj) {
          if (!supportedOperators.includes(name)) {
            console.error(`CASL: not supported property: ${name}`)
            continue
          }
          clauses.push({ [prop]: invertedProp(obj, name) } as Query)
        }
      } else {
        clauses.push({ [prop]: { $ne: value } } as Query)
      }
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
