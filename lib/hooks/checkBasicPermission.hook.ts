import { shouldSkip } from "feathers-utils";

import type { HookContext } from "@feathersjs/feathers";
import type { CheckBasicPermissionHookOptions } from "../types";
import { checkBasicPermissionUtil } from "../utils";

export const HOOKNAME = "checkBasicPermission";

export const checkBasicPermission = (
  _options?: Partial<CheckBasicPermissionHookOptions>
): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      !_options?.notSkippable &&
      (shouldSkip(HOOKNAME, context) ||
        context.type !== "before" ||
        !context.params)
    ) {
      return context;
    }

    return await checkBasicPermissionUtil(context, _options);
  };
};
