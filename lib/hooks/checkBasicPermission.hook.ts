import {
  shouldSkip,
} from "feathers-utils";

import type {
  HookContext
} from "@feathersjs/feathers";

import type {
  CheckBasicPermissionHookOptions
} from "../types";

import checkBasicPermission from "../utils/checkBasicPermission";

export const HOOKNAME = "checkBasicPermission";

export default (
  _options?: Partial<CheckBasicPermissionHookOptions>
): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      !_options?.notSkippable && (
        shouldSkip(HOOKNAME, context) ||
        context.type !== "before" ||
        !context.params
      )
    ) { return context; }

    return await checkBasicPermission(context, _options);
  };
};