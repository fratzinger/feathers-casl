import { subject } from "@casl/ability";

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
import { makeDefaultBaseOptions } from "./common";

export const HOOKNAME = "checkBasicPermission";

const defaultOptions: CheckBasicPermissionHookOptionsExclusive = {
  storeAbilityForAuthorize: false
};

const makeOptions = (options?: Partial<CheckBasicPermissionHookOptions>): CheckBasicPermissionHookOptions => {
  options = options || {};
  return Object.assign(makeDefaultBaseOptions(), defaultOptions, options);
}; 

export default (
  options: CheckBasicPermissionHookOptions
): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      !options?.notSkippable && (
        shouldSkip(HOOKNAME, context) ||
        context.type !== "before" ||
        !context.params
      )
    ) { return context; }

    options = makeOptions(options);

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

    if (method === "create") {
      // we have all information we need (maybe we need populated data?)
      const data = (Array.isArray(context.data)) ? context.data : [context.data];
      for (let i = 0; i < data.length; i++) {
        throwUnlessCan(
          ability,
          method,
          subject(modelName, data[i]),
          modelName,
          options.actionOnForbidden
        );
      }
    }

    if (options.storeAbilityForAuthorize) {
      setPersistedConfig(context, "ability", ability);
    }

    setPersistedConfig(context, "madeBasicCheck", true);

    return context;
  };
};
