import { shouldSkip } from "feathers-utils";

import { makeOptions } from "./authorize.hook.utils";
import authorizeAfter from "./authorize.hook.after";
import authorizeBefore from "./authorize.hook.before";

import type { HookContext, NextFunction } from "@feathersjs/feathers";
import type { AuthorizeHookOptions } from "../../types";

type Options = Partial<AuthorizeHookOptions>;

export const HOOKNAME = "authorize";

const skip = (_opts, _context) => {
  return (
    !_opts?.notSkippable &&
    (shouldSkip(HOOKNAME, _context) ||
      !_context.params ||
      _context.type === "error")
  );
};

export default (_options?: Options) => {
  return async (context: HookContext, next?: NextFunction) => {
    const hookShouldBeSkipped = skip(_options, context);
    if (hookShouldBeSkipped) {
      return context;
    }

    const options = makeOptions(context.app, _options);

    if (next) {
      if (hookShouldBeSkipped) {
        await next();
      } else {
        await authorizeBefore(context, options);
        await next();
        await authorizeAfter(context, options);
      }
      return context
    } else {
      return context.type === "before"
        ? await authorizeBefore(context, options)
        : await authorizeAfter(context, options);
    }
  };
};
