import { PureAbility, Abilities } from "@casl/ability";
import { Rule } from "@casl/ability/dist/types/Rule";

export default (ability: PureAbility, action: string, modelName: string): Rule<Abilities, unknown>[]|false => {
  const rules = ability.possibleRulesFor(action, modelName);
  const hasConditions = rules.length === 0 || rules.some(x => !!x.conditions);
  return (hasConditions) ? rules : false;
};
