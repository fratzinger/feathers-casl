import { detectSubjectType } from '@casl/ability'

import type { AnyAbility } from '@casl/ability'
import type { GetMinimalFieldsOptions } from '../types.js'

export const getMinimalFields = (
  ability: AnyAbility,
  action: string,
  subject: Record<string, unknown>,
  options: GetMinimalFieldsOptions,
): string[] => {
  if (options.checkCan && !ability.can(action, subject)) {
    return []
  }
  const subjectType = detectSubjectType(subject)
  // check `fields` first - matching the conditions is the expensive part
  const rules = ability
    .possibleRulesFor(action, subjectType)
    .filter((rule) => rule.fields && rule.matchesConditions(subject))
  if (rules.length === 0) {
    return options.availableFields || []
  }
  let fields: string[] | undefined
  if (options.availableFields) {
    fields = options.availableFields
  } else {
    fields = rules.find((x) => !x.inverted)?.fields
    if (!fields) {
      return []
    }
  }

  // `matchesField`, as a rule's fields may be patterns like `'address.*'`
  rules.forEach((rule) => {
    if (rule.inverted) {
      fields = fields?.filter((x) => !rule.matchesField(x))
    } else {
      fields = fields?.filter((x) => rule.matchesField(x))
    }
  })
  return fields
}
