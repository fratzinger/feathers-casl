import { detectSubjectType } from '@casl/ability'

import type { AnyAbility } from '@casl/ability'

/**
 * The fields an inverted rule forbids on `subject` for `action`, unless a later rule allows them
 * again. Without `availableFields` the permitted fields of an item can't be listed, so these are
 * dropped from it instead, which keeps everything else, populated data included.
 */
export const getForbiddenFields = (
  ability: AnyAbility,
  action: string,
  subject: Record<string, unknown>,
): string[] => {
  const named = new Set<string>()
  for (const rule of ability.possibleRulesFor(
    action,
    detectSubjectType(subject),
  )) {
    if (rule.inverted && rule.fields) {
      for (const field of rule.fields) named.add(field)
    }
  }

  return [...named].filter((field) => !ability.can(action, subject, field))
}
