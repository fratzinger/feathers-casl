import * as hooks from "./hooks";
import * as channels from "./channels";

import hasRestrictingConditions from "./utils/hasRestrictingConditions";
import hasRestrictingFields from "./utils/hasRestrictingFields";
import checkCan from "./utils/checkCan";

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

export { checkCan };

export const utils = {
  hasRestrictingConditions,
  hasRestrictingFields,
  checkCan
};

if (typeof module !== "undefined") {
  module.exports = Object.assign(initialize, module.exports);
}