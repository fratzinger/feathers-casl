import type { AnyAbility } from '@casl/ability'

/**
 * Whether the rules for `action` on `modelName` need the query to be narrowed.
 *
 * `true` when at least one rule carries conditions, and also when there are no
 * rules at all - the caller then has nothing to go on and must not assume the
 * whole collection is readable.
 */
export const hasRestrictingConditions = (
  ability: AnyAbility,
  action: string,
  modelName: string,
): boolean => {
  const rules = ability.possibleRulesFor(action, modelName)
  return rules.length === 0 || rules.some((rule) => !!rule.conditions)
}
