import { detectSubjectType } from '@casl/ability'

import type { AnyAbility, Subject } from '@casl/ability'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

/** Every dotted path of `data`, into nested objects. */
function* paths(data: unknown, prefix = ''): Generator<string> {
  if (!isPlainObject(data)) return
  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key
    yield path
    yield* paths(value, path)
  }
}

/**
 * The fields of `data` an inverted rule forbids for `action` on `subject`, unless a later rule
 * allows them again. Without `availableFields` the permitted fields can't be listed, so these are
 * dropped instead, which keeps everything else, populated data included. A pattern like
 * `'address.*'` is matched against the paths of `data`; a subject type checks unconditional
 * rules only.
 */
export const getForbiddenFields = (
  ability: AnyAbility,
  action: string,
  subject: Subject,
  data: unknown = subject,
): string[] => {
  const subjectType =
    typeof subject === 'string' ? subject : detectSubjectType(subject)
  const rules = ability
    .possibleRulesFor(action, subjectType)
    .filter((rule) => rule.inverted && rule.fields)
  if (!rules.length) return []

  const named = new Set<string>()
  let hasPattern = false
  for (const rule of rules) {
    for (const field of rule.fields!) {
      if (field.includes('*')) hasPattern = true
      else named.add(field)
    }
  }
  if (hasPattern) {
    for (const path of paths(data)) {
      if (rules.some((rule) => rule.matchesField(path))) named.add(path)
    }
  }

  return [...named].filter((field) => !ability.can(action, subject, field))
}
