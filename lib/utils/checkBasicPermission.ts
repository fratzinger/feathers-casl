import {
  setPersistedConfig,
  checkMulti,
  getAbility,
  throwUnlessCan
} from "../hooks/authorize/authorize.hook.utils";
  
import { checkCreatePerItem, makeDefaultBaseOptions } from "../hooks/common";
  
import type {
  HookContext
} from "@feathersjs/feathers";
  
import type {
  CheckBasicPermissionUtilsOptions,
  CheckBasicPermissionHookOptionsExclusive
} from "../types";
  
export const HOOKNAME = "checkBasicPermission";
  
const defaultOptions: CheckBasicPermissionHookOptionsExclusive = {
  checkCreateForData: false,
  storeAbilityForAuthorize: false
};
  
const makeOptions = (options?: Partial<CheckBasicPermissionUtilsOptions>): CheckBasicPermissionUtilsOptions => {
  options = options || {};
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, options);
}; 
  
export default async (
  context: HookContext,
  _options?: Partial<CheckBasicPermissionUtilsOptions>
): Promise<HookContext> => {  
  const options = makeOptions(_options);
  
  const { method } = context;
  
  if (!options.modelName) {
    return context;
  }

  const modelName = (typeof options.modelName === "string")
    ? options.modelName
    : options.modelName(context);
  
  if (!modelName) { return context; }
  
  const ability = await getAbility(context, options);
  if (!ability) {
    // Ignore internal or not authenticated requests
    return context;
  }
  
  if (options.checkMultiActions) {
    checkMulti(context, ability, modelName, options);
  }
  
  throwUnlessCan(
    ability,
    method,
    modelName,
    modelName,
    options
  );
  
  checkCreatePerItem(context, ability, modelName, options);
  
  if (options.storeAbilityForAuthorize) {
    setPersistedConfig(context, "ability", ability);
  }
  
  setPersistedConfig(context, "madeBasicCheck", true);
  
  return context;
};