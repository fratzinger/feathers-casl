import { AnyAbility, Abilities } from "@casl/ability";
import { Rule } from "@casl/ability/dist/types/Rule";

const hasRestrictingConditions = (ability: AnyAbility, action: string, modelName: string): Rule<Abilities, unknown>[]|false => {
  const rules = ability.possibleRulesFor(action, modelName);
  const hasConditions = rules.length === 0 || rules.some(x => !!x.conditions);
  return (hasConditions) ? rules : false;
};

export default hasRestrictingConditions;