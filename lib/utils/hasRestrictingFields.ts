import { permittedFieldsOf } from "@casl/ability/extra";
import getMinimalFields from "./getMinimalFields";

import type { AnyAbility, Subject } from "@casl/ability";
import type { PermittedFieldsOptions } from "@casl/ability/extra";
import type { HasRestrictingFieldsOptions } from "../types";

function areSameArray<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length != arr2.length) { return false; }
  const arr1test = arr1.slice().sort();
  const arr2test = arr2.slice().sort();
  const result = !arr1test.some((val, idx) => val !== arr2test[idx]);
  return result;
}

const hasRestrictingFields = (ability: AnyAbility, action: string, subject: Subject, options?: HasRestrictingFieldsOptions): boolean|string[] => {
  let fields: string[];
  if (typeof subject !== "string") {
    fields = getMinimalFields(ability, action, subject as Record<string, unknown>, {
      availableFields: options.availableFields,
      checkCan: false
    });
  } else {
    const permittedFieldsOfOptions: PermittedFieldsOptions<AnyAbility> = {
      fieldsFrom: (rule) => {
        return rule.fields || options.availableFields || [];
      }
    };

    fields = permittedFieldsOf(ability, action, subject, permittedFieldsOfOptions);
  }

  if (fields.length === 0 && !options.availableFields) {
    return false;
  }

  if (fields.length > 0) {
    // check if fields is restricting at all or just complete array
    if (
      options.availableFields === fields ||
      (options.availableFields && areSameArray(fields, options.availableFields))
    ) {
      // arrays are the same -> no restrictions
      return false;
    } else {
      return fields;
    }
  }

  return true;
};

export default hasRestrictingFields;