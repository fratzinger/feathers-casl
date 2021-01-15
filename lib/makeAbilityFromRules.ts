import { 
  Ability, 
  RawRuleFrom, 
  AbilityOptions, 
  AbilityTuple,
  Subject
} from "@casl/ability";


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (rules?: RawRuleFrom<AbilityTuple<string, Subject>, unknown>[], options?: AbilityOptions<AbilityTuple<string, Subject>, unknown>) => {
  return new Ability(rules, options);
};
