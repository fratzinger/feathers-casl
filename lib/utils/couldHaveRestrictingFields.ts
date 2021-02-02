import { PureAbility } from "@casl/ability";

function couldHaveRestrictingFields(ability: PureAbility, action: string, subjectType: string): boolean {
  return ability.possibleRulesFor(action, subjectType).some(rule => {
    return !!rule.fields;
  });
}

export default couldHaveRestrictingFields;