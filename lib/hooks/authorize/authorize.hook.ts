import { shouldSkip } from "feathers-utils";

import { makeOptions } from "./authorize.hook.utils";
import authorizeAfter from "./authorize.hook.after";
import authorizeBefore from "./authorize.hook.before";

import {
  HookContext
} from "@feathersjs/feathers";

import {
  AuthorizeHookOptions
} from "../../types";

const HOOKNAME = "authorize";

export default (options?: Partial<AuthorizeHookOptions>): ((context: HookContext) => Promise<HookContext>) => {
  return async (context: HookContext): Promise<HookContext> => {
    if (
      shouldSkip(HOOKNAME, context) ||
      !context.params ||
      context.type === "error"
    ) {
      return context;
    }

    options = makeOptions(context.app, options);
    
    return (context.type === "before") 
      ? await authorizeBefore(options)(context) 
      : await authorizeAfter(options)(context);
  };
};
