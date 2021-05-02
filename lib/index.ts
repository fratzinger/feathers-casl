import * as hooks from "./hooks";
import * as channels from "./channels";

import getConditionalQueryFor from "./utils/getConditionalQueryFor";
import getFieldsQueryFor from "./utils/getFieldsQueryFor";
import getQueryFor from "./utils/getQueryFor";
import hasRestrictingConditions from "./utils/hasRestrictingConditions";
import hasRestrictingFields from "./utils/hasRestrictingFields";

import initialize from "./initialize";

export default initialize;

export { hooks };
export { authorize, checkBasicPermission } from "./hooks";

export { channels };
export { getChannelsWithReadAbility } from "./channels";

export { default as makeAbilityFromRules } from "./makeAbilityFromRules";

export { 
  Ability, 
  AbilityBuilder,
  createAliasResolver, 
  defineAbility
} from "@casl/ability";

export const utils = {
  getConditionalQueryFor,
  getFieldsQueryFor,
  getQueryFor,
  hasRestrictingConditions,
  hasRestrictingFields
};

if (typeof module !== "undefined") {
  module.exports = Object.assign(initialize, module.exports);
}