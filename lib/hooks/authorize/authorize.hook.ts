import { shouldSkip } from "feathers-utils";

import { makeOptions } from "./authorize.hook.utils";
import authorizeAfter from "./authorize.hook.after";
import authorizeBefore from "./authorize.hook.before";

import type {
  HookContext
} from "@feathersjs/feathers";

import type {
  AuthorizeHookOptions
} from "../../types";

export const HOOKNAME = "authorize";

export default (
  _options?: Partial<AuthorizeHookOptions>
): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      !_options?.notSkippable && (
        shouldSkip(HOOKNAME, context) ||
        !context.params ||
        context.type === "error"
      )
    ) {
      return context;
    }

    const options = makeOptions(context.app, _options);
    
    return (context.type === "before") 
      ? await authorizeBefore(context, options)
      : await authorizeAfter(context, options);
  };
};
