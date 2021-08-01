import { detectSubjectType } from "@casl/ability";
import { mergeArrays } from "feathers-utils";

import type { AnyAbility } from "@casl/ability";
import type { GetMinimalFieldsOptions } from "../types";

const getMinimalFields = (
  ability: AnyAbility, 
  action: string, 
  subject: Record<string, unknown>, 
  options: GetMinimalFieldsOptions): string[] => 
{
  if (options.checkCan && !ability.can(action, subject)) {
    return [];
  }
  const subjectType = detectSubjectType(subject);
  const rules = ability.possibleRulesFor(action, subjectType).filter(rule => {
    const { fields } = rule;
    const matched = rule.matchesConditions(subject);
    return fields && matched;
  });
  if (rules.length === 0) { return options.availableFields || []; }
  let fields: string[];
  if (options.availableFields) {
    fields = options.availableFields;
  } else {
    fields = rules.find(x => !x.inverted)?.fields;
    if (!fields) { return []; }
  }

  rules.forEach(rule => {
    if (rule.inverted) {
      fields = fields.filter(x => !rule.fields.includes(x));
    } else {
      fields = mergeArrays(fields, rule.fields, "intersect");
    }
  });
  return fields;
};

export default getMinimalFields;