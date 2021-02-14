import { 
  Ability, 
  RawRuleFrom, 
  AbilityOptions, 
  AbilityTuple,
  Subject,
  MongoQueryOperators
} from "@casl/ability";

function makeAbilityFromRules(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules?: RawRuleFrom<AbilityTuple<string, Subject>, Record<string | number | symbol, string | number | boolean | Record<string | number | symbol, any> | MongoQueryOperators>>[], 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: AbilityOptions<AbilityTuple<string, Subject>, Record<string | number | symbol, string | number | boolean | Record<string | number | symbol, any> | MongoQueryOperators>>
): Ability {
  rules = rules || [];
  options = options || {};
  return new Ability(rules, options);
}

export default makeAbilityFromRules;
