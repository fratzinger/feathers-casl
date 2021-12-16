import { subject } from "@casl/ability";
import { getItems } from "feathers-hooks-common";

import { throwUnlessCan } from "./authorize/authorize.hook.utils";

import type { AnyAbility } from "@casl/ability";
import type { HookContext } from "@feathersjs/feathers";
import type { 
  CheckBasicPermissionHookOptions, 
  HookBaseOptions, 
  ThrowUnlessCanOptions 
} from "../types";

const defaultOptions: HookBaseOptions = {
  ability: undefined,
  actionOnForbidden: undefined,
  checkMultiActions: false,
  checkAbilityForInternal: false,
  modelName: (context: Pick<HookContext, "path">): string => {
    return context.path;
  },
  notSkippable: false
};

export const makeDefaultBaseOptions = (): HookBaseOptions => {
  return Object.assign({}, defaultOptions);
};

export const checkCreatePerItem = (
  context: HookContext,
  ability: AnyAbility,
  modelName: string,
  options: Partial<Pick<ThrowUnlessCanOptions, "actionOnForbidden" | "skipThrow">> & Partial<Pick<CheckBasicPermissionHookOptions, "checkCreateForData">>
): HookContext => {
  const { method } = context;
  if (method !== "create" || !options.checkCreateForData) {
    return context; 
  }
  
  const checkCreateForData = (typeof options.checkCreateForData === "function") 
    ? options.checkCreateForData(context)
    : true;

  if (!checkCreateForData) { return context; }

  // we have all information we need (maybe we need populated data?)
  //@ts-expect-error type error because feathers-hooks-common not on feathers@5
  let items = getItems(context);
  items = (Array.isArray(items)) ? items : [items];

  for (let i = 0, n = items.length; i < n; i++) {
    throwUnlessCan(
      ability,
      method,
      subject(modelName, items[i]),
      modelName,
      options
    );
  }

  return context;
};