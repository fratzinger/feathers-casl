import type { AnyAbility } from '@casl/ability'

type Rule = ReturnType<AnyAbility['possibleRulesFor']>[0]

export const hasRestrictingConditions = (
  ability: AnyAbility,
  action: string,
  modelName: string,
): Rule[] | false => {
  const rules = ability.possibleRulesFor(action, modelName)
  const hasConditions = rules.length === 0 || rules.some((x) => !!x.conditions)
  return hasConditions ? rules : false
}
