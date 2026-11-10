import { permittedFieldsOf } from '@casl/ability/extra'
import { getMinimalFields } from './getMinimalFields.js'

import type { AnyAbility, Subject } from '@casl/ability'
import type { PermittedFieldsOptions } from '@casl/ability/extra'
import type { HasRestrictingFieldsOptions } from '../types.js'

function areSameArray<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length != arr2.length) {
    return false
  }
  const arr1test = arr1.toSorted()
  const arr2test = arr2.toSorted()
  const result = !arr1test.some((val, idx) => val !== arr2test[idx])
  return result
}

export const hasRestrictingFields = (
  ability: AnyAbility,
  action: string,
  subject: Subject,
  options?: HasRestrictingFieldsOptions,
): boolean | string[] => {
  let fields: string[]
  if (typeof subject !== 'string') {
    fields = getMinimalFields(
      ability,
      action,
      subject as Record<string, unknown>,
      {
        availableFields: options?.availableFields,
        checkCan: false,
      },
    )
  } else {
    const availableFields = options?.availableFields
    const permittedFieldsOfOptions: PermittedFieldsOptions<AnyAbility> = {
      fieldsFrom: (rule) => {
        if (!rule.fields) return availableFields || []
        // a pattern like `'address.*'` stands for the available fields it matches
        return availableFields
          ? availableFields.filter((field) => rule.matchesField(field))
          : rule.fields
      },
    }

    fields = permittedFieldsOf(
      ability,
      action,
      subject,
      permittedFieldsOfOptions,
    )
  }

  if (fields.length === 0 && !options?.availableFields) {
    return false
  }

  if (fields.length > 0) {
    // check if fields is restricting at all or just complete array
    if (
      options?.availableFields === fields ||
      (options?.availableFields &&
        areSameArray(fields, options?.availableFields))
    ) {
      // arrays are the same -> no restrictions
      return false
    } else {
      return fields
    }
  }

  return true
}
