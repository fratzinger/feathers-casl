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

const HOOKNAME = "authorize";

export default (options?: Partial<AuthorizeHookOptions>): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      !options?.notSkippable && (
        shouldSkip(HOOKNAME, context) ||
        !context.params ||
        context.type === "error"
      )
    ) {
      return context;
    }

    const fullOptions = makeOptions(context.app, options);
    
    return (context.type === "before") 
      ? await authorizeBefore(fullOptions)(context) 
      : await authorizeAfter(fullOptions)(context);
  };
};
