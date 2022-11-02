import type { 
  RawRuleFrom, 
  AbilityOptions, 
  AbilityTuple,
  MongoQuery
} from "@casl/ability";
import { 
  Ability
} from "@casl/ability";

function makeAbilityFromRules<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules?: RawRuleFrom<A, C>[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: AbilityOptions<A, C>
): Ability {
  rules = rules || [];
  options = options || {};
  return new Ability(rules, options);
}

export default makeAbilityFromRules;
