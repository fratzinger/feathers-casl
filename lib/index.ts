import * as hooks from "./hooks";
import * as channels from "./channels";

// utils
import checkCan from "./utils/checkCan";
import checkBasicPermission from "./utils/checkBasicPermission";
import hasRestrictingConditions from "./utils/hasRestrictingConditions";
import hasRestrictingFields from "./utils/hasRestrictingFields";
import mergeQueryFromAbility from "./utils/mergeQueryFromAbility";

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

export { 
  checkCan,
  mergeQueryFromAbility
};

export const utils = {
  checkCan,
  checkBasicPermission,
  hasRestrictingConditions,
  hasRestrictingFields,
  mergeQueryFromAbility
};

export * from "./types";

if (typeof module !== "undefined") {
  module.exports = Object.assign(initialize, module.exports);
}