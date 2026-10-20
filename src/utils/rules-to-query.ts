import { isEmptyObject } from 'feathers-utils/helpers'

import type { AnyAbility } from '@casl/ability'
import type { Query } from '@feathersjs/feathers'

type Rule = ReturnType<AnyAbility['rulesFor']>[0]

/**
 * Turns the rules of an ability into a feathers query.
 *
 * This used to be `rulesToQuery` from `@casl/ability/extra`, which
 * `@casl/ability@7` removed in favor of `rulesToCondition`. We only rely on
 * `ability.rulesFor()`, which is identical in both major versions, so the
 * generated query never depends on the installed casl version.
 *
 * Rules come in highest priority first. A `cannot` therefore only bounds the
 * `can` rules that follow it - a `can` declared *after* a `cannot` wins and
 * stays unbounded, just like `ability.can()` evaluates it. That's the fix
 * `@casl/ability@7` shipped as `rulesToCondition`, reimplemented here.
 */
export const rulesToQuery = (
  ability: AnyAbility,
  action: string,
  subjectType: string,
  convert: (rule: Rule) => Query,
): Query | null => {
  const branches: { condition: Query; bounds: Query[] }[] = []
  const bounds: Query[] = []

  for (const rule of ability.rulesFor(action, subjectType)) {
    // empty conditions `{}` match everything - casl@7 treats them like no
    // conditions at all, and so does a mongo matcher in casl@6
    if (!rule.conditions || isEmptyObject(rule.conditions)) {
      // a `cannot` without conditions forbids everything below it
      if (rule.inverted) {
        break
      }

      // a `can` without conditions allows everything that isn't forbidden by a
      // `cannot` above it - rules below it can't add anything
      if (!bounds.length) {
        return {}
      }

      branches.push({ condition: {}, bounds: [...bounds] })
      break
    }

    if (rule.inverted) {
      bounds.push(convert(rule))
    } else {
      branches.push({ condition: convert(rule), bounds: [...bounds] })
    }
  }

  if (!branches.length) {
    return null
  }

  // `bounds` only grows, so equal lengths mean every branch carries the same
  // bounds. Hoisting them keeps the query flat, which matters because feathers
  // accepts `$and`/`$or` as top level filters, but inside an `$or` branch only
  // if the service lists them in its `operators`.
  const sharedBounds = branches.every(
    (branch) => branch.bounds.length === bounds.length,
  )

  if (sharedBounds) {
    const $or = branches.map((branch) => branch.condition)
    return bounds.length ? { $or, $and: bounds } : { $or }
  }

  return {
    $or: branches.map(({ condition, bounds }) =>
      bounds.length ? boundCondition(condition, bounds) : condition,
    ),
  }
}

/**
 * Narrows a single `can` condition by the `cannot` conditions above it. Merges
 * them into one flat object where possible and only falls back to a nested
 * `$and` when both sides use the same key - a service needs `$and` in its
 * `operators` to accept that.
 */
const boundCondition = (condition: Query, bounds: Query[]): Query => {
  const merged: Query = { ...condition }

  for (const bound of bounds) {
    for (const [key, value] of Object.entries(bound)) {
      if (key in merged) {
        return { $and: [condition, ...bounds] }
      }

      merged[key] = value
    }
  }

  return merged
}
