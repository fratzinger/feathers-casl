import { 
  Ability, 
  RawRuleFrom, 
  AbilityOptions, 
  AbilityTuple,
  MongoQuery
} from "@casl/ability";

function makeAbilityFromRules<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery>(
  rules?: RawRuleFrom<A, C>[],
  options?: AbilityOptions<A, C>
): Ability {
  rules = rules || [];
  options = options || {};
  return new Ability(rules, options);
}

export default makeAbilityFromRules;
