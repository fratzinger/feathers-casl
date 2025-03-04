import type { AnyAbility } from '@casl/ability'

export function couldHaveRestrictingFields(
  ability: AnyAbility,
  action: string,
  subjectType: string,
): boolean {
  return ability.possibleRulesFor(action, subjectType).some((rule) => {
    return !!rule.fields
  })
}
