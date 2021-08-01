import type { AnyAbility } from "@casl/ability";

const getFieldsForConditions = (
  ability: AnyAbility, 
  action: string, 
  modelName: string
): string[] => {
  const rules = ability.possibleRulesFor(action, modelName);
  const allFields = [];
  for (const rule of rules) {
    if (!rule.conditions) { continue; }
    const fields = Object.keys(rule.conditions);
    fields.forEach(field => {
      if (!allFields.includes(field)) { allFields.push(field); }
    });
  }
  return allFields;
};

export default getFieldsForConditions;