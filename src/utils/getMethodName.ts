import type { HookContext } from "@feathersjs/feathers";

export const getMethodName = (
  context: HookContext,
  options?: { method?: string | ((context: HookContext) => string) }
): string => {
  if (options?.method) {
    if (typeof options.method === "function") {
      return options.method(context);
    } else {
      return options.method;
    }
  }

  return context.method;
};
