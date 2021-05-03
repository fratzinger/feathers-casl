import {
  shouldSkip,
} from "feathers-utils";

import {
  setPersistedConfig,
  checkMulti,
  getAbility,
  throwUnlessCan
} from "./authorize/authorize.hook.utils";

import {
  HookContext
} from "@feathersjs/feathers";

import {
  CheckBasicPermissionHookOptions, CheckBasicPermissionHookOptionsExclusive
} from "../types";
import { checkCreatePerItem, makeDefaultBaseOptions } from "./common";

export const HOOKNAME = "checkBasicPermission";

const defaultOptions: CheckBasicPermissionHookOptionsExclusive = {
  checkCreateForData: false,
  storeAbilityForAuthorize: false
};

const makeOptions = (options?: Partial<CheckBasicPermissionHookOptions>): CheckBasicPermissionHookOptions => {
  options = options || {};
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, options);
}; 

export default (
  providedOptions?: Partial<CheckBasicPermissionHookOptions>
): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      !providedOptions?.notSkippable && (
        shouldSkip(HOOKNAME, context) ||
        context.type !== "before" ||
        !context.params
      )
    ) { return context; }

    const options = makeOptions(providedOptions);

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
      options.actionOnForbidden
    );

    checkCreatePerItem(context, ability, modelName, options);

    if (options.storeAbilityForAuthorize) {
      setPersistedConfig(context, "ability", ability);
    }

    setPersistedConfig(context, "madeBasicCheck", true);

    return context;
  };
};