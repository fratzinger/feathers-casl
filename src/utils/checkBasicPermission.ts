import {
  setPersistedConfig,
  checkMulti,
  getAbility,
  throwUnlessCan,
} from "../hooks/authorize/authorize.hook.utils";

import { checkCreatePerItem, makeDefaultBaseOptions } from "../hooks/common";

import type { HookContext } from "@feathersjs/feathers";

import type {
  CheckBasicPermissionUtilsOptions,
  CheckBasicPermissionHookOptionsExclusive,
} from "../types";
import { getMethodName } from "./getMethodName";

const defaultOptions: CheckBasicPermissionHookOptionsExclusive = {
  checkCreateForData: false,
  storeAbilityForAuthorize: false,
};

const makeOptions = (
  options?: Partial<CheckBasicPermissionUtilsOptions>
): CheckBasicPermissionUtilsOptions => {
  options = options || {};
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, options);
};

export const checkBasicPermissionUtil = async <H extends HookContext>(
  context: H,
  _options?: Partial<CheckBasicPermissionUtilsOptions>
): Promise<H> => {
  let options = makeOptions(_options);

  const method = getMethodName(context, options);

  options = {
    ...options,
    method,
  };

  if (!options.modelName) {
    return context;
  }

  const modelName =
    typeof options.modelName === "string"
      ? options.modelName
      : options.modelName(context);

  if (!modelName) {
    return context;
  }

  const ability = await getAbility(context, options);
  if (!ability) {
    // Ignore internal or not authenticated requests
    return context;
  }

  if (options.checkMultiActions) {
    checkMulti(context, ability, modelName, options);
  }

  throwUnlessCan(ability, method, modelName, modelName, options);

  checkCreatePerItem(context, ability, modelName, options);

  if (options.storeAbilityForAuthorize) {
    setPersistedConfig(context, "ability", ability);
  }

  setPersistedConfig(context, "madeBasicCheck", true);

  return context;
};
